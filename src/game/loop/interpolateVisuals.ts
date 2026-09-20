import * as THREE from "three";
import { Effect } from "effect";

import { input } from "../../core/input";
import { inputRecorder } from "../../core/inputRecorder";
import { runGameplaySync } from "../../core/runtime";
import { createEnemyAnimationInput, enemySpriteRow } from "../../render/enemySprites";
import { fovForRunFactor, moveConfig } from "../player/moveConfig";
import { type GameEngine } from "../session/gameEngine";

// `engine` est injecté en paramètre explicite (jamais une fermeture sur
// `main()`) depuis l'extraction de ce fichier hors de `main.ts`.
// see: docs/systems/boucle-de-jeu.md#origine-des-modules

// Scratch vectors ci-dessous : locaux à CE fichier (contrairement à
// `ballPrevPos`/`ballCurrPos`, partagés avec `loop/stepPhysics.ts` via
// `GameEngine` — voir `session/gameEngine.ts`) — rester des `const`
// module-locaux plutôt que des champs de `GameEngine` donne le même effet
// (persistants, zéro allocation en régime établi) sans gonfler l'interface
// partagée.
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
// see: docs/systems/boucle-de-jeu.md#frontière-effect-synchrone-du-pas-fixe
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

      // EXCEPTION EXPLICITE, non négociable (invariant #3, voir
      // PLAN_EFFECT_XSTATE.md §9) : la rotation caméra reste un
      // Effect.sync FEUILLE, sans aucune indirection de service — un
      // enveloppement plus profond (générateur imbriqué, service)
      // ajouterait de la latence de visée. Rotation lue au taux
      // d'affichage, jamais interpolée (latence de visée sinon).
      yield* Effect.sync(() => {
        const { dx, dy } = input.consumeMouseDelta();
        if (!inputRecorder.isPlaying()) {
          engine.lookDelta.dx += dx;
          engine.lookDelta.dy += dy;
          engine.look.yaw -= dx * moveConfig.lookSensitivity;
          engine.look.pitch -= dy * moveConfig.lookSensitivity;
          const pitchLimit = (moveConfig.pitchLimitDeg * Math.PI) / 180;
          engine.look.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, engine.look.pitch));
        }
        cameraEuler.set(engine.look.pitch, engine.look.yaw, 0);
        engine.camera.quaternion.setFromEuler(cameraEuler);
      });

      yield* Effect.sync(() => {
        // Position caméra : capsule interpolée + hauteur des yeux.
        engine.camera.position.copy(session.player.eyePosition(alpha, eyePosition));

        // Head bob + enfoncement de réception : ajoutés à la POSITION de la
        // caméra, jamais à sa rotation. La visée garde donc exactement la latence
        // et la stabilité qu'elle avait (invariant #3), et `player.eyePosition`
        // reste disponible non bobée comme origine de tir pour la Phase 2.
        const bob = session.player.viewBob(alpha, viewBobOffset);
        if (bob.x !== 0 || bob.y !== 0) {
          // Vecteur « droite » du joueur dans le plan horizontal. Avec l'Euler
          // 'YXZ' et un roll nul, l'axe droite de la caméra EST horizontal quel
          // que soit le pitch : (cos yaw, 0, −sin yaw), même convention que la
          // dérivation de wishX/wishZ dans PlayerController.update.
          engine.camera.position.x += bob.x * Math.cos(engine.look.yaw);
          engine.camera.position.z += bob.x * -Math.sin(engine.look.yaw);
          engine.camera.position.y += bob.y;
        }

        // FOV : suit la vitesse horizontale RÉELLE (déjà reclippée sur le
        // mouvement effectivement réalisé — courir contre un mur n'élargit rien),
        // pas l'état de la touche sprint. Le facteur est lissé au pas fixe et
        // interpolé ici, donc la transition est continue à n'importe quel taux
        // d'affichage. `updateProjectionMatrix` n'est appelée que si la valeur
        // change vraiment : le lissage se colle exactement à sa cible, donc les
        // appels cessent dès que la vitesse est stable.
        const fov = fovForRunFactor(moveConfig, session.player.runFactorAt(alpha));
        if (engine.camera.fov !== fov) {
          engine.camera.fov = fov;
          engine.camera.updateProjectionMatrix();
        }

        // Viewmodel : APRÈS que position/rotation/FOV de la caméra sont posés
        // ci-dessus — l'offset de `weapons.viewmodelPose` est purement local à
        // la caméra (voir `render/viewmodel.ts`), il n'a pas besoin de les lire,
        // mais reste cohérent dans la même frame en s'appliquant après eux.
        // Aucun reset explicite nécessaire au changement de session (Jalon M8) :
        // `viewmodel.update` relit `session.weapons.activeWeapon` EN DIRECT à
        // chaque frame, donc dès le premier appel qui suit un reset, il affiche
        // déjà la pose correcte pour la NOUVELLE session — voir la doc de tête
        // de `render/viewmodel.ts`.
        engine.viewmodel.update(alpha, session.weapons);
      });

      yield* Effect.sync(() => {
        // Mobilier physique : même patron que la balle plus haut, généralisé à
        // N objets. APRÈS le bloc caméra, comme les billboards juste en
        // dessous : `interpolate` élague par distance à la caméra, il lui faut
        // donc la position de CETTE frame, pas celle de la précédente. Il saute
        // de lui-même tout prop endormi ou hors de portée — donc, en régime
        // établi, la quasi-totalité d'entre eux.
        session.propSystem?.interpolate(alpha, engine.camera.position);
        // Portes animées : même patron qu'au-dessus, sans élagage par
        // distance — les vantaux d'un même matériau tiennent dans un seul lot
        // de dessin, qui élimine déjà chaque vantail hors champ
        // (`batchDoorMeshes`) — voir `DoorSystem.interpolate`.
        session.doorSystem?.interpolate(alpha);
        // Objets interactifs : élagués par distance comme les props, pour la
        // même raison (voir `render/useObjectCulling.ts`).
        engine.useObjectCulling.update(
          session.gltfLevelSession?.current?.useObjects ?? [],
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
          const row = enemySpriteRow(engine.suitSheet, suit.animation(enemyAnimationScratch));
          sprite.updatePose(engine.camera, pos, fwd, row);
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
