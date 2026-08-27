"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMode } from "@/lib/game-modes";
import { MAX_DIFFICULTY, type Question } from "@/lib/questions";
import styles from "./trivia-feed.module.css";

type Card =
  | { kind: "q"; n: number; question: Question }
  | { kind: "a"; n: number; question: Question }
  | { kind: "promo"; n: number; mode: GameMode };

/** The cards built so far, and which one is on screen. */
type Deck = { cards: Card[]; page: number };

const SWIPE_THRESHOLD = 90;
/** Movement under this reads as a tap, which also advances. */
const TAP_SLOP = 8;
/** Rubber-band factor for a downward drag on the first card. */
const RUBBER_BAND = 0.22;
const ADVANCE_MS = 460;

/** Reveal faster than this raises the difficulty; slower than this lowers it. */
const FAST_REVEAL_MS = 4200;
const SLOW_REVEAL_MS = 11000;
/** Assumed reveal time before we have measured one. */
const DEFAULT_REVEAL_MS = 8000;

const TRIM_DELAY_MS = 540;
const TRIM_ABOVE = 12;
const TRIM_COUNT = 4;

const TOAST_MS = 1500;

/** Accumulated wheel distance that counts as one swipe, and the pause after. */
const WHEEL_THRESHOLD = 80;
const WHEEL_COOLDOWN_MS = 620;
/** A gap this long starts a fresh wheel gesture. */
const WHEEL_GAP_MS = 200;

const SHARE_PHRASES = [
  "Pass it along",
  "Ask a friend",
  "Someone would love this",
  "Send it to someone",
  "Who'd know this one?",
  "Play along together",
];

type TriviaFeedProps = {
  questions: Question[];
  /** Chosen on the server so the first card is the same in HTML and hydration. */
  startQuestionId: string;
  modes: GameMode[];
  /** False while another tab is on top: the feed stays mounted but inert. */
  active: boolean;
  /** A promo card follows every nth answer. */
  promoEvery?: number;
  difficultyRamp: boolean;
  haptics: boolean;
  onCardChange?: (isDark: boolean) => void;
  onSheetChange?: (isOpen: boolean) => void;
  onPlayMode?: (key: string) => void;
};

