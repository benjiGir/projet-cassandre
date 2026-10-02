import type { ReactNode } from "react";

import { cx } from "../../../lib/styleHelpers";
import styles from "./HudCorner.module.css";

export interface HudCornerProps {
  position: "topRight" | "bottomLeft" | "bottomRight";
  children: ReactNode;
}

// see: docs/archive/systems-hud.md#composition-de-app
export function HudCorner({ position, children }: HudCornerProps) {
  return <div className={cx(styles.corner, styles[position])}>{children}</div>;
}
