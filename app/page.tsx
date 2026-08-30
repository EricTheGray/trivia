import { connection } from "next/server";
import { loadModeCatalog } from "@/lib/game-modes";
import { loadQuestionBank, pickOpeningQuestion } from "@/lib/questions";
import { HotHand } from "./components/hot-hand";

const TABS = ["feed", "modes", "settings"] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  const [{ questions }, { modes }] = await Promise.all([loadQuestionBank(), loadModeCatalog()]);

  // Every session opens on a different easy question, so pick at request time
  // rather than baking one into the prerender.
  await connection();
  const start = pickOpeningQuestion(questions);

  // ?screen=modes, or ?screen=mode:guess to open a round. The design canvas
  // uses these to land each frame on the screen it is showing.
  const { screen } = await searchParams;
  const modeKey = screen?.startsWith("mode:") ? screen.slice(5) : undefined;
  const tab = modeKey ? "modes" : TABS.find((name) => name === screen);

  return (
    <HotHand
      questions={questions}
      startQuestionId={start.id}
      modes={modes}
      initialTab={tab}
      initialModeKey={modeKey}
    />
  );
}
