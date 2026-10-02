import { Howl } from "howler";

import { assetUrl } from "./assetPath";
import { waitForAudioLoad } from "./audioPreparation";
import { computeWaterAmbienceMix, smoothTowards, type Vec3Like, type WaterAmbienceMix } from "./waterAmbienceMix";

/**
 * Boucle d'eau positionnelle des sanitaires cassés (`sanitaire_*`, jet
 * permanent posé par `game/level/sanitaires.ts::SanitaireSystem` à la
 * casse) — UN `Howl` UNIQUE, en boucle, dont le volume et le panoramique
 * suivent la position/orientation de la caméra à chaque frame d'affichage.
 * Appelée depuis `updateFx` (`game/loop/updateFx.ts`), JAMAIS le pas fixe
 * (invariant #2) : c'est de la présentation, comme le reste de ce fichier.
 *
 * Le calcul du mélange (gain/pan/lissage) est PUR et vit dans
 * `core/waterAmbienceMix.ts`, testable sans Howler — ce module se contente
 * de le brancher sur un vrai `Howl` et de gérer son cycle de vie
 * (amorcé en silence au chargement, gain nul en l'absence de jet).
 *
 * `html5: false` (Web Audio, le défaut de Howler), jamais `html5: true` :
 * une boucle HTML5 a un trou audible au raccord de bouclage, et surtout
 * `stereo()` — utilisé ici à chaque frame — n'a d'effet qu'en Web Audio.
 *
 * see: docs/archive/systems-hud-audio.md#boucle-deau-positionnelle
 */

const WATER_AMBIENCE_BASE_PATH = assetUrl("assets/audio/sfx");

/**
 * Volume Howler du jet le plus proche possible (gain 1, AVANT le plafond de
 * gain sommé de `waterAmbienceMix.ts`). Plafond de mixage choisi sous TOUT
 * ce qui compte pour le gameplay (hiérarchie du skill `audio-mix-budget`) :
 * sous `enemy_telegraph` (1.0 dans `SFX_TABLE`, rang 2 — canal de
 * lisibilité critique), sous les tirs (rang 1/4), même sous les ramassages
 * (rang 5, 0.7) — c'est un bruit de fond LOCAL, pas un évènement. Avec le
 * plafond de gain sommé (`SUMMED_GAIN_CAP` = 1.6), le volume Howler plafonne
 * à 0,35 × 1,6 = 0,56 dans le pire cas (plusieurs jets proches), encore sous
 * tout ce qui précède.
 */
const PEAK_VOLUME = 0.35;

/** Gain du canal « ambiances » réglé par le joueur (`game/audioSettings.ts`). */
let channelGain = 1;

export function setWaterAmbienceGain(gain: number): void {
  channelGain = gain;
}

/** Constante de temps du lissage du gain — quelques dizaines de ms (contrat de la tâche). */
const GAIN_SMOOTH_TAU = 0.05;
/**
 * Constante de temps du lissage du panoramique — plus longue que le gain :
 * un son qui « saute » d'une oreille à l'autre se remarque bien plus qu'une
 * petite variation de volume, donc un demi-tour de tête rapide a davantage
 * besoin d'être lissé sur le pan que sur le gain.
 */
const PAN_SMOOTH_TAU = 0.09;

/**
 * En dessous de ce gain, la boucle est considérée inaudible. Un seuil
 * plutôt qu'une comparaison à zéro exact : un lissage
 * exponentiel (`smoothTowards`) ne touche jamais exactement sa cible, il
 * s'en approche indéfiniment.
 */
const AUDIBLE_GAIN_EPSILON = 0.01;

let waterHowl: Howl | null = null;
let playbackId: number | null = null;
let loaded = false;
let warnedMissing = false;
let isPlaying = false;
let preparation: Promise<void> | null = null;
let currentGain = 0;
let currentPan = 0;

// Scratch RÉUTILISÉ d'une frame à l'autre — `computeWaterAmbienceMix` écrit
// dedans plutôt que de renvoyer un littéral frais, même idiome que
// `render/fx.ts::currentShakeOffset(out)` (zéro allocation en régime établi).
const targetMixScratch: WaterAmbienceMix = { gain: 0, pan: 0 };

