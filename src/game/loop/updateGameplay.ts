import * as THREE from "three";
import { Effect } from "effect";

import { playSfx } from "../../core/audio/audio";
import { input } from "../../core/input/input";
import { formatKeyCode } from "../../core/input/inputBindings";
import { emptyInputFrame, inputRecorder } from "../../core/input/inputRecorder";
import { type InputFrame } from "../../core/input/inputTypes";
import { runGameplaySync } from "../../app/runtime/gameRuntime";
import { useGameStore } from "../hud/state";
import { triggerLevelComplete, tryOpenCardDoor, unlockDoor } from "../session/progression/doors";
import { grantCard } from "../session/progression/cards";
import { publishPerkOffer, startKillRush, updateKillRush, usePerkKiosk } from "../session/progression/perks";
import {
  applyPlayerDamage,
  sayOpeningLine,
  showHudMessage,
  triggerHeroBark,
  triggerHeroLine,
} from "../session/player/feedback";
import { streamEvent, updateStreamFeed } from "../session/stream/streamFeed";
import {
  ALERT_LINES,
  ATTACK_LINES,
  DOOR_USE_LINES,
  FOOD_LINES,
  PROP_BREAK_LINES,
  SECRET_LINES,
} from "../session/presentation/heroLines";
import { relieveAtSanitaire, trySanitaire } from "../session/player/sanitaires";
import { updatePlaceLine } from "../session/player/placeLines";
import { updateLevelScript } from "../level/scripting/levelScript";
import { LEVEL_EVENTS } from "../session/progression/levelEvents";
import { runScriptAction } from "../session/progression/levelScriptActions";
import {
  advanceGameplayTime,
  recordDirectorKills,
  recordPropsDestroyed,
  recordSanitairesDestroyed,
  recordShot,
  recordSuitKills,
  recordVitresDestroyed,
} from "../session/progression/score";
import { type GameEngine } from "../session/gameEngine";
import { DIRECTOR_DROPPED_CARD, directorConfig } from "../entities/director/directorConfig";
import { suitConfig } from "../entities/suit/suitConfig";
import { moveConfig } from "../player/movement/moveConfig";
import { recordSafeGround, shouldRescue } from "../session/player/fallRescue";
import { applyBlast } from "../session/player/explosions";
import { FLESH_MATERIAL } from "../player/weapons/weapons";
import type { DoorActor } from "../level/doors/doorTypes";
import { basculerEau, updateDouches } from "../level/sanitaires/douches";
import { updateStoreSign } from "../../render/environment/storeSign";
import { type GameSession } from "../session/gameSession";
import { handleDevGameplayInput } from "./devGameplayInput";
import { CardPickupBillboard } from "../../render/pickups/cardPickups";
// `engine` est injecté en paramètre explicite (jamais une fermeture sur
// `main()`) depuis l'extraction de ce fichier hors de `main.ts`.
// see: docs/archive/systems-boucle-de-jeu.md#origine-des-modules

// see: docs/6-reference/notes-code-gameplay.md#boucle-et-présentation

function recordKillFeedback(session: GameSession, count: number): void {
  session.heroPortrait.kill(count);
  if (count > 0) startKillRush(session);
  for (let i = 0; i < count; i++) {
    streamEvent(session, "kill");
    if (session.firstKillTriggered) {
      // Le kill vient de l'arme en main : un tir et sa mort tombent dans le même pas fixe.
      triggerHeroLine(session, session.weapons.activeWeapon === "shotgun" ? "kill_pompe" : "kill_costard");
      continue;
    }
    session.firstKillTriggered = true;
    triggerHeroLine(session, "premier_kill");
  }
}

/** Mort du Directeur : vues multipliées, et sa propre réplique plutôt que celle d'un Costard. */
function recordDirectorKillFeedback(session: GameSession, count: number): void {
  session.heroPortrait.kill(count);
  for (let i = 0; i < count; i++) streamEvent(session, "boss");
  if (count > 0) triggerHeroLine(session, "boss_mort");
}

/** Vitesse de chute (m/s) au-delà de laquelle une réception arrache un « Ouf ! » — plus qu'un saut sur place. */
const LANDING_BARK_SPEED = 10;

