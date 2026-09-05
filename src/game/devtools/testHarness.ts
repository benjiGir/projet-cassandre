import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { type Recording } from "../../core/inputRecorder";
import { COLLISION_GROUPS, PhysicsWorld } from "../../physics/world";
import { PlayerController } from "../player/controller";
import { FEEL_VARIANTS, fovForRunFactor, moveConfig, type MoveConfig } from "../player/moveConfig";
import {
  CROSSHAIR_VARIANTS,
  HITMARKER_VARIANTS,
  IMPACT_VARIANTS,
  RECOIL_VARIANTS,
  weaponConfig,
  type RecoilVariant,
} from "../player/weaponConfig";
import { FLASH_VARIANTS, KNOCKBACK_VARIANTS, suitConfig } from "../entities/suitConfig";

/**
 * Extraction du refactor de `main.ts` (2229 lignes → modules, 2026-09-05) :
 * `simulateRecording`/`checkDeterminism`/les 7 `applyXVariant` vivaient déjà
 * à PORTÉE MODULE dans `main.ts` (donc, par construction du langage, sans
 * aucune fermeture sur le scope de `main()`) — déplacées TELLES QUELLES,
 * aucun paramètre ajouté.
 */

/**
 * Simulation hors écran d'une séquence enregistrée : même monde minimal, même
 * controller, aucune dépendance au rendu ni à l'horloge réelle.
 * Base du test de déterminisme et de l'A/B de config.
 */
export function simulateRecording(rec: Recording, cfg: MoveConfig) {
  const world = new PhysicsWorld();
  const floor = world.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0));
  world.world.createCollider(
    RAPIER.ColliderDesc.cuboid(50, 0.1, 50).setCollisionGroups(COLLISION_GROUPS.WORLD),
    floor,
  );

  const sim = new PlayerController(world, cfg);
  const feetY = rec.start.position.y - (cfg.capsuleHalfHeight + cfg.capsuleRadius);
  sim.spawn(rec.start.position.x, feetY, rec.start.position.z);
  sim.velocity.set(rec.start.velocity.x, rec.start.velocity.y, rec.start.velocity.z);

  for (const frame of rec.frames) {
    sim.snapshotPrevious();
    sim.update(rec.fixedDt, frame);
    world.step(rec.fixedDt);
  }

  // Décalage de bob effectivement rendu au dernier pas (alpha = 1, soit la
  // frame d'affichage alignée sur le pas fixe). C'est la grandeur qui finit en
  // pixels : la comparer, et pas seulement ses entrées, est ce qui rend la
  // preuve de déterminisme utile pour `qa-evidence`.
  sim.viewBob(1, simBobScratch);

  const result = {
    position: { x: sim.position.x, y: sim.position.y, z: sim.position.z },
    velocity: { x: sim.velocity.x, y: sim.velocity.y, z: sim.velocity.z },
    distanceTravelled: sim.distanceTravelled,
    bobIntensity: sim.bobIntensity,
    bobOffset: { x: simBobScratch.x, y: simBobScratch.y },
    runFactor: sim.runFactor,
    fov: fovForRunFactor(cfg, sim.runFactor),
    landingDip: sim.landingDip,
  };
  world.world.free();
  return result;
}

const simBobScratch = new THREE.Vector3();

/**
 * Test de déterminisme : la même séquence d'input rejouée deux fois doit
 * produire le même état final à 1e-6 près. Un échec signale une source de
 * non-déterminisme dans le pas fixe (`Math.random` non seedé, `Date.now`,
 * ou une lecture d'input hors accumulateur).
 *
 * L'écart couvre aussi les grandeurs de VUE (bob, FOV, réception) : elles
 * finissent en pixels et doivent donc être reproductibles au même titre que la
 * position. Une horloge murale glissée dans le bob se verrait immédiatement
 * ici, sous forme d'un écart non nul sur `bobOffset` malgré des positions
 * identiques.
 */
export function checkDeterminism(rec: Recording) {
  const a = simulateRecording(rec, moveConfig);
  const b = simulateRecording(rec, moveConfig);
  const delta = Math.max(
    Math.abs(a.position.x - b.position.x),
    Math.abs(a.position.y - b.position.y),
    Math.abs(a.position.z - b.position.z),
    Math.abs(a.velocity.x - b.velocity.x),
    Math.abs(a.velocity.y - b.velocity.y),
    Math.abs(a.velocity.z - b.velocity.z),
    Math.abs(a.distanceTravelled - b.distanceTravelled),
    Math.abs(a.bobOffset.x - b.bobOffset.x),
    Math.abs(a.bobOffset.y - b.bobOffset.y),
    Math.abs(a.fov - b.fov),
    Math.abs(a.landingDip - b.landingDip),
  );
  const passed = delta < 1e-6;
  console.info(
    `[determinism] ${rec.frames.length} pas fixes · écart max ${delta.toExponential(3)} · ${
      passed ? "OK" : "ÉCHEC"
    }`,
  );
  return { passed, delta, a, b };
}

