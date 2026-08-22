import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

import { COLLISION_GROUPS, GROUP, interactionGroups, type PhysicsWorld } from "../../physics/world";
import { allocateEntityId, type Entity } from "./entity";
import { directorConfig as defaultDirectorConfig, type DirectorConfig } from "./directorConfig";

const TAU = Math.PI * 2;

/**
 * L'ennemi « Directeur » — boss unique de fin (Zone E), 2ᵉ type d'ennemi du
 * jeu après `Suit` (skills `enemy-state-machine`, `billboard-sprites-8dir`).
 * Structure et discipline VOLONTAIREMENT calquées sur `suit.ts` (invariant
 * #8 : `Entity[]` + `update(dt)` + `switch`, pas d'ECS avant 12 types — donc
 * une classe séparée du même genre, pas une abstraction générique partagée
 * avec `Suit`). Les helpers privés ci-dessous (PRNG, ligne de vue, groupes de
 * raycast) sont DUPLIQUÉS depuis `suit.ts` plutôt qu'importés : `suit.ts` ne
 * les exporte pas, et les exporter pour les partager créerait un couplage
 * entre deux types d'ennemis avant que la douleur de duplication soit réelle
 * — exactement le choix déjà documenté dans `suitConfig.ts` au sujet de
 * `MoveConfig`/`SuitConfig`.
 *
 * PURETÉ DU CŒUR DE SIMULATION (même discipline que `Suit`/`PlayerController`/
 * `WeaponSystem`) : ce fichier n'importe RIEN de `render/billboard.ts`,
 * `render/fx.ts`, `core/audio.ts`, ni `game/state.ts`. `Director.update()` ne
 * fait qu'avancer sa propre machine à états et sa physique ; il expose des
 * champs `pending*` (comme `Suit`) et un résultat explicite de `applyDamage`
 * que `DirectorManager` lit et traduit en événements — c'est un futur pont
 * dans `main.ts` (HORS SCOPE de cette tâche, voir le rapport) qui possédera
 * les `BillboardSprite`/appels `fx`/`audio`/`state`, jamais ce fichier.
 *
 * DÉTERMINISME : tout ici tourne au pas fixe, avec le `dt` de GAMEPLAY reçu en
 * paramètre (jamais d'horloge murale). La seule source de hasard
 * (`aimJitterDeg`) passe par un PRNG mulberry32 seedé PAR ENTITÉ — jamais
 * `Math.random()`.
 *
 * DÉPLACEMENT : `RAPIER.KinematicCharacterController` (invariant #6), jamais
 * de résolution capsule-vs-monde maison. Comme `Suit`, `Director` NE POSSÈDE
 * PAS son propre contrôleur : `DirectorManager` en crée UNE SEULE instance
 * partagée (voir la doc de `suit.ts` pour la justification complète — une
 * seule instance peut piloter plusieurs personnages en JS single-thread tant
 * que `computeColliderMovement`/lecture du résultat sont consommés avant la
 * prochaine entité).
 */

// ---------------------------------------------------------------------------
// Groupes de raycast — dérivés localement de `GROUP`/`interactionGroups`,
// EXACTEMENT comme dans `suit.ts` (duplication assumée, voir la doc de tête).
// ---------------------------------------------------------------------------

/** Filtre « rayon d'ENEMY qui ne teste QUE la géométrie du niveau » — voir la doc identique dans `suit.ts`. */
const WORLD_ONLY_RAY_GROUPS = interactionGroups(GROUP.ENEMY, GROUP.WORLD);

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_RIGHT_FALLBACK = new THREE.Vector3(1, 0, 0);

/** Nombre de frames de l'animation de mort — même choix que `Suit` (4 frames), voir `DEATH_FRAME_COUNT` dans `suit.ts`. */
export const DIRECTOR_DEATH_FRAME_COUNT = 4;

