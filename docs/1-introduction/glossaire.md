---
title: Glossaire
tags: [introduction]
status: brouillon
updated: 2026-10-04
---

# Glossaire

Le projet mélange français, anglais, jargon de jeu et jargon moteur. Cette
page fait le pont : un terme employé ailleurs dans la doc doit figurer ici.
Regroupé par thème, ordre alphabétique dans chaque thème. Première version
(jalon D6) — enrichie à chaque phase suivante.

## Univers

| Terme | Définition | Où le voir |
|---|---|---|
| Annonce | Message des haut-parleurs du magasin ou de l'interphone de la direction, affiché en haut de l'écran par un scénario. | `src/game/session/progression/levelEvents.ts` |
| Arène | Rencontre qui ferme les issues d'une salle le temps de deux vagues d'ennemis, puis les rouvre. Celle du niveau est dans la réserve. | `src/game/session/progression/levelEvents.ts`, `docs/decisions/0037-script-de-niveau.md` |
| Bonbonne (de gaz) | Prop de matière `gaz` : poussable, et qui explose à sa casse en amorçant ses voisines. | `src/game/level/props/propConfig.ts`, `docs/decisions/0041-explosifs.md` |
| Borne | Terminal de sponsor posé dans le niveau : un `use_*` qui vend un seul perk, une fois par partie, contre la cagnotte. | `src/game/session/progression/perks.ts`, `docs/decisions/0040-bornes-et-perks.md` |
| Cagnotte | Solde des dons reçus pendant la partie, dépensable aux bornes. | `src/game/session/stream/streamSim.ts` |
| Carte de fidélité (argent / or / platine) | Objet-clé façon Duke 3D : `argent` et `or` se ramassent via un `use_*` (propriété `card`), `platine` est lâchée par le Directeur à sa mort. Une porte peut exiger une carte (`requires`) pour être actionnée. | `src/game/player/loyaltyCards.ts`, `src/game/session/progression/cards.ts` |
| Direct (le) | La simulation du stream : spectateurs qui montent avec l'action et partent avec l'ennui, abonnés, dons et chat. La cagnotte des dons est sans lien avec le score du récapitulatif. | `src/game/session/stream/streamSim.ts`, `docs/decisions/0038-simulation-du-direct.md` |
| Costard (Suit) | L'ennemi de base : humain en costume noir, cravate rouge, jusqu'à sa mort. Partage sa machine à états avec le Directeur. | `src/game/entities/suit/suit.ts`, `src/game/entities/shared/enemyMachine.ts` |
| Directeur (Director) | Boss unique du niveau. Costume beige, révélation reptilienne à la mort, lâche la carte Platine. | `src/game/entities/director/director.ts`, `src/game/entities/director/directorConfig.ts` |
| Difficulté (profil) | Client, Habitué ou Lanceur d'alerte : choisie au lancement, elle règle la vie et les dégâts des ennemis, la taille des renforts et la générosité des dons. | `src/game/session/progression/difficulty.ts`, `docs/2-fonctionnel/difficulte.md` |
| Donateur mystère | Spectateur dont les dons et les messages trop précis guident le héros ; il travaille pour la plateforme de diffusion, qui veut de l'audience et garde les revenus. Il donne à cinq étapes de l'histoire, sans tirage. | `docs/2-fonctionnel/histoire.md`, `src/game/session/stream/streamSim.ts` |
| Espace | Une zone nommée du niveau (rayons, réserve, bureaux…), reliée aux autres par le hub. | `docs/6-reference/conventions-nommage.md` |
| Gibs | Ce qui remplace l'animation de mort d'un ennemi tué au pompe à bout portant ou pris au cœur d'une explosion (distance ≤ `gibDistance`) : flaque, traînées, taches aux murs et morceaux qui retombent. Purement cosmétique, la simulation le garde `dead`/`corpse`. | `src/render/fx/gore.ts`, `src/game/entities/suit/suitManager.ts` |
| Groupe (d'ennemis) | Points d'apparition qui portent le même `groupe` : leurs ennemis n'apparaissent qu'au réveil du groupe par un scénario, en nombre réglé par la difficulté. | `src/game/session/progression/levelScriptActions.ts` |
| Hub | Zone centrale à la Duke 3D d'où partent les espaces du niveau, débloqués par les cartes de fidélité. | CLAUDE.md (section « Chantier Niveau v2 ») |
| Hypermarché | Le décor du prototype : un hypermarché des années 90, univers satirique. | `docs/1-introduction/le-projet.md` |
| Hyper Varan | Le nom de l'enseigne, « le sang-froid des prix bas ». Le niveau s'appelle « Inventaire exceptionnel ». | `docs/2-fonctionnel/histoire.md` |
| Knockback | Recul appliqué à un ennemi qui encaisse un coup non fatal ; converti en vélocité interne (les deux ennemis sont kinématiques, un impulse Rapier n'aurait aucun effet), décroissante sur `knockbackDecayTime`. | `src/game/entities/shared/enemyMachine.ts` |
| Sous-zone | Partie d'un espace délimitée par un `trig_*` portant `replique` : le héros la commente à sa première visite. | `src/game/session/progression/levelScriptSetup.ts` |
| Télégraphie (d'attaque) | Anticipation visuelle et sonore obligatoire avant les dégâts d'une attaque ennemie (pose de tir tenue au moins `attackTelegraphDuration`, ≥ 0,2 s) — condition de lisibilité du combat, pas une mécanique optionnelle. | `src/game/entities/shared/enemyMachine.ts`, skill `enemy-state-machine` |
| Moment scripté | Séquence courte lancée par un `trig_*`, qui ne retire jamais le contrôle : annonce, écrans, réplique. Son déroulé est un scénario. | `docs/decisions/0037-script-de-niveau.md` |
| Perk | Produit de sponsor acheté à une borne : il modifie une valeur de la partie en cours, et disparaît avec elle. Six existent. | `src/game/player/perks.ts`, `src/game/player/perkConfig.ts` |
| Rampant | Reptilien sans costume : rapide, fragile, au corps-à-corps, en meute. Sa silhouette basse oblige à viser bas. | `src/game/entities/rampant/rampantConfig.ts` |
| Record | Meilleur score et meilleur temps d'un niveau terminé, tenus par difficulté et gardés sur le navigateur. | `src/game/settings/records.ts` |
| Rencontre | Endroit du parcours où le script de niveau fait surgir des ennemis à l'arrivée du joueur. | `tools/blender/refresh_encounters.py` |
| Panneau d'histoire | Illustration légendée de l'introduction ou de la fin, affichée hors de la partie. | `src/game/session/presentation/storyPanels.ts` |
| Récapitulatif de fin de partie | Liste des sources de points révélée ligne par ligne à l'écran, suivie du total ; partiel à la mort (sans bonus de rapidité), complet à la vraie sortie du niveau. | `src/game/session/progression/score.ts` |
| Réveil du peuple (« le Réveil ») | La chaîne du héros, qui lui sert aussi de pseudo : il n'a pas de nom civil. Le chat l'appelle « le Réveil ». | `src/ui/hud/widgets/LiveCam/LiveCam.tsx`, `docs/2-fonctionnel/histoire.md` |
| Révélation reptilienne | Bascule cosmétique du Directeur à sa mort : costume humain remplacé par une peau `revele` verte à crête, posée par `setAtlas`. Purement visuelle, pas un changement de comportement. | `src/game/entities/director/directorConfig.ts` |
| Sanitaire (`sanitaire_*`) | Cuvette ou urinoir façon Duke 3D : utilisable en visant (soin ou eau selon l'état), cassable si `pv`. | `src/game/level/sanitaires/sanitaires.ts` |
| Variante d'économie | Réglage complet des dons et des prix (A, B ou C), essayable en jeu et mesuré par `pnpm economy`. La B est celle du jeu. | `src/game/devtools/economy/economyVariants.ts` |
| Vigile | Agent de sécurité lourd et lent, protégé de face par un bouclier : on le contourne, ou on le fait sauter. | `src/game/entities/vigile/vigileConfig.ts` |
| Secret | Zone comptée dans le compteur de secrets, comptabilisée au score une fois trouvée (test AABB générique). | `src/game/session/progression/score.ts` |

## Boucle et temps

| Terme | Définition | Où le voir |
|---|---|---|
| Événement d'impact (`HitEvent`) | Résultat d'un tir résolu au pas fixe : arme, collider touché, point d'impact et direction ; plusieurs systèmes le lisent avant que la file soit vidée. | `src/game/player/weapons/weapons.ts`, `src/game/level/props/props.ts` |
| Accumulateur | Temps réel non encore consommé par un pas fixe ; s'incrémente à chaque frame et se décrémente de `FIXED_DT` à chaque pas exécuté. | `src/core/loop/loop.ts` |
| Curseur d'évènements (`hitCursor`) | Index qui marque, pour un lecteur donné d'une file d'évènements par frame (`hitEvents`…), jusqu'où il a déjà lu ; avance sans jamais reculer, remis à zéro uniquement par `clearFrameEvents()` — jamais inféré depuis la longueur du tableau. | `src/game/entities/suit/suitManager.ts`, [ADR 0010](../decisions/0010-curseur-evenements-multi-pas-fixe.md) |
| `DeterministicRandom` | Service Effect canonique du RNG déterministe : enveloppe `mulberry32`, seule source de nombres aléatoires autorisée dans le gameplay (invariant #12). | `src/core/effect/random.ts` |
| Fait de présentation | Évènement produit par le pas fixe (tir, casse, mort…) et poussé dans une file en lecture seule, consommée puis vidée au taux d'affichage sans jamais influencer une décision de jeu. | `src/game/loop/updateFx.ts`, [Simulation et présentation](../3-architecture/simulation-et-presentation.md) |
| Flux cosmétique (RNG de présentation) | Générateur `DeterministicRandom` propre à `FxSystem`/l'audio, réinitialisé au boot de session, qui ne peut avancer aucun RNG de simulation. | [ADR 0033](../decisions/0033-rng-presentation-et-portee-du-rejeu.md) |
| Frontière synchrone (`runGameplaySync`) | Point de passage obligé du pas fixe et du rendu/interpolation : exécute un `Effect` via `Runtime.runSync` sur `GameRuntime`, lève un defect si l'effet n'est pas synchrone. | `src/core/effect/runtime.ts` |
| `gameplayDt` | Delta de temps réellement simulé par un pas fixe, hitstop compris — distinct du delta d'affichage brut. | `src/game/loop/updateGameplay.ts` |
| Hitstop | Ralentissement bref du temps de gameplay à l'impact, pour la lisibilité du coup. Réalisé en réduisant `gameplayDt`, jamais par un `setTimeout`. | `src/game/loop/updateGameplay.ts` |
| Interpolation | Calcul de la pose affichée entre deux pas fixes, à partir d'`alpha` (fraction de l'accumulateur), pour un rendu fluide indépendant du pas fixe. | `src/core/loop/loop.ts`, `src/game/loop/interpolateVisuals.ts` |
| mulberry32 | Algorithme de PRNG déterministe utilisé par `DeterministicRandom`. Une seule implémentation dans tout le dépôt. | `src/core/effect/random.ts` |
| Pas fixe (fixed timestep) | Le gameplay et la physique n'avancent que par pas de durée constante (1/60 s) ; aucune logique de jeu ne dépend du framerate d'affichage. | `src/core/loop/loop.ts` |
| Rejeu d'input (F9/F10) | Harnais de test qui enregistre puis rejoue exactement une séquence d'entrées, pour comparer deux exécutions ; dépend de la continuité du RNG déterministe. | `src/core/input/inputRecorder.ts`, `src/game/loop/devGameplayInput.ts` |
| `stateTimer` / `tickEnemy` | Minuterie manuelle d'une machine XState, avancée une fois par pas fixe par `tickEnemy` avec le vrai `gameplayDt` (souvent appelé « TICK » dans l'ancienne doc, mais ce n'est pas un évènement XState) — le choix actuel du code plutôt que les transitions `after` (ex-invariant #13, retiré le 2026-09-25). | `src/game/entities/shared/enemyMachine.ts` |
| Taux d'affichage | Fréquence de rendu du navigateur (indépendante du pas fixe) : c'est à ce taux que la rotation caméra est lue, jamais interpolée (invariant #3). | `src/game/loop/interpolateVisuals.ts` |

## Architecture

| Terme | Définition | Où le voir |
|---|---|---|
| ECS (Entity-Component-System) | Architecture de composition d'entités par assemblage de composants interchangeables ; explicitement écartée tant que le jeu compte moins de 12 types d'ennemis (invariant #8), au profit d'`Entity[]` + `update(dt)` + `switch`. | `src/game/entities/shared/entity.ts` |
| `enemyMachine` | Machine à états XState partagée par Costard et Directeur (repos, alerte, poursuite, tir, mort…). | `src/game/entities/shared/enemyMachine.ts` |
| `GameEngine` | État persistant du moteur (monde Rapier, horloge, session courante…), construit une fois au boot. | `src/game/session/gameEngine.ts` |
| `GameSession` | Ce qui vit le temps d'une partie (niveau chargé, entités, score…), reconstruite à chaque nouvelle partie ; distincte du `GameEngine` persistant. | `src/game/session/gameSession.ts` |
| `gameFlowMachine` | Machine XState du flux d'écran (menu → jeu → mort/fin de niveau → reset), ne connaît rien du jeu lui-même. | `src/app/navigation/gameFlowMachine.ts` |
| `GameFlowPort` | Petite interface (`isPlaying`, `isPhysicsLive`, `playerDied`…) par laquelle le pas fixe interroge le flux d'écran sans dépendre de XState ni de React. | `src/game/session/flowPort.ts` |
| `GameLayer` / `GameRuntime` | `GameLayer` assemble tous les services Effect du jeu (`Layer.mergeAll(...)`) ; `GameRuntime` (`ManagedRuntime.make(GameLayer)`) est le runtime unique construit une fois pour tout l'onglet. | `src/core/effect/runtime.ts`, [Effect et XState](../3-architecture/effect-et-xstate.md) |
| Erreur typée (`Schema.TaggedError`) | Classe d'erreur Effect déclarée par site d'échec (ex. `MissingSpawnPlayerError`) ; dans `loader.ts`, la quasi-totalité suit le patron « fail immédiatement rattrapé » — journalisée en console, jamais propagée. | `src/game/level/loading/loader.ts` |
| Jeton de génération (`levelLoadGeneration`) | Entier incrémenté à chaque appel de `loadGltfLevel`, capturé au moment de l'appel ; un chargement dont la génération a changé à son retour est abandonné sans toucher `GameSession`. | `src/game/session/spawning.ts`, [Cycle de vie](../3-architecture/cycle-de-vie.md) |
| Layer (Effect) | Recette de construction d'un service Effect (ex. `RaycastService.layer`), assemblée dans `GameLayer` au boot. | `src/physics/raycast.ts` |
| `LevelDef` | Définition d'un niveau sélectionnable au menu (id, nom, chemin du fichier). | `src/game/level/catalog/levels.ts` |
| `LevelHandle` | Contrat du résultat public du chargement d'un niveau glTF (corps physiques, décor, spawns…), consommé par le reste du jeu. | `src/game/level/loading/levelTypes.ts` |
| `LevelSession` | Niveau `.glb` COURANT d'une partie : porte le `LevelHandle` affiché, le sondage de hot reload et la logique de remplacement transactionnel (candidat, commit, arrêt). | `src/game/level/loading/hotReload.ts` |
| `PersistentEngine` | `GameEngine` privé de son champ `session` ; type utilisé pendant la construction, avant que la première `GameSession` existe. | `src/game/session/gameEngine.ts` |
| Service Effect | Dépendance déclarée via `Context.Service`, injectée par une `Layer` et consommée avec `.use(...)` dans la frontière synchrone. | `src/physics/raycast.ts`, `src/core/effect/random.ts` |
| Store zustand | État miroir pour l'UI React (`src/game/hud/state.ts`), jamais la source de vérité (qui reste dans `GameSession`) ; le HUD s'y abonne, throttlé à 10 Hz (invariant #2). | `src/game/hud/state.ts` |

## Physique

| Terme | Définition | Où le voir |
|---|---|---|
| Broad-phase | Phase de Rapier qui présélectionne les paires de colliders candidates à une collision, avant le calcul précis ; doit avoir tourné au moins une fois avant qu'un raycast de gameplay soit fiable. | CLAUDE.md (section pathfinding N5) |
| Collider | Volume de collision Rapier attaché à un corps physique (cuboid, convex hull, trimesh). | `src/physics/world.ts` |
| Groupes de collision (`WORLD`, `PROP`, `ENEMY`…) | Bits d'appartenance/filtre Rapier qui décident quel collider peut toucher quel autre ; `PROP` est volontairement séparé de `WORLD` (un prop poussé ne doit pas fausser la navigation ni la ligne de vue). | `src/physics/world.ts` |
| Hitscan | Tir résolu instantanément par un raycast, sans projectile simulé. | `src/physics/raycast.ts` |
| KCC (`KinematicCharacterController`) | Contrôleur de personnage de Rapier, seul système autorisé pour déplacer joueur et ennemis contre le décor (invariant #6). | `src/game/player/movement/controller.ts`, `src/physics/world.ts` |
| Raycast | Lancer de rayon Rapier, utilisé pour le tir, la ligne de vue ennemie et le bake du graphe de navigation. | `src/physics/raycast.ts` |
| Rapier | Moteur physique (`@dimforge/rapier3d-compat`) utilisé pour tous les colliders et déplacements du jeu. | `src/physics/world.ts` |

## Rendu

| Terme | Définition | Où le voir |
|---|---|---|
| Frustum | Volume de vision d'une caméra ; Three.js peut écarter un objet qui ne l'intersecte pas. | `src/render/pipeline/renderer.ts` |
| `alphaTest` | Seuil sous lequel un fragment texturé est coupé au lieu de s'afficher ; les billboards l'utilisent pour les pixels transparents sans tri alpha. | `src/render/sprites/billboard.ts` |
| Cubemap | Texture faite de six faces orientées, échantillonnée comme un fond autour de la scène. | `src/render/environment/ciel.ts` |
| Frame d'atlas | Une case d'une planche de sprites ; la colonne donne la direction et la ligne l'image ou l'état d'animation. | `src/render/sprites/billboard.ts`, `src/render/sprites/enemySprites.ts` |
| Vertex colors | Couleur portée par chaque sommet d'une géométrie ; l'attribut glTF `COLOR_0` est lu par Three.js comme `color`. | `src/game/level/loading/loader.ts` |
| WebGLRenderer | Renderer Three.js qui soumet la scène et la caméra à WebGL dans le canvas du jeu. | `src/render/pipeline/renderer.ts` |
| Atlas | Texture unique regroupant plusieurs images (sprites d'ennemi, bandeaux de rayon…) pour limiter le nombre de matériaux. | `src/render/sprites/enemySprites.ts` |
| `BatchedMesh` | Regroupement Three.js de plusieurs meshes en un seul lot de dessin pour un même matériau (ex. les vantaux de porte). | `src/game/level/doors/doors.ts` |
| Billboard 8 directions | Sprite d'ennemi toujours tourné vers la caméra (yaw seul), choisi parmi 8 angles pré-rendus selon l'orientation relative au joueur. | `src/render/sprites/billboard.ts`, `src/render/sprites/enemySprites.ts` |
| Bake / éclairage hybride | Cuisson de l'éclairage indirect en vertex colors, combinée à de vraies lampes temps réel (`LevelDef.lighting`). | `src/render/environment/lightPool.ts`, `src/game/level/catalog/levels.ts` |
| `Col` / `COLOR_0` | Attribut de couleur de sommet portant l'éclairage/l'ombre bakée, exporté en glTF sous `COLOR_0` et lu par Three.js via `vertexColors: true`. | `src/game/level/loading/loader.ts`, `src/render/viewmodel/viewmodel.ts` |
| Decal | Plan texturé posé sur le décor STATIQUE pour un impact de tir ; jamais sur une entité mobile (prop, porte, ennemi, joueur). | `src/render/fx/fx.ts` |
| Fusion du décor par cellule | Le décor statique est regroupé par matériau et par cellule cubique de 48 m (`DECOR_CELL_SIZE`) pour limiter le nombre de lots de dessin. | `src/game/level/loading/mergeStaticDecor.ts` |
| Lot de dessin (draw call) | Une soumission de géométrie au GPU ; le budget du niveau v2 est mesuré en lots par pire vue (~200). | `src/game/level/loading/mergeStaticDecor.ts` |
| `MeshLambertMaterial` | Matériau Lambert classique, utilisé par défaut pour les niveaux et les viewmodels. | `src/render/viewmodel/viewmodel.ts` |
| `MeshLambertNodeMaterial` | Variante nodale du Lambert classique ; permet de composer un shader avec TSL en gardant l'éclairage Lambert. | `src/game/level/sanitaires/doucheShader.ts` |
| TSL | Three.js Shading Language : langage nodal pour composer des matériaux et shaders Three.js. | `src/game/level/sanitaires/doucheShader.ts` |
| `WebGLNodesHandler` | Adaptateur qui permet au `WebGLRenderer` de dessiner des matériaux Node/TSL. | `src/render/pipeline/renderer.ts` |
| Muzzle flash | Éclair lumineux posé au bout du canon affiché à chaque tir d'une arme À FEU ; le pied-de-biche n'en a pas (pas de canon), le typage l'empêche d'en recevoir un. | `src/render/fx/fx.ts` |
| Mipmap / anisotropie | Réglages de filtrage à la RÉDUCTION d'une texture (vue de loin) : le mipmap précalcule des versions réduites pour éviter le crénelage, l'anisotropie affine ce filtrage sur les surfaces vues en biais (sols, couloirs). Distinct de `NearestFilter`, qui régit l'AGRANDISSEMENT (invariant #4). | `src/render/pipeline/renderer.ts` |
| `NearestFilter` | Filtrage sans interpolation à l'agrandissement des textures, responsable du gros pixel rétro (invariant #4). | `src/render/pipeline/renderer.ts` |
| PBR (Physically Based Rendering) | Famille de modèles d'éclairage fondés sur des propriétés de surface comme la rugosité et le métalness ; `MeshStandardMaterial` en est un exemple. | `docs/3-architecture/invariants.md` |
| Pool de lampes | `LightPool` ne garde que 48 lampes allumées par vue, les plus proches par distance au bord de leur sphère d'influence. | `src/render/environment/lightPool.ts` |
| Résolution interne 640×360 | Résolution de rendu réelle, upscalée à l'écran (invariant #4). | `src/render/pipeline/renderer.ts` |
| Viewmodel | Modèle d'arme en vue subjective, tenu par les avant-bras du joueur, animé procéduralement au pas fixe. | `src/render/viewmodel/viewmodel.ts` |

## Niveau

| Terme | Définition | Où le voir |
|---|---|---|
| Empty Blender | Nœud sans géométrie utilisé comme repère de spawn, lumière ou caméra ; il est exporté comme nœud glTF. | `src/game/level/loading/loader.ts` |
| Blockout | Version en volumes gris d'un espace, jouable avant tout habillage. | CLAUDE.md (« Chantier Niveau v2 ») |
| Custom property (extras) | Propriété Blender personnalisée lue par le loader depuis les `extras` du glTF (ex. `masse`, `pv`, `card`, `requires`). | `src/game/level/loading/loader.ts`, `docs/6-reference/conventions-nommage.md` |
| glTF / `.glb` | Format d'export du niveau depuis Blender ; seul fichier lu par le jeu en runtime (`public/assets/levels/`). | `src/game/level/loading/loader.ts` |
| Graphe de navigation / pathfinding 2.5D | Structure construite au chargement du niveau à partir des colliders `WORLD`, utilisée par les ennemis pour se déplacer. | `src/game/level/navigation/pathfinding.ts` |
| Habillage | Passe qui remplace les volumes gris d'un espace par du décor texturé, sans retoucher la structure validée au blockout. | CLAUDE.md (« Chantier Niveau v2 », N9) |
| Hot reload | Rechargement du niveau en développement par sondage HTTP (`HEAD`, ETag/Last-Modified), actif uniquement sous `import.meta.env.DEV`. | `src/game/level/loading/hotReload.ts` |
| Kit modulaire | Ensemble de pièces paramétriques réutilisées pour construire le niveau (murs, sols, gondoles…). | `docs/6-reference/conventions-nommage.md` |
| `_KIT` / `_LIB` | Collections Blender portant les patrons d'assets (kit modulaire, bibliothèque), jamais exportées telles quelles dans le niveau. | `docs/6-reference/conventions-nommage.md` |
| Plan de masse | Vue de dessus du niveau reliant les espaces entre eux, régénérée à chaque changement de structure. | CLAUDE.md (« Chantier Niveau v2 ») |
| Préfixes de nommage (`col_*`, `spawn_*` — dont `spawn_rampant_*` et `spawn_vigile_*` —, `trig_*`, `door_*`, `use_*`, `secret_*`, `prop_*`, `vitre_*`, `sanitaire_*`, `ecran_*`, `light_*`, `cam_*`) | Convention de nommage d'objet Blender qui pilote l'import : chaque préfixe déclenche un traitement précis au chargement (collider, spawn, trigger, porte animée, interactif, secret, prop physique, vitrage, sanitaire, écran, lumière ou caméra). | `src/game/level/loading/loader.ts`, `docs/6-reference/conventions-nommage.md` |

## Audio

| Terme | Définition | Où le voir |
|---|---|---|
| Audio sprite | Fichier audio unique (`sfx.ogg`/`sfx.m4a` + `sfx.json`) contenant tous les sons du jeu à des positions différentes, chargé une fois. | `src/core/audio/audio.ts` |
| Distance de timbre | Mesure de similarité spectrale entre deux sons (corrélation sur 30 bandes log, `ressemblance`) ; deux sons qui doivent se distinguer restent sous 0,55. | `tools/audio/analyze_sfx.py` |
| Facteur de crête | Écart entre le niveau moyen et le niveau crête d'un son (`crest_db`) ; sert à juger le volume perçu, pas le pic brut. | `tools/audio/analyze_sfx.py` |
| Masquage | Contrainte de gameplay : un son important (ex. télégraphie ennemie) ne doit pas être couvert par un son plus fort au même moment (`masking`). | `tools/audio/analyze_sfx.py` |
| Recette | Description en texte d'un son procédural (couches DSP, paramètres), rendue en fichier par le studio audio. | `tools/audio/recipes.py` |
| `SFX_TABLE` | Table qui relie un identifiant de son du JEU à un nom de recette du STUDIO AUDIO — seul endroit à modifier pour renommer un son côté jeu. | `src/core/audio/audio.ts` |

## Audio runtime et qualité

| Terme | Définition | Où le voir |
|---|---|---|
| Codec audio | Format ou méthode de compression utilisé pour distribuer un fichier sonore. | `tools/audio/build_sprite.py` |
| Encodeur audio | Outil qui transforme le WAV source en format compressé lisible par les navigateurs. | `tools/audio/build_sprite.py` |
| `Howl` / Howler | `Howl` est une instance de lecture ; Howler est la bibliothèque qui charge et joue les sources sonores du runtime. | `src/core/audio/audio.ts` |
| `localStorage` | Stockage navigateur persistant entre deux visites, utilisé pour mémoriser les réglages audio et graphiques. | `src/game/settings/audioSettings.ts`, `src/game/settings/graphicsSettings.ts` |
| Manifeste d'asset | Fichier de données associé à un asset, qui décrit les clés, coordonnées ou durées dont le lecteur a besoin. | `public/assets/audio/sfx/sfx.json` |
| Spectrogramme | Représentation de l'énergie d'un signal audio selon la fréquence et le temps. | `tools/audio/analyze_sfx.py` |
| Test d'intégration | Test qui vérifie plusieurs modules assemblés dans un même parcours, au-delà d'une fonction isolée. | `test/game/integration/` |
| Test unitaire | Test qui vérifie un contrat limité d'une fonction ou d'un module isolé. | `test/core/`, `test/game/` |
| Web Audio | API audio du navigateur utilisée par Howler pour les effets qui demandent un contrôle de gain ou de panoramique. | `src/core/audio/waterAmbience.ts` |

## Interface et affichage

| Terme | Définition | Où le voir |
|---|---|---|
| Acteur XState | Instance vivante d'une machine qui reçoit des événements et expose un snapshot de son état courant. | `src/app/navigation/gameFlowMachine.ts`, `src/main.ts` |
| Barrel | Module de réexport qui rassemble plusieurs fichiers derrière un point d'entrée, souvent nommé `index.ts` ; les conventions React du dépôt l'interdisent. | `docs/6-reference/react-structure.md` |
| Callback | Fonction transmise par un composant parent pour déléguer une action à une autre couche. | `src/ui/App/App.tsx` |
| CSS Modules | Système de styles dont les classes sont propres au composant qui importe le fichier CSS. | `docs/6-reference/react-css.md` |
| Composant React | Unité d'interface qui rend une partie de l'arbre React et peut lire les données nécessaires à son affichage. | `src/ui/` |
| Sélecteur Zustand | Fonction d'abonnement qui choisit dans le store la valeur utilisée par un composant React. | `src/game/hud/state.ts`, `src/ui/` |
| Snapshot XState | Valeur immuable publiée par un acteur XState après un changement de son état courant. | `src/main.ts` |
| Widget HUD | Petit composant d'affichage du HUD, responsable de lire ses propres données dans le store. | `src/ui/hud/widgets/` |

## Construction et vérification

| Terme | Définition | Où le voir |
|---|---|---|
| Gizmo | Repère ou forme de diagnostic affiché pour rendre visible une donnée spatiale, comme une direction de tir. | `src/game/loop/updateFx.ts` |
| Headless | Exécution de Blender sans interface graphique, utile pour les constructions et validations reproductibles qui ne demandent pas d'observation dans une session ouverte. | `tools/blender/README.md` |
| Vitest | Exécuteur de tests JavaScript/TypeScript utilisé pour lancer les tests du dossier `test/`. | `vitest.config.ts` |

## Outillage et process

| Terme | Définition | Où le voir |
|---|---|---|
| A/B (comparaison) | Essai de variantes en ne changeant qu'un axe, avec le même état et le même input, afin de fournir des résultats comparables au playtest. | [Régler la sensation](../5-guides/regler-la-sensation.md) |
| ADR | Architecture Decision Record : document qui fige une décision technique datée, jamais réécrit après coup (seul son statut change). | `docs/decisions/` |
| Agent | Sous-agent spécialisé (`level-forge`, `shell`, `sound-forge`…) routé par l'agent `director` pour une tâche précise du jeu. | CLAUDE.md, `.claude/skills/` |
| `audit_niveau.py` | Script d'audit géométrique du niveau (trous de sol, bords ouverts, interpénétrations, objets flottants), à lancer après chaque construction. | `tools/level_v2/audit_niveau.py` |
| CC0 | Indication du registre d'assets pour une source déclarée sous CC0 ; la fiche d'origine et son attribution éventuelle restent consignées dans le registre. | `assets_src/LICENCES_ASSETS.md` |
| Console `cassandre` (`window.cassandre`) | Objet global exposé en développement pour inspecter/piloter le jeu depuis la console navigateur (niveau, portes, secrets, armes…) ; `game/devtools` est le seul dossier à l'écrire. | `src/game/devtools/consoleApi.ts` |
| Gate | Critère de validation qui doit être franchi avant de passer à la suite (ex. gate de structure, gate `qa-evidence` — abandonné par défaut depuis 2026-08-19/20). | CLAUDE.md (fin de fichier) |
| Playtest | Session de jeu réelle par l'utilisateur, seul juge du ressenti (fun, lisibilité) — ce qu'aucun agent ne peut vérifier seul. | CLAUDE.md |
| Session Blender live (MCP) | Mode de travail où les scripts modifient une session Blender déjà ouverte via le MCP, plutôt qu'un rebuild headless. | skill `blender-python-automation` |
| Skill | Paquet d'instructions chargé par un agent avant une tâche précise (conventions, pièges connus, procédure). | `.claude/skills/` |
| `validate_level.py` | Script de validation stricte du niveau exporté (grille, préfixes, textures, avertissements connus). | `tools/blender/validate_level.py` |
