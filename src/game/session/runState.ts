import * as THREE from "three";

import type { LoyaltyCard } from "../player/loyaltyCards";
import type { Perk } from "../player/perks";
import { HEAL_PICKUP_RADIUS } from "../level/interactions/interactive";
import { createLevelScriptState, type LevelScriptState } from "../level/scripting/levelScript";
import type { CampaignArrival, CampaignDebugCommand } from "./campaign/campaignTypes";
import { createPlaceLineState, type PlaceLineState } from "./player/placeLineState";
import { INITIAL_PLAYER_MAX_HP } from "./player/playerState";
import type { HeroLineId } from "./presentation/heroLines";
import { createInitialStats, type SessionStats } from "./progression/score";
import type { StreamState } from "./stream/streamSim";

/** Suivi de franchissement de `door_e_exit` — voir `game/session/progression/doors.ts::setupExitDoorTracking`. */
export interface ExitDoorTracking {
  /** Position MONDE du vantail au moment du déverrouillage (X/Z stables ensuite — seul le glissement cosmétique en Y bouge le corps, voir `OpeningDoor`). */
  doorPosition: THREE.Vector3;
  /** Direction MONDE unitaire perpendiculaire au plan du vantail (axe de franchissement) — voir `setupExitDoorTracking` pour la dérivation par rotation réelle du corps. */
  crossingAxis: THREE.Vector3;
  insideSign: 1 | -1;
  /** Demi-épaisseur LOCALE le long de l'axe choisi — valide malgré la rotation : c'est une longueur, pas une position. */
  halfExtentOnAxis: number;
}

/**
 * Ce que le joueur a fait de CETTE partie : il naît avec elle, survit à un
 * rechargement à chaud du niveau, et disparaît avec elle.
 * see: docs/3-architecture/cycle-de-vie.md#trois-durées-de-vie
 */
export interface RunState {
  entryArrival: CampaignArrival | null;
  completedArrival: CampaignArrival | null;
  devCompleteRequested: boolean;
  devCampaignCommands: CampaignDebugCommand[];

  /** PV courants du joueur, suivis localement — `setPlayerHp` prend une valeur absolue (voir `game/hud/state.ts`), `game/session`/`game/loop` sont les seuls endroits qui connaissent le dégât infligé. */
  playerHp: number;
  playerMaxHp: number;
  // see: docs/6-reference/notes-code-gameplay.md#session-et-moteur
  lastSafeGround: THREE.Vector3;
  /** Idempotence de `game/session/player/feedback.ts::applyPlayerDamage` — voir sa doc. */
  deathHandled: boolean;
  /** Idempotence de `game/session/progression/doors.ts::triggerLevelComplete` — voir sa doc. */
  levelCompleteHandled: boolean;

  // see: docs/archive/reference-conventions-nommage.md#cartes-de-fidélité
  cards: Set<LoyaltyCard>;
  /** Perks achetés aux bornes dans CETTE partie — voir `progression/perks.ts`. */
  perks: Set<Perk>;
  /** Rayon des ramassages pris en marchant dessus, en mètres — agrandi par un perk. */
  pickupRadius: number;
  /** Secondes de jeu restantes à la pointe de vitesse d'après-kill (perk boisson). */
  killRushRemaining: number;
  // see: docs/decisions/0032-sanitaires-utilisables.md
  sanitaireReliefCooldown: number;

  unlockedDoors: Set<string>;
  exitDoorTracking: ExitDoorTracking | null;
  /** Secrets déjà trouvés CETTE partie — `WeakSet` par référence de mesh, voir sa doc historique dans `game/loop/updateGameplay.ts`. */
  foundSecrets: WeakSet<THREE.Object3D>;
  secretsFound: number;
  /** Déclencheurs franchis et scénarios en cours de CETTE partie — voir `level/scripting/levelScript.ts`. */
  levelScript: LevelScriptState;

  /** Le direct : audience, abonnés, dons et chat de CETTE partie — voir `stream/streamSim.ts`. */
  stream: StreamState;
  /** Flux déterministe du direct, indépendant des FX, des armes et des ennemis. */
  streamRandom: () => number;

  firstKillTriggered: boolean;
  lowHpLineTriggered: boolean;
  /** Cooldown global des répliques du héros (15 s) — PROPRE À CETTE PARTIE : une réplique juste avant la mort ne doit pas geler le canal de la partie suivante. */
  lastHeroLineAt: number;
  /** Dernier cri court (douleur, réception), en ms de gameplay — voir `feedback.ts::triggerHeroBark`. */
  lastHeroBarkAt: number;
  /** Répliques déjà dites dans CETTE partie (règle `once` de `heroLines.ts`). */
  heroLinesSaid: Set<HeroLineId>;
  heroLineRandom: () => number;
  /** Suivi de la réplique de lieu en attente — voir `player/placeLineState.ts`. */
  placeLine: PlaceLineState;

  // see: docs/archive/systems-session.md#récapitulatif-de-fin-de-partie
  stats: SessionStats;
}

/** L'état d'une partie qui commence. Les deux flux aléatoires viennent du RNG déterministe (invariant #12). */
export function createRunState(
  stream: StreamState,
  streamRandom: () => number,
  heroLineRandom: () => number,
): RunState {
  return {
    entryArrival: null,
    completedArrival: null,
    devCompleteRequested: false,
    devCampaignCommands: [],
    playerHp: INITIAL_PLAYER_MAX_HP,
    playerMaxHp: INITIAL_PLAYER_MAX_HP,
    lastSafeGround: new THREE.Vector3(),
    deathHandled: false,
    levelCompleteHandled: false,
    cards: new Set(),
    perks: new Set(),
    pickupRadius: HEAL_PICKUP_RADIUS,
    killRushRemaining: 0,
    sanitaireReliefCooldown: 0,
    unlockedDoors: new Set(),
    exitDoorTracking: null,
    foundSecrets: new WeakSet(),
    secretsFound: 0,
    levelScript: createLevelScriptState(),
    stream,
    streamRandom,
    firstKillTriggered: false,
    lowHpLineTriggered: false,
    lastHeroLineAt: -Infinity,
    lastHeroBarkAt: -Infinity,
    heroLinesSaid: new Set(),
    heroLineRandom,
    placeLine: createPlaceLineState(),
    stats: createInitialStats(),
  };
}
