import { REVALIDATE_SECONDS } from "@/lib/dataset";
import { loadGuessPool } from "@/lib/guess-players";

/** The Guess the Player pool, as `{ version, source, players }`. */
export async function GET() {
  const { loadedFrom, ...payload } = await loadGuessPool();
  return Response.json(payload, {
    headers: {
      "x-guess-players-source": loadedFrom,
      "cache-control": `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
