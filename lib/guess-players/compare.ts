import type { Conference, GuessPlayer } from "./types";

/**
 * Scoring one guess against the day's player. Six traits, each answered as
 * hit / close / miss, with a direction on the three numeric ones.
 */

export type Verdict = "hit" | "close" | "miss";

export type ClueKey = "drafted" | "height" | "position" | "college" | "team" | "jersey";

export type Clue = {
  key: ClueKey;
  label: string;
  /** The guessed player's value, in full. */
  value: string;
  /** A table-sized form of it, when the full value will not fit a column. */
  short?: string;
  verdict: Verdict;
  /** Which way the target lies, on a miss. */
  direction?: "higher" | "lower";
  /** Why a clue is "close", e.g. "Same conference". */
  note?: string;
};

const NO_COLLEGE = "No college";

/**
 * Positions are recorded the way Basketball-Reference writes them, primary
 * first: Jordan is G-F, Pippen F-G, Garnett F-C. Both orders of each hybrid
 * appear in the pool, which is what makes the order meaningful.
 *
 * That gives a primary position, but only at guard/forward/centre. Nothing in
 * the source separates a point guard from a shooting guard, so the recorded
 * value is shown as it stands rather than dressed up as one.
 */

function numericClue(
  key: ClueKey,
  label: string,
  value: string,
  guessed: number,
  target: number,
): Clue {
  if (guessed === target) return { key, label, value, verdict: "hit" };
  return {
    key,
    label,
    value,
    verdict: "miss",
    direction: target > guessed ? "higher" : "lower",
  };
}

/** Positions share a letter when one plays some of the other's role. */
function positionClue(guess: GuessPlayer, target: GuessPlayer): Clue {
  const value = guess.position;
  if (guess.position === target.position) {
    return { key: "position", label: "Position", value, verdict: "hit" };
  }
  const guessed = new Set(guess.position.split("-"));
  const shared = target.position.split("-").filter((part) => guessed.has(part));
  if (shared.length) {
    return {
      key: "position",
      label: "Position",
      value,
      verdict: "close",
      note: `Also plays ${shared.join("/")}`,
    };
  }
  return { key: "position", label: "Position", value, verdict: "miss" };
}

/**
 * College has a third state: 31 of the pool never played college ball, and
 * "no college" is itself a fact two players can share.
 */
function collegeClue(guess: GuessPlayer, target: GuessPlayer): Clue {
  const value = guess.college ?? NO_COLLEGE;
  const verdict = guess.college === target.college ? "hit" : "miss";
  return { key: "college", label: "College", value, verdict };
}

/** The drafting team, with right-conference-wrong-team in between. */
function teamClue(guess: GuessPlayer, target: GuessPlayer): Clue {
  const value = guess.team;
  const short = guess.teamCode;
  if (guess.team === target.team) {
    return { key: "team", label: "Drafted by", value, short, verdict: "hit" };
  }
  if (guess.conference && guess.conference === target.conference) {
    return {
      key: "team",
      label: "Drafted by",
      value,
      short,
      verdict: "close",
      note: `${guess.conference} — same conference`,
    };
  }
  return { key: "team", label: "Drafted by", value, short, verdict: "miss" };
}

export function compareGuess(guess: GuessPlayer, target: GuessPlayer): Clue[] {
  return [
    numericClue("drafted", "Drafted", String(guess.drafted), guess.drafted, target.drafted),
    numericClue("height", "Height", guess.height || `${guess.heightIn}in`, guess.heightIn, target.heightIn),
    positionClue(guess, target),
    collegeClue(guess, target),
    teamClue(guess, target),
    numericClue("jersey", "Jersey", `#${guess.jersey}`, guess.jersey, target.jersey),
  ];
}

export function isCorrect(guess: GuessPlayer, target: GuessPlayer): boolean {
  return guess.name === target.name;
}

/**
 * The player for a given day. Everyone playing on the same date gets the same
 * one, and the pool walks in a different order each time it cycles.
 */
