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

// Origine de ce fichier (extraction du refactor main.ts, 2026-09-05) :
// see: docs/systems/debug.md#origine-du-module-gamedevtools

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

  // alpha = 1 : décalage de bob EFFECTIVEMENT RENDU au dernier pas fixe.
  // see: docs/systems/debug.md#simulation-hors-écran-et-preuve-de-déterminisme
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
 * Rejoue deux fois la même séquence : écart max doit rester sous 1e-6,
 * position/vitesse ET grandeurs de vue (bob/FOV/réception) comprises — ces
 * dernières finissent en pixels au même titre que la position.
 * see: docs/systems/debug.md#simulation-hors-écran-et-preuve-de-déterminisme
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
 * see: docs/systems/joueur.md#harnais-ab-feel_variants
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
  pistolRecoil: RecoilVariant["pistolRecoil"];
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
    pistolRecoil: weaponConfig.pistolRecoil,
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
 * Applique une variante de feedback d'impact, à chaud.
 * see: docs/systems/armes.md#hitstop-et-shake-murennemi-impact_variants
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

export interface RenderBenchmark {
  /** Images rendues pour la mesure, hors chauffe. */
  frames: number;
  msParImage: number;
  /** Ce que donnerait une boucle qui ne ferait QUE dessiner. */
  imagesParSecondeRendu: number;
  drawCalls: number;
  triangles: number;
  /** Programmes GPU compilés — utile pour repérer une explosion de matériaux. */
  programmes: number;
}

/**
 * Banc de mesure du coût de rendu, en dehors de la boucle de jeu.
 *
 * Pourquoi il existe : le budget de 200 000 triangles fixé au jalon N1 n'a
 * jamais été confronté au matériel ; et les FPS ne se mesurent pas dans un
 * navigateur piloté en automatisation, où `document.visibilityState` vaut
 * `hidden` et bride `requestAnimationFrame` à une image par seconde (limite
 * documentée du projet). Ce banc contourne les deux : il appelle
 * `renderer.render` lui-même, en boucle serrée, sans jamais dépendre de
 * `requestAnimationFrame`.
 *
 * `gl.finish()` encadre la mesure pour que le GPU ait réellement terminé —
 * sans lui, on ne chronomètre que l'envoi des commandes côté CPU, ce qui est
 * précisément la partie qui ne coûte rien quand le problème est le nombre de
 * triangles.
 *
 * Ne touche à aucun état de jeu : ne fait qu'afficher la scène telle quelle,
 * depuis la caméra courante. Le pas fixe n'est pas avancé (invariant #1).
 */
export function benchmarkRender(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  frames = 120,
): RenderBenchmark {
  const gl = renderer.getContext();

  for (let i = 0; i < 10; i++) renderer.render(scene, camera); // chauffe : compilation des programmes, upload des buffers.
  gl.finish();

  const t0 = performance.now();
  for (let i = 0; i < frames; i++) renderer.render(scene, camera);
  gl.finish();
  const total = performance.now() - t0;

  const info = renderer.info;
  const msParImage = total / frames;
  return {
    frames,
    msParImage: Number(msParImage.toFixed(3)),
    imagesParSecondeRendu: Number((1000 / msParImage).toFixed(1)),
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    programmes: info.programs?.length ?? 0,
  };
}

export interface LightBudgetReport {
  /** Lampes de niveau trouvées dans la scène (hors soleil/ambiante). */
  total: number;
  /** Combien restent allumées après application du budget. */
  actives: number;
  /** `null` = budget levé, toutes rallumées. */
  budget: number | null;
}

/**
 * Garde allumées les `budget` lampes ponctuelles les plus proches de la
 * caméra et éteint les autres (`visible = false`, ce que le renderer WebGL
 * exclut de son état d'éclairage — trois.js n'évalue que les lampes
 * visibles).
 *
 * Pourquoi ça existe : three.js pose TOUTES les lampes en uniformes de
 * fragment. Au-delà de quelques centaines de `PointLight`, le programme
 * dépasse `MAX_FRAGMENT_UNIFORM_VECTORS` et ne compile plus DU TOUT — la
 * géométrie concernée disparaît, en console seulement. C'est la limite
 * annoncée par l'ADR 0024 pour le niveau v2 ; cet outil sert à la mesurer
 * et à essayer le remède avant de l'écrire pour de bon.
 *
 * Outil de mesure, pas un système de jeu : rien ne l'appelle par image.
 */
export function applyLightBudget(
  scene: THREE.Scene,
  camera: THREE.Camera,
  budget: number | null,
): LightBudgetReport {
  const lampes: THREE.PointLight[] = [];
  scene.traverse((obj) => {
    if ((obj as THREE.PointLight).isPointLight) lampes.push(obj as THREE.PointLight);
  });

  if (budget === null) {
    for (const l of lampes) l.visible = true;
    return { total: lampes.length, actives: lampes.length, budget: null };
  }

  const cameraPos = new THREE.Vector3();
  camera.getWorldPosition(cameraPos);
  const pos = new THREE.Vector3();
  const classees = lampes
    .map((l) => ({ l, d: l.getWorldPosition(pos).distanceToSquared(cameraPos) }))
    .sort((a, b) => a.d - b.d);

  classees.forEach((e, i) => {
    e.l.visible = i < budget;
  });
  return { total: lampes.length, actives: Math.min(budget, lampes.length), budget };
}
