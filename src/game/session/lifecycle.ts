import { PhysicsWorld } from "../../physics/world";
import { AUDIO_SEED, FX_SEED, HERO_LINE_SEED, STREAM_SEED, ZONE_AMBIENCE_SEED } from "../../core/effect/seeds";
import { setAudioRandom } from "../../core/audio/audio";
import { initZoneAmbience, resetZoneAmbienceSession, stopZoneAmbienceSession } from "../../core/audio/zoneAmbience";
import { seededRandom } from "../../app/runtime/gameRuntime";
import { createStreamState } from "./stream/streamSim";
import { levelStreamTexts } from "./stream/levelStreamTexts";
import { difficultyConfig } from "./progression/difficulty";
import { getDifficulty } from "../settings/difficultySettings";
import { suitConfig } from "../entities/suit/suitConfig";
import { directorConfig } from "../entities/director/directorConfig";
import { PlayerController } from "../player/movement/controller";
import { WeaponSystem } from "../player/weapons/weapons";
import { SuitManager } from "../entities/suit/suitManager";
import { DirectorManager } from "../entities/director/directorManager";
import { useGameStore } from "../hud/state";
import type { LevelDef } from "../level/catalog/levels";
import { loadSky } from "../../render/environment/ciel";
import { loadGltfLevel } from "./spawning";
import { buildLevelMode, prepareLevelMode } from "./modes/levelModes";
import type { GameSession } from "./gameSession";
import { createEmptyLevelState } from "./levelState";
import { createRunState } from "./runState";
import type { PersistentEngine } from "./gameEngine";
import { HeroPortrait } from "./presentation/heroPortrait";
import { createStaticSurfaceProbe } from "./presentation/surfaceProbe";
import { loadPickupResources, type PickupResources } from "../../render/pickups/pickupResources";
import type { SessionEntry } from "./campaign/campaignTypes";
import { applyArrival, captureArrival, metroArrival } from "./campaign/campaignArrival";
import { METRO_LEVEL_ID } from "./campaign/campaignCatalog";
/** Garde verticale entre les pieds au spawn et le sol, en mètres : évite une
 * interpénétration au tout premier pas fixe (même garde que l'ancienne salle
 * de test). `buildGym` retourne la hauteur EXACTE du sol au point de spawn. */
const SPAWN_FEET_GUARD = 0.1;

// see: docs/archive/systems-session.md#construire-une-partie

// see: docs/archive/systems-rendu.md#éclairage-de-scène-selon-le-niveau
function applyLightRig(engine: PersistentEngine, choice: LevelDef): void {
  const mode = choice.lighting ?? "temps-reel";
  engine.ambientLight.intensity = mode === "bake" ? 1.0 : mode === "hybride" ? 0.18 : 0.4;
  engine.sunLight.intensity = mode === "temps-reel" ? 0.8 : 0.0;
  // Le ciel suit le niveau, comme la lumière : un niveau sans `ciel` retombe
  // sur la couleur de fond du renderer, et un reset vers la gym l'efface.
  engine.scene.background = choice.ciel ? loadSky(choice.ciel) : null;
}

export async function bootGameSession(
  engine: PersistentEngine,
  choice: LevelDef,
  entry: SessionEntry = { mode: "dev" },
): Promise<GameSession> {
  await initZoneAmbience(choice.ambience);
  const pickupResources = await loadPickupResources();
  try {
    pickupResources.warmTextures(engine.renderer);
    await prepareLevelMode(engine, choice);
    return buildGameSession(engine, choice, pickupResources, entry);
  } catch (error) {
    try {
      pickupResources.dispose();
    } catch (releaseError) {
      throw new AggregateError([error, releaseError], "Construction de la session interrompue", {
        cause: releaseError,
      });
    }
    throw error;
  }
}

