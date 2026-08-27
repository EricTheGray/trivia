#!/usr/bin/env python3
"""Build data/game-modes.json — the catalogue of timed rounds.

    python3 scripts/import-game-modes.py ~/Downloads/basketball_trivia_database.xlsx

The year rounds take *every* season the workbook has for their column, newest
first. Two further modes are catalogue entries only: their data lives in
data/starting-fives.json and data/guess-players.json.
"""

import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _xlsx import read_rows, require_columns, to_int  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "game-modes.json")
SHEET = "Year by Year"
SECONDS = 300

# Column headers are matched by name so a reordered sheet does not silently
# shift the answers. `blurb` takes {first} — the earliest year in the round.
# `pool` picks which autocomplete list the round's answers are typed against.
YEAR_MODES = [
    {
        "key": "champions",
        "name": "Championships",
        "blurb": "Every finals winner since {first}",
        "chip": "#16130E",
        "title": "CHAMPIONSHIPS",
        "prompt": "Who won the {year} NBA Finals?",
        "pool": "teams",
        "column": "NBA Champion",
    },
    {
        "key": "mvps",
        "name": "MVPs",
        "blurb": "Same clock, harder names",
        "chip": "#D9480F",
        "title": "MVPS",
        "prompt": "Who was MVP in {year}?",
        "pool": "players",
        "column": "NBA MVP",
    },
    {
        "key": "dpoy",
        "name": "Defensive Players of the Year",
        "blurb": "Every stopper since {first}",
        "chip": "#16130E",
        "title": "DEFENSIVE PLAYERS",
        "prompt": "Who was Defensive Player of the Year in {year}?",
        "pool": "players",
        "column": "Defensive POY",
    },
    {
        "key": "roy",
        "name": "Rookies of the Year",
        "blurb": "First-year winners, back to {first}",
        "chip": "#D9480F",
        "title": "ROOKIES",
        "prompt": "Who was Rookie of the Year in {year}?",
        "pool": "players",
        "column": "Rookie of the Year",
    },
    {
        "key": "sixth",
        "name": "Six Men of the Year",
        "blurb": "The best off the bench since {first}",
        "chip": "#16130E",
        "title": "SIX MEN",
        "prompt": "Who was Sixth Man of the Year in {year}?",
        "pool": "players",
        "column": "6th Man of the Year",
    },
    {
        "key": "firstpick",
        "name": "First Overall Draft Pick",
        "blurb": "Every number one since {first}",
        "chip": "#D9480F",
        "title": "FIRST PICKS",
        "prompt": "Who was drafted first overall in {year}?",
        "pool": "players",
        "column": "1st Overall Draft Pick",
    },
]

# Modes whose data is its own dataset; this file only carries how they present.
OTHER_MODES = [
    {
        "key": "starting5",
        "kind": "lineups",
        "name": "Starting Fives",
        "blurb": "Name the champions' game one starters",
        "chip": "#D9480F",
        "title": "STARTING 5",
        "prompt": "{year} {team} — who started at {position}?",
        "pool": "players",
        "seconds": SECONDS,
    },
    {
        "key": "guess",
        "kind": "guess",
        "name": "Guess the Player",
        "blurb": "Six guesses, one player a day",
        "chip": "#16130E",
        "title": "GUESS THE PLAYER",
        "prompt": "Guess the player",
        "pool": "players",
    },
]


def main(path):
    rows = read_rows(path, SHEET)
    require_columns(rows, SHEET, "Year", *[spec["column"] for spec in YEAR_MODES])

    modes = []
    for spec in YEAR_MODES:
        filled = [row for row in rows if to_int(row["Year"]) and row[spec["column"]]]
        filled.sort(key=lambda row: to_int(row["Year"]), reverse=True)
        if not filled:
            raise SystemExit(f'{spec["key"]}: no seasons in "{spec["column"]}"')

        rounds = [
            {"year": to_int(row["Year"]), "answer": row[spec["column"]]} for row in filled
        ]
        first = min(entry["year"] for entry in rounds)
        modes.append(
            {
                "key": spec["key"],
                "kind": "years",
                "name": spec["name"],
                "blurb": spec["blurb"].format(first=first),
                "chip": spec["chip"],
                "title": spec["title"],
                "prompt": spec["prompt"],
                "pool": spec["pool"],
                "seconds": SECONDS,
                "rounds": rounds,
            }
        )

    modes.extend(OTHER_MODES)

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(
            {
                "version": date.today().isoformat(),
                "source": os.path.basename(path),
                "modes": modes,
            },
            f,
            ensure_ascii=False,
            indent=1,
        )
        f.write("\n")

    print(f"wrote {len(modes)} modes to {os.path.relpath(OUT)}")
    for mode in modes:
        if mode["kind"] == "years":
            span = f'{mode["rounds"][-1]["year"]}-{mode["rounds"][0]["year"]}'
            print(f'  {mode["key"]:<10} {mode["kind"]:<8} {len(mode["rounds"]):>3} rounds  {span}')
        else:
            print(f'  {mode["key"]:<10} {mode["kind"]:<8}   (own dataset)')


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: import-game-modes.py <workbook.xlsx>")
    main(sys.argv[1])
