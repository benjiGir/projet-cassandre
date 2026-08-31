import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Effect, Exit, Schema, Scope } from "effect";

import { COLLISION_GROUPS, type PhysicsWorld } from "../../physics/world";
import { GameRuntime } from "../../core/runtime";

/**
 * Pipeline de niveau glTF (Phase 4) — voir le skill `gltf-level-conventions`
 * pour le contrat complet. Ce fichier est le SEUL endroit qui connaît la
 * correspondance entre un préfixe de nom Blender et son effet en jeu.
 *
 * ## Le contrat de nommage (résumé, voir CLAUDE.md pour la table complète)
 *
 * | Préfixe          | Effet                                              |
 * |-------------------|-----------------------------------------------------|
 * | `col_box_*`       | collider CUBOID statique, mesh invisible            |
 * | `col_hull_*`      | collider CONVEX HULL statique, mesh invisible       |
 * | `col_mesh_*`      | collider TRIMESH statique (dernier recours), invisible|
 * | `col_*` (nu)      | rétrocompat : trimesh, sauf boîte détectée → cuboid |
 * | `spawn_player`    | position + orientation de départ (Empty)            |
 * | `spawn_suit_*`    | point d'apparition Costard (Empty)                  |
 * | `spawn_director_*`| point d'apparition Directeur, boss unique (Empty)   |
 * | `trig_*`          | volume de trigger box, sensor Rapier, mesh invisible|
 * | `door_*`          | porte animée, collider dynamique                    |
 * | `use_*`           | objet interactif, portée 2 m                        |
 * | `secret_*`        | zone comptée dans le compteur de secrets            |
 *
 * Voir le skill `collision-proxy-authoring` pour la hiérarchie de choix des
 * proxies (`cuboid` en tête — un niveau d'hypermarché est ~95 % de boîtes,
 * `trimesh` en dernier recours seulement). Les sous-préfixes `col_box_*`/
 * `col_hull_*`/`col_mesh_*` sont testés AVANT le `col_*` générique dans le
 * traverse principal : un sous-préfixe est aussi un `col_*` valide
 * (`"col_box_test".startsWith("col_")`), l'ordre de test évite un mauvais
 * routage silencieux.
 *
 * Un mesh SANS préfixe reconnu est rendu tel quel, SANS collider,
 * SILENCIEUSEMENT — c'est le comportement par défaut voulu (le décor non
 * collidable est la majorité des objets d'un niveau ; un warning par mesh
 * rendrait la console inutilisable). Ne JAMAIS ajouter de `console.*` dans la
 * branche par défaut ci-dessous.
 *
 * En revanche, les avertissements suivants sont BRUYANTS (`console.error`,
 * jamais un `console.warn` discret — décision explicite du skill) :
 *   - `col_*` sans géométrie valide ou 0 triangle ;
 *   - `col_*` dépassant `MAX_COLLIDER_TRIANGLES` triangles (mesh oublié en
 *     high-poly — le collider est quand même créé, c'est un diagnostic, pas
 *     un blocage) ;
 *   - `spawn_player` absent ou en double ;
 *   - `trig_*` dont la géométrie n'est pas une box ;
 *   - `use_*` sans cible référencée dans ses `extras` (`userData.target`) ;
 *   - `col_hull_*` dont le hull convexe est dégénéré (`RAPIER.ColliderDesc
 *     .convexHull` retourne `null`) — repli sur trimesh pour ce mesh, jamais
 *     de collider manquant silencieusement.
 *
 * ## Le piège des transforms (documenté par le skill, à ne pas re-découvrir)
 *
 * Un mesh `col_*`/`trig_*` peut être imbriqué n'importe où dans la hiérarchie
 * Blender (collections, empties parents...). Extraire `geometry.attributes
 * .position` SANS appliquer `mesh.matrixWorld` donne des colliders qui
 * matchent la géométrie LOCALE, décalée d'un offset constant par rapport au
 * mesh rendu dès que le mesh a un parent non identité. La séquence correcte,
 * appliquée uniformément ici via `worldSpaceGeometry` :
 *   1. `root.updateWorldMatrix(true, true)` UNE FOIS avant toute lecture de
 *      `matrixWorld` (fait au tout début de `buildLevelFromGltf`, couvre tout
 *      le sous-arbre en un seul passage — équivalent au `obj.updateWorldMatrix
 *      (true, false)` par-objet du skill, juste amorti sur toute la scène) ;
 *   2. cloner la géométrie et lui appliquer `matrixWorld` AVANT de la passer
 *      à Rapier.
 *
 * ## Invariant #5 — MeshLambertMaterial exclusif (NON NÉGOCIABLE)
 *
 * `GLTFLoader` matérialise CHAQUE primitive glTF en `MeshStandardMaterial`
 * (le modèle PBR metallic-roughness est natif au format). Importer un niveau
 * tel quel viole donc silencieusement l'invariant #5 du projet — le look
 * "Build engine" du jeu vient précisément de l'ABSENCE de spécularité. Ce
 * fichier reconvertit donc CHAQUE mesh importé (pas seulement les `col_*`,
 * qui de toute façon ne sont jamais rendus visibles) en `MeshLambertMaterial`
 * via `convertToLambert`, en ne gardant que couleur de base + texture diffuse
 * (`map`) et en jetant roughness/metalness/normalMap/etc. L'invariant #4
 * (`NearestFilter`, pas de mipmaps) est appliqué à toute texture survivante.
 *
 * SI CE FICHIER EST RETOUCHÉ PLUS TARD : ne retire jamais cet appel. L'erreur
 * qui en résulterait est silencieuse (le niveau importé "a l'air" normal en
 * dev, juste avec des reflets spéculaires qui ne devraient jamais exister à
 * l'écran dans ce projet).
 *
 * ## Vertex colors (`COLOR_0`) — éclairage de secteur baké
 *
 * Voir le skill `vertex-color-sector-lighting`. `GLTFLoader` mappe l'attribut
 * glTF `COLOR_0` sur l'attribut de géométrie Three.js `"color"` et positionne
 * lui-même `vertexColors = true` sur le `MeshStandardMaterial` qu'il
 * construit — un flag que `convertToLambert`/`toLambert` doivent relire et
 * reporter sur le `MeshLambertMaterial` de remplacement, sous peine de le
 * perdre silencieusement (le mesh resterait éclairé de façon plate). Le
 * colorspace linéaire de `COLOR_0` est déjà géré en interne par `GLTFLoader`,
 * rien à faire de plus ici.
 *
 * ## Jalon M2 (PLAN_EFFECT_XSTATE.md) — retrofit Effect
 *
 * Les 7 cas de dégradation ci-dessus (les 6 premiers + le hull dégénéré) sont
 * désormais modélisés comme des `Schema.TaggedError` (section "Erreurs
 * typées" plus bas), pour que leur existence et leurs champs soient vérifiés
 * par le compilateur plutôt que déduits d'un `console.error` en texte libre.
 * **Patron choisi et appliqué UNIFORMÉMENT aux 7 cas** (voir le "point de
 * vigilance" de PLAN_EFFECT_XSTATE.md §4) : chaque cas est un `Effect.fail`
 * (ou un `return yield* new XError(...)` équivalent, idiome documenté par
 * `node_modules/effect/AGENTS.md`) IMMÉDIATEMENT rattrapé via
 * `Effect.catch`/`Effect.catchTags` au point même de sa détection — jamais
 * laissé remonter au-delà de la fonction qui l'a détecté. Conséquence
 * assumée : le type d'erreur RÉEL de `buildLevelFromGltf`/
 * `buildLevelFromGltfEffect` est `never` (toujours un succès, aucun de ces 7
 * cas n'est bloquant pour la construction du niveau, exactement comme avant
 * cette migration) — les 7 classes d'erreur existent pour la documentation
 * de compilation, la testabilité en isolation (chaque fonction "brute" est
 * testée séparément de sa version "récupérée"), et pour permettre à un futur
 * appelant de choisir une politique différente s'il le souhaite, PAS parce
 * qu'elles se propagent réellement dans ce fichier. Seule vraie erreur qui
 * traverse une frontière publique : `LevelFetchError`, sur `loadLevel` (échec
 * réseau/parsing, un cas qui N'A JAMAIS été un "warning" — `loadLevel` a
 * toujours propagé cette erreur brute avant cette migration, voir plus bas).
 *
 * **Cycle de vie de `LevelHandle`** : `Effect.acquireRelease`/`Scope`
 * remplacent le flag `disposed` manuel — voir `disposeLevelResource`,
 * `acquireLevelResourceEffect`, et `toLevelHandle`. `Scope.close` est
 * garanti idempotent par la bibliothèque elle-même (`scopeCloseUnsafe`
 * retourne immédiatement si l'état est déjà `"Closed"`, voir
 * `node_modules/effect/src/internal/effect.ts`) : plus besoin de dupliquer
 * cette garantie à la main, `LevelHandle.dispose()` peut être appelée
 * plusieurs fois sans second effet par CONSTRUCTION du type, pas par
 * discipline de code.
 *
 * **Frontière Effect→Promise/plain-JS** : `buildLevelFromGltf`/`loadLevel`
 * gardent EXACTEMENT leur signature d'avant (fonction synchrone qui retourne
 * `LevelHandle`, fonction async qui retourne `Promise<LevelHandle>`) —
 * `main.ts` ne change pas d'une ligne. En interne, les deux sont de fins
 * appels à `GameRuntime.runSync`/`GameRuntime.runPromise` (racine de
 * composition posée en M1, `src/core/runtime.ts`) sur un Effect exporté à
 * côté (`buildLevelFromGltfEffect`/`loadLevelEffect`) — ce module n'a besoin
 * d'aucun service de `GameLayer` (pas de PRNG ici), mais réutilise quand même
 * `GameRuntime` plutôt que de créer une deuxième notion de runtime
 * concurrente, comme demandé par le plan. Les deux variantes `*Effect` sont
 * exportées en plus de la façade, UNIQUEMENT pour que les tests puissent
 * vérifier le comportement Effect directement (`@effect/vitest`) sans
 * dépendre de `console.error` comme unique point d'observation — `main.ts`
 * ne les importe jamais et ignore leur existence.
 */

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export interface SpawnPoint {
  /** Position MONDE. Convention : l'origine de l'Empty Blender représente les
   * PIEDS du joueur (le sol), pas les yeux — même convention que `gym.spawn`
   * consommée par `player.spawn(x, feetY, z)` dans `main.ts`. Si le pipeline
   * Blender de l'utilisateur place ses Empties `spawn_player` au niveau des
   * yeux plutôt qu'au sol, cette convention doit être ajustée ICI (un seul
   * endroit) plutôt que dans chaque appelant. */
  position: THREE.Vector3;
  /** Yaw, radians. Convention `main.ts`/`gym.ts` (Euler 'YXZ') : yaw=0 -> avant = -Z. */
  yaw: number;
}

