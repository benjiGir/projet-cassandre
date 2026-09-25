---
title: Outils de debug
tags: [systeme, debug]
status: stable
updated: 2026-09-22
---

# Outils de debug

Ce jeu se debug et se règle en jouant, pas en relisant des logs : une
console (`window.cassandre`) pour inspecter/manipuler l'état en direct, un
panneau à l'écran pour les valeurs qui changent en continu, et un harnais
capable de rejouer une séquence d'input identique au pas fixe près pour
comparer objectivement deux réglages de feel ou prouver l'absence de
non-déterminisme. `src/game/devtools/` regroupe deux fichiers seulement :
le point d'entrée console (`consoleApi.ts`) et le harnais de simulation hors
écran (`testHarness.ts`), utilisé aussi bien par les harnais A/B de feel que
par la preuve de déterminisme. Les touches de debug au clavier (`V`
wireframe, `B` gizmos balistiques, `F9`/`F10` enregistrement/rejeu) ne
vivent **pas** ici : elles sont câblées dans `game/loop/updateFx.ts` — voir
[Contrôles et bindings](../reference/controles.md) pour la liste complète
des touches de debug et pourquoi elles sont volontairement absentes de la
table de rebinding.

**Rien de tout cela n'existe dans le build de production** (2026-09-22) :
`DebugPanel` y est remplacé par un simple compteur d'images par seconde
(`ui/hud/overlays/FpsCounter/FpsCounter.tsx`, même coin), `TuningPanel` n'est pas monté,
`window.cassandre` n'est pas construit et les touches de dev ne sont pas
lues. Chaque garde est un `import.meta.env.DEV`, remplacé par une constante
au build : la branche disparaît du bundle, elle n'est pas seulement
masquée. Un outil de dev dont on veut la trace en prod se diagnostique donc
sur `pnpm dev`, pas sur la page déployée.

## Champs de DebugState

