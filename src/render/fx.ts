import * as THREE from "three";

/**
 * Effets visuels de tir : screenshake, muzzle flash, decals + particules
 * d'impact, douilles éjectées, gibs de mise à mort à bout portant. Module
 * PUREMENT cosmétique, tourne en temps réel (`update(realDt)`, appelé depuis
 * `game/loop/updateFx.ts`), JAMAIS sur le pas fixe.
 *
 * Découplage délibéré de `game/player/weapons.ts` (primitives uniquement,
 * aucun `Math.random()` seedé — hors harnais de rejeu F9/F10), trois régimes
 * de pooling volontairement pas uniformisés, et le choix de « physique
 * jouet » sans Rapier pour les débris cosmétiques (ADR 0018) :
 * see: docs/systems/rendu.md#découplage-entre-render-et-game
 * see: docs/systems/rendu.md#effets-visuels-de-tir-fxsystem
 */

// Screenshake

/**
 * Fraction du pic d'amplitude considérée négligeable à la fin de la fenêtre
 * de décroissance : `k = -ln(fraction) / duration`, donc à `t = duration`,
 * `amplitude(t) = pic * fraction`. Valeurs retenues :
 * see: docs/reference/valeurs-deplacement.md#impact
 */
const SHAKE_NEGLIGIBLE_FRACTION = 0.05;
const SHAKE_DECAY_RATE = -Math.log(SHAKE_NEGLIGIBLE_FRACTION); // ≈ 2.9957

// Muzzle flash

/** Nombre de FRAMES D'AFFICHAGE (pas de pas fixes) pendant lesquelles le flash reste visible. */
const MUZZLE_FLASH_FRAMES = 2;
const MUZZLE_FLASH_POOL_SIZE = 2;

interface MuzzleFlashPreset {
  color: number;
  /** Intensité de la `PointLight`, en candela (three.js physiquement correct depuis r155). Point de départ, tunable. */
  intensity: number;
  /** Portée de la lumière, en mètres. */
  range: number;
  /** Taille du quad (côté du carré), en mètres. */
  size: number;
  /** Décalage le long de `muzzleDirection` depuis `muzzlePosition`, en mètres. */
  offset: number;
}

/**
 * Un preset par arme À FEU. Le pied-de-biche N'A PAS DE CANON, et n'a PLUS DE
 * MUZZLE FLASH DU TOUT (ni quad ni lumière) — retiré après un retour de
 * playtest (« cette espèce de carré blanc qui apparaît à l'écran », « ça fait
 * mal aux yeux »). Cause vérifiée avant correctif, PAS un decal ni des
 * particules : `game/loop/updateFx.ts` demandait un muzzle flash pour CHAQUE
 * `fireEvent`, mêlée comprise, avec `event.muzzlePosition` (l'œil du joueur)
 * comme origine — `spawnMuzzleFlash` plaçait alors le quad à seulement
 * `offset` (0,15 m) devant la caméra, orienté FACE À ELLE. Un quad blanc
 * (`color: 0xffffff` sur `createMuzzleFlashSlot`, ci-dessous) à 15 cm de
 * l'œil couvre l'essentiel du champ de vision à 640×360 : le carré n'était
 * pas un artefact, c'était le comportement demandé, au mauvais endroit et
 * pour la mauvaise arme. Le retour du coup de pied-de-biche passe par ce qui
 * existe déjà : impact (particules), son, hitmarker, screenshake — voir
 * `game/loop/updateFx.ts`.
 */
const MUZZLE_FLASH_PRESETS: Record<"pistol" | "shotgun", MuzzleFlashPreset> = {
  // Pistolet : plus petit et plus court que le pompe, mais même origine (bout
  // du canon affiché, voir `Viewmodel.muzzleWorldPosition`).
  pistol: { color: 0xfff0b0, intensity: 28, range: 4, size: 0.12, offset: 0.06 },
  // Le pompe part du bout du canon affiché (`Viewmodel.muzzleWorldPosition`) : juste devant.
  shotgun: { color: 0xfff2c0, intensity: 60, range: 6, size: 0.22, offset: 0.06 },
};

interface MuzzleFlashSlot {
  light: THREE.PointLight;
  quad: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  /** Frames d'affichage restantes avant extinction. 0 = éteint. */
  framesRemaining: number;
}

// Decals d'impact

/**
 * Pool de decals — UNIQUEMENT pour du décor STATIQUE (voir la garde posée par
 * `game/loop/updateFx.ts` avant chaque `spawnImpactDecal`). Un decal est un
 * quad posé une fois au point d'impact, jamais reparenté ni suivi : sur un
 * ennemi, un `prop_*` poussable, une porte animée, une vitre ou un sanitaire
 * cassables, il resterait accroché à un point du MONDE alors que la surface a
 * bougé ou disparu — l'impact « flotte dans le vide », le second retour de
 * playtest corrigé ici. Plutôt que reparenter (un decal enfant d'un mesh
 * détruit/cassé exigerait un retrait explicite à chaque système de casse —
 * `props.ts`/`vitres.ts`/`sanitaires.ts` — pour un gain cosmétique mineur),
 * le choix retenu est le plus simple qui ne laisse jamais rien flotter :
 * AUCUN decal sur ces surfaces, seulement les particules d'impact
 * (`spawnImpactParticles`), qui sont déjà des objets libres, jetables, avec
 * une durée de vie courte — rien à désolidariser. Ce module ne connaît lui-
 * même aucun de ces systèmes (`fx.ts` reste découplé de `game/level/*`,
 * voir docs/systems/rendu.md#découplage-entre-render-et-game) : la garde vit
 * entièrement côté appelant.
 */
const DECAL_POOL_SIZE = 24;
const DECAL_SIZE = 0.12; // m
/** Détachement le long de la normale, évite le z-fighting avec la surface touchée. */
const DECAL_OFFSET = 0.01; // m
/** Marque sombre uniforme : aucun tag de matériau n'existe cette phase (gym en boîtes blanches, voir `weapons.ts`). */
const DECAL_COLOR = 0x1c1a18;

interface DecalSlot {
  mesh: THREE.Mesh;
}

// Particules d'impact et douilles — « physique jouet » temps réel
// see: docs/decisions/0018-physique-jouet-debris-cosmetiques.md

/** Gravité jouet, en m/s². DÉLIBÉRÉMENT dupliquée depuis l'invariant #7 (-25 m/s²) plutôt qu'importée : ce module ne touche jamais Rapier, mais réutilise la même magnitude pour rester cohérent visuellement avec le reste du monde. */
const TOY_GRAVITY = -25;

