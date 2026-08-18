import { create } from "zustand";

interface DebugState {
  fps: number;
  /** Position des yeux du joueur, m. */
  position: { x: number; y: number; z: number };
  entityCount: number;
  /** Pas fixes exécutés pendant la dernière frame d'affichage (spirale de rattrapage si > 2 durablement). */
  steps: number;

  // Diagnostic du character controller — imposé en permanence par le skill
  // `rapier-character-controller`. Un `isGrounded` qui clignote sur terrain
  // plat signale un problème de snap-to-ground.
  isGrounded: boolean;
  /** Vitesse horizontale, m/s. */
  horizontalSpeed: number;
  /** Vitesse verticale, m/s. */
  verticalSpeed: number;
  /** Collisions du dernier `computeColliderMovement`. */
  numCollisions: number;
  /** Normale du sol sous les pieds. */
  groundNormal: { x: number; y: number; z: number };
}

interface GameState {
  debug: DebugState;
  /**
   * Écriture THROTTLÉE À 10 Hz MAXIMUM depuis la boucle (invariant #2).
   * Jamais un appel par frame : React n'entre pas dans la boucle de jeu.
   */
  setDebug: (partial: Partial<DebugState>) => void;
}

export const useGameStore = create<GameState>((set) => ({
  debug: {
    fps: 0,
    position: { x: 0, y: 0, z: 0 },
    entityCount: 0,
    steps: 0,
    isGrounded: false,
    horizontalSpeed: 0,
    verticalSpeed: 0,
    numCollisions: 0,
    groundNormal: { x: 0, y: 1, z: 0 },
  },
  setDebug: (partial) => set((state) => ({ debug: { ...state.debug, ...partial } })),
}));
