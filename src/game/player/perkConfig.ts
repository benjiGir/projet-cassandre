// Ce que chaque perk change. Ces valeurs sont le barème : à l'achat elles sont
// recopiées sur les objets de la partie (`session/progression/perks.ts`), si
// bien qu'une nouvelle partie repart sans perk. Valeurs de départ, que le lot
// B7 de PLAN_SUITE.md règle.
export interface PerkConfig {
  /** Boisson : multiplicateur de la vitesse de marche et de course pendant la pointe. */
  boissonSpeedScale: number;
  /** Boisson : durée de la pointe après un kill, en secondes de jeu. Un nouveau kill la relance, sans cumul. */
  boissonDuration: number;
  /** VPN : part de `sightRange` à laquelle un Costard au repos repère encore le joueur. */
  vpnSightRangeScale: number;
  /** Gilet : PV ajoutés au maximum, et rendus à l'achat. */
  giletMaxHpBonus: number;
  /** Abonnement : munitions de pistolet ajoutées au plafond. */
  premiumPistolAmmoBonus: number;
  /** Perche : multiplicateur des dégâts du pied-de-biche. */
  percheMeleeDamageScale: number;
  /** Aimant : rayon des ramassages pris en marchant dessus, en mètres (1,2 m sans lui). */
  aimantPickupRadius: number;
}

export const perkConfig: PerkConfig = {
  // Départ = variante B ci-dessous. Le déplacement est validé : le choix
  // entre A, B et C appartient à l'utilisateur.
  boissonSpeedScale: 1.3,
  boissonDuration: 2.5,
  vpnSightRangeScale: 0.6,
  giletMaxHpBonus: 25,
  premiumPistolAmmoBonus: 50,
  percheMeleeDamageScale: 1.5,
  aimantPickupRadius: 3,
};

export type BoissonVariant = Pick<PerkConfig, "boissonSpeedScale" | "boissonDuration">;

// Harnais A/B de la pointe de vitesse — même mécanique que `FEEL_VARIANTS`
// (`movement/moveConfig.ts`) : `cassandre.applyBoissonVariant("A")`, ou le
// panneau de tuning.
export const BOISSON_VARIANTS: Record<"A" | "B" | "C", BoissonVariant> = {
  /** A — SOBRE : à peine plus vite, longtemps. La visée reste celle qu'on connaît. */
  A: { boissonSpeedScale: 1.15, boissonDuration: 3.5 },
  /** B — FRANCHE : la course passe de 13 à 17 m/s. Point de départ. */
  B: { boissonSpeedScale: 1.3, boissonDuration: 2.5 },
  /** C — NERVEUSE : un coup de fouet bref. Risque assumé : on dépasse sa cible. */
  C: { boissonSpeedScale: 1.5, boissonDuration: 1.5 },
};
