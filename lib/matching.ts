/**
 * Name matching for typed answers: the autocomplete list, and grading whatever
 * ends up in the field. Used for both pools a round can draw on — the player
 * roster and the team list.
 *
 * Names are stored the way they are spelled — Nikola Jokić, Luka Dončić — and
 * normalised only for comparison, so someone typing "jokic" still matches.
 */

/** Nickname to canonical name, e.g. `sga` or `dubs`. Keys are normalised. */
export type Aliases = Record<string, string>;

/**
 * A pool member. Terms are extra things to match on that are not in the name
 * itself — a team's city when the franchise is not named for it ("San
 * Francisco" for the Warriors), or its tri-code. They are searchable and can
 * settle a match, but never displayed.
 */
export type PoolEntry = string | { name: string; terms?: string[] };

/** Suggestions appear once the query is this long. */
export const MIN_QUERY_LENGTH = 3;

/** How many suggestions the sheet shows. */
export const MAX_SUGGESTIONS = 6;

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

/**
 * Unicode NFD, combining marks stripped, lowercased, punctuation removed,
 * whitespace collapsed. `Jokić`, `Jokic` and `jokic` all land in the same
 * place, as do `Jaren Jackson Jr` and `jaren jackson jr.`.
 */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The word people are most likely to type on its own: a player's surname, a
 * team's nickname. Generational suffixes are ignored.
 */
export function lastWordOf(value: string): string {
  const parts = normalizeName(value)
    .split(" ")
    .filter((part) => !SUFFIXES.has(part));
  return parts[parts.length - 1] ?? "";
}


type Entry = {
  name: string;
  normalized: string;
  /** Every word of the name and of its terms, for prefix matching. */
  words: string[];
  /** Whole normalised terms, for multi-word queries like "salt lake city". */
  terms: string[];
  lastWord: string;
};

export type NameIndex = {
  /**
   * Ranked suggestions for a partial query. Empty until the query reaches
   * `minLength`, which defaults to MIN_QUERY_LENGTH.
   */
  search(query: string, limit?: number, minLength?: number): string[];
  /**
   * The player a typed string means, or null. Callers commit the raw text when
   * this returns null — a wrong guess should be a wrong guess, not a dead end.
   */
  resolve(raw: string): string | null;
};

/**
 * Builds the match pool: the broad roster plus this round's own answers, so the
 * suggestions never narrow down to the answer key. Roster order carries the
 * ranking (most recently active first) and is preserved.
 */
export function createNameIndex(
  roster: PoolEntry[],
  { answers = [], aliases = {} }: { answers?: string[]; aliases?: Aliases } = {},
): NameIndex {
  const entries: Entry[] = [];
  const byNormalized = new Map<string, Entry>();

  for (const item of [...roster, ...answers]) {
    const name = typeof item === "string" ? item : item.name;
    const normalized = normalizeName(name);
    if (!normalized || byNormalized.has(normalized)) continue;
    const terms = (typeof item === "string" ? [] : (item.terms ?? []))
      .map(normalizeName)
      .filter(Boolean);
    const entry: Entry = {
      name,
      normalized,
      words: [...normalized.split(" "), ...terms.flatMap((term) => term.split(" "))],
      terms,
      lastWord: lastWordOf(name),
    };
    entries.push(entry);
    byNormalized.set(normalized, entry);
  }

  // Deduped: a mode whose answer list repeats a name (three Jokić MVPs) must
  // still count that name once when breaking a surname tie.
  const answerEntries = [
    ...new Map(
      answers
        .map((answer) => byNormalized.get(normalizeName(answer)))
        .filter((entry): entry is Entry => Boolean(entry))
        .map((entry) => [entry.normalized, entry] as const),
    ).values(),
  ];

  const uniqueByLastWord = (pool: Entry[], word: string) => {
    const hits = pool.filter((entry) => entry.lastWord === word);
    return hits.length === 1 ? hits[0].name : null;
  };

  return {
    search(query, limit = MAX_SUGGESTIONS, minLength = MIN_QUERY_LENGTH) {
      const q = normalizeName(query);
      if (q.length < minLength) return [];

      // Nicknames first: typing "sga" should show Shai, not an empty list.
      const viaAlias: string[] = [];
      for (const [nickname, full] of Object.entries(aliases)) {
        if (!nickname.startsWith(q)) continue;
        const name = byNormalized.get(normalizeName(full))?.name;
        if (name && !viaAlias.includes(name)) viaAlias.push(name);
      }

      // Then surnames and nicknames, since that is what people type, then any
      // other word starting with the query, then the query appearing mid-name.
      // Within each tier the roster's own order survives.
      const byLastWord: string[] = [];
      const byWord: string[] = [];
      const contains: string[] = [];
      for (const entry of entries) {
        if (entry.lastWord.startsWith(q)) byLastWord.push(entry.name);
        else if (
          entry.words.some((word) => word.startsWith(q)) ||
          entry.terms.some((term) => term.startsWith(q))
        ) {
          byWord.push(entry.name);
        } else if (entry.normalized.includes(q)) contains.push(entry.name);
        if (byLastWord.length >= limit) break;
      }
      const ranked = [...viaAlias, ...byLastWord, ...byWord, ...contains];
      return [...new Set(ranked)].slice(0, limit);
    },

    resolve(raw) {
      const q = normalizeName(raw);
      if (!q) return null;

      const alias = aliases[q];
      if (alias) {
        // Prefer the pool's spelling of the name the alias points at.
        return byNormalized.get(normalizeName(alias))?.name ?? alias;
      }

      const exact = byNormalized.get(q);
      if (exact) return exact.name;

      // A surname or nickname on its own is enough when only one entry has it…
      const unique = uniqueByLastWord(entries, q);
      if (unique) return unique;

      // …as is a term like "salt lake city", but only when nothing else in the
      // pool answers to it. "los angeles" names one team and is a term of
      // another, so it stays ambiguous and both stay in the suggestions.
      const named = entries.filter((entry) => entry.normalized.includes(q));
      const termed = entries.filter((entry) => entry.terms.includes(q));
      const candidates = [...new Set([...named, ...termed])];
      if (candidates.length === 1) return candidates[0].name;

      // …and when several share it, this round's own answers break the tie.
      return uniqueByLastWord(answerEntries, q);
    },
  };
}

/** Whether a committed answer counts, ignoring accents and punctuation. */
export function answersMatch(given: string, expected: string): boolean {
  return normalizeName(given) === normalizeName(expected);
}
