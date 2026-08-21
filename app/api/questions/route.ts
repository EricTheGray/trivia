import { REVALIDATE_SECONDS } from "@/lib/dataset";
import { loadQuestionBank } from "@/lib/questions";

/**
 * The feed's questions, as `{ version, source, questions }`.
 *
 * The page already receives the bank from the server render, so nothing calls
 * this on first load. It exists so a client can refresh the bank without a
 * reload, and so the swap to a remote repository is invisible to callers.
 */
export async function GET() {
  const { loadedFrom, ...bank } = await loadQuestionBank();
  return Response.json(bank, {
    headers: {
      "x-questions-source": loadedFrom,
      "cache-control": `public, max-age=0, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
    },
  });
}
