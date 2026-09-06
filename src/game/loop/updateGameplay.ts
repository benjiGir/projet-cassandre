import * as THREE from "three";
import { Effect } from "effect";

import { playDoorSfx, playSfx } from "../../core/audio";
import { input } from "../../core/input";
import { emptyInputFrame, inputRecorder, type InputFrame } from "../../core/inputRecorder";
import { runGameplaySync } from "../../core/runtime";
import { useGameStore } from "../state";
import { unlockDoor, setupExitDoorTracking, triggerLevelComplete } from "../session/doors";
import { showHudMessage, triggerHeroLine } from "../session/feedback";
import { type GameEngine } from "../session/gameEngine";

// `engine` est injecté en paramètre explicite (jamais une fermeture sur
// `main()`) depuis l'extraction de ce fichier hors de `main.ts`.
// see: docs/systems/boucle-de-jeu.md#origine-des-modules

// Objets interactifs "signature Duke" (micro d'annonces, toilettes) — PV
// rendus par les toilettes : "+1 PV" au sens LITTÉRAL du plan (blague
// assumée sur la valeur dérisoire, pas un vrai levier de gameplay). Leurs
// répliques passent par `triggerHeroLine`, EXACTEMENT comme les autres
// répliques — un seul canal, une seule discipline de cooldown, jamais un
// chemin parallèle.
const HERO_LINE_PA_MIC = '"Client de la Zone C : le rayon reptiliens est en rupture de stock."';
const HERO_LINE_TOILET = "Ça va mieux.";
const TOILET_HEAL_AMOUNT = 1;
const HERO_LINE_SECRET_REACTION = "Je vous l'avais dit : il y a TOUJOURS une pièce cachée.";

// Constantes de porte/sortie de niveau (Zone E, `door_e_exit`) — voir la
// doc de `OpeningDoor`/`ExitDoorTracking` dans `session/gameSession.ts`.
const DOOR_OPEN_DURATION = 0.6;
// Marge au-delà du vantail, m — évite un déclenchement au ras de la porte
// (le joueur doit être VISIBLEMENT sorti, pas juste avoir franchi le plan).
const EXIT_CROSSING_MARGIN = 1.0;

// Origine de tir AUTHENTIQUE du pas fixe courant (position + eyeOffset, PAS
// `player.eyePosition(alpha, …)` qui est interpolée pour le rendu) — voir
// la note de déterminisme dans `WeaponSystem.update`. Scratch réutilisé à
// chaque pas fixe, zéro allocation en régime établi.
const weaponEyeOrigin = new THREE.Vector3();
// Scratch réutilisé par la vérification de franchissement de sortie —
// zéro allocation en régime établi.
const exitDoorOffsetScratch = new THREE.Vector3();
const liveFrame = emptyInputFrame();

/**
 * Capture l'input du pas fixe courant. Le saut est CONSOMMÉ ici, une seule
 * fois. Lit par NOM D'ACTION (`core/input.ts::GameAction`), pas par code
 * brut : la table de bindings est rebindable/persistée dans `InputManager`,
 * `InputFrame` reste inchangé (mêmes champs, même sémantique) quel que soit
 * le binding physique réellement pressé.
 */
function captureInputFrame(engine: GameEngine): InputFrame {
  liveFrame.forward = input.isActionDown("moveForward");
  liveFrame.back = input.isActionDown("moveBack");
  liveFrame.left = input.isActionDown("moveLeft");
  liveFrame.right = input.isActionDown("moveRight");
  liveFrame.sprint = input.isActionDown("sprint");
  liveFrame.jump = input.consumeActionJustPressed("jump");
  liveFrame.fire = input.consumeActionJustPressed("fire");
  liveFrame.switchToMelee = input.consumeActionJustPressed("switchMelee");
  liveFrame.switchToShotgun = input.consumeActionJustPressed("switchShotgun");
  liveFrame.use = input.consumeActionJustPressed("use");
  liveFrame.yaw = engine.look.yaw;
  liveFrame.pitch = engine.look.pitch;
  liveFrame.dx = engine.lookDelta.dx;
  liveFrame.dy = engine.lookDelta.dy;
  engine.lookDelta.dx = 0;
  engine.lookDelta.dy = 0;
  return liveFrame;
}

