import * as THREE from "three";
import { Effect } from "effect";

import { playSfx } from "../../core/audio";
import { input } from "../../core/input";
import { emptyInputFrame, inputRecorder, type InputFrame } from "../../core/inputRecorder";
import { runGameplaySync } from "../../core/runtime";
import { useGameStore } from "../state";
import { triggerLevelComplete, tryOpenCardDoor, unlockDoor } from "../session/doors";
import { grantCard } from "../session/cards";
import { showHudMessage, triggerHeroLine } from "../session/feedback";
import { type GameEngine } from "../session/gameEngine";
import { DIRECTOR_DROPPED_CARD, directorConfig } from "../entities/directorConfig";
import { suitConfig } from "../entities/suitConfig";
import { moveConfig } from "../player/moveConfig";
import { recordSafeGround, shouldRescue } from "../session/fallRescue";
import { type DoorActor } from "../level/doors";
import { type GameSession } from "../session/gameSession";

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

// Constante de fin de niveau (Zone E, `door_e_exit`) — voir la doc
// d'`ExitDoorTracking` dans `session/gameSession.ts`.
// Marge au-delà du vantail, m — évite un déclenchement au ras de la porte
// (le joueur doit être VISIBLEMENT sorti, pas juste avoir franchi le plan).
const EXIT_CROSSING_MARGIN = 1.0;

// Acteurs pris en compte par `DoorSystem` (proximité des portes `auto`, refus
// de refermeture sur une capsule qui chevauche encore le vantail) —
// RECYCLÉS d'un pas fixe à l'autre plutôt que réalloués, comme `liveFrame`
// ci-dessus. see: docs/reference/conventions-nommage.md#portes-animées
const doorActorPool: DoorActor[] = [];

function doorActorSlot(index: number): DoorActor {
  let slot = doorActorPool[index];
  if (!slot) {
    slot = { position: new THREE.Vector3(), radius: 0, halfHeight: 0, joueur: false };
    doorActorPool[index] = slot;
  }
  return slot;
}

