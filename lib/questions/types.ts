import { requireObject, requireString } from "@/lib/dataset";

/** Difficulty ladder, mirroring the workbook: Easy, Medium, Hard, Expert. */
export type Difficulty = 1 | 2 | 3 | 4;

export const MAX_DIFFICULTY: Difficulty = 4;

export type Question = {
  /** Stable id from the trivia workbook. Also the share-link slug. */
  id: string;
  /** Question text, as shown on the paper card. */
  q: string;
  /** Answer text, as shown on the accent card. */
  a: string;
  d: Difficulty;
  /** e.g. "Players", "Nicknames", "College". */
  category: string;
  /** Fine-grained tag, e.g. "naismith-inventor". Unique per subject, not per row. */
  topic: string;
  /** Set on questions that come as a related pair in the workbook. */
  pairId?: string;
  /**
   * Optional alternate phrasing, used as the share title when the question does
   * not stand alone out of context. Not yet supplied by the workbook.
   */
  p?: string;
};

export type QuestionBank = {
  /** Changes whenever the bank changes; lets clients cheaply detect a refresh. */
  version: string;
  /** Where the bank came from — a workbook filename, an API host, etc. */
  source: string;
  questions: Question[];
};

/** Narrow unknown JSON (a remote response, say) to a QuestionBank. */
export function parseBank(value: unknown, source: string): QuestionBank {
  const bank = requireObject(value, source);
  if (!Array.isArray(bank.questions)) {
    throw new Error(`${source}: missing a "questions" array`);
  }

  const questions = bank.questions.map((entry, i) => {
    const raw = requireObject(entry, `${source}: question ${i}`);
    const d = Number(raw.d);
    if (!Number.isInteger(d) || d < 1 || d > MAX_DIFFICULTY) {
      throw new Error(`${source}: question ${i} has difficulty ${String(raw.d)}`);
    }
    const question: Question = {
      id: requireString(raw.id, source, `question ${i} id`),
      q: requireString(raw.q, source, `question ${i} q`),
      a: requireString(raw.a, source, `question ${i} a`),
      d: d as Difficulty,
      category: typeof raw.category === "string" ? raw.category : "",
      topic: typeof raw.topic === "string" ? raw.topic : "",
    };
    if (typeof raw.pairId === "string") question.pairId = raw.pairId;
    if (typeof raw.p === "string") question.p = raw.p;
    return question;
  });

  if (!questions.length) throw new Error(`${source}: bank is empty`);

  return {
    version: typeof bank.version === "string" ? bank.version : "unknown",
    source: typeof bank.source === "string" ? bank.source : source,
    questions,
  };
}
