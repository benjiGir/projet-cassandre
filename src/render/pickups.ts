import * as THREE from "three";

import { assetUrl } from "../core/assetPath";
import { configureRetroTexture } from "./renderer";

/**
 * Ramassages posés au sol et pris en marchant dessus : trousse de soin
 * (`use_*` portant `soin`) et boîte de munitions (`munitions`). Même principe
 * que `dressWeaponPickup` : la boîte grise du `.glb` ne sert qu'à situer
 * l'objet, le vrai modèle est posé à sa place.
 *
 * La trousse porte une croix verte de PHARMACIE : la croix rouge est un
 * emblème protégé, la verte est celle de toutes les pharmacies françaises et
 * se lit aussi bien.
 */

/** Largeur, hauteur, profondeur, en mètres. Assez grosse pour se voir de loin à 640×360. */
const KIT_SIZE = { width: 0.5, height: 0.32, depth: 0.36 } as const;

/** Une trousse n'est pas un néon, mais doit rester visible dans le souterrain. */
const KIT_GLOW = 0.35;

/** Caisse de munitions : plus basse et plus large qu'une trousse, pour s'en distinguer d'un coup d'œil. */
const AMMO_SIZE = { width: 0.42, height: 0.22, depth: 0.3 } as const;

const CELL = 32;

interface ModeleRamassage {
  geometry: THREE.BoxGeometry;
  material: THREE.MeshLambertMaterial;
}

let shared: ModeleRamassage | null = null;
let sharedAmmo: ModeleRamassage | null = null;

function kitFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#b4b6b4";
  ctx.fillRect(0, 0, CELL, CELL);
  ctx.fillStyle = "#f2efe6";
  ctx.fillRect(2, 2, CELL - 4, CELL - 4);
  ctx.fillStyle = "#2e9e44";
  ctx.fillRect(12, 6, 8, 20);
  ctx.fillRect(6, 12, 20, 8);
  const texture = new THREE.CanvasTexture(canvas);
  configureRetroTexture(texture);
  return texture;
}

function sharedKit(): ModeleRamassage {
  if (!shared) {
    const map = kitFaceTexture();
    shared = {
      geometry: new THREE.BoxGeometry(KIT_SIZE.width, KIT_SIZE.height, KIT_SIZE.depth),
      material: new THREE.MeshLambertMaterial({
        map,
        emissive: 0xffffff,
        emissiveMap: map,
        emissiveIntensity: KIT_GLOW,
      }),
    };
    // Origine à la base : le modèle se pose directement sur le sol.
    shared.geometry.translate(0, KIT_SIZE.height / 2, 0);
  }
  return shared;
}

/** Face d'une caisse de munitions : olive, cerclée, avec trois balles peintes. */
function ammoFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#39412a";
  ctx.fillRect(0, 0, CELL, CELL);
  ctx.fillStyle = "#4d5836";
  ctx.fillRect(2, 2, CELL - 4, CELL - 4);
  ctx.fillStyle = "#111014";
  ctx.fillRect(0, 13, CELL, 3);
  ctx.fillStyle = "#f2c230"; // trois balles : le seul motif reconnaissable à 640×360
  for (const x of [8, 14, 20]) {
    ctx.fillRect(x, 20, 4, 7);
    ctx.fillRect(x, 18, 4, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  configureRetroTexture(texture);
  return texture;
}

function sharedAmmoBox(): ModeleRamassage {
  if (!sharedAmmo) {
    const map = ammoFaceTexture();
    sharedAmmo = {
      geometry: new THREE.BoxGeometry(AMMO_SIZE.width, AMMO_SIZE.height, AMMO_SIZE.depth),
      material: new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.2 }),
    };
    sharedAmmo.geometry.translate(0, AMMO_SIZE.height / 2, 0);
  }
  return sharedAmmo;
}

