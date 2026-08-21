import { connection } from "next/server";
import { loadModeCatalog } from "@/lib/game-modes";
import { loadQuestionBank, pickOpeningQuestion } from "@/lib/questions";
import { HotHand } from "./components/hot-hand";

export default async function Page() {
  const [{ questions }, { modes }] = await Promise.all([loadQuestionBank(), loadModeCatalog()]);

  // Every session opens on a different easy question, so pick at request time
  // rather than baking one into the prerender.
  await connection();
  const start = pickOpeningQuestion(questions);

  return <HotHand questions={questions} startQuestionId={start.id} modes={modes} />;
}