/**
 * Nombre de lignes de l'atlas 8×N attendu par `BillboardSprite` : 5 poses
 * d'état distinctes (IDLE, ALERTE, POURSUITE, TIR, RECUL) + 4 frames de mort
 * dédiées — MÊME disposition que `SUIT_ATLAS_ROWS`. La révélation (costume
 * humain -> reptilien) N'AJOUTE PAS de lignes ici : elle est rendue par une
 * TEINTE (`BillboardSprite.setTint`, voir `DirectorConfig.revealedTintColor`)
 * appliquée par-dessus les mêmes lignes d'état, pas par un second jeu de
 * poses — choix explicitement autorisé par la tâche (« un tint de couleur
 * différent ... suffit ») et le plus simple des deux à câbler/vérifier : pas
 * de doublement de la surface d'atlas, pas de risque de décalage d'index
 * entre deux blocs de lignes.
 */
export const DIRECTOR_ATLAS_ROWS = 5 + DIRECTOR_DEATH_FRAME_COUNT;

/** États de la machine — mêmes noms que `SuitState`, même diagramme (skill `enemy-state-machine`), adapté à un boss unique (voir la doc de tête du fichier). */
export type DirectorState =
  | "idle" // IDLE
  | "alert" // ALERTE
  | "chase" // POURSUITE
  | "attack" // TIR
  | "stagger" // RECUL
  | "dead" // MORT
  | "corpse"; // CADAVRE

/** Ligne d'atlas par état vivant — CHAQUE état a une ligne distincte (skill : « un état invisible pour le joueur est un état inutile »). */
const LIVE_STATE_ROW: Record<Exclude<DirectorState, "dead" | "corpse">, number> = {
  idle: 0,
  alert: 1,
  chase: 2,
  attack: 3,
  stagger: 4,
};
const DEATH_ROW_BASE = 5;

/** Exposée pour documentation/débogage (mosaïque de diagnostic états × directions). */
export const DIRECTOR_STATE_ROWS = {
  ...LIVE_STATE_ROW,
  deathBase: DEATH_ROW_BASE,
} as const;

/** Contexte partagé injecté à chaque `Director.update()` — même forme que `SuitUpdateContext`, voir sa doc dans `suit.ts`. */
export interface DirectorUpdateContext {
  physics: PhysicsWorld;
  kcc: RAPIER.KinematicCharacterController;
  playerTargetPosition: THREE.Vector3;
  playerEyePosition: THREE.Vector3;
}

/** PRNG déterministe, MÊME algorithme que `suit.ts`/`weapons.ts` (mulberry32) — une instance PAR ENTITÉ. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bit d'appartenance PLAYER lu directement sur un collider — même technique que `suit.ts`/`weapons.ts`. */
function isPlayerCollider(collider: RAPIER.Collider): boolean {
  const membership = (collider.collisionGroups() >>> 16) & 0xffff;
  return (membership & GROUP.PLAYER) !== 0;
}

/** Ligne de vue dégagée entre deux points, contre la géométrie du niveau SEULE — voir la doc identique dans `suit.ts`. */
function hasClearWorldPath(
  physics: PhysicsWorld,
  origin: THREE.Vector3,
  target: THREE.Vector3,
  ray: RAPIER.Ray,
): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-4) return true;

  ray.origin.x = origin.x;
  ray.origin.y = origin.y;
  ray.origin.z = origin.z;
  ray.dir.x = dx / dist;
  ray.dir.y = dy / dist;
  ray.dir.z = dz / dist;

  const hit = physics.world.castRay(
    ray,
    Math.max(0, dist - 0.05),
    true,
    RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
    WORLD_ONLY_RAY_GROUPS,
  );
  return hit === null;
}

/**
 * Résultat d'`applyDamage` — contrairement à `Suit` (qui ne renvoie que
 * `{ died }`), le Directeur ajoute `justRevealed` : `true` UNE SEULE FOIS, au
 * pas fixe précis où ses PV passent SOUS `revealHpFraction * maxHp` pour la
 * première fois. Un résultat explicite plutôt qu'un champ `pending*` (comme
 * `Suit.pendingAlert`) parce que ce calcul se fait entièrement DANS
 * `applyDamage`, jamais dans `update()` — `DirectorManager` appelle
 * `applyDamage` directement (bypass de `update()` ce pas-ci, même précondition
 * que `Suit`), donc un `pending*` remis à zéro en tête d'`update()` ne
 * fonctionnerait pas ici : `update()` ne tourne pas ce pas-ci.
 */
