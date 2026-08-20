import { Howl } from "howler";

/**
 * Wrapper minimal autour de Howler pour les effets sonores PONCTUELS du jeu
 * (tir, impact, et depuis la Phase 3 le feedback sonore de l'ennemi
 * « Costard » — alerte, télégraphie d'attaque, dégât encaissé, mort).
 * Scope strict des Phases 2-3 (`PLAN_PROTO_BOOMER_SHOOTER.md`) : aucune
 * musique, aucune nappe d'ambiance, aucune réplique du héros ici — ces
 * trois-là sont explicitement Phase 6 (« Habillage ») et n'ont pas leur place
 * dans ce module.
 *
 * APPELANT : ce module ne touche jamais le pas fixe (invariant #2). Il est
 * consommé exclusivement depuis `updateFx` dans `main.ts`, sur des
 * `fireEvents`/`hitEvents` déjà produits par le pas fixe qui vient de tourner
 * — jamais de `setState` React ici (ce n'est de toute façon pas du React).
 *
 * ASSETS — les 9 ids de `SFX_TABLE` ont chacun un placeholder SYNTHÉTIQUE
 * (bruit/sinus générés par script, pas d'enregistrement, pas de source
 * externe) sous `public/assets/audio/sfx/<file>.{ogg,m4a}`, ajoutés le
 * 2026-08-20 pour permettre de juger le feedback de hit avec du son plutôt
 * qu'en silence total. Ce sont des boîtes blanches sonores, au même titre que
 * les meshes non texturés (invariant #9) — À REMPLACER par de vrais assets à
 * la Phase 5, pas des choix de sound design arrêtés. `public/` est déjà le
 * `publicDir` par défaut de Vite (non reconfiguré), donc `/assets/audio/sfx/...`
 * résout correctement tel quel, en dev comme en build.
 *
 * Un fichier absent (404, cas normal aujourd'hui) ne doit JAMAIS faire
 * planter le jeu : `onloaderror` log un SEUL `console.warn` par id (pas un
 * par tentative de lecture, un tir ne doit pas spammer la console) et le son
 * correspondant ne joue simplement pas. Aucun `throw`, nulle part dans ce
 * module.
 *
 * POOLING ET VARIATION DE PITCH — exactement le pattern prescrit par le skill
 * `audio-sfx-pipeline` : N instances de `Howl` par id, rotation circulaire,
 * variation de rate ±8 % à chaque lecture. Ça évite deux problèmes distincts :
 *  - l'effet « mitraillette de samples identiques » sur un son répété (tir,
 *    impact) ;
 *  - `Howl.rate(rate)` SANS id de son cible modifie la vitesse de TOUTES les
 *    instances en cours de lecture de ce `Howl` — en tirant au pompe (9
 *    plombs, jusqu'à 9 `hitEvent` dans le même pas fixe), appeler `rate()`
 *    sur le même objet `Howl` pour le plomb n+1 changerait rétroactivement le
 *    pitch du plomb n déjà en train de jouer. Un pool évite ce chevauchement.
 *
 * PIÈGE NAVIGATEUR (skill `audio-sfx-pipeline`) : le contexte audio reste
 * suspendu tant qu'aucune interaction utilisateur n'a eu lieu. Howler gère ça
 * lui-même via `Howler.autoUnlock` (`true` par défaut), qui écoute les
 * premiers `click`/`touchend`/`keydown` du `document` — exactement
 * l'événement `click` sur le canvas qui déclenche déjà `requestPointerLock`
 * dans `core/input.ts`. Aucun code de déblocage supplémentaire n'est
 * nécessaire ici.
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
  | "enemy_death";

interface SfxDef {
  /** Nom de fichier SANS extension, résolu en `${SFX_BASE_PATH}/<file>.{ogg,m4a}`. */
  file: string;
  /** Volume de base [0..1], avant tout scale passé à `playSfx`. */
  volume: number;
}

const SFX_BASE_PATH = "/assets/audio/sfx";

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
};

/** Son de tir par arme. */
const WEAPON_FIRE_SFX: Record<"melee" | "shotgun", SfxId> = {
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
 * Pool circulaire de `Howl` pour UN id logique. Pattern skill
 * `audio-sfx-pipeline` tel quel. Construit des `Howl` en `preload: true`
 * (par défaut) : chaque instance tente son propre chargement, échoue en
 * silence si le fichier est absent (voir `onloaderror` plus bas), et
 * `warnOnce` garantit un seul `console.warn` par id malgré les N échecs
 * (un par instance du pool).
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
export function playWeaponFireSfx(weapon: "melee" | "shotgun") {
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
