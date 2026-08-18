import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { input } from "./core/input";
import { FIXED_DT, startLoop } from "./core/loop";
import { GameClock } from "./core/time";
import {
  emptyInputFrame,
  inputRecorder,
  recordingFromJson,
  recordingToJson,
  type InputFrame,
  type Recording,
} from "./core/inputRecorder";
import { createRenderer, INTERNAL_WIDTH, INTERNAL_HEIGHT } from "./render/renderer";
import { COLLISION_GROUPS, initPhysics, PhysicsWorld } from "./physics/world";
import { buildGym } from "./game/level/gym";
import { PlayerController } from "./game/player/controller";
import {
  FEEL_VARIANTS,
  fovForRunFactor,
  moveConfig,
  type MoveConfig,
} from "./game/player/moveConfig";
import { useGameStore } from "./game/state";
import { App } from "./ui/App";

/** Garde verticale entre les pieds au spawn et le sol, en mètres : évite une
 * interpénétration au tout premier pas fixe (même garde que l'ancienne salle
 * de test). `buildGym` retourne la hauteur EXACTE du sol au point de spawn. */
const SPAWN_FEET_GUARD = 0.1;

async function main() {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const uiRoot = document.getElementById("ui-root") as HTMLDivElement;

  createRoot(uiRoot).render(createElement(App));
  input.attach(canvas);

  const scene = new THREE.Scene();
  // Far plane : la gym expose une ligne de vue dégagée du fond de l'aile
  // plateformes (z ≈ -49.75) au mur de fond du couloir (z ≈ +65.75), soit
  // ~115.5 m à x≈0 (aucun obstacle sur cet axe : rampes/plateformes laissent
  // un couloir libre entre leurs voies). 100 m clippait cette vue ; 130 m
  // garde ~15 m de marge sans dégrader la précision du depth buffer sur un
  // niveau en boîtes.
  //
  // FOV : valeur de repos lue dans `moveConfig` (`fovBase`, 75° — inchangée),
  // parce qu'elle forme un couple avec `fovRunBoost` et n'a de sens qu'à côté
  // de lui. Elle est réévaluée à chaque frame dans `interpolateVisuals`.
  const camera = new THREE.PerspectiveCamera(
    moveConfig.fovBase,
    INTERNAL_WIDTH / INTERNAL_HEIGHT,
    0.1,
    130,
  );

  const renderer = createRenderer(canvas);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  await initPhysics();
  const physics = new PhysicsWorld();
  const gym = buildGym(scene, physics);

  const player = new PlayerController(physics);
  player.spawn(gym.spawn.x, gym.spawn.y + SPAWN_FEET_GUARD, gym.spawn.z);

  // Balle dynamique : témoin de non-régression des colliders, et témoin de
  // `setApplyImpulsesToDynamicBodies` — le joueur doit pouvoir la pousser.
  // Position vérifiée pour le hub de la gym (44x44 m, murs à x,z = ±22) :
  // au repos elle tombe vers (~1.9, ~0.4, ~1.6) en ~0.54 s, bien dégagée de
  // tout mur et directement dans le champ de vision du spawn (au spawn
  // (0, ~1.7, -10) regardant +Z, la balle est à ~17° hors axe, très en deçà
  // du demi-FOV ~54°). Sa dérive horizontale constante (pas d'amortissement)
  // la fait heurter le segment ouest du mur nord du hub vers t≈7.3 s, avant
  // d'atteindre l'ouverture du couloir (x∈[-3,3]) : elle reste contenue dans
  // le hub, jamais éjectée vers une autre aile.
  const ballRadius = 0.4;
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 16, 12),
    new THREE.MeshLambertMaterial({ color: 0x4488cc }),
  );
  scene.add(ballMesh);

  const ballBody = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(3, 4, 0).setLinvel(-2, 0, 3),
  );
  physics.world.createCollider(
    RAPIER.ColliderDesc.ball(ballRadius)
      .setRestitution(0.7)
      // Groupe WORLD : elle doit rester heurtable par le joueur (un groupe
      // DEBRIS ne collisionnerait qu'avec le décor, et le témoin de poussée
      // ne servirait plus à rien).
      .setCollisionGroups(COLLISION_GROUPS.WORLD),
    ballBody,
  );

  const ballPrevPos = new THREE.Vector3();
  const ballPrevQuat = new THREE.Quaternion();
  const ballCurrPos = new THREE.Vector3(3, 4, 0);
  const ballCurrQuat = new THREE.Quaternion();

  // --- Vue : lue au taux d'affichage, jamais interpolée (invariant #3) -------
  const clock = new GameClock();
  // yaw initial = gym.spawnYaw. Convention vérifiée par calcul (voir
  // gltf-level-conventions / commentaire de gym.ts) : avec l'Euler 'YXZ' de
  // la caméra ci-dessous et la dérivation de wishX/wishZ dans
  // PlayerController.update, yaw=0 -> avant = -Z, donc yaw=π -> avant = +Z.
  // gym.ts vise "regarder vers le couloir (nord, +Z)" avec SPAWN_YAW = π :
  // c'est la valeur correcte, aucune correction de signe nécessaire.
  const look = { yaw: gym.spawnYaw, pitch: 0 };
  // Delta souris agrégé depuis le dernier pas fixe, pour l'enregistrement.
  const lookDelta = { dx: 0, dy: 0 };

  const liveFrame = emptyInputFrame();
  const eyePosition = new THREE.Vector3();
  const cameraEuler = new THREE.Euler(0, 0, 0, "YXZ");
  // Scratch du head bob : réutilisé à chaque frame, zéro allocation en régime établi.
  const viewBobOffset = new THREE.Vector3();

  /** Capture l'input du pas fixe courant. Le saut est CONSOMMÉ ici, une seule fois. */
  function captureInputFrame(): InputFrame {
    liveFrame.forward = input.isDown("KeyW");
    liveFrame.back = input.isDown("KeyS");
    liveFrame.left = input.isDown("KeyA");
    liveFrame.right = input.isDown("KeyD");
    liveFrame.sprint = input.isDown("ShiftLeft");
    liveFrame.jump = input.consumeJustPressed("Space");
    liveFrame.yaw = look.yaw;
    liveFrame.pitch = look.pitch;
    liveFrame.dx = lookDelta.dx;
    liveFrame.dy = lookDelta.dy;
    lookDelta.dx = 0;
    lookDelta.dy = 0;
    return liveFrame;
  }

  function startRecording() {
    inputRecorder.startRecording(
      {
        position: { x: player.position.x, y: player.position.y, z: player.position.z },
        velocity: { x: player.velocity.x, y: player.velocity.y, z: player.velocity.z },
        yaw: look.yaw,
        pitch: look.pitch,
      },
      FIXED_DT,
    );
  }

  function startPlayback(rec: Recording) {
    const feetY = rec.start.position.y - (moveConfig.capsuleHalfHeight + moveConfig.capsuleRadius);
    player.spawn(rec.start.position.x, feetY, rec.start.position.z);
    player.velocity.set(rec.start.velocity.x, rec.start.velocity.y, rec.start.velocity.z);
    look.yaw = rec.start.yaw;
    look.pitch = rec.start.pitch;
    inputRecorder.startPlayback(rec);
  }

  let lastRecording: Recording | null = null;

  let fpsSmoothed = 60;
  let debugAccumulator = 0;
  const DEBUG_UPDATE_INTERVAL = 1 / 10; // invariant #2 : 10 Hz maximum
  const ENTITY_COUNT = 1; // la balle ; pas encore de système d'entités (Phase 3)

  startLoop({
    snapshotPrevious() {
      player.snapshotPrevious();
      ballPrevPos.copy(ballCurrPos);
      ballPrevQuat.copy(ballCurrQuat);
    },

    // Décide le mouvement AVANT le step : la translation cible est consommée
    // par le `world.step()` du même pas fixe (voir l'ordre dans core/loop.ts).
    updateGameplay(dt) {
      const gameplayDt = clock.tick(dt);

      let frame: InputFrame | null;
      if (inputRecorder.isPlaying()) {
        frame = inputRecorder.nextFrame();
        if (frame) {
          look.yaw = frame.yaw;
          look.pitch = frame.pitch;
        }
      } else {
        frame = captureInputFrame();
        if (inputRecorder.isRecording()) inputRecorder.record(frame);
      }

      player.update(gameplayDt, frame ?? emptyInputFrame());
    },

    stepPhysics(dt) {
      physics.step(dt);
      const t = ballBody.translation();
      const r = ballBody.rotation();
      ballCurrPos.set(t.x, t.y, t.z);
      ballCurrQuat.set(r.x, r.y, r.z, r.w);
    },

    interpolateVisuals(alpha) {
      ballMesh.position.lerpVectors(ballPrevPos, ballCurrPos, alpha);
      ballMesh.quaternion.slerpQuaternions(ballPrevQuat, ballCurrQuat, alpha);

      // Rotation vue lue au taux d'affichage, jamais interpolée (latence de visée sinon).
      const { dx, dy } = input.consumeMouseDelta();
      if (!inputRecorder.isPlaying()) {
        lookDelta.dx += dx;
        lookDelta.dy += dy;
        look.yaw -= dx * moveConfig.lookSensitivity;
        look.pitch -= dy * moveConfig.lookSensitivity;
        const pitchLimit = (moveConfig.pitchLimitDeg * Math.PI) / 180;
        look.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, look.pitch));
      }
      cameraEuler.set(look.pitch, look.yaw, 0);
      camera.quaternion.setFromEuler(cameraEuler);

      // Position caméra : capsule interpolée + hauteur des yeux.
      camera.position.copy(player.eyePosition(alpha, eyePosition));

      // Head bob + enfoncement de réception : ajoutés à la POSITION de la
      // caméra, jamais à sa rotation. La visée garde donc exactement la latence
      // et la stabilité qu'elle avait (invariant #3), et `player.eyePosition`
      // reste disponible non bobée comme origine de tir pour la Phase 2.
      const bob = player.viewBob(alpha, viewBobOffset);
      if (bob.x !== 0 || bob.y !== 0) {
        // Vecteur « droite » du joueur dans le plan horizontal. Avec l'Euler
        // 'YXZ' et un roll nul, l'axe droite de la caméra EST horizontal quel
        // que soit le pitch : (cos yaw, 0, −sin yaw), même convention que la
        // dérivation de wishX/wishZ dans PlayerController.update.
        camera.position.x += bob.x * Math.cos(look.yaw);
        camera.position.z += bob.x * -Math.sin(look.yaw);
        camera.position.y += bob.y;
      }

      // FOV : suit la vitesse horizontale RÉELLE (déjà reclippée sur le
      // mouvement effectivement réalisé — courir contre un mur n'élargit rien),
      // pas l'état de la touche sprint. Le facteur est lissé au pas fixe et
      // interpolé ici, donc la transition est continue à n'importe quel taux
      // d'affichage. `updateProjectionMatrix` n'est appelée que si la valeur
      // change vraiment : le lissage se colle exactement à sa cible, donc les
      // appels cessent dès que la vitesse est stable.
      const fov = fovForRunFactor(moveConfig, player.runFactorAt(alpha));
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },

    updateFx(realDt, stats) {
      if (realDt > 0) {
        fpsSmoothed += (1 / realDt - fpsSmoothed) * 0.1;
      }

      // Outillage (hors gameplay, lu au taux d'affichage) : F9 enregistre,
      // F10 rejoue. Sert de harnais A/B et de preuve de déterminisme.
      if (input.wasJustPressed("F9")) {
        if (inputRecorder.isRecording()) {
          lastRecording = inputRecorder.stopRecording();
          console.info(`[recorder] ${lastRecording?.frames.length ?? 0} pas fixes enregistrés`);
        } else {
          startRecording();
          console.info("[recorder] enregistrement démarré");
        }
      }
      if (input.wasJustPressed("F10") && lastRecording) {
        startPlayback(lastRecording);
        console.info(`[recorder] rejeu de ${lastRecording.frames.length} pas fixes`);
      }

      debugAccumulator += realDt;
      if (debugAccumulator >= DEBUG_UPDATE_INTERVAL) {
        debugAccumulator = 0;
        useGameStore.getState().setDebug({
          fps: fpsSmoothed,
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          entityCount: ENTITY_COUNT,
          steps: stats.steps,
          isGrounded: player.isGrounded,
          horizontalSpeed: player.horizontalSpeed,
          verticalSpeed: player.velocity.y,
          numCollisions: player.numCollisions,
          groundNormal: {
            x: player.groundNormal.x,
            y: player.groundNormal.y,
            z: player.groundNormal.z,
          },
        });
      }
    },

    render() {
      renderer.render(scene, camera);
    },
  });

  exposeDebugApi(player, () => lastRecording, startPlayback);
}

