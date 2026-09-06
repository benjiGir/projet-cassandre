---
title: Session de partie
tags: [systeme, core]
status: stable
updated: 2026-09-06
---

# Session de partie

Une partie a un cycle de vie complet : elle démarre (choix du niveau, mise
en place du monde), elle tourne (le joueur combat, ramasse des objets,
franchit des portes), et elle se termine (mort ou fin de niveau) sur un
écran qui propose de rejouer ou de revenir au menu — sans jamais recharger
la page. Ce document explique comment le code sépare ce qui doit survivre à
cette boucle (le moteur de rendu, les atlas de sprites, la caméra) de ce qui
doit être entièrement reconstruit à chaque partie (le monde physique, les
ennemis, la progression), et retrace le chemin exact que suit une partie du
boot au reset. Pour l'écran affiché à chaque étape de ce cycle, voir [HUD et
interface — Flux d'écran](hud.md#flux-décran) : ce document-ci couvre la
construction/destruction des objets de simulation, l'autre la machine
d'états qui décide quel composant React est monté.

## Le cycle de vie d'une partie, du boot au reset

Construit par lecture directe de `main.ts`,
`game/session/bootChoice.ts`/`gameEngine.ts`/`lifecycle.ts` :

```mermaid
flowchart TD
    Start([Lancement de la page]) --> Choice["resolveBootChoice : menu principal\nou ?level= dans l'URL"]
    Choice --> Persistent["buildGameEngine : construit PersistentEngine\n(scène, caméra, atlas, rendu cosmétique) — UNE SEULE FOIS"]
    Persistent --> Boot["bootGameSession : construit GameSession\n(monde Rapier, joueur, armes, ennemis, niveau)"]
    Boot --> Running["La partie tourne : pas fixe + rendu\n(startLoop, voir Boucle de jeu)"]
    Running -->|PV à zéro| Died["handlePlayerHit déclenche DIED"]
    Running -->|door_e_exit franchie| Complete["triggerLevelComplete déclenche LEVEL_COMPLETED"]
    Died --> Screen{"Écran de mort ou\nde fin de niveau"}
    Complete --> Screen
    Screen -->|Rejouer| Replay["replay : teardownGameSession\npuis bootGameSession avec le MÊME LevelDef"]
    Screen -->|Retour au menu| ReturnMenu["returnToMenu : teardownGameSession,\nretire ?level de l'URL, puis resolveBootChoice"]
    Replay --> Running
    ReturnMenu --> Boot
```

Trois points que ce diagramme ne montre pas explicitement :

- **`buildGameEngine` n'a lieu qu'une seule fois pour toute la durée de
  l'onglet** — le rectangle « PersistentEngine » n'est jamais retraversé,
  contrairement à `bootGameSession`, rejoué à chaque « Rejouer »/« Retour au
  menu ». C'est tout le sujet de la section suivante.
- **`teardownGameSession` a lieu avant chaque reconstruction**, jamais
  après — une partie n'est jamais laissée à moitié détruite pendant qu'une
  nouvelle se construit.