export interface DirectorDamageResult {
  died: boolean;
  justRevealed: boolean;
}

export class Director implements Entity {
  readonly id: number;

  body: RAPIER.RigidBody | null;
  collider: RAPIER.Collider | null;

  readonly position = new THREE.Vector3();
  readonly previousPosition = new THREE.Vector3();
  readonly forward = new THREE.Vector3(0, 0, 1);
  readonly previousForward = new THREE.Vector3(0, 0, 1);

  state: DirectorState = "idle";
  hp: number;

  /**
   * `true` dès que les PV sont passés sous le seuil de révélation — jamais
   * remis à `false` (pas de mécanique de soin dans ce prototype). Piloté
   * l'apparence (teinte) via ce champ, pas via `state` : orthogonal à la
   * machine à états (un Directeur révélé continue de traverser
   * idle/alert/chase/attack/stagger normalement).
   */
  revealed = false;

  stateTimer = 0;
  private timeSinceLastSeen = 0;
  private attackCooldownRemaining = 0;
  private isGrounded = false;
  private verticalVelocity = 0;

  private readonly velocityHorizontal = new THREE.Vector3();
  private readonly knockbackVelocity = new THREE.Vector3();

  // --- Sorties lues par un futur `DirectorManager`/pont de rendu juste après
  // `update()`, remises à zéro par CE fichier au tick suivant — même contrat
  // que `Suit.pending*`.
  pendingAlert = false;
  pendingTelegraph = false;
  pendingAttackDamage = 0;
  readonly pendingPlayerHitPoint = new THREE.Vector3();
  readonly pendingPlayerHitNormal = new THREE.Vector3();

  private readonly cfg: DirectorConfig;
  private readonly nextRandom: () => number;

  // --- Scratch, zéro allocation en régime établi ----------------------------
  private readonly scratchRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  private readonly scratchToPlayer = new THREE.Vector3();
  private readonly scratchEye = new THREE.Vector3();
  private readonly scratchMoveDir = new THREE.Vector3();
  private readonly scratchLeftDir = new THREE.Vector3();
  private readonly scratchRightDir = new THREE.Vector3();
  private readonly scratchAimDir = new THREE.Vector3();
  private readonly scratchJitteredDir = new THREE.Vector3();
  private readonly scratchAimRight = new THREE.Vector3();
  private readonly scratchAimUp = new THREE.Vector3();
  private readonly desiredScratch = { x: 0, y: 0, z: 0 };
  private readonly movementScratch = { x: 0, y: 0, z: 0 };
  private readonly nextTranslationScratch = new THREE.Vector3();