/** Pose `modele` à la place de la boîte `object`, sur `groundY` ou, à défaut, sur le bas de la boîte. */
function poser(object: THREE.Object3D, modele: ModeleRamassage, groundY: number | null): void {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());

  const mesh = object as THREE.Mesh;
  if (mesh.isMesh) mesh.material = HIDDEN_MATERIAL;

  const model = new THREE.Mesh(modele.geometry, modele.material);
  model.position.set(center.x, groundY ?? box.min.y, center.z);
  // De biais : une boîte vue pile de face se lit comme un panneau plat.
  model.rotation.y = Math.PI / 7;
  object.attach(model);
}

/** Trousse de soin (`use_*` portant `soin`). */
export function dressHealPickup(object: THREE.Object3D, groundY: number | null): void {
  poser(object, sharedKit(), groundY);
}

/** Boîte de munitions (`use_*` portant `munitions`). */
export function dressAmmoPickup(object: THREE.Object3D, groundY: number | null): void {
  poser(object, sharedAmmoBox(), groundY);
}

/** Matériau jamais dessiné, pour la boîte d'un ramassage habillé. */
const HIDDEN_MATERIAL = new THREE.MeshLambertMaterial({ visible: false });


/**
 * Armes au sol (`use_crowbar`/`use_pistol`/`use_shotgun`) — retour de
 * playtest du 2026-09-25 : « on les voit pas bien ». Une première passe
 * (billboard yaw-only, icône procédurale par canvas) a été vérifiée en jeu
 * et REFUSÉE : trait/virgule illisible (l'icône ne remplissait pas son
 * quad), disque d'ombre noir qui se lisait comme un trou dans le bitume de
 * nuit, pouls/flottement invisibles. Corrigé par une deuxième passe :
 *
 * 1. **Icône PRÉ-RENDUE depuis le vrai modèle** `world_*`
 *    (`tools/blender/render_weapon_pickups.py`, régénérable — voir sa doc de
 *    tête pour le pourquoi du cadrage à 45°) plutôt qu'un dessin canvas :
 *    c'est la même arme que celle tenue en main.
 * 2. **UV et taille de quad calés sur le cadrage réel de chaque icône**
 *    (`WEAPON_ICON_RECTS`, généré par le même script) — plus de padding
 *    transparent gaspillé, l'icône remplit tout son quad.
 * 3. **Disque au sol retiré** (option offerte par le retour de vérification :
 *    « retire-le, ou fais-en une lueur claire » — le retrait est plus sûr
 *    qu'une lueur mal réglée sur un sol qu'on ne connaît pas d'avance).
 * 4. **Émissif nettement relevé** (`WEAPON_GLOW_MIN`/`MAX`) et flottement
 *    plus ample (`WEAPON_BOB_AMPLITUDE`) : l'un et l'autre doivent se voir au
 *    parking de nuit, où le diffus (dépendant de l'éclairage de scène) est
 *    quasi nul — l'émissif, LUI, s'ajoute indépendamment des lumières
 *    (invariant #5, `MeshLambertMaterial`), c'est le seul levier qui marche
 *    dans le noir.
 *
 * Toujours billboard yaw-only (skill `billboard-sprites-8dir`, toujours face
 * à la caméra) : pas de rotation lente, un billboard qui pivote sur lui-même
 * ne montrerait jamais que sa face.
 */

export type PickupWeaponKind = "melee" | "pistol" | "shotgun";

/**
 * Généré par `tools/blender/render_weapon_pickups.py` — à resynchroniser
 * depuis `public/assets/sprites/weapon_pickups.json` si le script change
 * (aucun fetch JSON au runtime : le jeu doit rester synchrone au chargement
 * d'un niveau, voir la frontière Effect stricte, invariant #11).
 */
