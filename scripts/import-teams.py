#!/usr/bin/env python3
"""Build data/teams.json — the roster behind team autocomplete.

    python3 scripts/import-teams.py ~/Downloads/basketball_trivia_database.xlsx

Reads the "NBA Teams" column of the workbook's Beat The Clock sheet: the thirty
current franchises. Historical teams sit in their own column and are left out on
purpose — every current nickname is unique, so "lakers" or "celtics" resolves on
its own, which stops being true the moment Minneapolis and Vancouver join in.
"""

import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _xlsx import read_rows, require_columns  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "teams.json")
SHEET = "Beat The Clock"
COLUMN = "NBA Teams"


def main(path):
    rows = read_rows(path, SHEET)
    require_columns(rows, SHEET, COLUMN)

    teams = sorted({row[COLUMN] for row in rows if row[COLUMN]})
    if not teams:
        raise SystemExit(f'"{COLUMN}" column is empty')

    nicknames = [team.split()[-1].lower() for team in teams]
    clashes = sorted({name for name in nicknames if nicknames.count(name) > 1})

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(
            {"version": date.today().isoformat(), "source": os.path.basename(path), "teams": teams},
            f,
            ensure_ascii=False,
            indent=1,
        )
        f.write("\n")

    print(f"wrote {len(teams)} teams to {os.path.relpath(OUT)}")
    print(
        "  shared nicknames: " + ", ".join(clashes)
        if clashes
        else "  every nickname is unique, so a bare nickname resolves"
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: import-teams.py <workbook.xlsx>")
    main(sys.argv[1])