const PARTICLE_LIFETIME = 0.4; // s
const PARTICLES_PER_HIT_MELEE = 4;
const PARTICLES_PER_HIT_SHOTGUN = 5;
const PARTICLE_SIZE = 0.03; // m
const PARTICLE_SPEED_MIN = 2; // m/s
const PARTICLE_SPEED_MAX = 5; // m/s
/** Ouverture du cône jouet autour de la normale (composante aléatoire, non seedée — cosmétique). */
const PARTICLE_SPREAD = 0.6;

const SHELL_LIFETIME = 1.6; // s
const SHELL_EJECT_SPEED = 1.8; // m/s, latéral
const SHELL_EJECT_UP_SPEED = 2.2; // m/s, vertical
const SHELL_RESTITUTION = 0.3;
const SHELL_FRICTION = 0.6;
/**
 * Hauteur de sol supposée pour le rebond des douilles, en mètres.
 * APPROXIMATION ASSUMÉE (aucune requête Rapier, voir ADR 0018) : `y = 0` est
 * le niveau du sol du hub/couloir de `game/level/gym.ts` — dans une zone
 * avec relief, une douille peut visuellement traverser une marche.
 * see: docs/decisions/0018-physique-jouet-debris-cosmetiques.md
 */
const SHELL_GROUND_Y = 0;

// Gibs — mort à bout portant (pompe). Réutilise `ToyParticle`/
// `updateToyPhysics` tel quel (`bounce: false`, pas de rebond, donc pas
// besoin de `SHELL_GROUND_Y` ici — voir la doc de tête).

const GIB_LIFETIME = 0.9; // s, plus long que PARTICLE_LIFETIME (chunks plus gros, chute plus lisible)
const GIBS_PER_KILL = 8;
const GIB_SIZE = 0.08; // m, cube de base — voir le scale non uniforme dans spawnGibs pour casser la silhouette
const GIB_SPEED_MIN = 3; // m/s
const GIB_SPEED_MAX = 7; // m/s
/** Cône jouet plus large que `PARTICLE_SPREAD` : « explosion » bout portant plutôt qu'un ricochet de plomb. */
const GIB_SPREAD = 0.9;
const GIB_COLOR = 0x3a120f; // rouge/brun sombre, nettement plus sombre que PARTICLE_MATERIAL

const GIB_GEOMETRY = new THREE.BoxGeometry(GIB_SIZE, GIB_SIZE, GIB_SIZE);
const GIB_MATERIAL = new THREE.MeshLambertMaterial({ color: GIB_COLOR });

// Débris — destruction d'un `prop_*`. Même infrastructure jouet que les gibs
// (`spawnChunks`), trois différences assumées : des éclats plus petits et plus
// nombreux (une caisse ne se démonte pas en huit morceaux de chair), une durée
// de vie plus longue (le joueur regarde ce qu'il vient de casser), et une
// COULEUR passée par l'appelant.
//
// La couleur est un `number`, pas une matière : `render/` ne connaît pas les
// matières de `game/level/props.ts`, c'est `loop/updateFx.ts` qui traduit —
// même frontière que `material: string` sur `spawnImpactDecal`.
// see: docs/systems/rendu.md#découplage-entre-render-et-game
const DEBRIS_LIFETIME = 1.4; // s
const DEBRIS_SIZE = 0.06; // m
const DEBRIS_SPEED_MIN = 2;
const DEBRIS_SPEED_MAX = 5.5;
const DEBRIS_SPREAD = 1.1;
const DEBRIS_GEOMETRY = new THREE.BoxGeometry(DEBRIS_SIZE, DEBRIS_SIZE, DEBRIS_SIZE);

// Givre — casse d'un `vitre_*` portant `givre: true` (armoires/bacs surgelés,
// voir `game/level/vitres.ts::VitreSystem`). Même infrastructure jouet que
// les gibs/débris (`spawnChunks`), une seule vraie différence : une bouffée
// qui RETOMBE LENTEMENT (`FROST_GRAVITY_SCALE` << 1) au lieu de chuter comme
// un éclat solide — d'où `ToyParticle.gravityScale`, absent avant ce préfixe
// (tout le reste de ce fichier tombait à la même gravité jouet).
const FROST_LIFETIME = 1.8; // s, plus long que les débris — une bouffée qui retombe lentement doit avoir le temps de le faire
const FROST_COUNT = 14;
const FROST_SIZE = 0.05;
const FROST_SPEED_MIN = 0.6;
const FROST_SPEED_MAX = 1.8;
const FROST_SPREAD = 1.3; // bouffée large, pas un jet dirigé
const FROST_GRAVITY_SCALE = 0.12;
const FROST_COLOR = 0xdcf2fb; // blanc légèrement bleuté
const FROST_GEOMETRY = new THREE.BoxGeometry(FROST_SIZE, FROST_SIZE, FROST_SIZE);
const FROST_MATERIAL = new THREE.MeshLambertMaterial({ color: FROST_COLOR });

// Sanitaires cassables (`sanitaire_*`, casse au tir) — éclats de faïence +
// eau. Deux régimes DÉLIBÉRÉMENT différents, dans l'esprit du reste du
// fichier (voir la doc de tête, « trois régimes de pooling ») :
// - `spawnCeramicBurst` réutilise `spawnChunks` telle quelle (éclats de
//   faïence + gerbe d'eau initiale) : un évènement RARE (casser un
//   sanitaire), la même raison qu'un `spawnGibs`/`spawnDebris`/
//   `spawnFrostBurst` — allouer quelques meshes à cet instant précis est
//   sans coût.
// - `addWaterJet` est au contraire PERMANENT, tourne à CHAQUE frame jusqu'à
//   `clearWaterJets` : zéro allocation tolérée en régime établi (voir la
//   doc de tête du module). Toute la fontaine (gouttes en l'air +
//   éclaboussures au sol, N jets confondus) tient dans un SEUL
//   `THREE.InstancedMesh` à pool fixe — UN lot de dessin, quel que soit le
//   nombre de jets actifs (0 à `WATER_MAX_JETS`), parce qu'un
//   `InstancedMesh` dessine tout son buffer d'instances en un seul appel :
//   voir docs/systems/cout-de-rendu.md (« les triangles ne coûtent presque
//   rien ») — une centaine de petits cubes, cachés (échelle nulle) ou
//   visibles, ne pèse rien à côté du budget de LOTS, la vraie contrainte de
//   ce niveau (pire vue mesurée : 198/200).

