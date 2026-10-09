# PROJET_CASSANDRE — contexte projet

Boomer shooter rétro façon Duke Nukem 3D / Ion Fury, en Three.js vanilla.
Prototype : 1 niveau, 3 armes (pied-de-biche, pistolet, pompe), 8-10 minutes de jeu. Ennemis : Costard, Rampant, Vigile, et le Directeur.

## Stack

Vite + TypeScript · three (vanilla) · @dimforge/rapier3d-compat · React DOM
en overlay uniquement · zustand · howler · Blender → glTF · effect · xstate
(chantier d'architecture livré, voir `docs/journal/plan-effect-xstate-2026-09.md` et invariants
#11-12 ci-dessous)

## Learning more about Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect apis and concepts that the
guide doesn't cover, search through the source code in `node_modules/effect/src`.

## Invariants — non négociables

Toute proposition qui viole un de ces points doit être **refusée avec
explication**, pas contournée.

1. **Fixed timestep 1/60.** Aucune logique de gameplay ou de physique hors du
   pas fixe. Delta clampé à 0.25 s.
2. **React ne touche jamais la boucle.** Pas de `setState` par frame. Le HUD
   s'abonne à zustand, throttlé à 10 Hz maximum.
3. **La rotation caméra n'est pas interpolée.** Elle est lue au taux
   d'affichage. L'interpoler ajoute de la latence de visée.
4. **Résolution interne 640×360**, upscalée. **`NearestFilter` à
   l'AGRANDISSEMENT sur toutes les textures** — c'est lui qui fait le gros
   pixel franc, et il ne se négocie pas. La RÉDUCTION (surfaces vues de loin)
   utilise mipmaps + anisotropie : sans eux, une texture de 128 px qui ne
   couvre plus trois pixels échantillonne au hasard, et ça grésille — du
   crénelage, pas du cachet rétro. **Amendement proposé le 2026-09-13 après un
   retour de playtest, EN ATTENTE DE VALIDATION** : voir
   [ADR 0027](docs/decisions/0027-filtrage-des-textures-reduites.md), et
   `cassandre.filtrage("nearest")` pour revenir au comportement historique en
   un appel. Monter la résolution interne ne corrige PAS ce défaut-là (plus de
   fragments qui échantillonnent au hasard) et coûte le look ;
   `cassandre.resolution(l, h)` existe pour s'en convaincre.
5. *(Retiré le 2026-09-28 — exclusivité `MeshLambertMaterial` supprimée ; les
   matériaux classiques et TSL peuvent coexister.)*
6. **Character controller = celui de Rapier** (`KinematicCharacterController`).
   Jamais d'implémentation maison capsule-vs-monde.
7. **Gravité −25 m/s².** Le réalisme donne un saut mou.
8. **Pas d'ECS** avant 12 types d'ennemis. `Entity[]` + `update(dt)` + `switch`.
9. *(Retiré le 2026-09-25 — « boîtes blanches jusqu'à la Phase 5 », dépassé.)*
10. **Aucune animation ne bloque le joueur.** Pas de rechargement immobilisant.
11. **Frontière Effect synchrone stricte.** Le pas fixe ET le rendu/
    l'interpolation passent exclusivement par `runGameplaySync`
    (`src/core/effect/runtime.ts`, `Runtime.runSync` sur `GameRuntime`) : zéro
    `Effect.tryPromise`/`Effect.promise`/`Effect.async`/`Effect.sleep` dans
    ces arbres — sinon `runSync` lève un defect (le garde-fou le rend
    bruyant en console plutôt que silencieux). Le chargement de niveau et le
    hot-reload restent à la frontière asynchrone (`GameRuntime.runPromise`/
    `runFork`, `game/level/loading/loader.ts`/`hotReload.ts`), jamais appelés depuis
    `updateGameplay`.
12. **RNG déterministe uniquement.** Jamais `Math.random()`, jamais le
    service `Random` par défaut d'Effect. Service canonique :
    `DeterministicRandom` (`src/core/effect/random.ts`), qui enveloppe mulberry32.
    Contrainte dure : le rejeu d'input (F9/F10, `core/input/inputRecorder.ts`)
    dépend de cette continuité.
13. *(Retiré le 2026-09-25 — « XState sans temps mural ».)*

## Conventions React — non négociables

Tout code React (`src/ui/`) suit quatre règles écrites, **pour l'agent
principal comme pour chaque sous-agent** (`shell`, `ui-forge`, `feel-tuner`
quand il touche au panneau de tuning). Les lire AVANT d'écrire :
[structure et rangement](docs/6-reference/react-structure.md),
[bonnes pratiques React 19.2](docs/6-reference/react-bonnes-pratiques.md),
[CSS](docs/6-reference/react-css.md), [composition](docs/6-reference/react-composition.md).

L'essentiel : **un dossier par composant** (`Button/Button.tsx` +
`Button.module.css` + ses `.ts` privés), regroupés en familles par rôle
(`components/controls/`, `hud/widgets/`, `screens/options/fields/`…), les `.ts`
partagés d'un domaine dans son `lib/`. Ne jamais utiliser `index.ts` comme
fichier-barrel. Jamais de `<style>`,
jamais de style inline hors `cssVars()` ; des primitives composées par `children` ; chaque widget du HUD
lit ses propres données du store ; un module qui persiste ou pilote le moteur
ne vit pas dans `src/ui/`. Adoptées le 2026-09-23 après un verdict sans appel
de l'utilisateur sur l'état du dossier (« la qualité du code React est
ignoble ») : ce n'est pas une préférence de style, c'est le niveau attendu.

## TypeSafe (Jev) — écarté du jeu (2026-09-20)

Le plugin `typesafe-ai` donne accès à `jev-1.13.0` : un modèle qui ne génère
rien, il répond à des questions typées sur du texte (`Choice`, `Noul`,
`Score`) par un appel réseau. **Il n'a pas sa place dans le jeu**, et trois
invariants l'interdisent, chacun suffisant : un appel réseau est asynchrone
alors que le pas fixe et le rendu passent par la frontière synchrone stricte
(#1, #11) ; le rejeu d'input exige un déroulé identique à entrées identiques,
or les probabilités du modèle ne sont pas déterministes (#12) ; et la clé
d'API partirait dans le bundle client. Ça vaut aussi pour les répliques du
héros — elles restent écrites, et tirées par le RNG déterministe.

Restait l'outillage hors-jeu (garde-fou de satire sur les marques inventées,
pré-tri des licences à confirmer, triage des retours de playtest) : **écarté
par l'utilisateur le 2026-09-20**. Aucune clé, aucune dépendance, aucun appel
dans le dépôt.

## Conventions de nommage glTF

| Préfixe | Effet à l'import |
|---|---|
| `col_*` | collider trimesh statique, mesh rendu invisible |
| `spawn_player` | position/orientation de départ |
| `spawn_suit_*` | point d'apparition Costard ; avec `groupe`, il n'apparaît qu'au réveil de ce groupe par un scénario. Mêmes règles pour `spawn_rampant_*` (Rampant) et `spawn_vigile_*` (Vigile) |
| `spawn_director_*` | point d'apparition Directeur (boss unique) |
| `trig_*` | boîte invisible du script de niveau ([ADR 0037](docs/decisions/0037-script-de-niveau.md)) : `evenement` lance un scénario de `game/session/progression/levelEvents.ts`, `replique` en fait une sous-zone à réplique de lieu |
| `door_*` | porte ANIMÉE : corps FIXE à la pose fermée, collider actif seulement fermé, mesh piloté par `DoorSystem` (`game/level/doors/doors.ts`) ; `ouverte: true` la fait naître ouverte (rideau d'arène, que le script de niveau verrouille) |
| `use_*` | objet interactif (portée 2 m) |
| `secret_*` | zone comptabilisée dans le compteur de secrets |
| `prop_*` | mobilier physique : corps dynamique libre, poussable et cassable |
| `vitre_*` | vitrage : collider cuboid tant que `solide !== false`, cassable si `pv` (`VitreSystem`, `game/level/interactions/vitres.ts`) |
| `sanitaire_*` | cuvette/urinoir façon Duke 3D : `sorte` (`cuvette`/`urinoir`) OBLIGATOIRE, cassable si `pv`, UN mesh UN matériau, pas de `col_*` jumeau (`SanitaireSystem`, `game/level/sanitaires/sanitaires.ts`, [ADR 0032](docs/decisions/0032-sanitaires-utilisables.md)) |
| `ecran_*` | écran/façade animé qui boucle sur une `chaine` (`journal`/`pub`/`mire`/`foot`/`cctv`), cassable si `pv` (neige/noir), UN mesh UN matériau, atlas `prd_chaines.png` (`EcranSystem`, `game/level/interactions/ecrans.ts`) |
| `cam_*` | empty, point de vue fixe d'une console `use_*` (extra `cameras`, liste ordonnée séparée par des virgules) — `CameraViewSystem`, `game/level/interactions/cameras.ts` |

Custom properties Blender lues sur un `prop_*` : `masse` (kg, défaut 25), `pv`
(ABSENT = indestructible, seulement poussable), `matiere` (`bois`/`carton`/
`verre`/`metal`/`farine`/`eau`/`electronique`/`gaz`, décide du son de casse et de la
couleur des débris ; `gaz` fait exploser le prop à sa casse, [ADR 0041](docs/decisions/0041-explosifs.md)) et `contenu` (chantier « Les coulisses », 2026-09-26,
format `"nom:nombre"` — ex. `"donut:1"` — ce que le prop lâche à sa casse ; un
nom qui résout en aliment connu fait apparaître ce nombre de pickups
nourriture, walk-over, position tirée du RNG déterministe). Un `prop_*` ne
porte JAMAIS de `col_*` jumeau — il construit son propre collider — et
chaque prop visible est un lot de dessin de plus : un
objet qui bouge ne rejoint jamais un lot de décor fusionné (un coût à connaître,
plus une limite — ADR 0039). Détail dans
`docs/archive/reference-conventions-nommage.md#props-physiques`,
[ADR 0030](docs/decisions/0030-props-dynamiques.md).

Custom properties Blender lues sur un `use_*` (jalon N7) : `target` (nom du
`door_*` actionné), `card` (carte de fidélité DONNÉE — `argent`/`or`/
`platine`, en fait un ramassage), `requires` (carte EXIGÉE pour agir sur
`target`), `message` (texte d'une porte LIBRE — `target` sans `requires` : le
photomaton du secret 1, la porte coupe-feu ; le sens unique d'une porte tient à
la place de son `use_*`, hors de portée depuis l'autre côté), `soin` (PV d'une
trousse), `munitions` (recharge de pistolet), `perk` et `prix` (une BORNE de
sponsor : le perk vendu et son prix en euros, les deux requis,
[ADR 0040](docs/decisions/0040-bornes-et-perks.md)) et `aliment` (chantier « Les
coulisses », VARIANTE de `soin` — `donut`/`sandwich`/`jambon`/`poulet`/`pizza`,
PV 5/10/15/25/25, voir `game/level/interactions/food.ts`) —
ces derniers se ramassent en marchant dessus, sans touche E. Une valeur inconnue est une ERREUR de `validate_level.py` et un
avertissement bruyant du loader, jamais un silence. La Platine n'a pas de
`use_*` : le Directeur la lâche à sa mort. Détail complet dans
`docs/archive/reference-conventions-nommage.md#cartes-de-fidélité`.

## Structure

```
src/app/      navigation runtime
src/core/     audio effect input loading loop
src/render/   pipeline environment sprites pickups viewmodel overlays fx debug
src/physics/  world
src/game/     player entities level session loop hud settings devtools
src/ui/       React overlay

tools/blender/        scripts headless (kit, niveaux, bake, validation, export)
tools/audio/          studio sonore (recettes, rendu, mesures, sprite, écoute)
assets_src/blender/   sources .blend (kit + niveaux), jamais servi en runtime
assets_src/library/   bibliothèque d'assets du niveau v2 (.blend + catégories Asset Browser)
assets_src/cc0_raw/   packs CC0 bruts, gitignorés (registre : assets_src/LICENCES_ASSETS.md)
public/assets/levels/ .glb exportés, seuls fichiers lus par le jeu
public/assets/sprites/ atlas 8 directions + manifestes des ennemis (générés)
public/assets/weapons/ armes en vue subjective + modèles au sol (générés)
public/assets/audio/sfx/ audio sprite (sfx.ogg/.m4a/.json) + ambiances (générés)
```

## Outillage Blender — commandes `cassandre`

Tout travail Blender sur le niveau passe par `tools/blender/cassandre.py`
plutôt que par du `bpy` écrit à la volée : les recettes (build, contrôles,
rendu, export) y sont figées, pièges compris, et rendent un JSON compact au
lieu d'un log. Détail : [`tools/blender/README.md`](tools/blender/README.md).

- **Session Blender ouverte (MCP)** : `import cassandre as C; result = C.check()`
  — l'extension `tools/blender/extension/cassandre/` met le module sur le
  chemin.
- **Headless, sous-agents compris** :
  `blender -b <f>.blend -P tools/blender/cassandre_cli.py -- <commande> cle=valeur`.
- Commandes : `status` · `build` · `check` · `shot` · `sheet` (plusieurs vues en
  UNE image) · `export` · `find` · `where` · `budget`.
- **Avant de lire du code de niveau** (`tools/level_v2/espaces/*.py` — un fichier
  par espace — ou un `lib_*.py`; `build_niveau.py` n'est que le registre
  `HABILLAGE` et `main()`) : `C.where(objet)` donne
  la ligne qui l'a posé (relevé du dernier `build()`), et
  `python3 tools/blender/api_index.py [module | --grep motif]` liste les
  fonctions sans ouvrir le fichier.
- **Jeu ↔ Blender** : `cassandre.pose()` dans la console du jeu → `C.shot("joueur")` ;
  `C.shot` rend en retour la commande `cassandre.tp(x, y, z, cap)`. Le compte de
  lots exact reste `cassandre.renderBench(3).drawCalls` en jeu ; `C.budget`
  n'est qu'une estimation (−12 % à +5 %). **Il n'y a plus de plafond de lots**
  ([ADR 0039](docs/decisions/0039-abandon-du-plafond-de-lots.md)) : ces nombres
  sont des indicateurs, pas une contrainte de décor.
- Une recette qui manque s'ajoute à `cassandre.py`, pas dans un appel MCP
  jetable.
- **Mesurer en jeu, vérifier le dépôt** : `pnpm probe` rend en un JSON les draw
  calls de `tools/probe/poses.json` (Chrome headless, ~15 s ; `-- --pose x,y,z,cap`
  pour un point) ; `pnpm verify` = typecheck + lint +
  tests, sortie réduite aux échecs (`-- --format`, `-- --level`, `-- --docs` en plus).
  Lint = Oxlint (`.oxlintrc.json`) : **erreur = garde-fou propre** (invariants #11/#12,
  pas de `any`, pas de barrel, pas de `console.log`), **avertissement = dette**
  plafonnée par `options.maxWarnings` — un nouvel avertissement casse `pnpm check`,
  et le plafond se baisse quand on en corrige. Formatage = Oxfmt (`pnpm format`).
- **Économie du direct** : `pnpm economy` relève le portefeuille sur trois
  parties types simulées (`-- --toutes` pour les variantes A/B/C et les trois
  difficultés) ; en jeu, `cassandre.economie.appliquer("A")` met une variante
  à l'essai et `cassandre.economie.journal()` rend les dons et achats réels.

## Phase courante

**v1.0.0 livrée le 2026-10-02** (MVP, open source MIT — `LICENSE`,
`CHANGELOG.md`). Les coulisses du niveau v2 sont construites ; leur fiche de
travail reste dans [`docs/assets/plan-coulisses.md`](docs/assets/plan-coulisses.md)
et son [board de références](docs/assets/board-coulisses.md).
Les plans de travail du niveau v2 et de la documentation ont été retirés du
dépôt le 2026-10-02 (commit `4e88907`) ; ils restent lisibles dans
l'historique (`git show 4e88907^:PLAN_NIVEAU_V2.md`, idem
`PLAN_DOCUMENTATION.md`).

**v1.2 « Les sponsors » : tous les lots livrés le 2026-10-04, en attente du
playtest de l'utilisateur** — bornes et perks, explosifs, Rampant et Vigile,
trois difficultés, trois rencontres, économie équilibrée par relevé simulé
(variante B en place, choix A/B/C ouvert). Compte rendu daté :
[`docs/journal/les-sponsors-2026-10.md`](docs/journal/les-sponsors-2026-10.md).

**v1.1 « Le live »** (depuis le 2026-10-03) : l'histoire d'abord.
Le plan de travail est [`PLAN_SUITE.md`](PLAN_SUITE.md), découpé en lots
autonomes (A0-A8 pour la v1.1, B1-B8 pour la v1.2) ; son tableau de suivi dit
où en est chaque lot. La bible d'histoire est
[`docs/2-fonctionnel/histoire.md`](docs/2-fonctionnel/histoire.md) : héros
sans nom civil (pseudo = la chaîne, « le Réveil »), enseigne Hyper Varan,
donateur mystère lié à la plateforme, victoire amère, **pas de second niveau
dans un magasin**. Les images des panneaux sont générées par l'utilisateur à
partir de `assets_src/panneaux/PROMPTS.md`.

Les sons sont générés avec ElevenLabs ou synthétisés (`tools/audio/`) ; la
mention ElevenLabs du `README.md` est une condition de licence, à garder.
L'état daté des chantiers livrés et des retours est conservé dans
[`docs/journal/README.md`](docs/journal/README.md).

