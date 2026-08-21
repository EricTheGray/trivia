import bundled from "@/data/game-modes.json";
import { createDataset } from "@/lib/dataset";
import { parseModeCatalog, type ModeCatalog } from "./types";

export * from "./types";

/**
 * The six timed rounds: `data/game-modes.json`, or the endpoint in
 * `MODES_API_URL` when one is set.
 */
const catalog = createDataset<ModeCatalog>({
  name: "game-modes",
  urlEnv: "MODES_API_URL",
  tokenEnv: "MODES_API_TOKEN",
  bundled,
  parse: parseModeCatalog,
});

export const loadModeCatalog = () => catalog.load();
