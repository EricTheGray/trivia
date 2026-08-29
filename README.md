# Hot Hand

Basketball trivia, two ways to play. The **feed** is an endless vertical swipe of
one question per screen — swipe up to reveal the answer, swipe up again for the
next. The **game modes** are nine rounds: six five-minute lists covering every
season on record, the champions' starting fives, and six guesses at a player —
daily or unlimited. No score, no streak, no fail state in the feed; no penalty for a wrong
answer in a round. Built from the design handoff in `design_handoff_hot_hand/`.

```bash
npm run dev
```

## Screens

- **Feed** (`app/components/trivia-feed.tsx`) — the pager, the difficulty ramp,
  mode promo cards every tenth question, sharing, and card trimming.
- **Timed round** (`app/components/timed-list.tsx`) — clock, progress, answer
  sheet, grading, summary. Serves the six year-by-year lists and Starting Fives.
- **Guess the Player** (`app/components/guess-player.tsx`) — six guesses, each
  scored on six traits, board kept on screen.
- **Shell** (`app/components/hot-hand.tsx`) — tab bar, modes list, settings.
- **Shared question** (`app/q/[id]`) — what a shared link opens. Question only,
  never the answer.

## Layout

The handoff is a phone design, and it stays exact at phone widths. Two
breakpoints widen it rather than stretching it — the shared tokens live in
`app/globals.css`, and `--hh-gutter` is the distance from the viewport edge to
the content column, so chrome pinned to the screen edges still lines up with the
text.

| Width | What changes |
|---|---|
| < 600px | The design as drawn. |
| ≥ 600px | More padding; the tab bar becomes a centred pill instead of a full-width strip. |
| ≥ 900px | Content settles into a 1100px column, display type steps up, the modes list pairs into two columns, a round shows all fifteen years in two columns without scrolling, and sheets become centred dialogs rather than bottom sheets. |

Feed cards stay full-bleed at every width — the colour change from question to
answer is the whole device. On a desktop the feed also answers the **wheel and
trackpad**: one notch or one flick moves a card, with a short cooldown so
momentum does not skip three at once. Arrow keys and clicking work everywhere.

## The modes

| Mode | Shape |
|---|---|
| Championships, MVPs, DPOY, Rookies, Six Men, First Picks | Every season the workbook has for that award — 80 champions, 71 MVPs — under a five-minute clock. |
| Starting Fives | All 57 champions since 1970, listed by position. Pick how many starters go missing from each lineup, 1 to 5; the sheet names the ones still standing. |
| Guess the Player | Six guesses at one player a day, from a 251-strong pool. Everyone gets the same player; the board keeps until tomorrow. |
| Guess the Player, Unlimited | The same game with a fresh player dealt every round, as often as you like. Nothing is kept. |

### Guess the Player

Both modes share one screen, and a mode's `daily` flag decides which it plays.
The daily player comes from hashing the local date, so everyone playing on the
same day gets the same one, and the board is kept in `localStorage` until
tomorrow; the unlimited mode draws at random, never twice in a row, and keeps
nothing. Each guess is scored on the six traits the workbook carries
(`lib/guess-players/compare.ts`):

- **Drafted, height, jersey** — hit, or an arrow towards the answer.
- **Position** — hit, or *close* when the two share a letter (F-C against C).
- **College** — hit or miss, with "no college" a third state that two players
  can share: 31 of the pool went prep-to-pro or came from overseas.
- **Drafted by** — hit, *close* for the right conference, or miss. Franchises
  are placed by where the lineage sits today, so a Syracuse Nationals pick
  counts as East.

## Answering a round

Every timed round is typed, with autocomplete. Five of them draw on the full NBA
player roster; Championships draws on all thirty current teams. Suggestions
appear at **three characters**, ranked by the word people actually type —
surname or nickname first, then any other word starting with the query, then
anything containing it, most recently active first.

Grading is forgiving, in this order (`lib/players/matching.ts`):

1. **Normalised** — accents, punctuation and case are ignored, so `Jokić`,
   `Jokic` and `jokic` all land together, as do `Jaren Jackson Jr` and
   `jaren jackson jr.`.
2. **Nicknames** — `giannis`, `sga`, `wemby`, `the beard`, `jjj` for players;
   `dubs`, `okc`, `sixers`, `blazers`, `cavs` for teams. Both tables also
   surface as suggestions.
3. **Exact name**, then a **bare surname or nickname** when only one entry has
   it (`embiid`, `gobert`, `lakers`, `celtics`). When several share it, the
   round's own answers break the tie.
