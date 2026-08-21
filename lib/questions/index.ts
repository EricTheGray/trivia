import bundled from "@/data/feed-questions.json";
import { createDataset } from "@/lib/dataset";
import { parseBank, type Question, type QuestionBank } from "./types";

export * from "./types";

/**
 * The feed's question bank: `data/feed-questions.json`, or the endpoint in
 * `QUESTIONS_API_URL` when one is set.
 */
const questions = createDataset<QuestionBank>({
  name: "questions",
  urlEnv: "QUESTIONS_API_URL",
  tokenEnv: "QUESTIONS_API_TOKEN",
  bundled,
  parse: parseBank,
});

export const loadQuestionBank = () => questions.load();

/**
 * The question a session opens on: a random easy one, so the difficulty ramp
 * has somewhere to climb from.
 */
export function pickOpeningQuestion(bank: Question[]): Question {
  const openers = bank.filter((question) => question.d === 1);
  const pool = openers.length ? openers : bank;
  return pool[Math.floor(Math.random() * pool.length)];
}
