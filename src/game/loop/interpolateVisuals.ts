import * as THREE from "three";
import { Effect } from "effect";

import { runGameplaySync } from "../../app/runtime/gameRuntime";
import { createEnemyAnimationInput, enemySpriteRow } from "../../render/sprites/enemySprites";
import { fovForRunFactor, moveConfig } from "../player/movement/moveConfig";
import { type GameEngine } from "../session/gameEngine";
import { suitSheetFor } from "../session/spawning";
// `engine` est injecté en paramètre explicite (jamais une fermeture sur
// `main()`) depuis l'extraction de ce fichier hors de `main.ts`.
// see: docs/archive/systems-boucle-de-jeu.md#origine-des-modules

// see: docs/6-reference/notes-code-gameplay.md#boucle-et-présentation
const eyePosition = new THREE.Vector3();
const cameraEuler = new THREE.Euler(0, 0, 0, "YXZ");
// Scratch du head bob : réutilisé à chaque frame, zéro allocation en régime établi.
const viewBobOffset = new THREE.Vector3();
// Scratch d'interpolation des Costards, réutilisés séquentiellement pour
// chaque `Suit` (consommés immédiatement par `sprite.updatePose`, jamais
// retenus — sûr malgré le partage, comme `movementScratch` dans `suit.ts`).
const suitPositionScratch = new THREE.Vector3();
const suitForwardScratch = new THREE.Vector3();
// Même rôle, pour le Directeur.
const directorPositionScratch = new THREE.Vector3();
const directorForwardScratch = new THREE.Vector3();
const enemyAnimationScratch = createEnemyAnimationInput();

// Tourne au taux d'affichage, pas le pas fixe — même frontière Effect
// synchrone stricte (`runGameplaySync`) que le pas fixe.
// see: docs/archive/systems-boucle-de-jeu.md#frontière-effect-synchrone-du-pas-fixe
export function interpolateVisuals(engine: GameEngine, alpha: number): void {
  const session = engine.session;
  runGameplaySync(
    Effect.gen(function* () {
      yield* Effect.sync(() => {
        if (session.ballMesh) {
          session.ballMesh.position.lerpVectors(engine.ballPrevPos, engine.ballCurrPos, alpha);
          session.ballMesh.quaternion.slerpQuaternions(engine.ballPrevQuat, engine.ballCurrQuat, alpha);
        }
      });

      // La rotation brute a déjà été capturée au taux d'affichage par
      // `updateDisplayInput`, AVANT les pas fixes. Ici elle est seulement
      // recopiée sur la caméra, sans interpolation (invariant #3).
      yield* Effect.sync(() => {
        cameraEuler.set(engine.look.pitch, engine.look.yaw, 0);
        engine.camera.quaternion.setFromEuler(cameraEuler);
      });

      yield* Effect.sync(() => {
        // Position caméra : capsule interpolée + hauteur des yeux.
        engine.camera.position.copy(session.player.eyePosition(alpha, eyePosition));

        const bob = session.player.viewBob(alpha, viewBobOffset);
        if (bob.x !== 0 || bob.y !== 0) {
          engine.camera.position.x += bob.x * Math.cos(engine.look.yaw);
          engine.camera.position.z += bob.x * -Math.sin(engine.look.yaw);
          engine.camera.position.y += bob.y;
        }

        const fov = fovForRunFactor(moveConfig, session.player.runFactorAt(alpha));
        if (engine.camera.fov !== fov) {
          engine.camera.fov = fov;
          engine.camera.updateProjectionMatrix();
        }

        engine.viewmodel.update(alpha, session.weapons);
      });

      yield* Effect.sync(() => {
        session.trainRideGym?.presentation.interpolate(session.trainRideGym.system, alpha, session.stats.gameplayElapsed);
        const trains = session.gltfLevelSession?.current?.trains;
        const blockout = session.gltfLevelSession?.current?.metroBlockout;
        session.gltfLevelSession?.current?.fountainWater?.interpolate(engine.flow.isPlaying() ? alpha : 1);
        blockout?.presentation.interpolate(blockout.system, alpha, session.stats.gameplayElapsed);
        trains?.presentation.interpolate(trains.system, alpha, session.stats.gameplayElapsed);
        trains?.beacons.update(trains.system, session.stats.gameplayElapsed);
        session.trainGym?.presentation.interpolate(session.trainGym.system, alpha, session.stats.gameplayElapsed);
        session.propSystem?.interpolate(alpha, engine.camera.position);
        session.doorSystem?.interpolate(alpha);
        // Objets interactifs : élagués par distance comme les props, pour la
        // même raison (voir `render/environment/useObjectCulling.ts`).
        engine.useObjectCulling.update(
          session.gltfLevelSession?.current?.useObjects ?? [],
          engine.camera.position,
        );
        // Sanitaires : même élagage, même portée — une cuvette est aussi
        // petite qu'une trousse (voir `SanitaireMergeResult.rendus`).
        engine.useObjectCulling.update(
          session.gltfLevelSession?.current?.sanitaireRendus ?? [],
          engine.camera.position,
        );

        // Costards : position/forward interpolés (jamais les valeurs brutes du
        // pas fixe, voir la doc de `BillboardSprite.updatePose`), une fois par
        // Costard vivant OU cadavre (le cadavre reste affiché, figé).
        for (const suit of session.suitManager.suits) {
          const sprite = session.suitSprites.get(suit.id);
          if (!sprite) continue;
          const pos = suit.interpolatedPosition(alpha, suitPositionScratch);
          const fwd = suit.interpolatedForward(alpha, suitForwardScratch);
          const row = enemySpriteRow(suitSheetFor(engine, suit.kind), suit.animation(enemyAnimationScratch));
          sprite.updatePose(engine.camera, pos, fwd, row);
          engine.fx.followEnemyAppearance(sprite, suit.appearanceProgress, suit.isAlive);
        }

        // Même chose pour le Directeur (au plus un, mais `directors` reste un
        // tableau — voir la doc de `DirectorManager`).
        for (const director of session.directorManager.directors) {
          const sprite = session.directorSprites.get(director.id);
          if (!sprite) continue;
          const pos = director.interpolatedPosition(alpha, directorPositionScratch);
          const fwd = director.interpolatedForward(alpha, directorForwardScratch);
          const row = enemySpriteRow(engine.directorSheet, director.animation(enemyAnimationScratch));
          sprite.updatePose(engine.camera, pos, fwd, row);
        }
      });
    }),
  );
}
