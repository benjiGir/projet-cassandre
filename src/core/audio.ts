import { Howl } from "howler";

import { assetUrl } from "./assetPath";
import type { DoorMovement } from "../game/level/doors";

/**
 * Effets sonores ponctuels (SFX) — tir, impact, feedback ennemi, portes,
 * secrets. Musique et nappe d'ambiance : `core/music.ts`, module séparé
 * (pooling/pitch n'ont aucun sens pour une piste en boucle streamée). Les
 * répliques du héros restent du texte HUD, câblées dans `main.ts`.
 *
 * N'est appelé que depuis `updateFx` — jamais le pas fixe (invariant #2).
 *
 * **Tout le son est SYNTHÉTISÉ par code** depuis le 2026-09-20 : le studio
 * `tools/audio/` rend les recettes de `recipes.py` et les empaquette en un
 * AUDIO SPRITE — un seul fichier, un seul décodage, une seule requête. Ce
 * module ne connaît donc plus de fichiers par son : il charge `sfx.json`,
 * qui dit où chaque son commence dans l'atlas et combien de temps il dure.
 *
 * Deux passes tirées d'échantillons CC0 ont été rejetées à l'écoute avant ce
 * choix ; la dernière parce que deux armes mesuraient 0,976 de ressemblance
 * de timbre. Un son fabriqué se règle, un enregistrement se subit.
 *
 * see: docs/systems/hud-audio.md#assets-sonores
 */

/**
 * Identifiants logiques de sons. Ajouter un nouveau son = ajouter une entrée
 * ici + une entrée dans `SFX_TABLE` (+ éventuellement une entrée dans
 * `MATERIAL_IMPACT_SFX` pour un impact) : `playSfx`/`playWeaponFireSfx`/
 * `playImpactSfx` n'ont jamais besoin de changer.
 */
export type SfxId =
  | "melee_fire"
  | "shotgun_fire"
  | "impact_concrete"
  | "impact_metal"
  | "impact_flesh"
  | "enemy_alert"
  | "enemy_telegraph"
  | "enemy_hurt"
  | "enemy_death"
  | "door_locked"
  | "door_unlock"
  | "door_swing"
  | "door_slide"
  | "door_shutter"
  | "secret_found"
  | "heal_pickup"
  | "pistol_fire"
  | "ammo_pickup"
  | "prop_break_wood"
  | "prop_break_glass"
  | "sanitaire_use"
  | "sanitaire_break"
  | "water_drink";

interface SfxDef {
  /**
   * Clé dans le sprite, telle que `recipes.py` nomme la recette.
   *
   * L'identifiant du JEU et le nom de la RECETTE sont volontairement deux
   * choses : le jeu parle de `melee_fire`, le studio de `crowbar_swing`, et
   * aucun des deux n'a à se plier au vocabulaire de l'autre. C'est cette
   * table qui les raccorde, et c'est le seul endroit à toucher si une recette
   * est renommée.
   */
  sprite: string;
  /** Volume de base [0..1], avant tout scale passé à `playSfx`. */
  volume: number;
  /**
   * Variation de hauteur à chaque lecture, en fraction. Défaut
   * `PITCH_VARIATION`.
   *
   * À baisser sur tout son tiré d'un VRAI enregistrement, et en particulier
   * sur les armes du joueur. La variation existe pour casser la répétition
   * d'un échantillon court ; sur un son de synthèse elle passe inaperçue, mais
   * ±8 % sur un coup de feu font presque un ton et demi — l'arme change de
   * calibre d'un tir à l'autre, et l'oreille lit ça comme un faux.
   */
  pitch?: number;
}

const SFX_BASE_PATH = assetUrl("assets/audio/sfx");

/** Repli si le manifeste ne dit pas combien de lectures simultanées prévoir. */
const POOL_LECTURES = 12;

/** Variation de pitch systématique sur tout son répété — ±8 %, cf. skill `audio-sfx-pipeline`. */
const PITCH_VARIATION = 0.08;
let audioRandom: () => number = () => 0.5;

/** Flux de présentation indépendant, remis à zéro à chaque nouvelle partie. */
export function setAudioRandom(random: () => number): void {
  audioRandom = random;
}

