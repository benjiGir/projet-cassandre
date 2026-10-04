// La difficulté : trois niveaux choisis au lancement de la partie. Elle règle
// les PV et les dégâts des ennemis, la taille des groupes que le script de
// niveau réveille, et la générosité des dons. Elle se pose sur la partie à sa
// construction, jamais sur une config globale : « Rejouer » garde la même.

export type Difficulty = "client" | "habitue" | "lanceur";

/** Du plus doux au plus dur : l'ordre de l'écran de choix. */
export const DIFFICULTIES: readonly Difficulty[] = ["client", "habitue", "lanceur"];

export const DEFAULT_DIFFICULTY: Difficulty = "habitue";

export interface DifficultyRules {
  /** Multiplicateur des PV de tous les ennemis, Directeur compris. */
  enemyHp: number;
  /** Multiplicateur des dégâts infligés au joueur. */
  enemyDamage: number;
  /** Part d'un groupe `groupe` qui apparaît à son réveil : un groupe se pose dans Blender à sa taille la plus dure. */
  groupShare: number;
  /** Multiplicateur de la probabilité qu'un spectateur donne. Les dons du donateur mystère n'en dépendent pas. */
  donations: number;
}

// Valeurs de départ, à régler en playtest (lot B7 de PLAN_SUITE.md).
export const difficultyConfig: Record<Difficulty, DifficultyRules> = {
  client: { enemyHp: 0.75, enemyDamage: 0.6, groupShare: 0.5, donations: 1.4 },
  habitue: { enemyHp: 1, enemyDamage: 1, groupShare: 0.75, donations: 1 },
  // 65 PV : le Costard ne tombe plus d'un seul coup de pompe à bout portant (54).
  lanceur: { enemyHp: 1.3, enemyDamage: 1.5, groupShare: 1, donations: 0.7 },
};

export const DIFFICULTY_INFO: Record<Difficulty, { readonly label: string; readonly pitch: string }> = {
  client: { label: "Client", pitch: "Vous venez pour les promos. Le magasin vous ménage." },
  habitue: { label: "Habitué", pitch: "Vous connaissez les rayons. Eux aussi vous connaissent." },
  lanceur: { label: "Lanceur d'alerte", pitch: "Vous savez. Ils savent que vous savez." },
};

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.some((difficulty) => difficulty === value);
}

/** Nombre d'ennemis d'un groupe de `total` qui apparaissent à son réveil : jamais zéro, jamais plus que le groupe. */
export function wokenGroupSize(total: number, share: number): number {
  if (total <= 0) return 0;
  return Math.max(1, Math.min(total, Math.round(total * share)));
}

export interface DifficultyEffect {
  readonly label: string;
  readonly value: string;
}

function relative(scale: number): string {
  const percent = Math.round((scale - 1) * 100);
  if (percent === 0) return "normal";
  return percent > 0 ? `+${percent} %` : `−${-percent} %`;
}

/** Ce qu'une difficulté change, en clair, pour l'écran de choix. */
export function difficultyEffects(rules: DifficultyRules): DifficultyEffect[] {
  return [
    { label: "PV des ennemis", value: relative(rules.enemyHp) },
    { label: "Dégâts reçus", value: relative(rules.enemyDamage) },
    { label: "Renforts", value: `${Math.round(rules.groupShare * 100)} %` },
    { label: "Dons du chat", value: relative(rules.donations) },
  ];
}
