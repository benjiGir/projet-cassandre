import * as THREE from "three";

import { configureRetroTexture } from "./renderer";

/**
 * Sprites billboard 8 directions (skill `billboard-sprites-8dir`) : un
 * `PlaneGeometry` par entité, orienté yaw-only, remplaçant `THREE.Sprite`
 * (qui billboard sur les trois axes et fait pencher l'ennemi hors du plan
 * horizontal).
 *
 * Découplage délibéré de `game/entities/*`/`game/player/*` (primitives
 * Three.js uniquement) et distinction temps réel (`updateFlash`) contre pas
 * fixe interpolé (`updatePose`) — même discipline que le reste de `render/`.
 * Convention de direction, mapping V de l'atlas, canaux teinte/flash, et le
 * piège de partage de texture (évité par le clone d'instance, ADR 0017) :
 * see: docs/systems/rendu.md#découplage-entre-render-et-game
 * see: docs/systems/rendu.md#temps-réel-contre-pas-fixe-dans-render
 * see: docs/systems/rendu.md#sprites-billboard-8-directions
 */

/**
 * Nombre de colonnes de l'atlas, FIXE — c'est la définition même du système
 * « 8 directions », pas un paramètre. `Math.PI / 4` (45°) dans le calcul de
 * direction ci-dessous est dérivé de cette constante ; la changer casserait
 * la formule.
 */
export const BILLBOARD_COLUMNS = 8;

/**
 * Fraction du pic de flash considérée négligeable après la durée demandée à
 * `setFlash` : `k = -ln(fraction) / duration` (même idiome que
 * `SHAKE_NEGLIGIBLE_FRACTION` dans `fx.ts`). Durée elle-même passée par
 * l'appelant (`SuitConfig.hitFlashDuration`), tunable à chaud — historique du
 * passage d'une constante en dur à ce champ :
 * see: docs/reference/valeurs-ennemis.md#feedback-visuel-dun-coup-reçu-par-un-ennemi
 */
const FLASH_NEGLIGIBLE_FRACTION = 0.05;
/** Durée de repli si `setFlash` est appelée sans second argument (compat / tests) — mêmes 0.25 s que l'ancienne constante en dur. */
const DEFAULT_FLASH_DURATION = 0.25; // s
/** En dessous de ce seuil, on force le flash à exactement 0 (jamais atteint par une simple décroissance exponentielle). */
const FLASH_EPSILON = 1e-3;

export interface BillboardSpriteOptions {
  /** Nombre de lignes de l'atlas (frames/états d'animation). >= 1. Défaut 1 (pas d'animation). */
  rows?: number;
  /** Largeur du quad, en mètres. Défaut 1. */
  width?: number;
  /** Hauteur du quad, en mètres. Défaut 1.8 (gabarit humain approximatif). */
  height?: number;
  /**
   * Fraction de la hauteur SOUS `position.y` : 0 = `position` est le PIED du
   * sprite (le cas courant pour une entité au sol, la géométrie s'étend vers
   * le haut depuis `position`), 1 = `position` est le SOMMET, 0.5 = centre
   * (comportement par défaut natif d'un `PlaneGeometry`, sans translation).
   * Défaut 0 (pied). À choisir en cohérence avec ce que représente la
   * `position` que l'appelant interpole (voir la doc de tête) — si l'entité
   * interpole le CENTRE de sa capsule comme `PlayerController.position`,
   * passer 0.5 plutôt que 0.
   */
  verticalAnchor?: number;
  /** Seuil de coupure alpha. Défaut 0.5, valeur prescrite par le skill. */
  alphaTest?: number;
  /** Teinte multipliée avec l'atlas (`material.color`). Défaut blanc (0xffffff, aucune teinte). */
  color?: number;
}

const DEFAULT_ROWS = 1;
const DEFAULT_WIDTH = 1;
const DEFAULT_HEIGHT = 1.8;
const DEFAULT_VERTICAL_ANCHOR = 0;
const DEFAULT_ALPHA_TEST = 0.5;
const DEFAULT_COLOR = 0xffffff;

export class BillboardSprite {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;

  private readonly scene: THREE.Scene;
  /** Copie PROPRE à cette instance (piège de partage de texture, ADR 0017) — ne jamais la partager. */
  private readonly texture: THREE.Texture;
  private readonly rows: number;