const WEAPON_ICON_ATLAS_URL = "assets/sprites/weapon_pickups.png";
const WEAPON_ICON_ATLAS_SIZE = { width: 159, height: 72 };
const WEAPON_ICON_RECTS: Record<PickupWeaponKind, { x: number; y: number; width: number; height: number }> = {
  melee: { x: 0, y: 0, width: 56, height: 56 },
  pistol: { x: 58, y: 0, width: 27, height: 27 },
  shotgun: { x: 87, y: 0, width: 72, height: 72 },
};

/**
 * Taille du billboard, en mètres (carré : le cadrage à 45° du générateur
 * donne exactement le même aspect pour les trois). PAS l'échelle réelle de
 * l'arme (0,58/0,28/0,75 m mesurés) : un pistolet à sa vraie taille se serait
 * relu comme un pixel à 10 m (même défaut que la version à plat). Choix de
 * lisibilité, comme les ramassages de Duke 3D/Doom — dont les icônes ne
 * respectent pas non plus l'échelle relative des armes. Revus à la hausse
 * après vérification en jeu : à 0,5 m, le pistolet n'était qu'une tache grise
 * sur le terrazzo à 6 m, et le pompe un trait à 8 m.
 */
const WEAPON_SPRITE_SIZE: Record<PickupWeaponKind, number> = {
  melee: 0.8,
  pistol: 0.8,
  shotgun: 1.1,
};

const WEAPON_BOB_AMPLITUDE = 0.08; // m — relevé (0,05 -> 0,08) : invisible à distance sinon, retour de vérification
const WEAPON_BOB_SPEED = 2.1; // rad/s
/**
 * Pouls d'émissive. Mesuré nécessaire, pas décoratif : au parking de nuit
 * (`niveau_v2`), le canal DIFFUS d'un `MeshLambertMaterial` dépend de
 * l'éclairage de scène et y tombe quasi à zéro — seul l'émissif reste
 * visible, il doit donc porter la lisibilité à lui seul. Relevé de 0,18-0,6
 * (invisible de nuit, retour de vérification) à 0,55-1,3.
 */
const WEAPON_GLOW_MIN = 0.55;
const WEAPON_GLOW_MAX = 1.3;
const WEAPON_GLOW_SPEED = 1.4; // rad/s, déphasé du bob : ne se lit pas comme un clignotement mécanique

/**
 * Atlas partagé, chargé UNE FOIS. `THREE.TextureLoader.load` renvoie la
 * `Texture` immédiatement (image encore vide) et la peuple en tâche de fond —
 * exactement le comportement qu'il faut ici : `dressWeaponPickup` tourne
 * SYNCHRONE, dans le chargement de niveau (invariant #11), et ne peut pas
 * attendre un fetch. Le billboard apparaît donc d'abord transparent
 * (`alphaTest` coupe tout en dessous du seuil) puis se peuple dès que l'image
 * arrive — un pop-in d'une fraction de seconde, pas un flash de mauvaise
 * texture.
 */
let sharedWeaponAtlas: THREE.Texture | null = null;
let sharedWeaponSpriteMaterial: THREE.MeshLambertMaterial | null = null;
const sharedWeaponSpriteGeometries = new Map<PickupWeaponKind, THREE.PlaneGeometry>();

function weaponIconAtlas(): THREE.Texture {
  if (sharedWeaponAtlas) return sharedWeaponAtlas;
  // `configureRetroTexture` force `needsUpdate = true` : appelée avant que
  // l'image n'arrive, elle fait tenter à `WebGLRenderer` un upload sans
  // données (avertissement bruyant en console, vu en vérifiant cette passe).
  // `TextureLoader` pose déjà `needsUpdate` lui-même à la fin du chargement —
  // configurer le filtrage dans `onLoad` évite tout upload prématuré.
  const texture = new THREE.TextureLoader().load(assetUrl(WEAPON_ICON_ATLAS_URL), () =>
    configureRetroTexture(texture),
  );
  sharedWeaponAtlas = texture;
  return texture;
}

