import * as THREE from "three";

import type { GameEngine, PersistentEngine } from "../gameEngine";
import type { GameSession } from "../gameSession";

// Ce qu'un niveau construit à la main (salle d'essai, prototype) ajoute à une
// partie. La session, la boucle et le chargement ne connaissent que ce
// contrat : aucun d'eux ne sait quels modes existent.
export interface LevelMode {
  /** Entités propres au mode, comptées par le panneau de debug. */
  readonly entityCount: number;
  /** Une fois la partie construite : ennemis de départ, portes, graphe de navigation. */
  populate(engine: PersistentEngine, session: GameSession): void;
  /** Un pas fixe, après les ennemis ordinaires. `use` : la touche d'usage a été pressée à ce pas. */
  fixedStep?(engine: GameEngine, dt: number, use: boolean): void;
  /** Avant le pas physique, comme `player.snapshotPrevious()`. */
  snapshotPrevious?(): void;
  /** Après le pas physique : relit les corps que le mode affiche. */
  syncFromPhysics?(): void;
  /** Au taux d'affichage. `elapsed` : temps de gameplay de la partie. */
  interpolate?(alpha: number, elapsed: number): void;
  /** Une fois par image : sons et effets des événements du mode. */
  present?(): void;
  /** Début d'un enregistrement ou d'un rejeu d'entrées : l'horaire du mode repart de zéro. */
  resetForReplay?(): void;
  /** Libère la géométrie et les corps du mode. Le monde Rapier lui-même est libéré par la session. */
  dispose(): void;
}

export interface BuiltLevelMode {
  readonly mode: LevelMode;
  /** Hauteur EXACTE du sol au point d'apparition : la garde verticale est ajoutée par la session. */
  readonly spawn: { readonly x: number; readonly y: number; readonly z: number };
  readonly spawnYaw: number;
}

/**
 * Retire de la scène la racine d'un mode et libère ses géométries et matériaux,
 * après les libérations propres au mode. Chaque libération est isolée : une
 * erreur n'empêche pas les suivantes.
 */
export function disposeModeRoot(
  scene: THREE.Object3D,
  root: THREE.Object3D,
  releases: readonly (() => void)[] = [],
): void {
  const errors: unknown[] = [];
  const release = (action: () => void): void => {
    try {
      action();
    } catch (error) {
      errors.push(error);
    }
  };
  for (const action of releases) release(action);
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    release(() => obj.geometry.dispose());
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) release(() => material.dispose());
  });
  release(() => scene.remove(root));
  if (errors.length > 0) throw new AggregateError(errors, "Libération incomplète du mode de niveau");
}