4. **Return takes the top match** when nothing above resolves — ordinary
   autocomplete behaviour, and the same rule in a round and in the guess game.

Anything else commits exactly what was typed and is marked wrong — a wrong guess
should be a wrong guess, not a dead end.

The match pool is the whole roster plus the round's own answers, so the
suggestions never narrow down to the answer key. The team pool is the thirty
current franchises: every one of their nicknames is unique, so `lakers` resolves
on its own — which stops being true the moment the historical teams in the
workbook are added alongside them.

## Design canvas

```bash
npm run dev
```

Then open [/design](http://localhost:3000/design). Every screen sits on one page
at a size you choose — phone, small phone, tablet, desktop — with the pieces
they are built from underneath: the palette, the type scale, and every state a
clue cell can be in.

The frames are the running app in iframes, not mock-ups, so what is on the
canvas is what ships and each one is playable in place. They deep-link through
`?screen=` — `?screen=modes`, or `?screen=mode:guess` to open a round — which
also works on its own for sharing a screen or reproducing a bug. The reference
boards import the app's own stylesheets, so a cell that changes changes here
too rather than drifting into a redrawn swatch.

## Data

Three datasets, all generated from source files and committed under `data/`:

| File | From | Contents |
|---|---|---|
| `feed-questions.json` | workbook, **Feed** sheet | 700 approved questions, difficulty 1–4, category, topic tag, pair id |
| `game-modes.json` | workbook, **Year by Year** sheet | the six modes, fifteen most recent seasons each |
| `players.json` | `FinishedNBAPlayers.csv` | 5,367 players, ranked for autocomplete |
| `teams.json` | workbook, **Beat The Clock** sheet | the 30 current NBA franchises |
| `starting-fives.json` | workbook, **Starting 5** + player sheets | 57 champion lineups, each starter given a position |
| `guess-players.json` | workbook, **Guess the Player** sheet | 251 players with the six clue traits |

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

```bash
npm run import:teams ~/Downloads/basketball_trivia_database.xlsx
```

```bash
npm run import:starting5 ~/Downloads/basketball_trivia_database.xlsx
```

```bash
npm run import:guess ~/Downloads/basketball_trivia_database.xlsx
```

The scripts are standard-library Python — no openpyxl, no pandas — and read both
ways a workbook can store text, since this one switched to inline strings and
dropped its shared-strings table. Because the year rounds take every season on
record, their blurbs are written from the data ("Every finals winner since
1947") rather than hardcoded, so they stay true after a refresh.

Two imports will stop rather than ship something wrong: Starting Fives if a
starter cannot be matched to a position (the workbook records Lew Alcindor and
Ron Artest under the names of the day, which the script maps), and Guess the
Player if a drafting team has no conference on file.

### Moving a dataset to a remote repository

Nothing reads the JSON files directly. Each goes through `createDataset`
(`lib/dataset.ts`), and moving one to a remote repository is a single
environment variable:

```bash
QUESTIONS_API_URL=https://example.com/questions   # optional: QUESTIONS_API_TOKEN
MODES_API_URL=https://example.com/modes           # optional: MODES_API_TOKEN
PLAYERS_API_URL=https://example.com/players       # optional: PLAYERS_API_TOKEN
TEAMS_API_URL=https://example.com/teams           # optional: TEAMS_API_TOKEN
LINEUPS_API_URL=https://example.com/lineups       # optional: LINEUPS_API_TOKEN
GUESS_API_URL=https://example.com/guess-players   # optional: GUESS_API_TOKEN
```

- Unset → the committed copy under `data/`.
- Set → that endpoint, cached for an hour, falling back to the committed copy if
  it is unreachable, so a round or a feed never comes up empty.

Each endpoint returns the same shape as its file, and every response is
validated before it reaches the UI. The matching routes — `/api/questions`,
`/api/modes`, `/api/players`, `/api/teams`, `/api/starting-fives`,
`/api/guess-players` — serve the data to clients and report which source answered
in an `x-<dataset>-source` header. Each pool endpoint also
takes `?q=`, running the same ranked search server-side for callers that would
rather not hold the list.

A mode's `kind` (`"years"`, `"lineups"`, `"guess"`) picks which screen plays it,
and its `pool` (`"players"` or `"teams"`) picks which list its answers are typed
against — so a new mode over a new pool means a dataset and a route, not surgery
on an existing round.
