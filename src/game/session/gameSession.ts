import type { PhysicsWorld } from "../../physics/world";
import type { CardPickupBillboard } from "../../render/pickups/cardPickups";
import type { PickupResources } from "../../render/pickups/pickupResources";
import type { BillboardSprite } from "../../render/sprites/billboard";
import type { DirectorManager } from "../entities/director/directorManager";
import type { SuitManager } from "../entities/suit/suitManager";
import type { LevelDef } from "../level/catalog/levels";
import type { LevelSession } from "../level/loading/hotReload";
import type { PlayerController } from "../player/movement/controller";
import type { WeaponSystem } from "../player/weapons/weapons";
import type { EntryMode } from "./campaign/campaignTypes";
import type { LevelState } from "./levelState";
import type { LevelMode } from "./modes/levelMode";
import type { HeroPortrait } from "./presentation/heroPortrait";
import type { Difficulty } from "./progression/difficulty";
import type { RunState } from "./runState";

/**
 * Les systèmes d'une partie : construits avec elle, libérés par
 * `teardownGameSession`, jamais remplacés entre-temps.
 */
export interface SessionSystems {
  physics: PhysicsWorld;
  player: PlayerController;
  weapons: WeaponSystem;

  suitManager: SuitManager;
  /** Un `BillboardSprite` par Costard vivant/cadavre, voir `game/session/spawning.ts::spawnSuitAt`. */
  suitSprites: Map<number, BillboardSprite>;
  directorManager: DirectorManager;
  directorSprites: Map<number, BillboardSprite>;
  heroPortrait: HeroPortrait;

  /** Ce qu'un niveau construit à la main ajoute à la partie (salle d'essai, prototype) ; `null` pour un niveau glTF. */
  mode: LevelMode | null;
  /** Session de niveau glTF (chemin "gltf" seulement) — `LevelSession.dispose()` (via `.stop()`) gère déjà lui-même le retrait de sa géométrie de `scene` et la libération GPU (voir `levelResources.ts::LevelResources`), donc `teardownGameSession` n'a qu'à appeler `.stop()`. */
  gltfLevelSession: LevelSession | null;
  /** Invalide une installation de niveau différée (changement console ou
   * teardown) avant qu'elle puisse publier une session sur un monde libéré. */
  levelLoadGeneration: number;

  /** Ressources partagées des ramassages, détenues jusqu’à l’arrêt de cette session. */
  pickupResources: PickupResources | null;
  /** Billboard autonome de la carte lâchée par le Directeur. */
  droppedCardBillboard: CardPickupBillboard | null;
}

/**
 * Une partie, en trois durées de vie : ses systèmes (à plat), l'état du joueur
 * dans cette partie (`run`) et ce que le niveau chargé y apporte (`level`).
 * see: docs/3-architecture/cycle-de-vie.md#trois-durées-de-vie
 */
export interface GameSession extends SessionSystems {
  /** Niveau/chemin de boot utilisé pour CETTE partie — permet à "Rejouer" de reconstruire EXACTEMENT le même choix. */
  readonly choice: LevelDef;
  /** Difficulté de CETTE partie, lue une fois à sa construction — voir `progression/difficulty.ts`. */
  readonly difficulty: Difficulty;
  readonly entryMode: EntryMode;

  run: RunState;
  level: LevelState;
}