const CERAMIC_LIFETIME = 1.1; // s
const CERAMIC_COUNT = 7;
const CERAMIC_SIZE = 0.07; // m
const CERAMIC_SPEED_MIN = 2; // m/s
const CERAMIC_SPEED_MAX = 5; // m/s
const CERAMIC_SPREAD = 1.0;
const CERAMIC_COLOR = 0xe8e4da; // faïence blanc cassé
const CERAMIC_GEOMETRY = new THREE.BoxGeometry(CERAMIC_SIZE, CERAMIC_SIZE, CERAMIC_SIZE);
const CERAMIC_MATERIAL = new THREE.MeshLambertMaterial({ color: CERAMIC_COLOR });

/** Bleu pâle partagé par la gerbe initiale (`spawnChunks`) ET la fontaine permanente (`InstancedMesh`) — même eau, deux régimes de rendu. */
const WATER_COLOR = 0xb7dff0;
/**
 * Cube partagé par la gerbe initiale et la fontaine permanente : « gouttes
 * en petits carrés francs », jamais de flou ni de shader d'eau — voir le
 * skill `build-engine-look`. La géométrie sert aussi de base aux
 * éclaboussures au sol (`WATER_SPLASH_*`), aplaties par l'échelle
 * d'instance plutôt qu'avec une géométrie séparée : un `InstancedMesh` ne
 * porte qu'UNE géométrie.
 */
const WATER_DROPLET_SIZE = 0.05; // m
const WATER_GEOMETRY = new THREE.BoxGeometry(WATER_DROPLET_SIZE, WATER_DROPLET_SIZE, WATER_DROPLET_SIZE);
/**
 * Un peu d'émissif : les toilettes sont une pièce sombre, et une eau éclairée
 * par la seule lumière ambiante y sortait du même gris que le carrelage
 * (constaté en jeu). L'eau des jeux Build accroche toujours la lumière.
 */
const WATER_EMISSIVE = 0x2f5566;
const WATER_MATERIAL = new THREE.MeshLambertMaterial({ color: WATER_COLOR, emissive: WATER_EMISSIVE });

// Gerbe initiale (spawnCeramicBurst) — infrastructure spawnChunks/ToyParticle,
// direction fixe `UP_DIRECTION` (comme le givre) : casser un sanitaire fait
// jaillir l'eau vers le haut quelle que soit la direction du coup, pas vers
// la cible.
const WATER_BURST_LIFETIME = 0.7; // s — la fontaine PERMANENTE prend le relais tout de suite après, cette gerbe n'a pas besoin de durer
const WATER_BURST_COUNT = 10;
const WATER_BURST_SPEED_MIN = 2.5; // m/s
const WATER_BURST_SPEED_MAX = 5; // m/s
const WATER_BURST_SPREAD = 0.5;

// Fontaine permanente (addWaterJet) — pool fixe, un seul InstancedMesh.
const WATER_MAX_JETS = 8; // 5 sanitaires posés dans le niveau, marge de sécurité (voir la tâche)
// Huit gouttes par jet se lisaient comme trois points isolés à 640×360, pas
// comme un jet : il en faut assez pour que la colonne paraisse continue.
const WATER_DROPLETS_PER_JET = 28; // gouttes en l'air, en vol continu
const WATER_SPLASHES_PER_JET = 6; // éclaboussures au sol, round-robin PAR JET
const WATER_DROPLET_TOTAL = WATER_MAX_JETS * WATER_DROPLETS_PER_JET;
const WATER_SPLASH_TOTAL = WATER_MAX_JETS * WATER_SPLASHES_PER_JET;
/** Taille totale du pool d'instances — CONSTANTE, jamais redimensionnée après construction du `InstancedMesh`. */
const WATER_INSTANCE_COUNT = WATER_DROPLET_TOTAL + WATER_SPLASH_TOTAL;

/** Hauteur visée du jet, tirée au hasard PAR GOUTTE : « gicle verticalement ~1 à 1,5 m ». */
const WATER_JET_HEIGHT_MIN = 1.0; // m
const WATER_JET_HEIGHT_MAX = 1.5; // m
/** Vitesse horizontale au départ : « retombe en éventail » plutôt qu'une colonne droite. */
const WATER_FAN_SPEED_MIN = 0.1; // m/s
const WATER_FAN_SPEED_MAX = 0.5; // m/s
/**
 * Goutte étirée à la verticale, en facteurs de `WATER_GEOMETRY` : un filet
 * d'eau qui tombe se lit comme un trait, un cube se lit comme une particule.
 */
const WATER_DROPLET_STRETCH = new THREE.Vector3(0.8, 1.8, 0.8);

const WATER_SPLASH_LIFETIME = 0.18; // s — rythme vif, plusieurs éclaboussures par seconde et par jet
const WATER_SPLASH_SIZE = 0.09; // m, rayon max de la marque au sol
const WATER_SPLASH_FLATNESS = 0.015; // m, hauteur écrasée : une flaque, pas un cube
const WATER_SPLASH_JITTER = 0.12; // m, décalage horizontal aléatoire autour du pied du jet
/** Fraction de `WATER_SPLASH_LIFETIME` passée à grossir avant de s'évanouir PAR L'ÉCHELLE (le matériau reste opaque, voir la doc de tête — aucun tri de transparence à gérer sur un `InstancedMesh`). */
const WATER_SPLASH_GROW_FRACTION = 0.3;
/** Marge autour des jets actifs pour la sphère d'élagage : l'éventail, les éclaboussures, la gerbe initiale. */
const WATER_BOUNDS_MARGIN = 0.8; // m

interface ToyParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  /** Rebond au sol (douilles) ou disparition directe (particules d'impact). */
  bounce: boolean;
  /** Multiplicateur de `TOY_GRAVITY` — 1 pour tout sauf le givre, qui retombe lentement. */
  gravityScale: number;
}

// État persistant du pool `InstancedMesh` de la fontaine permanente — voir
// `addWaterJet`. Ces objets sont créés UNE FOIS au constructeur, jamais par
// frame (contrairement à `ToyParticle`, alloué à chaque `spawnChunks`).

interface WaterDropletState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

interface WaterSplashState {
  position: THREE.Vector3;
  /** Secondes restantes avant extinction. `<= 0` = éteinte (matrice d'instance déjà à échelle nulle). */
  life: number;
}

interface WaterJetSlot {
  active: boolean;
  origin: THREE.Vector3;
  /** Curseur round-robin parmi les `WATER_SPLASHES_PER_JET` de CE jet — indépendant des autres jets. */
  splashCursor: number;
}

