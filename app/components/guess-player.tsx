"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GuessMode } from "@/lib/game-modes";
import {
  compareGuess,
  isCorrect,
  localIsoDate,
  pickDailyPlayer,
  type Clue,
  type GuessPlayer as Player,
  type GuessPool,
} from "@/lib/guess-players";
import { createNameIndex, MIN_QUERY_LENGTH, normalizeName } from "@/lib/matching";
import { PLAYER_ALIASES } from "@/lib/players";
import styles from "./guess-player.module.css";

/**
 * Six guesses at one player a day. Every guess comes back scored on the six
 * traits the workbook carries, and the whole board stays on screen.
 */

const MAX_GUESSES = 6;
const STORAGE_KEY = "hot-hand.guess";

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
};

export function GuessPlayerRound({ mode, active, onBack }: GuessPlayerProps) {
  const [today] = useState(() => localIsoDate(new Date()));
  const [pool, setPool] = useState<Player[]>([]);
  const [names, setNames] = useState<string[]>(() => readStored(today));
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    loadGuessPoolOnce()
      .then((players) => {
        if (live) setPool(players);
      })
      .catch((error) => {
        console.error("[guess-players] pool unavailable:", error);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  const target = useMemo(() => (pool.length ? pickDailyPlayer(pool, today) : null), [pool, today]);
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
  const suggestions = useMemo(
    () => index.search(query, 6).filter((name) => !alreadyGuessed.has(name)),
    [index, query, alreadyGuessed],
  );

  const solved = Boolean(target && guesses.some((guess) => isCorrect(guess, target)));
  const over = solved || guesses.length >= MAX_GUESSES;
  const left = MAX_GUESSES - guesses.length;

  const submit = (name: string) => {
    if (over || !byName.has(name) || alreadyGuessed.has(name)) return;
    const next = [...names, name];
    setNames(next);
    writeStored(today, next);
    setQuery("");
    inputRef.current?.focus();
  };

  const submitTyped = () => {
    const raw = query.trim();
    if (!raw) return;
    // Return takes the name at the top of the list, as it does in a timed
    // round. Anything that matches nobody is not a guess at all — a guess has
    // to be a player in the pool for the clues to mean anything.
    const resolved = index.resolve(raw) ?? suggestions[0] ?? null;
    if (resolved) submit(resolved);
  };

  const help = over
    ? solved
      ? `Got it in ${guesses.length}. A new player tomorrow.`
      : `Out of guesses. A new player tomorrow.`
    : normalizeName(query).length < MIN_QUERY_LENGTH
      ? `Anyone from the pool — ${MIN_QUERY_LENGTH} letters brings up names.`
      : suggestions.length
        ? "Tap a name, or hit return for the top match."
        : "No one by that name in the pool.";

  return (
    <div className={styles.screen}>
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
            {guesses.length} / {MAX_GUESSES}
          </span>
        </div>

        <div className={styles.pips} aria-label={`${left} guesses left`}>
          {Array.from({ length: MAX_GUESSES }, (_, i) => (
            <span
              key={i}
              className={`${styles.pip} ${i < guesses.length ? styles.pipUsed : ""}`}
              aria-hidden
            />
          ))}
        </div>

        {!over && (
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
                placeholder="Guess a player"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                aria-label="Guess a player"
              />
              <button
                type="button"
                className={`${styles.submit} ${query.trim() ? styles.submitReady : ""}`}
                onClick={submitTyped}
                aria-label="Submit this guess"
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
            {suggestions.length > 0 && (
              <div className={styles.options}>
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={styles.option}
                    onClick={() => submit(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.board}>
        {guesses.length === 0 && !over && (
          <p className={styles.empty}>
            Every guess comes back scored: taller or shorter, drafted earlier or later, and whether
            the position, college and draft team match.
          </p>
        )}

        {guesses.map((guess) => {
          const right = target ? isCorrect(guess, target) : false;
          return (
            <article key={guess.name} className={`${styles.guess} ${right ? styles.guessRight : ""}`}>
              <header className={styles.guessHead}>
                <span className={styles.guessName}>{guess.name}</span>
                {right && <span className={styles.guessFlag}>THAT&rsquo;S THE ONE</span>}
              </header>
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
      </div>

      {over && target && (
        <div className={styles.summary}>
          <span className={styles.summaryText}>
            <span className={styles.kicker}>{solved ? "SOLVED" : "TODAY’S PLAYER"}</span>
            <span className={styles.summaryName}>{target.name}</span>
            <span className={styles.summaryLine}>
              {target.height} · {target.position} · drafted {target.drafted} by {target.team}
              {target.college ? ` · ${target.college}` : " · no college"}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function ClueCell({ clue }: { clue: Clue }) {
  const arrow = clue.direction === "higher" ? "↑" : clue.direction === "lower" ? "↓" : "";
  return (
    <div className={`${styles.clue} ${styles[clue.verdict]}`} title={clue.note}>
      <span className={styles.clueLabel}>{clue.label}</span>
      <span className={styles.clueValue}>
        {clue.value}
        {arrow && <span className={styles.arrow}>{arrow}</span>}
      </span>
      {clue.note && <span className={styles.clueNote}>{clue.note}</span>}
    </div>
  );
}