// Décide le mouvement AVANT le step (latence nulle) : la translation cible
// est consommée par `world.step()` du même pas fixe.
// see: docs/systems/boucle-de-jeu.md#ordre-des-callbacks
export function updateGameplay(engine: GameEngine, dt: number): void {
  const session = engine.session;

  // Mort / niveau terminé : le pas fixe continue de tourner (invariant #1),
  // seul le CONTENU de ce pas est ignoré une fois hors de l'état "playing".
  // see: docs/systems/boucle-de-jeu.md#fin-de-partie-pendant-le-pas-fixe

  // Lecture DIRECTE de l'acteur de flux, jamais un aller-retour par zustand
  // (`state.flowState` n'existe que pour React, voir sa doc dans
  // `game/state.ts`) — l'acteur est déjà synchrone et disponible ici.
  if (engine.flowActor.getSnapshot().value !== "playing") return;

  // Jalon M6 (PLAN_EFFECT_XSTATE.md, §8) : le corps du pas fixe devient un
  // seul Effect composé, séquencé en phases nommées — EXACTEMENT le même
  // ordre et les mêmes appels qu'avant ce jalon, aucune réorganisation.
  runGameplaySync(
    Effect.gen(function* () {
      const gameplayDt = engine.clock.tick(dt);

      const activeFrame = yield* Effect.sync((): InputFrame => {
        let frame: InputFrame | null;
        if (inputRecorder.isPlaying()) {
          frame = inputRecorder.nextFrame();
          if (frame) {
            engine.look.yaw = frame.yaw;
            engine.look.pitch = frame.pitch;
          }
        } else {
          frame = captureInputFrame(engine);
          if (inputRecorder.isRecording()) inputRecorder.record(frame);
        }
        return frame ?? emptyInputFrame();
      });

      yield* Effect.sync(() => session.player.update(gameplayDt, activeFrame));

      // Interaction (`use_*`, touche E) — APRÈS `player.update` (donc
      // `player.position` déjà avancée ce pas-ci) et AVANT `weapons.update`
      // pour qu'un ramassage et un tir puissent se produire dans le même pas
      // fixe (raffinement, pas une exigence). `useObjects` est RELUE ici à
      // chaque appel, jamais mise en cache : un hot reload remplace tout le
      // tableau (voir `interactive.ts`/`hotReload.ts`).
      yield* Effect.sync(() =>
        engine.interaction.update(
          activeFrame.use,
          session.gltfLevelSession?.current?.useObjects ?? [],
          session.player.position,
          {
            onCrowbarPickup: () => session.weapons.pickUpMelee(),
            onShotgunPickup: () => session.weapons.pickUpShotgun(),
            onExitDoorUse: (targetName) => {
              if (session.unlockedDoors.has(targetName)) return; // déjà déverrouillée
              if (!session.hasBadge) {
                showHudMessage("Badge du Directeur requis");
                playDoorSfx("locked");
                return;
              }
              // `targetName === "door_e_exit"` : seule cette porte arme le suivi
              // de fin de niveau (voir la doc de `ExitDoorTracking`) —
              // `door_b_frozen` (secret 1, `onFrozenStorageUse` ci-dessous)
              // partage la même mécanique de porte mais n'est jamais une sortie.
              if (unlockDoor(session, targetName, "Porte déverrouillée") && targetName === "door_e_exit") {
                setupExitDoorTracking(session, targetName);
              }
            },
            onFrozenStorageUse: (targetName) => {
              if (session.unlockedDoors.has(targetName)) return; // déjà ouverte
              unlockDoor(session, targetName, "Rayon surgelés ouvert");
            },
            onPaMicUse: () => {
              triggerHeroLine(session, HERO_LINE_PA_MIC);
            },
            onToiletUse: () => {
              const maxHp = useGameStore.getState().debug.playerMaxHp;
              if (session.playerHp >= maxHp) {
                showHudMessage("Vous êtes déjà en pleine forme.");
                return;
              }
              session.playerHp = Math.min(maxHp, session.playerHp + TOILET_HEAL_AMOUNT);
              useGameStore.getState().setPlayerHp(session.playerHp);
              // Info FACTUELLE (canal système, sans cooldown) + réplique
              // (canal dédié, cooldownée) — voir la ligne de partage documentée
              // sur `hudMessage`/`heroLine` dans `game/state.ts`.
              showHudMessage(`+${TOILET_HEAL_AMOUNT} PV`);
              triggerHeroLine(session, HERO_LINE_TOILET);
            },
          },
        ),
      );

      // Origine de tir du pas fixe COURANT, lue APRÈS `player.update` (donc
      // déjà avancée ce pas-ci) : centre de capsule + eyeOffset, jamais la
      // position interpolée pour le rendu. Voir la note de déterminisme dans
      // `WeaponSystem.update` — une origine interpolée casserait le rejeu
      // exact du raycast d'arme.
      yield* Effect.sync(() => {
        weaponEyeOrigin.set(
          session.player.position.x,
          session.player.position.y + session.player.eyeOffset,
          session.player.position.z,
        );
        session.weapons.update(gameplayDt, activeFrame, weaponEyeOrigin, activeFrame.yaw, activeFrame.pitch);
      });

      // APRÈS `weapons.update` : les `hitEvents` du pas courant existent déjà
      // (voir la doc de `SuitManager.update`). `player.position` sert de
      // cible de poursuite (XZ), `weaponEyeOrigin` — la même origine
      // AUTHENTIQUE que celle qui vient de servir aux raycasts d'armes,
      // jamais une position interpolée — sert de cible de ligne de
      // vue/visée pour les Costards.
      yield* Effect.sync(() => {
        session.suitManager.update(
          gameplayDt,
          session.player.position,
          weaponEyeOrigin,
          session.weapons.hitEvents,
          session.currentNavGraph,
        );
        session.directorManager.update(
          gameplayDt,
          session.player.position,
          weaponEyeOrigin,
          session.weapons.hitEvents,
          session.currentNavGraph,
        );
      });

      // Résolution badge / porte / sortie de niveau / secrets — même
      // ordre et mêmes corps qu'avant ce jalon, regroupés en une seule
      // phase finale (aucun de ces blocs ne dépend d'un Effect en soi).
      yield* Effect.sync(() => {
        // Badge du Directeur : apparition (mesh) à la mort, une seule fois ;
        // ramassage par proximité SEULE (pas de touche E, voir la doc de
        // `DirectorBadge`) — même discipline de mutation directe en pas fixe
        // que `interaction.update` ci-dessus pour `use_crowbar`.
        if (session.directorManager.badge && !session.badgeMesh) {
          session.badgeMesh = new THREE.Mesh(engine.badgeGeometry, engine.badgeMaterial);
          session.badgeMesh.position.copy(session.directorManager.badge.position);
          engine.scene.add(session.badgeMesh);
        }
        if (session.directorManager.tryCollectBadge(session.player.position) && session.badgeMesh) {
          engine.scene.remove(session.badgeMesh);
          session.badgeMesh = null;
          session.hasBadge = true;
          showHudMessage("Badge du Directeur récupéré");
        }

        // Glissement cosmétique de la porte débloquée (voir sa doc plus haut) —
        // le collider est déjà désactivé depuis le déverrouillage, ceci ne fait
        // que déplacer le mesh hors du passage.
        if (session.openingDoor) {
          session.openingDoor.t = Math.min(1, session.openingDoor.t + gameplayDt / DOOR_OPEN_DURATION);
          const y =
            session.openingDoor.startY + (session.openingDoor.targetY - session.openingDoor.startY) * session.openingDoor.t;
          const current = session.openingDoor.body.translation();
          session.openingDoor.body.setTranslation({ x: current.x, y, z: current.z }, true);
          if (session.openingDoor.t >= 1) session.openingDoor = null;
        }

        // Fin de niveau : franchissement du vantail déverrouillé — voir la
        // doc de `ExitDoorTracking`. `exitDoorTracking` reste `null` tant
        // que `door_e_exit` n'a jamais été déverrouillée sur CETTE session
        // (armé uniquement dans `onExitDoorUse` ci-dessus) : ce bloc ne se
        // déclenche donc JAMAIS sur un niveau qui n'a pas cette porte
        // (`gym`, n'importe quelle zone individuelle A-D).
        if (session.exitDoorTracking) {
          exitDoorOffsetScratch.subVectors(session.player.position, session.exitDoorTracking.doorPosition);
          const signedInsideDistance =
            exitDoorOffsetScratch.dot(session.exitDoorTracking.crossingAxis) * session.exitDoorTracking.insideSign;
          if (signedInsideDistance < -(session.exitDoorTracking.halfExtentOnAxis + EXIT_CROSSING_MARGIN)) {
            triggerLevelComplete(engine, session);
          }
        }

        // Secrets : présence dans le volume AABB, voir la doc de `foundSecrets`
        // dans `GameSession`. `secrets` est RELUE ici à chaque appel, jamais
        // mise en cache — même discipline que `useObjects`/`doors` ci-dessus.
        for (const secret of session.gltfLevelSession?.current?.secrets ?? []) {
          if (session.foundSecrets.has(secret.object)) continue;
          const p = session.player.position;
          const inside =
            p.x >= secret.min.x &&
            p.x <= secret.max.x &&
            p.y >= secret.min.y &&
            p.y <= secret.max.y &&
            p.z >= secret.min.z &&
            p.z <= secret.max.z;
          if (!inside) continue;
          session.foundSecrets.add(secret.object);
          useGameStore.getState().incrementSecretsFound();
          const found = useGameStore.getState().debug.secretsFound;
          const total = useGameStore.getState().debug.secretsTotal;
          // Info FACTUELLE (n/total, sans cooldown) + réplique de réaction
          // (canal dédié, cooldownée) — même partage que `onToiletUse`.
          showHudMessage(`Secret trouvé ! (${found}/${total})`);
          playSfx("secret_found");
          triggerHeroLine(session, HERO_LINE_SECRET_REACTION);
        }
      });
    }),
  );
}