const SFX_TABLE: Record<SfxId, SfxDef> = {
  melee_fire: { sprite: "crowbar_swing", volume: 0.7, pitch: 0.04 },
  shotgun_fire: { sprite: "shotgun", volume: 1.0, pitch: 0.025 },
  impact_concrete: { sprite: "impact_concrete", volume: 0.8 },
  // Pas encore utilisés cette phase (`HitEvent.material` vaut toujours
  // "concrete", voir `PLACEHOLDER_MATERIAL` dans `game/player/weapons.ts`) :
  // les recettes existent, un futur système de tag de matériau n'aura rien à
  // ajouter ici.
  impact_metal: { sprite: "impact_metal", volume: 0.8 },
  impact_flesh: { sprite: "impact_flesh", volume: 0.8 },
  // Feedback ennemi Costard (Phase 3, voir `enemy-state-machine`). Les
  // quatre se répètent potentiellement plusieurs fois par scène (plusieurs
  // Costards, plusieurs coups encaissés, plusieurs télégraphies avant un
  // kill) : aucun n'est le genre de son « unique et signifiant » que le
  // skill `audio-sfx-pipeline` exempte de variation de pitch (clé
  // ramassée, secret trouvé, réplique du héros) — les quatre passent donc
  // par `playSfx` sans traitement spécial, qui applique déjà la variation
  // ±8 % à tout ce qu'il joue (voir plus bas).
  enemy_alert: { sprite: "suit_alert", volume: 0.9 },
  // Volume le plus haut du lot : c'est le canal de lisibilité critique
  // (skill `audio-sfx-pipeline` — « la télégraphie d'attaque ennemie doit
  // être audible et directionnelle »). Doit rester timbralement distinct
  // des trois autres, PAS une variation d'un même sample.
  enemy_telegraph: { sprite: "suit_telegraph", volume: 1.0 },
  enemy_hurt: { sprite: "enemy_hurt", volume: 0.7 },
  enemy_death: { sprite: "suit_death", volume: 0.9 },
  // Porte à badge (Zone E, `use_exit_door`) : événements rares et ponctuels
  // (un refus par essai sans badge, un déverrouillage UNE SEULE fois par
  // partie) — passent quand même par le ±8 % commun, inoffensif sur un son
  // qui ne se répète presque jamais.
  door_locked: { sprite: "door_locked", volume: 0.8 },
  door_unlock: { sprite: "door_unlock", volume: 0.9 },
  // Portes ANIMÉES (jalon `door_*`, voir `game/level/doors.ts::DoorSystem`) :
  // un son par MOUVEMENT plutôt que par porte — trois timbres suffisent à
  // distinguer un battant d'un coulissant/rideau, voir `DOOR_MOVEMENT_SFX`.
  door_swing: { sprite: "door_open", volume: 0.85 },
  door_slide: { sprite: "door_slide", volume: 0.7 },
  door_shutter: { sprite: "door_shutter", volume: 0.9 },
  // Secret trouvé (Phase 5, critère de validation du plan) : événement RARE
  // et SIGNIFIANT au sens du skill `audio-sfx-pipeline` (au plus 2 fois par
  // partie) — passe quand même par le ±8 % commun, inoffensif ici aussi.
  secret_found: { sprite: "secret_found", volume: 0.9 },
  // Trousse de soin ramassée (niveau v2) : fréquent, mais court et discret —
  // il ne doit jamais couvrir la télégraphie d'un Costard.
  heal_pickup: { sprite: "pickup_health", volume: 0.7 },
  // Pistolet : sec et court, il se répète bien plus souvent que le pompe.
  pistol_fire: { sprite: "pistol_fire", volume: 0.75, pitch: 0.025 },
  // Boîte de munitions : deux cliquetis métalliques, à ne pas confondre avec
  // le carillon d'une trousse de soin.
  ammo_pickup: { sprite: "pickup_ammo", volume: 0.7 },
  // Destruction d'un `prop_*`. Deux timbres seulement : un craquement sec
  // (bois/carton) et un bris (verre). Le métal réutilise `impact_metal` : une
  // troisième recette pour l'entendre trois fois par partie serait du son
  // pour le son.
  prop_break_wood: { sprite: "prop_break_wood", volume: 0.85 },
  prop_break_glass: { sprite: "impact_glass", volume: 0.9 },
  // Sanitaires (`sanitaire_*`, toilettes du niveau v2) : la chasse d'eau à
  // chaque usage, la faïence qui éclate et la gerbe d'eau à la casse, une
  // gorgée à chaque appui sur E devant le jet.
  sanitaire_use: { sprite: "toilet_flush", volume: 0.8 },
  sanitaire_break: { sprite: "ceramic_break", volume: 0.9 },
  water_drink: { sprite: "water_gulp", volume: 0.7 },
};

/** Son de tir par arme. */
const WEAPON_FIRE_SFX: Record<"melee" | "pistol" | "shotgun", SfxId> = {
  pistol: "pistol_fire",
  melee: "melee_fire",
  shotgun: "shotgun_fire",
};