function weaponSpriteMaterial(): THREE.MeshLambertMaterial {
  if (!sharedWeaponSpriteMaterial) {
    const atlas = weaponIconAtlas();
    sharedWeaponSpriteMaterial = new THREE.MeshLambertMaterial({
      map: atlas,
      emissive: 0xffffff,
      emissiveMap: atlas,
      emissiveIntensity: WEAPON_GLOW_MIN,
      alphaTest: 0.5,
      transparent: false, // contrat du skill : écrit dans le depth buffer, pas de tri de profondeur
      depthWrite: true,
    });
  }
  return sharedWeaponSpriteMaterial;
}

/** UV de coin par défaut d'un `PlaneGeometry` : 0 ou 1 exactement (pas d'interpolation à corriger, un seul segment par axe). */
function bakeIconRectUv(geometry: THREE.PlaneGeometry, rect: { x: number; y: number; width: number; height: number }): void {
  const u0 = rect.x / WEAPON_ICON_ATLAS_SIZE.width;
  const u1 = (rect.x + rect.width) / WEAPON_ICON_ATLAS_SIZE.width;
  // V inversé (three.js `flipY` par défaut, v=0 = BAS de l'image source) —
  // même convention que `billboard.ts`, voir sa doc.
  const v1 = 1 - rect.y / WEAPON_ICON_ATLAS_SIZE.height;
  const v0 = 1 - (rect.y + rect.height) / WEAPON_ICON_ATLAS_SIZE.height;
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) < 0.5 ? u0 : u1, uv.getY(i) < 0.5 ? v0 : v1);
  }
  uv.needsUpdate = true;
}

/** Géométrie de sprite pour `weapon` : carrée (`WEAPON_SPRITE_SIZE`), UV figés sur son rectangle de l'atlas — une par arme, jamais reconstruite. */
function weaponSpriteGeometry(weapon: PickupWeaponKind): THREE.PlaneGeometry {
  const cached = sharedWeaponSpriteGeometries.get(weapon);
  if (cached) return cached;
  const size = WEAPON_SPRITE_SIZE[weapon];
  const geometry = new THREE.PlaneGeometry(size, size);
  bakeIconRectUv(geometry, WEAPON_ICON_RECTS[weapon]);
  sharedWeaponSpriteGeometries.set(weapon, geometry);
  return geometry;
}

/**
 * Horloge cosmétique PARTAGÉE des trois pickups (le matériau de sprite EST
 * partagé — voir la doc de tête ci-dessus, § singleton — `emissiveIntensity`
 * est une propriété du matériau, pas du mesh : un pouls PAR INSTANCE y est
 * impossible sans cloner, ce qu'on refuse ici, `loader.ts::disposeLevelResource`
 * disposerait le clone d'un pickup sous les pieds des deux autres au premier
 * hot reload). Avancée UNE FOIS par frame d'affichage depuis `updateFx`,
 * jamais par `WeaponPickupBillboard.update` (qui tourne une fois par
 * pickup) : avancer deux fois doublerait la vitesse dès qu'il y a plus d'un
 * pickup.
 */
let weaponPickupClock = 0;

export function advanceWeaponPickupClock(realDt: number): void {
  weaponPickupClock += realDt;
  if (!sharedWeaponSpriteMaterial) return; // aucun pickup dressé cette partie : rien à faire tourner
  sharedWeaponSpriteMaterial.emissiveIntensity =
    WEAPON_GLOW_MIN + (WEAPON_GLOW_MAX - WEAPON_GLOW_MIN) * (0.5 + 0.5 * Math.sin(weaponPickupClock * WEAPON_GLOW_SPEED));
}

/**
 * Billboard d'une arme au sol : icône dressée (yaw-only, toujours face
 * caméra). `update` est TEMPS RÉEL (`updateFx`, jamais le pas fixe) :
 * flottement vertical purement cosmétique (le pouls d'émissive est géré
 * globalement par `advanceWeaponPickupClock`, voir sa doc).
 */
export class WeaponPickupBillboard {
  readonly spriteMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;

