/**
 * Registre de niveaux — remplace le hardcode `levelParam === "zone_a_parking"`
 * qui vivait dans `main.ts` (dette explicitement documentée dans CLAUDE.md,
 * Phase 5 Zone A : « À REMPLACER par une vraie métadonnée de niveau le jour
 * où une deuxième zone à loadout différent existera »).
 *
 * Forme volontairement minimale (invariant retro-fps : élégance du code en
 * dernier) — pas de spawn points génériques, pas de loadout complexe, juste
 * ce qui est réellement consommé par `main.ts` aujourd'hui : quel builder
 * appeler (`gym.ts` vs pipeline glTF), quel fichier `.glb` charger, et si le
 * joueur démarre désarmé. Ajouter une 3e/4e zone = une ligne dans
 * `LEVEL_CHOICES`, sans toucher au menu (`src/ui/LevelMenu.tsx`) ni à l'ordre
 * de boot dans `main.ts`.
 */

export interface LevelDef {
  /** Identifiant stable. Sert aussi de valeur pour le raccourci `?level=<id>` et de clé du registre. */
  id: string;
  /** Libellé affiché dans le menu de choix de niveau. */
  label: string;
  /** "gym" = boîte blanche construite à la main (gym.ts). "gltf" = pipeline glTF (loader.ts/hotReload.ts). */
  kind: "gym" | "gltf";
  /** Nom de fichier sous public/assets/levels/<gltfName>.glb, sans extension. Uniquement pour kind === "gltf". */
  gltfName?: string;
  /** Le joueur démarre désarmé (pied-de-biche au sol, ramassable via use_crowbar) — voir WeaponSystem.startUnarmed()/pickUpMelee(). */
  startUnarmed?: boolean;
}

export const LEVEL_CHOICES: LevelDef[] = [
  { id: "gym", label: "Gym (test)", kind: "gym" },
  { id: "zone_a_parking", label: "Zone A — Parking", kind: "gltf", gltfName: "zone_a_parking", startUnarmed: true },
  // Premier combat réel du niveau (Costards à portée dès l'entrée, contre le
  // Costard scellé hors `attackRange` de la Zone A) — démarre ARMÉE, pas de
  // `startUnarmed` : le pied-de-biche/pompe sont déjà acquis en Zone A.
  { id: "zone_b_caisses", label: "Zone B — Caisses", kind: "gltf", gltfName: "zone_b_caisses" },
  // Combat en couloirs entre les rangées de gondoles (embuscades latérales
  // dès qu'une ligne de vue s'ouvre dans une allée) — démarre ARMÉE, même
  // logique que la Zone B : le pied-de-biche/pompe sont déjà acquis avant.
  { id: "zone_c_rayons", label: "Zone C — Rayons", kind: "gltf", gltfName: "zone_c_rayons" },
  // Verticalité (mezzanine + escalier) — traversée joueur uniquement, aucun
  // spawn_suit_* dessus : suit.ts::runChase n'a pas de vrai pathfinding
  // (3 rayons d'évitement local), un Costard là-haut resterait bloqué
  // contre la rambarde. Démarre ARMÉE, même logique que B/C.
  { id: "zone_d_reserve", label: "Zone D — Réserve", kind: "gltf", gltfName: "zone_d_reserve" },
];
