import { trainConfig } from "../level/trains/trainConfig";
import { kickConfig } from "../player/weapons/kickConfig";
import * as THREE from "three";
import { Effect } from "effect";

import {
  playTrainWarning,
  playDoorMovementSfx,
  playEnemySfx,
  playImpactSfx,
  playPropBreakSfx,
  playSfx,
  playWeaponFireSfx,
} from "../../core/audio/audio";
import { input } from "../../core/input/input";
import { updateWaterAmbience } from "../../core/audio/waterAmbience";
import { updateShowerAmbience } from "../../core/audio/showerAmbience";
import { updateZoneAmbience } from "../../core/audio/zoneAmbience";
import { runGameplaySync } from "../../app/runtime/gameRuntime";
import { type LoopStats } from "../../core/loop/loop";
import { FLESH_MATERIAL } from "../player/weapons/weapons";
import { weaponConfig } from "../player/weapons/weaponConfig";
import { suitConfig } from "../entities/suit/suitConfig";
import { directorConfig } from "../entities/director/directorConfig";
import { useGameStore } from "../hud/state";
import { presentPlayerDamage } from "../session/player/feedback";
import { isMovableOrBreakableHandle } from "../level/loading/movableColliders";
import { type GameEngine } from "../session/gameEngine";
import type { GameSession } from "../session/gameSession";
import { astarMetricsSnapshot } from "../level/navigation/navSearch";
import { collectActiveShowerOrigins } from "../level/sanitaires/douches";
// `engine` est injecté en paramètre explicite (jamais une fermeture sur
// `main()`) depuis l'extraction de ce fichier hors de `main.ts`.
// see: docs/archive/systems-boucle-de-jeu.md#origine-des-modules

// see: docs/archive/systems-rendu.md#découplage-entre-render-et-game
const PROP_DEBRIS: Record<string, { color: number; count: number }> = {
  bois: { color: 0x6b4a2a, count: 10 },
  // Le carton part en plus gros morceaux, et moins nombreux : un carton
  // s'écrase, il n'éclate pas.
  carton: { color: 0x8a6a42, count: 7 },
  // Le verre est le seul qui vaut vraiment la dépense : beaucoup d'éclats
  // clairs, c'est LUI qui fait lire « ça s'est cassé » à 640×360.
  verre: { color: 0xa8d8e8, count: 18 },
  metal: { color: 0x8a8f96, count: 8 },
  // see: docs/6-reference/notes-code-gameplay.md#boucle-et-présentation
  farine: { color: 0xe8e0c8, count: 16 },
  eau: { color: 0x6fb8ff, count: 14 },
  electronique: { color: 0x2f2f38, count: 10 },
  // Tôle rouge de la bonbonne ; le feu et la fumée viennent de `spawnExplosion`.
  gaz: { color: 0xb02931, count: 12 },
};

/** Secousse d'une explosion : nettement plus forte et plus longue que celle d'un tir. */
const EXPLOSION_SHAKE_AMPLITUDE = 0.45;
const EXPLOSION_SHAKE_DURATION = 0.4;
/** Au-delà, l'explosion ne secoue plus la caméra — elle reste entendue. */
const EXPLOSION_SHAKE_RANGE = 25;
const DEFAULT_PROP_DEBRIS = PROP_DEBRIS.bois!;

// Scratch de l'offset de screenshake, réutilisé à chaque frame (`fx.currentShakeOffset`).
const shakeOffsetScratch = new THREE.Vector3();
const muzzleScratch = new THREE.Vector3();
const muzzleDirectionScratch = new THREE.Vector3();
const FLASH_WEAPONS = ["pistol", "shotgun"] as const;
const sprayDirectionScratch = new THREE.Vector3();
/** Matière d'un tir arrêté par un bouclier : le son et les éclats d'un impact de métal. */
const SHIELD_MATERIAL = "metal";

const waterListenerRightScratch = new THREE.Vector3();
const waterJetOriginScratch: THREE.Vector3[] = [];
const showerOriginScratch: THREE.Vector3[] = [];

const DEBUG_UPDATE_INTERVAL = 1 / 10; // invariant #2 : 10 Hz maximum

// Tourne au taux d'affichage, comme `interpolateVisuals` — même frontière
// Effect synchrone stricte (`runGameplaySync`) que le pas fixe.
// see: docs/archive/systems-boucle-de-jeu.md#frontière-effect-synchrone-du-pas-fixe
type FxSession = Readonly<Pick<GameSession,
  "ballBody" | "directorManager" | "directorSprites" | "doorSystem" | "gltfLevelSession" |
  "ecranSystem" | "lightPool" | "player" | "playerHp" | "propSystem" | "sanitaireSystem" |
  "suitManager" | "suitSprites" | "vitreSystem" | "weaponPickupBillboards" | "weapons" |
  "cardPickupBillboards" | "droppedCardBillboard" | "heroPortrait" | "pickupResources" | "trainGym"