export interface NamedSpawn {
  name: string;
  /** Position MONDE, pieds (même convention que `SpawnPoint.position`). */
  position: THREE.Vector3;
}

export interface TriggerVolume {
  name: string;
  object: THREE.Object3D;
  /** Coin min/max de la box en espace MONDE (rotation ignorée pour ce résumé
   * — suffisant pour un compteur de debug ou un futur `interactive.ts` qui
   * testerait une position simple ; la vraie forme physique, elle, est un
   * cuboid ORIENTÉ posé sur le corps Rapier créé en parallèle). */
  min: THREE.Vector3;
  max: THREE.Vector3;
  extras: Record<string, unknown>;
}

export interface DoorInfo {
  name: string;
  object: THREE.Object3D;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  /** Demi-étendues MONDE (après scale) du cuboid généré depuis la bounding
   * box locale — évite à l'appelant (`interactive.ts`/`main.ts`) de refaire
   * ce calcul pour animer une ouverture (ex. glissement vertical sur sa
   * propre hauteur, voir la porte à badge de la Zone E). */
  halfExtents: THREE.Vector3;
  /** Clip d'animation glTF associé à ce nœud, s'il existe. PARSÉ, PAS JOUÉ —
   * lire un mixer et déclencher l'ouverture est le scope de
   * `game/level/interactive.ts` (hors Phase 4). */
  clip: THREE.AnimationClip | null;
  extras: Record<string, unknown>;
}

export interface UseObject {
  name: string;
  object: THREE.Object3D;
  /** Position MONDE. */
  position: THREE.Vector3;
  /** Portée d'usage, mètres. Constante du contrat (voir CLAUDE.md), pas une
   * valeur par objet. */
  range: number;
  /** Nom de l'objet ciblé, lu dans `extras.target` (custom property Blender
   * `target`, string). `null` si absent — un `use_*` sans cible est un
   * avertissement bruyant (voir plus haut), pas une erreur bloquante : le
   * niveau continue de charger. */
  targetName: string | null;
  extras: Record<string, unknown>;
}

export interface SecretZone {
  name: string;
  object: THREE.Object3D;
  min: THREE.Vector3;
  max: THREE.Vector3;
  extras: Record<string, unknown>;
}

export interface LevelStats {
  colliderCount: number;
  /** Répartition de `colliderCount` par forme physique — voir le skill
   * `collision-proxy-authoring`. Additif : la somme des trois vaut toujours
   * `colliderCount`. */
  colliderKindCounts: {
    cuboid: number;
    convexHull: number;
    trimesh: number;
  };
  spawnSuitCount: number;
  spawnDirectorCount: number;
  triggerCount: number;
  doorCount: number;
  useCount: number;
  secretCount: number;
  /** Meshes rendus tels quels, sans préfixe reconnu — le cas SILENCIEUX. */
  unprefixedMeshCount: number;
}

export interface LevelHandle {
  /** Racine ajoutée à `scene` (= `gltf.scene`). */
  root: THREE.Object3D;
  gltf: GLTF;
  /** `null` si absent du fichier — voir l'avertissement bruyant correspondant. */
  spawnPlayer: SpawnPoint | null;
  spawnSuits: NamedSpawn[];
  spawnDirectors: NamedSpawn[];
  triggers: TriggerVolume[];
  doors: DoorInfo[];
  useObjects: UseObject[];
  secrets: SecretZone[];
  stats: LevelStats;
  /**
   * Retire `root` de la scène et libère TOUS les corps/colliders Rapier créés
   * pour ce niveau (un `world.removeRigidBody` par corps suffit : Rapier
   * retire automatiquement les colliders attachés, voir sa doc). Géométries
   * et matériaux clonés sont aussi disposés côté GPU. Sûr à appeler plusieurs
   * fois (no-op après le premier appel réel — GARANTI par `Scope.close`,
   * jalon M2, pas par un flag `disposed` maintenu à la main comme avant).
   *
   * C'est la brique de base du hot reload (`hotReload.ts`) : dispose puis
   * `buildLevelFromGltf` à nouveau, sans jamais toucher au joueur.
   */
  dispose(): void;
}