export function TriviaFeed({
  questions,
  startQuestionId,
  modes,
  active,
  promoEvery = 10,
  difficultyRamp,
  haptics,
  onCardChange,
  onSheetChange,
  onPlayMode,
}: TriviaFeedProps) {
  const initialDeck = useMemo<Deck>(() => {
    const start = questions.find((q) => q.id === startQuestionId) ?? questions[0];
    return { cards: [{ kind: "q", n: 1, question: start }], page: 0 };
  }, [questions, startQuestionId]);

  const [deck, setDeck] = useState(initialDeck);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  /** Mirrors `deck` so a gesture can build the next card without a stale read. */
  const deckRef = useRef(initialDeck);
  const usedRef = useRef(new Set([startQuestionId]));
  const levelRef = useRef(1);
  const promoIndexRef = useRef(0);
  const playedRef = useRef(new Set<string>());
  const shownAtRef = useRef(0);
  const revealMsRef = useRef(DEFAULT_REVEAL_MS);
  const dragStartRef = useRef(0);
  const movedRef = useRef(0);
  /** Mirrors `dragging`: a pointerdown and pointerup in the same tick would
      otherwise both read the pre-update state and drop the gesture. */
  const draggingRef = useRef(false);
  const wheelRef = useRef({ delta: 0, at: 0, until: 0 });
  const trimTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const maxLevel = useMemo(
    () => Math.min(MAX_DIFFICULTY, Math.max(...questions.map((q) => q.d))),
    [questions],
  );

  const current = deck.cards[deck.page] ?? deck.cards[0];
  const onDarkCard = current.kind !== "q";

  useEffect(() => onCardChange?.(onDarkCard), [onDarkCard, onCardChange]);
  useEffect(() => onSheetChange?.(sheetOpen), [sheetOpen, onSheetChange]);
  // The reveal timer starts when the first card is actually on screen.
  useEffect(() => {
    shownAtRef.current = Date.now();
    return () => {
      clearTimeout(trimTimerRef.current);
      clearTimeout(toastTimerRef.current);
    };
  }, []);

  const commit = useCallback((next: Deck) => {
    deckRef.current = next;
    setDeck(next);
  }, []);

  /**
   * Draws the next question. Difficulty follows how long the last answer took
   * to reveal; used questions do not repeat until the bank is nearly spent.
   */
  const drawQuestion = useCallback(
    (revealMs: number): Question => {
      if (difficultyRamp) {
        if (revealMs < FAST_REVEAL_MS) levelRef.current = Math.min(maxLevel, levelRef.current + 1);
        else if (revealMs > SLOW_REVEAL_MS) levelRef.current = Math.max(1, levelRef.current - 1);
      }

      const used = usedRef.current;
      if (used.size >= questions.length - 1) used.clear();

      const atLevel = questions.filter((q) => !used.has(q.id) && q.d === levelRef.current);
      const pool = difficultyRamp && atLevel.length ? atLevel : questions.filter((q) => !used.has(q.id));
      const picked = pool[Math.floor(Math.random() * pool.length)] ?? questions[0];
      used.add(picked.id);
      return picked;
    },
    [difficultyRamp, maxLevel, questions],
  );

  /** Next mode in rotation, skipping any already played this session. */
  const drawMode = useCallback((): GameMode => {
    for (let i = 0; i < modes.length; i++) {
      const candidate = modes[(promoIndexRef.current + i) % modes.length];
      if (!playedRef.current.has(candidate.key)) {
        promoIndexRef.current = (promoIndexRef.current + i + 1) % modes.length;
        return candidate;
      }
    }
    const candidate = modes[promoIndexRef.current % modes.length];
    promoIndexRef.current = (promoIndexRef.current + 1) % modes.length;
    return candidate;
  }, [modes]);

  /** Drops cards that have scrolled well out of view, without a visible jump. */
  const scheduleTrim = useCallback(() => {
    clearTimeout(trimTimerRef.current);
    trimTimerRef.current = setTimeout(() => {
      const { cards, page } = deckRef.current;
      if (cards.length <= TRIM_ABOVE || page < TRIM_COUNT) return;
      setSnapping(true);
      commit({ cards: cards.slice(TRIM_COUNT), page: page - TRIM_COUNT });
      requestAnimationFrame(() => setSnapping(false));
    }, TRIM_DELAY_MS);
  }, [commit]);

  const advance = useCallback(() => {
    const { cards, page } = deckRef.current;
    const card = cards[page];
    const next = cards[page + 1];

    draggingRef.current = false;
    setDrag(0);
    setDragging(false);

    // Already generated — going forward again after a swipe back.
    if (next) {
      if (next.kind === "q") shownAtRef.current = Date.now() + ADVANCE_MS;
      commit({ cards, page: page + 1 });
      return;
    }

    let built: Card;
    if (card.kind === "q") {
      revealMsRef.current = Date.now() - shownAtRef.current;
      built = { kind: "a", n: card.n, question: card.question };
      if (haptics) navigator.vibrate?.(8);
    } else if (card.kind === "a" && modes.length && card.n % promoEvery === 0) {
      built = { kind: "promo", n: card.n, mode: drawMode() };
    } else {
      built = { kind: "q", n: card.n + 1, question: drawQuestion(revealMsRef.current) };
      shownAtRef.current = Date.now() + ADVANCE_MS;
    }

    commit({ cards: [...cards, built], page: page + 1 });
    scheduleTrim();
  }, [commit, drawMode, drawQuestion, haptics, modes.length, promoEvery, scheduleTrim]);

  const rewind = useCallback(() => {
    draggingRef.current = false;
    setDrag(0);
    setDragging(false);
    const { cards, page } = deckRef.current;
    if (page === 0) return;
    commit({ cards, page: page - 1 });
  }, [commit]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (sheetOpen) return;
    dragStartRef.current = event.clientY;
    movedRef.current = 0;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draggingRef.current = true;
    setDragging(true);
    setDrag(0);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const delta = dragStartRef.current - event.clientY;
    movedRef.current = Math.max(movedRef.current, Math.abs(delta));
    const height = containerRef.current?.clientHeight ?? window.innerHeight;
    const canRewind = deckRef.current.page > 0;
    setDrag(
      delta > 0
        ? Math.min(delta, height)
        : canRewind
          ? Math.max(delta, -height)
          : delta * RUBBER_BAND,
    );
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const delta = dragStartRef.current - event.clientY;
    if (delta > SWIPE_THRESHOLD || movedRef.current < TAP_SLOP) advance();
    else if (delta < -SWIPE_THRESHOLD) rewind();
    else {
      setDrag(0);
      setDragging(false);
    }
  };

  // A trackpad or mouse wheel is how a desktop reader expects to move a feed.
  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (sheetOpen) return;
      const now = Date.now();
      const wheel = wheelRef.current;
      if (now < wheel.until) return; // still coasting from the last advance
      if (now - wheel.at > WHEEL_GAP_MS) wheel.delta = 0;
      wheel.at = now;
      // Firefox reports lines, and some setups report pages.
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      wheel.delta += event.deltaY * scale;

      if (Math.abs(wheel.delta) < WHEEL_THRESHOLD) return;
      if (wheel.delta > 0) advance();
      else rewind();
      wheel.delta = 0;
      wheel.until = now + WHEEL_COOLDOWN_MS;
    },
    [advance, rewind, sheetOpen],
  );

  // Keyboard equivalents of the swipe, for anyone playing on a desktop browser.
  useEffect(() => {
    if (!active || sheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Never swallow a key meant for a control the reader has focused.
      const target = event.target;
      if (target instanceof Element && target.closest("button, a, input, textarea, select")) {
        return;
      }
      if (event.key === "ArrowDown" || event.key === " " || event.key === "Enter") {
        event.preventDefault();
        advance();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        rewind();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, advance, rewind, sheetOpen]);

  const playMode = (key: string) => {
    playedRef.current.add(key);
    onPlayMode?.(key);
  };

  const shareUrl = (question: Question) =>
    `${window.location.origin}/q/${encodeURIComponent(question.id)}`;

  const openShare = async () => {
    if (current.kind !== "a") return;
    const question = current.question;
    const title = question.p ?? question.q;
    if (navigator.share) {
      try {
        // The answer never travels with the link.
        await navigator.share({ title, text: title, url: shareUrl(question) });
        return;
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
      }
    }
    setCopied(false);
    setSheetOpen(true);
  };

  const copyLink = async () => {
    if (current.kind !== "a") return;
    try {
      await navigator.clipboard.writeText(shareUrl(current.question));
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setCopied(false);
      setSheetOpen(false);
    }, TOAST_MS);
  };

  const canShare = current.kind === "a" && !sheetOpen;
  const stopPointer = (event: React.PointerEvent) => event.stopPropagation();
  const shieldPointer = {
    onPointerDown: stopPointer,
    onPointerMove: stopPointer,
    onPointerUp: stopPointer,
  };

  return (
    <div
      ref={containerRef}
      className={styles.feed}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div
        className={`${styles.track} ${dragging || snapping ? "" : styles.advancing}`}
        style={{ transform: `translateY(calc(${-deck.page} * var(--hh-card-h) - ${drag}px))` }}
      >
        {deck.cards.map((card, index) => (
          <FeedCard
            key={`${card.kind}-${card.n}-${index}`}
            card={card}
            onPlay={playMode}
            shieldPointer={shieldPointer}
          />
        ))}
      </div>

      <div className={styles.chrome} style={{ opacity: sheetOpen ? 0 : 1 }}>
        <span
          className={styles.chromeLabel}
          style={{ color: onDarkCard ? "rgba(255,246,238,.45)" : "rgba(22,19,14,.3)" }}
        >
          HOT HAND
        </span>
        <span
          className={`${styles.chromeLabel} ${styles.counter}`}
          style={{ color: onDarkCard ? "rgba(255,246,238,.45)" : "rgba(22,19,14,.3)" }}
        >
          {String(current.n).padStart(2, "0")}
        </span>
      </div>

      <div
        className={styles.shareDock}
        style={{
          opacity: canShare ? 1 : 0,
          pointerEvents: canShare ? "auto" : "none",
          transform: canShare ? "scale(1)" : "scale(.82)",
        }}
      >
        <button
          type="button"
          className={styles.shareButton}
          onClick={openShare}
          {...shieldPointer}
        >
          <ShareIcon />
          {SHARE_PHRASES[(current.n - 1) % SHARE_PHRASES.length]}
        </button>
      </div>

      <div
        className={styles.sheetLayer}
        data-open={sheetOpen}
        style={{ pointerEvents: sheetOpen ? "auto" : "none" }}
        {...shieldPointer}
      >
        <button
          type="button"
          aria-label="Dismiss"
          tabIndex={sheetOpen ? 0 : -1}
          className={styles.backdrop}
          onClick={() => setSheetOpen(false)}
        />
        <div className={styles.sheet}>
          <span className={`${styles.kicker} ${styles.sheetKicker}`}>SHARE THIS QUESTION</span>
          <span className={styles.sheetPrompt}>
            {current.kind === "a" ? (current.question.p ?? current.question.q) : ""}
          </span>
          <span className={styles.sheetLink}>
            {current.kind === "a" ? `/q/${current.question.id}` : ""}
          </span>
          <div className={styles.sheetActions}>
            <button
              type="button"
              className={styles.pill}
              tabIndex={sheetOpen ? 0 : -1}
              onClick={copyLink}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              className={styles.sheetClose}
              tabIndex={sheetOpen ? 0 : -1}
              onClick={() => setSheetOpen(false)}
            >
              Close
            </button>
          </div>
        </div>

        <div
          className={styles.toast}
          style={{
            opacity: copied ? 1 : 0,
            transform: copied ? "translateY(0)" : "translateY(10px)",
          }}
        >
          <span className={styles.toastLabel}>
            Link copied — they get the question, not the answer
          </span>
        </div>
      </div>
    </div>
  );
}

