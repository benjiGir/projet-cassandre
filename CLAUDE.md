# PROJET_CASSANDRE — contexte projet

Boomer shooter rétro façon Duke Nukem 3D / Ion Fury, en Three.js vanilla.
Prototype : 1 niveau, 2 armes, 1 type d'ennemi, 8-10 minutes de jeu.

## Stack

Vite + TypeScript · three (vanilla) · @dimforge/rapier3d-compat · React DOM
en overlay uniquement · zustand · howler · Blender → glTF

## Invariants — non négociables

Toute proposition qui viole un de ces points doit être **refusée avec
explication**, pas contournée.

1. **Fixed timestep 1/60.** Aucune logique de gameplay ou de physique hors du
   pas fixe. Delta clampé à 0.25 s.
2. **React ne touche jamais la boucle.** Pas de `setState` par frame. Le HUD
   s'abonne à zustand, throttlé à 10 Hz maximum.
3. **La rotation caméra n'est pas interpolée.** Elle est lue au taux
   d'affichage. L'interpoler ajoute de la latence de visée.
4. **Résolution interne 640×360**, upscalée. `NearestFilter` sur toutes les
   textures, `generateMipmaps = false`.
5. **`MeshLambertMaterial` uniquement.** Pas de PBR, pas de
   `MeshStandardMaterial`, pas de map de rugosité ni de métalness.
6. **Character controller = celui de Rapier** (`KinematicCharacterController`).
   Jamais d'implémentation maison capsule-vs-monde.
7. **Gravité −25 m/s².** Le réalisme donne un saut mou.
8. **Pas d'ECS** avant 12 types d'ennemis. `Entity[]` + `update(dt)` + `switch`.
9. **Boîtes blanches jusqu'à la Phase 5.** Pas d'assets finaux avant que le
   gameplay soit validé.
10. **Aucune animation ne bloque le joueur.** Pas de rechargement immobilisant.

## Conventions de nommage glTF

| Préfixe | Effet à l'import |
|---|---|
| `col_*` | collider trimesh statique, mesh rendu invisible |
| `spawn_player` | position/orientation de départ |
| `spawn_suit_*` | point d'apparition Costard |
| `spawn_director_*` | point d'apparition Directeur (boss unique) |
| `trig_*` | volume de trigger (box), mesh invisible |
| `door_*` | porte animée, collider dynamique |
| `use_*` | objet interactif (portée 2 m) |
| `secret_*` | zone comptabilisée dans le compteur de secrets |

## Structure

```
src/core/     loop input time audio
src/render/   renderer billboard fx
src/physics/  world
src/game/     player entities level state
src/ui/       React overlay

tools/blender/        scripts headless (kit, niveaux, bake, validation, export)
assets_src/blender/   sources .blend (kit + niveaux), jamais servi en runtime
public/assets/levels/ .glb exportés, seuls fichiers lus par le jeu
```

## Phase courante

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
> `hasClearWorldPath` en pratique. **Cause racine non identifiée**, cf.
> [[project_cassandre_boomer_shooter]] mémoire pour le détail de
> l'investigation ; possible gap général sur l'occlusion des pièces `PROP`
> du kit pour les rayons de vue, pas spécifique à cette zone — mérite un
> repro headless dédié, pas creusé plus ici. Contournement appliqué (pas une
> correction) : les deux repositionnés à Y=16 (~18.9m), hors `attackRange`
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
