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
  return (
    <div className={styles.tabs} role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={styles.tab}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
