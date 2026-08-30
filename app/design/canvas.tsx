"use client";

import { useState } from "react";
import styles from "./design.module.css";

/**
 * The design canvas: every screen of the app, live, side by side.
 *
 * The frames are iframes of the real app rather than mock-ups, so what is on
 * the canvas is what ships — edit a component and every board showing it
 * updates on the next refresh. Each frame deep-links to its screen through
 * `?screen=`.
 */

const SIZES = {
  phone: { label: "Phone", width: 390, height: 844 },
  small: { label: "Small phone", width: 375, height: 667 },
  tablet: { label: "Tablet", width: 768, height: 1024 },
  desktop: { label: "Desktop", width: 1280, height: 860 },
} as const;

type SizeKey = keyof typeof SIZES;

const BOARDS = [
  { screen: "feed", title: "Feed", note: "Question card. Swipe, click or arrow down to reveal." },
  { screen: "modes", title: "Modes", note: "The nine rounds." },
  { screen: "mode:guess", title: "Guess the Player", note: "Daily. Grid, hint row, keypad." },
  { screen: "mode:guessendless", title: "Guess — Unlimited", note: "Same screen, a fresh player each round." },
  { screen: "mode:champions", title: "Championships", note: "Timed list, team pool." },
  { screen: "mode:starting5", title: "Starting Fives", note: "Timed list with the difficulty picker." },
  { screen: "settings", title: "Settings", note: "Toggles and the about rows." },
];

export function Canvas() {
  const [size, setSize] = useState<SizeKey>("phone");
  const [nonce, setNonce] = useState(0);
  const frame = SIZES[size];

  return (
    <div className={styles.canvas}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Hot Hand — design canvas</h1>
          <p className={styles.blurb}>
            Live frames of the running app, not mock-ups. Edit a component and reload a frame to
            see it here. Each one is interactive: play a round inside its board.
          </p>
        </div>
        <div className={styles.controls}>
          {(Object.keys(SIZES) as SizeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.control} ${key === size ? styles.controlOn : ""}`}
              onClick={() => setSize(key)}
            >
              {SIZES[key].label}
            </button>
          ))}
          <button type="button" className={styles.control} onClick={() => setNonce((n) => n + 1)}>
            Reload all
          </button>
        </div>
      </header>

      <div className={styles.boards}>
        {BOARDS.map((board) => (
          <figure key={board.screen} className={styles.board}>
            <figcaption className={styles.caption}>
              <span className={styles.boardTitle}>{board.title}</span>
              <span className={styles.boardNote}>{board.note}</span>
            </figcaption>
            <div
              className={styles.frame}
              style={{ width: frame.width, height: frame.height }}
            >
              <iframe
                key={`${board.screen}-${size}-${nonce}`}
                className={styles.viewport}
                src={`/?screen=${board.screen}`}
                title={board.title}
                width={frame.width}
                height={frame.height}
              />
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}
