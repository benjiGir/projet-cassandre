import * as THREE from "three";

import { configureRetroTexture } from "../pipeline/renderer";
import { applyMinimumLight } from "../materials/minimumLight";

// see: docs/6-reference/notes-code-rendu.md#billboard-ennemi

// Huit colonnes exigées par la quantification en secteurs de 45°.
export const BILLBOARD_COLUMNS = 8;

const FLASH_NEGLIGIBLE_FRACTION = 0.05;
// Durée de repli si `setFlash` est appelée sans second argument (compat / tests) — mêmes 0.25 s que l'ancienne constante en dur.
const DEFAULT_FLASH_DURATION = 0.25; // s
// Une exponentielle ne rejoint jamais zéro sans seuil de coupure.
const FLASH_EPSILON = 1e-3;

export interface BillboardSpriteOptions {

  rows?: number;
  // Largeur du quad, en mètres. Défaut 1.
  width?: number;
  // Hauteur du quad, en mètres. Défaut 1.8 (gabarit humain approximatif).
  height?: number;
  // Fraction sous position.y : 0 = pied, 0,5 = centre, 1 = sommet.
  verticalAnchor?: number;
  // Seuil de coupure alpha. Défaut 0.5, valeur prescrite par le skill.
  alphaTest?: number;

  color?: number;
  // Incline les normales sans déplacer le quad pour capter les plafonniers.
  normalTilt?: number;
  minimumLight?: number;
}

const DEFAULT_ROWS = 1;
const DEFAULT_WIDTH = 1;
const DEFAULT_HEIGHT = 1.8;
const DEFAULT_VERTICAL_ANCHOR = 0;
const DEFAULT_ALPHA_TEST = 0.5;
const DEFAULT_COLOR = 0xffffff;

export class BillboardSprite {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.Material>;
  readonly material: THREE.MeshLambertMaterial;

  private readonly scene: THREE.Scene;
  // Les offsets UV sont propres à chaque instance ; ne pas partager la texture.
  private texture: THREE.Texture;
  private readonly rows: number;

  private flashIntensity = 0;

  private flashDecayRate = -Math.log(FLASH_NEGLIGIBLE_FRACTION) / DEFAULT_FLASH_DURATION;
  // Conserver cette direction si caméra ou orientation devient dégénérée.
  private lastDirection = 0;

  private readonly scratchToCam = new THREE.Vector3();
  private readonly scratchForward = new THREE.Vector3();

  constructor(scene: THREE.Scene, atlas: THREE.Texture, options: BillboardSpriteOptions = {}) {
    this.scene = scene;
    this.rows = Math.max(1, Math.floor(options.rows ?? DEFAULT_ROWS));

    const width = options.width ?? DEFAULT_WIDTH;
    const height = options.height ?? DEFAULT_HEIGHT;
    const anchor = options.verticalAnchor ?? DEFAULT_VERTICAL_ANCHOR;
    const alphaTest = options.alphaTest ?? DEFAULT_ALPHA_TEST;
    const color = options.color ?? DEFAULT_COLOR;

    // Option (a) : clone d'instance, jamais l'atlas partagé lui-même.
    this.texture = atlas.clone();
    this.texture.needsUpdate = true;
    this.texture.repeat.set(1 / BILLBOARD_COLUMNS, 1 / this.rows);
    this.texture.offset.set(0, 1 - 1 / this.rows); // colonne 0, ligne 0 (voir mapping V dans `updatePose`)

    const geometry = new THREE.PlaneGeometry(width, height);
    geometry.translate(0, height * (0.5 - anchor), 0);
    const tilt = options.normalTilt ?? 0;
    if (tilt !== 0) {
      const normals = geometry.attributes.normal!;
      for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, Math.sin(tilt), Math.cos(tilt));
    }

    const material = new THREE.MeshLambertMaterial({
      map: this.texture,
      color,
      alphaTest,
      transparent: false, // contrat du skill : écrit dans le depth buffer, pas de tri de profondeur entre sprites qui se chevauchent
      depthWrite: true,
    });

