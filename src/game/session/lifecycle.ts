import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { createElement } from "react";

import { COLLISION_GROUPS, PhysicsWorld } from "../../physics/world";
import { PlayerController } from "../player/controller";
import { WeaponSystem } from "../player/weapons";
import { buildGym } from "../level/gym";
import { SuitManager } from "../entities/suitManager";
import { DirectorManager } from "../entities/directorManager";
import { useGameStore } from "../state";
import { App } from "../../ui/App";
import { type LevelDef } from "../level/levels";
import { spawnSuitAt, loadGltfLevel } from "./spawning";
import { resolveBootChoice } from "./bootChoice";
import { type GameSession } from "./gameSession";
import { type GameEngine, type PersistentEngine } from "./gameEngine";

/** Garde verticale entre les pieds au spawn et le sol, en mètres : évite une
 * interpénétration au tout premier pas fixe (même garde que l'ancienne salle
 * de test). `buildGym` retourne la hauteur EXACTE du sol au point de spawn. */
const SPAWN_FEET_GUARD = 0.1;

/**
 * Rayon de la balle de test (chemin "gym" seulement) — témoin de
 * non-régression des colliders et de `setApplyImpulsesToDynamicBodies`.
 * Trajectoire vérifiée par calcul pour rester contenue dans le hub.
 * see: docs/systems/session.md#construire-une-partie
 */
const BALL_RADIUS = 0.4;

/**
 * Construit une PARTIE complète : `PhysicsWorld` (donc `player`/`weapons`/
 * `suitManager`/`directorManager`, tous construits à partir de `physics`),
 * la géométrie du niveau (gym ou session glTF), tout l'état de suivi par
 * partie. Appelée une fois au tout premier boot ET à nouveau à chaque
 * "Rejouer"/"Retour au menu" — ce réemploi est ce qui rend le reset
 * possible.
 * see: docs/systems/session.md#construire-une-partie
 */
export function bootGameSession(engine: PersistentEngine, choice: LevelDef): GameSession {
  // Remis à ses valeurs de boot AVANT de construire quoi que ce soit :
  // `session.playerHp` ci-dessous lit `debug.playerMaxHp` fraîchement reset.
  useGameStore.getState().resetGameStore();

  const physics = new PhysicsWorld();
  const player = new PlayerController(physics);

  let gymRoot: THREE.Group | null = null;
  let ballMesh: THREE.Mesh | null = null;
  let ballBody: RAPIER.RigidBody | null = null;

  // `buildGym` (géométrie + colliders de la gym) n'est appelé QUE sur le
  // chemin "gym" : sur le chemin "gltf", zéro géométrie/collider de la gym
  // ne doit exister en mémoire, pas juste être caché — les deux chemins
  // sont mutuellement exclusifs.
  if (choice.kind === "gym") {
    gymRoot = new THREE.Group();
    engine.scene.add(gymRoot);
    const gym = buildGym(gymRoot, physics);
    player.spawn(gym.spawn.x, gym.spawn.y + SPAWN_FEET_GUARD, gym.spawn.z);
    engine.look.yaw = gym.spawnYaw;
    engine.look.pitch = 0;

    ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
      new THREE.MeshLambertMaterial({ color: 0x4488cc }),
    );
    gymRoot.add(ballMesh); // enfant de gymRoot, pas de scene -- voir la doc de `GameSession.gymRoot`.

    ballBody = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(3, 4, 0).setLinvel(-2, 0, 3),
    );
    physics.world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_RADIUS)
        .setRestitution(0.7)
        // Groupe WORLD : elle doit rester heurtable par le joueur (un groupe
        // DEBRIS ne collisionnerait qu'avec le décor).
        .setCollisionGroups(COLLISION_GROUPS.WORLD),
      ballBody,
    );
  } else {
    // Chemin glTF : pas de spawn connu ici (le chargement, plus bas, est
    // asynchrone). Position transitoire sûre et documentée : le joueur
    // tombe quelques pas fixes dans le vide (gravité −25 m/s², invariant
    // #7) jusqu'à ce que le callback `onLoaded` de `loadGltfLevel` le
    // repositionne sur `spawn_player` du `.glb`.
    player.spawn(0, 2, 0);
    engine.look.yaw = 0;
    engine.look.pitch = 0;
  }

  const weapons = new WeaponSystem(physics, engine.clock);
  const suitManager = new SuitManager(physics);
  const directorManager = new DirectorManager(physics);

  const session: GameSession = {
    choice,
    physics,
    player,
    weapons,
    suitManager,
    suitSprites: new Map(),
    directorManager,
    directorSprites: new Map(),
    gymRoot,
    ballMesh,
    ballBody,
    gltfLevelSession: null,
    currentNavGraph: null,
    badgeMesh: null,
    hasBadge: false,
    unlockedDoors: new Set(),
    openingDoor: null,
    exitDoorTracking: null,
    foundSecrets: new WeakSet(),
    playerHp: useGameStore.getState().debug.playerMaxHp,
    firstKillTriggered: false,
    lowHpLineTriggered: false,
    deathHandled: false,
    levelCompleteHandled: false,
    lastHeroLineAt: -Infinity,
  };

  // Loadout de départ : `LevelDef.startUnarmed` (registre `game/level/levels.ts`).
  if (choice.startUnarmed) {
    weapons.startUnarmed();
  }

  // 3 points de spawn dans le hub (chemin "gym" seulement — POSITIONS DE
  // TEST DE LA GYM, pas du contenu générique de moteur) : dispersés autour
  // du spawn joueur (0, 0, -10), à 15-22 m (au-delà de la portée de
  // mêlée, en-deçà de `suitConfig.sightRange`), et à >= 8 m de n'importe
  // quel mur du hub. Les niveaux glTF ont leurs propres `spawn_suit_*`,
  // consommés dans `loadGltfLevel` ci-dessus.
  if (choice.kind === "gym") {
    spawnSuitAt(engine, session, -9, SPAWN_FEET_GUARD, 5);
    spawnSuitAt(engine, session, 9, SPAWN_FEET_GUARD, 5);
    spawnSuitAt(engine, session, 0, SPAWN_FEET_GUARD, 13);
  } else if (choice.gltfName) {
    loadGltfLevel(engine, session, choice.gltfName);
  }

  return session;
}