/**
 * Simulation hors écran d'une séquence enregistrée : même monde minimal, même
 * controller, aucune dépendance au rendu ni à l'horloge réelle.
 * Base du test de déterminisme et de l'A/B de config.
 */
function simulateRecording(rec: Recording, cfg: MoveConfig) {
  const world = new PhysicsWorld();
  const floor = world.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0));
  world.world.createCollider(
    RAPIER.ColliderDesc.cuboid(50, 0.1, 50).setCollisionGroups(COLLISION_GROUPS.WORLD),
    floor,
  );

  const sim = new PlayerController(world, cfg);
  const feetY = rec.start.position.y - (cfg.capsuleHalfHeight + cfg.capsuleRadius);
  sim.spawn(rec.start.position.x, feetY, rec.start.position.z);
  sim.velocity.set(rec.start.velocity.x, rec.start.velocity.y, rec.start.velocity.z);

  for (const frame of rec.frames) {
    sim.snapshotPrevious();
    sim.update(rec.fixedDt, frame);
    world.step(rec.fixedDt);
  }

  // Décalage de bob effectivement rendu au dernier pas (alpha = 1, soit la
  // frame d'affichage alignée sur le pas fixe). C'est la grandeur qui finit en
  // pixels : la comparer, et pas seulement ses entrées, est ce qui rend la
  // preuve de déterminisme utile pour `qa-evidence`.
  sim.viewBob(1, simBobScratch);

  const result = {
    position: { x: sim.position.x, y: sim.position.y, z: sim.position.z },
    velocity: { x: sim.velocity.x, y: sim.velocity.y, z: sim.velocity.z },
    distanceTravelled: sim.distanceTravelled,
    bobIntensity: sim.bobIntensity,
    bobOffset: { x: simBobScratch.x, y: simBobScratch.y },
    runFactor: sim.runFactor,
    fov: fovForRunFactor(cfg, sim.runFactor),
    landingDip: sim.landingDip,
  };
  world.world.free();
  return result;
}

