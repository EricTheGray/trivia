import { requireObject, requireString } from "@/lib/dataset";

/** How a round's answers are given: pick from a list, or type a name. */
export type ModeInput = "list" | "type";

export type Round = {
  year: number;
  answer: string;
};

export type GameMode = {
  key: string;
  /** Shown on the modes list and the feed's promo card. */
  name: string;
  blurb: string;
  /** Square chip colour on the modes list. */
  chip: string;
  /** Kicker at the top of the round, e.g. "CHAMPIONSHIPS". */
  title: string;
  /** Sheet prompt with a `{year}` placeholder. */
  prompt: string;
  input: ModeInput;
  /** Length of the round. */
  seconds: number;
  /** Newest season first. */
  rounds: Round[];
  /** List modes only: what the picker offers. */
  options?: string[];
};

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

  const modes = catalog.modes.map((entry, i) => {
    const raw = requireObject(entry, `${source}: mode ${i}`);
    const key = requireString(raw.key, source, `mode ${i} key`);
    const input = raw.input === "type" ? "type" : "list";

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

    const options = Array.isArray(raw.options)
      ? raw.options.filter((option): option is string => typeof option === "string")
      : undefined;
    if (input === "list" && !options?.length) {
      throw new Error(`${source}: list mode ${key} has no options`);
    }

    const seconds = Number(raw.seconds);
    const mode: GameMode = {
      key,
      name: requireString(raw.name, source, `mode ${key} name`),
      blurb: typeof raw.blurb === "string" ? raw.blurb : "",
      chip: typeof raw.chip === "string" ? raw.chip : "#16130E",
      title: requireString(raw.title, source, `mode ${key} title`),
      prompt: requireString(raw.prompt, source, `mode ${key} prompt`),
      input,
      seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 180,
      rounds,
    };
    if (options?.length) mode.options = options;
    return mode;
  });

  return {
    version: typeof catalog.version === "string" ? catalog.version : "unknown",
    source: typeof catalog.source === "string" ? catalog.source : source,
    modes,
  };
}
