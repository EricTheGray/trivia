"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeName, type NameIndex } from "@/lib/matching";
import styles from "./guess-pad.module.css";

/**
 * The way a guess is made: letters in, a player out.
 *
 * Keys, the letters typed so far and the names they narrow to are one thing,
 * not a text field with a keyboard attached. It draws its own keys so the
 * system keyboard never opens — which is how Wordle keeps a whole game on one
 * screen, since a viewport that never changes can be sized to fit exactly.
 *
 * Letters only, no space bar: any single word of a name finds it — "towns" and
 * "karl" both reach Karl-Anthony Towns — so a space would only cost a row.
 */

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;
const LETTERS = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));

/** Two is enough against a pool this size. */
const MIN_QUERY = 2;
const MAX_SUGGESTIONS = 6;

type GuessPadProps = {
  /** Supplies the names, ranked. */
  index: NameIndex;
  /** Names already played, kept out of the suggestions. */
  exclude?: ReadonlySet<string>;
  /** A finished guess: a name that was tapped, or the top match on enter. */
  onGuess: (name: string) => void;
  /** False when another screen is on top, so stray keystrokes are ignored. */
  active: boolean;
};

export function GuessPad({ index, exclude, onGuess, active }: GuessPadProps) {
  const [query, setQuery] = useState("");

  const suggestions = useMemo(() => {
    const found = index.search(query, MAX_SUGGESTIONS, MIN_QUERY);
    return exclude ? found.filter((name) => !exclude.has(name)) : found;
  }, [index, query, exclude]);

  const searching = normalizeName(query).length >= MIN_QUERY;

  const play = (name: string) => {
    setQuery("");
    onGuess(name);
  };

  const commit = () => {
    const raw = query.trim();
    if (!raw) return;
    // Enter takes what the pad is already showing: a resolved nickname or
    // surname, else the name at the top of the list.
    const resolved = index.resolve(raw) ?? suggestions[0] ?? null;
    if (resolved) play(resolved);
  };

  // Lets the key handler reach the current commit without re-binding on every
  // keystroke.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  // A physical keyboard drives the same pad, for anyone playing on a desktop.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Enter") {
        event.preventDefault();
        commitRef.current();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setQuery((current) => current.slice(0, -1));
      } else if (event.key.length === 1 && LETTERS.has(event.key.toUpperCase())) {
        setQuery((current) => current + event.key.toLowerCase());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  return (
    <div className={styles.pad}>
      <div className={styles.line} aria-live="polite">
        {/* The caret sits where the next letter lands: after what is typed, or
            at the head of the line when the placeholder is showing. */}
        {query ? (
          <>
            <span className={styles.typed}>{query}</span>
            <span className={styles.caret} aria-hidden />
          </>
        ) : (
          <>
            <span className={styles.caret} aria-hidden />
            <span className={styles.placeholder}>Type a name</span>
          </>
        )}
      </div>

      <div className={styles.names}>
        {searching && suggestions.length === 0 && (
          <span className={styles.noMatch}>No one by that name in the pool</span>
        )}
        {suggestions.map((name) => (
          <button key={name} type="button" className={styles.name} onClick={() => play(name)}>
            {name}
          </button>
        ))}
      </div>

      <div className={styles.keys} role="group" aria-label="Keyboard">
        {ROWS.map((row, index) => (
          <div key={row} className={styles.row}>
            {index === 2 && (
              <button
                type="button"
                className={`${styles.key} ${styles.wide} ${query.trim() ? "" : styles.quiet}`}
                onClick={commit}
              >
                Enter
              </button>
            )}
            {row.split("").map((letter) => (
              <button
                key={letter}
                type="button"
                className={styles.key}
                aria-label={letter}
                onClick={() => setQuery((current) => current + letter.toLowerCase())}
              >
                {letter}
              </button>
            ))}
            {index === 2 && (
              <button
                type="button"
                className={`${styles.key} ${styles.wide}`}
                aria-label="Delete"
                onClick={() => setQuery((current) => current.slice(0, -1))}
              >
                <svg width="20" height="16" viewBox="0 0 22 18" fill="none" aria-hidden>
                  <path
                    d="M7 1h13a1 1 0 011 1v14a1 1 0 01-1 1H7L1 9l6-8z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M11 6l6 6M17 6l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
