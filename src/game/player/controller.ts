import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import type { InputFrame } from "../../core/inputRecorder";
import { COLLISION_GROUPS, configureCharacterController, type PhysicsWorld } from "../../physics/world";
import {
  bobIntensityTarget,
  eyeOffsetFromCenter,
  fovRunFactorTarget,
  groundAcceleration,
  groundDeceleration,
  jumpVelocity,
  landingDipFor,
  moveConfig,
  wallNormalYThreshold,
  type MoveConfig,
} from "./moveConfig";

const TAU = Math.PI * 2;

/**
 * Rapproche `current` de `target` à VITESSE CONSTANTE : `range` unités
 * parcourues en `responseTime` secondes, `range` étant l'amplitude totale de la
 * grandeur (1 pour une enveloppe 0..1, `landingDipMax` pour un enfoncement).
 *
 * `dt` est le dt du PAS FIXE, jamais un temps réel : le lissage fait donc
 * partie de la simulation et se rejoue à l'identique.
 *
 * Rampe linéaire et non approche exponentielle. Deux raisons, mesurées :
 *
 *  - une exponentielle N'ARRIVE JAMAIS. Mesuré sur la version précédente de ce
 *    code : après un arrêt net, l'enveloppe du bob mettait 1.78 s à atteindre
 *    zéro, et l'enfoncement de réception 2.18 s. Pendant tout ce temps la
 *    caméra dérive d'un poil de flottant à chaque frame — `updateProjectionMatrix`
 *    est rappelée indéfiniment, et surtout deux captures déterministes ne
 *    rendent pas le même pixel. Une rampe atteint sa cible exactement, à un pas
 *    fixe connu d'avance ;
 *  - le paramètre veut alors dire ce qu'il dit : `bobResponseTime = 0.12`
 *    éteint le bob en 0.12 s, pas « 63 % en 0.12 s puis une traîne d'une
 *    seconde ». C'est ce qu'un humain qui tune attend en lisant le nom.
 *
 * Ce qu'on y perd — le coude à l'arrivée — est invisible : ces grandeurs sont
 * des enveloppes, elles multiplient une sinusoïde qui reste continue.
 *
 * EXPORTÉE : `weapons.ts` (Phase 2) réutilise exactement cette fonction pour
 * la récupération de recul du viewmodel — même contrat (dt de gameplay,
 * jamais d'horloge murale), donc pas de raison d'en dupliquer une deuxième
 * version qui pourrait diverger.
 */
export function approach(
  current: number,
  target: number,
  responseTime: number,
  dt: number,
  range: number,
): number {
  if (responseTime <= 0 || range <= 0) return target;
  const diff = target - current;
  const step = (range / responseTime) * dt;
  if (Math.abs(diff) <= step) return target;
  return current + Math.sign(diff) * step;
}

/**
 * Déplacement du joueur, basé sur le `KinematicCharacterController` de Rapier
 * (invariant #6 : jamais de résolution capsule-vs-monde maison).
 *
 * Découpage :
 * - le controller intègre lui-même vitesse horizontale et verticale (le corps
 *   est kinématique, le solveur ne l'intègre pas) ;
 * - la gravité est LUE sur le monde physique, jamais redéclarée ;
 * - `computeColliderMovement` résout pentes, marches et glissements ;
 * - la translation cible est posée via `setNextKinematicTranslation` et
 *   appliquée par le `world.step()` DU MÊME pas fixe (voir l'ordre des
 *   callbacks dans `core/loop.ts`).
 *
 * Aucun nombre de gameplay ici : tout vient de `moveConfig`.
 */
export class PlayerController {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly kcc: RAPIER.KinematicCharacterController;

  /** Position du CENTRE de la capsule après le pas fixe courant. */
  readonly position = new THREE.Vector3();
  /** Position du centre de la capsule au pas fixe précédent (interpolation du rendu). */
  readonly previousPosition = new THREE.Vector3();
  /** Vitesse intégrée, m/s. Sa composante horizontale est reclippée par les collisions. */
  readonly velocity = new THREE.Vector3();
  /** Normale du sol sous les pieds (0,1,0 si non au sol). */
  readonly groundNormal = new THREE.Vector3(0, 1, 0);

  isGrounded = false;
  /** Collisions du dernier `computeColliderMovement`. Diagnostic imposé par le skill. */
  numCollisions = 0;

  /**
   * Distance horizontale cumulée réellement parcourue, en mètres.
   * Point d'accroche pour `feel-tuner` (head bob, bruits de pas) : le bob doit
   * suivre la distance parcourue, pas le temps, sinon il continue à l'arrêt.
   */
  distanceTravelled = 0;

