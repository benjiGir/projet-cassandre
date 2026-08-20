import * as THREE from "three";

import { configureRetroTexture } from "./renderer";

/**
 * Sprites billboard 8 directions (skill `billboard-sprites-8dir`) : un
 * `PlaneGeometry` par entité, orienté yaw-only vers la caméra, échantillonnant
 * un atlas 8 colonnes (directions) × N lignes (frames/états). Remplace
 * `THREE.Sprite`, qui billboard sur les trois axes et fait pencher l'ennemi
 * quand le joueur regarde en l'air ou vers le sol.
 *
 * DÉCOUPLAGE DÉLIBÉRÉ, même discipline que `render/fx.ts` vis-à-vis de
 * `game/player/weapons.ts` (voir sa doc de tête) : ce module n'importe RIEN de
 * `game/entities/*` ni `game/player/*`, uniquement des primitives Three.js
 * (`THREE.Vector3`, `THREE.Camera`, `THREE.Texture`, `number`). Le futur
 * `game/entities/*` (Costard) fait le pont en lisant sa propre position/
 * orientation interpolées et en les poussant dans `updatePose`.
 *
 * CONTRAT D'INTERPOLATION, même pattern que `Viewmodel.update(alpha, weapons)`
 * et `PlayerController.eyePosition(alpha, out)` : `updatePose` ne fait AUCUNE
 * interpolation elle-même. L'appelant doit lui passer une position et un
 * forward DÉJÀ interpolés pour la frame d'affichage courante (typiquement en
 * gardant `previousPosition`/`position` sur l'entité et en appelant
 * `out.lerpVectors(previousPosition, position, alpha)` avant d'appeler
 * `updatePose`, exactement comme `eyePosition`). Passer des grandeurs du pas
 * fixe brut (non interpolées) fait trembler le sprite au ralenti dès que le
 * framerate d'affichage dépasse 60 Hz.
 *
 * TEMPS RÉEL VS PAS FIXE : `updatePose` (position/orientation/frame) est
 * appelée à CHAQUE FRAME D'AFFICHAGE avec des grandeurs interpolées, alors que
 * `updateFlash(realDt)` fait décroître le flash de dégâts en temps réel — même
 * séparation que `interpolateVisuals`/`updateFx` dans `main.ts`, ou que
 * `triggerShake`/`update(realDt)` dans `fx.ts`. Ce sont deux appels DISTINCTS
 * par frame d'affichage, jamais un seul `update()` fourre-tout : les grandeurs
 * qu'ils consomment (alpha d'interpolation vs delta temps réel) n'ont pas la
 * même nature.
 *
 * LE PIÈGE DU PARTAGE DE TEXTURE — lu et évité ICI, pas après coup : muter
 * `material.map.offset`/`.repeat` pour sélectionner une case d'atlas est la
 * technique standard, mais si plusieurs `BillboardSprite` PARTAGENT le même
 * objet `THREE.Texture` (ex. un seul atlas chargé une fois pour ~20 Costards),
 * muter `.offset` sur l'une désynchronise TOUTES les autres qui l'utilisent :
 * elles partagent le même objet, donc le même offset — au rendu, tous les
 * sprites affichent la case du DERNIER `updatePose` appelé cette frame. Bug
 * classique, quasi invisible à l'œil au premier essai (un seul sprite dans la
 * scène ne le révèle jamais).
 *
 * CHOIX RETENU ICI : option (a) du plan — chaque `BillboardSprite` clone
 * l'atlas passé au constructeur (`atlas.clone()`, `needsUpdate = true`) et ne
 * mute plus jamais que le `.offset`/`.repeat` de SA PROPRE copie. L'image
 * bitmap sous-jacente (`texture.image`, le canvas/bitmap décodé) reste
 * partagée par référence entre tous les clones — trois.js ne redécode ni ne
 * dédouble les pixels sources, seul l'objet `THREE.Texture` (filtre, offset,
 * repeat, sa propre resource GPU) est dupliqué. Coût par instance : un objet
 * JS léger + une texture GPU indépendante (mêmes pixels), pas une image. Pour
 * ~20 Costards simultanés (budget du skill), ce coût est négligeable et évite
 * totalement la classe de bug ci-dessus — préféré à l'option (b) (UV par
 * géométrie, atlas totalement partagé) qui est plus économe en mémoire GPU
 * mais interdit tout matériau partagé entre instances de toute façon (chaque
 * instance a déjà besoin de sa propre géométrie pour ses propres UV), donc
 * n'apporte pas d'économie réelle ici vu qu'on alloue déjà une géométrie par
 * instance (pour la taille/l'ancrage vertical, voir plus bas).
 */

