#!/usr/bin/env python3
"""Build data/players.json — the roster behind the typed-answer autocomplete.

    python3 scripts/import-players.py ~/Downloads/FinishedNBAPlayers.csv

Names keep their accents (Nikola Jokić); matching normalises them away, so the
app can display the correct spelling and still accept "jokic".

The output list is ordered by how likely a player is to be the one someone
means — most recently active first, Hall of Famers ahead of their contemporaries
— and the app preserves that order when it filters. Order is the ranking.

Standard library only.
"""

import csv
import json
import os
import sys
from datetime import date

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "players.json")


def to_year(raw, fallback=0):
    try:
        return int(float(raw))
    except (TypeError, ValueError):
        return fallback


def main(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    required = {"Player", "To", "Hall Of Fame"}
    missing = required - set(rows[0] if rows else {})
    if missing:
        raise SystemExit(f"CSV is missing column(s): {', '.join(sorted(missing))}")

    # ~46 names belong to two different players. They collapse to one entry:
    # the pool is for recognising a name, not for telling the two apart.
    merged = {}
    for row in rows:
        name = (row["Player"] or "").strip()
        if not name:
            continue
        last = to_year(row["To"])
        hof = row["Hall Of Fame"] == "1"
        if name in merged:
            previous = merged[name]
            merged[name] = (max(previous[0], last), previous[1] or hof)
        else:
            merged[name] = (last, hof)

    ranked = sorted(
        merged.items(),
        key=lambda entry: (-entry[1][0], not entry[1][1], entry[0]),
    )
    players = [name for name, _ in ranked]

    roster = {
        "version": date.today().isoformat(),
        "source": os.path.basename(path),
        "players": players,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(roster, f, ensure_ascii=False, indent=1)
        f.write("\n")

    duplicates = len(rows) - len(merged)
    accented = sum(1 for name in players if any(ord(c) > 127 for c in name))
    print(f"wrote {len(players)} players to {os.path.relpath(OUT)}")
    print(f"  merged {duplicates} shared names, {accented} keep accents")
    print(f"  first by rank: {', '.join(players[:5])}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: import-players.py <players.csv>")
    main(sys.argv[1])
