import type { KeyboardEvent } from "react";

import styles from "./OptionsTabs.module.css";

export type OptionsTab = "controles" | "affichage";

const TABS: ReadonlyArray<{ id: OptionsTab; label: string }> = [
  { id: "controles", label: "CONTRÔLES" },
  { id: "affichage", label: "AFFICHAGE" },
];

export interface OptionsTabsProps {
  value: OptionsTab;
  onChange: (tab: OptionsTab) => void;
}

/** Les onglets de l'écran d'options. */
export function OptionsTabs({ value, onChange }: OptionsTabsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = TABS.findIndex((tab) => tab.id === value);
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight": nextIndex = (currentIndex + 1) % TABS.length; break;
      case "ArrowLeft": nextIndex = (currentIndex - 1 + TABS.length) % TABS.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = TABS.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const next = TABS[nextIndex]!;
    onChange(next.id);
    document.getElementById(`options-tab-${next.id}`)?.focus();
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label="Catégories de paramètres" onKeyDown={handleKeyDown}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          id={`options-tab-${tab.id}`}
          role="tab"
          aria-selected={value === tab.id}
          aria-controls={`options-panel-${tab.id}`}
          tabIndex={value === tab.id ? 0 : -1}
          className={styles.tab}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
