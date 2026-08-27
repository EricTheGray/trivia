import type { GuessPlayer } from "./types";

/**
 * Scoring one guess against the day's player. Six traits, each answered as
 * hit / close / miss, with a direction on the three numeric ones.
 */

export type Verdict = "hit" | "close" | "miss";

export type ClueKey = "drafted" | "height" | "position" | "college" | "team" | "jersey";

export type Clue = {
  key: ClueKey;
  label: string;
  /** The guessed player's value, shown on the board. */
  value: string;
  verdict: Verdict;
  /** Which way the target lies, on a miss. */
  direction?: "higher" | "lower";
  /** Why a clue is "close", e.g. "Same conference". */
  note?: string;
};

const NO_COLLEGE = "No college";

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
  if (guess.team === target.team) {
    return { key: "team", label: "Drafted by", value, verdict: "hit" };
  }
  if (guess.conference && guess.conference === target.conference) {
    return {
      key: "team",
      label: "Drafted by",
      value,
      verdict: "close",
      note: `${guess.conference} — same conference`,
    };
  }
  return { key: "team", label: "Drafted by", value, verdict: "miss" };
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

/** Today where the reader is, as YYYY-MM-DD. */
export function localIsoDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
