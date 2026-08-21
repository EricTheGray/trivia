#!/usr/bin/env python3
"""Build data/game-modes.json from the workbook's "Year by Year" sheet.

Each mode is the fifteen most recent completed seasons of one column. The
workbook is source-verified and refreshed annually, so re-run this alongside
the feed import:

    python3 scripts/import-game-modes.py ~/Downloads/basketball_trivia_database.xlsx

Standard library only.
"""

import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import date

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "game-modes.json")
YEARS = 15
SECONDS = 180

# Column headers are matched by name so a reordered sheet does not silently
# shift the answers. `blurb` takes {first} — the earliest year in the round.
MODES = [
    {
        "key": "champions",
        "name": "Championships",
        "blurb": "Every finals winner since {first}",
        "chip": "#16130E",
        "title": "CHAMPIONSHIPS",
        "prompt": "Who won the {year} NBA Finals?",
        "input": "list",
        "column": "NBA Champion",
        # List-mode options: champions plus the teams they beat, so the picker
        # is not just the answer key.
        "optionColumns": ["NBA Champion", "Runner Up"],
    },
    {
        "key": "mvps",
        "name": "MVPs",
        "blurb": "Same clock, harder names",
        "chip": "#D9480F",
        "title": "MVPS",
        "prompt": "Who was MVP in {year}?",
        "input": "type",
        "column": "NBA MVP",
    },
    {
        "key": "dpoy",
        "name": "Defensive Players of the Year",
        "blurb": "Fifteen years of stoppers",
        "chip": "#16130E",
        "title": "DEFENSIVE PLAYERS",
        "prompt": "Who was Defensive Player of the Year in {year}?",
        "input": "type",
        "column": "Defensive POY",
    },
    {
        "key": "roy",
        "name": "Rookies of the Year",
        "blurb": "First-year winners, back to {first}",
        "chip": "#D9480F",
        "title": "ROOKIES",
        "prompt": "Who was Rookie of the Year in {year}?",
        "input": "type",
        "column": "Rookie of the Year",
    },
    {
        "key": "sixth",
        "name": "Six Men of the Year",
        "blurb": "The best off the bench",
        "chip": "#16130E",
        "title": "SIX MEN",
        "prompt": "Who was Sixth Man of the Year in {year}?",
        "input": "type",
        "column": "6th Man of the Year",
    },
    {
        "key": "firstpick",
        "name": "First Overall Draft Pick",
        "blurb": "Every number one in the draft",
        "chip": "#D9480F",
        "title": "FIRST PICKS",
        "prompt": "Who was drafted first overall in {year}?",
        "input": "type",
        "column": "1st Overall Draft Pick",
    },
]


def read_sheet(zf, shared, path):
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


def year_of(raw):
    try:
        return int(float(raw))
    except ValueError:
        return None


def main(path):
    with zipfile.ZipFile(path) as zf:
        shared = [
            "".join(t.text or "" for t in si.iter(NS + "t"))
            for si in ET.fromstring(zf.read("xl/sharedStrings.xml"))
        ]
        rows = list(read_sheet(zf, shared, find_sheet(zf, "Year by Year")))

    header, body = rows[0], rows[1:]
    columns = {name: letter for letter, name in header.items()}

    modes = []
    for spec in MODES:
        for name in [spec["column"], *spec.get("optionColumns", [])]:
            if name not in columns:
                raise SystemExit(f'Year by Year has no "{name}" column')

        # Only seasons where this column is actually filled in.
        filled = [
            row
            for row in body
            if year_of(row.get("A", "")) and row.get(columns[spec["column"]], "")
        ]
        filled.sort(key=lambda row: year_of(row["A"]), reverse=True)
        picked = filled[:YEARS]
        if len(picked) < YEARS:
            raise SystemExit(f'{spec["key"]}: only {len(picked)} seasons available')

        rounds = [
            {"year": year_of(row["A"]), "answer": row[columns[spec["column"]]]}
            for row in picked
        ]
        first = min(entry["year"] for entry in rounds)

        mode = {
            "key": spec["key"],
            "name": spec["name"],
            "blurb": spec["blurb"].format(first=first),
            "chip": spec["chip"],
            "title": spec["title"],
            "prompt": spec["prompt"],
            "input": spec["input"],
            "seconds": SECONDS,
            "rounds": rounds,
        }
        if spec["input"] == "list":
            options = {
                row[columns[name]]
                for row in picked
                for name in spec["optionColumns"]
                if row.get(columns[name], "")
            }
            mode["options"] = sorted(options)
        modes.append(mode)

    catalog = {
        "version": date.today().isoformat(),
        "source": os.path.basename(path),
        "modes": modes,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print(f"wrote {len(modes)} modes to {os.path.relpath(OUT)}")
    for mode in modes:
        span = f'{mode["rounds"][-1]["year"]}-{mode["rounds"][0]["year"]}'
        extra = f', {len(mode["options"])} options' if "options" in mode else ""
        print(f'  {mode["key"]:<10} {mode["input"]:<4} {span}{extra}')


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: import-game-modes.py <workbook.xlsx>")
    main(sys.argv[1])