function FeedCard({
  card,
  onPlay,
  shieldPointer,
}: {
  card: Card;
  onPlay: (key: string) => void;
  shieldPointer: Record<string, (event: React.PointerEvent) => void>;
}) {
  if (card.kind === "promo") {
    return (
      <section className={`${styles.card} ${styles.promo}`}>
        <div className={styles.promoBody}>
          <span className={`${styles.kicker} ${styles.promoKicker}`}>ANOTHER WAY TO PLAY</span>
          <span className={styles.promoName}>{card.mode.name}</span>
          <span className={styles.promoBlurb}>{card.mode.blurb}</span>
          <button
            type="button"
            className={`${styles.pill} ${styles.promoPlay}`}
            onClick={() => onPlay(card.mode.key)}
            {...shieldPointer}
          >
            {promoAction(card.mode)}
          </button>
        </div>
        <Hint label="SWIPE TO SKIP" color="rgba(244,241,234,.38)" opacity={0.8} />
      </section>
    );
  }

  const answer = card.kind === "a";
  const text = answer ? card.question.a : card.question.q;

  return (
    <section className={`${styles.card} ${answer ? styles.answer : styles.question}`}>
      <div>
        {answer && <span className={`${styles.kicker} ${styles.answerKicker}`}>ANSWER</span>}
        <h2 className={`${styles.display} ${answer ? answerSize(text) : questionSize(text)}`}>
          {text}
        </h2>
      </div>
      <Hint
        label={answer ? "NEXT" : "SWIPE UP TO REVEAL"}
        color={answer ? "rgba(255,246,238,.5)" : "rgba(22,19,14,.35)"}
        opacity={answer ? 0.8 : 1}
      />
    </section>
  );
}

