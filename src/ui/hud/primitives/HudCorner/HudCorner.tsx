import type { ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./HudCorner.module.css";

export interface HudCornerProps {
  position: "topRight" | "bottomLeft" | "bottomRight";
  children: ReactNode;
}

/**
 * Un coin du calque en jeu. Ses enfants s'y empilent dans le flux : un bloc
 * suit la hauteur réelle du précédent, jamais une position devinée.
 * see: docs/systems/hud.md#composition-de-app
 */
export function HudCorner({ position, children }: HudCornerProps) {
  return <div className={cx(styles.corner, styles[position])}>{children}</div>;
}