interface FeelVariantReport {
  variant: keyof typeof FEEL_VARIANTS;
  bobVerticalAmplitude: number;
  bobLateralAmplitude: number;
  fovRange: string;
  landingDipMax: number;
}

/**
 * Applique une variante de feel de la VUE, à chaud.
 *
 * `player.applyConfig()` n'est délibérément PAS appelé : aucun champ de vue
 * n'est lu par Rapier, ils sont relus à chaque pas fixe et à chaque frame.
 * L'appeler recréerait la capsule pour rien.
 *
 * Protocole de comparaison, trois lignes :
 *   1. F9, cours et saute ~15 s dans le couloir nord, F9 pour arrêter ;
 *   2. `cassandre.applyFeelVariant("A")` puis F10 — recommence avec "B", "C" ;
 *   3. la course rejouée est identique au pas fixe près, seule la vue change :
 *      c'est la variante, pas ta façon de jouer, que tu compares.
 */
export function applyFeelVariant(name: keyof typeof FEEL_VARIANTS): FeelVariantReport {
  Object.assign(moveConfig, FEEL_VARIANTS[name]);
  const report: FeelVariantReport = {
    variant: name,
    bobVerticalAmplitude: moveConfig.bobVerticalAmplitude,
    bobLateralAmplitude: moveConfig.bobLateralAmplitude,
    fovRange: `${moveConfig.fovBase}° → ${moveConfig.fovBase + moveConfig.fovRunBoost}°`,
    landingDipMax: moveConfig.landingDipMax,
  };
  console.info(`[feel] variante ${name} appliquée`, report);
  return report;
}

interface RecoilVariantReport {
  variant: keyof typeof RECOIL_VARIANTS;
  meleeRecoil: RecoilVariant["meleeRecoil"];
  shotgunRecoil: RecoilVariant["shotgunRecoil"];
}

/**
 * Applique une variante de recul d'arme, à chaud — même protocole que
 * `applyFeelVariant` : F9 enregistre une séquence de tir, `applyRecoilVariant`
 * change la variante, F10 rejoue EXACTEMENT la même séquence (`InputFrame.fire`
 * est un front enregistré comme un autre), seul le recul diffère à l'écran.
 * Aucun `applyConfig()` nécessaire : le recul n'est lu par Rapier nulle part.
 */
export function applyRecoilVariant(name: keyof typeof RECOIL_VARIANTS): RecoilVariantReport {
  Object.assign(weaponConfig, RECOIL_VARIANTS[name]);
  const report: RecoilVariantReport = {
    variant: name,
    meleeRecoil: weaponConfig.meleeRecoil,
    shotgunRecoil: weaponConfig.shotgunRecoil,
  };
  console.info(`[feel] variante de recul ${name} appliquée`, report);
  return report;
}

interface ImpactVariantReport {
  variant: keyof typeof IMPACT_VARIANTS;
  hitstop: string;
  enemyHitstop: string;
  shake: string;
  enemyShake: string;
}

/**
 * Applique une variante de feedback d'impact (hitstop + screenshake,
 * distinction mur/ennemi) — retour playtest Phase 3, voir `IMPACT_VARIANTS`
 * dans `weaponConfig.ts` pour le contexte complet. Aucun `applyConfig()`
 * nécessaire (rien n'est lu par Rapier). Protocole F9/F10 : voir la note de
 * `IMPACT_VARIANTS` — viser un Costard à PV pleins pour une comparaison
 * propre, le recorder ne restaure pas l'état des Costards.
 */
export function applyImpactVariant(name: keyof typeof IMPACT_VARIANTS): ImpactVariantReport {
  Object.assign(weaponConfig, IMPACT_VARIANTS[name]);
  const report: ImpactVariantReport = {
    variant: name,
    hitstop: `${(weaponConfig.hitstopDuration * 1000).toFixed(0)} ms @ ×${weaponConfig.hitstopScale}`,
    enemyHitstop: `${(weaponConfig.enemyHitstopDuration * 1000).toFixed(0)} ms @ ×${weaponConfig.enemyHitstopScale}`,
    shake: `${weaponConfig.shakeAmplitude} m / ${(weaponConfig.shakeDuration * 1000).toFixed(0)} ms`,
    enemyShake: `${weaponConfig.enemyShakeAmplitude} m / ${(weaponConfig.enemyShakeDuration * 1000).toFixed(0)} ms`,
  };
  console.info(`[feel] variante d'impact ${name} appliquée`, report);
  return report;
}

