import type * as THREE from "three";

// Contrat et réglages du gore — voir `gore.ts` pour ce qu'il dessine.

export interface SurfaceHit {
  point: THREE.Vector3;
  /** Unitaire, tournée vers l'origine du rayon. */
  normal: THREE.Vector3;
}

/**
 * Premier décor STATIQUE sur un rayon (`direction` unitaire), ou `null`. Fourni
 * par le jeu : le rendu ne connaît pas Rapier. Un décor mobile ou cassable
 * n'est jamais rendu — une tache y resterait suspendue en l'air.
 */
export type SurfaceProbe = (origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number) => SurfaceHit | null;

export type Range = readonly [number, number];

// Valeurs de départ, à juger en jouant.
export const goreConfig = {
  splatCapacity: 192,
  chunkCapacity: 48,
  /** Écart entre la tache et sa surface, en mètres — voir le z-fighting des habillages affleurants. */
  surfaceOffset: 0.015,

  /** Flaque sous un ennemi mort sans exploser : elle s'étale lentement. */
  deathPoolSize: [1.1, 1.6] as Range,
  deathPoolGrow: 1.6,

  /** Flaque d'un ennemi qui explose : plus large, et d'un coup. */
  gibPoolSize: [1.9, 2.5] as Range,
  gibPoolGrow: 0.3,
  /** Giclées projetées dans l'axe du coup, et leur portée en mètres. */
  gibSprayCount: 12,
  gibSprayRange: 5,
  gibSpraySpread: 0.8,
  gibSpraySize: [0.6, 1.1] as Range,
  /** Au sol, une giclée s'allonge dans l'axe du coup : longueur en multiples de sa largeur. */
  gibSprayStretch: [1.4, 2.4] as Range,
  gibSprayGrow: 0.12,
  gibChunks: 14,

  chunkSpeed: [3, 8] as Range,
  chunkSpread: 0.9,
  chunkSize: [0.07, 0.17] as Range,
  /** Tache laissée par un morceau à chaque choc. */
  chunkSplatSize: [0.25, 0.45] as Range,
  /** Part de la vitesse gardée après un choc contre un mur : c'est mou, ça ne rebondit presque pas. */
  chunkRestitution: 0.2,
  /** Un morceau qui n'a rien touché au bout de ce temps disparaît (chute hors du niveau). */
  chunkMaxFlight: 3,

  /** Giclée derrière un ennemi touché sans mourir. */
  hitSprayRange: 3.5,
  hitSpraySize: [0.3, 0.55] as Range,
  hitSprayChance: { melee: 1, pistol: 1, shotgun: 0.4 } as Record<"melee" | "pistol" | "shotgun", number>,
};

/** Au-delà de cette pente, une surface est un sol : la tache y est ronde et le morceau s'y pose. */
export const FLOOR_NORMAL_Y = 0.6;
