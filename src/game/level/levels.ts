/**
 * Registre de niveaux — remplace le hardcode qui vivait dans `main.ts`.
 * see: docs/game/niveau-hypermarche.md
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

// Rôle de chaque zone, pourquoi armée/désarmée, note Zone D (pathfinding) :
// see: docs/game/niveau-hypermarche.md
export const LEVEL_CHOICES: LevelDef[] = [
  { id: "gym", label: "Gym (test)", kind: "gym" },
  { id: "zone_a_parking", label: "Zone A — Parking", kind: "gltf", gltfName: "zone_a_parking", startUnarmed: true },
  { id: "zone_b_caisses", label: "Zone B — Caisses", kind: "gltf", gltfName: "zone_b_caisses" },
  { id: "zone_c_rayons", label: "Zone C — Rayons", kind: "gltf", gltfName: "zone_c_rayons" },
  { id: "zone_d_reserve", label: "Zone D — Réserve", kind: "gltf", gltfName: "zone_d_reserve" },
  { id: "zone_e_bureau", label: "Zone E — Bureau", kind: "gltf", gltfName: "zone_e_bureau" },
  // Niveau complet : les 5 zones individuelles ci-dessus restent disponibles pour du test ciblé.
  {
    id: "hypermarche_complet",
    label: "Niveau complet — L'Hypermarché",
    kind: "gltf",
    gltfName: "hypermarche_complet",
    startUnarmed: true,
  },
];
