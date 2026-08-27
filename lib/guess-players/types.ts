import { requireObject, requireString } from "@/lib/dataset";

export type Conference = "East" | "West";

export type GuessPlayer = {
  name: string;
  /** Year drafted — a higher/lower clue. */
  drafted: number;
  /** Height in inches — a taller/shorter clue. */
  heightIn: number;
  /** Display height, e.g. "6-6". */
  height: string;
  /** G, G-F, F, F-C, C… compared whole and by shared letter. */
  position: string;
  /** null for the prep-to-pro and international players. */
  college: string | null;
  team: string;
  /** Three or four letters, for the board's table. */
  teamCode: string;
  /** null for the undrafted and the one ABA team in the pool. */
  conference: Conference | null;
  jersey: number;
};

export type GuessPool = {
  version: string;
  source: string;
  players: GuessPlayer[];
};

export function parseGuessPool(value: unknown, source: string): GuessPool {
  const payload = requireObject(value, source);
  if (!Array.isArray(payload.players)) {
    throw new Error(`${source}: missing a "players" array`);
  }

  const players = payload.players.map((entry, i) => {
    const raw = requireObject(entry, `${source}: player ${i}`);
    const name = requireString(raw.name, source, `player ${i} name`);
    const numbers = { drafted: Number(raw.drafted), heightIn: Number(raw.heightIn), jersey: Number(raw.jersey) };
    for (const [field, number] of Object.entries(numbers)) {
      if (!Number.isFinite(number)) {
        throw new Error(`${source}: ${name} has ${field} ${String(raw[field])}`);
      }
    }
    const conference: Conference | null =
      raw.conference === "East" || raw.conference === "West" ? raw.conference : null;
    return {
      name,
      ...numbers,
      height: typeof raw.height === "string" ? raw.height : "",
      position: requireString(raw.position, source, `${name} position`),
      college: typeof raw.college === "string" && raw.college ? raw.college : null,
      team: requireString(raw.team, source, `${name} team`),
      teamCode: requireString(raw.teamCode, source, `${name} teamCode`),
      conference,
    };
  });

  if (!players.length) throw new Error(`${source}: pool is empty`);

  return {
    version: typeof payload.version === "string" ? payload.version : "unknown",
    source: typeof payload.source === "string" ? payload.source : source,
    players,
  };
}
