import { REVALIDATE_SECONDS } from "@/lib/dataset";
import { loadLineups } from "@/lib/starting-fives";

/** Champions' starting lineups, as `{ version, source, lineups }`. */
export async function GET() {
  const { loadedFrom, ...payload } = await loadLineups();
  return Response.json(payload, {
    headers: {
      "x-starting-fives-source": loadedFrom,
      "cache-control": `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
