#!/usr/bin/env python3
"""Convert the Feed sheet of the basketball trivia workbook into data/feed-questions.json.

The workbook is the source of truth and gets an annual refresh (see its
"Maintenance Notes" sheet). Re-run this after every refresh:

    python3 scripts/import-feed-questions.py ~/Downloads/basketball_trivia_database.xlsx

Standard library only — no openpyxl, no pandas.
"""

import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import date

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
DIFFICULTY = {"Easy": 1, "Medium": 2, "Hard": 3, "Expert": 4}
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "feed-questions.json")


def read_sheet(zf, shared, path):
    """Yield each non-empty row of a worksheet as a {column letter: value} dict."""
    root = ET.fromstring(zf.read(path))
    for row in root.iter(NS + "row"):
        cells = {}
        for cell in row:
            col = re.match(r"[A-Z]+", cell.get("r")).group()
            kind, value = cell.get("t"), cell.find(NS + "v")
            if kind == "inlineStr":
                text = "".join(t.text or "" for t in cell.iter(NS + "t"))
            elif value is None:
                text = ""
            elif kind == "s":
                text = shared[int(value.text)]
            else:
                text = value.text
            cells[col] = (text or "").strip()
        if any(cells.values()):
            yield cells


def find_sheet(zf, name):
    """Resolve a sheet name to its worksheet part via the workbook relationships."""
    rels = {
        r.get("Id"): r.get("Target")
        for r in ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    }
    rid_attr = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    for sheet in ET.fromstring(zf.read("xl/workbook.xml")).find(NS + "sheets"):
        if sheet.get("name") == name:
            target = rels[sheet.get(rid_attr)].lstrip("/")
            return target if target.startswith("xl/") else "xl/" + target
    raise SystemExit(f'no "{name}" sheet in this workbook')


def main(path):
    with zipfile.ZipFile(path) as zf:
        shared = [
            "".join(t.text or "" for t in si.iter(NS + "t"))
            for si in ET.fromstring(zf.read("xl/sharedStrings.xml"))
        ]
        rows = list(read_sheet(zf, shared, find_sheet(zf, "Feed")))

    header, body = rows[0], rows[1:]
    columns = {name: letter for letter, name in header.items()}
    expected = ["ID", "Difficulty", "Category", "Topic Tag", "Pair ID", "Question", "Answer", "Status"]
    missing = [name for name in expected if name not in columns]
    if missing:
        raise SystemExit(f"Feed sheet is missing column(s): {', '.join(missing)}")

    def col(row, name):
        return row.get(columns[name], "")

    questions, skipped = [], []
    for row in body:
        if col(row, "Status") != "Approved":
            skipped.append((col(row, "ID"), col(row, "Status") or "no status"))
            continue
        difficulty = DIFFICULTY.get(col(row, "Difficulty"))
        if difficulty is None:
            skipped.append((col(row, "ID"), f'difficulty "{col(row, "Difficulty")}"'))
            continue
        # IDs arrive from the sheet as floats ("1.0").
        raw_id = col(row, "ID")
        identifier = raw_id[:-2] if raw_id.endswith(".0") else raw_id
        question = {
            "id": identifier,
            "q": col(row, "Question"),
            "a": col(row, "Answer"),
            "d": difficulty,
            "category": col(row, "Category"),
            "topic": col(row, "Topic Tag"),
        }
        if col(row, "Pair ID"):
            question["pairId"] = col(row, "Pair ID")
        if not question["q"] or not question["a"]:
            skipped.append((identifier, "blank question or answer"))
            continue
        questions.append(question)

    seen = {}
    for question in questions:
        if question["id"] in seen:
            raise SystemExit(f'duplicate question id {question["id"]}')
        seen[question["id"]] = question

    bank = {
        "version": date.today().isoformat(),
        "source": os.path.basename(path),
        "questions": questions,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(bank, f, ensure_ascii=False, indent=1)
        f.write("\n")

    by_level = {level: 0 for level in sorted(DIFFICULTY.values())}
    for question in questions:
        by_level[question["d"]] += 1
    print(f"wrote {len(questions)} questions to {os.path.relpath(OUT)}")
    print("  by difficulty: " + ", ".join(f"{k}:{v}" for k, v in by_level.items()))
    if skipped:
        print(f"  skipped {len(skipped)}: " + ", ".join(f"{i} ({why})" for i, why in skipped[:10]))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: import-feed-questions.py <workbook.xlsx>")
    main(sys.argv[1])