const simBobScratch = new THREE.Vector3();

/**
 * Test de déterminisme : la même séquence d'input rejouée deux fois doit
 * produire le même état final à 1e-6 près. Un échec signale une source de
 * non-déterminisme dans le pas fixe (`Math.random` non seedé, `Date.now`,
 * ou une lecture d'input hors accumulateur).
 *
 * L'écart couvre aussi les grandeurs de VUE (bob, FOV, réception) : elles
 * finissent en pixels et doivent donc être reproductibles au même titre que la
 * position. Une horloge murale glissée dans le bob se verrait immédiatement
 * ici, sous forme d'un écart non nul sur `bobOffset` malgré des positions
 * identiques.
 */
function checkDeterminism(rec: Recording) {
  const a = simulateRecording(rec, moveConfig);
  const b = simulateRecording(rec, moveConfig);
  const delta = Math.max(
    Math.abs(a.position.x - b.position.x),
    Math.abs(a.position.y - b.position.y),
    Math.abs(a.position.z - b.position.z),
    Math.abs(a.velocity.x - b.velocity.x),
    Math.abs(a.velocity.y - b.velocity.y),
    Math.abs(a.velocity.z - b.velocity.z),
    Math.abs(a.distanceTravelled - b.distanceTravelled),
    Math.abs(a.bobOffset.x - b.bobOffset.x),
    Math.abs(a.bobOffset.y - b.bobOffset.y),
    Math.abs(a.fov - b.fov),
    Math.abs(a.landingDip - b.landingDip),
  );
  const passed = delta < 1e-6;
  console.info(
    `[determinism] ${rec.frames.length} pas fixes · écart max ${delta.toExponential(3)} · ${
      passed ? "OK" : "ÉCHEC"
    }`,
  );
  return { passed, delta, a, b };
}

