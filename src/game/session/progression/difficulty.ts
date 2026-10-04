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

/**
 * Les spawns d'un groupe qui apparaissent à son réveil : les premiers par
 * ordre de nom, pour que le niveau décide de ceux qui restent en difficulté
 * basse (`spawn_suit_arene_1` avant `spawn_suit_arene_2`). Comparaison par
 * code de caractère, sans locale : le même ordre sur toutes les machines.
 */
export function wokenSpawns<T extends { readonly name: string; readonly group: string | null }>(
  spawns: readonly T[],
  groupe: string,
  share: number,
): T[] {
  const group = spawns
    .filter((spawn) => spawn.group === groupe)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return group.slice(0, wokenGroupSize(group.length, share));
}
