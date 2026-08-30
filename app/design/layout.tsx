import styles from "./design.module.css";

/**
 * The app is a fixed, unscrolling shell — `body` has `overflow: hidden` so the
 * feed can page. The canvas is a document, so it brings its own scroll.
 */
export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.scroller}>{children}</div>;
}
