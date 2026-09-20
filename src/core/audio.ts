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
 * see: docs/systems/hud-audio.md#effets-sonores-ponctuels
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
  | "prop_break_glass";

interface SfxDef {
  /** Nom de fichier SANS extension, résolu en `${SFX_BASE_PATH}/<file>.{ogg,m4a}`. */
  file: string;
  /** Volume de base [0..1], avant tout scale passé à `playSfx`. */
  volume: number;
}

const SFX_BASE_PATH = assetUrl("assets/audio/sfx");

/** Nombre d'instances `Howl` par son, rotation circulaire (skill : N = 4 à 8 pour les armes). */
const POOL_SIZE = 8;

/** Variation de pitch systématique sur tout son répété — ±8 %, cf. skill `audio-sfx-pipeline`. */
const PITCH_VARIATION = 0.08;

const SFX_TABLE: Record<SfxId, SfxDef> = {
  melee_fire: { file: "melee_fire", volume: 0.7 },
  shotgun_fire: { file: "shotgun_fire", volume: 1.0 },
  impact_concrete: { file: "impact_concrete", volume: 0.8 },
  // Pas encore utilisés cette phase (`HitEvent.material` vaut toujours
  // "concrete", voir `PLACEHOLDER_MATERIAL` dans `game/player/weapons.ts`) :
  // déclarés dès maintenant pour qu'un futur système de tag de matériau
  // n'ait qu'à déposer les fichiers, sans toucher au code.
  impact_metal: { file: "impact_metal", volume: 0.8 },
  impact_flesh: { file: "impact_flesh", volume: 0.8 },
  // Feedback ennemi Costard (Phase 3, voir `enemy-state-machine`). Les
  // quatre se répètent potentiellement plusieurs fois par scène (plusieurs
  // Costards, plusieurs coups encaissés, plusieurs télégraphies avant un
  // kill) : aucun n'est le genre de son « unique et signifiant » que le
  // skill `audio-sfx-pipeline` exempte de variation de pitch (clé
  // ramassée, secret trouvé, réplique du héros) — les quatre passent donc
  // par `SfxPool.play()` sans traitement spécial, qui applique déjà la
  // variation ±8 % à tout ce qu'il joue (voir plus bas).
  enemy_alert: { file: "enemy_alert", volume: 0.9 },
  // Volume le plus haut du lot : c'est le canal de lisibilité critique
  // (skill `audio-sfx-pipeline` — « la télégraphie d'attaque ennemie doit
  // être audible et directionnelle »). Doit rester timbralement distinct
  // des trois autres, PAS une variation d'un même sample.
  enemy_telegraph: { file: "enemy_telegraph", volume: 1.0 },
  enemy_hurt: { file: "enemy_hurt", volume: 0.7 },
  enemy_death: { file: "enemy_death", volume: 0.9 },
  // Porte à badge (Zone E, `use_exit_door`) : événements rares et ponctuels
  // (un refus par essai sans badge, un déverrouillage UNE SEULE fois par
  // partie) — passent quand même par `SfxPool`/±8% comme tout le reste, la
  // variation de pitch est inoffensive sur un son qui ne se répète presque
  // jamais.
  door_locked: { file: "door_locked", volume: 0.8 },
  door_unlock: { file: "door_unlock", volume: 0.9 },
  // Portes ANIMÉES (jalon `door_*`, voir `game/level/doors.ts::DoorSystem`) :
  // un son par MOUVEMENT plutôt que par porte — trois timbres suffisent à
  // distinguer un battant d'un coulissant/rideau, voir `DOOR_MOVEMENT_SFX`.
  door_swing: { file: "door_swing", volume: 0.85 },
  door_slide: { file: "door_slide", volume: 0.7 },
  door_shutter: { file: "door_shutter", volume: 0.9 },
  // Secret trouvé (Phase 5, critère de validation du plan) : événement RARE
  // et SIGNIFIANT au sens du skill `audio-sfx-pipeline` (au plus 2 fois par
  // partie) — passe quand même par le même `SfxPool`/±8% que tout le reste
  // par simplicité, la variation de pitch est inoffensive ici aussi.
  secret_found: { file: "secret_found", volume: 0.9 },
  // Trousse de soin ramassée (niveau v2) : fréquent, mais court et discret —
  // il ne doit jamais couvrir la télégraphie d'un Costard.
  heal_pickup: { file: "heal_pickup", volume: 0.7 },
  // Pistolet : sec et court, il se répète bien plus souvent que le pompe.
  pistol_fire: { file: "pistol_fire", volume: 0.75 },
  // Boîte de munitions : deux cliquetis métalliques, à ne pas confondre avec
  // le carillon d'une trousse de soin.
  ammo_pickup: { file: "ammo_pickup", volume: 0.7 },
  // Destruction d'un `prop_*`. Deux timbres seulement : un craquement sec
  // (bois/carton) et un bris (verre). Le métal réutilise `impact_metal`, déjà
  // sur disque — inventer un troisième placeholder pour l'entendre trois fois
  // par partie serait du son pour le son.
  prop_break_wood: { file: "prop_break_wood", volume: 0.85 },
  prop_break_glass: { file: "prop_break_glass", volume: 0.9 },
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
 * Pool circulaire de `Howl` pour UN id logique — voir la doc pour le
 * pourquoi. `preload: true` (par défaut) : une instance qui échoue à
 * charger reste silencieuse (`onloaderror`), `warnOnce` garantit un seul
 * avertissement par id malgré les N échecs (un par instance du pool).
 *
 * see: docs/systems/hud-audio.md#pooling-et-variation-de-pitch
 */
class SfxPool {
  private readonly sounds: Howl[] = [];
  private cursor = 0;
  private warned = false;

  constructor(private readonly id: SfxId, def: SfxDef) {
    const src = [`${SFX_BASE_PATH}/${def.file}.ogg`, `${SFX_BASE_PATH}/${def.file}.m4a`];
    for (let i = 0; i < POOL_SIZE; i++) {
      try {
        this.sounds.push(
          new Howl({
            src,
            volume: def.volume,
            preload: true,
            onloaderror: () => this.warnMissingOnce(),
          }),
        );
      } catch {
        // Défensif : un `throw` synchrone du constructeur Howler (jamais vu
        // en pratique, mais non documenté comme impossible) ne doit pas non
        // plus faire tomber l'initialisation du jeu.
        this.warnMissingOnce();
      }
    }
  }

  private warnMissingOnce() {
    if (this.warned) return;
    this.warned = true;
    console.warn(
      `[audio] SFX "${this.id}" introuvable (attendu : ${SFX_BASE_PATH}/${SFX_TABLE[this.id].file}.{ogg,m4a}) — le jeu continue sans ce son.`,
    );
  }

  play(volumeScale: number) {
    if (this.sounds.length === 0) return;
    const howl = this.sounds[this.cursor]!;
    this.cursor = (this.cursor + 1) % this.sounds.length;
    try {
      const rate = 1 - PITCH_VARIATION + Math.random() * PITCH_VARIATION * 2; // ±8 %
      howl.rate(rate);
      howl.volume(SFX_TABLE[this.id].volume * volumeScale);
      howl.play();
    } catch {
      // Même discipline non-fatale qu'à la construction : un échec de
      // lecture (contexte audio pas encore débloqué, etc.) ne doit jamais
      // remonter dans la boucle de jeu.
      this.warnMissingOnce();
    }
  }
}

let pools: Map<SfxId, SfxPool> | null = null;

/**
 * Construit les pools de tous les sons connus. À appeler UNE FOIS, avant
 * `startLoop` (même endroit que les autres initialisations globales de
 * `main.ts`). Idempotent : un second appel est un no-op silencieux plutôt
 * qu'une erreur, au cas où un futur écran (menu, retry) réappellerait ce
 * point d'entrée par prudence.
 */
export function initAudio() {
  if (pools) return;
  pools = new Map();
  for (const id of Object.keys(SFX_TABLE) as SfxId[]) {
    pools.set(id, new SfxPool(id, SFX_TABLE[id]));
  }
}

/**
 * Joue un effet sonore ponctuel par identifiant logique. Non-bloquant,
 * non-fatal : si `initAudio()` n'a pas encore été appelé, ou si le son est
 * introuvable sur disque, ne fait rien d'observable pour le joueur au-delà
 * du silence (le warning de chargement, lui, ne sort qu'une fois par id, à
 * l'initialisation).
 */
export function playSfx(id: SfxId, volumeScale = 1) {
  pools?.get(id)?.play(volumeScale);
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