/** Portée d'usage d'un `use_*`, mètres — contrat CLAUDE.md, pas un réglage par objet. */
const USE_RANGE_METERS = 2;

/** Signe d'un mesh `col_*` oublié en high-poly (skill `gltf-level-conventions`). */
const MAX_COLLIDER_TRIANGLES = 50_000;

// ---------------------------------------------------------------------------
// Erreurs typées (jalon M2, PLAN_EFFECT_XSTATE.md §4) — une par cas de
// dégradation déjà documenté plus haut. Voir la doc de tête de fichier pour
// le patron "fail immédiatement rattrapé" appliqué uniformément aux 7 cas.
// ---------------------------------------------------------------------------

/** `col_*`/`col_hull_*`/`col_mesh_*` sans géométrie valide (position absente)
 * ou avec 0 triangle. `prefixLabel` reproduit le libellé EXACT du message
 * d'origine (`"col_*"` pour le chemin trimesh générique — utilisé aussi par
 * `col_mesh_*`, un alias de ce même chemin — `"col_hull_*"` pour le chemin
 * convex hull) : ce n'est PAS forcément le préfixe réel de l'objet, c'est un
 * héritage assumé du comportement d'avant cette migration (`col_mesh_test`
 * affichait déjà "(col_*)", pas "(col_mesh_*)"). */
export class MissingColliderGeometryError extends Schema.TaggedError<MissingColliderGeometryError>()(
  "MissingColliderGeometryError",
  {
    name: Schema.String,
    prefixLabel: Schema.Literals(["col_*", "col_hull_*"]),
    reason: Schema.Literals(["missing-geometry", "zero-triangles"]),
  },
) {}

/** `col_*` dépassant `MAX_COLLIDER_TRIANGLES` — jamais bloquant, le collider
 * est créé quand même (diagnostic de mesh oublié en high-poly). */
export class OversizedColliderWarning extends Schema.TaggedError<OversizedColliderWarning>()(
  "OversizedColliderWarning",
  {
    name: Schema.String,
    triangleCount: Schema.Number,
  },
) {}

/** `spawn_player` absent du niveau. */
export class MissingSpawnPlayerError extends Schema.TaggedError<MissingSpawnPlayerError>()(
  "MissingSpawnPlayerError",
  {},
) {}

/** `spawn_player` présent plus d'une fois — seul le premier rencontré compte. */
export class DuplicateSpawnPlayerError extends Schema.TaggedError<DuplicateSpawnPlayerError>()(
  "DuplicateSpawnPlayerError",
  { count: Schema.Number },
) {}

/** `trig_*` dont la géométrie n'est pas une box axis-aligned (locale). */
export class NonBoxTriggerError extends Schema.TaggedError<NonBoxTriggerError>()("NonBoxTriggerError", {
  name: Schema.String,
}) {}

/** `use_*` sans `extras.target` — jamais bloquant, l'objet est quand même
 * retourné avec `targetName: null`. */
export class UntargetedUseObjectWarning extends Schema.TaggedError<UntargetedUseObjectWarning>()(
  "UntargetedUseObjectWarning",
  { name: Schema.String },
) {}

/** `col_hull_*` dont `RAPIER.ColliderDesc.convexHull` retourne `null`
 * (sommets dégénérés) — toujours suivi d'un repli sur un collider trimesh
 * pour ce même mesh, jamais d'absence totale de collider. */
export class DegenerateConvexHullError extends Schema.TaggedError<DegenerateConvexHullError>()(
  "DegenerateConvexHullError",
  { name: Schema.String },
) {}

/** Échec réseau/parsing lors du chargement d'un `.glb`/`.gltf` par URL — la
 * SEULE des 7 erreurs de ce fichier qui n'a jamais été un "warning" :
 * `loadLevel` a toujours laissé cette erreur remonter à son appelant
 * (`hotReload.ts` la rattrape, PAS ce fichier). `cause` porte la valeur
 * brute rejetée par `GLTFLoader.loadAsync`/`fetch` (`Schema.Defect`, comme
 * les exemples `SmtpError`/`DatabaseError` de `node_modules/effect/AGENTS.md`
 * — une valeur de rejet non typée, jamais un domaine métier). */
export class LevelFetchError extends Schema.TaggedError<LevelFetchError>()("LevelFetchError", {
  url: Schema.String,
  cause: Schema.Defect(),
}) {}

function formatMissingColliderGeometry(error: MissingColliderGeometryError): string {
  const detail = error.reason === "missing-geometry" ? "sans géométrie valide" : "a 0 triangle";
  return `[level] "${error.name}" (${error.prefixLabel}) ${detail} — aucun collider créé.`;
}

function formatOversizedCollider(error: OversizedColliderWarning): string {
  return (
    `[level] "${error.name}" (col_*) : ${error.triangleCount} triangles, au-delà du seuil de ` +
    `${MAX_COLLIDER_TRIANGLES} — signe probable d'un mesh oublié en high-poly. ` +
    `Collider créé quand même.`
  );
}

function formatMissingSpawnPlayer(): string {
  return "[level] spawn_player absent du niveau — le joueur ne peut pas être positionné au chargement.";
}

function formatDuplicateSpawnPlayer(error: DuplicateSpawnPlayerError): string {
  return `[level] spawn_player en double (${error.count} occurrences) — seule la première rencontrée est utilisée.`;
}

function formatNonBoxTrigger(error: NonBoxTriggerError): string {
  return `[level] "${error.name}" (trig_*) n'est pas une géométrie box — trigger ignoré.`;
}

function formatUntargetedUseObject(error: UntargetedUseObjectWarning): string {
  return (
    `[level] "${error.name}" (use_*) n'a pas de cible référencée dans ses extras ` +
    `(custom property Blender "target" attendue) — objet interactif sans effet exploitable.`
  );
}

function formatDegenerateConvexHull(error: DegenerateConvexHullError): string {
  return (
    `[level] "${error.name}" (col_hull_*) : hull convexe dégénéré ` +
    `(RAPIER.ColliderDesc.convexHull a retourné null, sommets probablement coplanaires) ` +
    `— repli sur un collider trimesh pour ce mesh.`
  );
}

// ---------------------------------------------------------------------------
// Conversion de matériau — invariant #5 (voir doc de tête du fichier)
// ---------------------------------------------------------------------------

/**
 * `hasVertexColors` : présence de l'attribut de géométrie `"color"` (mappé
 * depuis `COLOR_0` par `GLTFLoader` — voir le skill
 * `vertex-color-sector-lighting` et sa doc de tête). `GLTFLoader` positionne
 * déjà `vertexColors = true` sur le `MeshStandardMaterial` qu'il construit
 * lui-même dans ce cas ; ce flag serait perdu si on reconstruisait le
 * matériau sans jamais le relire, exactement ce que fait ce fichier pour
 * respecter l'invariant #5. Le colorspace (`COLOR_0` linéaire) est déjà géré
 * en interne par `GLTFLoader` — rien à faire de plus ici.
 */