>>;
type FxEngine = Omit<Pick<GameEngine,
  "ballisticsDebug" | "camera" | "crosshair" | "debugAccumulator" | "directorSheet" |
  "flow" | "fpsSmoothed" | "fx" | "hitmarker" | "renderer" | "viewmodel" | "wireframeToggle"
>, "session"> & { readonly session: FxSession };

export function updateFx(engine: FxEngine, realDt: number, stats: LoopStats): void {
  const session = engine.session;
  let playerWasHit = false;
  runGameplaySync(
    Effect.gen(function* () {
      yield* Effect.sync(() => {
        if (realDt > 0) {
          engine.fpsSmoothed += (1 / realDt - engine.fpsSmoothed) * 0.1;
        }

        engine.fx.update(realDt);
        // see: docs/decisions/0026-visibilite-par-espace-et-pool-de-lampes.md
        session.lightPool?.update(engine.camera.position);
        engine.hitmarker.update(realDt);
        engine.crosshair.update(realDt);
        engine.ballisticsDebug.update(realDt);
      });

      yield* Effect.sync(() => {
        const trainWarnings = session.trainGym?.system.takeWarningSounds() ?? 0;
        if (trainWarnings > 0 && trainConfig.soundWarning) playTrainWarning();
        const levelTrains = session.gltfLevelSession?.current?.trains;
        const levelWarnings = levelTrains?.system.takeWarningSounds() ?? 0;
        if (levelWarnings > 0 && levelTrains?.config.soundWarning) playTrainWarning();
        for (const event of session.weapons.fireEvents) {
          if (event.weapon === "pistol" || event.weapon === "shotgun") {
            engine.fx.spawnMuzzleFlash(
              engine.viewmodel.muzzleWorldPosition(muzzleScratch, event.weapon),
              engine.viewmodel.muzzleWorldDirection(muzzleDirectionScratch, event.weapon),
              event.weapon,
            );
          }
          if (event.weapon === "shotgun") {
            engine.fx.spawnShellCasing(event.muzzlePosition, event.muzzleDirection);
          }
          playWeaponFireSfx(event.weapon);
          // Réticule : pulsation à CHAQUE tir déclenché (indépendant d'un hit,
          // voir `CrosshairOverlay.notifyFire`), no-op si désactivée en config.
          engine.crosshair.notifyFire();
          if ((event.weapon === "pistol" || event.weapon === "shotgun") && event.pelletEndpoints) {
            engine.ballisticsDebug.recordShotgunFire(event.muzzlePosition, event.pelletEndpoints);
          } else if (event.weapon === "melee" || event.weapon === "kick") {
            engine.ballisticsDebug.recordMeleeFire(
              event.muzzlePosition,
              event.muzzleDirection,
              event.weapon === "kick" ? kickConfig.range : weaponConfig.meleeRange,
              event.weapon === "kick" ? kickConfig.hitRadius : weaponConfig.meleeHitRadius,
            );
          }
        }
        for (const weapon of FLASH_WEAPONS) {
          engine.fx.followMuzzleFlash(
            engine.viewmodel.muzzleWorldPosition(muzzleScratch, weapon),
            engine.viewmodel.muzzleWorldDirection(muzzleDirectionScratch, weapon),
            weapon,
          );
        }
        for (const hit of session.weapons.hitEvents) {
          // Arrêté par un bouclier : ni sang ni marqueur, un impact de métal sur l'ennemi.
          const blocked = session.suitManager.blockedHits.has(hit);
          const material = blocked ? SHIELD_MATERIAL : hit.material;
          const onEnemy = hit.material === FLESH_MATERIAL;
          const isEnemyHit = onEnemy && !blocked;
          if (!onEnemy && !isMovableOrBreakableHandle(session.gltfLevelSession, hit.colliderHandle)) {
            engine.fx.spawnImpactDecal(hit.point, hit.normal, hit.material);
          }
          engine.fx.spawnImpactParticles(hit.point, hit.normal, hit.weapon, material);
          if (isEnemyHit) {
            // Le sang part dans l'axe du coup, sur ce qu'il y a derrière l'ennemi.
            sprayDirectionScratch.subVectors(hit.point, engine.camera.position).normalize();
            engine.fx.spawnBloodSpray(hit.point, sprayDirectionScratch, hit.weapon);
          }
          engine.fx.triggerShake(
            isEnemyHit ? weaponConfig.enemyShakeAmplitude : weaponConfig.shakeAmplitude,
            isEnemyHit ? weaponConfig.enemyShakeDuration : weaponConfig.shakeDuration,
          );
          // Hitmarker : uniquement sur un hit ENEMY confirmé — un hit mur n'a
          // pas vocation à alimenter ce canal (voir doc de `hitmarker.ts`).
          if (isEnemyHit) engine.hitmarker.trigger("hit");
          playImpactSfx(material);
        }
        session.weapons.clearFrameEvents();
      });

      yield* Effect.sync(() => {
        // Décroissance TEMPS RÉEL du flash de dégâts de chaque Costard — jamais
        // au pas fixe (même séparation que `fx.update(realDt)` juste au-dessus).
        for (const sprite of session.suitSprites.values()) sprite.updateFlash(realDt);

        session.pickupResources?.advanceWeaponClock(realDt);
        for (const billboard of session.weaponPickupBillboards) billboard.update(engine.camera);
        for (const billboard of session.cardPickupBillboards) billboard.update(engine.camera, realDt);
        session.droppedCardBillboard?.update(engine.camera, realDt);

        // Lecture NON DESTRUCTIVE des files de `suitManager`, même contrat que
        // `weapons.fireEvents`/`hitEvents` ci-dessus : tous les lecteurs
        // d'abord, `suitManager.clearFrameEvents()` en tout dernier.
        // Chaque espèce a sa voix (`Suit.kind`) : le Rampant siffle là où le Costard interpelle.
        for (const event of session.suitManager.alertEvents) {
          // Pas de sprite dédié à l'alerte : la pose ALERTE (ligne d'atlas) suffit, le son est le seul canal supplémentaire ici.
          playEnemySfx("alert", event.suit.kind);
        }
        for (const event of session.suitManager.telegraphEvents) {
          // Règle non négociable du skill : le son de télégraphie part AVANT
          // les dégâts (`attackTelegraphDuration` >= 0.2 s sépare ce point de
          // la résolution de l'attaque dans `runAttack`).
          playEnemySfx("telegraph", event.suit.kind);
        }
        for (const event of session.suitManager.shotEvents) {
          playEnemySfx("shot", event.suit.kind);
        }
        for (const event of session.suitManager.hurtEvents) {
          session.suitSprites.get(event.suit.id)?.setFlash(1, event.suit.cfg.hitFlashDuration);
          playEnemySfx("hurt", event.suit.kind);
        }
        for (const event of session.suitManager.deathEvents) {
          if (event.gibs) {
            // Bout portant au pompe : gibs À LA PLACE de l'animation de mort
            // normale (le Costard reste en état "dead"/"corpse" côté simulation
            // pour la persistance du cadavre — seul le RENDU change ici).
            engine.fx.spawnGibs(event.point, event.direction);
            playSfx("enemy_gib");
          } else {
            engine.fx.spawnBloodPool(event.suit.position);
          }
          engine.hitmarker.trigger("kill");
          playEnemySfx("death", event.suit.kind);
          // Les vues et le premier kill sont déjà décidés dans le pas fixe.
        }
        for (const event of session.suitManager.playerHitEvents) {
          playerWasHit = true;
          engine.fx.spawnImpactParticles(event.point, event.normal, "shotgun", "flesh");
          engine.fx.triggerShake(suitConfig.playerHitShakeAmplitude, suitConfig.playerHitShakeDuration);
        }
        session.suitManager.clearFrameEvents();
      });

      yield* Effect.sync(() => {
        for (const sprite of session.directorSprites.values()) sprite.updateFlash(realDt);

        for (const event of session.directorManager.alertEvents) {
          void event;
          playEnemySfx("alert");
        }
        for (const event of session.directorManager.telegraphEvents) {
          void event;
          playEnemySfx("telegraph");
        }
        for (const event of session.directorManager.shotEvents) {
          void event;
          playEnemySfx("shot");
        }
        for (const event of session.directorManager.hurtEvents) {
          session.directorSprites.get(event.director.id)?.setFlash(1, directorConfig.hitFlashDuration);
          playEnemySfx("hurt");
        }
        for (const event of session.directorManager.revealEvents) {
          // Bascule costume humain -> reptilien, UNE FOIS ici (événement
          // discret) : la peau `revele` de la planche, ou à défaut (planche de
          // repli) une teinte — voir `Director.tintColor`/`revealed`.
          const sprite = session.directorSprites.get(event.director.id);
          const revealedAtlas = engine.directorSheet.atlases.revele;
          if (revealedAtlas) sprite?.setAtlas(revealedAtlas);
          else sprite?.setTint(event.director.tintColor);
          engine.fx.triggerShake(directorConfig.revealShakeAmplitude, directorConfig.revealShakeDuration);
        }
        for (const event of session.directorManager.deathEvents) {
          // Pas de gibs pour le Directeur (voir la doc de `DirectorManager`) : il laisse une flaque.
          engine.fx.spawnBloodPool(event.director.position);
          engine.hitmarker.trigger("kill");
          playEnemySfx("death");
          // Le multiplicateur de vues du Directeur est déjà appliqué au pas fixe.
        }
        for (const event of session.directorManager.playerHitEvents) {
          playerWasHit = true;
          // PAS de decal ici, même raison que le bloc équivalent du Costard
          // juste au-dessus (le joueur bouge en permanence).
          engine.fx.spawnImpactParticles(event.point, event.normal, "shotgun", "flesh");
          engine.fx.triggerShake(directorConfig.playerHitShakeAmplitude, directorConfig.playerHitShakeDuration);
        }
        if (playerWasHit || useGameStore.getState().debug.playerHp !== session.playerHp) presentPlayerDamage(session.playerHp);
        session.directorManager.clearFrameEvents();
      });

      yield* Effect.sync(() => {
        const props = session.propSystem;
        if (props) {
          for (const event of props.destroyedEvents) {
            const debris = PROP_DEBRIS[event.matiere] ?? DEFAULT_PROP_DEBRIS;
            engine.fx.spawnDebris(event.point, event.direction, debris.color, debris.count);
            engine.fx.triggerShake(weaponConfig.shakeAmplitude, weaponConfig.shakeDuration);
            playPropBreakSfx(event.matiere);
          }
          for (const event of props.explosionEvents) {
            engine.fx.spawnExplosion(event.point);
            const proximite = 1 - session.player.position.distanceTo(event.point) / EXPLOSION_SHAKE_RANGE;
            if (proximite > 0) engine.fx.triggerShake(EXPLOSION_SHAKE_AMPLITUDE * proximite, EXPLOSION_SHAKE_DURATION);
            playSfx("explosion", Math.max(0.35, proximite));
          }
          props.clearFrameEvents();
        }
      });

      yield* Effect.sync(() => {
        // Obstacles cassables (`vitre_*`) : débris et son suivent leur matière
        // (`verre` par défaut), sans changer le coût du lot fusionné.
        const vitres = session.vitreSystem;
        if (vitres) {
          for (const event of vitres.destroyedEvents) {
            const debris = PROP_DEBRIS[event.matiere] ?? DEFAULT_PROP_DEBRIS;
            engine.fx.spawnDebris(event.point, event.direction, debris.color, debris.count);
            if (event.givre) engine.fx.spawnFrostBurst(event.point);
            engine.fx.triggerShake(weaponConfig.shakeAmplitude, weaponConfig.shakeDuration);
            playPropBreakSfx(event.matiere);
          }
          vitres.clearFrameEvents();
        }

        const sanitaires = session.sanitaireSystem;
        if (sanitaires) {
          for (const event of sanitaires.destroyedEvents) {
            engine.fx.spawnCeramicBurst(event.point, event.direction);
            engine.fx.addWaterJet(event.jetOrigin);
            engine.fx.triggerShake(weaponConfig.shakeAmplitude, weaponConfig.shakeDuration);
            playSfx("sanitaire_break");
          }
          sanitaires.clearFrameEvents();
        }

        // Écrans (`ecran_*`) — même contrat que les vitrages : l'image passe à
        // l'état « casse » côté `EcranSystem`, ici seulement les étincelles.
        const ecrans = session.ecranSystem;
        if (ecrans) {
          for (const event of ecrans.destroyedEvents) {
            const debris = PROP_DEBRIS.electronique ?? DEFAULT_PROP_DEBRIS;
            engine.fx.spawnDebris(event.point, new THREE.Vector3(0, 1, 0), debris.color, debris.count);
            playPropBreakSfx("electronique");
          }
          ecrans.clearFrameEvents();
        }

        // Portes animées — un son au DÉBUT de chaque ouverture depuis l'état
        // fermé (voir `DoorSystem.movementEvents`), jamais à la fermeture.
        const doors = session.doorSystem;
        if (doors) {
          for (const event of doors.movementEvents) playDoorMovementSfx(event.movement);
          doors.clearFrameEvents();
        }
      });

      yield* Effect.sync(() => {
        // see: docs/archive/systems-hud-audio.md#boucle-deau-positionnelle
        if (session.sanitaireSystem) session.sanitaireSystem.collectActiveJetOrigins(waterJetOriginScratch);
        else waterJetOriginScratch.length = 0;
        waterListenerRightScratch.set(1, 0, 0).applyQuaternion(engine.camera.quaternion);
        updateWaterAmbience(
          engine.camera.position,
          waterListenerRightScratch,
          waterJetOriginScratch,
          realDt,
          engine.flow.isPlaying(),
        );
        updateZoneAmbience(engine.camera.position, realDt, engine.flow.isPlaying());
        const levelRoot = session.gltfLevelSession?.current?.root ?? null;
        collectActiveShowerOrigins(levelRoot, showerOriginScratch);
        updateShowerAmbience(
          engine.camera.position,
          waterListenerRightScratch,
          showerOriginScratch,
          realDt,
          engine.flow.isPlaying(),
        );
      });

      yield* Effect.sync(() => {
        engine.camera.position.add(engine.fx.currentShakeOffset(shakeOffsetScratch));

        // see: docs/archive/reference-controles.md#touches-de-dev
        if (import.meta.env.DEV) {
          // KeyV : wireframe de toute la scène, mutation ponctuelle sur appui
          // (invariant #2 — pas de lecture continue, pas de setState par frame).
          if (input.wasJustPressed("KeyV")) {
            const enabled = engine.wireframeToggle.toggle();
            console.info(`[debug] wireframe ${enabled ? "activé" : "désactivé"}`);
          }
          // KeyB (ballistics) : gizmos balistiques de debug, actifs par défaut
          // en dev (voir la doc de tête de `render/debug/ballisticsDebug.ts`) — même pattern
          // de bascule ponctuelle que KeyV ci-dessus.
          if (input.wasJustPressed("KeyB")) {
            const enabled = engine.ballisticsDebug.toggle();
            console.info(`[debug] gizmos balistiques ${enabled ? "activés" : "désactivés"}`);
          }
        }

        engine.debugAccumulator += realDt;
        if (engine.debugAccumulator >= DEBUG_UPDATE_INTERVAL) {
          engine.debugAccumulator = 0;
          const astar = astarMetricsSnapshot();
          useGameStore.getState().setHeroPortrait(session.heroPortrait.view);
          useGameStore.getState().setDebug({
            fps: engine.fpsSmoothed,
            position: { x: engine.camera.position.x, y: engine.camera.position.y, z: engine.camera.position.z },
            entityCount: (session.ballBody ? 1 : 0) + session.suitManager.suits.length,
            steps: stats.steps,
            // Jalon M7 (PLAN_EFFECT_XSTATE.md, §9) : voir la doc de
            // `LoopStats` (`core/loop/loop.ts`) pour la définition exacte.
            gameplayMs: stats.gameplayMs,
            gameplayP95Ms: stats.gameplayP95Ms,
            astarQueries: astar.queries,
            astarMisses: astar.misses,
            astarExpandedNodes: astar.expandedNodes,
            astarLastMs: astar.lastMs,
            astarMaxMs: astar.maxMs,
            physicsMs: stats.physicsMs,
            renderMs: stats.renderMs,
            drawCalls: engine.renderer.info.render.calls,
            triangles: engine.renderer.info.render.triangles,
            isGrounded: session.player.isGrounded,
            horizontalSpeed: session.player.horizontalSpeed,
            verticalSpeed: session.player.velocity.y,
            numCollisions: session.player.numCollisions,
            groundNormal: {
              x: session.player.groundNormal.x,
              y: session.player.groundNormal.y,
              z: session.player.groundNormal.z,
            },
            shotgunAmmo: session.weapons.shotgunAmmo,
            shotgunMaxAmmo: weaponConfig.shotgunStartingAmmo,
            pistolAmmo: session.weapons.pistolAmmo,
            pistolMaxAmmo: session.weapons.pistolMaxAmmo,
            // HUD de prod (Phase 6, `ui/hud/widgets/AmmoPanel/AmmoPanel.tsx`) : quel libellé afficher pour
            // "munitions" dépend de l'arme active, pas seulement du compte de
            // cartouches. Même throttle 10 Hz que le reste de ce bloc.
            activeWeapon: session.weapons.activeWeapon,
          });
        }
      });

      yield* Effect.sync(() => {
        engine.crosshair.render();
        engine.hitmarker.render();
      });
    }),
  );
}
