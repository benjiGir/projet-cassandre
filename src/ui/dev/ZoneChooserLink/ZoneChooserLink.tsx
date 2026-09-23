import styles from "./ZoneChooserLink.module.css";

export interface ZoneChooserLinkProps {
  onClick: () => void;
}

/** Lien discret du menu principal vers le choix de zone, DEV UNIQUEMENT. */
export function ZoneChooserLink({ onClick }: ZoneChooserLinkProps) {
  return (
    <button type="button" className={styles.link} onClick={onClick}>
      [ACCÈS TECHNICIEN] choisir une zone
    </button>
  );
}
