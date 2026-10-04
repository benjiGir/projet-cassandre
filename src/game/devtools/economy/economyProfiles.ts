import type { Perk } from "../../player/perks";
import type { MysteryBeat } from "../../session/stream/streamTexts";

// Les données du relevé d'économie (`economySim.ts`) : le parcours du niveau
// vu comme une suite d'étapes, et les trois profils de joueur. Ce sont des
// hypothèses écrites à la main, à tenir à jour quand le niveau change.

/** Une étape du parcours, dans l'ordre où le joueur la traverse. */
export interface Stop {
  readonly id: string;
  /** Ennemis présents au chargement. */
  readonly kills: number;
  /** Groupes réveillés par le script, à leur taille la plus dure. */
  readonly groups?: readonly number[];
  /** Annonces des haut-parleurs ou de l'interphone (évènement `moment`). */
  readonly moments?: number;
  /** Détour : seuls certains profils y passent. */
  readonly detour?: boolean;
  readonly kiosk?: Perk;
  readonly beat?: MysteryBeat;
  /** Une carte de fidélité s'y ramasse. */
  readonly card?: boolean;
  /** Le Directeur y meurt. */
  readonly boss?: boolean;
  readonly secrets?: number;
  /** Étape facultative même sur le chemin (le quai de la réserve) : le profil dit s'il y va. */
  readonly optional?: boolean;
}

// Relevé du niveau v2 au 2026-10-04 (après le lot B6). Les six bornes sont sur
// le chemin obligé ; celle du couloir du personnel se retrouve au retour du parking.
export const PARCOURS: readonly Stop[] = [
  { id: "parking", kills: 2, beat: "depart" },
  { id: "galerie", kills: 3, kiosk: "perche" },
  { id: "cafeteria", kills: 2, detour: true, secrets: 2 },
  { id: "caisses", kills: 4, moments: 2, kiosk: "vpn" },
  { id: "hub", kills: 2 },
  { id: "rayons", kills: 6, card: true, beat: "carte_argent", secrets: 1 },
  { id: "electro", kills: 5, detour: true },
  { id: "labo", kills: 4, detour: true },
  { id: "hub_nord", kills: 0, kiosk: "aimant" },
  { id: "reserve_entree", kills: 2, kiosk: "premium" },
  { id: "reserve_arene", kills: 0, groups: [4, 4], moments: 3 },
  { id: "quai", kills: 0, beat: "quai", optional: true },
  { id: "personnel", kills: 0, kiosk: "boisson" },
  { id: "coulisses", kills: 5, detour: true, secrets: 1 },
  { id: "souterrain", kills: 2, groups: [2, 4], card: true, beat: "carte_or" },
  { id: "personnel_retour", kills: 0, groups: [1], moments: 1, kiosk: "boisson" },
  { id: "escalier", kills: 0, moments: 2, beat: "escalier" },
  { id: "bureaux", kills: 3, kiosk: "gilet" },
  { id: "direction", kills: 0, boss: true },
];

export interface PlayProfile {
  readonly label: string;
  /** Part des ennemis du chemin que le joueur tue. */
  readonly killShare: number;
  readonly detours: readonly string[];
  readonly secrets: number;
  /** Secondes entre deux kills d'un même combat, en moyenne. */
  readonly killInterval: number;
  /** Secondes de marche entre deux étapes. */
  readonly travel: number;
  /** Casses et coups reçus par étape de combat. */
  readonly breaks: number;
  readonly hits: number;
  readonly quai: boolean;
  readonly toilettes: boolean;
}

export const PROFILES = {
  presse: {
    label: "Pressé",
    killShare: 0.55, detours: [], secrets: 0, killInterval: 2.5, travel: 14, breaks: 0, hits: 2, quai: false, toilettes: false,
  },
  normal: {
    label: "Normal",
    killShare: 0.85, detours: ["cafeteria", "coulisses"], secrets: 1, killInterval: 3.5, travel: 20, breaks: 2, hits: 2,
    quai: true, toilettes: true,
  },
  completiste: {
    label: "Complétiste",
    killShare: 1, detours: ["cafeteria", "electro", "labo", "coulisses"], secrets: 4, killInterval: 4.5, travel: 28,
    breaks: 5, hits: 3, quai: true, toilettes: true,
  },
} as const satisfies Record<string, PlayProfile>;

export type ProfileId = keyof typeof PROFILES;
