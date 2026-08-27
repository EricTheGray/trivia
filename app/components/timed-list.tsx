"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnswerPool, LineupsMode, YearsMode } from "@/lib/game-modes";
import {
  answersMatch,
  createNameIndex,
  MIN_QUERY_LENGTH,
  normalizeName,
  type Aliases,
  type PoolEntry,
} from "@/lib/matching";
import { PLAYER_ALIASES } from "@/lib/players";
import type { Lineup, LineupSet } from "@/lib/starting-fives";
import { teamPool, TEAM_ALIASES } from "@/lib/teams";
import styles from "./timed-list.module.css";

/**
 * One timed round: a list of blanks, a clock, fill in as many as you can.
 * There is no penalty for a wrong answer — no shake, no buzz, no lockout.
 *
 * Two shapes play here. A "years" mode asks one question per season. A
 * "lineups" mode takes the champions' starting fives and blanks out some of
 * each, with the reader choosing how many go missing.
 */

const DIFFICULTIES = [1, 2, 3, 4, 5] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
const DEFAULT_DIFFICULTY: Difficulty = 1;

const POOL_ALIASES: Record<AnswerPool, Aliases> = {
  players: PLAYER_ALIASES,
  teams: TEAM_ALIASES,
};

/** Teams carry extra search terms (city, tri-code); player names stand alone. */
const POOL_ENTRIES: Record<AnswerPool, (names: string[]) => PoolEntry[]> = {
  players: (names) => names,
  teams: teamPool,
};

const POOL_COPY: Record<AnswerPool, { placeholder: string; label: string; hint: string }> = {
  players: {
    placeholder: "Type a name",
    label: "Type a player name",
    hint: `Last name is enough — ${MIN_QUERY_LENGTH} letters brings up names. Spelling is forgiving.`,
  },
  teams: {
    placeholder: "Type a team",
    label: "Type a team name",
    hint: `City or nickname — ${MIN_QUERY_LENGTH} letters brings up teams. Spelling is forgiving.`,
  },
};

/**
 * The roster is ~100KB, so each pool loads once, on demand, and is then shared
 * by every round that draws on it. Each endpoint returns its names under its
 * own key, which is the pool name.
 */
const poolRequests: Partial<Record<AnswerPool, Promise<string[]>>> = {};

function loadPool(pool: AnswerPool): Promise<string[]> {
  poolRequests[pool] ??= fetch(`/api/${pool}`)
    .then((response) => {
      if (!response.ok) throw new Error(`${pool} API responded ${response.status}`);
      return response.json() as Promise<Record<string, string[]>>;
    })
    .then((payload) => payload[pool])
    .catch((error) => {
      delete poolRequests[pool]; // Let the next round try again.
      throw error;
    });
  return poolRequests[pool]!;
}

let lineupRequest: Promise<Lineup[]> | null = null;

function loadLineupsOnce(): Promise<Lineup[]> {
  lineupRequest ??= fetch("/api/starting-fives")
    .then((response) => {
      if (!response.ok) throw new Error(`starting fives API responded ${response.status}`);
      return response.json() as Promise<LineupSet>;
    })
    .then((payload) => payload.lineups)
    .catch((error) => {
      lineupRequest = null;
      throw error;
    });
  return lineupRequest;
}

/** One blank to fill. */
type Slot = {
  key: string;
  /** Left column — the season. */
  label: string;
  /** What the sheet asks. */
  prompt: string;
  answer: string;
  /** Shown under an unanswered row, e.g. "C · New York Knicks". */
  context?: string;
  /** The rest of the lineup, listed in the sheet. */
  known?: string[];
};

/** Stable pseudo-random pick, so a re-render never reshuffles a lineup. */
function hiddenIndexes(year: number, count: number, seed: number): number[] {
  const order = [0, 1, 2, 3, 4];
  let hash = (year * 2654435761 + seed * 40503) >>> 0;
  for (let i = order.length - 1; i > 0; i--) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const j = hash % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, count).sort((a, b) => a - b);
}

function lineupSlots(mode: LineupsMode, lineups: Lineup[], missing: number, seed: number): Slot[] {
  return lineups.flatMap((lineup) => {
    const hidden = hiddenIndexes(lineup.year, missing, seed);
    const known = lineup.starters
      .filter((_, index) => !hidden.includes(index))
      .map((starter) => `${starter.position} · ${starter.name}`);

    return hidden.map((index) => {
      const starter = lineup.starters[index];
      return {
        key: `${lineup.year}-${index}`,
        label: String(lineup.year),
        prompt: mode.prompt
          .replace("{year}", String(lineup.year))
          .replace("{team}", lineup.team)
          .replace("{position}", starter.position),
        answer: starter.name,
        context: `${starter.position} · ${lineup.team}`,
        known,
      };
    });
  });
}

type TimedListProps = {
  mode: YearsMode | LineupsMode;
  /** False while another tab is on top: the round stays mounted but unseen. */
  active: boolean;
  onBack?: () => void;
  onSheetChange?: (open: boolean) => void;
};

