#!/usr/bin/env python3
"""Build data/guess-players.json — the answer pool for Guess the Player.

    python3 scripts/import-guess-players.py ~/Downloads/basketball_trivia_database.xlsx

Reads the workbook's Guess the Player sheet, Include=YES rows only, and carries
the six clue traits it documents: year drafted, height in inches, position,
college, drafting team, jersey number.

The drafting-team clue has a middle state — right conference, wrong team — so
each team is tagged with a conference here. Franchises are placed by where the
lineage sits today: a player drafted by the Syracuse Nationals counts as East,
because that franchise is the 76ers.
"""

import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _xlsx import read_rows, require_columns, to_int  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "guess-players.json")
SHEET = "Guess the Player"

NO_COLLEGE_PREFIX = "None"

CONFERENCES = {
    "Atlanta Hawks": "East",
    "Baltimore Bullets": "East",
    "Boston Celtics": "East",
    "Buffalo Braves": "West",
    "Charlotte Bobcats": "East",
    "Charlotte Hornets": "East",
    "Chicago Bulls": "East",
    "Chicago Zephyrs": "East",
    "Cincinnati Kings": "West",
    "Cleveland Cavaliers": "East",
    "Dallas Mavericks": "West",
    "Denver Nuggets": "West",
    "Detroit Pistons": "East",
    "Golden State Warriors": "West",
    "Houston Rockets": "West",
    "Indiana Pacers": "East",
    "Kansas City-Omaha Kings": "West",
    "Los Angeles Clippers": "West",
    "Los Angeles Lakers": "West",
    "Memphis Grizzlies": "West",
    "Miami Heat": "East",
    "Milwaukee Bucks": "East",
    "Milwaukee Hawks": "East",
    "Minneapolis Lakers": "West",
    "Minnesota Timberwolves": "West",
    "New Jersey Nets": "East",
    "New Orleans Hornets": "West",
    "New Orleans Pelicans": "West",
    "New York Knicks": "East",
    "New York Nets": "East",
    "OKC Thunder": "West",
    "Orlando Magic": "East",
    "Philadelphia 76ers": "East",
    "Philadelphia Warriors": "West",
    "Phoenix Suns": "West",
    "Portland Trail Blazers": "West",
    "Sacramento Kings": "West",
    "San Antonio Spurs": "West",
    "San Diego Clippers": "West",
    "San Diego Rockets": "West",
    "San Francisco Warriors": "West",
    "Seattle Supersonics": "West",
    "St. Louis Hawks": "East",
    "Syracuse Nationals": "East",
    "Toronto Raptors": "East",
    "Tri-City Blackhawks": "East",
    "Undrafted": None,
    "Utah Jazz": "West",
    "Utah Stars": None,  # ABA, never had an NBA conference
    "Vancouver Grizzlies": "West",
    "Washington Bullets": "East",
    "Washington Wizards": "East",
}


def main(path):
    rows = read_rows(path, SHEET)
    require_columns(
        rows, SHEET, "Include", "Score", "Player", "Year Drafted", "HeightIn",
        "Height", "Position", "Colleges", "Team Drafted By", "Jersey Number",
    )

    included = [row for row in rows if row["Include"].upper() == "YES"]
    if not included:
        raise SystemExit("no Include=YES rows on the Guess the Player sheet")

    unknown_teams = sorted({row["Team Drafted By"] for row in included} - set(CONFERENCES))
    if unknown_teams:
        raise SystemExit("no conference for: " + ", ".join(unknown_teams))

    def score(row):
        try:
            return float(row["Score"])
        except ValueError:
            return 0.0

    # One row per name: the sheet carries two Patrick Ewings, and a guess can
    # only mean one of them — keep the one the pool is really about.
    best = {}
    for row in included:
        name = row["Player"]
        if name not in best or score(row) > score(best[name]):
            best[name] = row

    players, incomplete = [], []
    for name, row in best.items():
        drafted = to_int(row["Year Drafted"])
        height_in = to_int(row["HeightIn"])
        jersey = to_int(row["Jersey Number"])
        if drafted is None or height_in is None or jersey is None or not row["Position"]:
            incomplete.append(name)
            continue
        college = row["Colleges"]
        players.append(
            {
                "name": name,
                "drafted": drafted,
                "heightIn": height_in,
                "height": row["Height"],
                "position": row["Position"],
                "college": None if college.startswith(NO_COLLEGE_PREFIX) else college,
                "team": row["Team Drafted By"],
                "conference": CONFERENCES[row["Team Drafted By"]],
                "jersey": jersey,
            }
        )

    if incomplete:
        raise SystemExit("missing clue traits for: " + ", ".join(sorted(incomplete)))

    players.sort(key=lambda player: player["name"])

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(
            {
                "version": date.today().isoformat(),
                "source": os.path.basename(path),
                "players": players,
            },
            f,
            ensure_ascii=False,
            indent=1,
        )
        f.write("\n")

    no_college = sum(1 for player in players if player["college"] is None)
    dropped = len(included) - len(best)
    print(f"wrote {len(players)} players to {os.path.relpath(OUT)}")
    print(f"  {no_college} with no college, {dropped} duplicate name(s) merged")
    print(f'  drafted {min(p["drafted"] for p in players)}-{max(p["drafted"] for p in players)}, '
          f'height {min(p["heightIn"] for p in players)}-{max(p["heightIn"] for p in players)}in')


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: import-guess-players.py <workbook.xlsx>")
    main(sys.argv[1])
