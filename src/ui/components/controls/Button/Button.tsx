import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./Button.module.css";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: "default" | "primary" | "danger";
  size?: "default" | "large";
  /** Glyphe en colonne fixe devant le libellé, pour aligner une liste de boutons. */
  icon?: ReactNode;
}

/** Le bouton de l'interface. Sa couleur vient du ton de l'écran qui le contient. */
export function Button({ variant = "default", size = "default", icon, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={cx(styles.button, styles[variant], styles[size], className)} {...rest}>
      {icon !== undefined && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}