  /** Position LOCALE de repos (sans flottement), capturée après `attachTo` — voir sa doc. */
  private baseLocalY = 0;
  /** Déphasage du flottement, déterministe (dérivé de la position, PAS du RNG — purement cosmétique, hors invariant #12) : les trois pickups ne flottent pas en phase. */
  private readonly bobPhase: number;
  private readonly scratchWorldPos = new THREE.Vector3();

  constructor(weapon: PickupWeaponKind, worldPosition: THREE.Vector3) {
    this.spriteMesh = new THREE.Mesh(weaponSpriteGeometry(weapon), weaponSpriteMaterial());
    // Position MONDE, posée avant tout rattachement — `attachTo` la convertit
    // en repère local et capture `baseLocalY` à ce moment-là, jamais ici.
    this.spriteMesh.position.set(worldPosition.x, worldPosition.y + WEAPON_SPRITE_SIZE[weapon] / 2, worldPosition.z);

    this.bobPhase = ((worldPosition.x * 12.9898 + worldPosition.z * 78.233) % 1) * Math.PI * 2;
  }

  /**
   * Rattache le mesh (encore hors scène, position MONDE posée au
   * constructeur) sous `parent`, comme `poser()` ci-dessus le fait pour les
   * autres ramassages — même précédent shippé. Capture `baseLocalY` APRÈS le
   * rattachement : `Object3D.attach` convertit la position en repère local,
   * la capturer avant aurait figé la valeur MONDE, fausse dès que `parent`
   * n'est pas à l'origine (bob désaxé — piège trouvé en écrivant ce fichier).
   */
  attachTo(parent: THREE.Object3D): void {
    parent.attach(this.spriteMesh);
    this.baseLocalY = this.spriteMesh.position.y;
  }

  /** À appeler une fois par frame d'affichage (`updateFx`), APRÈS `advanceWeaponPickupClock`. */
  update(camera: THREE.Camera): void {
    const bob = Math.sin(weaponPickupClock * WEAPON_BOB_SPEED + this.bobPhase) * WEAPON_BOB_AMPLITUDE;
    this.spriteMesh.position.y = this.baseLocalY + bob;

    // Billboard yaw-only (skill `billboard-sprites-8dir`) : seul `rotation.y`
    // change. Position MONDE lue via `getWorldPosition` — `spriteMesh.position`
    // est LOCAL (enfant du `use_*`), une simple soustraction contre
    // `camera.position` (MONDE) donnerait un cap faux dès que le parent n'est
    // pas à l'origine.
    this.spriteMesh.getWorldPosition(this.scratchWorldPos);
    const dx = camera.position.x - this.scratchWorldPos.x;
    const dz = camera.position.z - this.scratchWorldPos.z;
    this.spriteMesh.rotation.y = Math.atan2(dx, dz);
  }
}

/**
 * Remplace la boîte d'un `use_crowbar`/`use_pistol`/`use_shotgun` par un
 * billboard dressé (voir la doc de tête ci-dessus). Le mesh devient enfant de
 * `object` : le ramassage, qui cache l'objet (`visible = false`), le cache
 * avec, et l'élagage par distance (`render/useObjectCulling.ts`) s'applique
 * automatiquement — rien à câbler en plus pour la visibilité.
 *
 * @param groundY Hauteur de la surface sous la boîte (les boîtes `use_*`
 *   flottent souvent au-dessus du sol) ; à défaut, le dessous de la boîte.
 */
export function dressWeaponPickup(
  object: THREE.Object3D,
  weapon: PickupWeaponKind,
  groundY: number | null,
): WeaponPickupBillboard {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());

  const mesh = object as THREE.Mesh;
  if (mesh.isMesh) mesh.material = HIDDEN_MATERIAL;

  const billboard = new WeaponPickupBillboard(weapon, new THREE.Vector3(center.x, groundY ?? box.min.y, center.z));
  billboard.attachTo(object);
  return billboard;
}
