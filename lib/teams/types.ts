import { parseNameList } from "@/lib/dataset";

export type TeamList = {
  version: string;
  source: string;
  /** The thirty current NBA franchises, alphabetical. */
  teams: string[];
};

export function parseTeamList(value: unknown, source: string): TeamList {
  const { names, ...meta } = parseNameList(value, source, "teams");
  return { ...meta, teams: names };
}