/**
 * Détruit une PARTIE complète, dans un ordre précis : session de niveau
 * glTF, géométrie propre à `session` (gym + balle de test), sprites
 * billboard, mesh du badge, puis `physics.world.free()` EN DERNIER —
 * libérer le monde Rapier libère tous ses corps/colliders d'un coup, voir
 * pourquoi l'ordre compte.
 * see: docs/systems/session.md#démolir-une-partie
 */
export function teardownGameSession(engine: PersistentEngine, session: GameSession): void {
  session.gltfLevelSession?.stop();

  if (session.gymRoot) {
    session.gymRoot.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) material.dispose();
    });
    engine.scene.remove(session.gymRoot);
  }

  for (const sprite of session.suitSprites.values()) sprite.dispose();
  session.suitSprites.clear();
  for (const sprite of session.directorSprites.values()) sprite.dispose();
  session.directorSprites.clear();

  // Géométrie/matériau du badge sont PARTAGÉS (`engine.badgeGeometry`/
  // `engine.badgeMaterial`, persistants) — seule l'instance de mesh est
  // propre à la partie, donc seul un `remove` est nécessaire ici, jamais de
  // `dispose()` dessus.
  if (session.badgeMesh) engine.scene.remove(session.badgeMesh);

  session.physics.world.free();
}

/**
 * "Rejouer" — reconstruit EXACTEMENT le même `LevelDef` que la partie qui
 * vient de se terminer. Aucun `root.render()` ici : `App` reste monté tout
 * du long, seul `state.flowState` change — c'est ce qui rend "Rejouer"
 * instantané, sans rechargement de page.
 * see: docs/systems/session.md#rejouer-et-retour-au-menu
 */
export function replay(engine: GameEngine): void {
  const choice = engine.session.choice;
  teardownGameSession(engine, engine.session);
  engine.session = bootGameSession(engine, choice);
  engine.flowActor.send({ type: "REPLAY" });
}

/**
 * "Retour au menu principal" — détruit la partie courante puis réaffiche
 * `MainMenu` en réutilisant `resolveBootChoice` telle quelle.
 *
 * PIÈGE : `resolveBootChoice` relit `window.location.search` fraîchement à
 * chaque appel — retirer `level` de l'URL (`history.replaceState`, sans
 * rechargement) doit donc se faire AVANT de la rappeler, sinon une partie
 * démarrée via `?level=...` reviendrait silencieusement au même niveau au
 * lieu du vrai menu principal.
 * see: docs/systems/session.md#rejouer-et-retour-au-menu
 */
export function returnToMenu(engine: GameEngine): void {
  teardownGameSession(engine, engine.session);
  engine.flowActor.send({ type: "RETURN_TO_MENU" });

  const url = new URL(window.location.href);
  url.searchParams.delete("level");
  window.history.replaceState(null, "", url.toString());

  resolveBootChoice(engine.root).then((choice) => {
    engine.session = bootGameSession(engine, choice);
    engine.root.render(createElement(App, { onReplay: () => replay(engine), onReturnToMenu: () => returnToMenu(engine) }));
    engine.flowActor.send({ type: "PLAY" });
  });
}