  /**
   * @param spawnPosition PIEDS du Directeur au spawn (x, feetY, z).
   * @param spawnForward Orientation initiale, normalisée en interne (Y ignoré).
   * @param seed Graine PRNG déterministe de cette instance — jamais dérivée de `Math.random()`/`Date.now()`.
   */
  constructor(
    physics: PhysicsWorld,
    spawnPosition: THREE.Vector3,
    spawnForward: THREE.Vector3,
    seed: number,
    cfg: DirectorConfig = defaultDirectorConfig,
  ) {
    this.id = allocateEntityId();
    this.cfg = cfg;
    this.nextRandom = mulberry32(seed);
    this.hp = cfg.maxHp;

    const centerY = spawnPosition.y + cfg.capsuleHalfHeight + cfg.capsuleRadius;
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawnPosition.x, centerY, spawnPosition.z),
    );
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(cfg.capsuleHalfHeight, cfg.capsuleRadius).setCollisionGroups(
        COLLISION_GROUPS.ENEMY,
      ),
      this.body,
    );

    this.position.set(spawnPosition.x, centerY, spawnPosition.z);
    this.previousPosition.copy(this.position);
    this.forward.copy(spawnForward);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-8) this.forward.set(0, 0, 1);
    this.forward.normalize();
    this.previousForward.copy(this.forward);
  }

  get isAlive(): boolean {
    return this.state !== "dead" && this.state !== "corpse";
  }

  /** Ligne d'atlas de la pose courante — voir `DIRECTOR_ATLAS_ROWS`. */
  get spriteRow(): number {
    if (this.state === "dead") {
      const frame = Math.min(
        DIRECTOR_DEATH_FRAME_COUNT - 1,
        Math.floor(this.stateTimer / this.cfg.deathFrameDuration),
      );
      return DEATH_ROW_BASE + frame;
    }
    if (this.state === "corpse") return DEATH_ROW_BASE + DIRECTOR_DEATH_FRAME_COUNT - 1;
    return LIVE_STATE_ROW[this.state];
  }

  /** Teinte à appliquer sur le sprite (`BillboardSprite.setTint`) pour l'état de révélation courant. */
  get tintColor(): number {
    return this.revealed ? this.cfg.revealedTintColor : this.cfg.humanTintColor;
  }

  /** À appeler avant `stepPhysics`, comme `Suit.snapshotPrevious`. */
  snapshotPrevious() {
    this.previousPosition.copy(this.position);
    this.previousForward.copy(this.forward);
  }

  /** Position interpolée pour le rendu — même contrat que `Suit.interpolatedPosition`. */
  interpolatedPosition(alpha: number, out: THREE.Vector3): THREE.Vector3 {
    return out.lerpVectors(this.previousPosition, this.position, alpha);
  }

  /** Orientation interpolée pour le rendu — même contrat que `Suit.interpolatedForward`. */
  interpolatedForward(alpha: number, out: THREE.Vector3): THREE.Vector3 {
    out.lerpVectors(this.previousForward, this.forward, alpha);
    if (out.lengthSq() < 1e-8) out.copy(this.forward);
    return out.normalize();
  }

  /**
   * Applique `amount` dégâts. Retourne `{ died, justRevealed }` — voir la doc
   * de `DirectorDamageResult`. Ne touche à AUCUN système de rendu/audio/state,
   * même discipline que `Suit.applyDamage`.
   */
  applyDamage(
    amount: number,
    physics: PhysicsWorld,
    knockbackDirection: THREE.Vector3,
  ): DirectorDamageResult {
    if (!this.isAlive) return { died: false, justRevealed: false }; // garde-fou, ne devrait jamais arriver.

    const wasRevealed = this.revealed;
    this.hp -= amount;

    if (this.hp <= this.cfg.revealHpFraction * this.cfg.maxHp) {
      this.revealed = true;
    }
    const justRevealed = this.revealed && !wasRevealed;

    if (this.hp <= 0) {
      this.hp = 0;
      this.state = "dead";
      this.stateTimer = 0;
      this.velocityHorizontal.set(0, 0, 0);
      this.knockbackVelocity.set(0, 0, 0);
      this.detachPhysics(physics);
      return { died: true, justRevealed };
    }

    this.state = "stagger";
    this.stateTimer = 0;
    this.knockbackVelocity.set(
      knockbackDirection.x * this.cfg.knockbackSpeed,
      this.cfg.knockbackUpBoost,
      knockbackDirection.z * this.cfg.knockbackSpeed,
    );
    return { died: false, justRevealed };
  }

  /** Libère le corps/collider Rapier — appelé une seule fois, à la mort. Même raison que `Suit.detachPhysics`. */
  private detachPhysics(physics: PhysicsWorld) {
    if (this.body) {
      physics.world.removeRigidBody(this.body);
    }
    this.body = null;
    this.collider = null;
  }

  /**
   * Un pas fixe. `dt` est le dt de GAMEPLAY — jamais d'horloge murale.
   *
   * PRÉCONDITION identique à `Suit.update` : l'appelant n'appelle PAS
   * `update()` le pas fixe où ce Directeur vient d'encaisser un coup —
   * `applyDamage` gère ce pas-là (stagger/mort/révélation).
   */
  update(dt: number, ctx: DirectorUpdateContext) {
    this.pendingAlert = false;
    this.pendingTelegraph = false;
    this.pendingAttackDamage = 0;

    if (this.state === "corpse") return;

    if (this.state === "dead") {
      this.stateTimer += dt;
      if (this.stateTimer >= this.cfg.deathFrameDuration * DIRECTOR_DEATH_FRAME_COUNT) {
        this.state = "corpse";
      }
      return;
    }

    this.updateKnockback(dt);
    this.attackCooldownRemaining = Math.max(0, this.attackCooldownRemaining - dt);

    this.scratchToPlayer.subVectors(ctx.playerTargetPosition, this.position);
    this.scratchToPlayer.y = 0;
    const distance = this.scratchToPlayer.length();
    if (distance > 1e-4) this.scratchToPlayer.multiplyScalar(1 / distance);

    this.velocityHorizontal.set(0, 0, 0);

    switch (this.state) {
      case "idle":
        this.runIdle(ctx, distance);
        break;
      case "alert":
        this.runAlert(dt);
        break;
      case "chase":
        this.runChase(ctx, dt, distance);
        break;
      case "attack":
        this.runAttack(ctx, dt);
        break;
      case "stagger":
        this.runStagger(dt);
        break;
    }

    this.integratePhysics(dt, ctx);
  }

  private runIdle(ctx: DirectorUpdateContext, distance: number) {
    if (distance > this.cfg.sightRange) return;
    const eye = this.computeEyePosition(this.scratchEye);
    if (!hasClearWorldPath(ctx.physics, eye, ctx.playerEyePosition, this.scratchRay)) return;

    this.state = "alert";
    this.stateTimer = 0;
    this.timeSinceLastSeen = 0;
    this.pendingAlert = true;
  }

  private runAlert(dt: number) {
    this.stateTimer += dt;
    this.turnTowards(this.scratchToPlayer, dt);
    // Transition INCONDITIONNELLE après `alertDuration` — même raison que `Suit.runAlert`.
    if (this.stateTimer >= this.cfg.alertDuration) {
      this.state = "chase";
      this.stateTimer = 0;
    }
  }

  private runChase(ctx: DirectorUpdateContext, dt: number, distance: number) {
    const eye = this.computeEyePosition(this.scratchEye);
    const inSight = distance <= this.cfg.sightRange && hasClearWorldPath(ctx.physics, eye, ctx.playerEyePosition, this.scratchRay);

    if (inSight) this.timeSinceLastSeen = 0;
    else this.timeSinceLastSeen += dt;

    if (this.timeSinceLastSeen >= this.cfg.lostContactTimeout) {
      this.state = "idle";
      this.stateTimer = 0;
      return;
    }

    if (inSight && distance <= this.cfg.attackRange && this.attackCooldownRemaining <= 0) {
      this.state = "attack";
      this.stateTimer = 0;
      this.pendingTelegraph = true;
      this.turnTowards(this.scratchToPlayer, dt);
      return;
    }

    const avoided = this.computeAvoidedDirection(ctx.physics, this.scratchToPlayer, this.scratchMoveDir);
    this.velocityHorizontal.copy(avoided).multiplyScalar(this.cfg.chaseSpeed);
    this.turnTowards(this.scratchToPlayer.lengthSq() > 1e-8 ? this.scratchToPlayer : avoided, dt);
  }

  private runAttack(ctx: DirectorUpdateContext, dt: number) {
    this.turnTowards(this.scratchToPlayer, dt);
    this.stateTimer += dt;
    if (this.stateTimer < this.cfg.attackTelegraphDuration) return; // pose TIR tenue = la télégraphie visuelle exigée par le skill.

    this.resolveAttack(ctx);
    this.state = "chase";
    this.stateTimer = 0;
    this.attackCooldownRemaining = this.cfg.attackCooldown;
    this.timeSinceLastSeen = 0;
  }

  private runStagger(dt: number) {
    this.stateTimer += dt;
    if (this.stateTimer >= this.cfg.staggerDuration) {
      this.state = "chase";
      this.stateTimer = 0;
      this.timeSinceLastSeen = 0;
    }
  }

  /** Raycast d'attaque — même logique et même groupe (`ENEMY_SHOT`) que `Suit.resolveAttack`. */
  private resolveAttack(ctx: DirectorUpdateContext) {
    const eye = this.computeEyePosition(this.scratchEye);
    const targetEye = ctx.playerEyePosition;

    if (!hasClearWorldPath(ctx.physics, eye, targetEye, this.scratchRay)) return;

    this.scratchAimDir.subVectors(targetEye, eye).normalize();
    this.applyAimJitter(this.scratchAimDir, this.scratchJitteredDir);

    const maxDist = eye.distanceTo(targetEye) + 4;

    this.scratchRay.origin.x = eye.x;
    this.scratchRay.origin.y = eye.y;
    this.scratchRay.origin.z = eye.z;
    this.scratchRay.dir.x = this.scratchJitteredDir.x;
    this.scratchRay.dir.y = this.scratchJitteredDir.y;
    this.scratchRay.dir.z = this.scratchJitteredDir.z;

    const hit = ctx.physics.world.castRayAndGetNormal(
      this.scratchRay,
      maxDist,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      COLLISION_GROUPS.ENEMY_SHOT,
    );
    if (!hit || !isPlayerCollider(hit.collider)) return;

    this.pendingAttackDamage = this.cfg.attackDamage;
    this.pendingPlayerHitPoint.set(
      eye.x + this.scratchJitteredDir.x * hit.timeOfImpact,
      eye.y + this.scratchJitteredDir.y * hit.timeOfImpact,
      eye.z + this.scratchJitteredDir.z * hit.timeOfImpact,
    );
    this.pendingPlayerHitNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
  }

  /** Petite déviation angulaire de `dir`, PRNG seedé par entité — même mécanisme que `Suit.applyAimJitter`. */
  private applyAimJitter(dir: THREE.Vector3, out: THREE.Vector3) {
    const jitterYaw = (this.nextRandom() * 2 - 1) * THREE.MathUtils.degToRad(this.cfg.aimJitterDeg);
    const jitterPitch = (this.nextRandom() * 2 - 1) * THREE.MathUtils.degToRad(this.cfg.aimJitterDeg);

    const upHint = Math.abs(dir.y) > 0.98 ? WORLD_RIGHT_FALLBACK : WORLD_UP;
    this.scratchAimRight.crossVectors(upHint, dir).normalize();
    this.scratchAimUp.crossVectors(dir, this.scratchAimRight).normalize();

    out
      .copy(dir)
      .addScaledVector(this.scratchAimRight, Math.tan(jitterYaw))
      .addScaledVector(this.scratchAimUp, Math.tan(jitterPitch))
      .normalize();
  }

  /** Décroissance linéaire de la vélocité de recul — même idiome que `Suit.updateKnockback`. */
  private updateKnockback(dt: number) {
    const speed = this.knockbackVelocity.length();
    if (speed <= 1e-4) {
      this.knockbackVelocity.set(0, 0, 0);
      return;
    }
    const drop = (speed / this.cfg.knockbackDecayTime) * dt;
    const newSpeed = Math.max(0, speed - drop);
    this.knockbackVelocity.multiplyScalar(newSpeed / speed);
  }

  /** 3 rayons d'évitement — même contrat exact que `Suit.computeAvoidedDirection` (skill `enemy-state-machine`, pas de navmesh). */
  private computeAvoidedDirection(
    physics: PhysicsWorld,
    desiredDir: THREE.Vector3,
    out: THREE.Vector3,
  ): THREE.Vector3 {
    if (desiredDir.lengthSq() < 1e-8) return out.set(0, 0, 0);

    if (this.castAvoidanceRay(physics, desiredDir)) return out.copy(desiredDir);

    const angleRad = THREE.MathUtils.degToRad(this.cfg.avoidanceSideAngleDeg);
    this.rotateHorizontal(desiredDir, angleRad, this.scratchLeftDir);
    this.rotateHorizontal(desiredDir, -angleRad, this.scratchRightDir);

    if (this.castAvoidanceRay(physics, this.scratchLeftDir)) return out.copy(this.scratchLeftDir);
    if (this.castAvoidanceRay(physics, this.scratchRightDir)) return out.copy(this.scratchRightDir);

    return out.set(0, 0, 0);
  }

  private castAvoidanceRay(physics: PhysicsWorld, dir: THREE.Vector3): boolean {
    this.scratchRay.origin.x = this.position.x;
    this.scratchRay.origin.y = this.position.y;
    this.scratchRay.origin.z = this.position.z;
    this.scratchRay.dir.x = dir.x;
    this.scratchRay.dir.y = 0;
    this.scratchRay.dir.z = dir.z;
    const hit = physics.world.castRay(
      this.scratchRay,
      this.cfg.avoidanceRayLength,
      true,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      WORLD_ONLY_RAY_GROUPS,
    );
    return hit === null;
  }

  private rotateHorizontal(dir: THREE.Vector3, angleRad: number, out: THREE.Vector3): THREE.Vector3 {
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    return out.set(dir.x * c + dir.z * s, 0, -dir.x * s + dir.z * c);
  }

  /** Tourne `forward` vers `targetDir` à vitesse angulaire bornée — même idiome que `Suit.turnTowards`. */
  private turnTowards(targetDir: THREE.Vector3, dt: number) {
    if (targetDir.lengthSq() < 1e-8) return;
    const currentAngle = Math.atan2(this.forward.x, this.forward.z);
    const targetAngle = Math.atan2(targetDir.x, targetDir.z);
    let delta = targetAngle - currentAngle;
    delta = ((delta + Math.PI) % TAU + TAU) % TAU - Math.PI;
    const maxStep = this.cfg.turnRateRadPerSec * dt;
    const applied = Math.abs(delta) <= maxStep ? delta : Math.sign(delta) * maxStep;
    const newAngle = currentAngle + applied;
    this.forward.set(Math.sin(newAngle), 0, Math.cos(newAngle));
  }

  private computeEyePosition(out: THREE.Vector3): THREE.Vector3 {
    const feetY = this.position.y - (this.cfg.capsuleHalfHeight + this.cfg.capsuleRadius);
    return out.set(this.position.x, feetY + this.cfg.eyeHeight, this.position.z);
  }

  /** Gravité + collage au sol + recul, intégrés par le `KinematicCharacterController` PARTAGÉ — même schéma que `Suit.integratePhysics`. */
  private integratePhysics(dt: number, ctx: DirectorUpdateContext) {
    if (!this.body || !this.collider) return;

    const gravityY = ctx.physics.gravityY;
    this.verticalVelocity += gravityY * dt;
    if (this.isGrounded && this.verticalVelocity < 0) this.verticalVelocity = -this.cfg.groundStickSpeed;
    if (this.verticalVelocity < -this.cfg.maxFallSpeed) this.verticalVelocity = -this.cfg.maxFallSpeed;

    this.desiredScratch.x = (this.velocityHorizontal.x + this.knockbackVelocity.x) * dt;
    this.desiredScratch.y = (this.verticalVelocity + this.knockbackVelocity.y) * dt;
    this.desiredScratch.z = (this.velocityHorizontal.z + this.knockbackVelocity.z) * dt;

    const collider = this.collider;
    ctx.kcc.computeColliderMovement(
      collider,
      this.desiredScratch,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      COLLISION_GROUPS.ENEMY,
      (other) => other.handle !== collider.handle,
    );
    ctx.kcc.computedMovement(this.movementScratch);
    const grounded = ctx.kcc.computedGrounded();
    if (grounded && this.verticalVelocity < 0) this.verticalVelocity = 0;
    this.isGrounded = grounded;

    const current = this.body.translation();
    this.nextTranslationScratch.set(
      current.x + this.movementScratch.x,
      current.y + this.movementScratch.y,
      current.z + this.movementScratch.z,
    );
    this.body.setNextKinematicTranslation(this.nextTranslationScratch);
    this.position.copy(this.nextTranslationScratch);
  }
}

