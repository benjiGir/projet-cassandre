import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { playSfx } from "../../core/audio";
import { runGameplaySync } from "../../core/runtime";
import { RaycastService } from "../../physics/raycast";
import { GROUP, interactionGroups } from "../../physics/world";
import { useGameStore } from "../state";
import { showHudMessage, triggerHeroLine } from "./feedback";
import { type GameSession } from "./gameSession";

/**
 * Règle "sanitaires utilisables" (Duke Nukem 3D, `checksectors`/cas
 * TOILET/STALL de `player.c`) — UNE seule règle dans le jeu, partagée par le
 * `use_toilet` historique (`onToiletUse`, niveau `hypermarche_complet`) et le
 * préfixe `sanitaire_*` du niveau v2 : voir [ADR 0032](../../../docs/decisions/0032-sanitaires-utilisables.md).
 *
 * **Portée d'usage — visée.** `trySanitaire` (préfixe `sanitaire_*`) exige de
 * VISER l'appareil, pas seulement de s'en tenir à distance — un joueur dos
 * tourné ou juste passant à côté sans regarder ne déclenche plus rien
 * (retour de playtest, 2026-09-24 : "je peux quand même activer [...] même si
 * je regarde pas les toilettes"). "Neartag" façon Duke 3D : un rayon Rapier
 * (`RaycastService`, même origine œil que les armes —
 * `game/player/weapons.ts`, jamais une position interpolée, invariant #3/#11)
 * part de l'œil du joueur dans la direction de visée courante ; l'interprétation
 * géométrique du résultat vit dans `SanitaireSystem.resolveAim`
 * (`game/level/sanitaires.ts`), voir sa doc pour le détail intact/cassé.
 * `onToiletUse` (compatibilité `use_toilet`) reste un ramassage par
 * proximité SEULE, comme avant — ce préfixe historique n'a jamais eu de
 * variante cassée, rien à viser.
 *
 * Deux gestes, chacun sa fonction ci-dessous :
 * - **Soulagement** (`relieveAtSanitaire`) : un sanitaire INTACT rend
 *   `SANITAIRE_RELIEF_HEAL_FRACTION` du PV max (arrondi), plafonné à ce max,
 *   puis un délai GLOBAL de gameplay (`SANITAIRE_RELIEF_COOLDOWN_SECONDS`)
 *   avant le prochain — un seul compteur pour tous les sanitaires du niveau,
 *   `session.sanitaireReliefCooldown`, décrémenté au pas fixe par le VRAI
 *   `gameplayDt` (hitstop compris, jamais un temps mural — invariants #1/#13).
 *   Pendant le délai, ou à PV pleins, la chasse d'eau part quand même
 *   (`sanitaire_use`) mais rien ne soigne. Écart volontaire à Duke : à PV
 *   pleins ET hors délai, le délai n'est PAS consommé — plus amical, ça évite
 *   de "gâcher" un soulagement en testant l'objet sans en avoir besoin. Duke
 *   fige aussi le joueur ~2 s pendant l'acte : ON NE LE FAIT PAS, invariant
 *   #10 (aucune animation ne bloque le joueur).
 * - **Gorgée** (`drinkFromSanitaire`) : un sanitaire CASSÉ (jet d'eau
 *   permanent) rend `SANITAIRE_SIP_HEAL` PV par appui, illimité, plafonné au
 *   max — jamais de délai, jamais de chasse d'eau (déjà cassé), jamais de son
 *   à PV pleins.
 *
 * `trySanitaire` est le point d'entrée unique depuis `updateGameplay.ts` :
 * lance le rayon de visée, résout le sanitaire visé
 * (`SanitaireSystem.resolveAim`) et dispatche vers l'un des deux gestes.
 * `onToiletUse` (compatibilité `use_toilet`) appelle directement
 * `relieveAtSanitaire` — un `use_toilet` est toujours une cuvette intacte,
 * il n'y a jamais de variante cassée de ce préfixe historique.
 */

/**
 * Portée du "neartag" de visée d'un `sanitaire_*`, mètres — VOLONTAIREMENT
 * plus courte que `USE_RANGE_METERS` (2 m, `game/level/loader.ts`, la portée
 * générique d'un `use_*`) : viser une cuvette exige de s'y tenir devant et de
 * baisser les yeux (œil à 1,6 m, cuvette contre son mur à ~0,4-0,8 m de haut
 * — le trajet œil → cuvette mesure grossièrement 1,3 m à bout portant), viser
 * un urinoir se fait de face, à bout de bras. 1,4 m couvre les deux sans
 * laisser un joueur qui regarde vaguement dans la bonne direction depuis le
 * milieu de la pièce déclencher la chasse d'eau — exactement la plainte de
 * playtest corrigée ici (2026-09-24) : "même si je regarde pas les
 * toilettes, et que je suis pas vraiment devant collé, je peux quand même
 * activer".
 */
export const SANITAIRE_AIM_RANGE_METERS = 1.4;

