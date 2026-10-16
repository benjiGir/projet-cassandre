import * as THREE from "three";

import { playDoorMovementSfx, playPropBreakSfx, playSfx } from "../../../core/audio/audio";
import { weaponConfig } from "../../player/weapons/weaponConfig";
import type { PropDebrisMaterial } from "../../../render/fx/propDebris/propDebrisTypes";
import { toDebrisMaterial } from "./propDebrisMaterials";
import type { FxFrame } from "./fxFrame";

// see: docs/archive/systems-rendu.md#découplage-entre-render-et-game
const PROP_DEBRIS: Record<PropDebrisMaterial, { color: number; count: number }> = {
  wood: { color: 0x6b4a2a, count: 10 },
  // Le carton part en plus gros morceaux, et moins nombreux : un carton
  // s'écrase, il n'éclate pas.
  cardboard: { color: 0x8a6a42, count: 7 },
  // Le verre est le seul qui vaut vraiment la dépense : beaucoup d'éclats
  // clairs, c'est LUI qui fait lire « ça s'est cassé » à 640×360.
  glass: { color: 0xa8d8e8, count: 18 },
  metal: { color: 0x8a8f96, count: 8 },
  // see: docs/6-reference/notes-code-gameplay.md#boucle-et-présentation
  flour: { color: 0xe8e0c8, count: 16 },
  water: { color: 0x6fb8ff, count: 14 },
  electronics: { color: 0x2f2f38, count: 10 },
  // Tôle rouge de la bonbonne ; le feu et la fumée viennent de `spawnExplosion`.
  gas: { color: 0xb02931, count: 12 },
};

/** Secousse d'une explosion : nettement plus forte et plus longue que celle d'un tir. */
const EXPLOSION_SHAKE_AMPLITUDE = 0.45;
const EXPLOSION_SHAKE_DURATION = 0.4;
/** Au-delà, l'explosion ne secoue plus la caméra — elle reste entendue. */
const EXPLOSION_SHAKE_RANGE = 25;
const DEFAULT_PROP_DEBRIS = PROP_DEBRIS.wood;

/** Mobilier cassé et explosions : débris, souffle, secousse à la mesure de la distance. */
export function presentPropEvents({ engine, session }: FxFrame): void {
  const props = session.level.propSystem;
  if (props) {
    for (const event of props.destroyedEvents) {
      engine.fx.spawnPropFragments(toDebrisMaterial(event.matiere), {
        ...event.shape,
        direction: event.direction,
        strength: event.strength,
      });
      engine.fx.triggerShake(weaponConfig.shakeAmplitude, weaponConfig.shakeDuration);
      playPropBreakSfx(event.matiere);
    }
    for (const event of props.explosionEvents) {
      engine.fx.spawnExplosion(event.point);
      const proximity = 1 - session.player.position.distanceTo(event.point) / EXPLOSION_SHAKE_RANGE;
      if (proximity > 0) engine.fx.triggerShake(EXPLOSION_SHAKE_AMPLITUDE * proximity, EXPLOSION_SHAKE_DURATION);
      playSfx("explosion", Math.max(0.35, proximity));
    }
    props.clearFrameEvents();
  }
}

/** Vitrages, sanitaires et écrans cassés. */
export function presentBreakableEvents({ engine, session }: FxFrame): void {
  // Obstacles cassables (`vitre_*`) : débris et son suivent leur matière
  // (`verre` par défaut), sans changer le coût du lot fusionné.
  const vitres = session.level.vitreSystem;
  if (vitres) {
    for (const event of vitres.destroyedEvents) {
      const debris = PROP_DEBRIS[toDebrisMaterial(event.matiere)] ?? DEFAULT_PROP_DEBRIS;
      if (event.shape)
        engine.fx.spawnPropFragments(toDebrisMaterial(event.matiere), {
          ...event.shape,
          direction: event.direction,
          strength: 1,
        });
      else engine.fx.spawnDebris(event.point, event.direction, debris.color, debris.count);
      if (event.givre) engine.fx.spawnFrostBurst(event.point);
      engine.fx.triggerShake(weaponConfig.shakeAmplitude, weaponConfig.shakeDuration);
      playPropBreakSfx(event.matiere);
    }
    vitres.clearFrameEvents();
  }

  const sanitaires = session.level.sanitaireSystem;
  if (sanitaires) {
    for (const event of sanitaires.destroyedEvents) {
      engine.fx.spawnCeramicBurst(event.point, event.direction);
      engine.fx.addWaterJet(event.jetOrigin);
      engine.fx.triggerShake(weaponConfig.shakeAmplitude, weaponConfig.shakeDuration);
      playSfx("sanitaire_break");
    }
    sanitaires.clearFrameEvents();
  }

  // Écrans (`ecran_*`) — même contrat que les vitrages : l'image passe à
  // l'état « casse » côté `EcranSystem`, ici seulement les étincelles.
  const ecrans = session.level.ecranSystem;
  if (ecrans) {
    for (const event of ecrans.destroyedEvents) {
      const debris = PROP_DEBRIS.electronics ?? DEFAULT_PROP_DEBRIS;
      engine.fx.spawnDebris(event.point, new THREE.Vector3(0, 1, 0), debris.color, debris.count);
      playPropBreakSfx("electronique");
    }
    ecrans.clearFrameEvents();
  }
}

export function presentDoorEvents({ session }: FxFrame): void {
  // Portes animées — un son au DÉBUT de chaque ouverture depuis l'état
  // fermé (voir `DoorSystem.movementEvents`), jamais à la fermeture.
  const doors = session.level.doorSystem;
  if (doors) {
    for (const event of doors.movementEvents) playDoorMovementSfx(event.movement);
    doors.clearFrameEvents();
  }
}
