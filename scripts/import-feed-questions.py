#!/usr/bin/env python3
"""Convert the Feed sheet of the basketball trivia workbook into data/feed-questions.json.

The workbook is the source of truth and gets an annual refresh (see its
"Maintenance Notes" sheet). Re-run this after every refresh:

    python3 scripts/import-feed-questions.py ~/Downloads/basketball_trivia_database.xlsx
"""

import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _xlsx import read_rows, require_columns  # noqa: E402

DIFFICULTY = {"Easy": 1, "Medium": 2, "Hard": 3, "Expert": 4}
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "feed-questions.json")
SHEET = "Feed"


def main(path):
    rows = read_rows(path, SHEET)
    require_columns(
        rows, SHEET, "ID", "Difficulty", "Category", "Topic Tag", "Pair ID",
        "Question", "Answer", "Status",
    )

    questions, skipped = [], []
    for row in rows:
        if row["Status"] != "Approved":
            skipped.append((row["ID"], row["Status"] or "no status"))
            continue
        difficulty = DIFFICULTY.get(row["Difficulty"])
        if difficulty is None:
            skipped.append((row["ID"], f'difficulty "{row["Difficulty"]}"'))
            continue

        identifier = row["ID"][:-2] if row["ID"].endswith(".0") else row["ID"]
        if not row["Question"] or not row["Answer"]:
            skipped.append((identifier, "blank question or answer"))
            continue

        question = {
            "id": identifier,
            "q": row["Question"],
            "a": row["Answer"],
            "d": difficulty,
            "category": row["Category"],
            "topic": row["Topic Tag"],
        }
        if row["Pair ID"]:
            question["pairId"] = row["Pair ID"]
        questions.append(question)

    seen = set()
    for question in questions:
        if question["id"] in seen:
            raise SystemExit(f'duplicate question id {question["id"]}')
        seen.add(question["id"])

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(
            {
                "version": date.today().isoformat(),
                "source": os.path.basename(path),
                "questions": questions,
            },
            f,
            ensure_ascii=False,
            indent=1,
        )
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
