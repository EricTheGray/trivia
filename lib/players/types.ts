import { requireObject } from "@/lib/dataset";

export type Roster = {
  version: string;
  source: string;
  /**
   * Player names, accents intact, **ordered by how likely a player is to be the
   * one someone means** — most recently active first. Filtering preserves that
   * order, so the order is the ranking. See `scripts/import-players.py`.
   */
  players: string[];
};

export function parseRoster(value: unknown, source: string): Roster {
  const roster = requireObject(value, source);
  if (!Array.isArray(roster.players)) {
    throw new Error(`${source}: missing a "players" array`);
  }
  const players = roster.players.filter(
    (name): name is string => typeof name === "string" && name.length > 0,
  );
  if (!players.length) throw new Error(`${source}: roster is empty`);

  return {
    version: typeof roster.version === "string" ? roster.version : "unknown",
    source: typeof roster.source === "string" ? roster.source : source,
    players,
  };
}
