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

/**
 * Extraction du refactor de `main.ts` (2229 lignes → modules, 2026-09-05) :
 * `bootGameSession`/`teardownGameSession`/`replay`/`returnToMenu` déplacées
 * telles quelles, `engine`/`session` en paramètres explicites au lieu d'une
 * fermeture sur le scope de `main()`. `bootGameSession`/`teardownGameSession`
 * prennent `PersistentEngine` (pas `GameEngine`) : elles ne lisent jamais
 * `engine.session`, ce qui leur permet d'être appelées AVANT que la toute
 * première session n'existe — voir `gameEngine.ts::PersistentEngine`.
 */

/** Garde verticale entre les pieds au spawn et le sol, en mètres : évite une
 * interpénétration au tout premier pas fixe (même garde que l'ancienne salle
 * de test). `buildGym` retourne la hauteur EXACTE du sol au point de spawn. */
const SPAWN_FEET_GUARD = 0.1;

/**
 * Rayon de la balle de test (chemin "gym" seulement) — témoin de
 * non-régression des colliders, et témoin de `setApplyImpulsesToDynamicBodies`
 * (le joueur doit pouvoir la pousser). Position vérifiée pour le hub de la
 * gym (44x44 m, murs à x,z = ±22) : au repos elle tombe vers (~1.9, ~0.4,
 * ~1.6) en ~0.54 s, bien dégagée de tout mur et directement dans le champ de
 * vision du spawn (au spawn (0, ~1.7, -10) regardant +Z, la balle est à ~17°
 * hors axe, très en deçà du demi-FOV ~54°). Sa dérive horizontale constante
 * (pas d'amortissement) la fait heurter le segment ouest du mur nord du hub
 * vers t≈7.3 s, avant d'atteindre l'ouverture du couloir (x∈[-3,3]) : elle
 * reste contenue dans le hub, jamais éjectée vers une autre aile.
 *
 * OBJET DE TEST DE LA GYM (pas du contenu générique de moteur) : construite
 * UNIQUEMENT sur le chemin "gym", ses coordonnées n'ayant aucun sens sur le
 * chemin glTF.
 */
const BALL_RADIUS = 0.4;

/**
 * Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) — construit une PARTIE complète :
 * `PhysicsWorld` (donc `player`/`weapons`/`suitManager`/`directorManager`,
 * tous construits À PARTIR de `physics`), la géométrie du niveau (gym ou
 * session glTF), tout l'état de suivi par partie (badge/porte/secrets...),
 * et remet `game/state.ts` (`debug`, `hudMessage`, `heroLine`) à ses
 * valeurs de boot. Appelée UNE FOIS au tout premier boot ET à nouveau à
 * chaque "Rejouer"/"Retour au menu" (`replay`/`returnToMenu` plus bas) —
 * c'est ce réemploi qui rend le reset possible.
 *
 * Ce qui N'EST PAS reconstruit ici (voir la doc de `GameSession`) :
 * `scene`/`camera`/`renderer`, `clock`, `fx`/`viewmodel`/`crosshair`/
 * `hitmarker`/`ballisticsDebug`/`wireframeToggle`, `look`/`lookDelta`,
 * `interaction`, tous les atlas/géométries/matériaux partagés — ces
 * systèmes sont STATELESS vis-à-vis d'une partie précise (ou leur état
 * interne, comme le `WeakSet` d'`interaction`, s'auto-invalide sans code
 * de reset dédié, voir sa doc).
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
 * Jalon M8 — détruit une PARTIE complète : dispose la session de niveau
 * glTF (retire sa géométrie de `scene`, libère GPU — voir
 * `loader.ts::disposeLevelResource`, déjà correct, inchangé), retire toute
 * la géométrie propre à `session` de `scene` (gym + balle de test, en un
 * seul `scene.remove(gymRoot)` — voir la doc de `GameSession.gymRoot` —
 * puis dispose leurs géométries/matériaux, gym étant un chemin dev
 * potentiellement rejoué plusieurs fois de suite), dispose les sprites
 * billboard (Costards + Directeur, `BillboardSprite.dispose()` gère déjà
 * retrait de scène + libération géométrie/matériau/texture propres à
 * l'instance), retire le mesh du badge s'il traînait, puis
 * `physics.world.free()` EN DERNIER — API Rapier brute déjà utilisée ainsi
 * dans `simulateRecording` (`game/devtools/testHarness.ts`), confirmée par
 * `node_modules/.../pipeline/world.d.ts` : libérer le monde libère TOUS
 * ses corps/colliders/`KinematicCharacterController` d'un coup, "no need
 * to call their `.free()` methods individually" — donc aucun nettoyage
 * Rapier séparé n'est nécessaire pour `player`/`suitManager`/
 * `directorManager`/`weapons`, qui deviennent simplement inatteignables et
 * seront ramassés par le GC JS normal.
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
 * "Rejouer" (`dead`/`levelComplete -> playing`) — reconstruit EXACTEMENT
 * le même `LevelDef` que la partie qui vient de se terminer
 * (`session.choice`). Aucun `root.render()` ici : `App` reste monté tout
 * du long (voir `main.ts`), seul `state.flowState` change (`DeathScreen`/
 * `LevelCompleteScreen` redeviennent `null`) — c'est ce qui rend "Rejouer"
 * instantané, sans le moindre rechargement de page.
 */
export function replay(engine: GameEngine): void {
  const choice = engine.session.choice;
  teardownGameSession(engine, engine.session);
  engine.session = bootGameSession(engine, choice);
  engine.flowActor.send({ type: "REPLAY" });
}

/**
 * "Retour au menu principal" (`dead`/`levelComplete -> mainMenu`) —
 * détruit la partie courante puis réaffiche `MainMenu` en réutilisant
 * `resolveBootChoice` TEL QUEL (même fonction que le tout premier boot,
 * non dupliquée).
 *
 * Réplique la garantie de l'ancien `reloadToMainMenu()` (`ui/screenNav.ts`,
 * supprimé au jalon M8) : peu importe comment CETTE partie a démarré
 * (`?level=...` ou le vrai menu), "Retour au menu principal" doit
 * toujours retomber sur le VRAI menu principal, jamais rejouer
 * silencieusement le même `?level=` bypass. `resolveBootChoice` relit
 * `window.location.search` FRAÎCHEMENT à chaque appel (voir sa doc) — on
 * retire donc `level` de l'URL AVANT de la rappeler, via `history.replaceState`
 * (pas de rechargement de page, contrairement à l'ancienne implémentation).
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