/**
 * Son d'impact par matériau — LOOKUP volontairement construit comme table,
 * même si un seul matériau existe cette phase (voir doc de tête). Un
 * `hit.material` absent de cette table (typo, ou futur tag encore non
 * branché) retombe sur `DEFAULT_IMPACT_SFX` plutôt que de ne rien jouer ou
 * de planter.
 */
const MATERIAL_IMPACT_SFX: Record<string, SfxId> = {
  concrete: "impact_concrete",
  metal: "impact_metal",
  flesh: "impact_flesh",
};
const DEFAULT_IMPACT_SFX: SfxId = "impact_concrete";

/**
 * Son de destruction par matière de prop (`game/level/props.ts`). Même
 * discipline que `MATERIAL_IMPACT_SFX` : la clé est une chaîne LIBRE, pas un
 * type importé de `game/` — `core/audio.ts` ne connaît pas les matières du
 * niveau, il ne connaît que des noms.
 */
const PROP_BREAK_SFX: Record<string, SfxId> = {
  bois: "prop_break_wood",
  carton: "prop_break_wood",
  verre: "prop_break_glass",
  metal: "impact_metal",
};
const DEFAULT_PROP_BREAK_SFX: SfxId = "prop_break_wood";

/**
 * Ce que `tools/audio/build_sprite.py` écrit à côté de l'atlas.
 *
 * `sprite` est au format attendu par Howler : par clé, `[début_ms, durée_ms]`
 * dans l'atlas. Le fichier est GÉNÉRÉ — il ne s'édite pas à la main, il se
 * régénère depuis `recipes.py`.
 */
interface SpriteManifest {
  src: string[];
  sprite: Record<string, [number, number]>;
  pool?: number;
}

let atlas: Howl | null = null;
let cles: Set<string> = new Set();
let chargement = false;
const avertis = new Set<string>();

function avertirUneFois(cle: string, raison: string) {
  if (avertis.has(cle)) return;
  avertis.add(cle);
  console.warn(`[audio] ${raison} — le jeu continue sans ce son.`);
}

/**
 * Charge l'atlas et son manifeste. À appeler UNE FOIS, avant `startLoop`
 * (même endroit que les autres initialisations globales de `main.ts`).
 * Idempotent.
 *
 * Volontairement SYNCHRONE en apparence : elle lance le chargement et rend la
 * main. Tant que l'atlas n'est pas là, `playSfx` ne fait rien — c'est la même
 * discipline non-fatale qu'avant, et le premier son du jeu arrive de toute
 * façon des dizaines de secondes après le démarrage. En faire une promesse
 * obligerait `main.ts` à attendre le réseau avant d'afficher quoi que ce soit.
 */