function toLambert(mat: THREE.Material, hasVertexColors: boolean): THREE.MeshLambertMaterial {
  const src = mat as THREE.MeshStandardMaterial;
  const lambert = new THREE.MeshLambertMaterial({
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    map: src.map ?? null,
    transparent: src.transparent,
    opacity: src.opacity,
    side: src.side,
    alphaTest: src.alphaTest,
    vertexColors: hasVertexColors,
    // volontairement absents : roughnessMap/metalnessMap/normalMap/envMap —
    // c'est exactement ce que l'invariant #5 demande de jeter.
  });
  lambert.name = mat.name;
  if (lambert.map) {
    // Invariant #4 : NearestFilter partout, jamais de mipmaps. Une texture
    // survivante d'un glTF (filtrage linéaire par défaut) casserait
    // silencieusement l'identité visuelle rétro sinon.
    lambert.map.magFilter = THREE.NearestFilter;
    lambert.map.minFilter = THREE.NearestFilter;
    lambert.map.generateMipmaps = false;
    lambert.map.needsUpdate = true;
  }
  return lambert;
}

function convertToLambert(mesh: THREE.Mesh): void {
  const hasVertexColors = mesh.geometry.hasAttribute("color");
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((mat) => toLambert(mat, hasVertexColors));
  } else {
    mesh.material = toLambert(mesh.material, hasVertexColors);
  }
}

// ---------------------------------------------------------------------------
// Nom "tel que tapé dans Blender" — piège découvert en construisant la
// fixture de validation de ce fichier, pas documenté par le skill.
// ---------------------------------------------------------------------------

/**
 * `GLTFLoader` RÉÉCRIT `.name` de CHAQUE nœud importé via sa méthode interne
 * `createUniqueName()` : « When Object3D instances are targeted by animation,
 * they need unique names. » Deux Empties nommés IDENTIQUEMENT `spawn_player`
 * dans Blender ressortent donc de l'import comme `spawn_player` et
 * `spawn_player_1` — un contrôle de préfixe/égalité sur `obj.name` ne verrait
 * JAMAIS ce doublon, silencieusement, exactement le genre de bug que ce
 * fichier est censé signaler bruyamment.
 *
 * `GLTFLoader` préserve heureusement le nom BRUT du glTF dans
 * `node.userData.name` (assigné avant la ré-écriture, voir GLTFLoader.js).
 * C'est CETTE valeur qu'il faut lire pour tout ce qui touche au contrat de
 * nommage ci-dessous — jamais `obj.name` directement.
 *
 * Exception : `findClipForObject` continue de lire `mesh.name` (mangled) à
 * dessein, parce que `GLTFLoader` construit les noms de piste d'animation à
 * partir de ce même `.name` ré-écrit — les deux restent cohérents ENTRE EUX
 * même après mangling, donc comparer l'un à l'autre reste correct.
 */
function blenderName(obj: THREE.Object3D): string {
  const raw = (obj.userData as Record<string, unknown> | undefined)?.name;
  return typeof raw === "string" ? raw : obj.name;
}

/**
 * Copie de `userData` pour `extras`, SANS la clé `name` que `GLTFLoader` y
 * injecte lui-même pour tout nœud nommé (voir `blenderName` ci-dessus) — ce
 * n'est pas une custom property Blender, l'exposer dans `extras` polluerait
 * la seule donnée qu'un futur `interactive.ts` doit pouvoir lire telle
 * quelle (ex. `extras.target`, `extras.hp`...).
 */
function cleanExtras(obj: THREE.Object3D): Record<string, unknown> {
  const { name: _internalName, ...rest } = obj.userData as Record<string, unknown>;
  return rest;
}

// ---------------------------------------------------------------------------
// Géométrie monde (le piège documenté en tête de fichier)
// ---------------------------------------------------------------------------

function worldSpaceGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  return geo;
}

function buildSequentialIndex(vertexCount: number): Uint32Array {
  const idx = new Uint32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) idx[i] = i;
  return idx;
}

/**
 * Un mesh est une "box" si TOUS ses sommets sont sur un coin de sa propre
 * bounding box locale — plus robuste qu'une simple comparaison de nom ou un
 * `instanceof THREE.BoxGeometry` (Blender exporte toujours des
 * `BufferGeometry` génériques, jamais les classes `THREE.*Geometry`).
 * Vérifié en espace LOCAL, pas monde : un cuboid tourné par le parent reste
 * une box valide (c'est la rotation du corps Rapier qui l'exprime, voir
 * `buildTrigger`), une déformation non uniforme (cisaillement) ou toute forme
 * non convexe-boîte échoue le test quel que soit son alignement.
 */
function isAxisAlignedBox(geometry: THREE.BufferGeometry, epsilon = 1e-4): boolean {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!position || position.count === 0) return false;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  if (!bb) return false;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const onX = Math.abs(x - bb.min.x) < epsilon || Math.abs(x - bb.max.x) < epsilon;
    const onY = Math.abs(y - bb.min.y) < epsilon || Math.abs(y - bb.max.y) < epsilon;
    const onZ = Math.abs(z - bb.min.z) < epsilon || Math.abs(z - bb.max.z) < epsilon;
    if (!(onX && onY && onZ)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Extraction par préfixe
// ---------------------------------------------------------------------------

/** `col_*` : collider trimesh statique, mesh rendu invisible. Version "brute"
 * (raising) : échoue avec `MissingColliderGeometryError` pour une géométrie
 * invalide/0 triangle plutôt que de logguer elle-même — voir
 * `buildStaticColliderSafe` pour la version rattrapée utilisée par le
 * traverse principal. L'avertissement "oversized" (non bloquant) est, lui,
 * loggué directement ICI via `warnIfOversizedEffect` : il ne change jamais la
 * valeur de retour, ce n'est pas un cas d'échec/récupération. */
function buildStaticColliderEffect(
  mesh: THREE.Mesh,
  name: string,
  prefixLabel: "col_*" | "col_hull_*",
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<boolean, MissingColliderGeometryError> {
  return Effect.gen(function* () {
    const worldGeometry = worldSpaceGeometry(mesh);
    const positionAttr = worldGeometry.getAttribute("position") as THREE.BufferAttribute | undefined;

    if (!positionAttr || positionAttr.count === 0) {
      worldGeometry.dispose();
      return yield* new MissingColliderGeometryError({ name, prefixLabel, reason: "missing-geometry" });
    }

    const indexAttr = worldGeometry.getIndex();
    const rawIndices = indexAttr ? indexAttr.array : buildSequentialIndex(positionAttr.count);
    const triangleCount = Math.floor(rawIndices.length / 3);

    if (triangleCount === 0) {
      worldGeometry.dispose();
      return yield* new MissingColliderGeometryError({ name, prefixLabel, reason: "zero-triangles" });
    }
    if (triangleCount > MAX_COLLIDER_TRIANGLES) {
      // Avertissement non bloquant : loggué immédiatement, la construction
      // continue juste après (voir la doc de tête de fichier, patron
      // "fail immédiatement rattrapé" appliqué même à ce cas non bloquant).
      yield* Effect.fail(new OversizedColliderWarning({ name, triangleCount })).pipe(
        Effect.catch((error) => Effect.sync(() => console.error(formatOversizedCollider(error)))),
      );
    }

    const vertices =
      positionAttr.array instanceof Float32Array
        ? positionAttr.array
        : Float32Array.from(positionAttr.array as ArrayLike<number>);
    const indices = rawIndices instanceof Uint32Array ? rawIndices : Uint32Array.from(rawIndices as ArrayLike<number>);

    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.world.createCollider(
      RAPIER.ColliderDesc.trimesh(vertices, indices).setCollisionGroups(COLLISION_GROUPS.WORLD),
      body,
    );
    bodies.push(body);

    worldGeometry.dispose();
    return true;
  });
}

/** Version rattrapée de `buildStaticColliderEffect` : ne fait jamais échouer
 * l'appelant, logue et retourne `false` (comme l'ancien retour booléen) sur
 * `MissingColliderGeometryError`. */
function buildStaticColliderSafe(
  mesh: THREE.Mesh,
  name: string,
  prefixLabel: "col_*" | "col_hull_*",
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<boolean> {
  return buildStaticColliderEffect(mesh, name, prefixLabel, physics, bodies).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        console.error(formatMissingColliderGeometry(error));
        return false;
      }),
    ),
  );
}

