import { create } from "zustand";

import type { LoyaltyCard } from "./player/loyaltyCards";
import { INITIAL_PLAYER_MAX_HP } from "./session/playerState";
import type { GameFlowState } from "../app/gameFlowTypes";
import type { HeroPortraitView, DebugState, LevelRecap } from "./hudTypes";
import { INITIAL_HERO_PORTRAIT } from "./session/portraitState";

// see: docs/decisions/0036-contrats-feuilles-et-store-hud.md
// see: docs/4-technique/interface-react.md#flux-décran

// see: docs/archive/systems-session.md#récapitulatif-de-fin-de-partie

interface GameState {
  heroPortrait: HeroPortraitView;
  setHeroPortrait: (view: HeroPortraitView) => void;
  debug: DebugState;
  // see: docs/6-reference/notes-code-gameplay.md#feedback-et-récap
  /** Au plus 10 Hz depuis la boucle ; aucun appel par frame. */
  setDebug: (partial: Partial<DebugState>) => void;
  /** Écrit `debug.playerHp`. Appeler PONCTUELLEMENT au dégât — jamais par frame (invariant #2). */
  // see: docs/archive/systems-debug.md#champs-de-debugstate
  setPlayerHp: (hp: number) => void;
  /** Incrémente `debug.secretsFound` de 1 — même discipline ponctuelle que `setPlayerHp`, appelé UNE FOIS par secret nouvellement trouvé. */
  incrementSecretsFound: () => void;
  /** Fixe `debug.secretsTotal` — appelé une fois au chargement d'un niveau (voir `LevelStats.secretCount`). */
  setSecretsTotal: (total: number) => void;
  /** Recopie l'inventaire de cartes — appelé PONCTUELLEMENT au ramassage, jamais par image (voir `game/session/cards.ts`). */
  setCards: (cards: readonly LoyaltyCard[]) => void;
  /** Incrémente `debug.views` de `amount`, décidé par l'appelant — voir `game/session/feedback.ts::grantKillViews`. */
  incrementViews: (amount: number) => void;

  /** Canal SYSTÈME, sans cooldown — distinct de `heroLine` ci-dessous. */
  // see: docs/archive/systems-hud.md#deux-canaux-de-message-hudmessage-et-heroline
  hudMessage: string | null;
  showHudMessage: (text: string | null) => void;

  /** Canal RÉPLIQUE — cooldown global de 15 s appliqué côté appelant, pas ici. */
  heroLine: string | null;
  showHeroLine: (text: string | null) => void;

  /** État courant du flux d'écran — permet aux composants React de réagir à un changement d'écran. */
  // see: docs/decisions/0019-machine-xstate-flux-ecran.md
  flowState: GameFlowState;
  setFlowState: (state: GameFlowState) => void;

  recap: LevelRecap | null;
  setRecap: (recap: LevelRecap | null) => void;

  /** Remet `debug` à ses valeurs de boot et efface les messages transitoires — ne touche jamais `flowState`. */
  // see: docs/archive/systems-session.md#construire-une-partie
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
  gameplayP95Ms: 0,
  astarQueries: 0,
  astarMisses: 0,
  astarExpandedNodes: 0,
  astarLastMs: 0,
  astarMaxMs: 0,
  physicsMs: 0,
  renderMs: 0,
  drawCalls: 0,
  triangles: 0,
  isGrounded: false,
  horizontalSpeed: 0,
  verticalSpeed: 0,
  numCollisions: 0,
  groundNormal: { x: 0, y: 1, z: 0 },
  playerHp: INITIAL_PLAYER_MAX_HP,
  playerMaxHp: INITIAL_PLAYER_MAX_HP,
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
  heroPortrait: INITIAL_HERO_PORTRAIT,
  setHeroPortrait: (view) => set((state) => {
    const previous = state.heroPortrait;
    if (previous.sheet === view.sheet && previous.frame === view.frame && previous.reaction === view.reaction
      && previous.healthBand === view.healthBand && previous.side === view.side && previous.impact === view.impact
      && previous.combo === view.combo) return state;
    return { heroPortrait: view };
  }),
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

  resetGameStore: () => set({ debug: { ...INITIAL_DEBUG }, heroPortrait: INITIAL_HERO_PORTRAIT,
    hudMessage: null, heroLine: null, recap: null }),
}));