/** Joueur + ennemis VIVANTS de la session courante, au format attendu par `DoorSystem.update`. */
function collectDoorActors(session: GameSession): readonly DoorActor[] {
  let count = 0;

  const player = doorActorSlot(count++);
  player.position.copy(session.player.position);
  player.radius = moveConfig.capsuleRadius;
  player.halfHeight = moveConfig.capsuleHalfHeight;
  player.joueur = true;

  for (const suit of session.suitManager.suits) {
    if (!suit.isAlive) continue;
    const slot = doorActorSlot(count++);
    slot.position.copy(suit.position);
    slot.radius = suitConfig.capsuleRadius;
    slot.halfHeight = suitConfig.capsuleHalfHeight;
    slot.joueur = false;
  }
  for (const director of session.directorManager.directors) {
    if (!director.isAlive) continue;
    const slot = doorActorSlot(count++);
    slot.position.copy(director.position);
    slot.radius = directorConfig.capsuleRadius;
    slot.halfHeight = directorConfig.capsuleHalfHeight;
    slot.joueur = false;
  }

  doorActorPool.length = count;
  return doorActorPool;
}

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
  liveFrame.switchToPistol = input.consumeActionJustPressed("switchPistol");
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

      // Filet de chute (`session/fallRescue.ts`) : le dernier sol RÉELLEMENT
      // touché sert de point de retour.
      yield* Effect.sync(() => {
        const player = session.player;
        if (recordSafeGround(session.lastSafeGround, player.position, player.isGrounded, player.numCollisions)) return;
        if (!shouldRescue(session.lastSafeGround, player.position, player.isGrounded)) return;
        console.warn(
          `[niveau] chute hors du monde en x=${player.position.x.toFixed(1)}, z=${player.position.z.toFixed(1)} — ` +
            `retour au dernier sol touché. Trou de décor à corriger (tools/level_v2/audit_niveau.py).`,
        );
        // `spawn` prend la position des PIEDS, `lastSafeGround` le centre de
        // la capsule : la moitié de la capsule les sépare.
        const demiCapsule = moveConfig.capsuleHalfHeight + moveConfig.capsuleRadius;
        player.spawn(session.lastSafeGround.x, session.lastSafeGround.y - demiCapsule, session.lastSafeGround.z);
        showHudMessage("Sol manquant — vous êtes remis sur pied");
      });

      // Interaction (`use_*`, touche E) — APRÈS `player.update` (donc
      // `player.position` déjà avancée ce pas-ci) et AVANT `weapons.update`
      // pour qu'un ramassage et un tir puissent se produire dans le même pas
      // fixe (raffinement, pas une exigence). `useObjects` est RELUE ici à
      // chaque appel, jamais mise en cache : un hot reload remplace tout le
      // tableau (voir `interactive.ts`/`hotReload.ts`).
      yield* Effect.sync(() => {
        const consomme = engine.interaction.update(
          activeFrame.use,
          session.gltfLevelSession?.current?.useObjects ?? [],
          session.player.position,
          {
            onCrowbarPickup: () => session.weapons.pickUpMelee(),
            onShotgunPickup: () => session.weapons.pickUpShotgun(),
            onPistolPickup: () => {
              session.weapons.pickUpPistol();
              showHudMessage("Pistolet récupéré");
            },
            // `use_exit_door` du niveau actuel : son `.glb` est antérieur à
            // la convention `requires` (jalon N7) et ne déclare donc aucune
            // carte. On lui applique la Platine — celle que le Directeur
            // lâche désormais à la place du badge. À retirer au jalon N10,
            // quand `hypermarche_complet` cède la place au niveau v2.
            onExitDoorUse: (targetName) => tryOpenCardDoor(session, targetName, "platine"),
            onCardDoorUse: (targetName, required) => tryOpenCardDoor(session, targetName, required),
            onCardPickup: (card) => {
              grantCard(session, card);
            },
            onFrozenStorageUse: (targetName) => {
              if (session.unlockedDoors.has(targetName)) return; // déjà ouverte
              unlockDoor(session, targetName, "Rayon surgelés ouvert");
            },
            onDoorUse: (targetName, message) => {
              // Rouvrable : une porte libre peut avoir été REFERMÉE à la main
              // depuis (la coupe-feu), et son bouton doit alors la rouvrir.
              // C'est son état courant qui décide, pas `unlockedDoors`.
              const etat = session.doorSystem?.stateOf(targetName);
              if (etat === "open" || etat === "opening") return;
              unlockDoor(session, targetName, message ?? "Passage ouvert");
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
        );

        // Portes manœuvrables à la main (`manuelle`) : le même appui, s'il
        // n'a servi à aucun `use_*`. Sinon, le bouton de la porte coupe-feu et
        // la porte elle-même réagiraient tous les deux — elle s'ouvrirait et
        // se refermerait dans le même pas fixe.
        if (activeFrame.use && !consomme) session.doorSystem?.actionner(session.player.position);
      });

      // Boîtes de munitions : même ramassage sans touche que les trousses. Une
      // boîte ramassée au plafond de munitions ne donnerait rien : elle reste
      // au sol, comme une trousse sur un joueur en pleine forme.
      yield* Effect.sync(() =>
        engine.interaction.collectAmmo(
          session.gltfLevelSession?.current?.useObjects ?? [],
          session.player.position,
          (amount) => {
            const pris = session.weapons.addPistolAmmo(amount);
            if (pris <= 0) return false;
            showHudMessage(`+${pris} munitions`);
            playSfx("ammo_pickup");
            return true;
          },
        ),
      );

      // Trousses de soin : même position, même liste relue que ci-dessus, mais
      // sans touche. Le soin passe par `session.playerHp`, comme les toilettes.
      yield* Effect.sync(() =>
        engine.interaction.collectHeals(
          session.gltfLevelSession?.current?.useObjects ?? [],
          session.player.position,
          (amount) => {
            const maxHp = useGameStore.getState().debug.playerMaxHp;
            if (session.playerHp >= maxHp) return false; // laissée au sol pour plus tard
            const healed = Math.min(maxHp, session.playerHp + amount) - session.playerHp;
            session.playerHp += healed;
            useGameStore.getState().setPlayerHp(session.playerHp);
            showHudMessage(`+${healed} PV`);
            playSfx("heal_pickup");
            return true;
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
          session.vitreSystem ?? undefined,
        );
        session.directorManager.update(
          gameplayDt,
          session.player.position,
          weaponEyeOrigin,
          session.weapons.hitEvents,
          session.currentNavGraph,
          session.vitreSystem ?? undefined,
        );
        // Mobilier physique : même file `hitEvents`, lue de la même façon (non
        // destructivement) que les deux managers ci-dessus. Un tir traverse un
        // prop détruit et un ennemi mort de la même manière — c'est le collider
        // désactivé qui le décide, jamais un filtre écrit ici.
        //
        // AVANT `physics.step` (voir `core/loop.ts`) : l'impulsion posée ici
        // est intégrée par le pas qui suit immédiatement, jamais le suivant.
        session.propSystem?.update(session.weapons.hitEvents);
        // Vitrages : même file, mêmes deux raisons (déterminisme du rejeu,
        // pas fixe strict) que le mobilier physique juste au-dessus.
        session.vitreSystem?.update(session.weapons.hitEvents);
        // Portes animées : pose du mesh calculée ICI, au pas fixe (invariant
        // #1) — `interpolateVisuals.ts` ne fait qu'interpoler entre deux
        // poses déjà décidées. `collectDoorActors` lit le joueur et les
        // ennemis VIVANTS de CE pas-ci (donc après `player.update` /
        // `suitManager`/`directorManager` un peu plus haut).
        session.doorSystem?.update(gameplayDt, collectDoorActors(session));
      });

      // Résolution badge / porte / sortie de niveau / secrets — même
      // ordre et mêmes corps qu'avant ce jalon, regroupés en une seule
      // phase finale (aucun de ces blocs ne dépend d'un Effect en soi).
      yield* Effect.sync(() => {
        // Carte lâchée par le Directeur : apparition (mesh) à la mort, une
        // seule fois ; ramassage par proximité SEULE (pas de touche E, voir
        // la doc de `DroppedCard`) — même discipline de mutation directe en
        // pas fixe que `interaction.update` ci-dessus pour `use_crowbar`.
        const dropped = session.directorManager.droppedCard;
        if (dropped && !session.droppedCardMesh) {
          session.droppedCardMesh = new THREE.Mesh(engine.badgeGeometry, engine.badgeMaterial);
          session.droppedCardMesh.position.copy(dropped.position);
          engine.scene.add(session.droppedCardMesh);
        }
        if (session.directorManager.tryCollectCard(session.player.position) && session.droppedCardMesh) {
          engine.scene.remove(session.droppedCardMesh);
          session.droppedCardMesh = null;
          grantCard(session, dropped?.card ?? DIRECTOR_DROPPED_CARD);
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
