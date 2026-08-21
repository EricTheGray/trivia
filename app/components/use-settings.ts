"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "hot-hand.settings";

export type Settings = {
  difficultyRamp: boolean;
  haptics: boolean;
};

const DEFAULTS: Settings = { difficultyRamp: true, haptics: true };

/**
 * The settings toggles, persisted per device.
 *
 * localStorage is an external store, so it is read through
 * `useSyncExternalStore`: the server and the hydration pass see the defaults,
 * and the stored values arrive in the render right after. `snapshot` is cached
 * so repeat reads stay referentially stable.
 */
let snapshot: Settings = DEFAULTS;
let snapshotRaw: string | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(KEY);
  } catch {
    // A blocked store just means defaults.
  }
  if (stored !== snapshotRaw) {
    snapshotRaw = stored;
    try {
      snapshot = stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
    } catch {
      snapshot = DEFAULTS;
    }
  }
  return snapshot;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keep other tabs of the app in step.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, read, () => DEFAULTS);

  const update = useCallback((patch: Partial<Settings>) => {
    const next = { ...read(), ...patch };
    const serialized = JSON.stringify(next);
    try {
      window.localStorage.setItem(KEY, serialized);
    } catch {
      // Preferences that cannot persist still apply for this session.
    }
    snapshot = next;
    snapshotRaw = serialized;
    for (const listener of listeners) listener();
  }, []);

  return [settings, update] as const;
}