/**
 * `col_box_*` : cuboid inconditionnel — voir le skill `collision-proxy-
 * authoring` ("hiérarchie de choix", cuboid en tête, coût minimal, pas
 * d'arêtes internes donc pas de ghost collisions). Contrairement à `trig_*`,
 * on fait CONFIANCE au sous-préfixe donné par l'artiste : pas de revalidation
 * géométrique avant d'émettre le cuboid ("un proxy peut légèrement mentir sur
 * la forme, c'est un outil de gameplay" — skill). Pas de cas d'échec
 * documenté pour ce chemin : reste une fonction plane, pas un Effect.
 * Pattern de décomposition IDENTIQUE à `buildTrigger`/`buildDoor` : bounding
 * box LOCALE + matrice monde décomposée en position/rotation/échelle,
 * demi-étendues = taille locale × échelle monde. Corps FIXED (jamais
 * dynamique, contrairement à `door_*`), groupe `COLLISION_GROUPS.WORLD`
 * (jamais `TRIGGER`, jamais de `.setSensor(true)` — un `col_box_*` est un
 * mur, pas un volume logique).
 */
function buildCuboidCollider(mesh: THREE.Mesh, physics: PhysicsWorld, bodies: RAPIER.RigidBody[]): void {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
  const localCenter = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  const discardedPosition = new THREE.Vector3();
  mesh.matrixWorld.decompose(discardedPosition, worldQuat, worldScale);

  const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);
  const halfExtents = new THREE.Vector3(
    Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
    Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
    Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
  );

  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
      .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
  );
  physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
      COLLISION_GROUPS.WORLD,
    ),
    body,
  );
  bodies.push(body);
}

/**
 * `col_hull_*` : convex hull — voir le skill `collision-proxy-authoring`
 * ("rampes, formes convexes irrégulières", coût faible). Sommets en espace
 * MONDE via `worldSpaceGeometry` (même pattern que le chemin trimesh de
 * `buildStaticColliderEffect` : le corps reste à l'origine, la forme porte
 * déjà la transformation monde). `RAPIER.ColliderDesc.convexHull` retourne
 * `null` pour un hull dégénéré (ex. sommets coplanaires) — dans ce cas,
 * `DegenerateConvexHullError`, PUIS repli sur `buildStaticColliderEffect`
 * (trimesh) pour ce même mesh : un `col_hull_*` ne doit jamais rester
 * silencieusement sans AUCUN collider. Version "brute" : `buildConvexHullColliderSafe`
 * ci-dessous fait le double rattrapage (géométrie manquante / hull dégénéré). */
function buildConvexHullColliderEffect(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<"convexHull", MissingColliderGeometryError | DegenerateConvexHullError> {
  return Effect.gen(function* () {
    const worldGeometry = worldSpaceGeometry(mesh);
    const positionAttr = worldGeometry.getAttribute("position") as THREE.BufferAttribute | undefined;

    if (!positionAttr || positionAttr.count === 0) {
      worldGeometry.dispose();
      return yield* new MissingColliderGeometryError({ name, prefixLabel: "col_hull_*", reason: "missing-geometry" });
    }

    const points =
      positionAttr.array instanceof Float32Array
        ? positionAttr.array
        : Float32Array.from(positionAttr.array as ArrayLike<number>);
    worldGeometry.dispose();

    const desc = RAPIER.ColliderDesc.convexHull(points);
    if (!desc) {
      return yield* new DegenerateConvexHullError({ name });
    }

    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    physics.world.createCollider(desc.setCollisionGroups(COLLISION_GROUPS.WORLD), body);
    bodies.push(body);
    return "convexHull" as const;
  });
}

/** Version rattrapée de `buildConvexHullColliderEffect` : `Effect.catchTags`
 * (voir `node_modules/effect/ai-docs/src/01_effect/04_errors/10_catch-tags.ts`)
 * traite les deux cas d'échec différemment, exactement comme avant cette
 * migration — géométrie manquante -> `null` ; hull dégénéré -> repli trimesh
 * via `buildStaticColliderSafe` (déjà lui-même sans échec possible). */
function buildConvexHullColliderSafe(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<"convexHull" | "trimesh" | null> {
  return buildConvexHullColliderEffect(mesh, name, physics, bodies).pipe(
    Effect.catchTags({
      MissingColliderGeometryError: (error) =>
        Effect.sync(() => {
          console.error(formatMissingColliderGeometry(error));
          return null;
        }),
      DegenerateConvexHullError: (error) =>
        Effect.gen(function* () {
          console.error(formatDegenerateConvexHull(error));
          // "col_*", PAS "col_hull_*" : reproduit fidèlement le comportement
          // d'avant cette migration, où le repli appelait l'ancien
          // `buildStaticCollider` — une fonction qui codait TOUJOURS
          // "(col_*)" en dur dans ses propres messages, quel que soit
          // l'appelant (jamais paramétrée par le préfixe réel de l'objet).
          // Ne se manifeste que dans le cas extrême, non observé en
          // pratique, où le repli lui-même échoue aussi (géométrie
          // invalide/0 triangle) — voir `tmp/harness-forced-null-hull.ts`,
          // qui confirme empiriquement que `col_hull_*` a toujours assez de
          // sommets pour que ce repli réussisse en pratique.
          const created = yield* buildStaticColliderSafe(mesh, name, "col_*", physics, bodies);
          return created ? ("trimesh" as const) : null;
        }),
    }),
  );
}

/** `spawn_player` (Empty) : position + yaw. Voir la doc de `SpawnPoint` pour
 * la convention pieds/yeux. */
function extractSpawnPoint(obj: THREE.Object3D): SpawnPoint {
  const position = new THREE.Vector3();
  obj.getWorldPosition(position);

  const worldQuat = new THREE.Quaternion();
  obj.getWorldQuaternion(worldQuat);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
  // Convention `main.ts`/`gym.ts` (Euler 'YXZ', vérifiée par calcul dans
  // `gym.ts`) : yaw=0 -> avant = -Z, dérivation identique à wishX/wishZ dans
  // `PlayerController.update` (forward = (-sin(yaw), 0, -cos(yaw))).
  const yaw = Math.atan2(-forward.x, -forward.z);

  return { position, yaw };
}

/** `trig_*` : volume box, sensor Rapier. Version "brute" : échoue avec
 * `NonBoxTriggerError` si la géométrie n'est pas une box — voir
 * `buildTriggerSafe` pour la version rattrapée (retourne `null`, même
 * comportement observable qu'avant cette migration). */
function buildTriggerEffect(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<TriggerVolume, NonBoxTriggerError> {
  return Effect.gen(function* () {
    if (!isAxisAlignedBox(mesh.geometry)) {
      return yield* new NonBoxTriggerError({ name });
    }

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);
    const localCenter = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);

    const worldPosition = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    mesh.matrixWorld.decompose(worldPosition, worldQuat, worldScale);

    const worldCenter = localCenter.clone().applyMatrix4(mesh.matrixWorld);
    const halfExtents = new THREE.Vector3(
      Math.abs((localSize.x * worldScale.x) / 2),
      Math.abs((localSize.y * worldScale.y) / 2),
      Math.abs((localSize.z * worldScale.z) / 2),
    );

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(worldCenter.x, worldCenter.y, worldCenter.z)
        .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }),
    );
    physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setSensor(true)
        .setCollisionGroups(COLLISION_GROUPS.TRIGGER),
      body,
    );
    bodies.push(body);

    return {
      name,
      object: mesh,
      min: worldCenter.clone().sub(halfExtents),
      max: worldCenter.clone().add(halfExtents),
      extras: cleanExtras(mesh),
    };
  });
}