  // ------------------------------------------------------------------------
  // État de VUE (head bob, FOV, réception). Trois règles tenues ici :
  //
  //  1. tout est avancé au PAS FIXE avec le `dt` de gameplay — aucune horloge
  //     murale, donc un rejeu d'input redonne exactement la même image ;
  //  2. chaque grandeur a son échantillon n−1, comme `previousPosition`, pour
  //     être interpolée par `alpha` au rendu : `distanceTravelled` n'avance
  //     qu'à 60 Hz, l'échantillonner brute ferait avancer le bob par paliers
  //     visibles sur un écran à 144 Hz ;
  //  3. rien de tout ça n'est angulaire : la vue est TRANSLATÉE, jamais
  //     tournée (invariant #3, et la Phase 2 tirera depuis la visée pure).
  // ------------------------------------------------------------------------

  /** `distanceTravelled` au pas fixe précédent. Interpolation de la phase du bob. */
  previousDistanceTravelled = 0;
  /** Enveloppe d'amplitude du bob, 0..1, lissée au pas fixe. */
  bobIntensity = 0;
  previousBobIntensity = 0;
  /** Facteur de course lissé, 0..1. Pilote l'élargissement du FOV. */
  runFactor = 0;
  previousRunFactor = 0;
  /** Enfoncement de la vue après une réception, en mètres (positif = vers le bas). */
  landingDip = 0;
  previousLandingDip = 0;
  /** Vitesse verticale de la dernière réception, m/s. Diagnostic. */
  lastLandingSpeed = 0;

  private readonly physics: PhysicsWorld;
  private readonly cfg: MoveConfig;

  private timeSinceGrounded = Number.POSITIVE_INFINITY;
  private jumpBufferTimer = 0;
  /** Empêche un second saut tant que le sol n'a pas été retouché. */
  private jumpLatched = false;

  private readonly desired = { x: 0, y: 0, z: 0 };
  private readonly movement = { x: 0, y: 0, z: 0 };
  private readonly nextTranslation = { x: 0, y: 0, z: 0 };
  private readonly collisionScratch = new RAPIER.CharacterCollision();

