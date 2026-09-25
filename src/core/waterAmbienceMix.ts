/**
 * Calculs PURS de la boucle d'eau positionnelle des sanitaires cassés
 * (`sanitaire_*`, [ADR 0032](../../docs/decisions/0032-sanitaires-utilisables.md)) —
 * volontairement dans un fichier séparé de `core/waterAmbience.ts`, qui
 * possède le `Howl` et ses effets de bord. Zéro import de `howler` ici :
 * c'est ce qui rend ce module testable en Node, sans `AudioContext` ni DOM
 * (même raison que `core/random.ts` reste un fichier à part de tout ce qui
 * consomme le RNG).
 *
 * see: docs/systems/hud-audio.md#boucle-deau-positionnelle
 */

/** Un point 3D minimal — `THREE.Vector3` le satisfait par structure, sans que ce module ait besoin d'importer `three`. */
export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** Mélange courant : gain [0, `SUMMED_GAIN_CAP`] et panoramique [-`PAN_MAX`, `PAN_MAX`]. */
export interface WaterAmbienceMix {
  gain: number;
  pan: number;
}

/**
 * Distance, en mètres, sous laquelle UN jet contribue au gain plein (1). Le
 * jet d'un sanitaire cassé est une source proche et localisée — 1,5 m est à
 * peu près la distance à laquelle on se tient devant une cuvette pour la
 * regarder, pas une valeur arbitraire.
 */
export const JET_FULL_GAIN_DISTANCE = 1.5;

/**
 * Distance, en mètres, au-delà de laquelle un jet ne contribue plus du tout.
 * Choisie au milieu de la fourchette demandée (10-12 m) : assez loin pour
 * l'entendre approcher depuis la pièce voisine d'une salle de toilettes,
 * assez près pour ne jamais devenir un bruit de fond permanent audible
 * depuis l'autre bout d'un grand espace.
 */
export const JET_SILENCE_DISTANCE = 11;

/**
 * Plafond du gain SOMMÉ de tous les jets actifs. Un jet seul au plus près
 * vaut 1 ; deux jets au plus près sommeraient à 2 (+6 dB) pour la seule
 * raison qu'il y a deux appareils cassés côte à côte — un doublement du
 * volume perçu que rien dans le contrat ne justifie. Le plafond à 1,6 laisse
 * plusieurs jets proches s'entendre « un peu plus fort qu'un seul » comme
 * demandé (20·log10(1.6) ≈ +4,1 dB : perceptible, pas un second évènement
 * sonore).
 */
export const SUMMED_GAIN_CAP = 1.6;

/**
 * Amplitude maximale du panoramique stéréo. Le contrat demande « ±0,5 à
 * ±0,6 au plus » — assez pour dire de quel côté est le jet, jamais assez
 * pour l'envoyer plein pot dans une seule oreille (±1 casserait l'illusion
 * d'une source ponctuelle dès qu'on tourne un peu la tête). 0,55 est le
 * milieu de la fourchette demandée.
 */
export const PAN_MAX = 0.55;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Gain d'UN jet à `distance`, courbe « smoothstep » (dérivée nulle aux deux
 * bornes) plutôt qu'une rampe linéaire. Une rampe linéaire a une pente non
 * nulle pile aux deux distances de bascule : un pas de plus exactement à
 * 1,5 m ou à 11 m produit un changement de volume aussi brusque qu'ailleurs
 * dans la plage, ce qui se remarque précisément parce que c'est la frontière
 * entre « plein volume » et « silence total ». Le smoothstep entre et sort
 * de la plage sans à-coup — la définition même d'une atténuation « douce ».
 */
export function jetGain(distance: number): number {
  if (distance <= JET_FULL_GAIN_DISTANCE) return 1;
  if (distance >= JET_SILENCE_DISTANCE) return 0;
  const t = (JET_SILENCE_DISTANCE - distance) / (JET_SILENCE_DISTANCE - JET_FULL_GAIN_DISTANCE);
  return t * t * (3 - 2 * t);
}

/**
 * Mélange cible pour la frame courante, ÉCRIT DANS `out` — même idiome que
 * `render/fx.ts::currentShakeOffset(out)` : zéro allocation par appel, le
 * chemin chaud (`core/waterAmbience.ts::updateWaterAmbience`, une fois par
 * frame d'affichage) réutilise le même objet scratch d'une frame à l'autre.
 * Les tests, eux, peuvent passer un littéral frais à chaque appel — `out` est
 * aussi la valeur de retour, pour rester pratique à chaîner/inspecter.
 *
 * `out.gain` : somme plafonnée (`SUMMED_GAIN_CAP`) des gains de tous les
 * `jets`. `out.pan` : direction du jet DOMINANT (celui qui contribue le plus
 * de gain) projetée sur `listenerRight` — supposé unitaire et horizontal,
 * comme l'axe X local d'une caméra FPS sans roulis.
 *
 * `jets` vide, ou joueur littéralement confondu avec le jet dominant
 * (distance ~0) : panoramique centré, jamais de division par zéro.
 */
export function computeWaterAmbienceMix(
  listenerPosition: Vec3Like,
  listenerRight: Vec3Like,
  jets: readonly Vec3Like[],
  out: WaterAmbienceMix,
): WaterAmbienceMix {
  if (jets.length === 0) {
    out.gain = 0;
    out.pan = 0;
    return out;
  }

  let summedGain = 0;
  let dominantGain = 0;
  let dominantDirX = 0;
  let dominantDirY = 0;
  let dominantDirZ = 0;

  for (const jet of jets) {
    const dx = jet.x - listenerPosition.x;
    const dy = jet.y - listenerPosition.y;
    const dz = jet.z - listenerPosition.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const gain = jetGain(distance);
    summedGain += gain;
    // Direction non normalisée retenue seulement pour le jet DOMINANT : la
    // normaliser pour chaque jet écarté ensuite n'aurait servi à rien.
    if (gain > dominantGain) {
      dominantGain = gain;
      dominantDirX = dx;
      dominantDirY = dy;
      dominantDirZ = dz;
    }
  }

  out.gain = Math.min(SUMMED_GAIN_CAP, summedGain);
  if (dominantGain <= 0) {
    out.pan = 0;
    return out;
  }

  const dominantLength = Math.sqrt(dominantDirX * dominantDirX + dominantDirY * dominantDirY + dominantDirZ * dominantDirZ);
  if (dominantLength < 1e-6) {
    out.pan = 0; // joueur sur le jet lui-même
    return out;
  }

  const lateral =
    (dominantDirX * listenerRight.x + dominantDirY * listenerRight.y + dominantDirZ * listenerRight.z) /
    dominantLength;
  out.pan = clamp(lateral * PAN_MAX, -PAN_MAX, PAN_MAX);
  return out;
}

/**
 * Lissage exponentiel dépendant du temps : converge vers `target` avec une
 * constante de temps `tau` (secondes), indépendant du framerate — un facteur
 * fixe appliqué à chaque frame (`current += (target - current) * 0.1`, par
 * exemple) accélérerait ou ralentirait le lissage selon le taux
 * d'affichage réel, ce qui n'a pas de sens pour « quelques dizaines de ms ».
 * `tau <= 0` court-circuite vers `target` (pas de division, pas de lissage).
 */
export function smoothTowards(current: number, target: number, dt: number, tau: number): number {
  if (tau <= 0) return target;
  const alpha = 1 - Math.exp(-dt / tau);
  return current + (target - current) * alpha;
}
