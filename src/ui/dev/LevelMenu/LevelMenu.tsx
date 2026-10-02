import styles from "./LevelMenu.module.css";

export interface LevelMenuOption {
  id: string;
  label: string;
}

export interface LevelMenuProps {
  options: readonly LevelMenuOption[];
  onChoose: (id: string) => void;
  title?: string;
}

// see: docs/archive/systems-hud.md#menu-principal-et-écran-de-choix-de-niveau
export function LevelMenu({ options, onChoose, title = "PROJET_CASSANDRE" }: LevelMenuProps) {
  return (
    <div className={styles.menu}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.options}>
        {options.map((option) => (
          <button key={option.id} type="button" className={styles.option} onClick={() => onChoose(option.id)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