const EXIT_CROSSING_MARGIN = 1.0;

// see: docs/archive/reference-conventions-nommage.md#portes-animées
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

const weaponEyeOrigin = new THREE.Vector3();
// Scratch réutilisé par la vérification de franchissement de sortie —
// zéro allocation en régime établi.
const exitDoorOffsetScratch = new THREE.Vector3();
const liveFrame = emptyInputFrame();

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
// see: docs/archive/systems-boucle-de-jeu.md#ordre-des-callbacks
export function updateGameplay(engine: GameEngine, dt: number): void {
  const session = engine.session;
  if (import.meta.env.DEV && engine.flow.isPhysicsLive()) {
    runGameplaySync(Effect.sync(() => handleDevGameplayInput(engine, session)));
  }

  // Mort / niveau terminé : le pas fixe continue de tourner (invariant #1),
  // seul le CONTENU de ce pas est ignoré une fois hors de l'état "playing".
  // see: docs/archive/systems-boucle-de-jeu.md#fin-de-partie-pendant-le-pas-fixe

  // Lecture DIRECTE de l'acteur de flux, jamais un aller-retour par zustand
  // (`state.flowState` n'existe que pour React, voir sa doc dans
  // `game/hud/state.ts`) — l'acteur est déjà synchrone et disponible ici.
  if (!engine.flow.isPlaying()) return;

  // Jalon M6 (PLAN_EFFECT_XSTATE.md, §8) : le corps du pas fixe devient un
  // seul Effect composé, séquencé en phases nommées — EXACTEMENT le même
  // ordre et les mêmes appels qu'avant ce jalon, aucune réorganisation.
  runGameplaySync(
    Effect.gen(function* () {
      const gameplayDt = engine.clock.tick(dt);
      session.heroPortrait.advance(gameplayDt, session.playerHp, session.playerMaxHp);

      advanceGameplayTime(session.stats, gameplayDt);

      if (session.sanitaireReliefCooldown > 0) {
        session.sanitaireReliefCooldown = Math.max(0, session.sanitaireReliefCooldown - gameplayDt);
      }

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

      yield* Effect.sync(() => {
        sayOpeningLine(session);
        const enLAir = !session.player.isGrounded;
        const chute = -session.player.velocity.y;
        updateKillRush(session, gameplayDt);
        session.player.update(gameplayDt, activeFrame);
        if (enLAir && session.player.isGrounded && chute >= LANDING_BARK_SPEED) triggerHeroBark(session, "effort_reception");
      });

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

      yield* Effect.sync(() => {
        const consomme = engine.interaction.update(
          activeFrame.use,
          session.gltfLevelSession?.current?.useObjects ?? [],
          session.player.position,
          {
            onExitDoorUse: (targetName) => tryOpenCardDoor(session, targetName, "platine"),
            onCardDoorUse: (targetName, required) => tryOpenCardDoor(session, targetName, required),
            onCardPickup: (card) => {
              if (!grantCard(session, card)) return;
              triggerHeroLine(session, `carte_${card}`);
              streamEvent(session, "carte");
            },
            onFrozenStorageUse: (targetName) => {
              if (session.unlockedDoors.has(targetName)) return; // déjà ouverte
              unlockDoor(session, targetName, "Rayon surgelés ouvert");
            },
            onDoorUse: (targetName, message, useName) => {
              // Rouvrable : une porte libre peut avoir été REFERMÉE à la main
              // depuis (la coupe-feu), et son bouton doit alors la rouvrir.
              // C'est son état courant qui décide, pas `unlockedDoors`.
              const etat = session.doorSystem?.stateOf(targetName);
              if (etat === "open" || etat === "opening") return;
              if (!unlockDoor(session, targetName, message ?? "Passage ouvert")) return;
              const ligne = DOOR_USE_LINES[useName];
              if (ligne) triggerHeroLine(session, ligne);
            },
            onPaMicUse: () => {
              triggerHeroLine(session, "micro_annonces");
            },
            onPunchClockUse: () => {
              triggerHeroLine(session, "pointeuse");
            },
            onSavBellUse: () => {
              triggerHeroLine(session, "sonnette_sav");
            },
            onShowerToggleUse: (name) => {
              const root = session.gltfLevelSession?.current?.root;
              if (!root) return;
              const allumee = basculerEau(root, name);
              if (allumee === null) return;
              const poste = name.slice("use_douche_".length);
              showHudMessage(allumee ? `Douche ${poste} : eau ouverte` : `Douche ${poste} : eau coupée`);
              triggerHeroLine(session, allumee ? "douche_ouvre" : "douche_ferme");
            },
            onCameraConsoleUse: (cameraNames) => {
              session.cameraView?.activate(cameraNames, activeFrame.yaw, activeFrame.pitch);
            },
            onPerkKioskUse: (offer) => {
              usePerkKiosk(session, offer);
            },
            // `use_toilet` (niveau `hypermarche_complet`, historique) : TOUJOURS
            // une cuvette intacte, jamais de variante cassée — même règle que
            // `sanitaire_*`, voir `game/session/player/sanitaires.ts::relieveAtSanitaire`.
            onToiletUse: () => relieveAtSanitaire(session),
          },
        );
        publishPerkOffer(session, engine.interaction.nearestInRange, formatKeyCode(input.getBinding("use")));

        const consommeSanitaire = !consomme && trySanitaire(
          session,
          activeFrame.use,
          session.player.position,
          session.player.eyeOffset,
          activeFrame.yaw,
          activeFrame.pitch,
        );

        if (activeFrame.use && !consomme && !consommeSanitaire) {
          session.doorSystem?.actionner(session.player.position);
        }

        const enVueCamera = session.cameraView?.active ?? false;
        session.cameraView?.update(activeFrame);
        if (enVueCamera && !session.cameraView?.active) triggerHeroLine(session, "camera_quitte");
      });

      // Boîtes de munitions : même ramassage sans touche que les trousses. Une
      // boîte ramassée au plafond de munitions ne donnerait rien : elle reste
      // au sol, comme une trousse sur un joueur en pleine forme.
      yield* Effect.sync(() =>
        engine.interaction.collectAmmo(
          session.gltfLevelSession?.current?.useObjects ?? [],
          session.player.position,
          (amount, useObject) => {
            const pris = session.weapons.addPistolAmmo(amount);
            if (pris <= 0) return false;
            showHudMessage(`+${pris} munitions`);
            session.heroPortrait.react("victory", .45);
            playSfx("ammo_pickup");
            triggerHeroLine(session, useObject.name === "use_munitions_gaine_1" ? "cache_gaine"
              : amount >= 36 ? "munitions_36" : "munitions_24");
            return true;
          },
          session.pickupRadius,
        ),
      );

      yield* Effect.sync(() =>
        engine.interaction.collectWeapons(
          session.gltfLevelSession?.current?.useObjects ?? [],
          session.player.position,
          {
            onCrowbarPickup: () => {
              const pris = session.weapons.tryCollectMelee();
              if (pris) {
                showHudMessage("Pied-de-biche récupéré");
                session.heroPortrait.react("victory", 1);
                playSfx("ammo_pickup");
                triggerHeroLine(session, "arme_pied_biche");
              } else {
                triggerHeroLine(session, "arme_double");
              }
              return pris;
            },
            onShotgunPickup: () => {
              const pris = session.weapons.tryCollectShotgun();
              if (pris) {
                showHudMessage("Fusil à pompe récupéré");
                session.heroPortrait.react("victory", 1);
                playSfx("ammo_pickup");
                triggerHeroLine(session, "arme_pompe");
              } else {
                triggerHeroLine(session, "arme_double");
              }
              return pris;
            },
            onPistolPickup: () => {
              // `dejaPossede`/`avantAmmo` lus AVANT `tryCollectPistol()` :
              // après coup, `true` ne dit plus si c'était la première arme
              // ou une simple recharge — voir la doc de `hasPistolAlready`.
              const dejaPossede = session.weapons.hasPistolAlready;
              const avantAmmo = session.weapons.pistolAmmo;
              const pris = session.weapons.tryCollectPistol();
              if (pris) {
                session.heroPortrait.react("victory", dejaPossede ? .45 : 1);
                showHudMessage(
                  dejaPossede
                    ? `+${session.weapons.pistolAmmo - avantAmmo} munitions`
                    : "Pistolet récupéré",
                );
                playSfx("ammo_pickup");
                if (!dejaPossede) triggerHeroLine(session, "arme_pistolet");
              }
              return pris;
            },
          },
          session.pickupRadius,
        ),
      );

      // Trousses de soin : même position, même liste relue que ci-dessus, mais
      // sans touche. Le soin passe par `session.playerHp`, comme les toilettes.
      yield* Effect.sync(() =>
        engine.interaction.collectHeals(
          session.gltfLevelSession?.current?.useObjects ?? [],
          session.player.position,
          (amount, useObject) => {
            const maxHp = session.playerMaxHp;
            if (session.playerHp >= maxHp) {
              // Laissée au sol pour plus tard. La réplique est `once` : elle ne
              // se répète pas à chaque pas fixe passé debout sur la trousse.
              if (!useObject.aliment) triggerHeroLine(session, "soin_plein");
              return false;
            }
            const healed = Math.min(maxHp, session.playerHp + amount) - session.playerHp;
            session.playerHp += healed;
            session.heroPortrait.heal(session.playerHp, maxHp);
            useGameStore.getState().setPlayerHp(session.playerHp);
            showHudMessage(`+${healed} PV`);
            // Un aliment (chantier « Les coulisses ») a son propre son —
            // jamais le carillon de trousse de soin, voir `UseObject.aliment`.
            playSfx(useObject.aliment ? "food_eat" : "heal_pickup");
            const ligne = useObject.aliment ? FOOD_LINES[useObject.aliment] : undefined;
            if (ligne) triggerHeroLine(session, ligne);
            return true;
          },
          session.pickupRadius,
        ),
      );

      // Nourriture lâchée par un `prop_*` détruit (`contenu`) : même règle de
      // soin que ci-dessus, mais lue depuis `PropSystem` plutôt que
      // `useObjects` (voir `props.ts::PropSystem.collectFoodDrops`).
      yield* Effect.sync(() =>
        session.propSystem?.collectFoodDrops(session.player.position, (amount) => {
          const maxHp = session.playerMaxHp;
          if (session.playerHp >= maxHp) return false;
          const healed = Math.min(maxHp, session.playerHp + amount) - session.playerHp;
          session.playerHp += healed;
          session.heroPortrait.heal(session.playerHp, maxHp);
          useGameStore.getState().setPlayerHp(session.playerHp);
          showHudMessage(`+${healed} PV`);
          playSfx("food_eat");
          return true;
        }, session.pickupRadius),
      );

      yield* Effect.sync(() => {
        weaponEyeOrigin.set(
          session.player.position.x,
          session.player.position.y + session.player.eyeOffset,
          session.player.position.z,
        );
        const fireCountBefore = session.weapons.fireEvents.length;
        const hitCountBefore = session.weapons.hitEvents.length;
        session.weapons.update(gameplayDt, activeFrame, weaponEyeOrigin, activeFrame.yaw, activeFrame.pitch);
        if (session.weapons.fireEvents.length > fireCountBefore) {
          session.heroPortrait.react("focus");
          let hitEnemy = false;
          for (let i = hitCountBefore; i < session.weapons.hitEvents.length; i++) {
            if (session.weapons.hitEvents[i]!.material === FLESH_MATERIAL) {
              hitEnemy = true;
              break;
            }
          }
          recordShot(session.stats, hitEnemy);
        }
      });

      yield* Effect.sync(() => {
        const suitDeathsBefore = session.suitManager.deathEvents.length;
        const suitPlayerHitsBefore = session.suitManager.playerHitEvents.length;
        const suitAlertsBefore = session.suitManager.alertEvents.length;
        const suitShotsBefore = session.suitManager.shotEvents.length;
        session.suitManager.update(
          gameplayDt,
          session.player.position,
          weaponEyeOrigin,
          session.weapons.hitEvents,
          session.currentNavGraph,
          session.vitreSystem ?? undefined,
          session.sanitaireSystem ?? undefined,
        );
        const suitKills = session.suitManager.deathEvents.length - suitDeathsBefore;
        recordSuitKills(session.stats, suitKills);
        recordKillFeedback(session, suitKills);
        // La réplique suit l'espèce du premier ennemi qui vient d'agir.
        const tireur = session.suitManager.shotEvents[suitShotsBefore]?.suit;
        const guetteur = session.suitManager.alertEvents[suitAlertsBefore]?.suit;
        if (tireur) triggerHeroLine(session, ATTACK_LINES[tireur.kind]);
        else if (guetteur) triggerHeroLine(session, ALERT_LINES[guetteur.kind]);
        // Premier tir arrêté par un bouclier : le héros dit quoi en faire.
        if (session.suitManager.blockedHits.size > 0) triggerHeroLine(session, "vigile_bouclier");
        for (let i = suitPlayerHitsBefore; i < session.suitManager.playerHitEvents.length; i++) {
          const hit = session.suitManager.playerHitEvents[i]!;
          applyPlayerDamage(engine, session, hit.amount, hit.normal, "suit");
        }
        if (session.suitManager.playerHitEvents.length > suitPlayerHitsBefore) streamEvent(session, "degats");

        const directorDeathsBefore = session.directorManager.deathEvents.length;
        const directorPlayerHitsBefore = session.directorManager.playerHitEvents.length;
        const directorAlertsBefore = session.directorManager.alertEvents.length;
        const directorRevealsBefore = session.directorManager.revealEvents.length;
        const directorAttacksBefore = session.directorManager.telegraphEvents.length;
        session.directorManager.update(
          gameplayDt,
          session.player.position,
          weaponEyeOrigin,
          session.weapons.hitEvents,
          session.currentNavGraph,
          session.vitreSystem ?? undefined,
          session.sanitaireSystem ?? undefined,
        );
        const directorKills = session.directorManager.deathEvents.length - directorDeathsBefore;
        if (session.directorManager.alertEvents.length > directorAlertsBefore
          || session.directorManager.revealEvents.length > directorRevealsBefore) session.heroPortrait.react("discover");
        recordDirectorKills(session.stats, directorKills);
        recordDirectorKillFeedback(session, directorKills);
        if (session.directorManager.revealEvents.length > directorRevealsBefore) triggerHeroLine(session, "boss_revelation");
        else if (session.directorManager.telegraphEvents.length > directorAttacksBefore) triggerHeroLine(session, "boss_attaque");
        for (let i = directorPlayerHitsBefore; i < session.directorManager.playerHitEvents.length; i++) {
          const hit = session.directorManager.playerHitEvents[i]!;
          applyPlayerDamage(engine, session, hit.amount, hit.normal, "director");
        }
        if (session.directorManager.playerHitEvents.length > directorPlayerHitsBefore) streamEvent(session, "degats");

        const propsDestroyedBefore = session.propSystem?.destroyedEvents.length ?? 0;
        session.propSystem?.update(session.weapons.hitEvents);
        const propsDestroyed = session.propSystem?.destroyedEvents.slice(propsDestroyedBefore) ?? [];
        recordPropsDestroyed(session.stats, propsDestroyed.length);
        // Explosifs (`matiere: gaz`) : les props se sont déjà poussés et
        // amorcés entre eux, reste le souffle sur le joueur et les ennemis.
        for (const explosion of session.propSystem?.takeNewExplosions() ?? []) {
          const souffle = applyBlast(engine, session, explosion.point);
          recordSuitKills(session.stats, souffle.suitKills);
          recordKillFeedback(session, souffle.suitKills);
          recordDirectorKills(session.stats, souffle.directorKills);
          recordDirectorKillFeedback(session, souffle.directorKills);
          if (souffle.playerDamage > 0) streamEvent(session, "degats");
        }
        const ligneCasse = propsDestroyed.map((e) => PROP_BREAK_LINES[e.matiere]).find((l) => l !== undefined);
        if (ligneCasse) triggerHeroLine(session, ligneCasse);
        let casse = propsDestroyed.length > 0;
        if (!session.heroLinesSaid.has("objet_pousse") && session.propSystem?.isPushedNear(session.player.position)) {
          triggerHeroLine(session, "objet_pousse");
        }

        // Vitrages : même file, mêmes deux raisons (déterminisme du rejeu,
        // pas fixe strict) que le mobilier physique juste au-dessus.
        const vitresDestroyedBefore = session.vitreSystem?.destroyedEvents.length ?? 0;
        session.vitreSystem?.update(session.weapons.hitEvents);
        const vitresDestroyed = (session.vitreSystem?.destroyedEvents.length ?? 0) - vitresDestroyedBefore;
        recordVitresDestroyed(session.stats, vitresDestroyed);
        if (vitresDestroyed > 0) triggerHeroLine(session, "casse_vitre");
        casse ||= vitresDestroyed > 0;

        // Sanitaires : même file, même contrat que les vitrages juste au-dessus.
        const sanitairesDestroyedBefore = session.sanitaireSystem?.destroyedEvents.length ?? 0;
        session.sanitaireSystem?.update(session.weapons.hitEvents);
        const sanitairesDestroyed = (session.sanitaireSystem?.destroyedEvents.length ?? 0) - sanitairesDestroyedBefore;
        recordSanitairesDestroyed(session.stats, sanitairesDestroyed);
        casse ||= sanitairesDestroyed > 0;

        // Écrans (`ecran_*`, chantier « Les coulisses ») : même file de
        // impacts, plus l'horloge d'animation propre à `EcranSystem.update`
        // (voir sa doc) — avancée au pas fixe, jamais un dt réel.
        const ecransDestroyedBefore = session.ecranSystem?.destroyedEvents.length ?? 0;
        session.ecranSystem?.update(gameplayDt, session.weapons.hitEvents);
        if ((session.ecranSystem?.destroyedEvents.length ?? 0) > ecransDestroyedBefore) {
          triggerHeroLine(session, "casse_ecran");
          casse = true;
        }
        // Une seule fois par pas fixe : une rafale qui casse trois objets reste un seul évènement.
        if (casse) streamEvent(session, "casse");
        updateDouches(session.gltfLevelSession?.current?.root ?? null, gameplayDt);
        updateStoreSign(session.gltfLevelSession?.current?.root ?? null, gameplayDt);

        session.doorSystem?.update(gameplayDt, collectDoorActors(session));
      });

      // Résolution badge / porte / sortie de niveau / secrets — même
      // ordre et mêmes corps qu'avant ce jalon, regroupés en une seule
      // phase finale (aucun de ces blocs ne dépend d'un Effect en soi).
      yield* Effect.sync(() => {
        const dropped = session.directorManager.droppedCard;
        if (dropped && !dropped.collected && !session.droppedCardBillboard) {
          session.droppedCardBillboard = new CardPickupBillboard(dropped.card, dropped.position, engine.cardPickupTextures);
          engine.scene.add(session.droppedCardBillboard.spriteMesh);
        }
        if (session.directorManager.tryCollectCard(session.player.position)) {
          session.droppedCardBillboard?.dispose();
          session.droppedCardBillboard = null;
          const carte = dropped?.card ?? DIRECTOR_DROPPED_CARD;
          if (grantCard(session, carte)) {
            triggerHeroLine(session, `carte_${carte}`);
            streamEvent(session, "carte");
          }
        }

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
          const found = ++session.secretsFound;
          const total = session.secretsTotal;
          useGameStore.getState().setDebug({ secretsFound: found });
          // Info FACTUELLE (n/total, sans cooldown) + réplique de réaction
          // (canal dédié, cooldownée) — même partage que `onToiletUse`.
          showHudMessage(`Secret trouvé ! (${found}/${total})`);
          playSfx("secret_found");
          session.heroPortrait.react("discover");
          triggerHeroLine(session, SECRET_LINES[secret.name] ?? "secret_generique");
          streamEvent(session, "secret");
        }

        updateLevelScript(
          session.levelScript, session.scriptTriggers, LEVEL_EVENTS, gameplayDt, session.player.position,
          (action) => runScriptAction(engine, session, action),
        );

        // En dernier : une réplique d'événement (secret, carte, arme, moment
        // scripté) dite dans ce pas passe avant celle de la pièce.
        updatePlaceLine(session, gameplayDt);

        updateStreamFeed(session, gameplayDt);
      });
    }),
  );
}