  private flashIntensity = 0;
  /** Taux de décroissance courant, dérivé de la DERNIÈRE durée passée à `setFlash` (voir sa doc). */
  private flashDecayRate = -Math.log(FLASH_NEGLIGIBLE_FRACTION) / DEFAULT_FLASH_DURATION;
  /** Dernière direction (0-7) calculée par `updatePose`. Conservée telle quelle si le calcul devient dégénéré (voir plus bas), jamais réinitialisée à 0 arbitrairement. */
  private lastDirection = 0;

  // Scratch, zéro allocation en régime établi (même discipline que `scratchDir` dans `fx.ts`).
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

    // Géométrie PROPRE à cette instance (translation d'ancrage dépendante de
    // `width`/`height`/`anchor`, qui peuvent varier par instance) : un
    // `PlaneGeometry` par défaut est centré en (0,0), on le translate en Y
    // pour que `position.y` (posé dans `updatePose`) corresponde à la
    // fraction `anchor` de la hauteur depuis le bas.
    const geometry = new THREE.PlaneGeometry(width, height);
    geometry.translate(0, height * (0.5 - anchor), 0);

    const material = new THREE.MeshLambertMaterial({
      map: this.texture,
      color,
      alphaTest,
      transparent: false, // contrat du skill : écrit dans le depth buffer, pas de tri de profondeur entre sprites qui se chevauchent
      depthWrite: true,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
  }

  /**
   * Positionne, oriente (yaw-only) et sélectionne la case d'atlas (direction ×
   * `row`) pour la frame d'affichage courante. À appeler UNE FOIS PAR FRAME
   * D'AFFICHAGE, avec `position`/`forward` DÉJÀ INTERPOLÉS par l'appelant —
   * jamais avec des valeurs brutes du pas fixe.
   *
   * @param camera Caméra de rendu. Seule `camera.position` est lue — la
   *   ROTATION n'entre PAS dans le calcul (invariant #3, jamais interpolée ;
   *   le billboard n'a besoin que de la position pour viser).
   * @param position Position interpolée de l'entité, DANS LE MONDE.
   *   Interprétation verticale (pied/centre/sommet) : voir
   *   `BillboardSpriteOptions.verticalAnchor`.
   * @param forward Orientation interpolée, vecteur normalisé, `y` ignoré.
   *   Convention `direction = 0` = ennemi vu DE FACE (voir la doc de tête).
   * @param row Ligne de l'atlas (frame/état), 0-indexée. Défaut 0. Clampée à
   *   `[0, rows - 1]` (`rows` fixé au constructeur).
   */
  // see: docs/systems/rendu.md#sprites-billboard-8-directions
  updatePose(camera: THREE.Camera, position: THREE.Vector3, forward: THREE.Vector3, row = 0): void {
    this.mesh.position.copy(position);

    const dx = camera.position.x - position.x;
    const dz = camera.position.z - position.z;

    // 1. Billboard yaw-only : SEUL `rotation.y` est écrit, `rotation.x`/`z`
    // restent à 0 en permanence — c'est précisément ce qui empêche le sprite
    // de pencher quand le joueur regarde en haut/bas (contrairement à
    // `THREE.Sprite`, qui billboard sur les trois axes).
    this.mesh.rotation.y = Math.atan2(dx, dz);

    // 2. Sélection de direction (formule exacte du skill `billboard-sprites-8dir`) :
    // angle entre le forward de l'entité et le vecteur entité -> caméra,
    // tous deux aplatis sur le plan horizontal (Y=0) et normalisés.
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
    // Sinon (caméra ou forward dégénérés, longueur ~0 — caméra exactement à
    // la même position XZ que l'entité, ou entité sans orientation valide) :
    // on GARDE la dernière direction connue plutôt que de sauter à 0, pour
    // éviter un flash visible d'une case d'atlas arbitraire.

    const clampedRow = Math.max(0, Math.min(this.rows - 1, Math.floor(row)));
    // Mapping U : colonne 0 à gauche, croissant vers la droite (comme X).
    // Mapping V : ATTENTION, three.js flip l'axe V par défaut (v=0 = BAS de
    // l'image source) alors que `row = 0` doit sélectionner la ligne du HAUT.
    // see: docs/systems/rendu.md#sprites-billboard-8-directions
    this.texture.offset.set(this.lastDirection / BILLBOARD_COLUMNS, 1 - (clampedRow + 1) / this.rows);
  }

  /** Direction 0-7 sélectionnée au dernier `updatePose` — diagnostic/debug uniquement (ex. futur panneau de debug). */
  get direction(): number {
    return this.lastDirection;
  }

  /**
   * Change la teinte du sprite après construction (`material.color`),
   * MULTIPLIÉE avec les pixels de l'atlas au rendu — PAS un nouveau système
   * de shader (invariant #5, `MeshLambertMaterial` uniquement). Usage
   * introduit par le Directeur : bascule costume humain -> reptilien sous
   * un seuil de PV (`DirectorConfig.humanTintColor`/`revealedTintColor`,
   * `Director.tintColor`). Idempotente et bon marché, mais le pattern
   * attendu est de l'appeler UNE FOIS, au moment de l'événement de
   * transition — pas à chaque frame par défaut.
   * see: docs/systems/rendu.md#sprites-billboard-8-directions
   */
  setTint(color: number): void {
    this.mesh.material.color.set(color);
  }

  /**
   * Déclenche (ou renforce) le flash blanc de dégâts. `amount` dans [0, 1] :
   * 0 = aucun effet, 1 = blanc plein. PUREMENT COSMÉTIQUE — à appeler au
   * moment du dégât côté gameplay (pas fixe) ; la décroissance visuelle est
   * gérée en temps réel par `updateFlash`, jamais par le pas fixe. Pas de
   * sommation entre déclenchements qui se chevauchent (voir la doc de tête).
   *
   * @param durationSeconds Durée pour revenir à `FLASH_NEGLIGIBLE_FRACTION`
   *   du pic, typiquement `suitConfig.hitFlashDuration`, TUNABLE À CHAUD.
   *   Recalcule `flashDecayRate` à CHAQUE appel : un slider de durée changé
   *   pendant qu'un flash décroît déjà s'applique dès le prochain hit.
   *   Défaut `DEFAULT_FLASH_DURATION` si omis.
   */
  setFlash(amount: number, durationSeconds: number = DEFAULT_FLASH_DURATION): void {
    const safeDuration = Math.max(1e-3, durationSeconds);
    this.flashDecayRate = -Math.log(FLASH_NEGLIGIBLE_FRACTION) / safeDuration;
    this.flashIntensity = Math.max(this.flashIntensity, THREE.MathUtils.clamp(amount, 0, 1));
  }

  /**
   * Fait décroître le flash de dégâts en TEMPS RÉEL. À appeler UNE FOIS PAR
   * FRAME D'AFFICHAGE avec le delta temps réel (`game/loop/updateFx.ts`),
   * JAMAIS avec `FIXED_DT` du pas fixe de gameplay.
   */
  updateFlash(realDt: number): void {
    if (this.flashIntensity <= 0) return;

    this.flashIntensity *= Math.exp(-this.flashDecayRate * realDt);
    if (this.flashIntensity < FLASH_EPSILON) this.flashIntensity = 0;

    this.mesh.material.emissive.setScalar(this.flashIntensity);
  }

  /** Retire le mesh de la scène et libère géométrie/matériau/texture PROPRES à cette instance. N'affecte ni l'atlas partagé ni les autres instances. */
  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.texture.dispose();
  }
}

// Atlas placeholder — invariant #9 : aucun asset de sprite final n'existe
// encore, mais le système doit être testable sans lui. Format complet :
// see: docs/pipeline/textures.md#atlas-placeholder-de-billboard

const PLACEHOLDER_CELL_WIDTH = 32; // px, largement sous la limite 128×128/texture (invariant #4)
const PLACEHOLDER_CELL_HEIGHT = 48; // px, portrait — gabarit humanoïde approximatif
/** Padding transparent autour de chaque case : évite le bleeding d'atlas en `NearestFilter`. */
const PLACEHOLDER_PADDING = 1;

/** Génère un atlas placeholder `columns` × `rows` par canvas, configuré avec les réglages rétro (`configureRetroTexture`). */
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