- Le refactor du 2026-09-05 qui a fait émerger ce découpage est raconté
  dans la section [Origine des modules game/session](#origine-des-modules-gamesession)
  plus bas, pour qui cherche pourquoi le code vit à cet endroit précis.

## L'état persistant du process (GameEngine)

`GameEngine` (`gameEngine.ts`) rassemble tout ce que `main()` construisait
UNE SEULE FOIS avant le refactor du 2026-09-05, en variables locales : le
moteur de rendu, les atlas partagés, la caméra — tout ce qui n'a aucune
raison d'être reconstruit à chaque reset de partie. Construit une seule
fois par `buildGameEngine`, avant le tout premier `bootGameSession`, il
survit à un reset (`bootGameSession`/`teardownGameSession`), contrairement
à `GameSession` (voir plus bas).

Ce qu'il possède : scène/caméra/renderer, `clock` (pur accumulateur de
hitstop, aucun état de partie), les systèmes de rendu cosmétiques
(`fx`/`viewmodel`/`crosshair`/`hitmarker`/`ballisticsDebug`/
`wireframeToggle`), les atlas et géométries partagés entre TOUTES les
parties (`suitAtlas`/`directorAtlas`/`badgeGeometry`/`badgeMaterial` — voir
« LE PIÈGE DU PARTAGE DE TEXTURE » dans `render/billboard.ts`), la visée
(`look`/`lookDelta`, mutés en place et jamais recréés en objet neuf —
`interpolateVisuals.ts` ferme dessus par référence), `interaction`
(`InteractionSystem`, instance unique pour tout l'onglet), et enfin
`session`, la partie courante.

Ce qui n'y est délibérément PAS : les scratch vectors qui ne servent qu'à
UNE SEULE phase de boucle (ex. `eyePosition`/`cameraEuler`, module-locaux à
`interpolateVisuals.ts`), et les constantes qui ne changent jamais au fil
d'une partie (`HERO_LINE_*`, `VIEWS_*`, `DOOR_OPEN_DURATION`...) — les
rendre « persistantes » via `GameEngine` n'apporterait rien. Seule
exception : `ballPrevPos`/`ballPrevQuat`/`ballCurrPos`/`ballCurrQuat`
(scratch de la balle de test du chemin « gym ») reste sur `GameEngine` car
il est PARTAGÉ entre deux fichiers distincts (`loop/stepPhysics.ts` écrit
`ballCurr*`, `loop/interpolateVisuals.ts` lit les deux pour interpoler) — la
règle qui sépare « module-local » de « sur GameEngine » est le nombre de
fichiers qui lisent/écrivent la valeur, pas son ancienneté ou son
importance perçue.

`buildGameEngine` construit tout ça en une passe (scène, lumières, caméra,
systèmes de rendu cosmétiques, atlas, badge, scratch de balle, visée,
wireframe, interaction) et retourne un type un peu différent, sans le champ
`session` — voir la section suivante pour la raison.

## Un type intermédiaire pour éviter une dépendance circulaire (PersistentEngine)

`PersistentEngine = Omit<GameEngine, "session">` (`gameEngine.ts`) existe
pour résoudre un problème d'ordre de construction : `buildGameEngine` doit
exister AVANT que la toute première `GameSession` puisse être construite
(`bootGameSession` lit `scene`/`look`/`clock`/etc.), mais le type
`GameEngine` complet exige un champ `session` non nul — un vrai
« œuf et poule ».

`bootGameSession`/`teardownGameSession` (`lifecycle.ts`) et
`spawnSuitAt`/`spawnDirectorAt`/`loadGltfLevel` (`spawning.ts`) sont donc
typées pour accepter `PersistentEngine`, pas `GameEngine` : elles ne lisent
jamais `engine.session`, ce qui leur permet d'être appelées avant que la
toute première session n'existe. Un `GameEngine` complet reste assignable
partout où `PersistentEngine` est attendu, par sous-typage structurel
(champ `session` en trop, ignoré) — les appels ultérieurs (`replay`/
`returnToMenu`, qui possèdent le `GameEngine` complet) fonctionnent donc
avec les MÊMES fonctions, sans caster quoi que ce soit.

Voir [ADR 0014](../decisions/0014-gameengine-persistentengine-separes.md)
pour la décision de séparer les deux types plutôt que d'utiliser un unique
`GameEngine` avec un champ `session: GameSession | null`.

## Savoir si le monde physique est vivant (isPhysicsSessionLive)

Entre deux parties, il existe une fenêtre où `engine.session` pointe encore
vers un objet JS valide, mais dont le monde Rapier sous-jacent a déjà été
libéré — `isPhysicsSessionLive(engine)` (`gameEngine.ts`) répond à la
question « est-il sûr de toucher `engine.session.physics.world`
maintenant ? ». Elle est fausse dans deux cas : avant le tout premier
`bootGameSession` (`boot`/`mainMenu`/`options`/`levelSelect`, le monde n'a
pas encore été construit), et pendant la fenêtre transitoire de
`returnToMenu()` (`teardownGameSession` libère le monde PUIS attend,
potentiellement plusieurs secondes le temps que l'utilisateur navigue le
menu, avant qu'un nouveau `bootGameSession` n'en construise un — `session`
continue de pointer vers l'ancien objet JS pendant cette fenêtre, mais son
`physics.world` Rapier sous-jacent est détruit côté WASM).

Utilisée UNIQUEMENT par `loop/stepPhysics.ts` et le harnais F9/F10 —
`updateGameplay`/`interpolateVisuals`/`updateFx` ne touchent jamais Rapier
directement et n'ont pas besoin de cette garde. Voir [ADR
0013](../decisions/0013-garde-flux-vs-monde-physique.md) pour la
distinction complète avec la garde `flowActor`, une préoccupation
différente qu'il ne faut pas confondre avec celle-ci.

