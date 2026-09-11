import { create } from "zustand";

// see: docs/decisions/0020-state-feuille-de-dependances.md
// see: docs/systems/hud.md#flux-décran
export type GameFlowState =
  | "boot"
  | "mainMenu"
  | "options"
  | "levelSelect"
  | "playing"
  | "dead"
  | "levelComplete";

interface DebugState {
  fps: number;
  /** Position des yeux du joueur, m. */
  position: { x: number; y: number; z: number };
  entityCount: number;
  /** Pas fixes exécutés pendant la dernière frame d'affichage (spirale de rattrapage si > 2 durablement). */
  steps: number;

  // see: docs/systems/boucle-de-jeu.md#mesure-des-temps-de-frame-loopstats
  gameplayMs: number;
  physicsMs: number;
  renderMs: number;

  // see: docs/systems/debug.md#coût-de-rendu
  /** Draw calls de la dernière image rendue (`renderer.info.render.calls`). */
  drawCalls: number;
  /** Triangles de la dernière image rendue (`renderer.info.render.triangles`). */
  triangles: number;

  // see: docs/systems/debug.md#champs-de-debugstate
  isGrounded: boolean;
  /** Vitesse horizontale, m/s. */
  horizontalSpeed: number;
  /** Vitesse verticale, m/s. */
  verticalSpeed: number;
  /** Collisions du dernier `computeColliderMovement`. */
  numCollisions: number;
  /** Normale du sol sous les pieds. */
  groundNormal: { x: number; y: number; z: number };

  // see: docs/systems/debug.md#champs-de-debugstate
  playerHp: number;
  playerMaxHp: number;

  // see: docs/systems/debug.md#champs-de-debugstate
  shotgunAmmo: number;
  shotgunMaxAmmo: number;

  // see: docs/decisions/0020-state-feuille-de-dependances.md
  activeWeapon: "none" | "melee" | "shotgun";

  // see: docs/systems/debug.md#champs-de-debugstate
  secretsFound: number;
  secretsTotal: number;

  // see: docs/systems/debug.md#champs-de-debugstate
  views: number;
}

interface GameState {
  debug: DebugState;
  /**
   * Écriture THROTTLÉE À 10 Hz MAXIMUM depuis la boucle (invariant #2).
   * Jamais un appel par frame : React n'entre pas dans la boucle de jeu.
   */
  setDebug: (partial: Partial<DebugState>) => void;
  /** Écrit `debug.playerHp`. Appeler PONCTUELLEMENT au dégât — jamais par frame (invariant #2). */
  // see: docs/systems/debug.md#champs-de-debugstate
  setPlayerHp: (hp: number) => void;
  /** Incrémente `debug.secretsFound` de 1 — même discipline ponctuelle que `setPlayerHp`, appelé UNE FOIS par secret nouvellement trouvé. */
  incrementSecretsFound: () => void;
  /** Fixe `debug.secretsTotal` — appelé une fois au chargement d'un niveau (voir `LevelStats.secretCount`). */
  setSecretsTotal: (total: number) => void;
  /** Incrémente `debug.views` de `amount`, décidé par l'appelant — voir `game/session/feedback.ts::grantKillViews`. */
  incrementViews: (amount: number) => void;

  /** Canal SYSTÈME, sans cooldown — distinct de `heroLine` ci-dessous. */
  // see: docs/systems/hud.md#deux-canaux-de-message-hudmessage-et-heroline
  hudMessage: string | null;
  showHudMessage: (text: string | null) => void;

  /** Canal RÉPLIQUE — cooldown global de 15 s appliqué côté appelant, pas ici. */
  // see: docs/systems/hud.md#deux-canaux-de-message-hudmessage-et-heroline
  heroLine: string | null;
  showHeroLine: (text: string | null) => void;

  /** État courant du flux d'écran — permet aux composants React de réagir à un changement d'écran. */
  // see: docs/systems/hud.md#flux-décran
  // see: docs/decisions/0019-machine-xstate-flux-ecran.md
  flowState: GameFlowState;
  setFlowState: (state: GameFlowState) => void;

  /** Remet `debug` à ses valeurs de boot et efface les messages transitoires — ne touche jamais `flowState`. */
  // see: docs/systems/session.md#construire-une-partie
  resetGameStore: () => void;
}

/** Valeurs de boot de `debug` — voir `resetGameStore`. Extrait en constante
 * plutôt que répété dans l'initialiseur ET dans `resetGameStore` (les deux
 * doivent rester identiques par construction, pas par discipline manuelle). */
const INITIAL_DEBUG: DebugState = {
  fps: 0,
  position: { x: 0, y: 0, z: 0 },
  entityCount: 0,
  steps: 0,
  gameplayMs: 0,
  physicsMs: 0,
  renderMs: 0,
  drawCalls: 0,
  triangles: 0,
  isGrounded: false,
  horizontalSpeed: 0,
  verticalSpeed: 0,
  numCollisions: 0,
  groundNormal: { x: 0, y: 1, z: 0 },
  playerHp: 100,
  playerMaxHp: 100,
  shotgunAmmo: 0,
  shotgunMaxAmmo: 0,
  activeWeapon: "melee",
  secretsFound: 0,
  secretsTotal: 0,
  views: 12,
};

export const useGameStore = create<GameState>((set) => ({
  debug: { ...INITIAL_DEBUG },
  setDebug: (partial) => set((state) => ({ debug: { ...state.debug, ...partial } })),
  setPlayerHp: (hp) => set((state) => ({ debug: { ...state.debug, playerHp: hp } })),
  incrementSecretsFound: () =>
    set((state) => ({ debug: { ...state.debug, secretsFound: state.debug.secretsFound + 1 } })),
  setSecretsTotal: (total) => set((state) => ({ debug: { ...state.debug, secretsTotal: total } })),
  incrementViews: (amount) => set((state) => ({ debug: { ...state.debug, views: state.debug.views + amount } })),

  hudMessage: null,
  showHudMessage: (text) => set({ hudMessage: text }),

  heroLine: null,
  showHeroLine: (text) => set({ heroLine: text }),

  flowState: "boot",
  setFlowState: (state) => set({ flowState: state }),

  resetGameStore: () => set({ debug: { ...INITIAL_DEBUG }, hudMessage: null, heroLine: null }),
}));