/**
 * Applique la configuration `DirectorConfig` à un `KinematicCharacterController`
 * brut — même fabrique que `configureSuitCharacterController` dans `suit.ts`,
 * dupliquée pour la même raison (pas d'abstraction partagée avant que la
 * douleur soit réelle, invariant #8).
 */
export function configureDirectorCharacterController(
  controller: RAPIER.KinematicCharacterController,
  cfg: DirectorConfig,
) {
  controller.setUp({ x: 0, y: 1, z: 0 });
  controller.setOffset(cfg.colliderOffset);
  controller.setSlideEnabled(true);
  controller.enableAutostep(cfg.autostepMaxHeight, cfg.autostepMinWidth, cfg.autostepIncludeDynamicBodies);
  controller.enableSnapToGround(cfg.snapToGroundDistance);
  controller.setMaxSlopeClimbAngle((cfg.maxSlopeClimbAngleDeg * Math.PI) / 180);
  controller.setMinSlopeSlideAngle((cfg.minSlopeSlideAngleDeg * Math.PI) / 180);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(cfg.characterMass);
}

/**
 * Badge droppé par le Directeur à sa mort — pur objet de LOGIQUE (position +
 * rayon + état ramassé/non ramassé), AUCUNE référence à `THREE.Scene`/
 * `THREE.Object3D` ici : même séparation que `Director`/`DirectorManager`
 * vis-à-vis du rendu (voir « PURETÉ DU CŒUR DE SIMULATION » en tête de
 * fichier). Représenter le badge dans le monde (mesh visible, retrait à la
 * collecte) est un travail de `main.ts` — HORS SCOPE de cette tâche, voir le
 * rapport : exactement comme `BillboardSprite` n'est jamais créé par
 * `Suit`/`SuitManager` eux-mêmes, mais par `main.ts`.
 *
 * PAS de contrat `use_*`/`UseObject` (`game/level/interactive.ts`) : ce
 * contrat est pensé pour des objets PRÉ-AUTORISÉS dans Blender (portée,
 * position, `targetName` déjà résolus par `loader.ts` à l'import du niveau),
 * pas pour un pickup généré à RUNTIME par la mort d'une entité — même
 * discipline de choix que documentée pour `use_crowbar` dans
 * `interactive.ts` (« le contrat `use_*` est pensé pour un
 * interrupteur-vers-porte, pas pour un pickup autoportant »). Ramassage par
 * PROXIMITÉ SEULE (pas de touche E) : plus proche de la convention
 * « marcher dessus » d'un drop de boss dans les FPS de l'époque que d'une
 * interaction consciente comme `use_crowbar`.
 */
export class DirectorBadge {
  readonly position: THREE.Vector3;
  collected = false;

  /** Secondes écoulées depuis l'apparition — voir `DirectorConfig.badgePickupDelay`. */
  private age = 0;

  constructor(position: THREE.Vector3) {
    this.position = position.clone();
  }

  /** Avance l'âge du badge d'un pas fixe — appelé par `DirectorManager.update`, jamais par une horloge murale. */
  tick(dt: number): void {
    this.age += dt;
  }

  /**
   * Un pas fixe. Retourne `true` UNE SEULE FOIS, au pas fixe où
   * `playerPosition` entre dans `pickupRadius` pour la première fois APRÈS
   * `minAge` secondes écoulées depuis le drop — les appels suivants
   * renvoient toujours `false` (déjà ramassé, encore hors de portée, ou
   * encore trop tôt). Zéro allocation.
   */
  tryCollect(playerPosition: THREE.Vector3, pickupRadius: number, minAge: number): boolean {
    if (this.collected) return false;
    if (this.age < minAge) return false;
    if (this.position.distanceToSquared(playerPosition) > pickupRadius * pickupRadius) return false;
    this.collected = true;
    return true;
  }
}
