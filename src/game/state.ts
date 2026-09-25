import { create } from "zustand";

// see: docs/decisions/0020-state-feuille-de-dependances.md
// see: docs/systems/hud.md#flux-décran
export type GameFlowState =
  | "boot"
  | "mainMenu"
  | "options"
  | "levelSelect"
  | "playing"
  | "paused"
  | "dead"
  | "levelComplete";

/**
 * Une ligne du récap de fin de partie : ce qui a été compté, comment ça se
 * calcule (`detail`, un texte déjà formaté — l'écran ne refait aucun calcul),
 * ce que ça rapporte. DÉFINI ICI plutôt que dans `game/session/score.ts` et
 * réimporté par lui, même pattern que `GameFlowState` ci-dessus (ADR 0020,
 * `game/state.ts` reste une FEUILLE de dépendances — c'est aux autres
 * modules d'importer depuis lui, jamais l'inverse).
 * see: docs/systems/session.md#récapitulatif-de-fin-de-partie
 */
export interface RecapLine {
  label: string;
  detail: string;
  points: number;
}

/** Voir `RecapLine` ci-dessus pour pourquoi ce type vit ici. Construit par `game/session/score.ts::buildLevelRecap`, pur calcul sans dépendance à ce store. */
export interface LevelRecap {
  lines: RecapLine[];
  total: number;
  elapsedSeconds: number;
  parTimeSeconds: number | null;
  accuracy: number;
}

export interface DebugState {
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
  pistolAmmo: number;
  pistolMaxAmmo: number;

  // see: docs/decisions/0020-state-feuille-de-dependances.md
  activeWeapon: "none" | "melee" | "pistol" | "shotgun";

  // see: docs/systems/debug.md#champs-de-debugstate
  secretsFound: number;
  secretsTotal: number;

  /** Cartes de fidélité en poche, dans l'ordre Argent/Or/Platine. Miroir de
   * `session.cards`, jamais la source de vérité — l'union est redéclarée ici
   * plutôt qu'importée, comme `activeWeapon`.
   * see: docs/decisions/0020-state-feuille-de-dependances.md */
  cards: readonly ("argent" | "or" | "platine")[];

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
  /** Recopie l'inventaire de cartes — appelé PONCTUELLEMENT au ramassage, jamais par image (voir `game/session/cards.ts`). */
  setCards: (cards: readonly ("argent" | "or" | "platine")[]) => void;
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

  /** Récap de fin de partie — `null` tant qu'aucune partie ne s'est encore
   * terminée. Poussé UNE FOIS par `game/session/score.ts::publishLevelRecap`,
   * à la mort (récap partiel) ou à la fin de niveau (récap complet), jamais
   * par image (invariant #2).
   * see: docs/systems/session.md#récapitulatif-de-fin-de-partie */
  recap: LevelRecap | null;
  setRecap: (recap: LevelRecap | null) => void;

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
  pistolAmmo: 0,
  pistolMaxAmmo: 0,
  activeWeapon: "melee",
  secretsFound: 0,
  secretsTotal: 0,
  cards: [],
  views: 12,
};

export const useGameStore = create<GameState>((set) => ({
  debug: { ...INITIAL_DEBUG },
  setDebug: (partial) => set((state) => ({ debug: { ...state.debug, ...partial } })),
  setPlayerHp: (hp) => set((state) => ({ debug: { ...state.debug, playerHp: hp } })),
  incrementSecretsFound: () =>
    set((state) => ({ debug: { ...state.debug, secretsFound: state.debug.secretsFound + 1 } })),
  setSecretsTotal: (total) => set((state) => ({ debug: { ...state.debug, secretsTotal: total } })),
  setCards: (cards) => set((state) => ({ debug: { ...state.debug, cards } })),
  incrementViews: (amount) => set((state) => ({ debug: { ...state.debug, views: state.debug.views + amount } })),

  hudMessage: null,
  showHudMessage: (text) => set({ hudMessage: text }),

  heroLine: null,
  showHeroLine: (text) => set({ heroLine: text }),

  flowState: "boot",
  setFlowState: (state) => set({ flowState: state }),

  recap: null,
  setRecap: (recap) => set({ recap }),

  resetGameStore: () => set({ debug: { ...INITIAL_DEBUG }, hudMessage: null, heroLine: null, recap: null }),
}));
