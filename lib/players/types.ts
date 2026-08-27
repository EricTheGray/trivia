import { parseNameList } from "@/lib/dataset";

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
  const { names, ...meta } = parseNameList(value, source, "players");
  return { ...meta, players: names };
}