export function TimedList({ mode, active, onBack, onSheetChange }: TimedListProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  /** Survives the close so the sheet keeps its wording while it slides away. */
  const [promptKey, setPromptKey] = useState<string | null>(null);
  const [left, setLeft] = useState(mode.seconds);
  /** Wall-clock deadline, so a backgrounded tab cannot stall the round. */
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [query, setQuery] = useState("");
  const [pool, setPool] = useState<string[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [missing, setMissing] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  /** Bumped on reset so the hidden starters are dealt again. */
  const [seed, setSeed] = useState(1);

  const inputRef = useRef<HTMLInputElement>(null);
  const copy = POOL_COPY[mode.pool];
  const sheetOpen = openKey !== null;
  const running = endsAt !== null;
  const isLineups = mode.kind === "lineups";

  useEffect(() => {
    let live = true;
    loadPool(mode.pool)
      .then((names) => {
        if (live) setPool(names);
      })
      .catch((error) => {
        // The round still works: matching falls back to this mode's answers.
        console.error(`[${mode.pool}] pool unavailable:`, error);
      });
    return () => {
      live = false;
    };
  }, [mode.pool]);

  useEffect(() => {
    if (!isLineups) return;
    let live = true;
    loadLineupsOnce()
      .then((loaded) => {
        if (live) setLineups(loaded);
      })
      .catch((error) => {
        console.error("[starting-fives] lineups unavailable:", error);
      });
    return () => {
      live = false;
    };
  }, [isLineups]);

  const slots = useMemo<Slot[]>(() => {
    if (mode.kind === "years") {
      return mode.rounds.map((round) => ({
        key: String(round.year),
        label: String(round.year),
        prompt: mode.prompt.replace("{year}", String(round.year)),
        answer: round.answer,
      }));
    }
    return lineupSlots(mode, lineups, missing, seed);
  }, [mode, lineups, missing, seed]);

  const slotAnswers = useMemo(() => slots.map((slot) => slot.answer), [slots]);
  const openSlot = slots.find((slot) => slot.key === promptKey) ?? null;

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        setEndsAt(null);
        setDone(true);
        setOpenKey(null);
      }
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt]);

  // A sheet behind another tab must not keep the tab bar hidden.
  useEffect(() => onSheetChange?.(active && sheetOpen), [active, sheetOpen, onSheetChange]);
  useEffect(() => () => onSheetChange?.(false), [onSheetChange]);

  // Focus is unreliable during the sheet's slide, so try again as it settles.
  useEffect(() => {
    if (!sheetOpen) return;
    const focus = () => inputRef.current?.focus();
    focus();
    const retry = setTimeout(focus, 80);
    const lastChance = setTimeout(focus, 260);
    return () => {
      clearTimeout(retry);
      clearTimeout(lastChance);
    };
  }, [sheetOpen]);

  const index = useMemo(
    () =>
      createNameIndex(POOL_ENTRIES[mode.pool](pool), {
        answers: slotAnswers,
        aliases: POOL_ALIASES[mode.pool],
      }),
    [pool, slotAnswers, mode.pool],
  );
  const suggestions = useMemo(() => index.search(query), [index, query]);

  const filled = Object.keys(answers).length;
  const correct = slots.filter((slot) => {
    const given = answers[slot.key];
    return given !== undefined && answersMatch(given, slot.answer);
  }).length;

  // The clock does not start until the first tap: opening a mode is not a
  // commitment.
  const start = useCallback(() => {
    if (running || done) return;
    setEndsAt(Date.now() + left * 1000);
  }, [done, left, running]);

  const open = (slot: Slot) => {
    start();
    setOpenKey(slot.key);
    setPromptKey(slot.key);
    setQuery("");
  };

  const close = () => {
    setOpenKey(null);
    setQuery("");
  };

  const commit = (key: string, name: string) => {
    const next = { ...answers, [key]: name };
    setAnswers(next);
    setOpenKey(null);
    setQuery("");
    if (Object.keys(next).length >= slots.length) {
      setEndsAt(null);
      setDone(true);
    }
  };

  const submitTyped = () => {
    const raw = query.trim();
    if (!raw || openKey === null) return;
    // Nicknames and bare surnames resolve outright; otherwise return takes the
    // name at the top of the list, the way any autocomplete does. Text that
    // matches nothing still commits as typed — a wrong guess should be a wrong
    // guess, not a dead end.
    commit(openKey, index.resolve(raw) ?? suggestions[0] ?? raw);
  };

  const reset = useCallback(
    (nextMissing: Difficulty = missing) => {
      setAnswers({});
      setOpenKey(null);
      setPromptKey(null);
      setQuery("");
      setLeft(mode.seconds);
      setEndsAt(null);
      setDone(false);
      setMissing(nextMissing);
      setSeed((previous) => previous + 1);
    },
    [missing, mode.seconds],
  );

  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const status = done
    ? "Round over."
    : running
      ? "Fill in as many as you can."
      : "Tap any row to start the clock.";
  const help =
    normalizeName(query).length < MIN_QUERY_LENGTH
      ? copy.hint
      : suggestions.length === 1
        ? "Return locks in the match below."
        : suggestions.length
          ? "Tap a name, or hit return for the top match."
          : "No match — return still locks in what you typed.";

  // Split in two so a wide screen can show the rows as two columns read top to
  // bottom. On a phone both halves flow as one list.
  const columns = useMemo(() => {
    const half = Math.ceil(slots.length / 2);
    return [slots.slice(0, half), slots.slice(half)];
  }, [slots]);

  return (
    <div className={styles.round}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleGroup}>
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
            <span className={styles.kicker}>{mode.title}</span>
          </div>
          <span className={styles.progress}>
            {filled} / {slots.length}
          </span>
        </div>

        <div className={styles.clockRow}>
          <span className={`${styles.clock} ${left <= 30 ? styles.clockLow : ""}`}>{clock}</span>
          <span className={styles.status}>{status}</span>
        </div>

        {isLineups && (
          <div className={styles.difficulty}>
            <span className={styles.difficultyLabel}>MISSING</span>
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                type="button"
                className={`${styles.chip} ${level === missing ? styles.chipOn : ""}`}
                aria-pressed={level === missing}
                onClick={() => reset(level)}
              >
                {level}
              </button>
            ))}
            <span className={styles.difficultyHint}>
              {missing === 1 ? "one starter hidden a lineup" : `${missing} hidden a lineup`}
            </span>
          </div>
        )}

        <div className={styles.bar}>
          <div
            className={styles.barFill}
            style={{ width: `${slots.length ? Math.round((filled / slots.length) * 100) : 0}%` }}
          />
        </div>
      </div>

      <div className={`${styles.rows} ${isLineups ? styles.rowsWithPicker : ""}`}>
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className={styles.rowGroup}>
            {column.map((slot) => {
              const given = answers[slot.key];
              const graded = given !== undefined;
              const right = graded && answersMatch(given, slot.answer);
              return (
                <button
                  key={slot.key}
                  type="button"
                  className={styles.row}
                  disabled={done}
                  onClick={() => open(slot)}
                >
                  <span className={`${styles.year} ${graded ? styles.yearFilled : ""}`}>
                    {slot.label}
                  </span>
                  <span className={styles.rowBody}>
                    <span
                      className={`${styles.given} ${
                        !graded ? "" : right ? styles.givenRight : styles.givenWrong
                      }`}
                    >
                      {graded ? given : "Tap to answer"}
                    </span>
                    {!graded && slot.context && (
                      <span className={styles.context}>{slot.context}</span>
                    )}
                    {graded && !right && <span className={styles.truth}>{slot.answer}</span>}
                  </span>
                  <span className={`${styles.mark} ${right ? styles.markRight : ""}`}>
                    {graded ? (right ? "✓" : "✕") : ""}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {done && (
        <div className={styles.summary}>
          <span className={styles.summaryText}>
            <span className={styles.kicker}>{left === 0 ? "TIME" : "ALL FILLED"}</span>
            <span className={styles.summaryScore}>
              {correct} of {slots.length} correct
            </span>
          </span>
          <button type="button" className={styles.again} onClick={() => reset()}>
            Play again
          </button>
        </div>
      )}

      <div
        className={styles.sheetLayer}
        data-open={sheetOpen}
        style={{ pointerEvents: sheetOpen ? "auto" : "none" }}
      >
        <button
          type="button"
          aria-label="Dismiss"
          tabIndex={sheetOpen ? 0 : -1}
          className={styles.backdrop}
          onClick={close}
        />

        <div className={styles.sheet}>
          <div className={styles.sheetHead}>
            <div className={styles.sheetHeadText}>
              <span className={styles.kicker}>YOUR ANSWER</span>
              <span className={styles.prompt}>{openSlot?.prompt ?? ""}</span>
              {openSlot?.known?.length ? (
                <span className={styles.known}>Alongside {openSlot.known.join(", ")}</span>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={close}
              tabIndex={sheetOpen ? 0 : -1}
              aria-label="Close"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path
                  d="M1 1l10 10M11 1L1 11"
                  stroke="rgba(22,19,14,.55)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className={styles.typeBlock}>
            <div className={styles.field}>
              <input
                ref={inputRef}
                className={styles.input}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  submitTyped();
                }}
                placeholder={copy.placeholder}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                tabIndex={sheetOpen ? 0 : -1}
                aria-label={copy.label}
              />
              <button
                type="button"
                className={`${styles.submit} ${query.trim() ? styles.submitReady : ""}`}
                onClick={submitTyped}
                tabIndex={sheetOpen ? 0 : -1}
                aria-label="Lock in this answer"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M2 8h11M9 3l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <span className={styles.help}>{help}</span>
          </div>

          <div className={styles.options}>
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                className={styles.option}
                tabIndex={sheetOpen ? 0 : -1}
                onClick={() => openKey !== null && commit(openKey, name)}
              >
                <span className={styles.optionName}>{name}</span>
                {promptKey !== null && answers[promptKey] === name && (
                  <span className={styles.dot} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