export function initAudio() {
  if (atlas || chargement) return;
  chargement = true;

  fetch(`${SFX_BASE_PATH}/sfx.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((manifeste: SpriteManifest) => {
      cles = new Set(Object.keys(manifeste.sprite));
      atlas = new Howl({
        src: manifeste.src.map((f) => `${SFX_BASE_PATH}/${f}`),
        sprite: manifeste.sprite,
        // Nombre de nœuds audio que Howler garde pour les lectures qui se
        // chevauchent. Le pompe tire 9 plombs dans le même pas fixe : à 5, le
        // défaut, les derniers voleraient le nœud des premiers.
        pool: manifeste.pool ?? POOL_LECTURES,
        onloaderror: () =>
          avertirUneFois("atlas", `atlas introuvable (${SFX_BASE_PATH}/sfx.{ogg,m4a})`),
      });

      // Un identifiant du jeu qui ne pointe sur aucune recette est une ERREUR
      // de câblage, pas un silence acceptable : elle se dit une fois, au
      // chargement, plutôt qu'au premier tir.
      for (const id of Object.keys(SFX_TABLE) as SfxId[]) {
        const cle = SFX_TABLE[id].sprite;
        if (!cles.has(cle)) {
          avertirUneFois(id, `"${id}" pointe sur la recette "${cle}", absente du sprite`);
        }
      }
    })
    .catch((e) => {
      chargement = false;
      avertirUneFois("manifeste", `manifeste audio illisible (${e})`);
    });
}

/**
 * Joue un effet sonore ponctuel par identifiant logique. Non-bloquant,
 * non-fatal : avant que l'atlas soit chargé, ou si la recette manque, ne fait
 * rien d'observable au-delà du silence.
 *
 * Le volume et la hauteur sont posés sur l'IDENTIFIANT DE LECTURE renvoyé par
 * `play`, jamais sur le `Howl` entier — sans ça, le neuvième plomb d'un tir de
 * pompe changerait rétroactivement la hauteur des huit qui sonnent encore.
 * C'est ce que le pool d'instances évitait avant ; le sprite le règle mieux,
 * puisque chaque lecture a sa propre identité.
 */
export function playSfx(id: SfxId, volumeScale = 1) {
  if (!atlas) return;
  const def = SFX_TABLE[id];
  if (!cles.has(def.sprite)) return;

  const lecture = atlas.play(def.sprite);
  if (lecture === undefined) return;
  const p = def.pitch ?? PITCH_VARIATION;
  atlas.rate(1 - p + audioRandom() * p * 2, lecture);
  atlas.volume(def.volume * volumeScale, lecture);
}

/**
 * État du câblage son, pour la console de debug : par identifiant du jeu, la
 * recette visée et si elle est réellement dans le sprite chargé. C'est ce qui
 * répond à « pourquoi ce son ne sort pas » sans lire le code.
 */
export function listSfx(): { id: SfxId; recette: string; present: boolean }[] {
  return (Object.keys(SFX_TABLE) as SfxId[]).map((id) => ({
    id,
    recette: SFX_TABLE[id].sprite,
    present: cles.has(SFX_TABLE[id].sprite),
  }));
}

/** Son de tir pour l'arme `weapon` — lookup encapsulé, voir `WEAPON_FIRE_SFX`. */
export function playWeaponFireSfx(weapon: "melee" | "pistol" | "shotgun") {
  playSfx(WEAPON_FIRE_SFX[weapon]);
}

/**
 * Son d'impact pour le matériau `material` — lookup encapsulé, voir
 * `MATERIAL_IMPACT_SFX`. Un matériau inconnu de la table retombe sur
 * `DEFAULT_IMPACT_SFX`, jamais sur une absence de son ni une exception.
 */
export function playImpactSfx(material: string) {
  playSfx(MATERIAL_IMPACT_SFX[material] ?? DEFAULT_IMPACT_SFX);
}

/**
 * Son de destruction pour la matière `matiere` d'un `prop_*` — lookup
 * encapsulé, voir `PROP_BREAK_SFX`. Une matière inconnue retombe sur le
 * craquement de bois, jamais sur le silence.
 */
export function playPropBreakSfx(matiere: string) {
  playSfx(PROP_BREAK_SFX[matiere] ?? DEFAULT_PROP_BREAK_SFX);
}

/** Événement de feedback sonore ennemi — un par transition observable de la state machine du Costard. */
type EnemySfxEvent = "alert" | "telegraph" | "hurt" | "death";

/** Son de feedback ennemi par événement — lookup encapsulé, voir `ENEMY_SFX`. */
const ENEMY_SFX: Record<EnemySfxEvent, SfxId> = {
  alert: "enemy_alert",
  telegraph: "enemy_telegraph",
  hurt: "enemy_hurt",
  death: "enemy_death",
};

/**
 * Son de feedback pour un événement `event` de la state machine ennemie
 * (« Costard »). `"telegraph"` doit être déclenché à l'ANTICIPATION d'une
 * attaque, avant que les dégâts ne partent — jamais en même temps ni après
 * (voir skill `audio-sfx-pipeline`, lisibilité de la télégraphie).
 */
export function playEnemySfx(event: EnemySfxEvent) {
  playSfx(ENEMY_SFX[event]);
}

/** Événement sonore de la porte à badge (Zone E, `use_exit_door`). */
type DoorSfxEvent = "locked" | "unlock";

const DOOR_SFX: Record<DoorSfxEvent, SfxId> = {
  locked: "door_locked",
  unlock: "door_unlock",
};

/** Son de feedback pour un essai d'ouverture de la porte à badge. */
export function playDoorSfx(event: DoorSfxEvent) {
  playSfx(DOOR_SFX[event]);
}

/**
 * Son de MOUVEMENT d'un vantail animé (`game/level/doors.ts::DoorSystem`),
 * joué au DÉBUT d'une ouverture depuis l'état fermé — jamais à la fermeture
 * (silencieuse, un vantail qui se referme ne surprend personne) ni à
 * répétition tant qu'il reste ouvert. Trois timbres seulement :
 * - `battant` -> `door_swing` (grincement de charnière) ;
 * - `coulisse`/`descend` -> `door_slide` (glissement/enfoncement mécanique,
 *   même souffle bref pour les deux — aucun des deux ne "roule") ;
 * - `monte` -> `door_shutter` (rideau métallique qui se déroule, plus long).
 */
const DOOR_MOVEMENT_SFX: Record<DoorMovement, SfxId> = {
  battant: "door_swing",
  coulisse: "door_slide",
  descend: "door_slide",
  monte: "door_shutter",
};

export function playDoorMovementSfx(movement: DoorMovement) {
  playSfx(DOOR_MOVEMENT_SFX[movement]);
}
