"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a software keyboard is covering the viewport.
 *
 * There is no keyboard API, so this reads the gap between the visual viewport
 * and the layout viewport, which is what a keyboard opens up. Desktop browsers
 * never show a gap this large, so they always read false.
 */

/** Smaller gaps are browser chrome — an address bar collapsing, say. */
const KEYBOARD_GAP = 140;

let open = false;

function read(): boolean {
  const viewport = window.visualViewport;
  if (!viewport) return false;
  open = window.innerHeight - viewport.height > KEYBOARD_GAP;
  return open;
}

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  viewport.addEventListener("resize", onChange);
  viewport.addEventListener("scroll", onChange);
  return () => {
    viewport.removeEventListener("resize", onChange);
    viewport.removeEventListener("scroll", onChange);
  };
}

export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
