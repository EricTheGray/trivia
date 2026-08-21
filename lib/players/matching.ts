/**
 * Name matching for typed answers: the autocomplete list, and grading whatever
 * ends up in the field.
 *
 * Names are stored the way they are spelled — Nikola Jokić, Luka Dončić — and
 * normalised only for comparison, so someone typing "jokic" still matches.
 */

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

/** Last name, ignoring generational suffixes. */
export function surnameOf(value: string): string {
  const parts = normalizeName(value)
    .split(" ")
    .filter((part) => !SUFFIXES.has(part));
  return parts[parts.length - 1] ?? "";
}

/** What people actually type. Values are matched against the pool's spelling. */
export const ALIASES: Record<string, string> = {
  giannis: "Giannis Antetokounmpo",
  "greek freak": "Giannis Antetokounmpo",
  steph: "Stephen Curry",
  "steph curry": "Stephen Curry",
  "chef curry": "Stephen Curry",
  bron: "LeBron James",
  lebron: "LeBron James",
  "king james": "LeBron James",
  kd: "Kevin Durant",
  durantula: "Kevin Durant",
  sga: "Shai Gilgeous-Alexander",
  shai: "Shai Gilgeous-Alexander",
  joker: "Nikola Jokic",
  jokic: "Nikola Jokic",
  "nikola jokic": "Nikola Jokic",
  "the process": "Joel Embiid",
  jojo: "Joel Embiid",
  russ: "Russell Westbrook",
  westbrick: "Russell Westbrook",
  wemby: "Victor Wembanyama",
  luka: "Luka Doncic",
  "luka doncic": "Luka Doncic",
  dame: "Damian Lillard",
  kawhi: "Kawhi Leonard",
  "the beard": "James Harden",
  zion: "Zion Williamson",
  melo: "LaMelo Ball",
  kat: "Karl-Anthony Towns",
  jjj: "Jaren Jackson Jr.",
  gobert: "Rudy Gobert",
  dray: "Draymond Green",
  "sweet lou": "Lou Williams",
  mcw: "Michael Carter-Williams",
  "d rose": "Derrick Rose",
};

type Entry = {
  name: string;
  normalized: string;
  words: string[];
  surname: string;
};

export type NameIndex = {
  /** Ranked suggestions for a partial query. Empty below MIN_QUERY_LENGTH. */
  search(query: string, limit?: number): string[];
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
export function createNameIndex(roster: string[], answers: string[] = []): NameIndex {
  const entries: Entry[] = [];
  const byNormalized = new Map<string, Entry>();

  for (const name of [...roster, ...answers]) {
    const normalized = normalizeName(name);
    if (!normalized || byNormalized.has(normalized)) continue;
    const entry: Entry = {
      name,
      normalized,
      words: normalized.split(" "),
      surname: surnameOf(name),
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

  const uniqueBySurname = (pool: Entry[], surname: string) => {
    const hits = pool.filter((entry) => entry.surname === surname);
    return hits.length === 1 ? hits[0].name : null;
  };

  return {
    search(query, limit = MAX_SUGGESTIONS) {
      const q = normalizeName(query);
      if (q.length < MIN_QUERY_LENGTH) return [];

      // Nicknames first: typing "sga" should show Shai, not an empty list.
      const viaAlias: string[] = [];
      for (const [nickname, player] of Object.entries(ALIASES)) {
        if (!nickname.startsWith(q)) continue;
        const name = byNormalized.get(normalizeName(player))?.name;
        if (name && !viaAlias.includes(name)) viaAlias.push(name);
      }

      // Then surnames, since that is what people type, then any other word that
      // starts with the query, then the query appearing mid-name. Within each
      // tier the roster's own order (most recently active first) survives.
      const bySurname: string[] = [];
      const byWord: string[] = [];
      const contains: string[] = [];
      for (const entry of entries) {
        if (entry.surname.startsWith(q)) bySurname.push(entry.name);
        else if (entry.words.some((word) => word.startsWith(q))) byWord.push(entry.name);
        else if (entry.normalized.includes(q)) contains.push(entry.name);
        if (bySurname.length >= limit) break;
      }
      const ranked = [...viaAlias, ...bySurname, ...byWord, ...contains];
      return [...new Set(ranked)].slice(0, limit);
    },

    resolve(raw) {
      const q = normalizeName(raw);
      if (!q) return null;

      const alias = ALIASES[q];
      if (alias) {
        // Prefer the pool's spelling of the name the alias points at.
        return byNormalized.get(normalizeName(alias))?.name ?? alias;
      }

      const exact = byNormalized.get(q);
      if (exact) return exact.name;

      // A surname on its own is enough when only one player answers to it…
      const bySurname = uniqueBySurname(entries, q);
      if (bySurname) return bySurname;

      // …and when several do, this round's own answers break the tie.
      return uniqueBySurname(answerEntries, q);
    },
  };
}

/** Whether a committed answer counts, ignoring accents and punctuation. */
export function answersMatch(given: string, expected: string): boolean {
  return normalizeName(given) === normalizeName(expected);
}
