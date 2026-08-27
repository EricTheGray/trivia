#!/usr/bin/env python3
"""Build data/starting-fives.json — champions' game one starting lineups.

    python3 scripts/import-starting-fives.py ~/Downloads/basketball_trivia_database.xlsx

Each starter is joined to the List of NBA Players sheet for a position, so the
round can list a lineup by position and ask for the missing men. The join is
required: a starter without a position stops the import rather than shipping a
lineup the round cannot label.
"""

import json
import os
import sys
from collections import defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _xlsx import read_rows, require_columns, to_int  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "starting-fives.json")
SHEET = "Starting 5"
PLAYERS_SHEET = "List of NBA Players"

# Starters the workbook records under the name of the day. The players sheet
# files them under the name they are indexed by today.
RENAMED = {
    "Lew Alcindor": "Kareem Abdul-Jabbar",
    "Nate Archibald": "Tiny Archibald",
    "Ron Artest": "Metta World Peace",
}

# Guards first, then forwards, then centres — how a lineup is read out.
POSITION_ORDER = {"G": 0, "G-F": 1, "F-G": 2, "F": 3, "F-C": 4, "C-F": 5, "C": 6}


def main(path):
    lineup_rows = read_rows(path, SHEET)
    require_columns(lineup_rows, SHEET, "Year", "NBA Champion", *[f"Starter {i}" for i in range(1, 6)])

    player_rows = read_rows(path, PLAYERS_SHEET)
    require_columns(player_rows, PLAYERS_SHEET, "Player", "Position", "From", "To")

    by_name = defaultdict(list)
    for row in player_rows:
        by_name[row["Player"]].append(row)

    def position_of(name, year):
        candidates = by_name.get(RENAMED.get(name, name), [])
        if len(candidates) > 1:
            # Two players share the name; the one whose career covers this final.
            era = [
                row
                for row in candidates
                if (to_int(row["From"], 0) - 1) <= year <= (to_int(row["To"], 9999) + 1)
            ]
            candidates = era or candidates
        if len(candidates) != 1 or not candidates[0]["Position"]:
            return None
        return candidates[0]["Position"]

    lineups, unresolved = [], []
    for row in lineup_rows:
        year = to_int(row["Year"])
        if not year:
            continue
        starters = []
        for i in range(1, 6):
            name = row[f"Starter {i}"]
            if not name:
                continue
            position = position_of(name, year)
            if position is None:
                unresolved.append((year, name))
                continue
            starters.append({"name": name, "position": position})

        if len(starters) != 5:
            continue
        starters.sort(key=lambda s: (POSITION_ORDER.get(s["position"], 9), s["name"]))
        lineups.append({"year": year, "team": row["NBA Champion"], "starters": starters})

    if unresolved:
        listed = ", ".join(f"{year} {name}" for year, name in unresolved)
        raise SystemExit(f"no position for: {listed}\nAdd them to RENAMED or fix the players sheet.")

    lineups.sort(key=lambda lineup: lineup["year"], reverse=True)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(
            {
                "version": date.today().isoformat(),
                "source": os.path.basename(path),
                "lineups": lineups,
            },
            f,
            ensure_ascii=False,
            indent=1,
        )
        f.write("\n")

    span = f'{lineups[-1]["year"]}-{lineups[0]["year"]}'
    print(f"wrote {len(lineups)} lineups to {os.path.relpath(OUT)}  ({span})")
    sample = lineups[0]
    print(f'  {sample["year"]} {sample["team"]}: ' + ", ".join(
        f'{s["position"]} {s["name"]}' for s in sample["starters"]
    ))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: import-starting-fives.py <workbook.xlsx>")
    main(sys.argv[1])
