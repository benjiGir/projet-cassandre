import * as THREE from "three";

import { playImpactSfx, playWeaponFireSfx } from "../../../core/audio/audio";
import { isMovableOrBreakableHandle } from "../../level/loading/movableColliders";
import { kickConfig } from "../../player/weapons/kickConfig";
import { weaponConfig } from "../../player/weapons/weaponConfig";
import { FLESH_MATERIAL } from "../../player/weapons/weapons";
import type { FxFrame } from "./fxFrame";

const muzzleScratch = new THREE.Vector3();
const muzzleDirectionScratch = new THREE.Vector3();
const FLASH_WEAPONS = ["pistol", "shotgun"] as const;
const sprayDirectionScratch = new THREE.Vector3();
/** Matière d'un tir arrêté par un bouclier : le son et les éclats d'un impact de métal. */
const SHIELD_MATERIAL = "metal";

/** Tirs et impacts accumulés depuis l'image précédente : flash, douille, éclats, sang, secousse, sons. */
export function presentWeaponEvents({ engine, session }: FxFrame): void {
  for (const event of session.weapons.fireEvents) {
    if (event.weapon === "pistol" || event.weapon === "shotgun") {
      engine.fx.spawnMuzzleFlash(
        engine.viewmodel.muzzleWorldPosition(muzzleScratch, event.weapon),
        engine.viewmodel.muzzleWorldDirection(muzzleDirectionScratch, event.weapon),
        event.weapon,
      );
    }
    if (event.weapon === "shotgun") {
      engine.fx.spawnShellCasing(event.muzzlePosition, event.muzzleDirection);
    }
    playWeaponFireSfx(event.weapon);
    // Réticule : pulsation à CHAQUE tir déclenché (indépendant d'un hit,
    // voir `CrosshairOverlay.notifyFire`), no-op si désactivée en config.
    engine.crosshair.notifyFire();
    if ((event.weapon === "pistol" || event.weapon === "shotgun") && event.pelletEndpoints) {
      engine.ballisticsDebug.recordShotgunFire(event.muzzlePosition, event.pelletEndpoints);
    } else if (event.weapon === "melee" || event.weapon === "kick") {
      engine.ballisticsDebug.recordMeleeFire(
        event.muzzlePosition,
        event.muzzleDirection,
        event.weapon === "kick" ? kickConfig.range : weaponConfig.meleeRange,
        event.weapon === "kick" ? kickConfig.hitRadius : weaponConfig.meleeHitRadius,
      );
    }
  }
  for (const weapon of FLASH_WEAPONS) {
    engine.fx.followMuzzleFlash(
      engine.viewmodel.muzzleWorldPosition(muzzleScratch, weapon),
      engine.viewmodel.muzzleWorldDirection(muzzleDirectionScratch, weapon),
      weapon,
    );
  }
  for (const hit of session.weapons.hitEvents) {
    // Arrêté par un bouclier : ni sang ni marqueur, un impact de métal sur l'ennemi.
    const blocked = session.suitManager.blockedHits.has(hit);
    const material = blocked ? SHIELD_MATERIAL : hit.material;
    const onEnemy = hit.material === FLESH_MATERIAL;
    const isEnemyHit = onEnemy && !blocked;
    if (!onEnemy && !isMovableOrBreakableHandle(session.gltfLevelSession, hit.colliderHandle)) {
      engine.fx.spawnImpactDecal(hit.point, hit.normal, hit.material);
    }
    engine.fx.spawnImpactParticles(hit.point, hit.normal, hit.weapon, material);
    if (isEnemyHit) {
      // Le sang part dans l'axe du coup, sur ce qu'il y a derrière l'ennemi.
      sprayDirectionScratch.subVectors(hit.point, engine.camera.position).normalize();
      engine.fx.spawnBloodSpray(hit.point, sprayDirectionScratch, hit.weapon);
    }
    engine.fx.triggerShake(
      isEnemyHit ? weaponConfig.enemyShakeAmplitude : weaponConfig.shakeAmplitude,
      isEnemyHit ? weaponConfig.enemyShakeDuration : weaponConfig.shakeDuration,
    );
    // Hitmarker : uniquement sur un hit ENEMY confirmé — un hit mur n'a
    // pas vocation à alimenter ce canal (voir doc de `hitmarker.ts`).
    if (isEnemyHit) engine.hitmarker.trigger("hit");
    playImpactSfx(material);
  }
  session.weapons.clearFrameEvents();
}