/**
 * Nombre de colonnes de l'atlas, FIXE — c'est la définition même du système
 * « 8 directions », pas un paramètre. `Math.PI / 4` (45°) dans le calcul de
 * direction ci-dessous est dérivé de cette constante ; la changer casserait
 * la formule.
 */
export const BILLBOARD_COLUMNS = 8;

/**
 * Fraction du pic de flash considérée comme négligeable après la durée
 * demandée à `setFlash` — même idiome que `SHAKE_NEGLIGIBLE_FRACTION` dans
 * `fx.ts` : `k = -ln(fraction) / duration`. Forme de la courbe UNIQUEMENT :
 * la durée elle-même est un paramètre de `setFlash` (voir sa doc), passée par
 * l'appelant depuis `SuitConfig.hitFlashDuration` — retour playtest Phase 3 :
 * cette durée était figée en dur ici, donc pas tunable à chaud ni exposée au
 * panneau de debug, en violation du mandat du skill `game-feel-tuning`.
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
  /** Copie PROPRE à cette instance — voir « LE PIÈGE DU PARTAGE DE TEXTURE » en tête de fichier. Ne jamais la partager. */
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

    // Géométrie PROPRE à cette instance (pas de partage) : la translation
    // d'ancrage ci-dessous est appliquée en dur sur les vertices, elle
    // dépend de `width`/`height`/`anchor` qui peuvent varier par instance
    // (une future entité plus grande que le Costard standard, par exemple).
    // PlaneGeometry par défaut : plan dans le repère XY, normale +Z, centré
    // en (0,0) — [-w/2, w/2] x [-h/2, h/2]. On le translate en Y pour que
    // `position.y` (posé dans `updatePose`) corresponde à la fraction
    // `anchor` de la hauteur depuis le bas.
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
   * D'AFFICHAGE, avec `position`/`forward` DÉJÀ INTERPOLÉS par l'appelant
   * (voir la doc de tête) — jamais avec des valeurs brutes du pas fixe.
   *
   * @param camera Caméra de rendu. Seule `camera.position` est lue (déjà
   *   posée par l'appelant, typiquement via `PlayerController.eyePosition`) —
   *   la ROTATION de la caméra n'entre PAS dans le calcul (invariant #3, la
   *   rotation caméra n'est jamais interpolée ; le billboard, lui, n'a besoin
   *   que de la position pour viser).
   * @param position Position interpolée de l'entité, DANS LE MONDE. Son
   *   interprétation verticale (pied/centre/sommet) dépend de
   *   `BillboardSpriteOptions.verticalAnchor` passé au constructeur.
   * @param forward Orientation interpolée de l'entité, vecteur normalisé,
   *   `y` ignoré (aplati sur le plan horizontal en interne). Convention
   *   DOCUMENTÉE : `direction = 0` correspond à l'ennemi vu DE FACE (le
   *   joueur regarde `forward` droit dans les yeux). Un décalage de
   *   convention ici se traduit par un décalage de 4 cases dans l'atlas —
   *   erreur classique et difficile à repérer à l'œil (voir le skill
   *   `billboard-sprites-8dir`) : si les sprites semblent tous « à l'envers »,
   *   vérifier en premier que `forward` pointe bien dans le sens où
   *   l'entité regarde, pas dans le sens opposé.
   * @param row Ligne de l'atlas (frame/état), 0-indexée. Défaut 0. Clampée à
   *   `[0, rows - 1]` (`rows` fixé au constructeur).
   */
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
    // Mapping U : colonne 0 à gauche de l'atlas, croissant vers la droite —
    // pas de subtilité, U croît dans le même sens que X sur le canvas source.
    // Mapping V : ATTENTION, three.js flip l'axe V par défaut
    // (`texture.flipY = true`) — v=0 correspond au BAS de l'image source,
    // v=1 à son HAUT. `createPlaceholderAtlas` (et toute image standard)
    // dessine la ligne 0 en HAUT du canvas ; pour que `row = 0` sélectionne
    // bien cette ligne, son offset V doit donc être `1 - 1/rows`, pas 0.
    this.texture.offset.set(this.lastDirection / BILLBOARD_COLUMNS, 1 - (clampedRow + 1) / this.rows);
  }

  /** Direction 0-7 sélectionnée au dernier `updatePose` — diagnostic/debug uniquement (ex. futur panneau de debug). */
  get direction(): number {
    return this.lastDirection;
  }

  /**
   * Déclenche (ou renforce) le flash blanc de dégâts. `amount` dans [0, 1] :
   * 0 = aucun effet, 1 = blanc plein. PUREMENT COSMÉTIQUE — à appeler au
   * moment du dégât côté gameplay (pas fixe), la décroissance visuelle est
   * gérée en temps réel par `updateFlash`, jamais par le pas fixe (même
   * séparation que `FxSystem.triggerShake`/`update(realDt)`).
   *
   * Comme `triggerShake` : PAS de sommation. Si un flash est déjà en cours,
   * on prend le MAX de l'intensité courante (déjà partiellement décroissante)
   * et de `amount` — plusieurs plombs de pompe touchant la même entité dans
   * le même pas fixe ne doivent pas empiler un flash plus qu'blanc que blanc.
   *
   * @param durationSeconds Durée pour revenir à `FLASH_NEGLIGIBLE_FRACTION`
   *   du pic, en secondes — typiquement `suitConfig.hitFlashDuration`,
   *   TUNABLE À CHAUD par l'appelant (console/panneau de debug). Recalcule
   *   `flashDecayRate` à CHAQUE appel : un slider de durée changé pendant
   *   qu'un flash est déjà en cours de décroissance s'applique donc dès le
   *   prochain hit, jamais seulement au prochain chargement de module.
   *   Défaut `DEFAULT_FLASH_DURATION` (0.25 s, ancienne valeur en dur) si
   *   omis.
   */
  setFlash(amount: number, durationSeconds: number = DEFAULT_FLASH_DURATION): void {
    const safeDuration = Math.max(1e-3, durationSeconds);
    this.flashDecayRate = -Math.log(FLASH_NEGLIGIBLE_FRACTION) / safeDuration;
    this.flashIntensity = Math.max(this.flashIntensity, THREE.MathUtils.clamp(amount, 0, 1));
  }

  /**
   * Fait décroître le flash de dégâts en TEMPS RÉEL. À appeler UNE FOIS PAR
   * FRAME D'AFFICHAGE avec le delta temps réel (même hook que
   * `FxSystem.update(realDt)` dans `updateFx` de `main.ts`) — JAMAIS avec
   * `FIXED_DT` du pas fixe de gameplay.
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

// ---------------------------------------------------------------------------
// Atlas placeholder — invariant #9 (boîtes blanches jusqu'à la Phase 5) :
// aucun asset de sprite final n'existe encore, mais le système DOIT être
// testable. Génère une mosaïque de diagnostic (recommandée par le skill) :
// une couleur distincte par colonne (direction), un numéro de colonne ET de
// ligne lisible dans chaque case, pour vérifier à l'œil que la sélection
// direction/frame est correctement câblée sans attendre l'art final.
// ---------------------------------------------------------------------------

const PLACEHOLDER_CELL_WIDTH = 32; // px, garde chaque case (et donc l'atlas) largement sous la limite 128×128/texture de l'invariant #4/skill
const PLACEHOLDER_CELL_HEIGHT = 48; // px, portrait — gabarit humanoïde approximatif
/** Padding transparent autour de chaque case (recommandé par le skill : évite le bleeding d'atlas en `NearestFilter`, même sans mipmaps, à cause de l'imprécision flottante sur les UV proches d'une frontière de case). */
const PLACEHOLDER_PADDING = 1;

/**
 * Génère un atlas placeholder `columns` × `rows` par canvas, configuré avec
 * les réglages rétro (`NearestFilter`, pas de mipmaps, `SRGBColorSpace` — voir
 * `configureRetroTexture` dans `render/renderer.ts`, réutilisé tel quel ici
 * pour rester cohérent avec le reste du moteur).
 *
 * Chaque case affiche : un fond teinté par COLONNE (hue tournant sur 360°/
 * `columns`, donc la case `direction = 0` a toujours la même teinte
 * reconnaissable d'un atlas à l'autre) et le couple `"col.row"` en texte —
 * le moyen le plus direct de vérifier à l'œil qu'une case donnée correspond
 * bien à la direction/frame attendue, sans avoir à mémoriser une convention
 * de flèche.
 */
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
