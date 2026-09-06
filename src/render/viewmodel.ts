import * as THREE from "three";

import type { WeaponSystem } from "../game/player/weapons";

/**
 * Le mesh d'arme affiché à l'écran. Invariant #9 : aucun asset de sprite
 * d'arme n'existe encore, deux boîtes `MeshLambertMaterial` colorées en
 * tiennent lieu (choix ATTENDU — la Phase 2 valide le FEEL du tir, pas le
 * rendu de l'arme).
 *
 * Hiérarchie de scène (enfant de caméra), prérequis `scene.add(camera)`, et
 * FOV hérité pendant un sprint (comportement HABITUEL d'un FPS, pas une
 * régression) :
 * see: docs/systems/rendu.md#le-mesh-darme-affiché-à-lécran-viewmodel
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

    // Trois états explicites, PAS un ternaire binaire (voir la doc de tête) :
    // un ternaire melee/shotgun afficherait le pompe par défaut sur "none".
    switch (weapons.activeWeapon) {
      case "melee":
        this.shotgunMesh.visible = false;
        this.meleeMesh.visible = true;
        this.applyPose(this.meleeMesh, MELEE_BASE_OFFSET);
        break;
      case "shotgun":
        this.meleeMesh.visible = false;
        this.shotgunMesh.visible = true;
        this.applyPose(this.shotgunMesh, SHOTGUN_BASE_OFFSET);
        break;
      case "none":
        // Aucune arme équipée : les deux meshes cachés, aucune pose à
        // calculer. Pas de troisième mesh « mains nues » pour ce slice —
        // invariant #9 (boîtes blanches), un viewmodel vide est honnête tant
        // que le gameplay de ramassage n'est pas validé humainement.
        this.meleeMesh.visible = false;
        this.shotgunMesh.visible = false;
        break;
    }
  }

  private applyPose(mesh: THREE.Mesh, base: THREE.Vector3) {
    mesh.position.set(
      base.x + this.scratchPosition.x,
      base.y + this.scratchPosition.y,
      base.z + this.scratchPosition.z,
    );
    mesh.rotation.x = this.scratchEuler.x;
  }
}
