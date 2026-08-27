"use client";

import { useCallback, useState } from "react";
import type { GameMode } from "@/lib/game-modes";
import type { Question } from "@/lib/questions";
import { GuessPlayerRound } from "./guess-player";
import { TimedList } from "./timed-list";
import { useKeyboardOpen } from "./use-keyboard-open";
import { TriviaFeed } from "./trivia-feed";
import { useSettings } from "./use-settings";
import styles from "./hot-hand.module.css";

type Tab = "feed" | "modes" | "settings";

export function HotHand({
  questions,
  startQuestionId,
  modes,
}: {
  questions: Question[];
  startQuestionId: string;
  modes: GameMode[];
}) {
  const [tab, setTab] = useState<Tab>("feed");
  const [mode, setMode] = useState<GameMode | null>(null);
  const [onDarkCard, setOnDarkCard] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settings, update] = useSettings();
  const keyboardOpen = useKeyboardOpen();

  const openMode = useCallback(
    (key: string) => {
      setMode(modes.find((m) => m.key === key) ?? null);
      setTab("modes");
      setSheetOpen(false);
    },
    [modes],
  );

  const goTo = (next: Tab) => {
    setTab(next);
    setSheetOpen(false);
    if (next !== "feed") setOnDarkCard(false);
    if (next === "settings") setMode(null);
  };

  const onFeed = tab === "feed";
  const dark = onFeed && onDarkCard;
  /**
   * A round takes the whole screen: its own back button leads out, so the bar
   * would only be floating over the game and eating the room a keyboard wants.
   */
  const inRound = tab === "modes" && mode !== null;
  const barHidden = sheetOpen || keyboardOpen || inRound;

  return (
    <div className={styles.shell}>
      {/* The feed stays mounted across tabs: "the feed keeps running when you
          come back to it." */}
      <div className={`${styles.screen} ${onFeed ? "" : styles.hidden}`}>
        <TriviaFeed
          questions={questions}
          startQuestionId={startQuestionId}
          modes={modes}
          active={onFeed}
          difficultyRamp={settings.difficultyRamp}
          haptics={settings.haptics}
          onCardChange={setOnDarkCard}
          onSheetChange={setSheetOpen}
          onPlayMode={openMode}
        />
      </div>

      {tab === "modes" && !mode && (
        <div className={`${styles.screen} ${styles.scrollScreen}`}>
          <div className={styles.header}>
            <div className={styles.headerRow}>
              <span className={styles.kicker}>HOT HAND</span>
              <span className={styles.kickerMuted}>{countLabel(modes.length)} MODES</span>
            </div>
            <div className={styles.titleBlock}>
              <h1 className={styles.title}>Game modes</h1>
              <p className={styles.intro}>
                Every season on record, five minutes on the clock — or six guesses at the player of
                the day. The feed keeps running when you come back to it.
              </p>
            </div>
          </div>
          <div className={styles.list}>
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                className={styles.modeRow}
                onClick={() => setMode(m)}
              >
                <span className={styles.chip} style={{ background: m.chip }} />
                <span className={styles.modeText}>
                  <span className={styles.modeName}>{m.name}</span>
                  <span className={styles.rowSub}>{m.blurb}</span>
                </span>
                <span className={styles.playLabel}>Play</span>
              </button>
            ))}
            <div className={styles.listEnd} />
          </div>
        </div>
      )}

      {/* A round in progress survives a trip to the feed — its clock runs on
          wall time, so it is still ticking when you come back. Keyed so
          switching modes starts fresh rather than inheriting the last round. */}
      {mode && (
        <div
          className={`${styles.screen} ${styles.roundScreen} ${
            tab === "modes" ? "" : styles.hidden
          }`}
        >
          {mode.kind === "guess" ? (
            <GuessPlayerRound
              key={mode.key}
              mode={mode}
              active={tab === "modes"}
              onBack={() => setMode(null)}
              onSheetChange={setSheetOpen}
            />
          ) : (
            <TimedList
              key={mode.key}
              mode={mode}
              active={tab === "modes"}
              onBack={() => setMode(null)}
              onSheetChange={setSheetOpen}
            />
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className={styles.settings}>
          <div className={styles.headerRow}>
            <span className={styles.kicker}>HOT HAND</span>
            <span className={styles.kickerMuted}>v1.0</span>
          </div>
          <h1 className={styles.title} style={{ paddingBottom: 28 }}>
            Settings
          </h1>

          <span className={styles.groupHeader}>PLAY</span>
          <div className={styles.group}>
            <button
              type="button"
              className={styles.settingRow}
              aria-pressed={settings.difficultyRamp}
              onClick={() => update({ difficultyRamp: !settings.difficultyRamp })}
            >
              <span className={styles.settingText}>
                <span className={styles.settingLabel}>Difficulty ramp</span>
                <span className={styles.rowSub}>Harder questions when you answer fast</span>
              </span>
              <Toggle on={settings.difficultyRamp} />
            </button>
            <button
              type="button"
              className={styles.settingRow}
              aria-pressed={settings.haptics}
              onClick={() => update({ haptics: !settings.haptics })}
            >
              <span className={styles.settingText}>
                <span className={styles.settingLabel}>Haptics</span>
                <span className={styles.rowSub}>A tap when an answer lands</span>
              </span>
              <Toggle on={settings.haptics} />
            </button>
          </div>

          <span className={styles.groupHeader}>SHARING</span>
          <div className={styles.group}>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel} style={{ flex: 1 }}>
                Button wording
              </span>
              <span className={styles.settingValue}>Friendly</span>
            </div>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel} style={{ flex: 1 }}>
                Include the answer in links
              </span>
              <span className={styles.settingValue}>Never</span>
            </div>
          </div>

          <span className={styles.groupHeader}>ABOUT</span>
          <div className={styles.group}>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel} style={{ flex: 1 }}>
                Where the questions come from
              </span>
              <Chevron />
            </div>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel} style={{ flex: 1 }}>
                Suggest a question
              </span>
              <Chevron />
            </div>
          </div>

          <p className={styles.footnote}>No scores, no streaks, no ads.</p>
        </div>
      )}

      {/* The bar steps aside for a sheet and for the keyboard alike: floating
          over either one leaves it stranded on top of the content. */}
      <nav
        className={styles.tabBar}
        style={{
          opacity: barHidden ? 0 : 1,
          pointerEvents: barHidden ? "none" : "auto",
          transform: barHidden ? "translateY(20px)" : "translateY(0)",
          background: dark ? "rgba(255,246,238,.2)" : "rgba(255,246,238,.72)",
          borderColor: dark ? "rgba(255,246,238,.34)" : "rgba(22,19,14,.08)",
          color: dark ? "#FFF6EE" : "#16130E",
        }}
      >
        <TabButton label="FEED" active={onFeed} onClick={() => goTo("feed")}>
          <rect x="3.5" y="3.5" width="17" height="7" rx="2.2" stroke="currentColor" strokeWidth="1.9" />
          <rect x="3.5" y="13.5" width="17" height="7" rx="2.2" stroke="currentColor" strokeWidth="1.9" />
        </TabButton>
        <TabButton label="MODES" active={tab === "modes"} onClick={() => goTo("modes")}>
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.8" stroke="currentColor" strokeWidth="1.9" />
          <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.8" stroke="currentColor" strokeWidth="1.9" />
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.8" stroke="currentColor" strokeWidth="1.9" />
          <rect x="13" y="13" width="7.5" height="7.5" rx="1.8" stroke="currentColor" strokeWidth="1.9" />
        </TabButton>
        <TabButton label="SETTINGS" active={tab === "settings"} onClick={() => goTo("settings")}>
          <path d="M3 7h11M18 7h3M3 17h3M10 17h11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <circle cx="16" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.9" />
          <circle cx="8" cy="17" r="2.4" stroke="currentColor" strokeWidth="1.9" />
        </TabButton>
      </nav>
    </div>
  );
}

const COUNT_WORDS = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];

function countLabel(count: number) {
  return COUNT_WORDS[count] ?? String(count);
}

function TabButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.tab}
      style={{ opacity: active ? 1 : 0.42, color: "inherit" }}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden>
        {children}
      </svg>
      <span className={styles.tabLabel}>{label}</span>
    </button>
  );
}

function Chevron() {
  return (
    <svg width="8" height="13" viewBox="0 0 7 11" fill="none" aria-hidden>
      <path
        d="M1.2 1L5.6 5.5 1.2 10"
        stroke="rgba(22,19,14,.3)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={styles.toggle}
      style={{ background: on ? "var(--hh-accent)" : "rgba(22,19,14,.16)" }}
      aria-hidden
    >
      <span className={styles.knob} style={{ left: on ? 22 : 2 }} />
    </span>
  );
}
