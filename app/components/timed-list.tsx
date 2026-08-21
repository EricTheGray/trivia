"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMode } from "@/lib/game-modes";
import {
  answersMatch,
  createNameIndex,
  MIN_QUERY_LENGTH,
  normalizeName,
  type Roster,
} from "@/lib/players";
import styles from "./timed-list.module.css";

/**
 * One timed round: fifteen years, three minutes, fill in as many as you can.
 * There is no penalty for a wrong answer — no shake, no buzz, no lockout.
 */

/** The roster is ~100KB, so it loads once, on demand, shared by every round. */
let rosterRequest: Promise<string[]> | null = null;

function loadRosterOnce(): Promise<string[]> {
  rosterRequest ??= fetch("/api/players")
    .then((response) => {
      if (!response.ok) throw new Error(`players API responded ${response.status}`);
      return response.json() as Promise<Roster>;
    })
    .then((roster) => roster.players)
    .catch((error) => {
      rosterRequest = null; // Let the next round try again.
      throw error;
    });
  return rosterRequest;
}

type TimedListProps = {
  mode: GameMode;
  /** False while another tab is on top: the round stays mounted but unseen. */
  active: boolean;
  onBack?: () => void;
  onSheetChange?: (open: boolean) => void;
};

export function TimedList({ mode, active, onBack, onSheetChange }: TimedListProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [openYear, setOpenYear] = useState<number | null>(null);
  /** Survives the close so the sheet keeps its wording while it slides away. */
  const [promptYear, setPromptYear] = useState<number | null>(null);
  const [left, setLeft] = useState(mode.seconds);
  /** Wall-clock deadline, so a backgrounded tab cannot stall the round. */
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [query, setQuery] = useState("");
  const [roster, setRoster] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const typed = mode.input === "type";
  const sheetOpen = openYear !== null;
  const running = endsAt !== null;

  useEffect(() => {
    if (!typed) return;
    let live = true;
    loadRosterOnce()
      .then((players) => {
        if (live) setRoster(players);
      })
      .catch((error) => {
        // The round still works: the pool falls back to this mode's answers.
        console.error("[players] roster unavailable:", error);
      });
    return () => {
      live = false;
    };
  }, [typed]);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        setEndsAt(null);
        setDone(true);
        setOpenYear(null);
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
    if (!sheetOpen || !typed) return;
    const focus = () => inputRef.current?.focus();
    focus();
    const retry = setTimeout(focus, 80);
    const lastChance = setTimeout(focus, 260);
    return () => {
      clearTimeout(retry);
      clearTimeout(lastChance);
    };
  }, [sheetOpen, typed]);

  const modeAnswers = useMemo(() => mode.rounds.map((round) => round.answer), [mode]);
  const index = useMemo(() => createNameIndex(roster, modeAnswers), [roster, modeAnswers]);
  const suggestions = useMemo(() => (typed ? index.search(query) : []), [index, query, typed]);
  const listOptions = mode.options ?? [];

  const filled = Object.keys(answers).length;
  const correct = mode.rounds.filter((round) => {
    const given = answers[round.year];
    return given !== undefined && answersMatch(given, round.answer);
  }).length;

  // The clock does not start until the first tap: opening a mode is not a
  // commitment.
  const start = useCallback(() => {
    if (running || done) return;
    setEndsAt(Date.now() + left * 1000);
  }, [done, left, running]);

  const open = (year: number) => {
    start();
    setOpenYear(year);
    setPromptYear(year);
    setQuery("");
  };

  const close = () => {
    setOpenYear(null);
    setQuery("");
  };

  const commit = (year: number, name: string) => {
    const next = { ...answers, [year]: name };
    setAnswers(next);
    setOpenYear(null);
    setQuery("");
    if (Object.keys(next).length >= mode.rounds.length) {
      setEndsAt(null);
      setDone(true);
    }
  };

  const submitTyped = () => {
    const raw = query.trim();
    if (!raw || openYear === null) return;
    // Nicknames and bare surnames resolve; a query that has narrowed to exactly
    // one player takes it; anything else commits as typed, because a wrong
    // guess should be a wrong guess, not a dead end.
    const only = suggestions.length === 1 ? suggestions[0] : null;
    commit(openYear, index.resolve(raw) ?? only ?? raw);
  };

  const reset = () => {
    setAnswers({});
    setOpenYear(null);
    setQuery("");
    setLeft(mode.seconds);
    setEndsAt(null);
    setDone(false);
  };

  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const status = done
    ? "Round over."
    : running
      ? "Fill in as many as you can."
      : "Tap any year to start the clock.";
  const help = normalizeName(query).length < MIN_QUERY_LENGTH
    ? `Last name is enough — ${MIN_QUERY_LENGTH} letters brings up names. Spelling is forgiving.`
    : suggestions.length === 1
      ? "Return locks in the match below."
      : suggestions.length
        ? "Tap a name, or hit return to lock in what you typed."
        : "No match — return still locks in what you typed.";

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
            {filled} / {mode.rounds.length}
          </span>
        </div>

        <div className={styles.clockRow}>
          <span className={`${styles.clock} ${left <= 30 ? styles.clockLow : ""}`}>{clock}</span>
          <span className={styles.status}>{status}</span>
        </div>

        <div className={styles.bar}>
          <div
            className={styles.barFill}
            style={{ width: `${Math.round((filled / mode.rounds.length) * 100)}%` }}
          />
        </div>
      </div>

      <div className={styles.rows}>
        {mode.rounds.map((round) => {
          const given = answers[round.year];
          const graded = given !== undefined;
          const right = graded && answersMatch(given, round.answer);
          return (
            <button
              key={round.year}
              type="button"
              className={styles.row}
              disabled={done}
              onClick={() => open(round.year)}
            >
              <span className={`${styles.year} ${graded ? styles.yearFilled : ""}`}>
                {round.year}
              </span>
              <span className={styles.rowBody}>
                <span
                  className={`${styles.given} ${
                    !graded ? "" : right ? styles.givenRight : styles.givenWrong
                  }`}
                >
                  {graded ? given : "Tap to answer"}
                </span>
                {graded && !right && <span className={styles.truth}>{round.answer}</span>}
              </span>
              <span className={`${styles.mark} ${right ? styles.markRight : ""}`}>
                {graded ? (right ? "✓" : "✕") : ""}
              </span>
            </button>
          );
        })}
      </div>

      {done && (
        <div className={styles.summary}>
          <span className={styles.summaryText}>
            <span className={styles.kicker}>{left === 0 ? "TIME" : "ALL FILLED"}</span>
            <span className={styles.summaryScore}>
              {correct} of {mode.rounds.length} correct
            </span>
          </span>
          <button type="button" className={styles.again} onClick={reset}>
            Play again
          </button>
        </div>
      )}

      <div className={styles.sheetLayer} style={{ pointerEvents: sheetOpen ? "auto" : "none" }}>
        <button
          type="button"
          aria-label="Dismiss"
          tabIndex={sheetOpen ? 0 : -1}
          className={styles.backdrop}
          style={{ opacity: sheetOpen ? 1 : 0 }}
          onClick={close}
        />

        <div
          className={styles.sheet}
          style={{ transform: sheetOpen ? "translateY(0)" : "translateY(112%)" }}
        >
          <div className={styles.sheetHead}>
            <div className={styles.sheetHeadText}>
              <span className={styles.kicker}>YOUR ANSWER</span>
              <span className={styles.prompt}>
                {mode.prompt.replace("{year}", String(promptYear ?? ""))}
              </span>
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

          {typed && (
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
                  placeholder="Type a name"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  tabIndex={sheetOpen ? 0 : -1}
                  aria-label="Type a player name"
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
          )}

          <div className={`${styles.options} ${typed ? styles.optionsTyped : styles.optionsList}`}>
            {(typed ? suggestions : listOptions).map((name) => (
              <button
                key={name}
                type="button"
                className={styles.option}
                tabIndex={sheetOpen ? 0 : -1}
                onClick={() => openYear !== null && commit(openYear, name)}
              >
                <span className={styles.optionName}>{name}</span>
                {promptYear !== null && answers[promptYear] === name && (
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
