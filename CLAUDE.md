# PROJET_CASSANDRE — contexte projet

Boomer shooter rétro façon Duke Nukem 3D / Ion Fury, en Three.js vanilla.
Prototype : 1 niveau, 2 armes, 1 type d'ennemi, 8-10 minutes de jeu.

## Stack

Vite + TypeScript · three (vanilla) · @dimforge/rapier3d-compat · React DOM
en overlay uniquement · zustand · howler · Blender → glTF · effect · xstate
(chantier d'architecture livré, voir `PLAN_EFFECT_XSTATE.md` et invariants
#11-13 ci-dessous)

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
5. **`MeshLambertMaterial` uniquement.** Pas de PBR, pas de
   `MeshStandardMaterial`, pas de map de rugosité ni de métalness.
6. **Character controller = celui de Rapier** (`KinematicCharacterController`).
   Jamais d'implémentation maison capsule-vs-monde.
7. **Gravité −25 m/s².** Le réalisme donne un saut mou.
8. **Pas d'ECS** avant 12 types d'ennemis. `Entity[]` + `update(dt)` + `switch`.
9. **Boîtes blanches jusqu'à la Phase 5.** Pas d'assets finaux avant que le
   gameplay soit validé.
10. **Aucune animation ne bloque le joueur.** Pas de rechargement immobilisant.
11. **Frontière Effect synchrone stricte.** Le pas fixe ET le rendu/
    l'interpolation passent exclusivement par `runGameplaySync`
    (`src/core/runtime.ts`, `Runtime.runSync` sur `GameRuntime`) : zéro
    `Effect.tryPromise`/`Effect.promise`/`Effect.async`/`Effect.sleep` dans
    ces arbres — sinon `runSync` lève un defect (le garde-fou le rend
    bruyant en console plutôt que silencieux). Le chargement de niveau et le
    hot-reload restent à la frontière asynchrone (`GameRuntime.runPromise`/
    `runFork`, `game/level/loader.ts`/`hotReload.ts`), jamais appelés depuis
    `updateGameplay`.
12. **RNG déterministe uniquement.** Jamais `Math.random()`, jamais le
    service `Random` par défaut d'Effect. Service canonique :
    `DeterministicRandom` (`src/core/random.ts`), qui enveloppe mulberry32.
    Contrainte dure : le rejeu d'input (F9/F10, `core/inputRecorder.ts`)
    dépend de cette continuité.
13. **XState sans temps mural.** Interdiction des transitions retardées
    `after` (`setTimeout` réel). Toute durée d'état vit dans
    `context.stateTimer`, décrémentée par un évènement `TICK` envoyé une
    fois par pas fixe avec le `gameplayDt` réel (hitstop inclus) — voir
    `game/entities/enemyMachine.ts`. Sinon le hitstop ne ralentirait plus
    les ennemis, régression invisible mais réelle.

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
| `spawn_suit_*` | point d'apparition Costard |
| `spawn_director_*` | point d'apparition Directeur (boss unique) |
| `trig_*` | volume de trigger (box), mesh invisible |
| `door_*` | porte ANIMÉE : corps FIXE à la pose fermée, collider actif seulement fermé, mesh piloté par `DoorSystem` (`game/level/doors.ts`) |
| `use_*` | objet interactif (portée 2 m) |
| `secret_*` | zone comptabilisée dans le compteur de secrets |
| `prop_*` | mobilier physique : corps dynamique libre, poussable et cassable |
| `vitre_*` | vitrage : collider cuboid tant que `solide !== false`, cassable si `pv` (`VitreSystem`, `game/level/vitres.ts`) |

Custom properties Blender lues sur un `prop_*` : `masse` (kg, défaut 25), `pv`
(ABSENT = indestructible, seulement poussable) et `matiere` (`bois`/`carton`/
`verre`/`metal`, décide du son de casse et de la couleur des débris). Un
`prop_*` ne porte JAMAIS de `col_*` jumeau — il construit son propre collider —
et **chaque prop visible est un lot de dessin de plus, définitivement** : un
objet qui bouge ne rejoint jamais un lot de décor fusionné. Détail dans
`docs/reference/conventions-nommage.md#props-physiques`,
[ADR 0030](docs/decisions/0030-props-dynamiques.md).

Custom properties Blender lues sur un `use_*` (jalon N7) : `target` (nom du
`door_*` actionné), `card` (carte de fidélité DONNÉE — `argent`/`or`/
`platine`, en fait un ramassage), `requires` (carte EXIGÉE pour agir sur
`target`), `message` (texte d'une porte LIBRE — `target` sans `requires` : le
photomaton du secret 1, la porte coupe-feu ; le sens unique d'une porte tient à
la place de son `use_*`, hors de portée depuis l'autre côté), `soin` (PV d'une
trousse) et `munitions` (recharge de pistolet) —
ces deux derniers se ramassent en marchant dessus, sans touche E. Une valeur inconnue est une ERREUR de `validate_level.py` et un
avertissement bruyant du loader, jamais un silence. La Platine n'a pas de
`use_*` : le Directeur la lâche à sa mort. Détail complet dans
`docs/reference/conventions-nommage.md#cartes-de-fidélité`.

## Structure

```
src/core/     loop input time audio
src/render/   renderer billboard fx
src/physics/  world
src/game/     player entities level state
src/ui/       React overlay

tools/blender/        scripts headless (kit, niveaux, bake, validation, export)
assets_src/blender/   sources .blend (kit + niveaux), jamais servi en runtime
assets_src/library/   bibliothèque d'assets du niveau v2 (.blend + catégories Asset Browser)
assets_src/cc0_raw/   packs CC0 bruts, gitignorés (registre : assets_src/LICENCES_ASSETS.md)
public/assets/levels/ .glb exportés, seuls fichiers lus par le jeu
public/assets/sprites/ atlas 8 directions + manifestes des ennemis (générés)
public/assets/weapons/ armes en vue subjective + modèles au sol (générés)
```

## Phase courante

> **Sons : de vrais enregistrements CC0 (2026-09-20), DEUXIÈME ÉCOUTE EN
> ATTENTE.** Quatorze des vingt SFX ne sont plus synthétiques : le pompe et le
> pistolet sont de VRAIES armes (Winchester Model 12, Colt 1911 — « The Free
> Firearm Sound Library », CC0), le reste vient des packs audio CC0 de Kenney.
> La recette est dans `tools/audio/import_sfx.py` (quelle prise devient quel
> son), les packs au registre `assets_src/LICENCES_ASSETS.md`, les archives
> brutes dans `assets_src/cc0_raw/` (gitignoré).
>
> **La première passe a été REJETÉE à l'écoute** (« c'est trop bizarre le son
> des armes, je n'aime pas du tout »). Trois causes mesurées, dont deux étaient
> des défauts de la chaîne — tableaux de mesures dans
> [HUD et audio](docs/systems/hud-audio.md#pourquoi-cette-chaîne) :
> 1. **La somme stéréo creusait le son.** Ces prises sont au couple ESPACÉ
>    (0,89 ms entre canaux, corrélation −0,03) : les additionner est un filtre
>    en peigne, qui retirait **5 à 6 dB entre 60 et 600 Hz**. `un_canal()`
>    mesure maintenant la corrélation et garde UN canal quand elle est faible.
> 2. **Le rééchantillonnage n'avait pas de filtre anti-repliement.** À
>    22 050 Hz par simple interpolation, tout ce qui dépassait 11 kHz revenait
>    se plier dans l'aigu (+2,8 dB mesurés en 9–11 kHz) : on perdait le
>    claquement ET on le remplaçait par du grésillement. Sortie à **44 100 Hz**,
>    `passe_bas()` avant toute décimation. Vingt sons pour moins de 400 Ko.
> 3. **Les prises n'ont AUCUN grave et saturent** — 0,1 % de l'énergie sous
>    200 Hz, ~60 % entre 600 et 1500 Hz, et 2 à 5 ms d'échantillons à pleine
>    échelle dans CHAQUE fichier de la bibliothèque. Ça ne se corrige pas par
>    traitement, ce qui manque n'est pas dans le fichier : `Grave` le
>    reconstruit sous la prise (sinusoïde qui plonge + bruit filtré, graine
>    fixe). Part de l'énergie 60–200 Hz : **0,1 → 26,9 %** au pompe, **0 →
>    17,1 %** au pistolet, facteur de crête inchangé (23,5 dB).
>
> Corrigé aussi côté jeu : `SfxDef.pitch` descend la variation de hauteur à
> ±2,5 % sur les armes (±8 % par défaut). Sur un vrai enregistrement, ±8 % font
> presque un ton et demi — l'arme change de calibre à chaque tir.
> **Six sons restent synthétiques**, faute d'équivalent CC0 : les quatre
> vocalisations de Costard (aucun pack CC0 n'a de grognements) et les deux
> portes mécaniques du niveau v2 (porte automatique, rideau métallique).
> **Un agent n'entend pas** : `tools/audio/audition.py` écrit une page locale
> (`http://localhost:5173/audition/`) qui met côte à côte, par son, les
> versions déjà écoutées (dont celle qui a été rejetée), celle qui est
> installée, des variantes de TRAITEMENT et des variantes de PRISE, toutes
> passées par la même chaîne et le même encodeur. Le verdict d'écoute se note
> dans la table d'`import_sfx.py`. **Garder les versions précédentes est le
> point clé** : sans elles, une écoute dit si un son plaît, jamais si on a
> progressé depuis la dernière.
>
> **Troisième passe en direct dans Blender (2026-09-19), EN ATTENTE DU VERDICT
> DE PLAYTEST.** Retour après validation de la passe précédente : « des vraies
> portes qui bougent, des vraies vitres, et il est où mon rayon surgelés ? ».
> - **Cause racine des portes** : depuis la porte à badge de la Zone E
>   (2026-08-23), AUCUNE porte n'avait jamais bougé à l'écran. Le jeu faisait
>   glisser le CORPS Rapier — invisible — et coupait son collider ; rien ne
>   recopiait cette pose sur le mesh. Seuls les `prop_*` le faisaient. Corrigé
>   par `game/level/doors.ts::DoorSystem` ([ADR 0031](docs/decisions/0031-portes-animees-et-vitres.md)) :
>   corps FIXE à la pose fermée, collider actif seulement fermé, mesh animé au
>   pas fixe. Quatre mouvements en extras (`battant`, `coulisse`, `monte`,
>   `descend`), groupes de vantaux, et portes `auto` qui s'ouvrent devant qui
>   s'approche — joueur OU Costard, le bake de navigation les traversant.
> - **Le niveau passe de 5 boîtes grises à 20 vantaux** : sas d'entrée à
>   portes automatiques vitrées, va-et-vient « PRIVÉ » de la réserve, rideau
>   métallique de la carte Argent, portes doubles Or/sortie/coupe-feu, quatre
>   portes de bureau, porte capitonnée du Directeur. Un vantail est UN mesh à
>   UN matériau (deux matériaux = deux primitives glTF = un groupe que le
>   loader ne reconnaît plus), quincaillerie et verre pris dans sa propre
>   texture (`tools/textures/generate_portes.py`).
> - **Portes manœuvrables à la main** (retour du 2026-09-20) : les quatre
>   portes de bureau ne s'ouvrent plus par proximité, mais à la touche E
>   (`manuelle: true`) ; elles gardent `auto: "ennemis"` pour que les Costards
>   les poussent et que le graphe de navigation les traverse. La porte
>   coupe-feu des rayons se REFERME à la main (`manuelle: "fermer"`) sans
>   perdre son sens unique : son bouton, hors de portée côté rayons, reste le
>   seul moyen de l'ouvrir.
> - **Vitres réelles** (`vitre_*`, `VitreSystem`) : la transparence n'a jamais
>   été interdite par l'invariant #5, qui porte sur le MODÈLE D'ÉCLAIRAGE —
>   plusieurs docstrings de `lib_*.py` affirmaient le contraire et ont privé le
>   niveau de verre pendant tout N9. Cloisons vitrées de l'étage et panneaux du
>   sas CASSABLES (`pv`), fenêtres sur la ville et verrières de la galerie
>   incassables et sans collider (`solide: false` — un collider au plafond
>   serait pris pour le sol par le bake de navigation). Les verrières étaient
>   jusqu'ici fermées par un panneau blanc OPAQUE : le ciel de nuit ne s'y
>   voyait pas, contrairement à ce qui avait été annoncé à la passe précédente.
> - **Rayon surgelés**, promis par le plan depuis le premier jour et jamais
>   construit : six armoires à portes vitrées contre le mur ouest dans le
>   prolongement du frais, deux bacs congélateurs à couvercles vitrés, douze
>   marques inventées de plus (`prd_surgeles`, atlas qui porte à la fois des
>   faces et deux bandes), bandeau et lumière froide. Casser une vitre lâche
>   du givre (`givre: true`).
> **Budget de lots, remesuré en jeu à quinze points de vue** : ce qui ne
> fusionne jamais coûte par objet DANS LE CÔNE, occultation comprise. Vingt
> vantaux coûtaient jusqu'à 13 lots dans une vue, le verre découpé en cellules
> jusqu'à 6, et les `use_*` n'avaient AUCUN élagage (21 lots depuis les
> caisses, dont une trousse à 150 m). Remèdes : `BatchedMesh` par matériau pour
> les vantaux (6 lots pour 20), un seul lot pour tout le verre, élagage à 48 m
> des `use_*`. Pire vue mesurée **188/200**, contre 219 avant ces trois
> correctifs et 198 avant toute la passe — tableau dans
> [Ce que coûte une image](docs/systems/cout-de-rendu.md#ce-qui-ne-fusionne-jamais).
> Mesuré aussi : `validate_level.py --strict` 0 erreur et 7 warnings connus,
> `audit_niveau.py` à zéro partout, plan de masse relié, graphe de navigation
> qui traverse sas, va-et-vient et portes de bureau, `pnpm build` propre,
> `pnpm test` 282/282. **Non vérifié** : jouer — la sensation d'une porte qui
> s'ouvre devant soi, casser une vitre au fusil, le combat derrière les
> cloisons vitrées de l'étage.
>
> **Deuxième passe en direct dans Blender (2026-09-18, soir), EN ATTENTE DU
> VERDICT DE PLAYTEST.** Retours : lampadaires mal placés devant l'entrée,
> secrets incompréhensibles, couloir des bureaux qui débouche en hauteur sur
> les rayons, Costards qui apparaissent dans les props, accès au Directeur
> incohérent — et deux envies : un ÉTAGE de bureaux avec le Directeur au bout,
> une skybox. Tout est à la source (`plan_de_masse.py`, `build_niveau.py`), bâti
> dans la session live :
> - **Étage des bureaux** (z = 4, au-dessus d'un vide) : escalier de service
>   derrière la porte Or (collider en rampe lisse, marches rendues à ±10 cm),
>   couloir aux fenêtres de nuit, quatre bureaux derrière des cloisons
>   (vidéosurveillance, comptabilité, RH, salle de pause), et au bout le
>   **bureau du Directeur** (son portrait est le présentateur reptilien du mur
>   d'écrans), dont l'issue de secours termine le niveau. `poser()` place tout
>   meuble d'après ses VRAIES cotes et le côté où regarde sa façade.
> - **Raccourci** de plain-pied, fermé par une **porte coupe-feu** à sens
>   unique (`PORTES_SENS_UNIQUE` au plan, bouton hors de portée côté rayons).
>   Nouveau concept moteur : la porte LIBRE (`use_*` avec `target` sans
>   `requires`, `onDoorUse`, testé).
> - **Secrets réels**, au lieu de volumes au sol qu'on traversait en passant :
>   labo derrière un pan de mur que le photomaton efface ; campement sur le
>   toit des gondoles (caisse, puis deux allées à sauter) ; couvée reptilienne
>   dans le local VMC, par la bouche au-dessus d'un distributeur (l'ancienne
>   chaîne passait par un frigo de 2,20 m, infranchissable). Récompense dans
>   chacun. `plan.PASSAGES` rétrécit une façade commune à une vraie porte.
> - **Spawns recalés à la construction** (`recaler_spawns`) : posés sur le sol
>   réel (quai à 3 m, rampe) puis écartés des colliders et des props, chaque
>   déplacement au journal ; onze l'étaient. L'audit a un contrôle « spawns
>   encombrés ».
> - **Skybox de nuit** : `LevelDef.ciel`, cubemap en `scene.background`
>   (`render/ciel.ts`, `tools/textures/generate_ciel.py`, docs/systems/rendu.md#ciel).
> - Lampadaires : deux encadrent l'entrée, tête vers elle, les autres dans les
>   files de places. Armoires et fauteuils de bureau n'ont plus de rayures de
>   chantier (bandes de bordure projetées au hasard).
> **Budget de lots, le point à surveiller** : 188 lots de décor (187 avant) ;
> pire vue mesurée **198/200** (haut de la rampe de sortie vers le sud), à
> cause de ce qui ne fusionne jamais — le ciel, deux portes, six récompenses.
> La fusion groupe par matériau ET jeu d'attributs : un mesh sans `Col` ne
> rejoint pas un mesh qui en porte un. Un matériau neuf dans une cellule de
> 48 m coûte un lot : habiller une cachette avec la matière de la pièce
> qu'elle prolonge. Mesuré : audit à zéro partout (spawns compris),
> `validate_level.py --strict` 0 erreur et 7 warnings (tous connus), graphe de
> navigation relié (escalier, étage, Directeur, cachettes ; pas les toits),
> `pnpm build` propre, `pnpm test` 226/226. **Non vérifié** : jouer — le saut de
> toit en toit, la porte coupe-feu à la vraie touche E, le combat à l'étage.
>
> **Reprise de la carte en direct dans Blender (2026-09-18), EN ATTENTE DU
> VERDICT DE PLAYTEST.** Retour : « des incohérences entre le parking souterrain
> et le couloir des bureaux, beaucoup de props mal placés à l'électroménager ».
> **Méthode décidée avec l'utilisateur** : on travaille dans le Blender OUVERT
> via le MCP (regarder à hauteur d'œil, corriger, re-regarder), mais chaque
> correction va dans les scripts, et `build_niveau.py` est relancé DANS la
> session live (≈ 10 s), jamais en headless. Le `.blend` reste un produit
> régénérable. Ce qui a été trouvé en regardant, et corrigé à la source :
> 1. **13 jonctions sur 21 ouvraient sur le vide** : deux voisins aux plafonds
>    de hauteurs différentes, façade percée sur toute la hauteur — 6,5 m aux
>    deux rampes du souterrain, d'où l'on voyait PAR-DESSUS le toit du parking.
>    `poser_linteaux` pose des linteaux (et des impostes au-dessus des portes)
>    RENDUS SEULEMENT, sans collider : la règle « aucun linteau » du blockout
>    visait le bake de navigation, qu'un mesh sans collider ne touche pas.
> 2. **Plafond d'une rampe = pente**, plus un plat au point haut ; **le sol
>    d'une rampe porte des UV** (il sortait en gris uni). Rampes du souterrain en
>    béton, secteur personnel (couloir de direction, montée et couloir de
>    service) en béton et plâtre usé. Les couloirs ont des luminaires visibles
>    (la lumière sortait de nulle part). Rampes gardées à 37°, sur décision.
> 3. **Souterrain redessiné sur UNE trame** : piliers tous les 8 m, places de
>    5 m perpendiculaires aux allées, voitures DANS les places (elles étaient
>    en travers de l'allée), rampe de sortie encadrée par deux piliers.
> 4. **Électroménager recomposé par zone** : l'entrée dégagée (une étagère et
>    trois téléviseurs AU SOL y barraient le passage), le mur d'écrans
>    autonome face à l'entrée — `suit_el2/3/5` sont VRAIMENT derrière,
>    `suit_el1` VRAIMENT dans une cabine (vérifié contre les colliders ; ni
>    l'un ni l'autre n'était vrai avant). Téléviseurs Kenney tournés vers la
>    salle (ils regardaient le mur depuis N9 : ils font face au −y local comme
>    le reste de la bibliothèque, donc `rot 90` contre un mur ouest). Cabines
>    où l'on entre (un collider plein fermait leur ouverture), rangées
>    d'appareils au collider à leur silhouette (un bloc de 1,90 m arrêtait les
>    tirs au-dessus des lave-linge). Carte Or dans la cabine nord-est, ouverte
>    au sud : la carte est un repère plat, vue par la tranche sinon.
> **Piège payé une fois, corrigé** : `audit_niveau.py` désactivait tout le
> décor pour ses rayons sans le restaurer — sans effet en headless, mais dans
> une session ouverte l'export suivant (`use_visible`) n'écrivait que les
> colliders (722 Ko de `.glb`). Il restaure maintenant l'état. **Autre piège** :
> la session Blender ouverte peut être PLUS VIEILLE que le `.blend` sur disque
> (une reconstruction headless ne la recharge pas) — vérifier avant de
> sauvegarder depuis elle. Mesuré : 0 trou, 0 bord ouvert, 0 interpénétration,
> 0 objet flottant ; `validate_level.py --strict` 0 erreur et les 9 warnings
> déjà connus ; 187 lots de décor, pire vue mesurée 190/200 (haut de la rampe
> de sortie) ; graphe de navigation relié partout où il faut ; `pnpm test`
> 224/224. **Non vérifié** : le ressenti en jouant. **Écart connu, pas
> corrigé** : le couvert « pilier » déclaré pour `suit_so4` n'existe pas (ni
> avant ni après) ; `MAX_STEP_HEIGHT` du graphe (1,0 m) dépasse la marche des
> ennemis (0,35 m), d'où les 5 cm de marge sur les colliders d'appareils.
>
> **Props physiques — livrés (2026-09-17), corrigés après playtest
> (2026-09-18).** Un préfixe `prop_*` donne au niveau du mobilier qui BOUGE :
> corps dynamique Rapier libre, poussable par le joueur et les ennemis (les deux
> character controllers appliquaient déjà des impulsions aux corps dynamiques),
> cassable au tir si le `.glb` lui donne des `pv`. Runtime :
> `game/level/props.ts` (`PropSystem`, reconstruit à chaque chargement comme le
> graphe de navigation et le pool de lampes), branché aux quatre moments de la
> boucle (`snapshotPrevious` / `update(hitEvents)` avant `physics.step` /
> `syncFromPhysics` après / `interpolate` au taux d'affichage, APRÈS le bloc
> caméra). Destruction = collider et corps DÉSACTIVÉS (jamais retirés du monde,
> voir l'ADR), mesh caché, évènement lu par `updateFx` qui pose les débris et le
> son (`prop_break_wood`/`prop_break_glass`, même pipeline Python que les 12
> autres). **Groupe de collision `PROP` séparé de `WORLD`**, décision centrale
> de l'[ADR 0030](docs/decisions/0030-props-dynamiques.md) : la ligne de vue
> ennemie et le bake du graphe de navigation filtrent sur `WORLD` seul et sont
> calculés UNE FOIS au chargement — un prop en `WORLD` laisserait, une fois
> poussé, un trou de navigation et un bloqueur de vue fantômes. Conséquence
> assumée : **un prop ne protège pas** (les balles ennemies le traversent).
>
> **Deux corrections après le premier playtest (« je n'ai pas trouvé de
> physique »), toutes deux dans la révision de l'ADR 0030 :**
> 1. **Placement.** Les six props du premier jet étaient tous dans deux espaces
>    à l'écart ; le hub — 48 m qu'on est OBLIGÉ de parcourir — n'en portait
>    aucun. Le placement passe maintenant par une table unique
>    (`PROPS_PHYSIQUES` dans `build_niveau.py`, appelée pour TOUT espace depuis
>    `main()`) couvrant les dix espaces : **51 props**, dont des piles de 2-3
>    qui s'écroulent. Règle qui manquait : *un prop doit être sur le chemin, pas
>    dans une pièce qu'on peut sauter.*
> 2. **Le modèle de coût annoncé était FAUX.** « Un lot par prop visible » avait
>    été mesuré dans une pièce close. La vérité est *un lot par prop dans le
>    CÔNE DE VUE* : three.js n'élimine que par le cône, jamais par occlusion, et
>    un prop ne peut pas rejoindre un lot fusionné. Mesuré : 37 props sur 51
>    dessinés depuis le spawn du parking, **210 lots pour un budget de 200**.
>    Corrigé par un **élagage par distance** (`PROP_RENDER_DISTANCE_SQ`, 36 m)
>    dans `PropSystem.interpolate` — coût retombé à **+6 lots à la galerie, +8
>    au hub, +6 au spawn**. Ce qui compte n'est donc pas le nombre total de
>    props mais leur DENSITÉ locale.
>
> **Piège d'export, payé une fois (2026-09-18)** : un `.glb` livré au jeu
> contenait TOUTE la bibliothèque `_LIB` — 1 153 nœuds de trop, 47 Mo au lieu de
> 29, tous les patrons d'assets empilés à l'origine du monde — alors que le
> `.blend` était sain. Cause : un export qui ne passe pas par
> `tools/blender/export_level.py`, seul endroit qui pose `use_visible=True`
> (l'interface de Blender ne coche pas cette case par défaut). Un `.glb` faux ne
> lève RIEN en jeu, il se charge. `export_level.py` vérifie donc désormais le
> fichier qu'il vient d'écrire et échoue sur tout nœud hors du view layer ou
> issu de `_KIT`/`_LIB` — garde-fou testé contre la vraie reproduction du
> défaut. **Si la ligne `[export] contenu vérifié` n'apparaît pas, le `.glb`
> n'est pas fiable.**
>
> Vérifié en jeu : 51 props chargés aux bonnes cotes, budget mesuré à trois
> points (pire point du niveau : la galerie à 195 lots, dont 189 de décor
> pré-existant), et surtout **une pile de trois cartons renversée en marchant
> dedans par le VRAI chemin de rejeu d'input** (carton du bas poussé de 54 cm,
> celui du milieu de 66 cm, celui du haut tombé de 1,24 m à 0,30 m et projeté à
> 1,94 m). `validate_level.py --strict` : 0 erreur, 9 warnings tous
> pré-existants. `audit_niveau.py` : 0 trou, 0 bord ouvert, 0 interpénétration,
> 0 objet flottant — il a trouvé 5 encastrements de props contre du décor déjà
> posé, tous corrigés. `pnpm build` propre, `pnpm test` vert (224/224).
> **Non vérifié** : tirer réellement à la souris sur une caisse, et la sensation
> à la manette/au clavier (verrouillage du pointeur hors de portée de
> l'automatisation, même limitation que d'habitude).

> **Armes du joueur — vrais modèles (2026-09-13), EN ATTENTE DU VERDICT DE
> PLAYTEST.** Pied-de-biche et pompe en 3D basse définition, tenus par les
> avant-bras du « Man in Long Sleeves » CC0 posés par IK
> ([ADR 0029](docs/decisions/0029-armes-en-vue-subjective.md),
> `tools/blender/build_weapons.py`). Placement à l'écran réglé DANS BLENDER
> (repère de l'œil), animations procédurales en TypeScript : balayage autour
> du coude, coup de pompe (le fût et la main gauche reculent), changement
> d'arme (descente / remontée). Horloges au pas fixe dans `WeaponSystem`, qui
> ne retardent jamais un tir (invariant #10, testé). Les armes passent devant
> les murs grâce à `gl.depthRange(0, 0.05)` ; l'éclair du pompe naît au bout du
> canon ; `use_crowbar`/`use_shotgun` montrent la vraie arme posée au sol.
> Vérifié en jeu : placement, balayage, pompage, changement d'arme par la
> touche 1, mur, éclair, ramassages du niveau v2. **Non vérifié** : un vrai tir
> à la souris (verrouillage du pointeur hors de portée de l'automatisation) et
> la sensation en mouvement.

> **Ennemis — vrais sprites animés (2026-09-13), EN ATTENTE DU VERDICT DE
> PLAYTEST.** L'atlas numéroté est remplacé par des sprites 8 directions
> pré-rendus depuis le « Man in Suit » CC0 de Quaternius
> ([ADR 0028](docs/decisions/0028-sprites-ennemis-pre-rendus.md)) : Costard en
> costume noir, cravate rouge, lunettes noires ; Directeur en costume beige,
> peau `revele` verte à crête posée par `setAtlas` à la révélation. Vingt
> lignes par atlas : repos, alerte, course (6 frames entraînées par la
> DISTANCE parcourue), visée à deux mains, tir avec éclair, recul, mort
> (6 frames, un plongeon en avant). Régénérer : `render_enemy_sprites.py`
> (`tools/blender/README.md`), le jeu lit le manifeste JSON au démarrage.
> Horloges d'animation dans le contexte XState (`animClock`,
> `strideDistance`, `timeSinceShot`), avancées au pas fixe, lues par le rendu
> seul. Vérifié en jeu (gym et niveau v2) : les huit directions, la course,
> la visée, le tir, les six frames de mort et la bascule de peau. **Pas
> encore jugé en jouant** ; chaque ennemi visible reste un lot de dessin sur
> un budget de 186/200.
> **Passe de lisibilité (2026-09-14)** après « trop low res » : la cause
> mesurée est le budget de pixels (38 px de haut à 11 m) et un modèle fin et
> sombre, pas le filtrage. Membres épaissis, tête ×1,22, veste ardoise, plastron
> blanc, lunettes et cravate élargies, atlas à 96 px/m (1920 × 3840, ~118 Mo de
> VRAM pour les trois), normales des quads inclinées de 45° vers le haut pour
> capter les néons. Résolution interne inchangée (invariant #4). Détail :
> ADR 0028, section « Révision du 2026-09-14 ».

> **Playtest complet du niveau v2 (2026-09-16) : « y a encore beaucoup de
> boulot ».** Retour après la première traversée de bout en bout : trop
> d'éléments pas à leur place ou en collision, et des trous qui font tomber
> dans le vide. Nouvel outil `tools/level_v2/audit_niveau.py` (trous de sol,
> bords ouverts sur le vide, interpénétrations, objets flottants) — à lancer
> APRÈS chaque construction, au même titre que `validate_level.py`. Il a
> trouvé les deux vraies chutes, toutes deux structurelles : le mur nord des
> rayons percé sur toute sa hauteur sous le couloir de service (un passage à
> sens unique reçoit désormais un PARAPET côté bas), et la porte de sortie qui
> donnait sur rien — la fin de niveau n'était armée que pour l'ancienne porte
> `door_e_exit` (`estPorteDeSortie`, plus un palier derrière la sortie).
> Un **filet de chute** (`game/session/fallRescue.ts`) remet le joueur sur le
> dernier sol touché au-delà de 12 m de chute, et écrit les coordonnées du trou
> en console : un trou coûte désormais trois secondes, plus une partie.
> État de l'audit après cette passe : **0 trou, 0 bord ouvert, 0
> interpénétration, 0 objet flottant**. Ce qui reste, et que l'audit ne sait
> PAS voir : la composition, l'échelle, ce qui « fait faux » à l'œil — donc un
> deuxième playtest.
>
> **Chantier Niveau v2 — En cours (2026-09-13) : N0, N1, N3, N4 (gate de
> richesse PASSÉ), N5, N7 et N8 livrés (gate de STRUCTURE PASSÉ — l'utilisateur
> a joué le blockout et validé), N6 validé, N2 presque (quatre licences à
> confirmer). N9, l'habillage, est CONSTRUIT de bout en bout : prérequis de
> rendu (N9.0), puis les dix espaces en cinq lots (N9.1 rayons, N9.2 caisses +
> galerie, N9.3 hub + électroménager, N9.4 réserve + souterrain, N9.5 parking +
> cafétéria + bureaux), enfin l'entrée des packs CC0 Kenney (N9.6). **Plus un
> seul volume gris.** Jouable sous `Niveau v2 — habillé`.**
>
> **TROIS CHOSES ATTENDENT L'UTILISATEUR, et rien ne devrait avancer sans
> elles :**
> 1. **Le verdict de playtest sur N9** — aucun lot n'a encore été validé ; le
>    critère du plan est « verdict positif à chaque lot ».
> 2. **L'amendement de l'invariant #4** proposé par l'[ADR 0027](docs/decisions/0027-filtrage-des-textures-reduites.md),
>    après un retour « ça pixelise au loin » : mipmaps + anisotropie à la
>    RÉDUCTION, gros pixel conservé à l'agrandissement. Le code tourne déjà
>    ainsi pour qu'il juge sur pièce ; `cassandre.filtrage("nearest")` revient
>    en arrière en un appel.
> 3. **Quatre licences à confirmer** dans `assets_src/LICENCES_ASSETS.md`
>    (`retro3d_car`, `retro3d_office`, `pensamientoazul_supermarket`,
>    `aquilarius_retro_textures`) : tant qu'elles sont marquées « à confirmer »,
>    ces packs NE S'UTILISENT PAS — c'est la règle du registre. Les trancher
>    demande d'ouvrir chaque page source, une action utilisateur.
>
> **Deux dettes techniques connues avant N10** : le **BAKE** (le niveau n'a
> aucune ombre portée, c'est le dernier écart visuel avec la salle d'essai de
> N4) et le **budget de lots de dessin, à 186 sur 200** — tout ajout de décor
> passe d'abord par la mutualisation des matériaux ou `BatchedMesh`.
> Refonte complète du niveau, détail jalon par jalon (N0-N10) dans
> `PLAN_NIVEAU_V2.md`. Point de départ : la passe du 2026-09-10 (poser les
> 9 pièces du kit jamais utilisées, via `level-forge` en scripts headless)
> a été conservée mais jugée insuffisante après avoir joué. Décisions :
> structure en hub à la Duke 3D (10 espaces, cartes de fidélité comme
> clés), bibliothèque d'assets tirée de **packs CC0 harmonisés**, **textures
> rétro 64-128 px réintroduites** (style Build / Ion Fury, hypermarché
> resté dans son jus années 90), marques d'emballage inventées, travail
> **en direct dans Blender via le MCP officiel Blender Lab** (Blender 5.1,
> `localhost:9876`, que `level-forge` ne peut pas piloter en l'état). Deux
> pistes en parallèle : structure → blockout gris joué, et salle d'essai
> « rayons » pour valider la richesse. Le niveau actuel reste jouable
> jusqu'à la bascule (N10). Contraintes à connaître avant de dessiner : un
> seul sol praticable par colonne (pathfinding 2.5D). **L'occlusion des
> lignes de vue, elle, est fiable — mesuré à N5 (ADR 0025, qui remplace
> l'ADR 0022)** : une rangée couvre, une allée ne couvre rien, et rien sous
> 1,6 m ne bloque un rayon (1,8 m face au Directeur). Le décor statique est
> fusionné au chargement par matériau **et par cellule de 48 m** (ADR 0023,
> granularité révisée par l'ADR 0026 à N9) : sans la découpe, un lot couvre
> toute la carte et le tri d'écart n'élimine plus rien — une pièce close de
> 28 × 26 m dessinait 82 836 triangles, contre 11 184 après. **La bonne taille
> de cellule DÉPEND de l'habillage et se re-mesure** : 32 m sur le blockout
> gris, 48 m dès trois espaces habillés (un décor texturé porte bien plus de
> matériaux par cellule, et le nombre de lots suit le nombre de matériaux). Budget mesuré du
> niveau v2 : **1 500 000 triangles, 200 lots de dessin, 48 lampes allumées**
> (les 200 000 triangles posés a priori à N1 étaient trop prudents d'un ordre
> de grandeur ; ce sont les LAMPES qui font mur, et le shader ne compile plus
> du tout au-delà de ~255 sans lever la moindre exception — d'où le pool de
> `src/render/lightPool.ts`). `cassandre.lightBudget()` rapporte l'état du
> pool ; une lampe éteinte par lui apparaît en `visible: false` dans
> `cassandre.lighting()` — c'est le premier réflexe quand un espace paraît trop
> sombre. Bake en `--type diffuse` (lumière seule) dès qu'il y a des textures ;
> un plafond n'a jamais de collider (le bake du pathfinding le prendrait pour
> le sol).
> **Piège de banc de mesure** : `cassandre.player.spawn(...)` ne déplace pas la
> caméra tant que la boucle d'affichage ne tourne pas, et elle ne tourne pas
> dans un onglet masqué — une série de mesures « à différentes positions » peut
> être six fois la même vue sans que rien ne le trahisse. Poser
> `camera.position`/`lookAt` à la main ; le témoin est `Steps: 0` au panneau de
> debug. **Le pathfinding n'a réellement fonctionné en jeu qu'à partir du
> 2026-09-11** (graphe vide depuis M4, faute de `refreshSceneQueries()` au
> chargement) : tout retour de playtest sur le comportement des ennemis
> est à lire à cette lumière.
> Bibliothèque d'assets du niveau v2 : **deux modules générés par code**,
> `tools/blender/lib_rayons.py` (37 assets, la surface de vente : gondoles,
> produits, bandeaux de catégorie) et `tools/blender/lib_facade.py` (l'avant-
> magasin et la galerie : caisses, portiques, kiosques, devantures à rideau
> baissé, photomaton, machine à pinces) et `tools/blender/lib_electro.py`
> (l'électroménager et le carrefour : mur d'écrans, cabines de démonstration,
> rangées de gros blanc, estrade du micro). **Un appareil électroménager est une
> boîte blanche avec une façade dessinée** — un hublot peint dans l'albedo fait
> un lave-linge à 640×360 — et `tools/blender/lib_reserve.py` (l'arrière du
> magasin : racks à palettes, portes de quai, fûts, suspensions industrielles,
> voitures, piliers de béton) et `tools/blender/lib_bureaux.py` (cafétéria et
> bureaux). **Pour une surface qui ne veut AUCUN motif** — une carrosserie, un
> pneu, un vitrage — utiliser `uv="aplat:#rrggbb"`, qui mappe tout sur un pavé
> de `palette.png`, le nuancier commun : une carrosserie texturée en plâtre
> taché se lit comme un matelas, pas comme une voiture sale.
> **Packs CC0 tiers : le critère d'admission est le nombre de MATÉRIAUX, pas le
> style.** Le budget sous tension du niveau est le nombre de lots de dessin, et
> un pack à vingt textures séparées en coûterait vingt. Deux voies existent,
> toutes deux dans `lib_helpers.import_kit` : un pack à atlas unique se
> requantifie sur la palette (`make_kenney_atlas.py`, multi-packs) ; un pack
> SANS texture, dont les matériaux ne sont que des couleurs nommées (le Kenney
> Furniture Kit, 140 modèles), s'importe avec `repeindre=True`, qui reporte
> chaque teinte sur `palette.png` — tout le kit tient alors dans un matériau.
> **Deux pièges d'échelle** : les kits Kenney sont à des proportions de jouet
> (une berline à 4,40 m de long sort à 2,24 m de HAUT), d'où `dimensions=(x,y,z)`
> qui remet chaque axe à sa cote ; et les modèles arrivent longueur le long de
> **+Y** (conversion Y-up → Z-up de l'import glTF).
> **Un pack marqué « à confirmer » dans `assets_src/LICENCES_ASSETS.md` NE
> S'UTILISE PAS** — c'est la règle du registre lui-même. `retro3d_car`,
> `retro3d_office`, `pensamientoazul_supermarket` et `aquilarius_retro_textures`
> sont dans ce cas : trancher demande d'ouvrir chaque page source, une action
> utilisateur (reliquat de N2).
> Cinq atlas de bandes et d'étiquettes, tous PLEINS : trois de bandes
> (`trim_hypermarche`, `sig_bandeaux`, `sig_facade`) et trois d'étiquettes
> (`prd_etiquettes`, `prd_kiosque`, `prd_ecrans`) ; `uv="label:<nom>"` accepte
> `front="+z"` pour un objet posé à plat (une pile de journaux se regarde d'en
> haut) ; `lib_hypermarche_v2.blend` est un produit
> régénérable, jamais un fichier qu'on édite à la main. Salle d'essai jouable
> via le menu dev (`salle_essai_rayons`). Trois règles de bake nées de N4 :
> **subdiviser** toute grande surface (un bake par sommet exige des sommets,
> sinon mesh noir), **`--ambient`** (une salle close n'a aucune lumière
> d'environnement), **`--emissive-marker`** (une source ne s'éclaire pas
> elle-même). Et surtout : un niveau baké NE DOIT PAS rester en
> `LevelDef.lighting: "temps-reel"`, sans quoi le soleil hérité de la Phase 1
> multiplie tout le bake par une direction arbitraire.
> **Le niveau v2 habillé se construit PAR-DESSUS le blockout, pas à côté**
> (`tools/level_v2/build_niveau.py` importe `build_blockout`) : la structure
> validée à N8 n'est jamais redessinée, seuls changent les matériaux de la
> coque, les plafonds (toujours sans collider), les lampes et le contenu des
> espaces habillés. Le registre `HABILLAGE` décide quels espaces sont habillés ;
> les autres gardent leurs volumes GRIS, exprès — le niveau reste jouable de
> bout en bout à chaque lot, et ce qui est gris est ce qui reste à faire.
> **Piège de subdivision** : `lib_helpers.subdivide(cible)` s'arrête quand plus
> aucune arête ne dépasse `cible × 1.5` — la garantie réelle est 1,5 fois la
> valeur passée. Pour tenir le seuil d'un sommet par m² de `validate_level.py`,
> passer 0,6 et non 1,0.
> **Piège d'UV des enseignes** : `lib_helpers._uv_trim` mappe U depuis la
> coordonnée MONDE — ce qu'il faut pour une plinthe qui se poursuit sans
> raccord d'une boîte à la suivante, un piège pour une enseigne (le mot tombe
> où il veut selon l'endroit où l'objet est posé, d'où des panneaux
> « CAISSE CAISS »). Pour tout panneau porteur de TEXTE, utiliser
> `uv="enseigne:<bande>"`, calé sur le panneau. Les trois atlas de bandes
> (`trim_hypermarche`, `sig_bandeaux`, `sig_facade`) sont PLEINS : huit bandes
> de 16 px occupent exactement les 128 px d'une texture, un besoin nouveau
> demande un atlas de plus.
> **Piège de construction de niveau, le plus coûteux du chantier** : habiller un
> espace REMPLACE l'appel à `bo.volumes()`, qui ne pose pas que du décor —
> c'est lui qui construit la plateforme de quai de la réserve ET SA RAMPE, seul
> accès au parking souterrain. Un habillage qui ne les reconstruit pas coupe le
> niveau en deux, sans aucune erreur. Vérifier le graphe de navigation après
> chaque lot, pas seulement les comptes.
> **Piège de mesure** : `render_ingame --eye` est une cote MONDE, pas une
> hauteur au-dessus du sol local — cadrer le souterrain (z = −6) à `--eye 1.6`
> place la caméra au-dessus de son plafond, et rend une image vide qui n'est
> pas une pièce vide.
> Dans `build_niveau.py`, le sol et le
> plafond sont posés PAR DÉFAUT pour tout espace, et seuls les espaces listés
> dans `SOL_SUR_MESURE`/`PLAFOND_SUR_MESURE` s'en chargent eux-mêmes. Le défaut
> inverse a déjà été payé : un espace habillé se retrouvait sans sol.
> **Piège de l'outil de rendu** : `render_ingame.py` reconstruit
> `texture × attribut Col`, et un nœud Attribut dont le nom n'existe pas sur le
> mesh renvoie du NOIR, pas du neutre. Un niveau pas encore baké sortait donc
> entièrement noir — on croit le niveau éteint alors que c'est l'outil qui ment.
> Corrigé (masque blanc posé d'office sur les meshes sans `Col`) ; l'outil
> applique aussi le pool de 48 lampes par point de vue, sans quoi une capture
> promet une luminosité que le jeu ne tient pas.
> **Éclairage hybride, limite levée (N9)** : la note de l'ADR 0024 « il faudra
> un pool réaffecté au-delà d'une centaine de lampes » est réglée — `LightPool`
> n'en laisse que 48 allumées, les plus proches, classées sur la distance au
> BORD de leur sphère d'influence (`distance − light.distance`) et non sur la
> distance à la lampe. Un niveau sous le budget n'est jamais touché.
> Après le gate : les rayons sont **thématiques** (six catégories, l'unité de
> cohérence est la FACE de gondole, atlas de bandeaux `sig_bandeaux.png`) et
> l'éclairage imite un plafond de néons — **la forme de la source fait l'ombre**
> (tubes de 3,9 × 0,3 m, rien au-dessus des rangées, quelques tubes morts).
> Consigne pour la suite : **voir grand** sur la taille des pièces et de la
> carte, l'exploration prime (les 16 × 20 m de la salle d'essai sont un
> plancher, pas un gabarit).
> **Éclairage hybride (ADR 0024, 2026-09-12)** : un niveau v2 porte ses propres
> lampes (empties `light_*` en Blender → `THREE.PointLight`), le bake ne cuit
> plus que l'indirect (`--pass indirect --domain corner`) et la couleur de
> sommet ne porte plus l'éclairage mais **l'ombre**. `LevelDef.lighting` choisit
> le régime par niveau (`temps-reel` par défaut, `bake`, `hybride`) — les zones
> A-E restent en `temps-reel`, leur bascule se décide à N10. Limite connue :
> three.js évalue toutes les lampes par fragment, il faudra un pool réaffecté
> au-delà d'une centaine (à traiter en N9). `cassandre.lighting()` en console
> sépare éclairage temps réel et couleur cuite.
>
> **Chantier Effect-TS/XState (M0-M9) — Livré (2026-09-04).** Détail jalon
> par jalon dans `PLAN_EFFECT_XSTATE.md`. Effect orchestre maintenant toute
> la boucle jeu — gameplay (M6), raycasting (M3), pathfinding (M4), rendu et
> interpolation (M7) — derrière une frontière synchrone stricte unique
> (`runGameplaySync`, invariant #11 ci-dessus) ; `loader.ts`/`hotReload.ts`
> sont entièrement retrofités vers Effect (M2, erreurs typées, mêmes
> comportements observables qu'avant — principe transverse #4 du plan).
> Costard et Directeur partagent désormais une seule machine XState
> (`enemyMachine.ts`, M5) au lieu de deux implémentations dupliquées. Le
> flux d'écran (menu → jeu → mort/fin de niveau → reset) tourne sur une
> machine XState dédiée (`gameFlowMachine.ts`, M8) au lieu de
> `window.location.reload()` — vrai reset en place, plus de rechargement de
> page. Un vrai pathfinding 2.5D existe maintenant (`PathfindingService`,
> M4) ; aucune zone existante n'a été retouchée pour l'exploiter (hors
> scope, décision actée en §0 du plan) — poser un ennemi sur une mezzanine
> reste une décision de level design séparée à prendre consciemment.
>
> **Action §11.2 du plan ("retirer la note de duplication Suit/Director de
> CLAUDE.md") vérifiée sans effet à faire ici** : aucune note de ce type
> n'existe littéralement dans ce fichier — le seul endroit qui la
> documentait était les commentaires de tête de `suit.ts`/`director.ts`,
> déjà mis à jour AU jalon M5 lui-même ("dédupliqué avec lui au jalon M5").
> Rien à retirer dans ce fichier.
>
> **Écart trouvé pendant M9, corrigé le 2026-09-05** (tâche de suivi
> dédiée, hors scope du jalon documentation lui-même) : le RNG déterministe
> n'était pas unifié derrière le service `DeterministicRandom` malgré
> l'invariant #12 — `weapons.ts` (dispersion du pompe) et
> `enemyMachine.ts::createEnemyPrng` gardaient chacun leur propre copie
> locale de mulberry32 plutôt que d'obtenir leur générateur via ce service.
> Les deux routent maintenant vers `DeterministicRandom.forSeed` (via
> `runGameplaySync(DeterministicRandom.useSync(...))`, même pattern que les
> appels `RaycastService.use(...)` déjà en place) ; `mulberry32` n'existe
> plus qu'à un seul endroit, `src/core/random.ts`. Aucune régression de
> déterminisme (même algorithme, mêmes graines) : `pnpm build`/`pnpm test`
> verts (116/116) avant et après, y compris les tests à valeurs de
> référence de `random.test.ts`/`suit.test.ts`/`director.test.ts` qui
> recalculent l'algorithme indépendamment plutôt que de comparer le code à
> lui-même.
>
> `pnpm build` propre, `pnpm test` vert (116/116) au moment de ce jalon.
> Skills mis à jour pour refléter ces patterns : `enemy-state-machine`
> (pathfinding + machine XState partagée), `fixed-timestep-loop`
> (`runGameplaySync`), `react-hud-bridge` (pont XState → zustand, même
> discipline que le reste du HUD), `gltf-level-conventions` (retrofit
> Effect de `loader.ts`/`hotReload.ts`) ; nouveau skill dédié
> `effect-xstate-cassandre` pour les deux patterns propres à ce projet
> (frontière synchrone stricte, timer manuel au lieu de `after`) que les
> agents spécialisés (`core-loop`, `entity-designer`, `level-pipeline`,
> `shell`) peuvent charger sans redécouvrir le plan à chaque fois.
>
> Phase 6 — Habillage, livrée (2026-08-24). Décomposée et routée par l'agent
> `director` vers `core-loop` (rebinding) puis `shell` (tout le reste) — voir
> `PLAN_PROTO_BOOMER_SHOOTER.md`, section "Phase 6", pour les 6 livrables du
> plan (HUD stream, répliques du héros, musique/nappe, écran de mort, écran
> de fin de niveau, menu principal + rebinding AZERTY).
> **Rebinding réel** (`src/core/input.ts`, `GameAction`/`DEFAULT_BINDINGS`,
> persistance `localStorage`) : constat au passage, le moteur d'input lisait
> déjà `KeyboardEvent.code` (position physique, indépendant du layout) —
> ZQSD fonctionnait donc déjà nativement en AZERTY avant cette tâche, sans
> aucun code neuf. Ce qui manquait réellement, c'est le remapping par-dessus
> (`RebindScreen.tsx`, écran "Options" du menu principal).
> **HUD de prod** (`src/ui/Hud.tsx`) façon overlay de stream (webcam
> factice, badge "EN DIRECT", compteur de "vues" — la blague du HUD, gain
> aléatoire disproportionné par kill, ×4 pour le Directeur) + PV/munitions.
> **5 répliques du héros** sur un canal dédié (`state.heroLine`, distinct de
> `state.hudMessage` — l'un est une réaction de personnage avec cooldown
> global 15s, l'autre une info système factuelle sans cooldown), ducking
> musical -6dB/400ms à chaque réplique (`core/music.ts`).
> **Écran de mort réel** : `playerHp` pouvait déjà tomber à 0 sans aucun
> effet avant cette tâche — trou comblé, `isDead` stoppe maintenant tout le
> gameplay au sommet d'`updateGameplay` (le pas fixe continue de tourner,
> invariant #1, seul le contenu du pas est ignoré). **Écran de fin de
> niveau** : détection générique par franchissement du plan de `door_e_exit`
> une fois déverrouillée (projection vectorielle sur l'axe local le plus fin
> du vantail, transformé par sa rotation réelle — pas de coordonnées en dur,
> ne se déclenche jamais sur un niveau qui n'a pas cette porte). "Rejouer"/
> "Retour au menu" : rechargement de page complet (`screenNav.ts`), pas de
> reset en place — aucun système du jeu n'expose aujourd'hui de chemin de
> reset complet, en construire un aurait été disproportionné pour une tâche
> d'habillage.
> **Musique + nappe** (`core/music.ts`) : deux pistes synthétiques de plus
> (même pipeline stdlib Python que les 12 SFX existants), PLACEHOLDER SONORE
> ASSUMÉ — à remplacer par un vrai morceau libre de droits dès que possible,
> aucun accès réseau côté agent pour en choisir un.
> **Deux bugs trouvés et corrigés après coup, à la revue humaine du travail
> des agents** (pas par les agents eux-mêmes) : (1) le bloc webcam/vues du
> nouveau `Hud.tsx` était posé en haut-gauche, exactement sur `DebugPanel`
> (toujours monté, coin haut-gauche depuis la Phase 1) — texte des deux
> illisible, entrelacé, constaté en jeu par capture d'écran. Déplacé en
> haut-droite (`Hud.tsx`/`HeroLine.tsx`), `DebugPanel` non touché (outil de
> dev établi, hors sujet). Un second chevauchement, interne au HUD cette
> fois (légende sous la webcam vs. bloc "vues" juste en dessous, 7px
> d'écart), a suivi immédiatement après le premier déplacement — espacement
> corrigé. (2) `RebindScreen.tsx` acceptait `e.code` sans le valider :
> un événement clavier synthétique avec un `code` vide (constaté avec
> l'outil de test navigateur utilisé pour cette vérification, jamais produit
> par un vrai clavier physique) corrompait silencieusement le binding vers
> `""` — plus aucune touche ne déclenchait l'action, jusqu'à
> "Réinitialiser". Garde ajoutée (`if (!e.code) return;`).
> Vérifié en jeu après ces deux corrections : `pnpm build` propre, menu
> principal → Options → rebind d'une touche → Retour, sans chevauchement ;
> "Jouer" → niveau complet, HUD lisible dans les deux coins hauts, PV/
> munitions cohérents avec l'état réel (`activeWeapon: "none"` → "À MAINS
> NUES" sur ce niveau qui démarre désarmé, comportement historique
> inchangé).
> **Non vérifié en conditions réelles** (même limitation d'environnement que
> pour la porte à badge et les secrets — `document.visibilityState: hidden`
> gèle la boucle à pas fixe entière en automatisation navigateur, empêchant
> tout déclenchement par vraie entrée du joueur) : mourir pour de vrai
> (écran + boutons), franchir `door_e_exit` jusqu'à l'écran de fin, entendre
> la nappe/musique et le ducking, rebinder avec de vraies touches physiques,
> et surtout le critère de validation du plan lui-même — **« la blague
> fonctionne, quelqu'un rit »** — qui ne peut être jugé que par un humain en
> train de jouer.
>
> Phase 5 — Le niveau (l'hypermarché). Livrée. Détail zone par zone
> ci-dessous, conservé pour référence.
> **Écran de choix de niveau** au boot (`src/ui/LevelMenu.tsx` + registre
> `src/game/level/levels.ts`) : "Gym (test)" / "Zone A — Parking", chemins
> MUTUELLEMENT EXCLUSIFS (plus de coexistence additive gym+niveau par
> défaut — ça produisait du z-fighting réel, constaté). `?level=<id
> enregistré>` saute le menu ; `?level=<nom>` non enregistré retombe sur
> l'ancien comportement additif brut (outil de test isolé du loader, pas un
> chemin joueur). `window.cassandre.level.load(name)` en console peut
> toujours recréer l'additif volontairement, pour ce même usage de test.
> **Zone A — Parking** codée et fonctionnelle : géométrie construite et
> exportée directement depuis Blender (`public/assets/levels/zone_a_parking.glb`,
> géométrie visible en plus des colliders — voir piège ci-dessous). Parking
> clos, vitrine (fente horizontale 1.2-2.0m — ligne de vue dégagée, aucun
> chemin au sol), un Costard scellé dans une alcôve à 20m (au-delà
> d'`attackRange`, en-deçà de `sightRange` : visible, jamais punitif, aucun
> code IA nouveau nécessaire — vérifié par décodage direct du `.glb`). Pied-
> de-biche au sol (`use_crowbar`) : le joueur démarre désarmé dans cette
> zone uniquement (`WeaponSystem.startUnarmed()` / `pickUpMelee()`,
> `activeWeapon: "none"|"melee"|"shotgun"`), ramassé via
> `src/game/level/interactive.ts` (touche `E`, dispatch par nom d'objet
> Blender — le contrat `use_*`/`extras.target` est pensé pour un
> interrupteur-vers-porte, pas pour un pickup autoportant, décision
> documentée dans le fichier). `gym.ts` démarre toujours armé, zéro
> régression (vérifié, les deux chemins testés en navigateur).
> **Pipeline de niveau v2 (2026-08-21/22)** : nouvel agent `level-forge` +
> 6 skills Blender (`blender-level-conventions`, `blender-python-automation`,
> `collision-proxy-authoring`, `modular-kit-design`, `retro-texture-density`,
> `vertex-color-sector-lighting`). Vrai kit modulaire de 25 pièces
> (`assets_src/blender/kit_hypermarche.blend`, VERDICT CONFORME), scripts
> headless sous `tools/blender/` (`build_kit.py`, `build_level.py`,
> `bake_vertex_lighting.py`, `validate_level.py`, `export_level.py`,
> `inspect_kit.py` — voir leur `README.md`). Proxies de collision cuboid
> (pas trimesh, perf/stabilité — `loader.ts` détecte maintenant `col_box_*`
> ET tout `col_*` géométriquement boîte) et éclairage baké en vertex colors
> (`COLOR_0`, `material.vertexColors = true`). **Zones A et B reconstruites
> avec ce vrai kit**, remplaçant les prototypes en boîtes plates du premier
> jet — 56 et 64 colliders cuboid respectivement (vs ~9 boîtes brutes
> avant), murs à 5m (hauteur "salle de vente" du kit, pas 3.2m), éclairage
> visible en jeu. Contrat runtime inchangé (mêmes noms d'objets, mêmes
> comptes `spawns`/`use`/`colliders` vérifiés en jeu après reconstruction).
> **Piège Blender découvert** (premier jet, avant le kit) : `col_*` est
> rendu INVISIBLE par convention (collider seul) — un mur voulu à la fois
> visible et solide a besoin de DEUX objets superposés. Oublié dans le tout
> premier jet de Zone A ; corrigé, puis structurellement résolu par le kit
> (chaque pièce porte son rendu + son proxy ensemble).
> `spawn_suit_*` → vrai `Suit` : corrigé, le Costard scellé de la Zone A est
> réellement présent en jeu (`Entities: 1`, état ALERTE en continu, jamais
> TIR — revérifié après la reconstruction au kit, distance inchangée). Le
> registre `levels.ts` a remplacé le hardcode par id.
>
> **Zone B — Caisses** : sol + périmètre 24×24m, 4 `kit_checkout` en ligne
> à Y≈9.5 (trouées de 2m), 3 `spawn_suit_*` à 18m du spawn (`spawn_suit_2`
> était à 15m dans le premier jet — sous `attackRange`, aucune fenêtre
> d'approche, signalé par `entity-designer` et corrigé lors de la
> reconstruction). Démarre ARMÉE (pas de `startUnarmed`). Vérifié en jeu :
> 3 Costards visibles, positions exactes, état ALERTE.
> **Écart encore ouvert, jugement humain requis** : les caisses (`kit_checkout`,
> 1.10m) restent sous `eyeHeight` (1.6m, joueur ET Costard) utilisé par tous
> les raycasts de vision/tir — la "couverture" du plan reste purement
> visuelle, ne bloque aucun hitscan (et il n'y a pas de crouch dans
> `moveConfig.ts`). Pas corrigé par la reconstruction au kit (question de
> layout, pas de géométrie).
> **Observation non traitée, hors scope de la reconstruction** : en Zone B,
> `spawn_suit_2` inflige déjà des dégâts après quelques secondes d'immobilité
> du joueur — effet de l'agressivité/vitesse de l'IA à cette distance, pas
> de la géométrie (distance vérifiée exacte à 18m). À évaluer en jouant.
>
> **Zone C — Rayons (2026-08-22)** : sol + périmètre 24×28m, trois rangées de
> `kit_gondola_4m` (+ `kit_gondola_end` en bout de rangée) parallèles à l'axe
> de déplacement, créant deux allées centrales de 3m (combat en couloir) et
> deux couloirs latéraux ouverts. Nouvelle fonction `build_gondolas` dans
> `build_level.py` (tiling le long d'un axe unique, orientation par rotation
> 90°). 4 `spawn_suit_*`, démarre ARMÉE. `validate_level.py --strict` : 0
> erreur, 0 warning (aucune exception nécessaire, contrairement au
> `use_crowbar` de la Zone A).
> **Piège level design découvert et corrigé en jeu** : les deux premiers
> `spawn_suit_*` posés au milieu des allées centrales (Y=12) se sont révélés
> déjà en état `attack` dès le spawn (`window.cassandre.suits`, 12.2m, sous
> `attackRange`=16m) — une allée est par construction une ligne droite
> dégagée d'un bout à l'autre, `hasClearWorldPath` n'y est jamais coupé par
> les rangées qui la bordent sans jamais la traverser ; contrairement aux
> rangées de la Zone B, la géométrie d'allée parallèle NE PEUT PAS produire
> une embuscade par occlusion pour un Costard posé en son centre — seule la
> distance protège la fenêtre d'approche ici. Corrigé en les déplaçant à la
> sortie nord des allées (Y=18, ~18.1m, au-delà d'`attackRange` avec la même
> marge que le fix de Zone B) ; revérifié en jeu, les 4 Costards passent
> `idle` → `alert` sans jamais `attack` au spawn. `col_*` reste inchangé
> (aucun impact sur la géométrie/le bake, seuls les points de spawn ont
> bougé). Caddies (`kit_cart`, extras `dynamic`/`mass` déjà posés dans le
> kit) et micro d'annonces : géométrie/props pas encore posés, systèmes
> (physique dynamique, audio interactif) pas écrits — travail futur
> `level-pipeline`/`shell`.
>
> **Zone D — Réserve (2026-08-22)** : sol + périmètre 28×32m, deux rangées
> de `kit_rack_4m` (8 pièces, cover réel — 6m de haut) créant une travée
> centrale ~8.8m + deux couloirs latéraux, 6 palettes empilées (`kit_pallet`
> ×3 en 2 piles) + 3 `kit_crate` pour la flaveur "réserve". **Première vraie
> verticalité du jeu** : mezzanine à Z=2m (quart nord de la salle), escalier
> double (`kit_stairs_2m` ×2, pente 45°) + rambarde (`kit_railing_2m` ×12)
> sur le bord exposé. `validate_level.py --strict` : 0 erreur, 8 warnings
> attendus (empilement des palettes à 0.15m, incompatible avec la grille
> 0.25m — même famille d'exception que `use_crowbar` en Zone A). 5
> `spawn_suit_*`, démarre ARMÉE.
> **Décision d'IA actée avant la construction** : `suit.ts::runChase` n'a
> aucun vrai pathfinding (`computeAvoidedDirection` = 3 rayons d'évitement
> local, vélocité nulle si les trois sont bloqués) — un Costard sur la
> mezzanine chassant un joueur au sol via l'escalier resterait bloqué contre
> la rambarde. Décision : **aucun `spawn_suit_*` sur la mezzanine**, les 5
> sont au sol ; la mezzanine reste un élément de traversée/point de vue pour
> le joueur uniquement.
> **Piste d'occlusion tentée puis abandonnée, en jeu (pas en théorie)** :
> `spawn_suit_1`/`spawn_suit_2` étaient posés dans les couloirs latéraux en
> espérant une occlusion réelle par la rangée adjacente — géométrie/colliders
> revérifiés indépendamment (bbox exactes, `col_box_rack_4m` co-localisé
> avec le rendu, groupes de collision identiques à tout `col_*`), calcul
> géométrique du croisement correct côté ouest. Pourtant vérifié en jeu
> (`window.cassandre.suits`) : les DEUX passent `attack` dès le spawn
> (~13.8m, sous `attackRange`=16m) — la rangée ne bloque PAS
> `hasClearWorldPath` en pratique. **Cause racine trouvée depuis, au jalon
> N5 du niveau v2 (2026-09-12)** : le rayon partait avant le premier pas de
> physique, dans une broad-phase Rapier encore vide — rien à voir avec les
> pièces `PROP`, l'hypothèse d'un gap sur le kit est fausse (ADR 0025).
> Corrigé depuis le 2026-09-11 par `refreshSceneQueries()` au chargement.
> Contournement appliqué à l'époque (pas une correction) : les deux repositionnés à Y=16 (~18.9m), hors `attackRange`
> quelle que soit l'occlusion réelle, même stratégie de secours que B/C.
> Revérifié en jeu : les 5 Costards passent `idle`→`alert`→`chase` sans
> jamais `attack` au spawn.
>
> **Zone E — Bureau, géométrie seule (2026-08-22)** : décision de scope
> explicite avec l'utilisateur avant construction — cette passe ne fait QUE
> la salle + un Costard placeholder standard. Le vrai directeur (nouveau
> type d'entité, peau qui se déchire pour révéler un reptilien), le badge à
> ramasser, et la porte de sortie verrouillée par ce badge sont **une tâche
> séparée non commencée**, comparable en ampleur à la Phase 3. Salle
> 16×16m + petit couloir de sortie sans issue (2×4m) via `kit_door_2m` (un
> encadrement de porte avec découpe intégrée — PAS un `kit_door_leaf`/
> `door_*` animé, aucune interactivité). `validate_level.py --strict` :
> 0 erreur, 0 warning — première zone sans aucune exception de grille.
> Un seul `spawn_suit_1` à 9m du spawn, volontairement SOUS `attackRange`
> (contrairement aux zones précédentes) : c'est la salle de confrontation
> finale, la "révélation" doit être immédiate, pas une embuscade en couloir
> — le state machine garde de toute façon un temps `alertDuration` (0.45s)
> avant tout tir possible, quelle que soit la distance. Vérifié en jeu :
> comptes exacts (colliders 44, spawns Costard 1, use 0), le Costard engage
> rapidement mais jamais avant ce temps d'alerte — comportement voulu, pas
> le bug d'embuscade des Zones C/D.
>
> **Directeur (2026-08-22)** : entité codée (`src/game/entities/director.ts`
> + `directorConfig.ts` + `directorManager.ts`, miroir de `Suit`), câblée
> dans `main.ts` (rendu billboard, dégâts via `weapons.hitEvents` partagé,
> sfx `enemy_*` réutilisés, badge droppé à la mort avec mesh placeholder).
> Testable en console : `cassandre.spawnDirector(x,y,z)`. `pnpm build` OK,
> spawn/état/rendu vérifiés en jeu ; tir de confirmation pas testé jusqu'au
> bout (pointer lock capricieux en automatisation navigateur, sans rapport
> avec le code) — à valider en jouant réellement. Depuis, câblé dans
> Zone E via une nouvelle convention `spawn_director_*` (`loader.ts`,
> miroir de `spawn_suit_*`) : la Zone E a désormais un vrai `spawn_director_1`
> à la place du Costard placeholder. Pas de porte verrouillée par badge :
> toujours hors scope, prochaine étape.
>
> **Niveau complet — les 5 zones fusionnées (2026-08-22)**, décision
> explicite de l'utilisateur (option "vraie carte unique" plutôt qu'un
> enchaînement par transition, coût assumé). `zone_a_parking`..`zone_e_bureau`
> restent intacts et sélectionnables individuellement (test ciblé) ; un
> nouveau fichier `hypermarche_complet.glb` (`tools/blender/
> build_combined_level.py`) recompose les 5 zones (copies traduites, jamais
> les dicts `ZONE_A..E` originaux) en un seul niveau connecté A→B→C→D→E, par
> de vrais couloirs — aucune coupure de chargement. Translations et brèches
> choisies par `level-forge` par inspection directe des bbox déjà exportées
> (détail complet dans `tools/blender/README.md`) ; Zone D connectée à la
> Zone E par son mur EST (pas le nord — bord de la mezzanine, contrainte
> respectée). Spawns/`use_*` renommés par suffixe de zone pour éviter les
> collisions de noms (`spawn_suit_c1`, `spawn_director_e1`, `use_shotgun`...) ;
> un seul `spawn_player` (celui de la Zone A). `validate_level.py --strict` :
> 0 erreur, 12 warnings tous connus (palettes hors grille ×8, crowbar/shotgun
> sans `target` ×4). Enregistré dans `levels.ts` (`hypermarche_complet`,
> démarre DÉSARMÉE comme la Zone A). Vérifié en jeu : comptes exacts
> (colliders 382, spawns Costard 13, spawns Directeur 1, use 2), les 14
> positions d'ennemis recoupées une par une contre le rapport (translations
> confirmées à l'unité près), un seul en `chase` au chargement (le Costard
> scellé de Zone A, comportement historique inchangé), tous les autres
> `idle` (hors de portée du spawn unique, normal). Téléportation de test
> dans la Zone B combinée : rendu correct (rangée de caisses, 3 Costards
> actifs et engageant réellement le joueur).
>
> **Nouveau : le pompe se ramasse vraiment.** `WeaponSystem.hasShotgun`/
> `pickUpShotgun()` ajoutés (comblent un écart déjà documenté : le pompe
> n'avait aucune contrainte de ramassage). `use_shotgun` câblé dans
> `interactive.ts`/`main.ts`, même contrat que `use_crowbar`, posé dans la
> Zone B du niveau combiné (pas dans `zone_b_caisses.glb` seule).
>
> **Bug de drop du badge corrigé (2026-08-22)** : signalé par l'utilisateur
> après avoir joué ("on dirait que le drop le fait buggé"). Deux vrais bugs
> trouvés en relisant `directorManager.ts`, tous deux liés au fait qu'un
> kill se fait souvent à bout portant (mêlée/pompe au contact) : (1) le
> badge apparaissait au CENTRE de la capsule du Directeur (~1.05m en l'air),
> pas à ses pieds — flottait visiblement au lieu d'être posé au sol ; (2)
> aucun délai avant ramassage — un joueur déjà à moins de 1.5m au moment du
> kill (typique à bout portant) le ramassait sur le MÊME pas fixe que sa
> création, donc jamais visible, ce qui se lit comme "il a disparu"/"ça a
> buggé" plutôt que comme un drop. Corrigé : position aux pieds (+0.15 pour
> reposer sur le sol), `badgePickupDelay` (0.6s, `directorConfig.ts`) avant
> que `tryCollect` n'accepte quoi que ce soit. Vérifié via le vrai chemin de
> code (`directorManager.update()` avec un `HitEvent` synthétique, pas de
> mock) : badge à Y=0.15 confirmé, ramassage refusé avant 0.6s puis accepté
> après, aucune exception. `directorManager` exposé sur `cassandre.` pour ce
> genre de test (même précédent que `cassandre.weapons`).
>
> **Porte à badge, Zone E (2026-08-23)** : `door_e_exit` remplace l'alcôve
> de sortie sans issue — vrai vantail (`kit_door_leaf`, déjà présent dans le
> kit sans être utilisé), verrouillé par défaut (`loader.ts::buildDoor`,
> inchangé : corps dynamique, translations/rotations lockées), déverrouillé
> par `use_exit_door` (portée 2m, touche E) SEULEMENT si le joueur a le
> badge du Directeur. Travail Blender délégué à `level-forge` (géométrie
> précise hors de portée d'une extension mécanique) : a trouvé un vrai piège
> — `loader.ts::buildDoor` positionne le corps Rapier sur la translation
> BRUTE du mesh sans le recentrer (contrairement à `buildCuboidCollider`
> pour les `col_box_*`), donc poser `kit_door_leaf` avec l'origine-coin
> standard du kit aurait mis le collider à moitié hors du vantail visible ;
> corrigé côté Blender (recentrage des vertices de la COPIE posée en niveau,
> le datablock du kit reste intact) plutôt que de toucher `loader.ts` (hors
> scope du niveau). Vantail collé à la face intérieure du mur (Y=14.0,
> centre monde (0, 14, 1.25)) plutôt que centré dans l'épaisseur (aurait
> donné Y=14.125, hors grille 0.25m — Zone E gardait jusqu'ici 0 warning).
> `validate_level.py --strict` : toujours 0 erreur/0 warning sur
> `zone_e_bureau`, aucun nouveau warning sur `hypermarche_complet` (les 12
> déjà connus, inchangés). Vérifié en jeu (`cassandre.level.stats()` +
> `cassandre.doors()`) sur les deux fichiers : `doorCount`/`useCount`
> corrects, `door_e_exit` retrouvé par nom, position et `halfExtents`
> cohérents avec l'export (Y-centre = 1.25 = moitié de la hauteur 2.5m,
> posé au sol, pas flottant).
>
> Côté jeu : `hasBadge` (survit à un hot reload, contrairement au
> `LevelHandle`), glissement cosmétique de la porte vers le bas sur sa
> propre hauteur (`body.setTranslation` direct — les locks du corps
> contraignent le solveur, pas une écriture de position manuelle, même
> principe que le KCC du joueur), collider désactivé IMMÉDIATEMENT au
> déverrouillage (pas en fin de glissement, pour ne jamais bloquer un joueur
> qui vient de déverrouiller en restant devant). Refus (pas de badge) et
> succès ont chacun un son placeholder synthétique dédié (`door_locked`/
> `door_unlock`, même pipeline que les 9 sons existants) et un message HUD
> transitoire (`HudMessage.tsx`, nouveau — premier vrai texte HUD du jeu,
> jusqu'ici seulement un panneau de debug). Vérifié : la manipulation Rapier
> réelle (glissement + désactivation du collider) testée directement contre
> le VRAI corps/collider du niveau chargé (`cassandre.doors()[0]`, pas un
> mock) — aucune exception, position finale et état du collider corrects.
> **Non vérifié en conditions réelles** : le déclenchement par une vraie
> touche E en jeu (`InteractionSystem.update` → `onExitDoorUse` → HUD/son) —
> l'environnement d'automation navigateur utilisé ici met la page en
> `visibilitystate: hidden`, ce qui coupe la boucle à pas fixe entière (pas
> seulement le rendu, comme pour le tir du Directeur déjà noté plus haut) ;
> même limitation que la confirmation de tir du Directeur, à valider en
> jouant réellement. `cassandre.doors()`/`cassandre.hasBadge()`/
> `cassandre.giveBadge()` exposés en console pour ce genre de test futur.
>
> **Bug de billboards qui clignotent, signalé après avoir joué (2026-08-23)** :
> "il y a 2 billboard qui sont à moitié transparent et qui shake" près du
> joueur mort. Cause réelle, indépendante de la porte : `COLLISION_GROUPS.ENEMY`
> (`src/physics/world.ts`) n'incluait pas `ENEMY` dans son propre filtre — les
> ennemis ne se bloquent JAMAIS entre eux (seuls les 3 rayons d'évitement de
> `computeAvoidedDirection` testent `WORLD`, jamais les autres ennemis).
> Plusieurs Costards/le Directeur convergeant sur le même point (le joueur
> mort) peuvent donc interpénétrer entièrement leurs capsules ; leurs
> billboards, toujours face caméra, se retrouvent alors à une profondeur
> quasi identique → z-fighting franc. Choix soumis à l'utilisateur
> (`AskUserQuestion`, collision réelle vs correctif cosmétique vs report) :
> **collision ennemi-ennemi activée** (`ENEMY` ajouté à son propre filtre) —
> le `KinematicCharacterController` partagé gère déjà la réponse pour
> n'importe quel handle autre que soi-même, un seul bit à changer. Vérifié
> directement (deux Directeurs de test spawnés à 5cm l'un de l'autre, ciblant
> le même point, `directorManager.update()` + `physics.step()` appelés
> manuellement en boucle pour contourner le gel de la boucle à pas fixe en
> automatisation navigateur déjà noté plus haut) : SANS le fix, distance
> reste exactement 0 sur 300 pas ; AVEC, une vraie réponse de collision
> s'engage (pic à 0.25m) puis oscille proche de 0 en régime établi — les deux
> directeurs de test visaient le MÊME point fixe sans aucune conscience l'un
> de l'autre, un pire cas artificiel (le joueur réel est une cible mobile,
> les ennemis l'approchent sous des angles différents). Accepté comme
> compromis explicite : les ennemis groupés se bousculeront désormais entre
> eux au lieu de se traverser silencieusement, un changement de feel pour
> TOUTES les zones (B/C/D), pas seulement la Zone E.
>
> **Secrets 1 et 2 livrés (2026-08-24)**, critère de validation du plan
> ("trouve au moins 1 secret sur 2"). Scope volontairement réduit par
> rapport au plan complet : les deux secrets sont livrés, mais "rayon
> surgelés qui explose en verre + givre" (item séparé de la liste des objets
> interactifs) ne l'est PAS — `door_b_frozen` s'ouvre comme n'importe quelle
> porte (`use_frozen_storage`, touche E, aucune condition contrairement à
> `door_e_exit`), pas de bris de verre animé, décision assumée pour ne pas
> ajouter un système "prop destructible" dans la même passe que tout le
> reste (invariant #9, pas de système avant que la douleur soit réelle).
> **Secret 1, Zone B** : alcôve 2×3m derrière le mur ouest (brèche entre
> deux segments de `wall_run`, même mécanique que la brèche de Zone E),
> `door_b_frozen` (vrai vantail `kit_door_leaf`, même recentrage que
> `door_e_exit`) + `use_frozen_storage` (`extras.target` générique, déjà
> supporté par `build_use_objects` depuis la Zone E), `secret_1b` dedans.
> **Secret 2, Zone C** : un `kit_crate` (posé STATIQUE via le pipeline
> normal — ses extras `dynamic`/`mass` existent dans le kit mais aucun code
> ne les lit encore, ignorés ici délibérément) au pied de la rangée ouest de
> gondoles sert de marche : sol → caisse (1.0m, sous `jumpHeight`=1.1m) →
> sommet de la gondole (2.0m, encore 1.0m de saut depuis la caisse, même
> marge). `secret_2c` posé sur le toit de la rangée, à l'extrémité opposée à
> la caisse d'accès — le joueur grimpe puis marche sur le toit pour le
> trouver. Aucune géométrie neuve nécessaire pour le "toit" lui-même : le
> dessus du collider de gondole était déjà marchable.
> **Piège Blender trouvé par `level-forge`** : élargir le `floor` de la
> Zone B vers l'ouest pour couvrir l'alcôve (même technique que le
> débordement de sol déjà utilisé en Zone A/E) semblait correct isolément,
> mais une fois traduit dans le niveau combiné, ce débordement atterrissait
> EXACTEMENT sur la dalle du connecteur A↔B — deux meshes coïncidents,
> `bake_vertex_lighting.py` les bakait entièrement noirs (auto-occultation,
> même classe de bug que le kit_crate noir documenté plus haut). Corrigé en
> remplaçant l'extension par une dalle sur-mesure dédiée (`build_floor_patches`,
> même technique que `build_vitrine` : coordonnées MONDE, bornée exactement
> à l'empreinte réelle de l'alcôve) — ne peut plus chevaucher quoi que ce
> soit par construction. `validate_level.py --strict` : `zone_b_caisses`/
> `zone_c_rayons` restent CONFORME (0 erreur, 0 warning) après ajout ;
> `hypermarche_complet` garde ses 12 warnings déjà connus, aucun nouveau.
> Détection/compteur/HUD/son côté jeu faits directement (pas d'agent,
> extension mécanique de conventions déjà posées) : `foundSecrets`
> (WeakSet, même discipline que `InteractionSystem.consumed`), test AABB
> générique sur `handle.secrets` (fonctionne pour N'IMPORTE QUEL `secret_*`,
> pas seulement ceux-ci), `debug.secretsFound`/`secretsTotal` dans
> `DebugPanel`, message HUD "Secret trouvé ! (n/total)" + son placeholder
> dédié `secret_found` (même pipeline synthétique que les sons de porte).
> `unlockDoor()` factorisé entre `onExitDoorUse` (Zone E, gardé par badge)
> et `onFrozenStorageUse` (Zone B, sans garde) — même mécanique de porte,
> seule la condition d'appel diffère. Vérifié en jeu (`cassandre.level.stats()`,
> `cassandre.doors()`, `cassandre.secrets()`) sur les trois fichiers
> (`zone_b_caisses`, `zone_c_rayons`, `hypermarche_complet`) : comptes exacts,
> positions/bbox cohérentes avec l'export, glissement+désactivation du
> collider de `door_b_frozen` vérifié contre le vrai corps Rapier (même
> méthode que `door_e_exit`), aucune exception, aucune erreur console
> nouvelle. **Non vérifié en conditions réelles** : le déclenchement par une
> vraie entrée dans la zone (marche jusqu'au secret, saut caisse→gondole) —
> même limitation de boucle gelée en automatisation navigateur déjà notée
> pour la porte à badge et le tir du Directeur, à valider en jouant
> réellement, en particulier le timing du double-saut de la Zone C (marge
> de seulement 0.1m à chaque étage).
>
> **Micro d'annonces + toilettes livrés (2026-08-24)**, deux des objets
> interactifs "signature Duke" du plan. Faits directement (pas de
> `level-forge` : `build_use_objects` gère déjà n'importe quel `use_*`
> autoportant depuis `center`/`size`, aucune fonction Blender neuve
> nécessaire — juste deux entrées ajoutées à `level_spec.py` + rebuild).
> `use_pa_mic` (Zone C, zone dégagée nord des gondoles) déclenche une
> réplique du héros en **texte HUD placeholder** (`HudMessage`, aucune VO
> réelle cette passe — invariant #9, la vraie VO reste Phase 6),
> répétable à volonté. `use_toilet` (Zone D, coin sud-est dégagé) rend
> `+1 PV` (valeur LITTÉRALE du plan, blague assumée sur sa dérision),
> répétable mais plafonné au PV max — pas un pickup à usage unique.
> Piège de grille rencontré et corrigé avant le premier export propre :
> un centre Z à moitié de la hauteur choisie initialement n'était pas un
> multiple de 0.25m (`validate_level.py` l'a signalé immédiatement) — corrigé
> en choisissant des hauteurs dont la moitié tombe sur la grille, pas en
> ignorant l'avertissement. Rebuild vérifié sur les trois fichiers
> concernés (`zone_c_rayons`, `zone_d_reserve`, `hypermarche_complet`) :
> `useCount` exact (6 sur le niveau combiné), 0 mesh noir au bake, aucun
> warning nouveau au-delà des "sans target" attendus (même classe que
> crowbar/shotgun).
>
> **Reste du contenu Phase 5, pas commencé** : caddies poussables (kit_cart
> existe déjà dans le kit avec des extras `dynamic`/`mass` non lus par le
> loader — nécessite une vraie nouvelle catégorie de collision pour un
> prop poussable, pas juste du placement), l'animation de bris de verre du
> rayon surgelés (voir plus haut, secret 1), écrans de surveillance
> (render-to-texture, non trivial), machine à pinces (secret dérisoire).
>
> Phase 4 — Pipeline de niveau (glTF, conventions de nommage, hot reload).
> Codée et fonctionnelle : `src/game/level/loader.ts` (contrat complet
> `col_*`/`spawn_player`/`spawn_suit_*`/`trig_*`/`door_*`/`use_*`/`secret_*`,
> transforms monde appliqués avant Rapier, reconversion forcée en
> `MeshLambertMaterial`/`NearestFilter` — sinon `GLTFLoader` viole l'invariant
> #5 silencieusement), `src/game/level/hotReload.ts` (sondage HTTP HEAD
> ETag/Last-Modified, 400ms, préserve la position du joueur au reload).
> Câblage additif dans `main.ts` : `gym.ts` reste le niveau par défaut au
> boot, le pipeline glTF s'active via `?level=<nom>` ou
> `window.cassandre.level.load(name)` — rien de cassé côté Phases 1-3.
> Critère humain de cette phase ("déplacer un mur dans Blender, exporter, le
> voir en jeu en moins de 60 secondes, chronométré") pas encore constaté —
> hors de portée d'un agent, à tester par l'utilisateur dans son propre
> Blender.
>
> **Phases 0-3 codées, fonctionnelles, et validées humainement.** Phase 3
> ("l'ennemi Costard" — machine à états, billboard, hitscan télégraphié,
> gibs) est le **point de décision majeur du plan** : combat contre plusieurs
> Costards dans la gym jugé fun par l'utilisateur ("Franchement c'est fun
> même si ça ressemble à rien, je valide") — le proto continue. Feedback de
> hit retravaillé après coup (son placeholder synthétique ajouté, crosshair
> permanent, gizmos balistiques touche `B`, fix d'un vrai bug de portée sur
> le pied-de-biche, compteur de munitions du pompe affiché). Phase 1
> (déplacement) validée dès son passage ("Quake / Half-Life 1"), deux bugs de
> stutter post-playtest corrigés (reclip de vélocité sur mur uniquement,
> `groundStickSpeed` réduit à -0.2 m/s — voir `.claude/docs/RAPIER_GUIDE.MD`
> / skill `threejs-rapier-fieldguide` pour la référence qui a orienté le
> diagnostic). Outils de debug : `V` wireframe, `B` gizmos balistiques.
>
> **Gate `qa-evidence` : abandonné par défaut, pas par phase — décision
> explicite de l'utilisateur (2026-08-20).** Ne pas le lancer à chaque phase ;
> il sera lancé une seule fois, à la toute fin du proto, si besoin.
>
> Mettre à jour cette ligne à chaque passage de phase.

Les critères de validation et de rollback de chaque phase sont dans
`PLAN_PROTO_BOOMER_SHOOTER.md`.

**Gate `qa-evidence` abandonné (décision explicite de l'utilisateur,
2026-08-19).** Le passage de phase ne dépend plus d'une validation formelle
par preuve (build/console/hash pixel/déterminisme/perf) — seul le critère
humain de fun/lisibilité du plan compte. Le `director` ne doit plus bloquer
une phase suivante en attendant `qa-evidence`.
