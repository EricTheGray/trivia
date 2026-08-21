# Hot Hand

Basketball trivia, two ways to play. The **feed** is an endless vertical swipe of
one question per screen — swipe up to reveal the answer, swipe up again for the
next. The **game modes** are six three-minute rounds: fifteen years each, fill in
as many as you can. No score, no streak, no fail state in the feed; no penalty
for a wrong answer in a round. Built from the design handoff in
`design_handoff_hot_hand/`.

```bash
npm run dev
```

## Screens

- **Feed** (`app/components/trivia-feed.tsx`) — the pager, the difficulty ramp,
  mode promo cards every tenth question, sharing, and card trimming.
- **Timed round** (`app/components/timed-list.tsx`) — clock, progress, answer
  sheet, grading, summary. One component serves all six modes.
- **Shell** (`app/components/hot-hand.tsx`) — tab bar, modes list, settings.
- **Shared question** (`app/q/[id]`) — what a shared link opens. Question only,
  never the answer.

## Answering a round

Championships picks from a list of teams. The five player modes are typed, with
autocomplete over the full NBA roster — suggestions appear at **three
characters**, ranked surname matches first, then other word matches, then
anything containing the query, most recently active players first.

Grading is forgiving, in this order (`lib/players/matching.ts`):

1. **Normalised** — accents, punctuation and case are ignored, so `Jokić`,
   `Jokic` and `jokic` all land together, as do `Jaren Jackson Jr` and
   `jaren jackson jr.`.
2. **Nicknames** — `giannis`, `sga`, `wemby`, `the beard`, `jjj` and the rest of
   the table, which also surface as suggestions.
3. **Exact name**, then a **bare surname** when only one player answers to it
   (`embiid`, `gobert`). When several share it, the round's own answers break
   the tie.
4. **A query narrowed to one player** commits that player on return.

Anything else commits exactly what was typed and is marked wrong — a wrong guess
should be a wrong guess, not a dead end.

The match pool is the whole roster plus the round's own answers, so the
suggestions never narrow down to the answer key.

## Data

Three datasets, all generated from source files and committed under `data/`:

| File | From | Contents |
|---|---|---|
| `feed-questions.json` | workbook, **Feed** sheet | 700 approved questions, difficulty 1–4, category, topic tag, pair id |
| `game-modes.json` | workbook, **Year by Year** sheet | the six modes, fifteen most recent seasons each |
| `players.json` | `FinishedNBAPlayers.csv` | 5,367 players, ranked for autocomplete |

Re-import after each refresh (the workbook asks for one every February):

```bash
npm run import:questions ~/Downloads/basketball_trivia_database.xlsx
```

```bash
npm run import:modes ~/Downloads/basketball_trivia_database.xlsx
```

```bash
npm run import:players ~/Downloads/FinishedNBAPlayers.csv
```

The scripts are standard-library Python — no openpyxl, no pandas. Because the
modes always take the fifteen most recent completed seasons, their blurbs are
written from the data ("Every finals winner since 2012") rather than hardcoded,
so they stay true after a refresh.

### Moving a dataset to a remote repository

Nothing reads the JSON files directly. Each goes through `createDataset`
(`lib/dataset.ts`), and moving one to a remote repository is a single
environment variable:

```bash
QUESTIONS_API_URL=https://example.com/questions   # optional: QUESTIONS_API_TOKEN
MODES_API_URL=https://example.com/modes           # optional: MODES_API_TOKEN
PLAYERS_API_URL=https://example.com/players       # optional: PLAYERS_API_TOKEN
```

- Unset → the committed copy under `data/`.
- Set → that endpoint, cached for an hour, falling back to the committed copy if
  it is unreachable, so a round or a feed never comes up empty.

Each endpoint returns the same shape as its file, and every response is
validated before it reaches the UI. The matching routes — `/api/questions`,
`/api/modes`, `/api/players` — serve the data to clients and report which source
answered in an `x-<dataset>-source` header. `/api/players?q=` runs the same
ranked search server-side for callers that would rather not hold the roster.
