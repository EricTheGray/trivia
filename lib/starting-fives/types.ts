import { requireObject, requireString } from "@/lib/dataset";

export type Starter = {
  name: string;
  /** As filed on the players sheet: G, G-F, F, F-C, C… */
  position: string;
};

export type Lineup = {
  year: number;
  team: string;
  /** Five starters, guards first through centres. */
  starters: Starter[];
};

export type LineupSet = {
  version: string;
  source: string;
  lineups: Lineup[];
};

export function parseLineups(value: unknown, source: string): LineupSet {
  const payload = requireObject(value, source);
  if (!Array.isArray(payload.lineups)) {
    throw new Error(`${source}: missing a "lineups" array`);
  }

  const lineups = payload.lineups.map((entry, i) => {
    const raw = requireObject(entry, `${source}: lineup ${i}`);
    const year = Number(raw.year);
    if (!Number.isInteger(year)) {
      throw new Error(`${source}: lineup ${i} has year ${String(raw.year)}`);
    }
    if (!Array.isArray(raw.starters) || raw.starters.length !== 5) {
      throw new Error(`${source}: lineup ${year} does not have five starters`);
    }
    const starters = raw.starters.map((starter, j) => {
      const item = requireObject(starter, `${source}: lineup ${year} starter ${j}`);
      return {
        name: requireString(item.name, source, `lineup ${year} starter ${j} name`),
        position: requireString(item.position, source, `lineup ${year} starter ${j} position`),
      };
    });
    return { year, team: requireString(raw.team, source, `lineup ${year} team`), starters };
  });

  if (!lineups.length) throw new Error(`${source}: no lineups`);

  return {
    version: typeof payload.version === "string" ? payload.version : "unknown",
    source: typeof payload.source === "string" ? payload.source : source,
    lineups,
  };
}