/** Version rattrapée de `buildTriggerEffect` : logue et retourne `null` sur
 * `NonBoxTriggerError` — comportement observable inchangé. */
function buildTriggerSafe(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
): Effect.Effect<TriggerVolume | null> {
  return buildTriggerEffect(mesh, name, physics, bodies).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        console.error(formatNonBoxTrigger(error));
        return null;
      }),
    ),
  );
}

/** Cherche le clip glTF dont une piste cible ce nœud (par nom — voir
 * `PATH_PROPERTIES`/`targetName` de `GLTFLoader.js` : le nom de piste est
 * toujours `<nom du nœud>.<propriété>`). Ne joue rien, se contente d'exposer
 * le clip pour un futur `interactive.ts`. */
function findClipForObject(clips: THREE.AnimationClip[], object: THREE.Object3D): THREE.AnimationClip | null {
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const dot = track.name.indexOf(".");
      const nodeName = dot === -1 ? track.name : track.name.slice(0, dot);
      if (nodeName === object.name || nodeName === object.uuid) return clip;
    }
  }
  return null;
}

/** `door_*` : porte animée. Collider DYNAMIQUE (contrat CLAUDE.md — pas
 * `fixed()` comme `col_*`, pas non plus le `KinematicCharacterController` du
 * joueur, invariant #6 réservé au joueur). Verrouillé (translations +
 * rotations, gravité neutralisée) tant qu'aucune logique de jeu ne le pilote
 * : une porte non pilotée ne doit ni tomber sous la gravité −25 m/s² ni
 * dériver au moindre contact avant que `game/level/interactive.ts` (hors
 * scope Phase 4) ne la débloque explicitement pour l'animer. Aucun cas
 * d'échec documenté pour ce chemin : reste une fonction plane. */
function buildDoor(
  mesh: THREE.Mesh,
  name: string,
  physics: PhysicsWorld,
  bodies: RAPIER.RigidBody[],
  clips: THREE.AnimationClip[],
): DoorInfo {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const localSize = new THREE.Vector3().subVectors(bb.max, bb.min);

  const worldPosition = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  mesh.matrixWorld.decompose(worldPosition, worldQuat, worldScale);

  const halfExtents = new THREE.Vector3(
    Math.max(1e-3, Math.abs((localSize.x * worldScale.x) / 2)),
    Math.max(1e-3, Math.abs((localSize.y * worldScale.y) / 2)),
    Math.max(1e-3, Math.abs((localSize.z * worldScale.z) / 2)),
  );

  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(worldPosition.x, worldPosition.y, worldPosition.z)
      .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w })
      .setGravityScale(0)
      .lockTranslations()
      .lockRotations(),
  );
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setCollisionGroups(
      COLLISION_GROUPS.WORLD,
    ),
    body,
  );
  bodies.push(body);

  return {
    name,
    object: mesh,
    body,
    collider,
    halfExtents,
    clip: findClipForObject(clips, mesh),
    extras: cleanExtras(mesh),
  };
}

/** `use_*` : objet interactif, portée 2 m. Cible lue dans `extras.target`
 * (custom property Blender `target`, string — nom d'un autre nœud du même
 * niveau, typiquement un `door_*`). Absence de cible = `UntargetedUseObjectWarning`,
 * loggué immédiatement (jamais bloquant) : l'objet est quand même retourné
 * avec `targetName: null`, donc cette fonction ne peut jamais échouer côté
 * appelant (`Effect.Effect<UseObject>`, pas de canal d'erreur visible). */
function buildUseObjectEffect(mesh: THREE.Mesh, name: string): Effect.Effect<UseObject> {
  return Effect.gen(function* () {
    const position = new THREE.Vector3();
    mesh.getWorldPosition(position);

    const extras = cleanExtras(mesh);
    const targetName = typeof extras.target === "string" ? extras.target : null;
    if (!targetName) {
      yield* Effect.fail(new UntargetedUseObjectWarning({ name })).pipe(
        Effect.catch((error) => Effect.sync(() => console.error(formatUntargetedUseObject(error)))),
      );
    }

    return { name, object: mesh, position, range: USE_RANGE_METERS, targetName, extras };
  });
}

/** `secret_*` : zone comptée dans le compteur de secrets. Même traitement
 * géométrique qu'un `trig_*` côté extraction (bounding box monde), mais AUCUNE
 * exigence de forme box ici — un secret peut être une zone irrégulière, sa
 * détection appartiendra à `interactive.ts`, pas à ce loader. Aucun cas
 * d'échec documenté : reste une fonction plane. */
function buildSecretZone(mesh: THREE.Mesh, name: string): SecretZone {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const corners = [
    new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z),
    new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z),
  ].map((v) => v.applyMatrix4(mesh.matrixWorld));

  const min = new THREE.Vector3(
    Math.min(corners[0].x, corners[1].x),
    Math.min(corners[0].y, corners[1].y),
    Math.min(corners[0].z, corners[1].z),
  );
  const max = new THREE.Vector3(
    Math.max(corners[0].x, corners[1].x),
    Math.max(corners[0].y, corners[1].y),
    Math.max(corners[0].z, corners[1].z),
  );

  return { name, object: mesh, min, max, extras: cleanExtras(mesh) };
}

/** Validation post-traversal du nombre de `spawn_player` rencontrés — même
 * patron "fail immédiatement rattrapé" que les cas par-mesh ci-dessus, juste
 * exécuté une fois après la boucle plutôt que par nœud. */
function validateSpawnPlayerCountEffect(count: number): Effect.Effect<void> {
  if (count === 0) {
    return Effect.fail(new MissingSpawnPlayerError({})).pipe(
      Effect.catch(() => Effect.sync(() => console.error(formatMissingSpawnPlayer()))),
    );
  }
  if (count > 1) {
    return Effect.fail(new DuplicateSpawnPlayerError({ count })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatDuplicateSpawnPlayer(error)))),
    );
  }
  return Effect.void;
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

/** Résultat brut de la construction, AVANT emballage en `LevelHandle` public
 * (qui ajoute `dispose()`, lié à un `Scope` géré par l'appelant — voir
 * `acquireLevelResourceEffect`/`toLevelHandle`). `bodies` est gardé ici, pas
 * dans `LevelStats`, parce que c'est une donnée de CYCLE DE VIE (nécessaire à
 * la libération), pas une statistique destinée à `main.ts`/`DebugPanel`. */
