import bundled from "@/data/guess-players.json";
import { createDataset } from "@/lib/dataset";
import { parseGuessPool, type GuessPool } from "./types";

export * from "./types";
export * from "./compare";

/**
 * The Guess the Player answer pool: `data/guess-players.json`, or the endpoint
 * in `GUESS_API_URL` when one is set.
 */
const pool = createDataset<GuessPool>({
  name: "guess-players",
  urlEnv: "GUESS_API_URL",
  tokenEnv: "GUESS_API_TOKEN",
  bundled,
  parse: parseGuessPool,
});

export const loadGuessPool = () => pool.load();