declare global {
  interface Window {
    cassandre: {
      moveConfig: MoveConfig;
      player: PlayerController;
      recorder: typeof inputRecorder;
      lastRecording: () => Recording | null;
      playRecording: (rec: Recording) => void;
      exportRecording: (rec: Recording) => string;
      importRecording: (json: string) => Recording;
      simulateRecording: (rec: Recording, cfg?: MoveConfig) => ReturnType<typeof simulateRecording>;
      checkDeterminism: (rec: Recording) => ReturnType<typeof checkDeterminism>;
      feelVariants: typeof FEEL_VARIANTS;
      applyFeelVariant: (name: keyof typeof FEEL_VARIANTS) => FeelVariantReport;
    };
  }
}

interface FeelVariantReport {
  variant: keyof typeof FEEL_VARIANTS;
  bobVerticalAmplitude: number;
  bobLateralAmplitude: number;
  fovRange: string;
  landingDipMax: number;
}

/**
 * Applique une variante de feel de la VUE, à chaud.
 *
 * `player.applyConfig()` n'est délibérément PAS appelé : aucun champ de vue
 * n'est lu par Rapier, ils sont relus à chaque pas fixe et à chaque frame.
 * L'appeler recréerait la capsule pour rien.
 *
 * Protocole de comparaison, trois lignes :
 *   1. F9, cours et saute ~15 s dans le couloir nord, F9 pour arrêter ;
 *   2. `cassandre.applyFeelVariant("A")` puis F10 — recommence avec "B", "C" ;
 *   3. la course rejouée est identique au pas fixe près, seule la vue change :
 *      c'est la variante, pas ta façon de jouer, que tu compares.
 */