/** The promo button says what the mode actually asks of you. */
function promoAction(mode: GameMode) {
  if (mode.kind === "guess") return "Take six guesses";
  const minutes = Math.round(mode.seconds / 60);
  return `Play ${minutes === 1 ? "a minute" : `${minutes} minutes`}`;
}

function Hint({ label, color, opacity }: { label: string; color: string; opacity: number }) {
  return (
    <div className={styles.hint} style={{ opacity }} aria-hidden>
      <svg width="26" height="15" viewBox="0 0 26 15" fill="none">
        <path
          d="M2 13L13 2l11 11"
          stroke={color}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.kicker} style={{ color }}>
        {label}
      </span>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="21" viewBox="0 0 20 24" fill="none" aria-hidden>
      <path
        d="M10 2v14M5 7l5-5 5 5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 11v10h12V11"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The handoff sizes display type against its own short sample copy. The bank
 * runs longer, so the longest questions and answers step down a size.
 */
function questionSize(text: string) {
  if (text.length <= 85) return styles.sizeL;
  if (text.length <= 120) return styles.sizeM;
  return styles.sizeS;
}

function answerSize(text: string) {
  if (text.length <= 26) return styles.sizeXl;
  if (text.length <= 50) return styles.sizeL;
  return styles.sizeM;
}
