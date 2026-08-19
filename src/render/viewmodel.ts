import * as THREE from "three";

import type { WeaponSystem } from "../game/player/weapons";

/**
 * Le mesh d'arme affiché à l'écran (le « gun » en bas de l'écran). Invariant
 * #9 (boîtes blanches jusqu'à la Phase 5) : AUCUN asset de sprite d'arme
 * n'existe encore, donc pas de texture chargée ni générée ici — deux boîtes
 * `MeshLambertMaterial` colorées, une par arme, dans le même esprit que la
 * palette de zone de `game/level/gym.ts` (une teinte = une identité visuelle,
 * pas de détail). C'est le choix ATTENDU à ce stade, pas un raccourci : le
 * critère de validation de la Phase 2 porte sur le FEEL du tir, pas sur le
 * rendu de l'arme.
 *
 * HIÉRARCHIE DE SCÈNE — choix ASSUMÉ : les deux meshes sont ajoutés en ENFANT
 * de la caméra (`camera.add`), pas recalculés en world-space à chaque frame.
 * Deux raisons :
 *  1. `weapons.viewmodelPose()` renvoie déjà translation + tangage « dans le
 *     repère local de la caméra » (voir sa doc dans `weapons.ts`) — en enfant
 *     de caméra, cette pose s'applique TELLE QUELLE en position/rotation
 *     locales, sans reconstruire de matrice à partir de
 *     `camera.position`/`camera.quaternion` chaque frame ;
 *  2. conséquence ASSUMÉE, pas un oubli : le viewmodel hérite du FOV
 *     dynamique de la caméra (élargi en course, voir `moveConfig.fovRunBoost`)
 *     et semble très légèrement « zoomer » pendant un sprint. C'est le
 *     comportement HABITUEL d'un FPS (le viewmodel bouge avec le FOV de
 *     l'arme), pas une régression à corriger.
 *
 * PRÉREQUIS côté appelant : la caméra doit être ajoutée à la scène
 * (`scene.add(camera)`) pour que ses enfants soient traversés au rendu — une
 * caméra qui n'est PAS un descendant de `scene` rend ses propres enfants
 * invisibles, même correctement positionnés. Voir le commentaire au point
 * d'appel dans `main.ts`.
 */

const MELEE_COLOR = 0x8a5a34; // brun/rouille, pied-de-biche
const SHOTGUN_COLOR = 0x555a60; // gris/métal, pompe

// Ancrage bas-droit, dans le repère LOCAL de la caméra (forward = -Z).
// Valeurs de départ, non prescrites par le plan — tunables sans casser l'API.
const MELEE_BASE_OFFSET = new THREE.Vector3(0.32, -0.28, -0.55);
const SHOTGUN_BASE_OFFSET = new THREE.Vector3(0.3, -0.3, -0.65);

export class Viewmodel {
  private readonly meleeMesh: THREE.Mesh;
  private readonly shotgunMesh: THREE.Mesh;

  // Scratch, zéro allocation en régime établi.
  private readonly scratchPosition = new THREE.Vector3();
  private readonly scratchEuler = new THREE.Euler(0, 0, 0, "XYZ");

  constructor(camera: THREE.Camera) {
    this.meleeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.7),
      new THREE.MeshLambertMaterial({ color: MELEE_COLOR }),
    );
    this.meleeMesh.position.copy(MELEE_BASE_OFFSET);
    this.meleeMesh.visible = false;
    camera.add(this.meleeMesh);

    this.shotgunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.12, 0.85),
      new THREE.MeshLambertMaterial({ color: SHOTGUN_COLOR }),
    );
    this.shotgunMesh.position.copy(SHOTGUN_BASE_OFFSET);
    this.shotgunMesh.visible = false;
    camera.add(this.shotgunMesh);
  }

  /**
   * Positionne et bascule le mesh actif. À appeler dans `interpolateVisuals`,
   * APRÈS que `camera.position`/`camera.quaternion`/`camera.fov` sont déjà
   * posés par le code existant (bob, FOV) — l'offset lu ici est purement
   * local à la caméra, il ne dépend d'aucun de ces calculs mais doit rester
   * visuellement synchronisé avec eux dans la même frame.
   */
  update(alpha: number, weapons: WeaponSystem) {
    weapons.viewmodelPose(alpha, this.scratchPosition, this.scratchEuler);

    const isMelee = weapons.activeWeapon === "melee";
    const active = isMelee ? this.meleeMesh : this.shotgunMesh;
    const inactive = isMelee ? this.shotgunMesh : this.meleeMesh;
    const base = isMelee ? MELEE_BASE_OFFSET : SHOTGUN_BASE_OFFSET;

    inactive.visible = false;
    active.visible = true;
    active.position.set(
      base.x + this.scratchPosition.x,
      base.y + this.scratchPosition.y,
      base.z + this.scratchPosition.z,
    );
    active.rotation.x = this.scratchEuler.x;
  }
}
