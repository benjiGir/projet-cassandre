import styles from "./ZoneChooserLink.module.css";

export interface ZoneChooserLinkProps {
  onClick: () => void;
}

export function ZoneChooserLink({ onClick }: ZoneChooserLinkProps) {
  return (
    <button type="button" className={styles.link} onClick={onClick}>
      [ACCÈS TECHNICIEN] choisir une zone
    </button>
  );
}
