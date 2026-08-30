import type { Metadata } from "next";
import { Canvas } from "./canvas";
import { Reference } from "./reference";

export const metadata: Metadata = {
  title: "Hot Hand — design canvas",
  robots: { index: false, follow: false },
};

/**
 * A canvas for working on the look of the app without leaving it: every screen
 * live at a chosen size, and the pieces they are built from underneath.
 */
export default function DesignPage() {
  return (
    <main>
      <Canvas />
      <Reference />
    </main>
  );
}