  constructor(physics: PhysicsWorld, cfg: MoveConfig = moveConfig) {
    this.physics = physics;
    this.cfg = cfg;

    this.body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(cfg.capsuleHalfHeight, cfg.capsuleRadius).setCollisionGroups(
        COLLISION_GROUPS.PLAYER,
      ),
      this.body,
    );
    this.kcc = physics.createCharacterController(cfg);
  }

  /**
   * Réapplique la config au collider et au KCC. À appeler après avoir muté
   * `moveConfig` à chaud (A/B de `feel-tuner`). Les vitesses, accélérations et
   * le saut sont relus à chaque pas fixe et n'ont pas besoin de ça.
   */
  applyConfig() {
    const cfg = this.cfg;
    this.collider.setShape(new RAPIER.Capsule(cfg.capsuleHalfHeight, cfg.capsuleRadius));
    this.collider.setCollisionGroups(COLLISION_GROUPS.PLAYER);
    configureCharacterController(this.kcc, cfg);
  }

  /** Décalage vertical entre le centre de la capsule et les yeux, en mètres. */
  get eyeOffset(): number {
    return eyeOffsetFromCenter(this.cfg);
  }

  /** Vitesse horizontale, m/s. */
  get horizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  /** Place le joueur, PIEDS à la hauteur `feetY`, et remet son mouvement à zéro. */
  spawn(x: number, feetY: number, z: number) {
    const centerY = feetY + this.cfg.capsuleHalfHeight + this.cfg.capsuleRadius;
    this.body.setNextKinematicTranslation({ x, y: centerY, z });
    this.body.setTranslation({ x, y: centerY, z }, true);
    this.position.set(x, centerY, z);
    this.previousPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.groundNormal.set(0, 1, 0);
    this.isGrounded = false;
    this.numCollisions = 0;
    this.timeSinceGrounded = Number.POSITIVE_INFINITY;
    this.jumpBufferTimer = 0;
    this.jumpLatched = false;
    this.distanceTravelled = 0;
    this.previousDistanceTravelled = 0;
    this.bobIntensity = 0;
    this.previousBobIntensity = 0;
    this.runFactor = 0;
    this.previousRunFactor = 0;
    this.landingDip = 0;
    this.previousLandingDip = 0;
    this.lastLandingSpeed = 0;
  }

  /** À appeler avant `update`, dans `snapshotPrevious` de la boucle. */
  snapshotPrevious() {
    this.previousPosition.copy(this.position);
    this.previousDistanceTravelled = this.distanceTravelled;
    this.previousBobIntensity = this.bobIntensity;
    this.previousRunFactor = this.runFactor;
    this.previousLandingDip = this.landingDip;
  }

  /**
   * Position des yeux interpolée pour le rendu. La ROTATION, elle, ne s'interpole jamais.
   *
   * VOLONTAIREMENT NON BOBÉE : c'est la position « anatomique » des yeux, celle
   * qui servira d'origine au raycast d'arme en Phase 2. Le head bob s'ajoute
   * par-dessus, côté caméra, via `viewBob` — un tir ne doit jamais partir d'une
   * caméra secouée.
   */
  eyePosition(alpha: number, out: THREE.Vector3): THREE.Vector3 {
    out.lerpVectors(this.previousPosition, this.position, alpha);
    out.y += this.eyeOffset;
    return out;
  }

  /**
   * Décalage de head bob à appliquer à la CAMÉRA, en mètres, exprimé dans le
   * repère de la vue : `x` = latéral (positif vers la droite du joueur),
   * `y` = vertical, `z` inutilisé. Écrit dans `out`, aucune allocation.
   *
   * La phase vient de la distance parcourue interpolée : elle se fige dès que
   * le joueur cesse d'avancer, et reste lisse quel que soit le taux
   * d'affichage. L'enveloppe et l'enfoncement de réception, eux, sont lissés au
   * pas fixe. Aucune composante angulaire (invariant #3).
   *
   * À l'arrêt complet, la sortie est EXACTEMENT (0, 0, 0) : c'est la garantie
   * d'immobilité pixel-exacte pour les captures déterministes.
   */
  viewBob(alpha: number, out: THREE.Vector3): THREE.Vector3 {
    const cfg = this.cfg;
    const intensity = THREE.MathUtils.lerp(this.previousBobIntensity, this.bobIntensity, alpha);
    const dip = THREE.MathUtils.lerp(this.previousLandingDip, this.landingDip, alpha);
    if (intensity <= 0 && dip <= 0) return out.set(0, 0, 0);

    let cycle = 0;
    if (intensity > 0 && cfg.bobDistancePerCycle > 0) {
      const distance = THREE.MathUtils.lerp(
        this.previousDistanceTravelled,
        this.distanceTravelled,
        alpha,
      );
      cycle = (distance / cfg.bobDistancePerCycle) * TAU;
    }

    // Un cycle = deux appuis de pied : le balancement latéral fait un
    // aller-retour, la vue monte et redescend deux fois.
    out.x = Math.sin(cycle) * cfg.bobLateralAmplitude * intensity;
    out.y = Math.sin(cycle * 2) * cfg.bobVerticalAmplitude * intensity - dip;
    out.z = 0;
    return out;
  }

  /** Facteur de course interpolé pour le rendu, 0..1. Pilote le FOV. */
  runFactorAt(alpha: number): number {
    return THREE.MathUtils.lerp(this.previousRunFactor, this.runFactor, alpha);
  }

  /**
   * Un pas fixe de déplacement. `dt` est le dt de gameplay (déjà scalé par le
   * hitstop) : toutes les formules ci-dessous en dépendent linéairement, aucune
   * ne suppose 1/60.
   */
  update(dt: number, frame: InputFrame) {
    const cfg = this.cfg;
    const gravityY = this.physics.gravityY;

    // --- Direction voulue, dérivée du YAW SEUL --------------------------------
    // Le pitch est volontairement exclu : regarder le sol ne doit pas ralentir
    // la marche (c'est ce que fait `camera.getWorldDirection`).
    const sin = Math.sin(frame.yaw);
    const cos = Math.cos(frame.yaw);
    let wishX = 0;
    let wishZ = 0;
    if (frame.forward) {
      wishX -= sin;
      wishZ -= cos;
    }
    if (frame.back) {
      wishX += sin;
      wishZ += cos;
    }
    if (frame.right) {
      wishX += cos;
      wishZ -= sin;
    }
    if (frame.left) {
      wishX -= cos;
      wishZ += sin;
    }
    const wishLength = Math.hypot(wishX, wishZ);
    if (wishLength > 0) {
      wishX /= wishLength;
      wishZ /= wishLength;
    }

    // --- Accélération / friction horizontales ---------------------------------
    const targetSpeed = frame.sprint ? cfg.runSpeed : cfg.walkSpeed;

    if (wishLength > 0) {
      // Accélération linéaire vers la vitesse cible, bornée par le budget du pas.
      const accel = groundAcceleration(cfg, targetSpeed) * (this.isGrounded ? 1 : cfg.airControl);
      let dvx = wishX * targetSpeed - this.velocity.x;
      let dvz = wishZ * targetSpeed - this.velocity.z;
      const dvLength = Math.hypot(dvx, dvz);
      const budget = accel * dt;
      if (dvLength > budget) {
        const scale = budget / dvLength;
        dvx *= scale;
        dvz *= scale;
      }
      this.velocity.x += dvx;
      this.velocity.z += dvz;
    } else if (this.isGrounded) {
      // Friction linéaire : arrêt complet en `timeToStop` depuis `runSpeed`.
      // Pas de friction en l'air, le momentum se conserve.
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      const drop = groundDeceleration(cfg) * dt;
      if (speed <= drop || speed === 0) {
        this.velocity.x = 0;
        this.velocity.z = 0;
      } else {
        const scale = (speed - drop) / speed;
        this.velocity.x *= scale;
        this.velocity.z *= scale;
      }
    }

    // --- Vertical : gravité, collage au sol, saut -----------------------------
    this.timeSinceGrounded = this.isGrounded ? 0 : this.timeSinceGrounded + dt;

    this.velocity.y += gravityY * dt;
    if (this.isGrounded && this.velocity.y < 0) {
      // Poussée descendante constante : maintient le contact et stabilise
      // `computedGrounded` (sinon il clignote sur terrain plat). Ne PAS
      // remonter cette valeur sans mesurer : un creep trop fort combiné à une
      // grande vitesse horizontale axée-axe fait dégénérer
      // `computeColliderMovement` (stutter). Détail et chiffres dans le
      // commentaire de `groundStickSpeed`, moveConfig.ts.
      this.velocity.y = -cfg.groundStickSpeed;
    }

    this.jumpBufferTimer = frame.jump
      ? cfg.jumpBufferTime
      : Math.max(0, this.jumpBufferTimer - dt);
    const wantsJump = frame.jump || this.jumpBufferTimer > 0;
    const canJump = this.isGrounded || this.timeSinceGrounded <= cfg.coyoteTime;
    if (wantsJump && canJump && !this.jumpLatched) {
      this.velocity.y = jumpVelocity(cfg, gravityY);
      this.jumpLatched = true;
      this.jumpBufferTimer = 0;
      this.isGrounded = false;
    }

    if (this.velocity.y < -cfg.maxFallSpeed) this.velocity.y = -cfg.maxFallSpeed;

    // Le snap-to-ground recollerait au sol un saut naissant (7.4 m/s × 1/60 =
    // 0.12 m, très en dessous des 0.4 m de snap). On le suspend tant qu'on monte.
    if (this.velocity.y > 0) this.kcc.disableSnapToGround();
    else this.kcc.enableSnapToGround(cfg.snapToGroundDistance);

    // --- Résolution par Rapier ------------------------------------------------
    this.desired.x = this.velocity.x * dt;
    this.desired.y = this.velocity.y * dt;
    this.desired.z = this.velocity.z * dt;

    this.kcc.computeColliderMovement(
      this.collider,
      this.desired,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      COLLISION_GROUPS.PLAYER,
      (other) => other.handle !== this.collider.handle,
    );
    this.kcc.computedMovement(this.movement);
    this.numCollisions = this.kcc.numComputedCollisions();
    const grounded = this.kcc.computedGrounded();

    // Un seul passage sur les collisions du pas fixe pour deux besoins :
    //  - normale du sol : la collision dont la normale pointe le plus vers le
    //    haut, seulement si `grounded` (sinon `groundNormal` reste (0,1,0)) ;
    //  - détection de MUR pour le reclip de vitesse plus bas : au moins une
    //    collision dont la normale est plus raide que `maxSlopeClimbAngleDeg`
    //    (quasi verticale), qu'on soit au sol ou en l'air.
    this.groundNormal.set(0, 1, 0);
    let bestUp = -Infinity;
    let hitWall = false;
    const wallThreshold = wallNormalYThreshold(cfg);
    for (let i = 0; i < this.numCollisions; i++) {
      const collision = this.kcc.computedCollision(i, this.collisionScratch);
      if (!collision) continue;
      if (grounded && collision.normal1.y > bestUp) {
        bestUp = collision.normal1.y;
        this.groundNormal.set(collision.normal1.x, collision.normal1.y, collision.normal1.z);
      }
      if (Math.abs(collision.normal1.y) < wallThreshold) hitWall = true;
    }

    // Vitesse verticale : plafond puis atterrissage.
    if (this.velocity.y > 0 && this.movement.y < this.desired.y - 1e-6) {
      this.velocity.y = 0; // tête dans le plafond
    }
    // Vitesse d'impact, lue AVANT la remise à zéro : c'est la seule fenêtre où
    // elle existe encore. Conditionnée à la TRANSITION air -> sol, sinon
    // `groundStickSpeed` (appliqué en permanence au sol) déclencherait un
    // enfoncement de réception à chaque pas de marche.
    let impactSpeed = 0;
    if (grounded && this.velocity.y < 0) {
      if (!this.isGrounded) impactSpeed = -this.velocity.y;
      this.velocity.y = 0; // atterrissage
    }

    // Vitesse horizontale reclippée sur le mouvement réellement effectué,
    // SEULEMENT si un vrai MUR a été touché (`hitWall`, calculé ci-dessus) :
    // sans ce reclip, courir contre un mur conserverait une vitesse fantôme
    // qui se libère d'un coup quand on s'en écarte. Le filtre sur la normale
    // est nécessaire : un simple contact de sol/pente/marche compte aussi
    // comme collision pour Rapier (`numComputedCollisions() > 0` à quasiment
    // chaque pas fixe au sol) — reclipper sur CETTE seule condition avait
    // pénalisé sol, pentes et marches, voir `wallNormalYThreshold`.
    if (hitWall && dt > 0) {
      this.velocity.x = this.movement.x / dt;
      this.velocity.z = this.movement.z / dt;
    }

    if (grounded) {
      this.jumpLatched = false;
      this.timeSinceGrounded = 0;
    }
    this.isGrounded = grounded;

    // --- Application ----------------------------------------------------------
    const current = this.body.translation();
    this.nextTranslation.x = current.x + this.movement.x;
    this.nextTranslation.y = current.y + this.movement.y;
    this.nextTranslation.z = current.z + this.movement.z;
    // Consommé par le `world.step()` du MÊME pas fixe (ordre de `core/loop.ts`).
    // Le corps kinématique en dérive sa vitesse, ce qui permet de pousser les
    // corps dynamiques proprement.
    this.body.setNextKinematicTranslation(this.nextTranslation);

    this.position.set(this.nextTranslation.x, this.nextTranslation.y, this.nextTranslation.z);
    this.distanceTravelled += Math.hypot(this.movement.x, this.movement.z);

    this.updateViewState(dt, impactSpeed);
  }

  /**
   * Grandeurs de vue du pas fixe. Séparé de `update` pour que la lecture du
   * déplacement reste lisible, mais c'est bien le même pas fixe : rien ici
   * n'est autorisé à lire une horloge réelle.
   *
   * Ce qui est piloté par la DISTANCE (la phase du bob) n'apparaît pas ici :
   * elle se dérive directement de `distanceTravelled`, donc elle se fige
   * d'elle-même à l'arrêt. Seules les grandeurs qui doivent varier À VITESSE
   * CONSTANTE — enveloppes et retour de réception — ont besoin d'un lissage
   * temporel, et ce lissage utilise le `dt` du pas fixe.
   */
  private updateViewState(dt: number, impactSpeed: number) {
    const cfg = this.cfg;
    const speed = this.horizontalSpeed;

    // Enveloppes normalisées : amplitude totale 1.
    this.bobIntensity = approach(
      this.bobIntensity,
      bobIntensityTarget(cfg, speed, this.isGrounded),
      cfg.bobResponseTime,
      dt,
      1,
    );

    this.runFactor = approach(
      this.runFactor,
      fovRunFactorTarget(cfg, speed),
      cfg.fovResponseTime,
      dt,
      1,
    );

    // Remontée d'abord, nouvel impact ensuite : un enfoncement tout juste
    // déclenché garde sa pleine valeur pendant au moins une frame d'affichage.
    // L'amplitude de référence est `landingDipMax` : un enfoncement partiel
    // remonte donc proportionnellement plus vite, et `landingDipRecoverTime`
    // reste le temps de remontée DEPUIS LE MAXIMUM.
    this.landingDip = approach(
      this.landingDip,
      0,
      cfg.landingDipRecoverTime,
      dt,
      cfg.landingDipMax,
    );
    if (impactSpeed > 0) {
      this.lastLandingSpeed = impactSpeed;
      this.landingDip = Math.max(this.landingDip, landingDipFor(cfg, impactSpeed));
    }
  }
}
