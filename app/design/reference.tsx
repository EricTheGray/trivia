import cell from "@/app/components/guess-player.module.css";
import styles from "./design.module.css";

/**
 * The pieces the screens are built from, pulled out where they can be compared.
 * These use the app's own stylesheets, so a change to a cell shows up here
 * rather than drifting out of date the way a redrawn swatch would.
 */

const COLOURS = [
  { name: "Paper", value: "#F4F1EA", note: "Ground" },
  { name: "Ink", value: "#16130E", note: "Text, rules, dark cards" },
  { name: "Accent", value: "#D9480F", note: "Answers, kickers, an exact match" },
  { name: "Cream", value: "#FFF6EE", note: "On ink and accent" },
];

const ALPHAS = [
  { name: "Secondary", value: "rgba(22,19,14,.5)" },
  { name: "Tertiary", value: "rgba(22,19,14,.45)" },
  { name: "Labels", value: "rgba(22,19,14,.35)" },
  { name: "Chrome", value: "rgba(22,19,14,.3)" },
  { name: "Dividers", value: "rgba(22,19,14,.12)" },
  { name: "Miss cell", value: "rgba(22,19,14,.05)" },
  { name: "Close cell", value: "rgba(217,72,15,.14)" },
];

const TYPE = [
  { name: "Feed answer", style: { fontSize: 54, fontWeight: 700, letterSpacing: "-.03em" } },
  { name: "Feed question", style: { fontSize: 42, fontWeight: 600, letterSpacing: "-.03em" } },
  { name: "Screen title", style: { fontSize: 36, fontWeight: 700, letterSpacing: "-.036em" } },
  { name: "Clock", style: { fontSize: 46, fontWeight: 700, letterSpacing: "-.04em" } },
  { name: "Row name", style: { fontSize: 16, fontWeight: 600, letterSpacing: "-.018em" } },
  { name: "Kicker", style: { fontSize: 11, fontWeight: 700, letterSpacing: ".2em" } },
];

export function Reference() {
  return (
    <div className={styles.reference}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Colour</h2>
        <div className={styles.swatches}>
          {COLOURS.map((colour) => (
            <div key={colour.name} className={styles.swatch}>
              <span className={styles.chip} style={{ background: colour.value }} />
              <span className={styles.swatchName}>{colour.name}</span>
              <span className={styles.swatchValue}>{colour.value}</span>
              <span className={styles.swatchNote}>{colour.note}</span>
            </div>
          ))}
        </div>
        <div className={styles.alphas}>
          {ALPHAS.map((alpha) => (
            <div key={alpha.name} className={styles.alpha}>
              <span className={styles.alphaChip} style={{ background: alpha.value }} />
              <span className={styles.alphaName}>{alpha.name}</span>
              <span className={styles.swatchValue}>{alpha.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Type</h2>
        <div className={styles.typeList}>
          {TYPE.map((entry) => (
            <div key={entry.name} className={styles.typeRow}>
              <span className={styles.typeName}>{entry.name}</span>
              <span style={{ ...entry.style, lineHeight: 1.05 }}>Hot Hand</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Clue cells</h2>
        <p className={styles.sectionNote}>
          The board&rsquo;s whole vocabulary. Accent answers &ldquo;did my guess match&rdquo;;
          the row on deck reuses it for what the guesses have settled.
        </p>
        <div className={styles.cells}>
          {[
            { label: "Exact", className: cell.hit, value: "1984" },
            { label: "Close", className: cell.close, value: "G-F" },
            { label: "Miss", className: cell.miss, value: "UNC" },
            { label: "Miss, lower", className: cell.miss, value: "#33", arrow: "↓" },
            { label: "Waiting", className: "", value: "" },
          ].map((sample) => (
            <div key={sample.label} className={styles.cellSample}>
              <div className={`${cell.clue} ${sample.className}`}>
                <span className={cell.clueValue}>{sample.value}</span>
                {sample.arrow && <span className={cell.arrow}>{sample.arrow}</span>}
              </div>
              <span className={styles.cellLabel}>{sample.label}</span>
            </div>
          ))}
        </div>
        <div className={styles.cells}>
          {[
            { label: "Column, unknown", node: <span className={cell.columnName}>Draft</span> },
            { label: "Range", node: <span className={cell.known}>1985–96</span> },
            { label: "Bound", node: <span className={cell.known}>M ↓</span> },
            { label: "Positions left", node: <span className={cell.positionSet}>G F C</span> },
          ].map((sample) => (
            <div key={sample.label} className={styles.cellSample}>
              <div className={cell.clue}>{sample.node}</div>
              <span className={styles.cellLabel}>{sample.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
