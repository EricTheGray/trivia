import { requireObject, requireString } from "@/lib/dataset";

/** Which autocomplete list a round's answers are typed against. */
export type AnswerPool = "players" | "teams";

/** What kind of game a mode is, and so which screen plays it. */
export type ModeKind = "years" | "lineups" | "guess";

const POOLS: AnswerPool[] = ["players", "teams"];
const KINDS: ModeKind[] = ["years", "lineups", "guess"];

export type Round = {
  year: number;
  answer: string;
};

type ModeBase = {
  key: string;
  /** Shown on the modes list and the feed's promo card. */
  name: string;
  blurb: string;
  /** Square chip colour on the modes list. */
  chip: string;
  /** Kicker at the top of the round, e.g. "CHAMPIONSHIPS". */
  title: string;
  /** Sheet prompt; the placeholders it takes depend on the kind. */
  prompt: string;
  pool: AnswerPool;
};

/** One answer per season, for every season on record. */
export type YearsMode = ModeBase & {
  kind: "years";
  seconds: number;
  /** Newest season first. */
  rounds: Round[];
};

/** Champions' starting fives, with some of each lineup blanked out. */
export type LineupsMode = ModeBase & {
  kind: "lineups";
  seconds: number;
};

/** Six guesses at a player. No clock. */
export type GuessMode = ModeBase & {
  kind: "guess";
  /**
   * True for the daily puzzle: one player a day, the same for everyone, kept
   * until tomorrow. False for the unlimited mode, which deals a fresh player
   * every round.
   */
  daily: boolean;
};

export type GameMode = YearsMode | LineupsMode | GuessMode;

export type ModeCatalog = {
  version: string;
  source: string;
  modes: GameMode[];
};

export function parseModeCatalog(value: unknown, source: string): ModeCatalog {
  const catalog = requireObject(value, source);
  if (!Array.isArray(catalog.modes)) {
    throw new Error(`${source}: missing a "modes" array`);
  }

  const modes = catalog.modes.map((entry, i): GameMode => {
    const raw = requireObject(entry, `${source}: mode ${i}`);
    const key = requireString(raw.key, source, `mode ${i} key`);

    const pool = POOLS.find((candidate) => candidate === raw.pool);
    if (!pool) throw new Error(`${source}: mode ${key} has pool ${String(raw.pool)}`);

    const kind = KINDS.find((candidate) => candidate === raw.kind);
    if (!kind) throw new Error(`${source}: mode ${key} has kind ${String(raw.kind)}`);

    const base: ModeBase = {
      key,
      name: requireString(raw.name, source, `mode ${key} name`),
      blurb: typeof raw.blurb === "string" ? raw.blurb : "",
      chip: typeof raw.chip === "string" ? raw.chip : "#16130E",
      title: requireString(raw.title, source, `mode ${key} title`),
      prompt: requireString(raw.prompt, source, `mode ${key} prompt`),
      pool,
    };

    if (kind === "guess") return { ...base, kind, daily: raw.daily !== false };

    const seconds = Number(raw.seconds);
    const clock = Number.isFinite(seconds) && seconds > 0 ? seconds : 300;
    if (kind === "lineups") return { ...base, kind, seconds: clock };

    if (!Array.isArray(raw.rounds) || !raw.rounds.length) {
      throw new Error(`${source}: mode ${key} has no rounds`);
    }
    const rounds = raw.rounds.map((round, j) => {
      const item = requireObject(round, `${source}: mode ${key} round ${j}`);
      const year = Number(item.year);
      if (!Number.isInteger(year)) {
        throw new Error(`${source}: mode ${key} round ${j} has year ${String(item.year)}`);
      }
      return { year, answer: requireString(item.answer, source, `mode ${key} round ${j} answer`) };
    });

    return { ...base, kind, seconds: clock, rounds };
  });

  return {
    version: typeof catalog.version === "string" ? catalog.version : "unknown",
    source: typeof catalog.source === "string" ? catalog.source : source,
    modes,
  };
}