/**
 * Groupe de requête du rayon de visée : seul le FILTRE (WORLD) compte pour
 * restreindre les colliders touchés — même patron que `WORLD_ONLY_RAY_GROUPS`
 * des lignes de vue ennemies (`enemyMachine.ts`/`pathfinding.ts`).
 * L'appartenance choisie ici (`PLAYER`) n'a besoin que de passer le filtre
 * `ALL_GROUPS` que porte tout collider WORLD (`COLLISION_GROUPS.WORLD`,
 * `physics/world.ts`) — murs, cloisons de cabine ET colliders de
 * `sanitaire_*` (toujours groupe WORLD, voir `game/level/loader.ts`) sont
 * donc tous atteignables par ce rayon ; PROP/ENEMY/DEBRIS ne le sont pas,
 * même choix que les lignes de vue ennemies (ADR 0030).
 */
const SANITAIRE_AIM_RAY_GROUPS = interactionGroups(GROUP.PLAYER, GROUP.WORLD);

// Scratch réutilisés d'un appui sur E à l'autre — jamais alloués dans la
// boucle, même discipline que `weaponEyeOrigin`/`exitDoorOffsetScratch` dans
// `game/loop/updateGameplay.ts`. Cette fonction n'est déclenchée qu'au FRONT
// MONTANT de la touche E (une fois par pas fixe au plus), donc pas un point
// chaud comme les raycasts d'armes — la discipline est gardée par cohérence
// avec le reste du fichier, pas par nécessité de perf.
const aimEyeOriginScratch = new THREE.Vector3();
const aimEulerScratch = new THREE.Euler(0, 0, 0, "YXZ"); // même convention que la caméra/les armes (weapons.ts::computeAimBasis)
const aimQuatScratch = new THREE.Quaternion();
const aimDirectionScratch = new THREE.Vector3();
const aimRayScratch = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });

/** Fraction de `playerMaxHp` rendue par un soulagement (Duke : max/10 PV — +10 sur 100). */
const SANITAIRE_RELIEF_HEAL_FRACTION = 0.1;

/**
 * Délai de gameplay, en secondes, entre deux soulagements — Duke 3D :
 * 26 * 220 tics à 26 tics/s, soit 220 s ; on garde la même valeur en secondes
 * de GAMEPLAY (voir la doc de `GameSession.sanitaireReliefCooldown`).
 */
export const SANITAIRE_RELIEF_COOLDOWN_SECONDS = 220;

/** PV rendus par une gorgée au jet d'eau d'un sanitaire cassé — illimité, contrairement au soulagement. */
const SANITAIRE_SIP_HEAL = 1;

/** Graine RNG dédiée au choix de la réplique de soulagement — famille
 * `SHOTGUN_SPREAD_SEED`/`BASE_SUIT_SEED`, jamais dérivée de `Math.random()`/`Date.now()`. */
export const SANITAIRE_RELIEF_LINE_SEED = 0x50111e77;

/** Message HUD (canal SYSTÈME, sans cooldown) pendant le délai — court, drôle, facultatif au sens du contrat. */
const HUD_SANITAIRE_ON_COOLDOWN = "Rien ne vient.";
/** Message HUD à PV pleins — partagé par le soulagement et la gorgée. */
const HUD_SANITAIRE_FULL_HP = "Vous êtes déjà en pleine forme.";

/** Répliques du héros au soulagement, tirées par `session.sanitaireReliefRandom` (RNG déterministe, invariant #12). */
const HERO_LINES_RELIEF: readonly string[] = [
  "Ça va mieux.",
  "Ah. Voilà qui est fait.",
  "On se sent tout de suite mieux, hein.",
  "Ça, c'est du soulagement de qualité.",
];

function pickReliefHeroLine(session: GameSession): string {
  const index = Math.floor(session.sanitaireReliefRandom() * HERO_LINES_RELIEF.length);
  // Clamp défensif : `forSeed` rend `[0, 1)`, mais un futur générateur qui
  // rendrait exactement 1 ne doit jamais indexer hors tableau.
  return HERO_LINES_RELIEF[Math.min(index, HERO_LINES_RELIEF.length - 1)]!;
}

/**
 * Soulagement à un sanitaire INTACT — voir la doc de tête du fichier pour la
 * règle complète. Appelée à la fois par `trySanitaire` (sanitaire `sanitaire_*`
 * le plus proche à portée) et par `onToiletUse` (compatibilité `use_toilet`,
 * `game/loop/updateGameplay.ts`) : UNE seule règle, deux points d'entrée.
 */
