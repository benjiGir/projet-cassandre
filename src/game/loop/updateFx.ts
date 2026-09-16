import * as THREE from "three";
import { Effect } from "effect";

import { playEnemySfx, playImpactSfx, playWeaponFireSfx } from "../../core/audio";
import { input } from "../../core/input";
import { inputRecorder } from "../../core/inputRecorder";
import { toggleMusic } from "../../core/music";
import { runGameplaySync } from "../../core/runtime";
import { type LoopStats } from "../../core/loop";
import { FLESH_MATERIAL } from "../player/weapons";
import { weaponConfig } from "../player/weaponConfig";
import { suitConfig } from "../entities/suitConfig";
import { directorConfig } from "../entities/directorConfig";
import { useGameStore } from "../state";
import {
  grantKillViews,
  handlePlayerHit,
  showHudMessage,
  triggerHeroLine,
  VIEWS_DIRECTOR_MULTIPLIER,
} from "../session/feedback";
import { startPlayback, startRecording } from "../session/recording";
import { toggleNotarget } from "../devtools/cheats";
import { isPhysicsSessionLive, type GameEngine } from "../session/gameEngine";

// `engine` est injecté en paramètre explicite (jamais une fermeture sur
// `main()`) depuis l'extraction de ce fichier hors de `main.ts`.
// see: docs/systems/boucle-de-jeu.md#origine-des-modules

// Kill = réplique "premier lézard" (une seule fois par partie, Costard OU
// Directeur confondus — voir la doc de `GameSession.firstKillTriggered`).
const HERO_LINE_FIRST_KILL = "Premier lézard neutralisé à l'écran. Ils vont encore dire que c'est un montage.";

// Scratch de l'offset de screenshake, réutilisé à chaque frame (`fx.currentShakeOffset`).
const shakeOffsetScratch = new THREE.Vector3();
const muzzleScratch = new THREE.Vector3();

const DEBUG_UPDATE_INTERVAL = 1 / 10; // invariant #2 : 10 Hz maximum

