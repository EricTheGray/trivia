"use client";

import { useEffect, useMemo, useState } from "react";
import type { GuessMode } from "@/lib/game-modes";
import {
  compareGuess,
  deduceHints,
  formatHeight,
  isCorrect,
  type Bound,
  type Hints,
  localIsoDate,
  pickDailyPlayer,
  pickRandomPlayer,
  type Clue,
  type GuessPlayer as Player,
  type GuessPool,
} from "@/lib/guess-players";
import { createNameIndex } from "@/lib/matching";
import { PLAYER_ALIASES } from "@/lib/players";
import { GuessPad } from "./guess-pad";
import styles from "./guess-player.module.css";

/**
 * Six guesses at a player. Every guess comes back scored on the six traits the
 * workbook carries, and the whole board stays on screen.
 *
 * Two modes share this screen. The daily one gives everyone the same player and
 * keeps the board until tomorrow; the unlimited one deals a fresh player as
 * often as you want and keeps nothing.
 */

const MAX_GUESSES = 6;
const STORAGE_KEY = "hot-hand.guess";

/** Named once above the board rather than on every cell of every guess. */
/** How the workbook files players who never heard their name called. */
const UNDRAFTED = "Undrafted";

/** In the order the clues come back. */
const COLUMNS = [
  { key: "drafted", label: "Draft" },
  { key: "height", label: "Height" },
  { key: "position", label: "Pos" },
  { key: "college", label: "College" },
  { key: "team", label: "Team" },
  { key: "jersey", label: "No." },
] as const;

/** How long the winning row is left to light up before the reveal takes over. */
const REVEAL_DELAY_MS = { solved: 900, lost: 420 };

/**
 * College names arrive with a lot of furniture — "University of Central
 * Arkansas" — and a few players have two schools run together. Strip the
 * furniture; the tooltip keeps whatever is left over.
 */
function shortCollege(value: string) {
  return (
    value
      .replace(/\bUniversity of\b/gi, "")
      .replace(/\bUniversity\b/gi, "")
      .replace(/\bCommunity College\b/gi, "CC")
      .replace(/\bCollege\b/gi, "")
      .replace(/\s+/g, " ")
      .trim() || value
  );
}

let poolRequest: Promise<Player[]> | null = null;

function loadGuessPoolOnce(): Promise<Player[]> {
  poolRequest ??= fetch("/api/guess-players")
    .then((response) => {
      if (!response.ok) throw new Error(`guess players API responded ${response.status}`);
      return response.json() as Promise<GuessPool>;
    })
    .then((payload) => payload.players)
    .catch((error) => {
      poolRequest = null;
      throw error;
    });
  return poolRequest;
}

type Stored = { date: string; guesses: string[] };

/**
 * The board is read straight out of storage on mount. This component only ever
 * renders in the browser — the shell mounts it when a mode is chosen — so there
 * is no server render to disagree with.
 */
function readStored(today: string): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw) as Stored;
    return stored.date === today && Array.isArray(stored.guesses) ? stored.guesses : [];
  } catch {
    return [];
  }
}

function writeStored(today: string, guesses: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, guesses }));
  } catch {
    // A blocked store just means the board does not survive a reload.
  }
}

type GuessPlayerProps = {
  mode: GuessMode;
  active: boolean;
  onBack?: () => void;
  /** The reveal covers the screen, so it reports itself like a sheet. */
  onSheetChange?: (open: boolean) => void;
};