## L'état propre à une partie (GameSession)

`GameSession` (`gameSession.ts`) est TOUT l'état d'UNE PARTIE — détruit et
reconstruit à chaque `bootGameSession`/`teardownGameSession`. Avant le
jalon qui l'a introduit, tout ce qui suit vivait en variables locales de
`main()`, construites une seule fois au boot : aucun chemin de reset
n'existait (jugé disproportionné en Phase 6, voir `CLAUDE.md`). Au lieu
d'une vingtaine de variables mutables indépendantes, un seul objet
remplacé d'un bloc à chaque reset (`engine.session = ...`).

Groupes de champs :

- **Choix et simulation** : `choice` (le `LevelDef` de cette partie, pour
  que « Rejouer » reconstruise exactement le même), `physics`/`player`/
  `weapons`, `suitManager`/`directorManager` + leurs `Map<number,
  BillboardSprite>` (un sprite par entité vivante/cadavre, tenu côté
  session car le rendu n'appartient pas aux entités elles-mêmes — voir
  [Entités et IA](entites.md)).
- **Géométrie du niveau**, deux chemins mutuellement exclusifs : `gymRoot`/
  `ballMesh`/`ballBody` (chemin « gym » seulement, `null` sur le chemin
  glTF) vs `gltfLevelSession`/`currentNavGraph` (chemin glTF seulement).
  `gymRoot` regroupe TOUTE la géométrie de la gym (murs, rampes, marches) et
  la balle de test comme enfants d'un seul `THREE.Group` : un unique
  `scene.remove(gymRoot)` au teardown les retire tous, sans qu'aucun code
  de `gym.ts` n'ait besoin de retourner la liste de ce qu'il a créé.
