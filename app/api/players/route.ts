import { REVALIDATE_SECONDS } from "@/lib/dataset";
import { createNameIndex, MAX_SUGGESTIONS } from "@/lib/matching";
import { loadRoster, PLAYER_ALIASES } from "@/lib/players";

/**
 * The autocomplete roster, as `{ version, source, players }`.
 *
 * Fetched once when a typed round opens; the client filters locally from there,
 * so autocomplete costs no round trips per keystroke. `?q=` runs the same
 * ranked search server-side, for callers that would rather not hold the roster.
 */
export async function GET(request: Request) {
  const { loadedFrom, ...roster } = await loadRoster();
  const query = new URL(request.url).searchParams.get("q");

  const body = query
    ? {
        ...roster,
        query,
        players: createNameIndex(roster.players, { aliases: PLAYER_ALIASES }).search(
          query,
          MAX_SUGGESTIONS,
        ),
      }
    : roster;

  return Response.json(body, {
    headers: {
      "x-players-source": loadedFrom,
      "cache-control": `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