export function relieveAtSanitaire(session: GameSession): void {
  // La chasse d'eau part dans TOUS les cas — soin ou pas, contrat Duke.
  playSfx("sanitaire_use");

  if (session.sanitaireReliefCooldown > 0) {
    showHudMessage(HUD_SANITAIRE_ON_COOLDOWN);
    return;
  }

  const maxHp = useGameStore.getState().debug.playerMaxHp;
  if (session.playerHp >= maxHp) {
    // Délai NON consommé : écart volontaire à Duke, voir la doc de tête.
    showHudMessage(HUD_SANITAIRE_FULL_HP);
    return;
  }

  const healed = Math.min(maxHp, session.playerHp + Math.round(maxHp * SANITAIRE_RELIEF_HEAL_FRACTION)) - session.playerHp;
  session.playerHp += healed;
  useGameStore.getState().setPlayerHp(session.playerHp);
  session.sanitaireReliefCooldown = SANITAIRE_RELIEF_COOLDOWN_SECONDS;
  showHudMessage(`+${healed} PV`);
  triggerHeroLine(session, pickReliefHeroLine(session));
}

/** Gorgée au jet d'eau permanent d'un sanitaire CASSÉ — voir la doc de tête du fichier. */
function drinkFromSanitaire(session: GameSession): void {
  const maxHp = useGameStore.getState().debug.playerMaxHp;
  if (session.playerHp >= maxHp) {
    // Pas de son de gorgée à PV pleins — il n'y a rien à boire "pour rien",
    // contrairement à la chasse d'eau du soulagement qui part toujours.
    showHudMessage(HUD_SANITAIRE_FULL_HP);
    return;
  }

  session.playerHp = Math.min(maxHp, session.playerHp + SANITAIRE_SIP_HEAL);
  useGameStore.getState().setPlayerHp(session.playerHp);
  playSfx("water_drink");
  showHudMessage(`+${SANITAIRE_SIP_HEAL} PV`);
}

/**
 * Point d'entrée unique depuis `updateGameplay.ts` : sur un front montant de
 * la touche E, lance le rayon de visée ("neartag", voir la doc de tête du
 * fichier), résout le `sanitaire_*` visé (`SanitaireSystem.resolveAim`) et
 * dispatche (intact -> soulagement, cassé -> gorgée). Retourne `true` si
 * l'appui a été CONSOMMÉ — même contrat que `InteractionSystem.update`, pour
 * que `updateGameplay.ts` sache s'il reste quelque chose à faire de cet
 * appui (la porte manœuvrable la plus proche).
 *
 * `eyeOffset`/`yaw`/`pitch` : mêmes disciplines de déterminisme que
 * `WeaponSystem.update` (`game/player/weapons.ts`) — origine et direction du
 * pas fixe COURANT (`player.position` déjà avancée, `frame.yaw`/`frame.pitch`),
 * JAMAIS une valeur interpolée pour le rendu. Une origine/direction
 * interpolée dépendrait du taux d'affichage et casserait silencieusement le
 * rejeu déterministe du rayon (invariants #1/#3/#11/#12).
 */
export function trySanitaire(
  session: GameSession,
  usePressed: boolean,
  playerPosition: THREE.Vector3,
  eyeOffset: number,
  yaw: number,
  pitch: number,
): boolean {
  if (!usePressed) return false;
  const system = session.sanitaireSystem;
  if (!system) return false;

  aimEyeOriginScratch.set(playerPosition.x, playerPosition.y + eyeOffset, playerPosition.z);
  aimEulerScratch.set(pitch, yaw, 0);
  aimQuatScratch.setFromEuler(aimEulerScratch);
  aimDirectionScratch.set(0, 0, -1).applyQuaternion(aimQuatScratch);

  aimRayScratch.origin.x = aimEyeOriginScratch.x;
  aimRayScratch.origin.y = aimEyeOriginScratch.y;
  aimRayScratch.origin.z = aimEyeOriginScratch.z;
  aimRayScratch.dir.x = aimDirectionScratch.x;
  aimRayScratch.dir.y = aimDirectionScratch.y;
  aimRayScratch.dir.z = aimDirectionScratch.z;

  // Un seul rayon Rapier, filtré WORLD — le PREMIER mur/cloison/sanitaire
  // touché. `SanitaireSystem.resolveAim` décide ensuite si c'est un
  // sanitaire intact, ou s'il faut tester le jet des sanitaires cassés
  // au-delà (voir sa doc). Nested `runGameplaySync` : même pattern déjà
  // établi par `WeaponSystem` (`fireMelee`/`firePistol`/`fireShotgun`), qui
  // l'appelle depuis l'intérieur d'un `Effect.sync` déjà exécuté par le
  // `runGameplaySync` englobant de `updateGameplay.ts` — sûr tant que rien
  // ne suspend, ce qu'un `Effect.sync` ne fait jamais.
  const hit = runGameplaySync(
    RaycastService.use((raycast) =>
      raycast.castRay(
        session.physics,
        aimRayScratch,
        SANITAIRE_AIM_RANGE_METERS,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        SANITAIRE_AIM_RAY_GROUPS,
      ),
    ),
  );

  const aimed = system.resolveAim(
    aimEyeOriginScratch,
    aimDirectionScratch,
    SANITAIRE_AIM_RANGE_METERS,
    hit ? { colliderHandle: hit.collider.handle, distance: hit.timeOfImpact } : null,
  );
  if (!aimed) return false;

  if (aimed.broken) drinkFromSanitaire(session);
  else relieveAtSanitaire(session);
  return true;
}