`DebugState` (`game/state.ts`) est la source commune à `DebugPanel` (tout le
panneau, `state.debug` en entier) et au HUD de production `ui/hud/`
(chaque widget sélectionne ses propres champs) — voir [HUD et interface — HUD de
production](hud.md#hud-de-production). Deux disciplines d'écriture, jamais
un `setState` par pas fixe (invariant #2) :

- **Throttlée à 10 Hz** (`setDebug`, constante `DEBUG_UPDATE_INTERVAL` dans
  `game/loop/updateFx.ts`) pour les valeurs continues lues au taux
  d'affichage : `fps`, `position`, `entityCount`, `steps`, `gameplayMs`/
  `gameplayP95Ms`/`physicsMs`/`renderMs` et les compteurs A* (voir
  [Boucle de jeu — Mesure des temps de frame
  (LoopStats)](boucle-de-jeu.md#mesure-des-temps-de-frame-loopstats)),
  `isGrounded`/`horizontalSpeed`/`verticalSpeed`/`numCollisions`/
  `groundNormal`.
- **Ponctuelle, au setter dédié** (`setPlayerHp`, `incrementSecretsFound`,
  `setSecretsTotal`, `incrementViews`) pour les valeurs qui changent à un
  événement de gameplay précis, jamais à 60 Hz — appeler l'un de ces
  setters par frame consommerait le budget de perf React avant d'avoir
  commencé (skill `react-hud-bridge`).

### Coût de rendu

`drawCalls`/`triangles` reprennent `renderer.info.render` de la dernière
image, dans le même bloc throttlé à 10 Hz. Ils sont justes parce que le jeu
fait **une seule passe WebGL par image** (`main.ts`, rendu direct en
640×360) : three.js remet ce compteur à zéro à chaque appel de `render()`.
Une deuxième passe (post-traitement, viewmodel dans une scène séparée)
ferait afficher le seul coût de la dernière passe — il faudrait alors
passer `renderer.info.autoReset` à `false` et remettre à zéro une fois par
image. Ajoutés pour le niveau v2 (`PLAN_NIVEAU_V2.md`, jalon N1), qui doit
fixer un budget de draw calls avant de densifier le décor.

### Diagnostic du character controller

`isGrounded`/`horizontalSpeed`/`verticalSpeed`/`numCollisions`/
`groundNormal` sont exposés en PERMANENCE dans le panneau de debug — imposé
par le skill `rapier-character-controller`. Un `isGrounded` qui se met à
clignoter sur terrain plat signale une régression de snap-to-ground, pas un
bug de rendu — voir [ADR 0016](../decisions/0016-garde-fous-degenerescence-kcc.md)
pour le cas réel que ce diagnostic a servi à mesurer.

### PV, munitions, arme active

`playerHp`/`playerMaxHp` démarrent à 100/100 : un point de départ ARBITRAIRE
(Phase 3) pour rendre les dégâts observables en playtest, pas un choix de
tuning arrêté — le tuning (PV max, dégâts par attaque, régénération
éventuelle...) appartient à l'humain.

`shotgunAmmo`/`shotgunMaxAmmo` ont été ajoutés après un retour de playtest
de Phase 3 (« au bout d'un moment je ne peux plus tirer avec ») : le pool
fini (`shotgunStartingAmmo`, voir [Armes du joueur — Architecture munitions
: un seul pool](armes.md#architecture-munitions-un-seul-pool))
fonctionnait déjà comme prévu, mais était invisible — rien n'affichait la
valeur, un tir à sec ne se distinguait pas d'un bug.

`activeWeapon` recopie l'union de `WeaponSystem.activeWeapon` À LA MAIN
plutôt que de l'importer — voir [ADR 0020](../decisions/0020-state-feuille-de-dependances.md)
pour la raison (`game/state.ts` n'importe jamais un autre module de
`src/game/*`).

### Secrets et vues

`secretsFound`/`secretsTotal` sont écrits ponctuellement, jamais au pas
fixe (un secret trouvé n'arrive pas à 60 Hz) — voir [Session de partie —
Spawn et chargement de niveau](session.md#spawn-et-chargement-de-niveau)
pour le moment exact où `secretsTotal` est mis à jour, et [Session de
partie — L'état propre à une partie](session.md#létat-propre-à-une-partie-gamesession)
pour le `WeakSet` `foundSecrets` qui empêche un double comptage.

`views` (compteur de « vues » du HUD de stream — voir [HUD et interface —
HUD de production](hud.md#hud-de-production) pour la blague) démarre à 12 :
même caveat que `playerHp`, une valeur ARBITRAIRE (quelques spectateurs en
direct, cohérente avec « 200 abonnés » plutôt qu'un flatteur zéro), pas un
choix de tuning arrêté. Incrémenté PONCTUELLEMENT par `grantKillViews()`
(`game/session/feedback.ts`), appelée une fois par kill (Costard ou
Directeur confondus, gain aléatoire — le gag du « clip qui buzz ») depuis
les boucles `deathEvents` de `game/loop/updateFx.ts`, jamais depuis
`updateGameplay`.

## Origine du module game/devtools

Le 2026-09-05, `exposeDebugApi` (point d'entrée console `window.cassandre`)
et les fonctions de `testHarness.ts` (`simulateRecording`/`checkDeterminism`/
les 7 `applyXVariant`) ont rejoint `src/game/devtools/` lors du refactor qui
a éclaté `main.ts` (2229 lignes) en modules — voir [Session de partie —
Origine des modules game/session](session.md#origine-des-modules-gamesession)
pour le refactor complet.

Les fonctions de `testHarness.ts` vivaient déjà à PORTÉE MODULE dans
`main.ts` (donc, par construction du langage, sans aucune fermeture sur le
scope de `main()`) : déplacées TELLES QUELLES, aucun paramètre ajouté.

`exposeDebugApi`, à l'inverse, prenait déjà SES DÉPENDANCES en paramètres
explicites (portée module dans `main.ts`, aucune fermeture) — ce jalon a
simplifié sa signature à un seul paramètre `engine: GameEngine` (plutôt que
7 callbacks séparés) : `spawnSuitAt`/`spawnDirectorAt`/`loadGltfLevel`/
`debugFindPath`/`startPlayback` sont maintenant des fonctions IMPORTABLES
directement (elles vivaient comme fonctions imbriquées de `main()` avant ce
refactor), ce module n'a donc plus besoin qu'on les lui passe.

## Point d'entrée console (window.cassandre)

`exposeDebugApi(engine)` construit `window.cassandre` — l'A/B de
`feel-tuner` et les preuves de `qa-evidence` passent par cet objet. **En
dev seulement** : il donne des cartes, téléporte, rend les ennemis passifs
(`notarget`), et `main.ts` ne l'appelle pas dans le build de production. Jalon
M8 (`PLAN_EFFECT_XSTATE.md`, §10) : `engine.session` a remplacé les
références directes (`player`/`weapons`/`suitManager`/`directorManager`)
qui existaient avant ce jalon — ce fichier n'a plus qu'UNE SEULE session
possible tant qu'aucun reset n'a eu lieu, mais `window.cassandre` doit
rester correct APRÈS un « Rejouer »/« Retour au menu » (`main()` appelle
`exposeDebugApi` UNE SEULE FOIS, jamais reconstruite à chaque reset).

**Piège à ne pas réintroduire** : `engine.session` est donc lu à chaque
accès, via des getters, JAMAIS mis en cache dans une variable locale de
cette fonction. Mettre en cache `const session = engine.session` au moment
de la construction figerait `window.cassandre` sur la session détruite dès
le premier reset — toutes les propriétés qui exposent une partie de l'état
de partie (`player`, `weapons`, `suits`, `directors`, `directorManager`,
`level`, `cards`/`giveCard`, `doors`, `secrets`, `pathfinding`) suivent
cette même discipline.

### cassandre.lighting() — séparer les deux termes de l'éclairage

Le rendu d'un niveau vaut `texture × couleur de sommet × éclairage temps réel`.
À l'œil, ces deux derniers termes se confondent : « c'est trop plat » peut
vouloir dire que le bake n'arrive pas au matériau, que le bake lui-même est
plat, ou qu'une lumière temps réel écrase tout. Ce sont trois corrections
différentes.

`cassandre.lighting()` les sépare. `lights` liste ce que la scène éclaire
vraiment (nom, type, intensité, couleur, `visible`) ; `batches` mesure, **sur la géométrie
réellement dessinée — donc après la fusion du décor (ADR 0023)** —, si la
couleur cuite est présente (`vertexColors`, `hasColorAttribute`) et quel
contraste elle porte (`min`/`mean`/`max` en luminance Rec. 709, la même
pondération que le rapport de `bake_vertex_lighting.py`).

Lecture : `vertexColors: false` ou `hasColorAttribute: false` → le bake
n'atteint pas le matériau, chercher dans le loader ou la fusion. Un `min`/`max`
resserré → c'est le bake qu'il faut refaire. Les deux corrects mais un rendu
plat → regarder `lights`.

### cassandre.filtrage() / resolution() — juger « ça pixelise »

Deux réglages distincts produisent la même plainte, et il faut les séparer
avant de toucher à quoi que ce soit : la résolution interne fait un gros pixel
UNIFORME (le look), le filtrage de réduction fait grésiller les surfaces
LOINTAINES (un défaut). `cassandre.filtrage("nearest"|"mipmap"|"aniso")`
rebascule toutes les textures chargées sans recharger le niveau, et
`cassandre.resolution(l, h)` change la résolution de rendu — les deux sur la
même vue, en direct, parce qu'un défaut qui ne se voit qu'en mouvement ne se
juge pas sur une capture. Voir [Rendu](rendu.md#filtrage-des-textures).

### cassandre.lightBudget() — le pool de lampes

Un espace qui paraît trop sombre n'a pas forcément un défaut d'éclairage : ses
lampes peuvent simplement être **éteintes par le pool** (48 allumées au plus,
voir [Rendu](rendu.md#le-pool-de-lampes)). C'est le premier réflexe à avoir,
avant de toucher au niveau.

`cassandre.lightBudget()` sans argument RAPPORTE l'état (`total`, `actives`,
`budget`) sans rien changer — un inspecteur qui modifie ce qu'il inspecte
fausserait la mesure suivante. Avec un argument, il change le budget :
`lightBudget(null)` rallume tout (est-ce que ça règle le problème ? alors
c'est le pool), `lightBudget(8)` sert à mesurer ce que coûtent les lampes.
Dans `cassandre.lighting()`, une lampe éteinte par le pool apparaît avec
`visible: false`, sous son nom Blender.

## Simulation hors écran et preuve de déterminisme

`simulateRecording(rec, cfg)` (`testHarness.ts`) rejoue une séquence
enregistrée dans un monde Rapier minimal (un sol, un `PlayerController`),
sans rendu ni horloge réelle — base commune du harnais A/B de feel et de la
preuve de déterminisme ci-dessous. Voir [Boucle de jeu — Enregistrement et
rejeu déterministe](boucle-de-jeu.md#enregistrement-et-rejeu-dinput)
pour ce qui est enregistré et pourquoi (l'input tel que consommé par le pas
fixe, pas les évènements bruts du navigateur).

Son appel à `sim.viewBob(1, ...)` utilise `alpha = 1` (la frame d'affichage
alignée sur le dernier pas fixe) : c'est le décalage de bob
**effectivement rendu**, la grandeur qui finit en pixels. La comparer — pas
seulement ses entrées (position/vitesse) — est ce qui rend la preuve de
déterminisme ci-dessous utile pour `qa-evidence`.

`checkDeterminism(rec)` rejoue deux fois la même séquence et exige un écart
maximal sous 1e-6 sur position, vitesse, distance parcourue, décalage de
bob, FOV et enfoncement de réception. Un échec signale une source de
non-déterminisme dans le pas fixe (`Math.random` non seedé, `Date.now`, ou
une lecture d'input hors accumulateur). L'écart couvre les grandeurs de VUE
en plus de la simulation physique : une horloge murale glissée dans le bob
se verrait immédiatement ici, sous forme d'un écart non nul sur le décalage
de bob malgré des positions identiques — une comparaison limitée à
position/vitesse laisserait passer exactement ce genre de régression.

## Harnais A/B — protocole général

Les 7 `applyXVariant` de `testHarness.ts` partagent le même protocole de
comparaison, au pas fixe près, via `core/inputRecorder.ts` (F9 enregistre,
F10 rejoue — `InputFrame.fire` est un front enregistré comme n'importe quel
autre) : enregistrer une séquence, changer de variante, rejouer EXACTEMENT
la même séquence. Aucun ne rappelle `player.applyConfig()` : ces champs ne
sont lus ni par Rapier ni à la construction du corps, seulement relus à
chaque pas fixe / chaque frame — le rappeler recréerait la capsule pour
rien.

Détail par variante et tables de profils : [Armes du joueur — Harnais
A/B](armes.md#harnais-ab) (recul, impact, hitmarker, réticule), [Joueur —
Harnais A/B — FEEL_VARIANTS](joueur.md#harnais-ab-feel_variants) (bob/FOV/
réception).

Retour à la [carte de la documentation](../README.md).