export function pickDailyPlayer(players: GuessPlayer[], isoDate: string): GuessPlayer {
  // FNV-1a, then a splitmix finaliser. The finaliser is the point: the pool is
  // in alphabetical order, and a weaker hash walks it a step at a time, so
  // three straight days all came up "Jalen".
  let hash = 0x811c9dc5;
  for (const character of isoDate) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return players[hash % players.length];
}

/**
 * A player at random, for the unlimited mode. Never deals the same player
 * twice in a row.
 */
export function pickRandomPlayer(players: GuessPlayer[], exclude?: string): GuessPlayer {
  const choices = players.filter((player) => player.name !== exclude);
  const pool = choices.length ? choices : players;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Today where the reader is, as YYYY-MM-DD. */
export function localIsoDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * What the guesses so far have established, ready to be shown on the row about
 * to be played.
 *
 * Derived from the clues, not from the answer: a bound only exists because an
 * arrow pointed at it, so this can never say more than the board already has.
 */
export type Bound = { exact?: number; min?: number; max?: number };

export type Hints = {
  drafted?: Bound;
  height?: Bound;
  jersey?: Bound;
  /**
   * Position accumulates rather than settles. A close match proves the answer
   * plays that role; a miss proves it plays none of the guess's roles. Only
   * when every one of G, F and C is accounted for is the position actually
   * known.
   */
  position?: { exact?: string; includes: string[]; excludes: string[] };
  /** Present only once known; `null` means the answer went to no college. */
  college?: { exact: string | null };
  team?: { exact?: string; conference?: Conference };
};

export const POSITION_LETTERS = ["G", "F", "C"] as const;

const NUMERIC: Record<string, (player: GuessPlayer) => number> = {
  drafted: (player) => player.drafted,
  height: (player) => player.heightIn,
  jersey: (player) => player.jersey,
};

export function deduceHints(guesses: GuessPlayer[], target: GuessPlayer): Hints {
  const hints: Hints = {};

  const narrow = (key: "drafted" | "height" | "jersey", clue: Clue, value: number) => {
    const bound: Bound = hints[key] ?? {};
    if (clue.verdict === "hit") bound.exact = value;
    else if (clue.direction === "higher") bound.min = Math.max(bound.min ?? -Infinity, value + 1);
    else if (clue.direction === "lower") bound.max = Math.min(bound.max ?? Infinity, value - 1);
    hints[key] = bound;
  };

  for (const guess of guesses) {
    for (const clue of compareGuess(guess, target)) {
      if (clue.key === "drafted" || clue.key === "height" || clue.key === "jersey") {
        narrow(clue.key, clue, NUMERIC[clue.key](guess));
        continue;
      }
      if (clue.key === "position") {
        const includes = new Set(hints.position?.includes ?? []);
        const excludes = new Set(hints.position?.excludes ?? []);
        const parts = guess.position.split("-");

        if (clue.verdict === "hit") {
          // An exact match settles every letter: these are in, the rest are out.
          for (const letter of POSITION_LETTERS) {
            (parts.includes(letter) ? includes : excludes).add(letter);
          }
          hints.position = { exact: guess.position, includes: [...includes], excludes: [...excludes] };
          continue;
        }
        if (clue.verdict === "close") {
          for (const part of clue.note?.replace("Also plays ", "").split("/") ?? []) includes.add(part);
        } else {
          // Nothing shared: the answer plays none of what this guess played.
          for (const part of parts) excludes.add(part);
        }
        hints.position = {
          exact: hints.position?.exact,
          includes: [...includes],
          excludes: [...excludes],
        };
        continue;
      }
      if (clue.key === "college") {
        if (clue.verdict === "hit") hints.college = { exact: guess.college };
        continue;
      }
      if (clue.verdict === "hit") hints.team = { exact: guess.team };
      else if (clue.verdict === "close" && !hints.team?.exact && guess.conference) {
        hints.team = { conference: guess.conference };
      }
    }
  }

  return hints;
}

/** Inches back to the way a height is spoken. */
export function formatHeight(inches: number): string {
  return `${Math.floor(inches / 12)}-${inches % 12}`;
}