// Géométries/matériaux PARTAGÉS entre toutes les particules/douilles (comme
// `materialFor` dans `gym.ts`) : chaque `spawn*` alloue une nouvelle `Mesh`
// (léger, nécessaire vu la durée de vie/le mouvement individuels) mais
// jamais de nouvelle géométrie ni de nouveau matériau.
const PARTICLE_GEOMETRY = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
/** Poussière/débris génériques (béton, décor) — tout ce qui n'est pas un hit ENEMY. */
const PARTICLE_MATERIAL = new THREE.MeshLambertMaterial({ color: 0x2c2620 });
/**
 * Giclée sur un ennemi touché : même géométrie/durée de vie que
 * `PARTICLE_MATERIAL`, seule la couleur distingue « ça, c'est du sang » de la
 * poussière générique — voir `spawnImpactParticles`. Choisie distinctement du
 * rouge/brun de `GIB_COLOR` (bout portant, chunks plus gros) : une giclée
 * n'est pas une explosion.
 */
const BLOOD_COLOR = 0x5a1418;
const BLOOD_MATERIAL = new THREE.MeshLambertMaterial({ color: BLOOD_COLOR });
/**
 * Réplique locale de `FLESH_MATERIAL` (`game/player/weapons.ts`) : ce module
 * ne l'importe pas (voir docs/systems/rendu.md#découplage-entre-render-et-game
 * — `fx.ts` ne dépend jamais de `game/player/*`), même discipline que le
 * type `"melee" | "pistol" | "shotgun"` déjà dupliqué en dur dans ce fichier.
 */
const FLESH_SURFACE = "flesh";
const SHELL_GEOMETRY = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6);
const SHELL_MATERIAL = new THREE.MeshLambertMaterial({ color: 0xc98a2c }); // laiton

/** Normale par défaut d'un `PlaneGeometry` non tourné (+Z). Réutilisée en lecture seule, jamais mutée. */
const PLANE_DEFAULT_NORMAL = new THREE.Vector3(0, 0, 1);

/** Direction de base d'une bouffée de givre (`spawnFrostBurst`) — elle n'a pas de normale de surface comme un impact, juste "vers le haut". Réutilisée en lecture seule, jamais mutée. */
const UP_DIRECTION = new THREE.Vector3(0, 1, 0);

/** Rotation identité des gouttes/éclaboussures d'eau — jamais tournées, « carrés francs » axés sur les axes du monde. Réutilisée en lecture seule, jamais mutée. */
const IDENTITY_QUATERNION = new THREE.Quaternion();

/** Matrice à échelle nulle : cache une instance d'`InstancedMesh` sans la retirer du pool (voir `WATER_INSTANCE_COUNT`). Réutilisée en lecture seule, jamais mutée. */
const ZERO_SCALE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

export class FxSystem {
  private readonly scene: THREE.Scene;

  // Screenshake
  private shakePeak = 0;
  private shakeElapsed = 0;
  private shakeDurationActive = 0;

  // Pools à taille fixe
  private readonly muzzleFlashes: MuzzleFlashSlot[] = [];
  private muzzleFlashCursor = 0;
  private readonly decals: DecalSlot[] = [];
  private decalCursor = 0;

  // Listes filtrées, pas de pool (voir la doc de tête)
  private readonly particles: ToyParticle[] = [];
  private readonly casings: ToyParticle[] = [];
  private readonly gibs: ToyParticle[] = [];
  private readonly debris: ToyParticle[] = [];
  private readonly frost: ToyParticle[] = [];
  private readonly ceramic: ToyParticle[] = [];
  private readonly waterBurst: ToyParticle[] = [];

  // Fontaine permanente (sanitaires cassés) — pool fixe, un seul InstancedMesh
  // pour tous les jets actifs (voir la doc de tête, section « sanitaires »).
  private readonly waterJetMesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>;
  private readonly waterJets: WaterJetSlot[] = [];
  private readonly waterDroplets: WaterDropletState[] = [];
  private readonly waterSplashes: WaterSplashState[] = [];
  private waterJetCursor = 0;

  /**
   * Un `MeshLambertMaterial` par couleur de débris, créé à la première
   * demande. Borné par le nombre de matières de props (quatre) : un matériau
   * par appel ferait une fuite GPU à chaque caisse cassée.
   */
  private readonly debrisMaterials = new Map<number, THREE.MeshLambertMaterial>();

  // Scratch, zéro allocation en régime établi
  private readonly scratchDir = new THREE.Vector3();
  private readonly scratchBox = new THREE.Box3();
  private readonly scratchScale = new THREE.Vector3();
  private readonly scratchMatrix = new THREE.Matrix4();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    for (let i = 0; i < MUZZLE_FLASH_POOL_SIZE; i++) {
      this.muzzleFlashes.push(this.createMuzzleFlashSlot());
    }
    for (let i = 0; i < DECAL_POOL_SIZE; i++) {
      this.decals.push(this.createDecalSlot());
    }

    this.waterJetMesh = new THREE.InstancedMesh(WATER_GEOMETRY, WATER_MATERIAL, WATER_INSTANCE_COUNT);
    // Élagué comme n'importe quel mesh, mais sur une sphère englobante tenue
    // À LA MAIN autour des jets actifs (`updateWaterBounds`) : celle que
    // three.js calcule seul l'est une fois pour toutes, au premier rendu,
    // quand toutes les instances sont encore à l'origine. Et caché tant
    // qu'aucun jet n'est actif. Toujours dessiné, il coûtait un lot dans
    // TOUTES les vues du niveau, pire vue comprise (198/200).
    this.waterJetMesh.boundingSphere = new THREE.Sphere();
    this.waterJetMesh.visible = false;
    this.scene.add(this.waterJetMesh);