interface HitmarkerVariantReport {
  variant: keyof typeof HITMARKER_VARIANTS;
  enabled: boolean;
  hit: string;
  kill: string;
}

/**
 * Applique une variante de hitmarker, à chaud — voir `HITMARKER_VARIANTS`
 * dans `weaponConfig.ts`. Le marqueur lit `weaponConfig` en DIRECT (même
 * objet que la config passée à `HitmarkerOverlay`), donc l'effet est visible
 * dès le prochain hit ennemi, sans rien réinstancier.
 */
export function applyHitmarkerVariant(name: keyof typeof HITMARKER_VARIANTS): HitmarkerVariantReport {
  Object.assign(weaponConfig, HITMARKER_VARIANTS[name]);
  const report: HitmarkerVariantReport = {
    variant: name,
    enabled: weaponConfig.hitmarkerEnabled,
    hit: `${weaponConfig.hitmarkerSize}px @ ${(weaponConfig.hitmarkerDuration * 1000).toFixed(0)} ms`,
    kill: `${weaponConfig.hitmarkerKillSize}px @ ${(weaponConfig.hitmarkerKillDuration * 1000).toFixed(0)} ms`,
  };
  console.info(`[feel] variante de hitmarker ${name} appliquée`, report);
  return report;
}

interface CrosshairVariantReport {
  variant: keyof typeof CROSSHAIR_VARIANTS;
  style: "cross" | "dot";
  pulse: string;
}

/**
 * Applique une variante de réticule, à chaud — voir `CROSSHAIR_VARIANTS`
 * dans `weaponConfig.ts`. Le réticule lit `weaponConfig` en DIRECT (même
 * objet que la config passée à `CrosshairOverlay`), donc l'effet est visible
 * dès la prochaine frame, sans rien réinstancier.
 */
export function applyCrosshairVariant(name: keyof typeof CROSSHAIR_VARIANTS): CrosshairVariantReport {
  Object.assign(weaponConfig, CROSSHAIR_VARIANTS[name]);
  const report: CrosshairVariantReport = {
    variant: name,
    style: weaponConfig.crosshairStyle,
    pulse: weaponConfig.crosshairPulseEnabled
      ? `×${weaponConfig.crosshairPulseScale} @ ${(weaponConfig.crosshairPulseDuration * 1000).toFixed(0)} ms`
      : "désactivée",
  };
  console.info(`[feel] variante de réticule ${name} appliquée`, report);
  return report;
}

interface KnockbackVariantReport {
  variant: keyof typeof KNOCKBACK_VARIANTS;
  knockbackSpeed: number;
  knockbackDecayTime: number;
  knockbackUpBoost: number;
}

/**
 * Applique une variante de knockback Costard, à chaud — voir
 * `KNOCKBACK_VARIANTS` dans `suitConfig.ts`. `Suit` lit `this.cfg` (référence
 * partagée vers `suitConfig` par défaut), donc l'effet s'applique au PROCHAIN
 * coup encaissé par n'importe quel Costard, sans recréer aucun corps Rapier.
 */
export function applyKnockbackVariant(name: keyof typeof KNOCKBACK_VARIANTS): KnockbackVariantReport {
  Object.assign(suitConfig, KNOCKBACK_VARIANTS[name]);
  const report: KnockbackVariantReport = {
    variant: name,
    knockbackSpeed: suitConfig.knockbackSpeed,
    knockbackDecayTime: suitConfig.knockbackDecayTime,
    knockbackUpBoost: suitConfig.knockbackUpBoost,
  };
  console.info(`[feel] variante de knockback ${name} appliquée`, report);
  return report;
}

interface FlashVariantReport {
  variant: keyof typeof FLASH_VARIANTS;
  hitFlashDuration: number;
}

/** Applique une variante de durée de flash de dégât, à chaud — voir `FLASH_VARIANTS` dans `suitConfig.ts`. */
export function applyFlashVariant(name: keyof typeof FLASH_VARIANTS): FlashVariantReport {
  Object.assign(suitConfig, FLASH_VARIANTS[name]);
  const report: FlashVariantReport = { variant: name, hitFlashDuration: suitConfig.hitFlashDuration };
  console.info(`[feel] variante de flash ${name} appliquée`, report);
  return report;
}
