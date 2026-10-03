import type { GameAction } from "./inputTypes";

// see: docs/6-reference/notes-code-core.md#entrées
export const DEFAULT_BINDINGS: Record<GameAction, string> = {
  moveForward: "KeyW",
  moveBack: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  sprint: "ShiftLeft",
  jump: "Space",
  fire: "Mouse0",
  switchMelee: "Digit1",
  switchPistol: "Digit2",
  switchShotgun: "Digit3",
  use: "KeyE",
};

export const ALL_ACTIONS: GameAction[] = Object.keys(DEFAULT_BINDINGS) as GameAction[];

export const ACTION_LABELS: Record<GameAction, string> = {
  moveForward: "Avancer",
  moveBack: "Reculer",
  moveLeft: "Aller à gauche",
  moveRight: "Aller à droite",
  sprint: "Sprint",
  jump: "Sauter",
  fire: "Tirer",
  switchMelee: "Arme : pied-de-biche",
  switchPistol: "Arme : pistolet",
  switchShotgun: "Arme : pompe",
  use: "Utiliser",
};

const CODE_LABELS: Record<string, string> = {
  Space: "Espace",
  ShiftLeft: "Maj (gauche)",
  ShiftRight: "Maj (droite)",
  ControlLeft: "Ctrl (gauche)",
  ControlRight: "Ctrl (droite)",
  AltLeft: "Alt (gauche)",
  AltRight: "Alt droite (AltGr)",
  Mouse0: "Clic gauche",
  Mouse2: "Clic droit",
};

export function formatKeyCode(code: string): string {
  const known = CODE_LABELS[code];
  if (known) return known;
  if (code.startsWith("Key")) return code.slice("Key".length);
  if (code.startsWith("Digit")) return code.slice("Digit".length);
  return code;
}