    for (let j = 0; j < WATER_MAX_JETS; j++) {
      this.waterJets.push({ active: false, origin: new THREE.Vector3(), splashCursor: 0 });
    }
    for (let i = 0; i < WATER_DROPLET_TOTAL; i++) {
      this.waterDroplets.push({ position: new THREE.Vector3(), velocity: new THREE.Vector3() });
    }
    for (let i = 0; i < WATER_SPLASH_TOTAL; i++) {
      this.waterSplashes.push({ position: new THREE.Vector3(), life: 0 });
    }
    for (let i = 0; i < WATER_INSTANCE_COUNT; i++) {
      this.waterJetMesh.setMatrixAt(i, ZERO_SCALE_MATRIX);
    }
    this.waterJetMesh.instanceMatrix.needsUpdate = true;
  }

  private createMuzzleFlashSlot(): MuzzleFlashSlot {
    const light = new THREE.PointLight(0xfff2c0, 0, 1, 2);
    light.visible = false;
    this.scene.add(light);

    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 1 }),
    );
    quad.visible = false;
    this.scene.add(quad);

    return { light, quad, framesRemaining: 0 };
  }

  private createDecalSlot(): DecalSlot {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(DECAL_SIZE, DECAL_SIZE),
      new THREE.MeshLambertMaterial({ color: DECAL_COLOR }),
    );
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh };
  }

  /**
   * (Re)démarre ou renforce le screenshake. PAS de sommation entre
   * déclenchements qui se chevauchent (voir la doc de tête) : le MAX de
   * l'amplitude courante (déjà partiellement décroissante) et de la nouvelle,
   * relancé sur la durée pleine `duration`.
   */
  triggerShake(amplitude: number, duration: number) {
    const current = this.currentShakeAmplitude();
    this.shakePeak = Math.max(current, amplitude);
    this.shakeElapsed = 0;
    this.shakeDurationActive = duration;
  }

  private currentShakeAmplitude(): number {
    if (this.shakePeak <= 0 || this.shakeDurationActive <= 0) return 0;
    if (this.shakeElapsed >= this.shakeDurationActive) return 0;
    const k = SHAKE_DECAY_RATE / this.shakeDurationActive;
    return this.shakePeak * Math.exp(-k * this.shakeElapsed);
  }

  /**
   * Offset courant à additionner à `camera.position`, tiré uniformément
   * dans une sphère de rayon = amplitude courante. `Math.random()` ordinaire
   * — voir la doc de tête, ceci est purement cosmétique et hors harnais de
   * déterminisme.
   */
  currentShakeOffset(out: THREE.Vector3): THREE.Vector3 {
    const amp = this.currentShakeAmplitude();
    if (amp <= 0) return out.set(0, 0, 0);

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // Racine cubique : distribution uniforme en VOLUME dans la sphère (pas
    // seulement sur sa surface), cosmétique, précision de raison suffisante.
    const r = amp * Math.cbrt(Math.random());
    const sinPhi = Math.sin(phi);
    out.set(r * sinPhi * Math.cos(theta), r * sinPhi * Math.sin(theta), r * Math.cos(phi));
    return out;
  }

  // Muzzle flash

  spawnMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3, weapon: "pistol" | "shotgun") {
    const preset = MUZZLE_FLASH_PRESETS[weapon];
    const slot = this.muzzleFlashes[this.muzzleFlashCursor]!;
    this.muzzleFlashCursor = (this.muzzleFlashCursor + 1) % this.muzzleFlashes.length;

    slot.light.position.copy(position).addScaledVector(direction, preset.offset);
    slot.light.color.setHex(preset.color);
    slot.light.intensity = preset.intensity;
    slot.light.distance = preset.range;
    slot.light.visible = true;

    slot.quad.position.copy(slot.light.position);
    slot.quad.material.emissive.setHex(preset.color);
    slot.quad.scale.setScalar(preset.size);
    // Oriente le quad pour que sa normale (+Z par défaut) fasse face au
    // joueur : approximation qui suppose le joueur globalement à l'opposé de
    // `direction` depuis le point de tir — vrai par construction puisque
    // `muzzlePosition`/`muzzleDirection` viennent de l'œil du joueur
    // (`weapons.ts`), jamais d'une position rendue.
    this.scratchDir.copy(direction).negate().normalize();
    slot.quad.quaternion.setFromUnitVectors(PLANE_DEFAULT_NORMAL, this.scratchDir);
    slot.quad.visible = true;

    slot.framesRemaining = MUZZLE_FLASH_FRAMES;
  }

  // Decals d'impact

  /**
   * À appeler UNIQUEMENT pour un point d'impact sur du décor STATIQUE — voir
   * la doc de tête de `DECAL_POOL_SIZE` : ce module ne le vérifie pas
   * lui-même (aucune dépendance vers `game/level/*`), c'est
   * `game/loop/updateFx.ts` qui garde cet appel derrière la bonne condition.
   * `material` : placeholder pour un futur tag de matériau (voir
   * `PLACEHOLDER_MATERIAL` dans `weapons.ts`) — conservé dans l'API pour ne
   * pas devoir la changer plus tard, sans effet cette phase.
   */
  spawnImpactDecal(point: THREE.Vector3, normal: THREE.Vector3, material: string) {
    void material;

    const slot = this.decals[this.decalCursor]!;
    this.decalCursor = (this.decalCursor + 1) % this.decals.length;

    slot.mesh.position.copy(point).addScaledVector(normal, DECAL_OFFSET);
    slot.mesh.quaternion.setFromUnitVectors(PLANE_DEFAULT_NORMAL, normal);
    slot.mesh.visible = true;
  }

  // Particules d'impact

  /**
   * `material` choisit UNIQUEMENT la couleur (giclée sombre sur `"flesh"`,
   * poussière générique sinon) — même chaîne que `HitEvent.material`, passée
   * telle quelle par l'appelant. Contrairement au decal, ces particules sont
   * des objets jetables sans point d'attache : elles restent correctes même
   * quand la surface touchée bouge ou disparaît juste après (ennemi, `prop_*`,
   * porte, vitre, sanitaire) — voir la doc de tête de `DECAL_POOL_SIZE`.
   */
  spawnImpactParticles(point: THREE.Vector3, normal: THREE.Vector3, weapon: "melee" | "pistol" | "shotgun", material: string) {
    const count = weapon === "shotgun" ? PARTICLES_PER_HIT_SHOTGUN : PARTICLES_PER_HIT_MELEE;
    const particleMaterial = material === FLESH_SURFACE ? BLOOD_MATERIAL : PARTICLE_MATERIAL;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(PARTICLE_GEOMETRY, particleMaterial);
      mesh.position.copy(point);
      this.scene.add(mesh);

      // Cône jouet autour de la normale (réflexion approximative), plus une
      // légère composante ascendante. `Math.random()` ordinaire — cosmétique,
      // AUCUN rapport avec la dispersion seedée du pompe dans `weapons.ts`.
      const vx = normal.x + (Math.random() * 2 - 1) * PARTICLE_SPREAD;
      const vy = normal.y + (Math.random() * 2 - 1) * PARTICLE_SPREAD + 0.5;
      const vz = normal.z + (Math.random() * 2 - 1) * PARTICLE_SPREAD;
      const speed = PARTICLE_SPEED_MIN + Math.random() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN);
      const velocity = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(speed);

      this.particles.push({ mesh, velocity, life: PARTICLE_LIFETIME, bounce: false, gravityScale: 1 });
    }
  }

  // Douilles éjectées

  /**
   * Une douille par tir de POMPE (jamais pour le pied-de-biche, pas de
   * cartouche) — c'est `game/loop/updateFx.ts` qui filtre sur
   * `fireEvent.weapon`, cette méthode ne fait aucune hypothèse sur l'appelant.
   * Physique jouet, pas d'interaction Rapier : voir ADR 0018.
   * see: docs/decisions/0018-physique-jouet-debris-cosmetiques.md
   */
  spawnShellCasing(muzzlePosition: THREE.Vector3, muzzleDirection: THREE.Vector3) {
    const mesh = new THREE.Mesh(SHELL_GEOMETRY, SHELL_MATERIAL);
    mesh.position.copy(muzzlePosition);
    this.scene.add(mesh);

    // Éjection latérale approximative : perpendiculaire à la visée dans le
    // plan horizontal (rotation de 90° autour de Y). Repli sur +X mondial si
    // la visée est quasi verticale (composante horizontale dégénérée).
    let rightX = -muzzleDirection.z;
    let rightZ = muzzleDirection.x;
    const rightLen = Math.hypot(rightX, rightZ);
    if (rightLen < 1e-4) {
      rightX = 1;
      rightZ = 0;
    } else {
      rightX /= rightLen;
      rightZ /= rightLen;
    }

    const velocity = new THREE.Vector3(rightX * SHELL_EJECT_SPEED, SHELL_EJECT_UP_SPEED, rightZ * SHELL_EJECT_SPEED);
    this.casings.push({ mesh, velocity, life: SHELL_LIFETIME, bounce: true, gravityScale: 1 });
  }

  // Gibs — mort à bout portant. Réutilise `ToyParticle`/`updateToyPhysics`
  // (voir la doc de tête) : seuls géométrie, couleur, quantité, vitesse et
  // dispersion changent pour lire « chunk » plutôt que « éclat d'impact ».

  /**
   * @param point Position de l'entité tuée au moment du coup fatal (MONDE).
   * @param direction Direction du coup fatal, normalisée — direction DE BASE
   *   de la dispersion, comme `normal` dans `spawnImpactParticles`, mais sans
   *   besoin d'être une normale de surface (une explosion n'a pas de rebond).
   */
  spawnGibs(point: THREE.Vector3, direction: THREE.Vector3) {
    this.spawnChunks(this.gibs, point, direction, GIB_GEOMETRY, GIB_MATERIAL, {
      count: GIBS_PER_KILL,
      lifetime: GIB_LIFETIME,
      spread: GIB_SPREAD,
      speedMin: GIB_SPEED_MIN,
      speedMax: GIB_SPEED_MAX,
      gravityScale: 1,
    });
  }

  /**
   * Éclats de destruction d'un `prop_*` (caisse, caddie, vitrine).
   *
   * @param point Point du coup fatal (MONDE).
   * @param direction Direction du coup fatal, normalisée.
   * @param color Couleur des éclats — voir `DEBRIS_LIFETIME` et suivantes pour
   *   pourquoi c'est un nombre et pas une matière.
   * @param count Nombre d'éclats. L'appelant le module sur la taille du prop :
   *   une vitrine ne se casse pas comme un carton.
   */
  spawnDebris(point: THREE.Vector3, direction: THREE.Vector3, color: number, count: number) {
    let material = this.debrisMaterials.get(color);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color });
      this.debrisMaterials.set(color, material);
    }
    this.spawnChunks(this.debris, point, direction, DEBRIS_GEOMETRY, material, {
      count,
      lifetime: DEBRIS_LIFETIME,
      spread: DEBRIS_SPREAD,
      speedMin: DEBRIS_SPEED_MIN,
      speedMax: DEBRIS_SPEED_MAX,
      gravityScale: 1,
    });
  }

  /**
   * Bouffée de givre — casse d'un `vitre_*` portant `givre: true` (armoires et
   * bacs surgelés). Même infrastructure jouet que les gibs/débris, mais une
   * gravité très amortie (`FROST_GRAVITY_SCALE`) : la bouffée doit flotter
   * puis retomber lentement, pas chuter comme un éclat solide.
   */
  spawnFrostBurst(point: THREE.Vector3) {
    this.spawnChunks(this.frost, point, UP_DIRECTION, FROST_GEOMETRY, FROST_MATERIAL, {
      count: FROST_COUNT,
      lifetime: FROST_LIFETIME,
      spread: FROST_SPREAD,
      speedMin: FROST_SPEED_MIN,
      speedMax: FROST_SPEED_MAX,
      gravityScale: FROST_GRAVITY_SCALE,
    });
  }

  /**
   * Casse d'un `sanitaire_*` (cuvette/urinoir) : éclats de faïence blanc
   * cassé projetés dans la direction du coup, plus une gerbe d'eau initiale
   * qui part vers le haut — jamais vers `direction` : l'eau jaillit du tuyau
   * cassé, pas dans l'axe du coup de feu (même raisonnement que
   * `spawnFrostBurst`/`UP_DIRECTION`). Réutilise `spawnChunks` telle quelle
   * (ADR 0018) : évènement rare, allouer quelques meshes ici est sans coût —
   * voir la doc de tête.
   *
   * Ne pose PAS le jet permanent : c'est `addWaterJet`, à appeler séparément
   * par l'appelant une fois la casse confirmée (deux méthodes, deux régimes
   * de coût — voir la doc de tête).
   */
  spawnCeramicBurst(point: THREE.Vector3, direction: THREE.Vector3) {
    this.spawnChunks(this.ceramic, point, direction, CERAMIC_GEOMETRY, CERAMIC_MATERIAL, {
      count: CERAMIC_COUNT,
      lifetime: CERAMIC_LIFETIME,
      spread: CERAMIC_SPREAD,
      speedMin: CERAMIC_SPEED_MIN,
      speedMax: CERAMIC_SPEED_MAX,
      gravityScale: 1,
    });
    this.spawnChunks(this.waterBurst, point, UP_DIRECTION, WATER_GEOMETRY, WATER_MATERIAL, {
      count: WATER_BURST_COUNT,
      lifetime: WATER_BURST_LIFETIME,
      spread: WATER_BURST_SPREAD,
      speedMin: WATER_BURST_SPEED_MIN,
      speedMax: WATER_BURST_SPEED_MAX,
      gravityScale: 1,
    });
  }

  /**
   * Jet d'eau PERMANENT au-dessus d'un sanitaire cassé, jusqu'à
   * `clearWaterJets`. `origin` est le bas-centre de la bbox de l'appareil
   * (au sol pour une cuvette, ~0,55 m pour un urinoir — décision de
   * l'appelant). Ce `y` sert à la fois de point d'émission ET de niveau de
   * « sol » où LES GOUTTES DE CE JET éclaboussent et repartent : chaque jet
   * a son propre plancher, jamais `SHELL_GROUND_Y` (qui suppose un sol plat
   * à `y = 0`, faux pour un urinoir en hauteur).
   *
   * Pool round-robin de `WATER_MAX_JETS` (même pattern que les decals/
   * muzzle flashes plus haut) : au-delà, le jet le plus ANCIEN est réécrit —
   * sans conséquence en pratique, le niveau n'en pose que 5.
   */
  addWaterJet(origin: THREE.Vector3) {
    const jetIndex = this.waterJetCursor;
    this.waterJetCursor = (this.waterJetCursor + 1) % WATER_MAX_JETS;

    const slot = this.waterJets[jetIndex]!;
    slot.active = true;
    slot.origin.copy(origin);
    slot.splashCursor = 0;
    this.updateWaterBounds();

    for (let d = 0; d < WATER_DROPLETS_PER_JET; d++) {
      const droplet = this.waterDroplets[jetIndex * WATER_DROPLETS_PER_JET + d]!;
      this.resetWaterDroplet(droplet, slot.origin);
      // Phase de départ tirée dans le temps de vol : sans elle, toutes les
      // gouttes partent ensemble et le jet naît comme une bouffée synchrone.
      const flight = Math.random() * ((2 * droplet.velocity.y) / -TOY_GRAVITY);
      droplet.position.addScaledVector(droplet.velocity, flight);
      droplet.position.y += 0.5 * TOY_GRAVITY * flight * flight;
      droplet.velocity.y += TOY_GRAVITY * flight;
    }
    for (let s = 0; s < WATER_SPLASHES_PER_JET; s++) {
      this.waterSplashes[jetIndex * WATER_SPLASHES_PER_JET + s]!.life = 0;
      this.waterJetMesh.setMatrixAt(WATER_DROPLET_TOTAL + jetIndex * WATER_SPLASHES_PER_JET + s, ZERO_SCALE_MATRIX);
    }
    this.waterJetMesh.instanceMatrix.needsUpdate = true;
  }

  /** Retire tous les jets d'eau — nouveau niveau, hot reload, reset de partie. */
  clearWaterJets() {
    for (const slot of this.waterJets) slot.active = false;
    for (const splash of this.waterSplashes) splash.life = 0;
    for (let i = 0; i < WATER_INSTANCE_COUNT; i++) {
      this.waterJetMesh.setMatrixAt(i, ZERO_SCALE_MATRIX);
    }
    this.waterJetMesh.instanceMatrix.needsUpdate = true;
    this.waterJetCursor = 0;
    this.updateWaterBounds();
  }

  /**
   * Sphère englobante des jets ACTIFS (appelée seulement quand un jet naît ou
   * que tous s'éteignent, jamais par frame) et visibilité du mesh : sans jet
   * actif, il ne coûte aucun lot.
   */
  private updateWaterBounds() {
    const box = this.scratchBox.makeEmpty();
    for (const slot of this.waterJets) {
      if (!slot.active) continue;
      box.expandByPoint(slot.origin);
      // Sommet du jet, et une marge horizontale pour l'éventail et les éclaboussures.
      this.scratchDir.set(slot.origin.x, slot.origin.y + WATER_JET_HEIGHT_MAX, slot.origin.z);
      box.expandByPoint(this.scratchDir);
    }
    this.waterJetMesh.visible = !box.isEmpty();
    if (box.isEmpty()) return;
    box.expandByScalar(WATER_BOUNDS_MARGIN);
    box.getBoundingSphere(this.waterJetMesh.boundingSphere!);
  }

  /**
   * Réinitialise une goutte au pied du jet : vitesse verticale tirée pour
   * viser une hauteur dans `[WATER_JET_HEIGHT_MIN, WATER_JET_HEIGHT_MAX]`
   * (`v0 = sqrt(2 · g · h)`, tir vertical sous `TOY_GRAVITY`), composante
   * horizontale aléatoire pour l'éventail de retombée. Le fait que `v0`
   * varie d'une goutte à l'autre suffit à désynchroniser la fontaine dans le
   * temps (temps de vol différent), sans avoir besoin d'un déphasage
   * explicite au premier `addWaterJet`.
   */
  private resetWaterDroplet(droplet: WaterDropletState, origin: THREE.Vector3) {
    droplet.position.copy(origin);
    const height = WATER_JET_HEIGHT_MIN + Math.random() * (WATER_JET_HEIGHT_MAX - WATER_JET_HEIGHT_MIN);
    const upSpeed = Math.sqrt(2 * -TOY_GRAVITY * height);
    const fanAngle = Math.random() * Math.PI * 2;
    const fanSpeed = WATER_FAN_SPEED_MIN + Math.random() * (WATER_FAN_SPEED_MAX - WATER_FAN_SPEED_MIN);
    droplet.velocity.set(Math.cos(fanAngle) * fanSpeed, upSpeed, Math.sin(fanAngle) * fanSpeed);
  }

  /**
   * Déclenche une éclaboussure au pied du jet `jetIndex`, round-robin parmi
   * ses `WATER_SPLASHES_PER_JET` (curseur propre à CE jet, voir
   * `WaterJetSlot.splashCursor`) — jamais de nouvelle allocation.
   */
  private triggerWaterSplash(jetIndex: number) {
    const slot = this.waterJets[jetIndex]!;
    const local = slot.splashCursor;
    slot.splashCursor = (slot.splashCursor + 1) % WATER_SPLASHES_PER_JET;

    const splash = this.waterSplashes[jetIndex * WATER_SPLASHES_PER_JET + local]!;
    splash.position.copy(slot.origin);
    splash.position.x += (Math.random() * 2 - 1) * WATER_SPLASH_JITTER;
    splash.position.z += (Math.random() * 2 - 1) * WATER_SPLASH_JITTER;
    splash.life = WATER_SPLASH_LIFETIME;
  }

  /**
   * Corps commun des gibs, débris et givre : un lot de cubes jouets projetés
   * dans un cône autour de `direction`, géométrie et matériau PARTAGÉS
   * (jamais une allocation par morceau).
   */
  private spawnChunks(
    list: ToyParticle[],
    point: THREE.Vector3,
    direction: THREE.Vector3,
    geometry: THREE.BufferGeometry,
    material: THREE.MeshLambertMaterial,
    opts: { count: number; lifetime: number; spread: number; speedMin: number; speedMax: number; gravityScale: number },
  ) {
    for (let i = 0; i < opts.count; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(point);
      // Scale non uniforme, purement cosmétique : casse la silhouette de
      // cube parfait pour lire « chunk » plutôt que « particule » à l'œil,
      // sans allouer de géométrie par morceau (la géométrie reste partagée,
      // comme PARTICLE_GEOMETRY/SHELL_GEOMETRY plus haut).
      mesh.scale.set(0.6 + Math.random() * 0.8, 0.6 + Math.random() * 0.8, 0.6 + Math.random() * 0.8);
      this.scene.add(mesh);

      // Cône jouet autour de `direction`, plus large que celui des particules
      // d'impact et légèrement plus ascendant : `Math.random()` ordinaire —
      // cosmétique, hors harnais de déterminisme (voir la doc de tête).
      const vx = direction.x + (Math.random() * 2 - 1) * opts.spread;
      const vy = direction.y + (Math.random() * 2 - 1) * opts.spread + 0.8;
      const vz = direction.z + (Math.random() * 2 - 1) * opts.spread;
      const speed = opts.speedMin + Math.random() * (opts.speedMax - opts.speedMin);
      const velocity = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(speed);

      list.push({ mesh, velocity, life: opts.lifetime, bounce: false, gravityScale: opts.gravityScale });
    }
  }

  // Update temps réel — jamais appelé depuis le pas fixe (voir la doc de tête)

  update(realDt: number) {
    this.shakeElapsed += realDt;

    for (const slot of this.muzzleFlashes) {
      if (slot.framesRemaining <= 0) continue;
      slot.framesRemaining -= 1;
      if (slot.framesRemaining <= 0) {
        slot.light.visible = false;
        slot.quad.visible = false;
      }
    }

    this.updateToyPhysics(this.particles, realDt);
    this.updateToyPhysics(this.casings, realDt);
    this.updateToyPhysics(this.gibs, realDt);
    this.updateToyPhysics(this.debris, realDt);
    this.updateToyPhysics(this.frost, realDt);
    this.updateToyPhysics(this.ceramic, realDt);
    this.updateToyPhysics(this.waterBurst, realDt);
    this.updateWaterJets(realDt);
  }

  /**
   * Simule les jets d'eau permanents : gouttes en vol (gravité jouet, comme
   * le reste du fichier) qui retombent au pied de LEUR jet, déclenchent une
   * éclaboussure, et repartent aussitôt — pool fixe, aucune allocation,
   * aucune suppression. Écrit directement les matrices d'instance de
   * `waterJetMesh` (zéro `Mesh` par goutte, contrairement à `ToyParticle`).
   */
  private updateWaterJets(realDt: number) {
    let matricesDirty = false;

    for (let j = 0; j < WATER_MAX_JETS; j++) {
      const slot = this.waterJets[j]!;
      if (!slot.active) continue;
      matricesDirty = true;

      for (let d = 0; d < WATER_DROPLETS_PER_JET; d++) {
        const idx = j * WATER_DROPLETS_PER_JET + d;
        const droplet = this.waterDroplets[idx]!;

        droplet.velocity.y += TOY_GRAVITY * realDt;
        droplet.position.addScaledVector(droplet.velocity, realDt);

        // Retombée au pied DE CE JET (pas un sol global, voir addWaterJet) :
        // éclabousse et repart aussitôt, jamais de suppression.
        if (droplet.position.y <= slot.origin.y && droplet.velocity.y < 0) {
          this.triggerWaterSplash(j);
          this.resetWaterDroplet(droplet, slot.origin);
        }

        // Échelle en FACTEURS : `WATER_GEOMETRY` mesure DÉJÀ
        // `WATER_DROPLET_SIZE`. Une échelle d'instance à `WATER_DROPLET_SIZE`
        // rendait des gouttes de 2,5 mm, dessinées mais invisibles à 640×360
        // (constaté en jeu).
        this.scratchScale.copy(WATER_DROPLET_STRETCH);
        this.scratchMatrix.compose(droplet.position, IDENTITY_QUATERNION, this.scratchScale);
        this.waterJetMesh.setMatrixAt(idx, this.scratchMatrix);
      }

      for (let s = 0; s < WATER_SPLASHES_PER_JET; s++) {
        const local = j * WATER_SPLASHES_PER_JET + s;
        const splash = this.waterSplashes[local]!;
        if (splash.life <= 0) continue; // déjà éteinte, matrice déjà à échelle nulle

        splash.life -= realDt;
        const instanceIdx = WATER_DROPLET_TOTAL + local;
        if (splash.life <= 0) {
          this.waterJetMesh.setMatrixAt(instanceIdx, ZERO_SCALE_MATRIX);
          continue;
        }

        // Grossit vite puis s'évanouit PAR L'ÉCHELLE (le matériau reste
        // opaque, voir la doc de tête — pas de tri de transparence à gérer
        // sur un InstancedMesh).
        const t = 1 - splash.life / WATER_SPLASH_LIFETIME;
        const scaleFactor =
          t < WATER_SPLASH_GROW_FRACTION
            ? t / WATER_SPLASH_GROW_FRACTION
            : 1 - (t - WATER_SPLASH_GROW_FRACTION) / (1 - WATER_SPLASH_GROW_FRACTION);
        // Cotes voulues en mètres, ramenées en facteur de la géométrie de base.
        const radial = (WATER_SPLASH_SIZE * scaleFactor) / WATER_DROPLET_SIZE;
        this.scratchScale.set(radial, WATER_SPLASH_FLATNESS / WATER_DROPLET_SIZE, radial);
        this.scratchMatrix.compose(splash.position, IDENTITY_QUATERNION, this.scratchScale);
        this.waterJetMesh.setMatrixAt(instanceIdx, this.scratchMatrix);
      }
    }

    if (matricesDirty) this.waterJetMesh.instanceMatrix.needsUpdate = true;
  }

  private updateToyPhysics(list: ToyParticle[], realDt: number) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]!;
      p.life -= realDt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        list.splice(i, 1);
        continue;
      }

      p.velocity.y += TOY_GRAVITY * p.gravityScale * realDt;
      p.mesh.position.addScaledVector(p.velocity, realDt);

      if (p.bounce && p.mesh.position.y <= SHELL_GROUND_Y && p.velocity.y < 0) {
        p.mesh.position.y = SHELL_GROUND_Y;
        p.velocity.y = -p.velocity.y * SHELL_RESTITUTION;
        p.velocity.x *= SHELL_FRICTION;
        p.velocity.z *= SHELL_FRICTION;
      }

      // Roulis jouet, purement cosmétique — aucune signification physique.
      p.mesh.rotation.x += realDt * 10;
      p.mesh.rotation.z += realDt * 7;
    }
  }
}