function applyFeelVariant(name: keyof typeof FEEL_VARIANTS): FeelVariantReport {
  Object.assign(moveConfig, FEEL_VARIANTS[name]);
  const report: FeelVariantReport = {
    variant: name,
    bobVerticalAmplitude: moveConfig.bobVerticalAmplitude,
    bobLateralAmplitude: moveConfig.bobLateralAmplitude,
    fovRange: `${moveConfig.fovBase}° → ${moveConfig.fovBase + moveConfig.fovRunBoost}°`,
    landingDipMax: moveConfig.landingDipMax,
  };
  console.info(`[feel] variante ${name} appliquée`, report);
  return report;
}

/** Point d'entrée console pour l'A/B de `feel-tuner` et les preuves de `qa-evidence`. */
function exposeDebugApi(
  player: PlayerController,
  lastRecording: () => Recording | null,
  playRecording: (rec: Recording) => void,
) {
  window.cassandre = {
    moveConfig,
    player,
    recorder: inputRecorder,
    lastRecording,
    playRecording,
    exportRecording: recordingToJson,
    importRecording: recordingFromJson,
    simulateRecording: (rec, cfg = moveConfig) => simulateRecording(rec, cfg),
    checkDeterminism,
    feelVariants: FEEL_VARIANTS,
    applyFeelVariant,
  };
}

main();