function buildGameSession(
  engine: PersistentEngine,
  choice: LevelDef,
  pickupResources: PickupResources,
  entry: SessionEntry,
): GameSession {
  // `GameClock` et `FxSystem` appartiennent au moteur persistant pour éviter
  // de recréer leurs pools, mais leur état transitoire appartient à UNE
  // partie. Le reset précède toute construction de la nouvelle session.
  engine.clock.reset();
  engine.heroReflection.reset();
  engine.fx.resetSession();
  engine.fx.setRandom(seededRandom(FX_SEED));
  setAudioRandom(seededRandom(AUDIO_SEED));
  resetZoneAmbienceSession(seededRandom(ZONE_AMBIENCE_SEED));

  // Remis à ses valeurs de boot AVANT de construire quoi que ce soit :
  // Le HUD est réinitialisé ; la santé canonique appartient à la nouvelle session.
  useGameStore.getState().resetGameStore();

  const physics = new PhysicsWorld();
  const player = new PlayerController(physics);

  // see: docs/6-reference/notes-code-gameplay.md#session-et-moteur
  const built = buildLevelMode(choice, engine.scene, physics);
  if (built) {
    player.spawn(built.spawn.x, built.spawn.y + SPAWN_FEET_GUARD, built.spawn.z);
    engine.look.yaw = built.spawnYaw;
  } else {
    // Niveau glTF : pose provisoire, remplacée par `spawn_player` au chargement.
    player.spawn(0, 2, 0);
    engine.look.yaw = 0;
  }
  engine.look.pitch = 0;

  const weapons = new WeaponSystem(physics, engine.clock);
  const difficulty = entry.arrival?.difficulty ?? getDifficulty();
  const rules = difficultyConfig[difficulty];
  const enemyTuning = { hp: rules.enemyHp, damage: rules.enemyDamage };
  const suitManager = new SuitManager(physics, suitConfig, enemyTuning);
  const directorManager = new DirectorManager(physics, directorConfig, enemyTuning);

  const session: GameSession = {
    choice,
    difficulty,
    entryMode: entry.mode,
    physics,
    player,
    weapons,
    suitManager,
    suitSprites: new Map(),
    directorManager,
    directorSprites: new Map(),
    heroPortrait: new HeroPortrait(),
    mode: built?.mode ?? null,
    gltfLevelSession: null,
    levelLoadGeneration: 0,
    pickupResources,
    droppedCardBillboard: null,
    run: createRunState(
      createStreamState(rules.donations, levelStreamTexts(choice.textes)),
      seededRandom(STREAM_SEED),
      seededRandom(HERO_LINE_SEED),
    ),
    level: createEmptyLevelState(),
  };

  engine.fx.setSurfaceProbe(createStaticSurfaceProbe(session));

  // Loadout de départ : `LevelDef.startUnarmed` (registre `game/level/catalog/levels.ts`).
  if (choice.startUnarmed) {
    weapons.startUnarmed();
  }

  const arrival = entry.arrival ?? (choice.id === METRO_LEVEL_ID ? metroArrival(difficulty) : null);
  if (arrival) applyArrival(session, arrival);
  session.run.entryArrival = captureArrival(session);
  useGameStore.getState().setCampaign({ levelId: choice.id, nextAvailable: false });
  useGameStore.getState().setDebug({
    playerHp: session.run.playerHp,
    playerMaxHp: session.run.playerMaxHp,
    wallet: session.run.stream.wallet,
  });

  applyLightRig(engine, choice);

  if (session.mode) session.mode.populate(engine, session);
  else if (choice.gltfName) loadGltfLevel(engine, session, choice.gltfName);

  return session;
}

// see: docs/archive/systems-session.md#démolir-une-partie
export async function teardownGameSession(engine: PersistentEngine, session: GameSession): Promise<void> {
  session.levelLoadGeneration += 1;
  const errors: unknown[] = [];
  const release = (action: () => void): void => {
    try {
      action();
    } catch (error) {
      errors.push(error);
    }
  };
  release(stopZoneAmbienceSession);
  // Attendre les acquisitions en vol avant de libérer les ressources qu'elles empruntent.
  try {
    await session.gltfLevelSession?.stop();
  } catch (error) {
    errors.push(error);
  }
  release(() => session.pickupResources?.dispose());
  session.pickupResources = null;

  release(() => session.mode?.dispose());

  for (const sprite of session.suitSprites.values()) release(() => sprite.dispose());
  session.suitSprites.clear();
  for (const sprite of session.directorSprites.values()) release(() => sprite.dispose());
  session.directorSprites.clear();

  release(() => session.droppedCardBillboard?.dispose());
  session.droppedCardBillboard = null;

  release(() => engine.fx.resetSession());

  release(() => session.physics.world.free());
  if (errors.length > 0) throw new AggregateError(errors, "Libération incomplète de la session");
}
