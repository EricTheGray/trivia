import { REVALIDATE_SECONDS } from "@/lib/dataset";
import { createNameIndex, MAX_SUGGESTIONS } from "@/lib/matching";
import { loadTeams, teamPool, TEAM_ALIASES } from "@/lib/teams";

/**
 * The team autocomplete pool, as `{ version, source, teams }`. Mirrors
 * `/api/players`: fetched once when a team round opens, `?q=` for callers that
 * would rather search server-side.
 */
export async function GET(request: Request) {
  const { loadedFrom, ...list } = await loadTeams();
  const query = new URL(request.url).searchParams.get("q");

  const body = query
    ? {
        ...list,
        query,
        teams: createNameIndex(teamPool(list.teams), { aliases: TEAM_ALIASES }).search(
          query,
          MAX_SUGGESTIONS,
        ),
      }
    : list;

  return Response.json(body, {
    headers: {
      "x-teams-source": loadedFrom,
      "cache-control": `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
