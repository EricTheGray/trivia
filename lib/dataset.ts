/**
 * Every dataset the app reads — questions, game modes, the player roster —
 * ships as a JSON file under `data/` and can be moved to a remote repository by
 * setting one environment variable. This is the machinery behind that swap.
 */

export const REVALIDATE_SECONDS = 3600;

export type Loaded<T> = T & {
  /** Which source answered — "local (fallback)" after a remote fetch failed. */
  loadedFrom: string;
};

type DatasetOptions<T> = {
  /** Used in log lines, e.g. "questions". */
  name: string;
  /** Environment variable holding the remote endpoint, if there is one. */
  urlEnv: string;
  /** Environment variable holding a bearer token for that endpoint. */
  tokenEnv?: string;
  /** The copy committed under `data/`. */
  bundled: unknown;
  /** Validates either source's payload before anything downstream sees it. */
  parse: (value: unknown, source: string) => T;
};

export type Dataset<T extends object> = {
  load(): Promise<Loaded<T>>;
};

export function createDataset<T extends object>(options: DatasetOptions<T>): Dataset<T> {
  const loadBundled = (loadedFrom: string): Loaded<T> => ({
    ...options.parse(options.bundled, "local"),
    loadedFrom,
  });

  return {
    async load() {
      const url = process.env[options.urlEnv];
      if (!url) return loadBundled("local");

      const label = `remote(${safeHost(url)})`;
      try {
        const token = options.tokenEnv ? process.env[options.tokenEnv] : undefined;
        const response = await fetch(url, {
          headers: token ? { authorization: `Bearer ${token}` } : undefined,
          // These change on a refresh cycle, not per request.
          next: { revalidate: REVALIDATE_SECONDS },
        });
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return { ...options.parse(await response.json(), "remote"), loadedFrom: label };
      } catch (error) {
        // Slightly stale content beats no content.
        console.error(`[${options.name}] ${label} failed, falling back to local:`, error);
        return loadBundled("local (fallback)");
      }
    },
  };
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

/** Shared validation helpers for the `parse` implementations. */
export function requireObject(value: unknown, source: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${source}: expected an object, got ${typeof value}`);
  }
  return value as Record<string, unknown>;
}

export function requireString(value: unknown, source: string, field: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`${source}: missing "${field}"`);
  }
  return value;
}

/**
 * Validates a dataset that is just a list of names under `field` — the player
 * roster and the team list both have this shape.
 */
export function parseNameList(value: unknown, source: string, field: string) {
  const payload = requireObject(value, source);
  const raw = payload[field];
  if (!Array.isArray(raw)) {
    throw new Error(`${source}: missing a "${field}" array`);
  }
  const names = raw.filter((name): name is string => typeof name === "string" && name.length > 0);
  if (!names.length) throw new Error(`${source}: ${field} list is empty`);

  return {
    version: typeof payload.version === "string" ? payload.version : "unknown",
    source: typeof payload.source === "string" ? payload.source : source,
    names,
  };
}