    applyMinimumLight(material, options.minimumLight ?? 0);
    this.material = material;

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
  }

  // Reçoit position et orientation déjà interpolées, une fois par frame d’affichage.
  updatePose(camera: THREE.Camera, position: THREE.Vector3, forward: THREE.Vector3, row = 0): void {
    this.mesh.position.copy(position);

    const dx = camera.position.x - position.x;
    const dz = camera.position.z - position.z;

    // Le yaw seul évite de pencher le personnage avec le regard vertical.
    this.mesh.rotation.y = Math.atan2(dx, dz);

    this.scratchToCam.set(dx, 0, dz);
    const toCamLenSq = this.scratchToCam.lengthSq();
    this.scratchForward.set(forward.x, 0, forward.z);
    const fwdLenSq = this.scratchForward.lengthSq();

    if (toCamLenSq > 1e-8 && fwdLenSq > 1e-8) {
      this.scratchToCam.multiplyScalar(1 / Math.sqrt(toCamLenSq));
      this.scratchForward.multiplyScalar(1 / Math.sqrt(fwdLenSq));

      const cross = this.scratchForward.x * this.scratchToCam.z - this.scratchForward.z * this.scratchToCam.x; // composante Y du produit vectoriel
      const dot = this.scratchForward.x * this.scratchToCam.x + this.scratchForward.z * this.scratchToCam.z; // produit scalaire
      const angle = Math.atan2(cross, dot);

      this.lastDirection =
        Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % BILLBOARD_COLUMNS;
    }
    // Garder la dernière case évite un flash arbitraire lorsque la direction dégénère.

    const clampedRow = Math.max(0, Math.min(this.rows - 1, Math.floor(row)));
    // V est inversé : row 0 doit sélectionner le haut de l’image.
    this.texture.offset.set(this.lastDirection / BILLBOARD_COLUMNS, 1 - (clampedRow + 1) / this.rows);
  }

  get direction(): number {
    return this.lastDirection;
  }

  // Exige la même disposition et conserve la case courante.
  setAtlas(atlas: THREE.Texture): void {
    const next = atlas.clone();
    next.needsUpdate = true;
    next.repeat.copy(this.texture.repeat);
    next.offset.copy(this.texture.offset);
    this.texture.dispose();
    this.texture = next;
    this.material.map = next;
  }

  setTint(color: number): void {
    this.material.color.set(color);
  }

  // Déclenche au dégât ; décroissance cosmétique en temps réel, sans sommation.
  setFlash(amount: number, durationSeconds: number = DEFAULT_FLASH_DURATION): void {
    const safeDuration = Math.max(1e-3, durationSeconds);
    this.flashDecayRate = -Math.log(FLASH_NEGLIGIBLE_FRACTION) / safeDuration;
    this.flashIntensity = Math.max(this.flashIntensity, THREE.MathUtils.clamp(amount, 0, 1));
  }

  // Delta réel d’affichage, jamais le pas fixe.
  updateFlash(realDt: number): void {
    if (this.flashIntensity <= 0) return;

    this.flashIntensity *= Math.exp(-this.flashDecayRate * realDt);
    if (this.flashIntensity < FLASH_EPSILON) this.flashIntensity = 0;

    this.material.emissive.setScalar(this.flashIntensity);
  }

  // Libère les ressources de cette instance, jamais celles de l’atlas partagé.
  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}


const PLACEHOLDER_CELL_WIDTH = 32; // px, largement sous la limite 128×128/texture (invariant #4)
const PLACEHOLDER_CELL_HEIGHT = 48; // px, portrait — gabarit humanoïde approximatif
// La marge limite le bleeding entre cases de l’atlas.
const PLACEHOLDER_PADDING = 1;

export function createPlaceholderAtlas(columns: number, rows: number): THREE.Texture {
  const cols = Math.max(1, Math.floor(columns));
  const rowCount = Math.max(1, Math.floor(rows));

  const canvas = document.createElement("canvas");
  canvas.width = cols * PLACEHOLDER_CELL_WIDTH;
  canvas.height = rowCount * PLACEHOLDER_CELL_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("[billboard] impossible d'obtenir un contexte 2D pour l'atlas placeholder");
  }

  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = col * PLACEHOLDER_CELL_WIDTH;
      const cellY = row * PLACEHOLDER_CELL_HEIGHT;
      const hue = (col / cols) * 360;
      // Lignes successives d'une même colonne : léger dégradé de luminosité,
      // pour distinguer les frames d'animation sans changer de teinte.
      const lightness = 45 + (row % 3) * 12;

      ctx.fillStyle = `hsl(${hue}, 65%, ${lightness}%)`;
      ctx.fillRect(
        cellX + PLACEHOLDER_PADDING,
        cellY + PLACEHOLDER_PADDING,
        PLACEHOLDER_CELL_WIDTH - PLACEHOLDER_PADDING * 2,
        PLACEHOLDER_CELL_HEIGHT - PLACEHOLDER_PADDING * 2,
      );

      ctx.fillStyle = lightness > 55 ? "#000000" : "#ffffff";
      ctx.fillText(`${col}.${row}`, cellX + PLACEHOLDER_CELL_WIDTH / 2, cellY + PLACEHOLDER_CELL_HEIGHT / 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  configureRetroTexture(texture);
  return texture;
}