interface LevelResource extends Omit<LevelHandle, "dispose"> {
  readonly bodies: readonly RAPIER.RigidBody[];
}

/**
 * Construit un `LevelResource` à partir d'un résultat `GLTFLoader` déjà
 * parsé. Effect PURE côté entrée/sortie (aucun accès réseau/DOM ici, même
 * garantie qu'avant cette migration) : réutilisable aussi bien depuis
 * `loadLevelEffect` (navigateur, via `GLTFLoader.loadAsync`) que depuis un
 * harnais Node headless qui appelle `GLTFLoader.parse` directement sur des
 * octets lus par `fs` — voir `tools/blender/README.md`/les harnais sous `tmp/`.
 *
 * Le parcours de la hiérarchie glTF (`root.traverse`) est collecté dans un
 * tableau AVANT le `Effect.gen` principal : `Object3D.traverse` est une API à
 * callback synchrone sans point d'entrée generator, donc plutôt que
 * d'imbriquer des `Effect.runSync` locaux à chaque nœud « à risque » (ce qui
 * fonctionnerait aussi, ces effets ne suspendant jamais, mais mélangerait
 * deux styles d'exécution dans la même fonction), la hiérarchie est d'abord
 * aplatie en un tableau ordinaire, puis parcourue par un `for` classique DANS
 * le générateur — un seul style de composition Effect pour toute la
 * fonction, `yield*` uniquement là où un des 7 cas peut se produire.
 */
function buildLevelResourceEffect(
  gltf: GLTF,
  scene: THREE.Scene,
  physics: PhysicsWorld,
): Effect.Effect<LevelResource> {
  return Effect.gen(function* () {
    const root = gltf.scene;
    scene.add(root);
    // Un seul passage sur tout le sous-arbre AVANT toute lecture de
    // `matrixWorld` ci-dessous (voir « le piège des transforms » en tête de
    // fichier) : équivalent au `obj.updateWorldMatrix(true, false)` par-objet
    // du skill, amorti sur toute la hiérarchie en un seul appel.
    root.updateWorldMatrix(true, true);

    const nodes: THREE.Object3D[] = [];
    root.traverse((obj) => nodes.push(obj));

    const bodies: RAPIER.RigidBody[] = [];

    let spawnPlayer: SpawnPoint | null = null;
    let spawnPlayerCount = 0;
    const spawnSuits: NamedSpawn[] = [];
    const spawnDirectors: NamedSpawn[] = [];
    const triggers: TriggerVolume[] = [];
    const doors: DoorInfo[] = [];
    const useObjects: UseObject[] = [];
    const secrets: SecretZone[] = [];

    let colliderCount = 0;
    const colliderKindCounts = { cuboid: 0, convexHull: 0, trimesh: 0 };
    let unprefixedMeshCount = 0;

    for (const obj of nodes) {
      // Nom "tel que tapé dans Blender", PAS `obj.name` — voir la doc de
      // `blenderName` (piège `GLTFLoader.createUniqueName`).
      const name = blenderName(obj);

      // --- Empties : jamais un THREE.Mesh, traités avant le filtre `instanceof` ---
      if (name === "spawn_player") {
        spawnPlayerCount++;
        if (spawnPlayerCount === 1) spawnPlayer = extractSpawnPoint(obj);
        continue;
      }
      if (name.startsWith("spawn_suit_")) {
        const position = new THREE.Vector3();
        obj.getWorldPosition(position);
        spawnSuits.push({ name, position });
        continue;
      }
      if (name.startsWith("spawn_director_")) {
        const position = new THREE.Vector3();
        obj.getWorldPosition(position);
        spawnDirectors.push({ name, position });
        continue;
      }

      if (!(obj instanceof THREE.Mesh)) continue;

      // Invariant #5 (+ #4 pour les textures survivantes) : AVANT toute autre
      // chose, pour CHAQUE mesh, préfixé ou non — voir la doc de tête de fichier.
      convertToLambert(obj);

      // Sous-préfixes de `col_*` — voir le skill `collision-proxy-authoring`.
      // DOIVENT être testés AVANT le `col_` générique ci-dessous : sinon
      // `"col_box_test".startsWith("col_")` (vrai aussi) fait tomber le
      // routage dans le mauvais cas, silencieusement.
      if (name.startsWith("col_box_")) {
        buildCuboidCollider(obj, physics, bodies);
        colliderCount++;
        colliderKindCounts.cuboid++;
        obj.visible = false;
        continue;
      }

      if (name.startsWith("col_hull_")) {
        const kind = yield* buildConvexHullColliderSafe(obj, name, physics, bodies);
        if (kind) {
          colliderCount++;
          colliderKindCounts[kind]++;
        }
        obj.visible = false;
        continue;
      }

      if (name.startsWith("col_mesh_")) {
        // Alias explicite du dernier recours (trimesh) — aucune nouvelle
        // logique, juste un branchement nommé plutôt qu'un fallthrough
        // implicite dans le `col_*` générique.
        const created = yield* buildStaticColliderSafe(obj, name, "col_*", physics, bodies);
        if (created) {
          colliderCount++;
          colliderKindCounts.trimesh++;
        }
        obj.visible = false;
        continue;
      }

      if (name.startsWith("col_")) {
        // Rétrocompatibilité (Zone A/B actuelles) : comportement INCHANGÉ
        // (trimesh), SAUF gain silencieux si la géométrie LOCALE s'avère être
        // une boîte axis-aligned — même test que `trig_*`, réutilisé tel quel.
        // Pas d'avertissement dans ce cas : c'est un pur gain de perf/stabilité,
        // pas une anomalie signalée.
        if (isAxisAlignedBox(obj.geometry)) {
          buildCuboidCollider(obj, physics, bodies);
          colliderCount++;
          colliderKindCounts.cuboid++;
        } else {
          const created = yield* buildStaticColliderSafe(obj, name, "col_*", physics, bodies);
          if (created) {
            colliderCount++;
            colliderKindCounts.trimesh++;
          }
        }
        obj.visible = false;
        continue;
      }

      if (name.startsWith("trig_")) {
        const trigger = yield* buildTriggerSafe(obj, name, physics, bodies);
        if (trigger) triggers.push(trigger);
        obj.visible = false;
        continue;
      }

      if (name.startsWith("door_")) {
        doors.push(buildDoor(obj, name, physics, bodies, gltf.animations));
        continue; // reste visible : c'est un panneau de décor animé, pas un volume logique
      }

      if (name.startsWith("use_")) {
        useObjects.push(yield* buildUseObjectEffect(obj, name));
        continue; // reste visible (objet interactif physique, ex. un terminal)
      }

      if (name.startsWith("secret_")) {
        secrets.push(buildSecretZone(obj, name));
        obj.visible = false; // volume logique, comme trig_*
        continue;
      }

      // Mesh sans préfixe reconnu : rendu tel quel, SANS collider,
      // SILENCIEUSEMENT (voir la doc de tête de fichier — ne rien logger ici).
      unprefixedMeshCount++;
    }

    yield* validateSpawnPlayerCountEffect(spawnPlayerCount);

    const stats: LevelStats = {
      colliderCount,
      colliderKindCounts,
      spawnSuitCount: spawnSuits.length,
      spawnDirectorCount: spawnDirectors.length,
      triggerCount: triggers.length,
      doorCount: doors.length,
      useCount: useObjects.length,
      secretCount: secrets.length,
      unprefixedMeshCount,
    };

    return { root, gltf, spawnPlayer, spawnSuits, spawnDirectors, triggers, doors, useObjects, secrets, stats, bodies };
  });
}