- **Suivi de progression** : badge du Directeur (`badgeMesh`/`hasBadge`),
  portes (`unlockedDoors`/`openingDoor`/`exitDoorTracking`, voir
  [Portes et fin de niveau](#portes-et-fin-de-niveau)), secrets
  (`foundSecrets`, `WeakSet` par référence de mesh).
- **État du joueur et idempotence** : `playerHp`, `firstKillTriggered`/
  `lowHpLineTriggered` (répliques déclenchées une seule fois par partie),
  `deathHandled`/`levelCompleteHandled` (empêchent un double envoi d'
  évènement à l'acteur de flux si plusieurs coups arrivent dans le même pas
  fixe, voir [Feedback joueur](#feedback-joueur)), `lastHeroLineAt`
  (cooldown des répliques, PROPRE À la partie : une réplique juste avant la
  mort ne doit pas geler le canal de la partie suivante après « Rejouer »).

`OpeningDoor` (glissement cosmétique d'un vantail) et `ExitDoorTracking`
(suivi de franchissement de `door_e_exit`) sont deux types satellites du
même fichier — voir [Portes et fin de niveau](#portes-et-fin-de-niveau)
pour leur usage.

## Construire une partie

`bootGameSession(engine, choice)` (`lifecycle.ts`) construit une partie
complète : remet `game/state.ts` à ses valeurs de boot, construit
`PhysicsWorld` puis `player`/`weapons`/`suitManager`/`directorManager` à
partir de lui, la géométrie du niveau (gym ou session glTF, mutuellement
exclusives), et tout l'état de suivi par partie. Appelée une fois au tout
premier boot, puis à nouveau à chaque « Rejouer »/« Retour au menu » — ce
réemploi est ce qui rend le reset possible.

`resetGameStore()` (`game/state.ts`), appelée en tout premier dans
`bootGameSession`, reconstruit `debug` en un TOUT NOUVEL objet à chaque
appel (jamais `INITIAL_DEBUG` partagé par référence) — `setDebug`/
`setPlayerHp`/etc. ne mutent jamais leur cible en place, mais repartir
d'une copie fraîche à chaque reset reste la garantie la plus simple à
vérifier. Efface aussi les messages transitoires (`hudMessage`/`heroLine`)
sans toucher `flowState`, géré séparément par l'acteur de flux (voir [HUD
et interface — Flux d'écran](hud.md#flux-décran)).

Chemin « gym » : construit une géométrie de test (`buildGym`) et une balle
dynamique (témoin de collision et de
`setApplyImpulsesToDynamicBodies`) — sa position/vitesse initiales ont été
vérifiées par calcul pour qu'elle reste contenue dans le hub (44×44 m)
pendant toute une session, jamais éjectée vers une autre aile. Trois
Costards de test sont posés à 15-22 m du spawn (au-delà de la portée de
mêlée, en-deçà de `suitConfig.sightRange`) : positions de test de la gym
uniquement, sans rapport avec le contenu d'un niveau glTF.

Chemin glTF : le joueur est positionné provisoirement (0, 2, 0) — il tombe
quelques pas fixes dans le vide (gravité −25 m/s², invariant #7) jusqu'à ce
que le callback `onLoaded` de `loadGltfLevel` (voir [Spawn et chargement de
niveau](#spawn-et-chargement-de-niveau)) le repositionne sur
`spawn_player`.

Ce qui n'est PAS reconstruit ici : tout ce qui vit sur `GameEngine` (voir
[L'état persistant du process](#létat-persistant-du-process-gameengine)) —
ces systèmes sont stateless vis-à-vis d'une partie précise, ou leur état
interne s'auto-invalide sans code de reset dédié (le `WeakSet`
d'`interaction`, par exemple).

## Démolir une partie

`teardownGameSession(engine, session)` (`lifecycle.ts`) détruit une partie
complète, dans un ordre précis : dispose la session de niveau glTF (déjà
gérée par `LevelSession.stop()`), retire la géométrie propre à `session` de
`scene` (gym + balle de test, en un seul `scene.remove(gymRoot)`) puis
dispose géométries/matériaux, dispose les sprites billboard (Costards +
Directeur), retire le mesh du badge s'il traînait, puis
`physics.world.free()` EN DERNIER.

Cet ordre EN DERNIER n'est pas arbitraire : libérer le monde Rapier libère
TOUS ses corps/colliders/`KinematicCharacterController` d'un coup — l'API
elle-même documente qu'il n'y a pas besoin d'appeler leurs `.free()`
individuellement (vérifié dans les types Rapier, même usage déjà en place
dans `game/devtools/testHarness.ts::simulateRecording`). Aucun nettoyage
Rapier séparé n'est donc nécessaire pour `player`/`suitManager`/
`directorManager`/`weapons`, qui deviennent simplement inatteignables et
sont ramassés par le GC JS normal.

## Rejouer et retour au menu

`replay(engine)` reconstruit exactement le même `LevelDef` que la partie
qui vient de se terminer (`session.choice`). Aucun `root.render()` n'est
nécessaire : `<App/>` reste monté tout du long (voir `main.ts`), seul
`state.flowState` change — c'est ce qui rend « Rejouer » instantané, sans
rechargement de page.

`returnToMenu(engine)` détruit la partie courante puis réaffiche le menu
principal en réutilisant `resolveBootChoice` telle quelle (même fonction
que le tout premier boot). Réplique une garantie de l'ancien
`reloadToMainMenu()` (`ui/screenNav.ts`, supprimé à ce jalon) : peu importe
comment la partie a démarré (`?level=...` ou le vrai menu), « Retour au
menu principal » doit toujours retomber sur le VRAI menu, jamais rejouer
silencieusement le même `?level=` bypass. Piège à ne pas réintroduire :
`resolveBootChoice` relit `window.location.search` fraîchement à chaque
appel, donc `returnToMenu` DOIT retirer `level` de l'URL (via
`history.replaceState`, sans rechargement de page) AVANT de la rappeler —
sans ce retrait, une partie démarrée via `?level=zone_a_parking` reviendrait
silencieusement au même niveau au lieu du vrai menu principal.

## Choix du niveau au boot

Cette résolution a lieu TOUT EN HAUT de `main()` (`src/main.ts`), avant
`root.render(App)`, `input.attach`, `initAudio`/`initMusic` et la
construction de la scène/caméra/renderer/physique — l'invariant #2 (React ne
touche jamais la boucle) y est trivialement respecté : il n'existe même pas
encore de boucle à ce stade.

`resolveLevelChoice(root)` (`bootChoice.ts`) résout le `LevelDef` de boot
avant toute construction de scène/monde. Deux voies dans cet ordre :
`?level=<id enregistré>` bypasse tout menu ; `?level=<nom>` non enregistré
est traité comme un nom de fichier glTF brut (mode d'itération pour tester
une zone en cours d'export, avant qu'elle ait une entrée officielle dans le
registre — flexibilité délibérément préservée) ; sinon `LevelMenu` s'affiche
et attend le choix de l'utilisateur.

`resolveBootChoice(root)` enrobe `resolveLevelChoice` d'un menu principal
(Phase 6) sans jamais l'afficher quand `?level=` est présent — les deux
chemins historiques (`?level=` enregistré ou non) continuent de fonctionner
exactement comme avant, la logique n'est pas dupliquée, seulement enrobée.
Sans `?level=` : affiche `MainMenu` (Jouer / Options / Quitter). « Jouer »
résout DIRECTEMENT sur `hypermarche_complet`, sans passer par `LevelMenu`
(resté un outil de dev, atteignable via un lien discret). « Options »
affiche `RebindScreen`. Réutilisée par `returnToMenu` (voir plus haut) —
exactement comme au tout premier boot.

## Spawn et chargement de niveau

`spawnSuitAt`/`spawnDirectorAt` (`spawning.ts`) prennent `engine`/`session`
en paramètres explicites plutôt que de lire `engine.session` : elles sont
aussi appelées DEPUIS `bootGameSession`, pendant la construction d'une
NOUVELLE session qui n'est pas encore devenue « la » session courante. Leur
faire lire `engine.session` pousserait alors l'entité dans l'ANCIENNE
partie (celle en cours de remplacement) — un bug de lisibilité silencieux
qui se lirait comme « l'ennemi n'apparaît jamais », pas comme une erreur
claire.

`loadGltfLevel(engine, session, name)` charge (ou recharge)
`public/assets/levels/<name>.glb` dans `session` via `createLevelSession`
(voir [ADR 0011](../decisions/0011-hot-reload-sondage-http.md) pour le
mécanisme de hot reload lui-même). Son callback `onLoaded` : bake le graphe
de praticabilité sur les bounds du niveau chargé, logue des diagnostics, et
surtout ne repositionne le joueur / ne fait apparaître les Costards et le
Directeur QUE si `info.isFirstLoad` — un hot reload pendant une partie ne
doit JAMAIS respawn le joueur ni dupliquer un ennemi, c'est le cœur du
contrat < 60 s du pipeline de niveau. Le compteur de secrets
(`debug.secretsTotal`), lui, est mis à jour à CHAQUE chargement (pas
seulement `isFirstLoad`) puisqu'il décrit une propriété du niveau chargé,
pas un évènement ponctuel de partie.

`debugFindPath(session, from, to)` est un wrapper console pour
`PathfindingService.findPath` sur le graphe courant de `session`.

## Portes et fin de niveau

`unlockDoor(session, targetName, successMessage)` (`doors.ts`) déverrouille
un `door_*` (glissement cosmétique + collider désactivé) — factorisée entre
`onExitDoorUse` (Zone E, gardé par le badge du Directeur) et
`onFrozenStorageUse` (secret de Zone B, sans garde) : même mécanique de
porte, seule la condition d'appel diffère, décidée par l'appelant.

`setupExitDoorTracking(session, doorName)` arme le suivi de franchissement
de `door_e_exit`. L'axe de franchissement est dérivé par une heuristique
géométrique : l'axe local le plus fin du vantail (hors hauteur) est son
épaisseur, donc sa normale — la même heuristique que
`buildCuboidCollider`/`buildDoor` dans le loader de niveau, parce que les
données Blender ne portent jamais un « axe de porte » explicite. Cet axe
local est ensuite transformé par la rotation réelle du corps Rapier pour
obtenir l'axe monde.

`triggerLevelComplete(engine, session)` bascule vers l'écran de fin de
niveau (envoie `LEVEL_COMPLETED` à l'acteur de flux) et libère le pointeur,
comme à la mort — l'écran de fin de niveau a besoin du curseur pour ses
boutons.

## Feedback joueur

`showHudMessage(text)` (`feedback.ts`) et `triggerHeroLine(session, text)`
sont deux canaux séparés, voir [HUD et audio](hud-audio.md) pour le
mécanisme de ducking musical déclenché par le second. `showHudMessage` est
le canal FACTUEL (porte, badge, secret n/total...), sans cooldown,
indépendant de toute partie en cours (store global uniquement).
`triggerHeroLine` est le canal des répliques du héros — cooldown global de
15 s PROPRE À `session` (`session.lastHeroLineAt`) : une réplique juste
avant la mort ne doit pas geler le canal de la PROCHAINE partie après
« Rejouer ». Le `setTimeout` qui restaure le volume musical après le
ducking ne dépend lui d'AUCUN état de partie (juste du texte affiché et du
volume musique, tous deux globaux) : il reste correct même si un reset
(« Rejouer »/« Retour au menu ») survient pendant la fenêtre d'affichage
d'une réplique.

`handlePlayerHit(engine, session)` est appelée juste après chaque
décrément de `session.playerHp` (Costard ET Directeur, même contrat) :
détecte, dans l'ordre, la réplique « PV bas » (premier franchissement de la
partie) puis la mort — un coup qui amène `playerHp` à 0 pile sous le seuil
ne déclenche PAS la réplique en plus de l'écran de mort, la mort prime.
L'idempotence (`session.deathHandled`) reste nécessaire malgré la garde de
`updateGameplay` (`flowState !== "playing"` → return) : plusieurs
`playerHitEvents` peuvent arriver dans le MÊME pas fixe (deux Costards qui
touchent au même instant), et c'est `updateFx` — jamais gatée par le flux,
elle continue de drainer les files après la mort — qui les traite un par un
dans la même frame. Sans ce flag, un second appel enverrait un second
`DIED` (no-op côté machine XState) et un second `exitPointerLock()`
(idempotent côté DOM) : inoffensif, mais le flag documente l'intention
plutôt que de compter sur ces deux idempotences accidentelles.

## Harnais F9 et F10

`startRecording`/`startPlayback` (`recording.ts`) sont de fins wrappers
autour d'`inputRecorder` (voir [Boucle de jeu — Enregistrement et rejeu
déterministe](boucle-de-jeu.md#enregistrement-et-rejeu-déterministe) pour
le fonctionnement et l'usage du harnais lui-même). La détection des touches
F9/F10 vit dans `game/loop/updateFx.ts`, pas ici — ce fichier ne fait que
capturer/restaurer l'état initial du joueur (position, vitesse, yaw/pitch).

## Origine des modules game/session

Le 2026-09-05, `src/main.ts` (2229 lignes, une seule fonction `main()` de
~1530 lignes fermée sur ~35 variables locales par ~15 fonctions imbriquées
et les 5 callbacks de `startLoop`) a été éclaté en modules. Les fonctions et
types qui géraient le cycle de vie d'une partie ont rejoint
`src/game/session/` (`bootChoice.ts`, `doors.ts`, `feedback.ts`,
`gameEngine.ts`, `gameSession.ts`, `lifecycle.ts`, `recording.ts`,
`spawning.ts`) — extraction structurelle pure, chaque fonction reçoit
désormais `engine`/`session` en paramètres explicites à la place de la
fermeture qu'elle avait sur le scope de `main()`, sans changement de
comportement observable. `main.ts` (129 lignes après coup) reste
l'orchestrateur : il construit l'acteur de flux, résout le choix de niveau,
construit `GameEngine`/`GameSession`, monte `<App/>` et câble les callbacks
de `game/loop/`. Voir [Boucle de jeu — Origine des modules
game/loop](boucle-de-jeu.md#origine-des-modules) pour l'extraction
symétrique côté callbacks de boucle.

Même principe que le retrofit Effect de `loader.ts` au jalon M2 (principe
transverse #4, `PLAN_EFFECT_XSTATE.md` §1) : une extraction structurelle ne
change jamais le comportement observable, seule la testabilité/lisibilité
progresse.

Retour à la [carte de la documentation](../README.md).
