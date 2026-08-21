import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadQuestionBank } from "@/lib/questions";
import styles from "./question.module.css";

/**
 * A single shared question. The answer never appears here — a shared link gives
 * someone the question and nothing else.
 */
async function findQuestion(id: string) {
  const { questions } = await loadQuestionBank();
  return questions.find((question) => question.id === id);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const question = await findQuestion((await params).id);
  if (!question) return { title: "Hot Hand" };
  const title = question.p ?? question.q;
  return {
    title,
    description: "Basketball trivia, one question at a time.",
    openGraph: { title, description: "Tap to play Hot Hand." },
  };
}

export default async function SharedQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const question = await findQuestion((await params).id);
  if (!question) notFound();

  return (
    <main className={styles.screen}>
      <div className={styles.chrome}>
        <span className={styles.kicker}>HOT HAND</span>
        <span className={styles.kicker}>SHARED QUESTION</span>
      </div>

      <h1 className={`${styles.question} ${question.q.length > 85 ? styles.long : ""}`}>
        {question.q}
      </h1>

      <div className={styles.footer}>
        <span className={styles.note}>The answer is in the feed.</span>
        <Link href="/" className={styles.pill}>
          Open the feed
        </Link>
      </div>
    </main>
  );
}