export function GuessPlayerRound({ mode, active, onBack, onSheetChange }: GuessPlayerProps) {
  const daily = mode.daily;
  const [today] = useState(() => localIsoDate(new Date()));
  const [pool, setPool] = useState<Player[]>([]);
  const [names, setNames] = useState<string[]>(() => (daily ? readStored(today) : []));
  /** Unlimited mode only; the daily target comes from the date. */
  const [dealt, setDealt] = useState<string | null>(null);
  /** The full-screen reveal, held back a beat so a winning row can light up. */
  const [revealed, setRevealed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let live = true;
    loadGuessPoolOnce()
      .then((players) => {
        if (!live) return;
        setPool(players);
        // Dealing here rather than in render keeps the pick out of the render
        // path, where a random draw has no business being.
        if (!daily) setDealt(pickRandomPlayer(players).name);
      })
      .catch((error) => {
        console.error("[guess-players] pool unavailable:", error);
      });
    return () => {
      live = false;
    };
  }, [daily]);


  useEffect(() => onSheetChange?.(active && revealed), [active, revealed, onSheetChange]);
  useEffect(() => () => onSheetChange?.(false), [onSheetChange]);

  const target = useMemo(() => {
    if (!pool.length) return null;
    if (daily) return pickDailyPlayer(pool, today);
    return pool.find((player) => player.name === dealt) ?? null;
  }, [pool, daily, today, dealt]);
  const byName = useMemo(() => new Map(pool.map((player) => [player.name, player])), [pool]);

  const guesses = useMemo(
    () => names.map((name) => byName.get(name)).filter((player): player is Player => Boolean(player)),
    [names, byName],
  );

  const index = useMemo(
    () => createNameIndex(pool.map((player) => player.name), { aliases: PLAYER_ALIASES }),
    [pool],
  );
  const alreadyGuessed = useMemo(() => new Set(names), [names]);
  /** What the guesses so far have pinned down, shown on the row coming next. */
  const hints = useMemo(
    () => (target ? deduceHints(guesses, target) : {}),
    [guesses, target],
  );

  const solved = Boolean(target && guesses.some((guess) => isCorrect(guess, target)));
  const over = solved || guesses.length >= MAX_GUESSES;


  useEffect(() => {
    if (!over) return;
    const wait = solved ? REVEAL_DELAY_MS.solved : REVEAL_DELAY_MS.lost;
    const timer = setTimeout(() => setRevealed(true), wait);
    return () => clearTimeout(timer);
  }, [over, solved]);

  const submit = (name: string) => {
    if (over || !byName.has(name) || alreadyGuessed.has(name)) return;
    const next = [...names, name];
    setNames(next);
    if (daily) writeStored(today, next);
  };

  const dealAgain = () => {
    setNames([]);
    setRevealed(false);
    setDismissed(false);
    setDealt(pickRandomPlayer(pool, target?.name).name);
  };


  return (
    <div className={styles.screen}>
      {onBack && (
        <button type="button" className={styles.back} onClick={onBack} aria-label="Back to modes">
          <svg width="8" height="13" viewBox="0 0 13 22" fill="none" aria-hidden>
            <path
              d="M11 1L2 11l9 10"
              stroke="rgba(22,19,14,.6)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      <div className={styles.board}>
        {guesses.length === 0 && !over && (
          <div className={styles.intro}>
            <p className={styles.introLead}>
              Six guesses at {daily ? "today’s player" : "a player"}. Every one comes back scored on
              all six counts.
            </p>
            <p className={styles.introKey}>
              <span className={`${styles.swatch} ${styles.hit}`} aria-hidden />
              exact
              <span className={`${styles.swatch} ${styles.close}`} aria-hidden />
              close
              <span className={styles.introArrow} aria-hidden>
                ↑
              </span>
              answer is higher
            </p>
          </div>
        )}
        {guesses.map((guess) => {
          const right = target ? isCorrect(guess, target) : false;
          return (
            <article
              key={guess.name}
              className={`${styles.row} ${styles.rowPlayed} ${right ? styles.rowRight : ""}`}
            >
              <h3 className={styles.rowName}>{guess.name}</h3>
              {target && (
                <div className={styles.clues}>
                  {compareGuess(guess, target).map((clue) => (
                    <ClueCell key={clue.key} clue={clue} />
                  ))}
                </div>
              )}
            </article>
          );
        })}

        {/* The rest of the grid is drawn from the start, so the shape of the
            game is visible before a single guess and nothing shifts as they
            land. Once the round is over the unused rows have nothing to say. */}
        {/* The row you are about to fill names its columns, so what each one
            holds is always on screen without a header strip to say it. */}
        {!over &&
          Array.from({ length: MAX_GUESSES - guesses.length }, (_, i) => (
            <article key={`empty-${i}`} className={`${styles.row} ${styles.rowEmpty}`} aria-hidden>
              <span className={styles.rowName} />
              <div className={styles.clues}>
                {COLUMNS.map((column) => {
                  const known = i === 0 ? hintFor(column.key, hints) : null;
                  return (
                    <div key={column.key} className={styles.clue}>
                      {i === 0 && (
                        <span className={known ? styles.known : styles.columnName}>
                          {known ?? column.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
      </div>

      {!over && (
        <GuessPad
          index={index}
          exclude={alreadyGuessed}
          onGuess={submit}
          active={active}
        />
      )}

      {over && target && dismissed && (
        <div className={styles.summary}>
          <span className={styles.summaryText}>
            <span className={styles.kicker}>
              {solved ? "SOLVED" : daily ? "TODAY’S PLAYER" : "THE ANSWER"}
            </span>
            <span className={styles.summaryName}>{target.name}</span>
          </span>
          {!daily && (
            <button type="button" className={styles.again} onClick={dealAgain}>
              Next player
            </button>
          )}
        </div>
      )}

      {/* The answer earns the whole screen: the name is the point of the game. */}
      {revealed && target && (
        <div className={styles.reveal} role="dialog" aria-modal="true" aria-label="The answer">
          <button
            type="button"
            className={styles.revealClose}
            onClick={() => {
              setRevealed(false);
              setDismissed(true);
            }}
            aria-label="Back to the board"
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="rgba(244,241,234,.6)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div className={styles.revealBody}>
            <span className={styles.revealKicker}>
              {solved
                ? `SOLVED IN ${guesses.length}`
                : daily
                  ? "TODAY’S PLAYER"
                  : "THE ANSWER"}
            </span>
            {solved && (
              <span className={styles.revealCongrats}>
                {guesses.length === 1
                  ? "First guess. Extraordinary."
                  : guesses.length <= 3
                    ? "Nicely done."
                    : "Got there in the end."}
              </span>
            )}
            <h2 className={styles.revealName}>{target.name}</h2>
            <span className={styles.revealTraits}>{traitLine(target)}</span>
          </div>

          <div className={styles.revealActions}>
            {daily ? (
              <span className={styles.revealNote}>A new player tomorrow.</span>
            ) : (
              <button type="button" className={styles.revealPlay} onClick={dealAgain}>
                Next player
              </button>
            )}
            <button
              type="button"
              className={styles.revealLink}
              onClick={() => {
                setRevealed(false);
                setDismissed(true);
              }}
            >
              See the board
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Cell-sized wording. The tooltip still carries the full value. */
const SHORT_TEAM: Record<string, string> = {
  Timberwolves: "Wolves",
  Supersonics: "Sonics",
};

function short(clue: Clue) {
  if (clue.key === "team") {
    const nickname = clue.value.split(" ").pop() ?? clue.value;
    return SHORT_TEAM[nickname] ?? nickname;
  }
  if (clue.key === "college") {
    return clue.value === "No college" ? "None" : shortCollege(clue.value);
  }
  return clue.value;
}

/**
 * What the board has established for one column, in a cell's worth of words:
 * a settled value, or the range the arrows have squeezed it into.
 */
function hintFor(key: (typeof COLUMNS)[number]["key"], hints: Hints): string | null {
  if (key === "drafted") {
    const bound = hints.drafted;
    // "1998–09" rather than "1998–2009": a draft range is read at a glance, it
    // only ever runs forwards, and the column is fifty pixels wide.
    if (bound?.min !== undefined && bound.max !== undefined) {
      return `${bound.min}–${String(bound.max).slice(2)}`;
    }
    return range(bound, String);
  }
  // A prime, not a hyphen: "6-7–6-10" is three dashes fighting each other.
  if (key === "height") return range(hints.height, (value) => formatHeight(value).replace("-", "′"));
  if (key === "jersey") return range(hints.jersey, (value) => `#${value}`);
  if (key === "position") {
    if (hints.position?.exact) return hints.position.exact;
    return hints.position?.shares?.length ? `has ${hints.position.shares.join("/")}` : null;
  }
  if (key === "college") {
    if (!hints.college) return null;
    return hints.college.exact === null ? "None" : shortCollege(hints.college.exact);
  }
  if (hints.team?.exact) return hints.team.exact.split(" ").pop() ?? hints.team.exact;
  return hints.team?.conference ?? null;
}

function range(bound: Bound | undefined, format: (value: number) => string): string | null {
  if (!bound) return null;
  if (bound.exact !== undefined) return format(bound.exact);
  const { min, max } = bound;
  if (min !== undefined && max !== undefined) return `${format(min)}–${format(max)}`;
  if (min !== undefined) return `${format(min)}+`;
  if (max !== undefined) return `≤${format(max)}`;
  return null;
}

/** The one-line description under the answer. */
function traitLine(player: Player) {
  const draft =
    player.team === UNDRAFTED ? "undrafted" : `drafted ${player.drafted} by ${player.team}`;
  const college = player.college ?? "no college";
  return `${player.height} · ${player.position} · ${draft} · ${college}`;
}

function ClueCell({ clue }: { clue: Clue }) {
  const arrow = clue.direction === "higher" ? "↑" : clue.direction === "lower" ? "↓" : "";
  const value = short(clue);
  // The full value and the reason a cell is only "close" live in the tooltip,
  // so the cell itself can stay one line tall.
  const title = [clue.label, clue.value, clue.note].filter(Boolean).join(" — ");
  // Only the name-bearing columns may wrap; "#21" breaking into "#2 / 1" is
  // worse than no wrapping at all.
  const wraps = clue.key === "college" || clue.key === "team";
  return (
    <div className={`${styles.clue} ${styles[clue.verdict]}`} title={title}>
      <span className={`${styles.clueValue} ${wraps ? styles.wraps : ""}`}>{value}</span>
      {arrow && <span className={styles.arrow}>{arrow}</span>}
    </div>
  );
}