/** Libère un `LevelResource` : retire `root` de la scène, retire tous les
 * corps Rapier (et donc leurs colliders attachés, voir sa doc), dispose
 * géométries/matériaux clonés côté GPU. Fonction de RELEASE pour
 * `Effect.acquireRelease` (voir `acquireLevelResourceEffect`) — appelée
 * exactement une fois par `Scope`, garantie par la bibliothèque (voir la doc
 * de tête de fichier). */
function disposeLevelResource(resource: LevelResource, scene: THREE.Scene, physics: PhysicsWorld): void {
  scene.remove(resource.root);
  for (const body of resource.bodies) physics.world.removeRigidBody(body); // retire aussi les colliders attachés (doc Rapier)
  resource.root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      const lambert = mat as THREE.MeshLambertMaterial;
      lambert.map?.dispose();
      lambert.dispose();
    }
  });
}

/** `LevelResource` géré par `Scope` : la libération (`disposeLevelResource`)
 * est enregistrée comme finalizer du `Scope` ambiant plutôt que déclenchée
 * par un flag `disposed` maintenu à la main (jalon M2 — voir la doc de tête
 * de fichier). Requiert un `Scope` dans son contexte ; `buildLevelFromGltfEffect`/
 * `loadLevelEffect` en fournissent chacun un GÉRÉ MANUELLEMENT (pas
 * `Effect.scoped`, qui fermerait le scope — donc libérerait le niveau —
 * immédiatement après sa construction, ce qui n'est PAS ce qu'on veut : le
 * niveau doit rester vivant jusqu'à un appel explicite à `dispose()`, qui
 * peut arriver bien plus tard, voire jamais avant la fin de partie). */
function acquireLevelResourceEffect(
  gltf: GLTF,
  scene: THREE.Scene,
  physics: PhysicsWorld,
): Effect.Effect<LevelResource, never, Scope.Scope> {
  return Effect.acquireRelease(buildLevelResourceEffect(gltf, scene, physics), (resource) =>
    Effect.sync(() => disposeLevelResource(resource, scene, physics)),
  );
}

/** Emballe un `LevelResource` acquis sous `scope` en `LevelHandle` public :
 * `dispose()` ferme CE `scope` précis (créé manuellement par l'appelant, voir
 * `buildLevelFromGltfEffect`/`loadLevelEffect`), ce qui déclenche le
 * finalizer enregistré par `acquireLevelResourceEffect`. */
function toLevelHandle(resource: LevelResource, scope: Scope.Closeable): LevelHandle {
  return {
    root: resource.root,
    gltf: resource.gltf,
    spawnPlayer: resource.spawnPlayer,
    spawnSuits: resource.spawnSuits,
    spawnDirectors: resource.spawnDirectors,
    triggers: resource.triggers,
    doors: resource.doors,
    useObjects: resource.useObjects,
    secrets: resource.secrets,
    stats: resource.stats,
    dispose: () => GameRuntime.runSync(Scope.close(scope, Exit.void)),
  };
}

/**
 * Version Effect de `buildLevelFromGltf` — voir la doc de tête de fichier
 * ("Frontière Effect→Promise/plain-JS"). Exportée UNIQUEMENT pour les tests
 * (`@effect/vitest`) ; `main.ts` n'importe jamais ce nom. Ne requiert aucun
 * service de `GameLayer` (le `Scope` de cycle de vie est créé et fourni ICI,
 * pas laissé à la charge de l'appelant — contrairement à
 * `acquireLevelResourceEffect`), donc directement exécutable par
 * `GameRuntime.runSync`/`runPromise` sans rien à fournir de plus.
 */
export function buildLevelFromGltfEffect(
  gltf: GLTF,
  scene: THREE.Scene,
  physics: PhysicsWorld,
): Effect.Effect<LevelHandle> {
  return Effect.gen(function* () {
    const scope = Scope.makeUnsafe();
    const resource = yield* acquireLevelResourceEffect(gltf, scene, physics).pipe(Scope.provide(scope));
    return toLevelHandle(resource, scope);
  });
}

/**
 * Construit un `LevelHandle` à partir d'un résultat `GLTFLoader` déjà parsé.
 * Fonction PURE côté entrée/sortie (aucun accès réseau/DOM ici) : c'est ce
 * qui la rend utilisable aussi bien depuis `loadLevel` (navigateur, via
 * `GLTFLoader.loadAsync`) que depuis un harnais Node headless qui appelle
 * `GLTFLoader.parse` directement sur des octets lus par `fs` — voir le script
 * de validation de la fixture. Signature INCHANGÉE par le jalon M2 (voir la
 * doc de tête de fichier) : synchrone, ne suspend jamais (`GameRuntime.runSync`
 * ne peut donc jamais déclencher son garde-fou de suspension ici).
 */
export function buildLevelFromGltf(gltf: GLTF, scene: THREE.Scene, physics: PhysicsWorld): LevelHandle {
  return GameRuntime.runSync(buildLevelFromGltfEffect(gltf, scene, physics));
}

/**
 * Version Effect de `loadLevel` — voir `buildLevelFromGltfEffect` pour la
 * même remarque sur l'usage réservé aux tests. Seule fonction de ce fichier
 * dont le canal d'erreur n'est PAS `never` : un échec réseau/parsing
 * (`LevelFetchError`) est une vraie erreur qui n'a jamais été un
 * "warning" — voir la doc de la classe.
 */
export function loadLevelEffect(
  url: string,
  scene: THREE.Scene,
  physics: PhysicsWorld,
): Effect.Effect<LevelHandle, LevelFetchError> {
  return Effect.gen(function* () {
    const loader = new GLTFLoader();
    const gltf = yield* Effect.tryPromise({
      try: () => loader.loadAsync(url),
      catch: (cause) => new LevelFetchError({ url, cause }),
    });
    return yield* buildLevelFromGltfEffect(gltf, scene, physics);
  });
}

/**
 * Charge un `.glb`/`.gltf` par URL (navigateur, via `fetch` interne à
 * `GLTFLoader`/`FileLoader`) et construit son `LevelHandle`. C'est la seule
 * fonction de ce fichier qui touche le réseau — `buildLevelFromGltf`
 * au-dessus reste testable hors navigateur. Signature INCHANGÉE par le
 * jalon M2 : async, retourne `Promise<LevelHandle>`, rejette avec
 * `LevelFetchError` en cas d'échec réseau/parsing (avant cette migration,
 * rejetait avec l'erreur brute de `GLTFLoader.loadAsync` — `hotReload.ts`,
 * seul appelant, logue de toute façon l'objet d'erreur tel quel dans les
 * deux cas, voir sa doc de tête ; `LevelFetchError.cause` porte la valeur
 * d'origine, rien n'est perdu).
 */
export async function loadLevel(url: string, scene: THREE.Scene, physics: PhysicsWorld): Promise<LevelHandle> {
  return GameRuntime.runPromise(loadLevelEffect(url, scene, physics));
}
