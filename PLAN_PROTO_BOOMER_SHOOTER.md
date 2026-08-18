# PLAN — Prototype boomer shooter (nom de code : `PROJET_CASSANDRE`)

> **Pitch** — Un youtubeur complotiste à 200 abonnés avait raison sur toute la ligne. Maintenant il est armé, et les factions qui dirigent le monde en secret sont trop occupées à se faire la guerre entre elles pour le voir venir.

---

## 0. Cadrage

### Objectif du prototype

Le proto doit répondre à **une seule question** : *est-ce que ce jeu est fun à jouer 8 minutes ?*

Il ne doit pas prouver que l'architecture tient sur 6 épisodes, ni que le pipeline d'assets scale. Toute décision qui n'aide pas à répondre à cette question est hors-scope.

### Definition of done

- Un niveau jouable de **8 à 10 minutes**, du spawn à la sortie
- Un ami s'assied, joue **sans explication préalable**, et termine le niveau
- Il relance une deuxième partie **de lui-même**

Le troisième critère est le seul qui compte vraiment.

### Dans le scope

| Élément | Quantité |
|---|---|
| Armes | 2 (pied-de-biche, fusil à pompe) |
| Types d'ennemis | 1 (Costard — État Profond) |
| Niveaux | 1 (l'hypermarché) |
| Secrets | 2 |
| Objets interactifs | 4 à 6 |
| Répliques du héros | 3 à 5 |

### Hors scope (explicitement)

Multijoueur · sauvegarde · menu d'options complet · système de progression · plus d'un type d'ennemi · musique originale · doublage pro · ECS · éditeur de niveaux maison · port mobile · optimisation.

> **Règle d'or** : chaque fois que tu ajoutes un élément hors de cette liste, tu retardes la réponse à la seule question qui compte.

---

## 1. Stack

| Domaine | Choix | Raison |
|---|---|---|
| Build | Vite + TypeScript | terrain connu, HMR instantané |
| Rendu | `three` (vanilla) | pas de reconciler dans la boucle |
| Physique | `@dimforge/rapier3d-compat` | WASM, controller kinématique inclus |
| UI / HUD | React DOM en overlay | totalement découplé du canvas |
| Bridge état→UI | `zustand` | souscriptions sélectives, throttlables |
| Audio | `howler` | pooling, spatialisation simple |
| Modélisation | Blender → glTF | pipeline standard, pas d'outil maison |
| Sprites | Aseprite (ou libre de droits) | atlas 8 directions |

**Versions à figer dès le jour 1** dans le `package.json`. Rapier casse son API entre versions mineures.

---

## 2. Architecture

### Principe fondateur

```
┌─ React (DOM overlay) ─────────────┐
│  HUD, menus, pause, debug panel   │   ← s'abonne au store, throttlé à 10 Hz
└────────────────┬──────────────────┘
                 │  zustand (lecture seule côté UI)
┌────────────────┴──────────────────┐
│  Game loop (TypeScript vanilla)   │   ← fixed timestep 1/60, jamais de setState
│  three.js  +  rapier              │
└───────────────────────────────────┘
```

**Le game loop n'appelle jamais React.** Il écrit dans le store. L'UI s'abonne avec des sélecteurs fins. Les PV n'ont pas besoin d'être re-rendus 60 fois par seconde.

### Structure de dossiers

```
src/
  core/
    loop.ts            # fixed timestep + interpolation
    input.ts           # accumulation clavier/souris, pointer lock
    time.ts            # horloge, hitstop
    audio.ts
  render/
    renderer.ts        # setup WebGLRenderer, pipeline rétro
    billboard.ts       # sprites 8 directions
    fx.ts              # screenshake, flashs, decals
  physics/
    world.ts           # wrapper Rapier, groupes de collision
  game/
    player/
      controller.ts    # déplacement
      weapons.ts       # armes + viewmodel
    entities/
      entity.ts        # interface de base
      suit.ts          # l'ennemi Costard
    level/
      loader.ts        # glTF → meshes + colliders + spawns
      interactive.ts   # caddies, micro, portes...
    state.ts           # zustand store
  ui/
    Hud.tsx  Menu.tsx  DebugPanel.tsx
  main.ts
assets/
  levels/  sprites/  textures/  audio/
```

### La boucle de jeu

C'est la fondation. La rater se paie sur toute la durée du projet — le feel devient dépendant du framerate et le rattraper après coup casse tout le tuning.

```ts
const FIXED_DT = 1 / 60;
const MAX_FRAME = 0.25;   // garde-fou anti spiral of death

let accumulator = 0;
let last = performance.now();

function frame(now: number) {
  requestAnimationFrame(frame);

  let frameTime = (now - last) / 1000;
  last = now;
  if (frameTime > MAX_FRAME) frameTime = MAX_FRAME;
  accumulator += frameTime;

  input.beginFrame();               // agrège les events depuis la dernière frame

  while (accumulator >= FIXED_DT) {
    snapshotPrevious();             // positions n-1 pour l'interpolation
    physics.step();                 // rapier, pas fixe
    updateGameplay(FIXED_DT);       // joueur, ennemis, projectiles
    accumulator -= FIXED_DT;
  }

  input.endFrame();                 // reset des "just pressed"

  const alpha = accumulator / FIXED_DT;
  interpolateVisuals(alpha);        // lerp position, slerp rotation
  fx.update(frameTime);             // screenshake : temps réel, pas fixe
  renderer.render(scene, camera);
}

requestAnimationFrame(frame);
```

**Points d'attention**

- La **caméra ne s'interpole pas**. La rotation vue vient directement de la souris, à la fréquence d'affichage. L'interpoler ajoute de la latence perçue.
- Le **hitstop** se fait en scalant `FIXED_DT` de gameplay, pas en sautant des steps physiques.
- Les **effets visuels** (shake, flash) tournent en temps réel, pas en pas fixe.

### Le look rétro

Deux approches, dans l'ordre chronologique :

**Phase 0 — le pas cher.** Canvas en résolution interne basse, upscalé par le CSS.

```ts
renderer.setPixelRatio(1);
renderer.setSize(640, 360, false);   // false = ne touche pas au style CSS
```

```css
canvas {
  width: 100vw; height: 100vh;
  image-rendering: pixelated;
}
```

**Plus tard — le vrai.** `WebGLRenderTarget` en 640×360 avec `NearestFilter`, puis quad plein écran. Nécessaire dès que tu veux du post-processing (dithering, réduction de palette, vignettage).

Dans les deux cas, sur **toutes** les textures :

```ts
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter;
texture.generateMipmaps = false;
texture.colorSpace = THREE.SRGBColorSpace;
```

Matériaux : `MeshLambertMaterial` uniquement. Pas de PBR, pas de `MeshStandardMaterial`. Le look Build vient de l'absence de spécularité.

### Sprites 8 directions

`THREE.Sprite` ne convient pas (il billboard sur les 3 axes, les ennemis penchent quand tu regardes en l'air). Il faut un `PlaneGeometry` qui ne tourne que sur le yaw.

```ts
// 1. Orienter le plan vers la caméra, yaw uniquement
mesh.rotation.y = Math.atan2(
  camera.position.x - mesh.position.x,
  camera.position.z - mesh.position.z
);

// 2. Choisir la frame selon l'angle de vue relatif à l'orientation de l'ennemi
const toCam = new THREE.Vector3()
  .subVectors(camera.position, enemy.position)
  .setY(0).normalize();

const fwd = enemy.forward;  // déjà normalisé, Y = 0

const angle = Math.atan2(
  fwd.x * toCam.z - fwd.z * toCam.x,   // produit vectoriel (composante Y)
  fwd.x * toCam.x + fwd.z * toCam.z    // produit scalaire
);

const dir = Math.round(
  ((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)
) % 8;

// 3. Offset UV dans l'atlas
material.map.offset.set(dir / 8, row / ROWS);
```

Atlas : 8 colonnes (directions) × N lignes (frames d'animation). Une seule texture, un seul matériau, `InstancedMesh` si tu dépasses 30 ennemis à l'écran.

---

## 3. Phases

Estimations en **soirées** (~2h) et **week-ends** (~6h), pour un dev seul avec un travail à côté.

---

### Phase 0 — Socle technique
**~2 soirées**

**Livrables**
- Projet Vite + TS + three + rapier qui build
- Boucle fixed timestep avec interpolation
- Pipeline de rendu rétro (640×360 upscalé)
- Pointer lock + capture souris/clavier
- Panneau de debug (FPS, position, nombre d'entités) en React overlay
- Une salle boîte blanche avec sol + 4 murs + colliders

**Critère de validation**
Un cube tourne dans la salle. 60 fps stable. Tu bloques l'onglet 3 secondes (breakpoint dans la console) : au retour, rien n'explose et rien ne traverse un mur.

**Piège**
Vouloir déjà bien structurer. À ce stade, un seul fichier de 200 lignes est acceptable.

---

### Phase 1 — Le déplacement
**~2 week-ends** — *phase la plus importante du plan*

**Livrables**
- `KinematicCharacterController` de Rapier configuré (autostep, max slope, snap-to-ground)
- Accélération / friction / air control
- Saut, chute, atterrissage
- Head bob, FOV qui s'élargit légèrement en course
- Une "gym" : rampes, marches, plateformes, un couloir long, un espace ouvert

**Valeurs de départ à tuner**

| Paramètre | Valeur initiale |
|---|---|
| Vitesse marche | 9 m/s |
| Vitesse course | 13 m/s |
| Temps pour atteindre vitesse max (sol) | 0.08 s |
| Temps d'arrêt complet | 0.10 s |
| Gravité | −25 m/s² |
| Hauteur de saut | 1.1 m (→ v₀ ≈ 7.4 m/s) |
| Contrôle aérien | 35 % de l'accélération sol |
| Capsule | rayon 0.4 m, hauteur 1.2 m |
| Hauteur des yeux | 1.6 m |
| Autostep | 0.35 m |
| Pente max | 50° |

La gravité n'est **pas** à −9.81. Le réalisme donne un saut mou et flottant. Tous les FPS rapides trichent.

**Critère de validation**
Tu passes 2 minutes à courir et sauter dans la gym **sans arme et sans ennemi**, et c'est déjà agréable. Si ce n'est pas le cas, n'avance pas — aucune arme ne rattrapera un déplacement mou.

**Rollback**
Si après 3 sessions de tuning le déplacement reste mou, le problème n'est probablement pas dans les valeurs mais dans la boucle : vérifie l'interpolation, la latence souris (le `mousemove` doit être lu hors du pas fixe), et le clamp du delta.

---

### Phase 2 — Armes et feel de tir
**~2 week-ends**

**Livrables**
- Pied-de-biche : hitbox sphérique en avant, portée 2 m
- Fusil à pompe : 9 plombs, cône de dispersion 5°, raycasts Rapier
- Viewmodel (sprite ou plan texturé) avec bob et recul
- Muzzle flash 2 frames + lumière ponctuelle très courte
- Impacts : decals, particules, son matériau-dépendant
- **Hitstop** de 3 frames (50 ms) à l'impact
- **Screenshake** court : amplitude 0.15, durée 120 ms, décroissance exponentielle
- Douilles éjectées (physique jouet, pas de collision précise)

**Critère de validation**
Tirer sur un mur vide est satisfaisant. Tu vides un chargeur juste pour le plaisir. **Sans aucun ennemi dans la scène.**

**Piège**
Aucune animation de rechargement qui bloque le joueur. Le pompe se réarme pendant que tu bouges.

---

### Phase 3 — L'ennemi Costard
**~2 week-ends**

**Livrables**
- Système de billboard 8 directions + atlas
- Machine à états : `IDLE → ALERTE → POURSUITE → TIR → RECUL → MORT`
- Navigation simple : ligne droite + raycast d'évitement (**pas de navmesh**)
- Attaque hitscan avec télégraphie visuelle (frame d'anticipation + son)
- Feedback de dégâts : flash blanc sur le sprite, knockback, son
- Mort : animation 4 frames, puis cadavre persistant
- Gibs sur mort par pompe à bout portant

**Critère de validation**
Un combat contre 3 Costards dans la gym est **lisible** (tu sais toujours qui te tire dessus) et **tendu** (tu recules, tu circules, tu ne restes pas planté).

**Rollback**
Si les perfs s'écroulent à 10 ennemis, arrête et profile. C'est un signal d'architecture, pas d'optimisation. Ne l'ignore pas pour avancer.

**⚠️ Point de décision majeur**
Fin de Phase 3, tu as la réponse à la question du proto. **Si le combat n'est pas fun ici, il ne le sera pas dans un joli niveau.** Arrêter à ce stade est un résultat valide, pas un échec — tu auras dépensé ~6 week-ends au lieu de 6 mois.

---

### Phase 4 — Pipeline de niveau
**~1 week-end**

**Livrables**
- Loader glTF avec conventions de nommage :
  - `col_*` → collider trimesh statique, mesh invisible
  - `spawn_player`, `spawn_suit_*` → points d'apparition
  - `trig_*` → volumes de trigger
  - `door_*`, `use_*` → objets interactifs
- Hot reload : détection du fichier modifié → rechargement de la scène sans redémarrer

**Critère de validation**
Tu déplaces un mur dans Blender, tu exportes, et tu le vois en jeu **en moins de 60 secondes**. Chronomètre-le vraiment.

**Rollback**
Si cette phase déborde sur un deuxième week-end, ne t'obstine pas : bascule sur TrenchBroom + un parser `.map` (~300 lignes, format texte simple), ou accepte des niveaux en géométrie plus grossière.

---

### Phase 5 — Le niveau : l'hypermarché
**~3 week-ends**

**Layout**

```
   [E] Bureau directeur ←── badge ──┐
        │                            │
   [D] Réserve / quai ───────────────┘
        │
   [C] Rayons ──── secret 2 (toit, via palettes)
        │
   [B] Caisses / entrée ──── secret 1 (mur cassable, surgelés)
        │
   [A] Parking (spawn)
```

| Zone | Rôle | Contenu |
|---|---|---|
| **A — Parking** | tutoriel implicite | Aucun ennemi. Un Costard visible **derrière la vitrine**, hors d'atteinte : il apprend le danger sans le punir. Le pied-de-biche au sol. |
| **B — Caisses** | premier combat | 3 Costards. Espace ouvert, couverture derrière les caisses. Le pompe est ici. |
| **C — Rayons** | combat en couloirs | Embuscades latérales entre les gondoles. Caddies poussables. Le micro d'annonces. |
| **D — Réserve** | montée en intensité | 5 Costards, verticalité (mezzanine, palettes empilées). |
| **E — Bureau** | révélation + sortie | Le directeur. Sa peau se déchire quand tu tires : reptilien. Le badge tombe. Punchline. Porte de sortie. |

**Objets interactifs** (la signature Duke — ne pas couper)
- Caddies physiques poussables
- Micro d'annonces (déclenche une réplique du héros dans les haut-parleurs)
- Toilettes utilisables (+1 PV, réplique dédiée)
- Rayon surgelés qui explose en verre + givre
- Écrans de surveillance montrant une autre pièce du niveau
- Machine à pinces (contient un secret dérisoire)

**Critère de validation**
Un ami termine le niveau sans aide en 8-10 minutes et trouve au moins 1 secret sur 2.

---

### Phase 6 — Habillage
**~2 week-ends**

**Livrables**
- HUD React en overlay de stream : PV, munitions, compteur de « vues » qui monte à chaque kill
- 3 à 5 répliques du héros, déclenchées contextuellement (premier kill, secret trouvé, PV bas)
- Nappe sonore + une piste de musique (libre de droits pour le proto)
- Écran de mort et écran de fin de niveau
- Menu principal minimal (Jouer / Quitter)
- Rebinding des touches (ou au moins support AZERTY — tu es en France)

**Critère de validation**
La blague fonctionne. Quelqu'un rit au moins une fois. Une seule suffit pour valider le ton.

---

## 4. Récapitulatif

| Phase | Charge | Cumul |
|---|---|---|
| 0 — Socle | 2 soirées | ~4 h |
| 1 — Déplacement | 2 week-ends | ~16 h |
| 2 — Armes | 2 week-ends | ~28 h |
| 3 — Ennemi | 2 week-ends | ~40 h |
| 4 — Pipeline niveau | 1 week-end | ~46 h |
| 5 — Le niveau | 3 week-ends | ~64 h |
| 6 — Habillage | 2 week-ends | ~76 h |

**≈ 12 week-ends**, soit 3 à 4 mois à un rythme soutenable. Multiplie par 1.5 si tu produis toi-même tous les assets graphiques.

---

## 5. Pièges connus

1. **Construire un moteur au lieu d'un jeu.** Le symptôme : tu as passé un week-end sur un système et tu ne peux pas décrire ce que le joueur en voit.
2. **ECS trop tôt.** Pour 1 ennemi et 2 armes : `Entity[]`, une méthode `update(dt)`, un `switch` sur le type. L'ECS arrive quand tu as 12 types d'ennemis et que la douleur est réelle.
3. **Character controller maison.** Utilise celui de Rapier. C'est le trou noir classique où partent 6 semaines.
4. **Assets avant gameplay.** Boîtes blanches jusqu'à la Phase 5. Un joli niveau ne rend pas un combat mou intéressant, il retarde juste le diagnostic.
5. **React dans la boucle.** Un `setState` par frame et tu perds le combat avant de l'avoir commencé.
6. **Delta time non clampé.** Le joueur change d'onglet, revient, et traverse trois murs.
7. **Interpoler la caméra.** Ajoute de la latence perçue à la visée. La rotation vue est lue au taux d'affichage, pas au pas fixe.
8. **Tuner le feel sans fixed timestep.** Tout ton tuning devient dépendant de ta machine.

---

## 6. Attaque en multi-agent

Le plan se découpe naturellement pour ton workflow Claude Code :

- **Phases 0 et 4** (socle, pipeline glTF) : très bien déléguées. Contrat clair, critère de validation mécanique, peu de jugement esthétique.
- **Phases 1, 2, 3** (feel) : **délègue le squelette, tune à la main.** Un agent te sort un character controller correct en 20 minutes, mais aucun agent ne sait si ton saut est agréable. Le tuning est irréductiblement manuel.
- **Phase 5** (level design) : la géométrie se délègue, le rythme non.
- **Phase 6** (HUD React) : entièrement délégable, c'est ton terrain habituel.

Un `CLAUDE.md` à la racine avec les invariants du projet — fixed timestep, pas de React dans la boucle, matériaux Lambert uniquement, conventions de nommage glTF — évite la dérive d'architecture entre sessions.

---

## 7. Après le proto

Uniquement si les 3 critères de la *Definition of done* sont remplis :

1. Deuxième type d'ennemi (le Reptilien) → valide que le bestiaire scale
2. Troisième arme → valide la boucle d'armement
3. Deuxième niveau → valide le pipeline sur la durée
4. Sauvegarde / checkpoints
5. **Puis seulement** : ECS, éditeur, optimisation, Steam

---

## Note d'écriture

Le complotisme charrie des tropes toxiques — « les Illuminati », « ceux qui contrôlent la finance mondiale » sont des recyclages directs d'imaginaires antisémites. La ligne à tenir, qui est aussi la plus drôle : **la satire vise la culture de la croyance, jamais des cibles réelles.** Institutions fictives, absurde assumé, méchants ostensiblement lézards. Un héros à la Punisher qui exécute des conspirateurs est comique tant que les conspirateurs sont des aliens ; il devient glauque dès qu'ils ressemblent à des personnalités identifiables.

C'est un choix d'artisanat autant que d'éthique : ce jeu-là vieillira bien.