/**
 * Construit le `Howl` de la boucle d'eau. Idempotent (même discipline que
 * `initAudio`/`initMusic`) — à appeler UNE FOIS au boot, après `initAudio()`.
 *
 * La promesse attend le décodage et l'amorçage silencieux. L'absence du
 * fichier (`amb_water_jet.{ogg,m4a}`, pas nécessairement livré par
 * `sound-forge` au moment où ce module tourne) est NON FATALE, signalée une
 * seule fois en console. `updateWaterAmbience` continue de calculer le
 * mélange même sans fichier chargé (observable via `waterAmbienceDebugState`
 * en console) — seul le son réel manque.
 */
export function initWaterAmbience(): Promise<void> {
  if (preparation) return preparation;

  waterHowl = new Howl({
    src: [`${WATER_AMBIENCE_BASE_PATH}/amb_water_jet.ogg`, `${WATER_AMBIENCE_BASE_PATH}/amb_water_jet.m4a`],
    loop: true,
    html5: false,
    volume: 0,
    onload: () => {
      loaded = true;
      playbackId = waterHowl!.play();
      waterHowl!.stereo(0, playbackId);
    },
    onloaderror: () => {
      if (warnedMissing) return;
      warnedMissing = true;
      console.warn(
        `[audio] boucle d'eau introuvable (${WATER_AMBIENCE_BASE_PATH}/amb_water_jet.{ogg,m4a}) — le jeu continue sans elle.`,
      );
    },
  });
  preparation = waitForAudioLoad(waterHowl).then(() => {});
  return preparation;
}

/**
 * Mélange courant, pour la console de dev (`cassandre.sfx.eau()`) — le seul
 * moyen de vérifier ce système sans l'entendre : le verrouillage du pointeur
 * met la vraie exposition à un jet d'eau hors de portée de l'automatisation,
 * même limitation que le reste du son de ce projet.
 */
export function waterAmbienceDebugState(): { charge: boolean; joue: boolean; volume: number; pan: number } {
  return { charge: loaded, joue: isPlaying, volume: currentGain * PEAK_VOLUME * channelGain, pan: currentPan };
}

/**
 * Mise à jour de présentation, au taux d'AFFICHAGE — appelée depuis
 * `updateFx` (`game/loop/updateFx.ts`), jamais le pas fixe (invariant #2).
 * Zéro allocation en régime établi : `jets` est un tableau scratch réutilisé
 * par l'appelant (voir `SanitaireSystem.collectActiveJetOrigins`), ce module
 * ne garde que des nombres (`currentGain`/`currentPan`) entre deux appels.
 *
 * `active = false` coupe la boucle en fondu court : le mélange CIBLE devient
 * silence, et `smoothTowards` fait le fondu tout seul, sur la même constante
 * de temps qu'un simple changement de distance — aucun code de fondu séparé.
 * L'appelant passe `engine.flow.isPlaying()`
 * (même lecture directe de l'acteur que la garde de contenu du pas fixe dans
 * `updateGameplay.ts`) : `false` au menu, à la mort, en fin de niveau.
 *
 * Un rechargement de niveau/hot reload obtient le même résultat sans code
 * dédié à CE module : `jets` devient vide dès que `session.sanitaireSystem`
 * est remplacé par une instance neuve au chargement (aucun sanitaire cassé
 * au départ) — la cible retombe à zéro, et le fondu suit.
 */
export function updateWaterAmbience(
  listenerPosition: Vec3Like,
  listenerRight: Vec3Like,
  jets: readonly Vec3Like[],
  dt: number,
  active: boolean,
): void {
  if (active) computeWaterAmbienceMix(listenerPosition, listenerRight, jets, targetMixScratch);
  else {
    targetMixScratch.gain = 0;
    targetMixScratch.pan = 0;
  }
  currentGain = smoothTowards(currentGain, targetMixScratch.gain, dt, GAIN_SMOOTH_TAU);
  currentPan = smoothTowards(currentPan, targetMixScratch.pan, dt, PAN_SMOOTH_TAU);

  // Asset pas encore chargé (ou absent) : le mélange existe déjà pour la
  // console, mais il n'y a rien à jouer — voir `initWaterAmbience`.
  if (!waterHowl || !loaded || playbackId === null) return;

  const audible = currentGain > AUDIBLE_GAIN_EPSILON;
  isPlaying = audible;
  waterHowl.volume(audible ? currentGain * PEAK_VOLUME * channelGain : 0, playbackId);
  waterHowl.stereo(currentPan, playbackId);
}