// Tourne au taux d'affichage, comme `interpolateVisuals` — même frontière
// Effect synchrone stricte (`runGameplaySync`) que le pas fixe.
// see: docs/systems/boucle-de-jeu.md#frontière-effect-synchrone-du-pas-fixe
export function updateFx(engine: GameEngine, realDt: number, stats: LoopStats): void {
  const session = engine.session;
  runGameplaySync(
    Effect.gen(function* () {
      yield* Effect.sync(() => {
        if (realDt > 0) {
          engine.fpsSmoothed += (1 / realDt - engine.fpsSmoothed) * 0.1;
        }

        engine.fx.update(realDt);
        // Pool de lampes : réévalué au taux d'affichage, avant le rendu de
        // cette frame. C'est la position de la CAMÉRA qui décide quelle lampe
        // reste allumée, et elle est lue à l'affichage (invariant #3) — pas au
        // pas fixe. L'appel sort immédiatement tant que la caméra n'a pas
        // bougé de plus de 2 m.
        // see: docs/decisions/0026-visibilite-par-espace-et-pool-de-lampes.md
        session.lightPool?.update(engine.camera.position);
        // Décroissance temps réel des minuteurs du hitmarker/réticule/gizmos —
        // même régime que `fx.update(realDt)` juste au-dessus, jamais le pas
        // fixe. `render()` (le dessin effectif des canvas 2D) est appelé en
        // tout dernier dans cette fonction, APRÈS les boucles ci-dessous qui
        // peuvent encore déclencher `hitmarker.trigger(...)`/`crosshair.notifyFire(...)`
        // pour CETTE frame.
        engine.hitmarker.update(realDt);
        engine.crosshair.update(realDt);
        engine.ballisticsDebug.update(realDt);
      });

      yield* Effect.sync(() => {
        // Lecture NON DESTRUCTIVE de `weapons.fireEvents`/`hitEvents` : ces
        // files s'accumulent au fil des pas fixes de la frame et ne se vident
        // jamais toutes seules. `clearFrameEvents()` est appelé plus bas DANS
        // CETTE MÊME fonction, après tous ses lecteurs — jamais ici, avant
        // qu'ils aient fini de lire.
        for (const event of session.weapons.fireEvents) {
          // L'éclair du pompe naît au bout du canon affiché, pas au centre de
          // l'écran ; le pied-de-biche garde son étincelle devant l'œil.
          const flashOrigin =
            event.weapon === "shotgun"
              ? engine.viewmodel.muzzleWorldPosition(muzzleScratch)
              : event.muzzlePosition;
          engine.fx.spawnMuzzleFlash(flashOrigin, event.muzzleDirection, event.weapon);
          if (event.weapon === "shotgun") {
            engine.fx.spawnShellCasing(event.muzzlePosition, event.muzzleDirection);
          }
          playWeaponFireSfx(event.weapon);
          // Réticule : pulsation à CHAQUE tir déclenché (indépendant d'un hit,
          // voir `CrosshairOverlay.notifyFire`), no-op si désactivée en config.
          engine.crosshair.notifyFire();
          // Gizmos balistiques de debug : la forme RÉELLEMENT testée par ce
          // tir (voir `render/ballisticsDebug.ts`). Pompe : un rayon par
          // plomb, jusqu'à son impact ou `shotgunRange` (voir
          // `FireEvent.pelletEndpoints`). Pied-de-biche : la capsule de
          // `WeaponSystem.fireMelee`, reconstruite ici à partir de
          // `weaponConfig.meleeRange`/`meleeHitRadius` — mêmes nombres que la
          // requête Rapier, aucune duplication de valeur en dur.
          if (event.weapon === "shotgun" && event.pelletEndpoints) {
            engine.ballisticsDebug.recordShotgunFire(event.muzzlePosition, event.pelletEndpoints);
          } else if (event.weapon === "melee") {
            engine.ballisticsDebug.recordMeleeFire(
              event.muzzlePosition,
              event.muzzleDirection,
              weaponConfig.meleeRange,
              weaponConfig.meleeHitRadius,
            );
          }
        }
        for (const hit of session.weapons.hitEvents) {
          engine.fx.spawnImpactDecal(hit.point, hit.normal, hit.material);
          engine.fx.spawnImpactParticles(hit.point, hit.normal, hit.weapon);
          // Distinction mur/ennemi (retour playtest Phase 3, `IMPACT_VARIANTS`
          // dans `weaponConfig.ts`) : un hit ENEMY confirmé (matière `"flesh"`,
          // voir `FLESH_MATERIAL`/`materialForCollider` dans `weapons.ts`)
          // déclenche le shake `enemy*`, tout le reste (murs, décor) garde le
          // shake générique. Le hitstop, lui, est déjà branché à la source
          // dans `weapons.ts` (`triggerHitstopFor`) — pas dupliqué ici.
          const isEnemyHit = hit.material === FLESH_MATERIAL;
          engine.fx.triggerShake(
            isEnemyHit ? weaponConfig.enemyShakeAmplitude : weaponConfig.shakeAmplitude,
            isEnemyHit ? weaponConfig.enemyShakeDuration : weaponConfig.shakeDuration,
          );
          // Hitmarker : uniquement sur un hit ENEMY confirmé — un hit mur n'a
          // pas vocation à alimenter ce canal (voir doc de `hitmarker.ts`).
          if (isEnemyHit) engine.hitmarker.trigger("hit");
          playImpactSfx(hit.material);
        }
        // Clôture de la frame d'affichage pour les événements d'armes : TOUS
        // les lecteurs (`retro-render` ci-dessus, l'audio ci-dessus) ont fini
        // de lire `fireEvents`/`hitEvents` pour cette frame. Même principe que
        // `input.endFrame()` dans `core/loop.ts` — dernier appel de la chaîne,
        // jamais plus tôt (voir la doc de `clearFrameEvents` dans
        // `game/player/weapons.ts`).
        session.weapons.clearFrameEvents();
      });

      yield* Effect.sync(() => {
        // Décroissance TEMPS RÉEL du flash de dégâts de chaque Costard — jamais
        // au pas fixe (même séparation que `fx.update(realDt)` juste au-dessus).
        for (const sprite of session.suitSprites.values()) sprite.updateFlash(realDt);

        // Lecture NON DESTRUCTIVE des files de `suitManager`, même contrat que
        // `weapons.fireEvents`/`hitEvents` ci-dessus : tous les lecteurs
        // d'abord, `suitManager.clearFrameEvents()` en tout dernier.
        for (const event of session.suitManager.alertEvents) {
          void event; // pas de sprite dédié à l'alerte : la pose ALERTE (ligne d'atlas) suffit, le son est le seul canal supplémentaire ici.
          playEnemySfx("alert");
        }
        for (const event of session.suitManager.telegraphEvents) {
          void event;
          // Règle non négociable du skill : le son de télégraphie part AVANT
          // les dégâts (`suitConfig.attackTelegraphDuration` >= 0.2 s sépare ce
          // point de la résolution de l'attaque dans `Suit.runAttack`).
          playEnemySfx("telegraph");
        }
        for (const event of session.suitManager.hurtEvents) {
          // Triple feedback (skill enemy-state-machine) : flash blanc + son ici,
          // knockback déjà appliqué dans `Suit.applyDamage` (vélocité pilotée,
          // le Costard étant kinématique — voir sa doc). Durée du flash lue
          // depuis `suitConfig.hitFlashDuration` (tunable à chaud, voir sa doc
          // et `FLASH_VARIANTS`) au lieu de l'ancienne constante en dur.
          session.suitSprites.get(event.suit.id)?.setFlash(1, suitConfig.hitFlashDuration);
          playEnemySfx("hurt");
        }
        for (const event of session.suitManager.deathEvents) {
          if (event.gibs) {
            // Bout portant au pompe : gibs À LA PLACE de l'animation de mort
            // normale (le Costard reste en état "dead"/"corpse" côté simulation
            // pour la persistance du cadavre — seul le RENDU change ici).
            engine.fx.spawnGibs(event.point, event.direction);
          }
          // Kill = sa propre fenêtre de hitmarker, distincte du hit simple (voir
          // `HitmarkerOverlay.trigger`) — confirmation visuelle qu'un Costard
          // vient d'être tué, indépendamment du sprite (qui peut être remplacé
          // par des gibs, donc potentiellement moins lisible ce pas-ci).
          engine.hitmarker.trigger("kill");
          playEnemySfx("death");
          // Compteur de "vues" (Phase 6) + réplique "premier kill" (une seule
          // fois par partie, Costard OU Directeur confondus — voir la doc de
          // `GameSession.firstKillTriggered`).
          grantKillViews();
          if (!session.firstKillTriggered) {
            session.firstKillTriggered = true;
            triggerHeroLine(session, HERO_LINE_FIRST_KILL);
          }
        }
        for (const event of session.suitManager.playerHitEvents) {
          session.playerHp = Math.max(0, session.playerHp - event.amount);
          useGameStore.getState().setPlayerHp(session.playerHp);
          // Feedback via l'API PUBLIQUE déjà livrée de `fx`/`weapons`, aucune
          // modification de `render/fx.ts` : decal + particules au point
          // d'impact sur le joueur, léger screenshake dédié (`suitConfig`, pas
          // `weaponConfig` — c'est le coup encaissé, pas un tir du joueur).
          engine.fx.spawnImpactDecal(event.point, event.normal, "flesh");
          engine.fx.spawnImpactParticles(event.point, event.normal, "shotgun");
          engine.fx.triggerShake(suitConfig.playerHitShakeAmplitude, suitConfig.playerHitShakeDuration);
          // PV bas / mort (Phase 6) — voir la doc de `handlePlayerHit`.
          handlePlayerHit(engine, session);
        }
        session.suitManager.clearFrameEvents();
      });

      yield* Effect.sync(() => {
        // Même contrat (lecture non destructive, `clearFrameEvents()` en tout
        // dernier) pour le Directeur. Pas de réutilisation des sons `enemy_*` en
        // tant que "faits exprès pour le boss" — ce sont les mêmes placeholders
        // génériques que pour le Costard (invariant #9, aucun son dédié encore).
        for (const sprite of session.directorSprites.values()) sprite.updateFlash(realDt);

        for (const event of session.directorManager.alertEvents) {
          void event;
          playEnemySfx("alert");
        }
        for (const event of session.directorManager.telegraphEvents) {
          void event;
          playEnemySfx("telegraph");
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
          void event; // pas de gibs pour le Directeur (voir la doc de `DirectorManager`).
          engine.hitmarker.trigger("kill");
          playEnemySfx("death");
          // Multiplicateur dédié : voir `VIEWS_DIRECTOR_MULTIPLIER`. Même garde
          // `firstKillTriggered` que le Costard — un seul flag, peu importe qui
          // décroche le tout premier kill de la partie.
          grantKillViews(VIEWS_DIRECTOR_MULTIPLIER);
          if (!session.firstKillTriggered) {
            session.firstKillTriggered = true;
            triggerHeroLine(session, HERO_LINE_FIRST_KILL);
          }
        }
        for (const event of session.directorManager.playerHitEvents) {
          session.playerHp = Math.max(0, session.playerHp - event.amount);
          useGameStore.getState().setPlayerHp(session.playerHp);
          engine.fx.spawnImpactDecal(event.point, event.normal, "flesh");
          engine.fx.spawnImpactParticles(event.point, event.normal, "shotgun");
          engine.fx.triggerShake(directorConfig.playerHitShakeAmplitude, directorConfig.playerHitShakeDuration);
          handlePlayerHit(engine, session);
        }
        session.directorManager.clearFrameEvents();
      });

      yield* Effect.sync(() => {
        // Offset de shake, ADDITIF, appliqué APRÈS le calcul de bob déjà posé
        // dans `interpolateVisuals` (qui s'exécute juste avant `updateFx` dans
        // l'ordre de la boucle, voir `core/loop.ts`) — jamais en écrasant
        // `player.eyePosition`/`camera.position` de base.
        engine.camera.position.add(engine.fx.currentShakeOffset(shakeOffsetScratch));

        // Outillage (hors gameplay, lu au taux d'affichage) : F9 enregistre,
        // F10 rejoue. Sert de harnais A/B et de preuve de déterminisme.
        // Gardé par `isPhysicsSessionLive()` : `startRecording`/`startPlayback`
        // appellent `session.player.spawn(...)`, qui touche Rapier. Cas
        // limite dev-only, coût de la garde nul.
        // see: docs/decisions/0013-garde-flux-vs-monde-physique.md
        if (isPhysicsSessionLive(engine)) {
          if (input.wasJustPressed("F9")) {
            if (inputRecorder.isRecording()) {
              engine.lastRecording = inputRecorder.stopRecording();
              console.info(`[recorder] ${engine.lastRecording?.frames.length ?? 0} pas fixes enregistrés`);
            } else {
              startRecording(engine, session);
              console.info("[recorder] enregistrement démarré");
            }
          }
          if (input.wasJustPressed("F10") && engine.lastRecording) {
            startPlayback(engine, session, engine.lastRecording);
            console.info(`[recorder] rejeu de ${engine.lastRecording.frames.length} pas fixes`);
          }
        }
        // KeyV : wireframe de toute la scène, mutation ponctuelle sur appui
        // (invariant #2 — pas de lecture continue, pas de setState par frame).
        if (input.wasJustPressed("KeyV")) {
          const enabled = engine.wireframeToggle.toggle();
          console.info(`[debug] wireframe ${enabled ? "activé" : "désactivé"}`);
        }
        // KeyB (ballistics) : gizmos balistiques de debug, actifs PAR DÉFAUT
        // (voir la doc de tête de `render/ballisticsDebug.ts`) — même pattern
        // de bascule ponctuelle que KeyV ci-dessus.
        if (input.wasJustPressed("KeyB")) {
          const enabled = engine.ballisticsDebug.toggle();
          console.info(`[debug] gizmos balistiques ${enabled ? "activés" : "désactivés"}`);
        }
        // F8 : les ennemis cessent de voir le joueur (`notarget`), pour
        // parcourir un niveau et le regarder. Même bascule ponctuelle que
        // KeyV/KeyB, mais elle touche le GAMEPLAY — d'où le message HUD, qui
        // évite de croire plus tard à une IA cassée.
        // see: docs/reference/controles.md#touches-de-dev
        if (input.wasJustPressed("F8")) {
          const on = toggleNotarget();
          showHudMessage(on ? "Dev : ennemis passifs" : "Dev : ennemis à nouveau hostiles");
          console.info(`[debug] notarget ${on ? "activé" : "désactivé"}`);
        }
        // KeyM : touche fixe non-rebindable côté JOUEUR (pas un outil de dev
        // comme V/B/F9/F10 ci-dessus) — coupe/remet uniquement le thème
        // musical, jamais la nappe d'ambiance. Réglage persisté, voir
        // `core/music.ts::setMusicEnabled`. Également accessible depuis
        // l'écran Options pour la découvrabilité.
        if (input.wasJustPressed("KeyM")) {
          const enabled = toggleMusic();
          showHudMessage(enabled ? "Musique activée" : "Musique désactivée");
        }

        engine.debugAccumulator += realDt;
        if (engine.debugAccumulator >= DEBUG_UPDATE_INTERVAL) {
          engine.debugAccumulator = 0;
          useGameStore.getState().setDebug({
            fps: engine.fpsSmoothed,
            position: { x: engine.camera.position.x, y: engine.camera.position.y, z: engine.camera.position.z },
            entityCount: (session.ballBody ? 1 : 0) + session.suitManager.suits.length,
            steps: stats.steps,
            // Jalon M7 (PLAN_EFFECT_XSTATE.md, §9) : voir la doc de
            // `LoopStats` (`core/loop.ts`) pour la définition exacte.
            gameplayMs: stats.gameplayMs,
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
            // HUD de prod (Phase 6, `ui/Hud.tsx`) : quel libellé afficher pour
            // "munitions" dépend de l'arme active, pas seulement du compte de
            // cartouches. Même throttle 10 Hz que le reste de ce bloc.
            activeWeapon: session.weapons.activeWeapon,
          });
        }
      });

      // Dessin du réticule/hitmarker EN TOUT DERNIER : après toutes les
      // phases ci-dessus qui ont pu appeler `crosshair.notifyFire(...)`/
      // `hitmarker.trigger(...)` pour cette frame (tir, hit ennemi, kill) —
      // voir la note plus haut. Le réticule d'abord (repère permanent), le
      // hitmarker ensuite (flash de confirmation, doit rester visible
      // par-dessus — voir la note de construction des deux overlays).
      yield* Effect.sync(() => {
        engine.crosshair.render();
        engine.hitmarker.render();
      });
    }),
  );
}
