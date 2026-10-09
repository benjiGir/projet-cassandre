import type { DifficultyEffectView, DifficultyOptionView } from "../../hud/hudTypes";
import { recordFor } from "../../settings/records";
import { DIFFICULTIES, DIFFICULTY_INFO, difficultyConfig, type DifficultyRules } from "../progression/difficulty";

// Ce que l'écran de choix montre de chaque difficulté : ses règles dites en
// clair, et le record du joueur. Les règles elles-mêmes sont dans
// `progression/difficulty.ts`.

function relative(scale: number): string {
  const percent = Math.round((scale - 1) * 100);
  if (percent === 0) return "normal";
  return percent > 0 ? `+${percent} %` : `−${-percent} %`;
}

/** Ce qu'une difficulté change, en clair. */
export function difficultyEffects(rules: DifficultyRules): DifficultyEffectView[] {
  return [
    { label: "PV des ennemis", value: relative(rules.enemyHp) },
    { label: "Dégâts reçus", value: relative(rules.enemyDamage) },
    { label: "Renforts", value: `${Math.round(rules.groupShare * 100)} %` },
    { label: "Dons du chat", value: relative(rules.donations) },
  ];
}

/** Les trois difficultés telles que l'écran de choix les montre, avec le record de `levelId` dans chacune. */
export function difficultyOptions(levelId: string): DifficultyOptionView[] {
  return DIFFICULTIES.map((id) => ({
    id,
    ...DIFFICULTY_INFO[id],
    ...(levelId === "metro" ? { pitch: id === "client" ? "Vous prenez le dernier métro. Le réseau vous ménage."
      : id === "habitue" ? "Vous connaissez les quais. Eux aussi vous connaissent." : DIFFICULTY_INFO[id].pitch } : {}),
    effects: difficultyEffects(difficultyConfig[id]),
    record: recordFor(levelId, id),
  }));
}
