import { REVALIDATE_SECONDS } from "@/lib/dataset";
import { loadModeCatalog } from "@/lib/game-modes";

/** The six timed rounds, as `{ version, source, modes }`. */
export async function GET() {
  const { loadedFrom, ...catalog } = await loadModeCatalog();
  return Response.json(catalog, {
    headers: {
      "x-modes-source": loadedFrom,
      "cache-control": `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
