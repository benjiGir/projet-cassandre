---
title: État des lieux du code et de l’architecture
tags: [reference, architecture, audit]
status: brouillon
updated: 2026-09-25
---

# État des lieux du code et de l’architecture

## Verdict exécutif

Le projet possède de meilleures fondations que la moyenne d’un prototype : les
invariants du moteur sont explicites, la boucle fixe est lisible, les choix
structurants sont consignés dans des ADR, la couche React a été remise en ordre
et le pipeline Blender → glTF est traité comme un vrai produit logiciel.

Le code n’est cependant pas encore dans un état où la correction de la
simulation peut être tenue pour acquise. Deux défauts présents dans le code
commité touchent directement le pas fixe :

1. les dégâts reçus et la mort du joueur sont résolus au taux d’affichage ;
2. un impact d’arme peut être retraité à chaque pas fixe d’une même image par
   les props, vitres et sanitaires.

Ce sont les symptômes d’un même problème d’architecture : la frontière entre
la **simulation** et la **présentation** utilise des files « de frame » dont le
propriétaire, la durée de vie et le moment de purge ne sont pas assez
explicites. La recommandation principale de cet audit est donc de rendre cette
frontière profonde et stricte, sans event bus générique et sans réécriture : le
pas fixe décide et modifie tout l’état de jeu ; le taux d’affichage ne consomme
que des faits de présentation déjà résolus.

Le second risque majeur est le cycle de vie asynchrone des niveaux. Un
chargement glTF en vol peut survivre à la session qui l’a lancé, tandis que les
chemins « Rejouer » et « Retour au menu » n’attendent pas que le nouveau niveau
soit prêt. Ici aussi, le remède est ciblé : rendre le chargement transactionnel,
annulable logiquement et commun aux trois chemins de démarrage.

Il ne faut pas réécrire le moteur, remplacer Rapier, ajouter un ECS ou découper
les gros fichiers sur le seul critère du nombre de lignes. Il faut d’abord
restaurer des gates fiables, corriger les deux erreurs de simulation, puis
resserrer les interfaces aux frontières qui concentrent le risque.

## Périmètre et limites de l’audit

Audit réalisé le 24 septembre 2026 sur `main`, HEAD `2f18fc1`, et sur le
worktree courant. Celui-ci contenait un chantier non commité important autour
des sanitaires, de l’audio et du niveau : 50 fichiers suivis modifiés et 48
entrées non suivies au début de l’audit.

Cette distinction est importante : les erreurs TypeScript et les neuf tests
sanitaires en échec décrivent l’instantané de travail. En revanche, les deux
défauts de pas fixe, le cycle de vie du hot reload, la configuration Vitest et
la CI ont été vérifiés comme des problèmes structurels, indépendants de ce
chantier.

L’audit a porté sur :

- `src/core`, `src/physics`, `src/game`, `src/render` et `src/ui` ;
- les tests TypeScript et leur configuration ;
- le workflow de déploiement ;
- les contrats de documentation et les outils de validation ;
- le contenu livré depuis `public/`.

Il s’agit d’un audit statique complété par les commandes de validation. Aucun
playtest, profilage GPU ou mesure audio perceptive n’a été réalisé.

## Tableau de situation

| Domaine | État | Conclusion |
|---|---|---|
| Fondations moteur | Solide sous réserves | Boucle fixe, Rapier, rendu rétro et frontières Effect sont intentionnels et documentés. |
| Correction de la simulation | Critique | Deux chemins rendent le résultat dépendant du regroupement des pas fixes par image. |
| Cycle de vie niveau/session | Fragile | Chargements tardifs, activation prématurée et états persistants non réinitialisés. |
| Architecture applicative | À approfondir | `GameEngine` et `GameSession` ont une bonne intention d’ownership, mais exposent trop de capacités aux phases. |
| UI React | Saine | Structure, composition, CSS Modules et sélecteurs zustand sont propres ; navigation et couverture DOM restent faibles. |
| Tests et CI | Insuffisant | La commande standard découvre des worktrees et la CI déploie sans lancer les tests. |
| Documentation | Riche mais en dérive | Très bonne base d’ADR ; commentaires historiques trop nombreux et checker non fiable comme gate. |
| Pipeline de niveau | Mature | Conventions, validation et ownership des ressources sont solides ; le swap de niveau n’est pas transactionnel. |
| Livraison des assets | À corriger | Des artefacts d’audition et un WAV intermédiaire peuvent partir en production. |

## Forces à conserver

### Fondations déterministes et rendu

- La boucle met clairement en œuvre le pas fixe 1/60, le clamp à 0,25 s,
  l’ordre gameplay → physique et l’interpolation
  ([`loop.ts`](../../src/core/loop.ts), lignes 56-91).
- La rotation caméra n’est pas interpolée ; le KCC et la gravité sont bien
  centralisés autour de Rapier.
- Le RNG de simulation est centralisé et les armes comme les ennemis disposent
  de flux dédiés ([`random.ts`](../../src/core/random.ts),
  [`weapons.ts`](../../src/game/player/weapons.ts)).
- La machine d’état ennemie partage le comportement Costard/Directeur sans
  timers muraux. Cette mutualisation respecte la règle « pas d’ECS » et offre
  déjà un bon levier.
- `runGameplaySync` rend bruyante toute suspension accidentelle dans le pas
  fixe ou le rendu ([`runtime.ts`](../../src/core/runtime.ts)). C’est un bon
  garde-fou architectural.

### Ownership et pipeline

- La séparation `PersistentEngine` / `GameSession` exprime une vraie décision
  de cycle de vie, consignée dans l’ADR 0014. Elle doit être approfondie, pas
  supprimée.
- Le loader centralise la traduction des conventions Blender, les transforms
  monde, les matériaux Lambert et la libération des ressources. Avec 1 791
  lignes, il est volumineux mais reste un **module profond** : son interface
  cache une complexité réelle. Le scinder uniquement pour réduire sa taille
  diminuerait probablement la localité.
- Le décor statique fusionné, les portes batchées et les budgets de lots sont
  conçus et mesurés, pas seulement commentés.
- `Effect.acquireRelease` et les scopes explicites donnent une base saine à la
  gestion GPU/Rapier du niveau ([`loader.ts`](../../src/game/level/loader.ts)).

### UI et documentation

- `src/ui` respecte largement les conventions récentes : un dossier par
  composant, aucun barrel, CSS Modules co-localisés, composants courts et pas
  de style de présentation inline.
- Le HUD ne centralise pas toutes ses lectures : chaque widget sélectionne ses
  propres données, et la télémétrie est publiée au plus à 10 Hz.
- TypeScript est strict, `noUnused*` est actif, et aucun `any` ou contournement
  `@ts-*` n’a été relevé dans `src` et `test`.
- Les ADR et les documents système rendent les décisions vérifiables. Plusieurs
  faux positifs courants ont ainsi été écartés : l’ordre gameplay → physique,
  les groupes de collision des props et la séparation
  `PersistentEngine` / `GameSession` sont voulus.

## Constats prioritaires

### P0 — dégâts et mort du joueur hors du pas fixe

Les managers ennemis produisent les impacts joueur pendant `updateGameplay`
([`updateGameplay.ts`](../../src/game/loop/updateGameplay.ts), lignes 322-340),
mais les PV, les écritures zustand et la transition `DIED` sont appliqués dans
`updateFx` ([`updateFx.ts`](../../src/game/loop/updateFx.ts), lignes 285-300 et
346-355).

Or une image exécute d’abord zéro à quinze pas fixes, puis une seule fois
`updateFx` ([`loop.ts`](../../src/core/loop.ts), lignes 69-86). À 30 Hz ou après
un rattrapage, le joueur peut donc encore bouger, tirer, ramasser un soin ou
recevoir d’autres attaques pendant plusieurs pas après un coup fatal. Le pas de
mort dépend du framerate.

**Recommandation ferme.** Appliquer les dégâts, les PV, les seuils de vie et la
transition de mort dans `updateGameplay`, immédiatement après les managers.
Émettre ensuite un fait de présentation immuable pour le son, le shake, les
particules et le HUD. `updateFx` ne doit plus décider de l’état de la partie.

**Preuve attendue.** Un même scénario d’attaque, exécuté avec un regroupement de
1, 2 puis 15 pas fixes avant le rendu, produit le même pas de mort et le même
total de PV.

### P0 — impacts retraités plusieurs fois pendant la même image

`WeaponSystem.hitEvents` conserve tous les impacts jusqu’à la fin de l’image
d’affichage ([`weapons.ts`](../../src/game/player/weapons.ts), lignes 233-253).
À chaque pas fixe, `PropSystem`, `VitreSystem` et `SanitaireSystem` reparcourent
pourtant la file entière depuis le début
([`updateGameplay.ts`](../../src/game/loop/updateGameplay.ts), lignes 341-353).

Un tir peut donc infliger deux fois ses dégâts à 30 Hz et jusqu’à quinze fois
après le clamp maximal. Les managers ennemis possèdent déjà la bonne
implémentation : un curseur d’impact propre au consommateur, réinitialisé lors
de la purge de frame.

**Recommandation ferme.** À court terme, donner un curseur à chaque consommateur
ou ne lui transmettre que la tranche produite pendant le pas courant. À moyen
terme, supprimer l’ambiguïté « événement de tick / événement de frame » par la
frontière proposée plus bas.

**Preuve attendue.** Un impact unique, suivi de deux pas fixes avant la purge de
présentation, retire exactement une fois les PV de chaque type de cassable.

### P1 — la visée de simulation retarde d’une image sur la caméra

Les pas fixes s’exécutent avant `interpolateVisuals`. Le delta souris est
consommé dans cette dernière phase, alors que déplacement et tir ont déjà lu le
yaw précédent. Un flick et un clic arrivés dans la même RAF peuvent donc tirer
selon l’ancienne visée, puis afficher la nouvelle orientation.

**Recommandation ferme.** Ajouter une phase d’entrée au taux d’affichage juste
après `input.beginFrame()` et avant la boucle des pas fixes. Elle applique la
rotation brute une fois par RAF. La phase d’interpolation ne fait ensuite que
recopier cette orientation. Cette solution conserve l’invariant « rotation
caméra non interpolée » tout en retirant une image de latence au tir.

### P1 — chargement de niveau non borné par la vie de sa session

`createLevelSession` lance immédiatement un chargement asynchrone. `stop()`
dispose le handle courant et le polling, mais n’invalide pas
`reloadInFlight` ([`hotReload.ts`](../../src/game/level/hotReload.ts), lignes
90-127 et 173-189). Le teardown libère ensuite le monde Rapier
([`lifecycle.ts`](../../src/game/session/lifecycle.ts), lignes 205-235).

Un chargement tardif peut ainsi rappeler `onLoaded`, rattacher un niveau à la
scène et construire un graphe ou des systèmes contre une session déjà détruite.
Le test existant couvre `stop()` après résolution, pas l’arrêt pendant une
promesse en vol.

Le swap n’est pas non plus transactionnel : le handle précédent est disposé
avant que le callback de construction des systèmes dérivés ait fini. Une erreur
à mi-chemin peut laisser une session partiellement initialisée sans restaurer
le niveau précédent.

**Recommandation ferme.** Introduire un état `stopped` et un token de génération
capturé par chaque chargement. Un résultat obsolète est disposé immédiatement,
sans callback. Construire le handle et ses systèmes dérivés dans une transaction
temporaire, puis effectuer un seul commit. En cas d’échec, disposer le candidat
et conserver l’ancien état.

**Preuves attendues.** Tests avec promesse différée pour « stop avant
résolution », « deux reloads concurrents » et « construction dérivée qui lève ».

**Résolu à l’étape 2 (25 septembre 2026).** `LevelSession.stop()` est
asynchrone et attend le chargement en vol. Un résultat tardif est disposé sans
être publié. Le nouveau niveau est préparé localement ; l’ancien est suspendu
en conservant l’état individuel de ses corps, puis restauré si la préparation
échoue. Le commit seul publie graphe, portes, vitres, sanitaires, lampes et
props. Les trois scénarios ci-dessus sont couverts, ainsi que le retry après un
premier échec.

### P1 — les chemins de redémarrage activent une session trop tôt

Le premier boot attend `firstLoadSettled` avant de démarrer la boucle
([`main.ts`](../../src/main.ts), lignes 125-143). `replay()` et
`returnToMenu()` reconstruisent en revanche la session puis envoient
immédiatement `REPLAY` ou `PLAY`
([`lifecycle.ts`](../../src/game/session/lifecycle.ts), lignes 245-275). Le
joueur passe alors en état `playing` à la position transitoire pendant le
chargement du glTF.

**Recommandation ferme.** Factoriser un seul use case applicatif
`create → await first load → activate`, utilisé au démarrage, au replay et au
changement de niveau. Distinguer un premier chargement fatal d’un hot reload
échoué pour lequel l’ancien niveau peut rester jouable.

**Résolu à l’étape 2 (25 septembre 2026).** `waitForGameSessionReady` est la
frontière d’activation commune au boot, au replay et au retour du menu. La
machine passe par `loading`; elle n’accepte `PLAY` qu’après un commit réussi.
Un premier échec mène à `loadFailed` avec une action « Réessayer ». Un échec de
hot reload conserve au contraire le niveau courant.

### P1 — états de session conservés par erreur

`GameClock` vit dans le moteur persistant alors que `hitstopRemaining` est un
état transitoire. Hors de l’état `playing`, `updateGameplay` retourne avant
`clock.tick()`. Un hitstop actif au moment de la mort peut donc rester gelé sur
l’écran de mort puis ralentir les premiers pas du replay
([`time.ts`](../../src/core/time.ts),
[`gameEngine.ts`](../../src/game/session/gameEngine.ts)).

De même, `FxSystem` survit aux parties et le teardown ne nettoie que les jets
d’eau. Des decals, particules, flashes ou un shake peuvent traverser une
frontière de session.

**Recommandation ferme.** Placer l’horloge dans `GameSession`, ou lui donner un
`reset()` appelé par le même use case de boot. Ajouter `FxSystem.resetSession()`
avec un contrat explicite pour les pools persistants et leur contenu
transitoire.

**Résolu à l’étape 2 (25 septembre 2026).** `GameClock.reset()` neutralise
temps écoulé et hitstop. `FxSystem.resetSession()` efface shake, flashes,
decals, particules, douilles, gibs, débris, givre, céramique et jets d’eau sans
recréer les pools. `bootGameSession` appelle les deux avant toute construction.

### P1 — le graphe de navigation promet plus que le KCC ne franchit

Le bake accepte actuellement un écart vertical de 1 m, tandis que les
contrôleurs Costard et Directeur ne franchissent que 0,35 m. Les arêtes testent
un rayon ponctuel à hauteur d’œil, pas le balayage de la capsule. Le pathfinder
peut donc proposer une marche ou un coin que l’agent physique ne passera pas
([`pathfinding.ts`](../../src/game/level/pathfinding.ts),
[`suitConfig.ts`](../../src/game/entities/suitConfig.ts),
[`directorConfig.ts`](../../src/game/entities/directorConfig.ts)).

**Recommandation ferme.** Dériver la limite du même paramètre de déplacement,
valider le passage avec la forme réelle et refuser une diagonale si les deux
cellules orthogonales ne sont pas praticables. Ajouter des tests à 0,35 m,
0,36 m, 1 m et dans un coin étroit.

**Traité à l’étape 3 (25 septembre 2026), sous réserve de playtest.** Le seuil
de marche et l’angle de pente viennent désormais du KCC Costard. Les arêtes
plates balaient sa capsule Rapier, les diagonales exigent les deux passages
orthogonaux, et la fixture de rebord de 0,8 m est refusée sans fermer la rampe
à 45°. Le balayage horizontal sur pente produisait un faux contact avec le
sol montant : ces arêtes restent contrôlées par normale et dénivelé, pas par
une simulation complète du KCC. Les seuils voisins de 0,35 m et les rampes
du vrai niveau restent à éprouver en jeu.

### P1 — les gates de livraison ne protègent pas `main`

La configuration Vitest ne déclare ni `include` ni exclusions
([`vitest.config.ts`](../../vitest.config.ts)). La commande standard découvre
donc des tests sous `.claude/worktrees/**` et devient dépendante de l’état local
de la machine.

Le workflow GitHub Pages n’exécute que l’installation et le build, uniquement
après un push sur `main` ([`deploy.yml`](../../.github/workflows/deploy.yml),
lignes 18-37). Il ne lance pas les tests et ne protège pas les pull requests.

**Recommandation ferme.** Borner Vitest à `test/**/*.test.ts`, exclure les
worktrees et caches, puis introduire un job `quality` sur pull request et push :
typecheck, tests, validateurs fiables, build. Le déploiement dépend de ce job.
Une seule commande locale `pnpm check` doit reproduire le gate.

## Architecture : approfondir les bons seams

### 1. Un commit de simulation et une sortie de présentation

C’est la recommandation au plus fort **levier**. Aujourd’hui, l’interface entre
le pas fixe et `updateFx` expose des tableaux mutables dont la sémantique
temporelle varie selon le consommateur. Cette interface est peu profonde : ses
appelants doivent connaître le moment du clear, le nombre de pas exécutés et la
présence éventuelle d’un curseur.

La cible n’est pas un bus global. La cible est une frontière locale :

- chaque pas fixe consomme ses événements de tick exactement une fois ;
- toutes les mutations de gameplay sont commitées avant `physics.step` ;
- le pas produit des faits de présentation immuables ;
- le taux d’affichage consomme ces faits pour Three.js, Howler et zustand ;
- un seul propriétaire purge la sortie après tous les adapters de
  présentation.

Cette séparation donne une interface plus profonde : elle cache l’ordonnancement
au lieu de le faire connaître à tous les modules. Elle règle les deux P0, rend
les tests de déterminisme locaux et retire à `updateFx` la responsabilité de la
vie, de la mort et des règles de score.

### 2. Conserver `GameEngine` / `GameSession`, réduire les capacités exposées

Les deux interfaces sont devenues de grands sacs mutables : renderer, React,
input, debug, systèmes de niveau, inventaire, RNG et état de partie circulent
ensemble dans les phases de boucle. La séparation persistante/session reste
bonne, mais sa **localité** est amoindrie par le nombre de responsabilités
accessibles depuis chaque fonction.

Après les corrections de simulation, fournir aux phases des vues étroites :
capacités de simulation au pas fixe, capacités de rendu à l’interpolation,
capacités de présentation à `updateFx`. Il n’est pas nécessaire de créer une
interface TypeScript par champ : le critère est qu’une phase ne puisse plus
modifier par accident un état qu’elle ne possède pas.

### 3. Extraire une couche application/shell au-dessus du jeu

`game/session` possède aujourd’hui un `React.Root`, importe l’acteur de flux UI
et monte directement des composants dans `bootChoice.ts` et `lifecycle.ts`.
L’implémentation du domaine dépend donc de son adapter React, ce qui rend le
cycle de vie difficile à tester sans DOM.

Une petite couche `src/app/` ou `src/shell/` devrait posséder :

- la racine React ;
- l’acteur XState de navigation ;
- les use cases démarrage, replay et retour menu ;
- la traduction des événements de session en écrans.

`game/session` expose alors des opérations de création, activation et teardown,
sans rendre de composant. Ce seam est déjà réel — il existe deux adapters, le
jeu et React — mais il est orienté dans le mauvais sens.

### 4. Ne pas multiplier les adapters Effect sans profondeur

`RaycastService` reproduit encore largement les arguments Rapier, et
`RenderService` reçoit directement renderer, scène et caméra. Ces wrappers
offrent peu de profondeur aujourd’hui. Ils viennent toutefois d’un plan
d’architecture explicite et ne justifient pas une suppression immédiate.

Appliquer le test de suppression lors d’une prochaine évolution : si retirer un
adapter simplifie l’appelant sans dupliquer de politique, son seam est
hypothétique. S’il doit rester, le rendre plus profond avec des opérations de
domaine comme « première collision monde », « ligne de vue » ou « rendre la
frame », plutôt qu’un miroir de l’API externe.

### 5. Ne pas abstraire prématurément les cassables

`vitres.ts` et `sanitaires.ts` partagent des mécanismes de batching, casse et
événements. Le chantier sanitaire est encore mobile et les différences de
visée, eau et culling sont significatives. Attendre un troisième consommateur
ou une dérive mesurée avant d’extraire un module commun. Deux implémentations ne
suffisent pas encore à prouver une bonne interface.

## Déterminisme : aligner les promesses, le code et les ADR

### Le rejeu F9/F10 n’est pas une preuve globale

Un enregistrement ne capture que position, vitesse, yaw, pitch et inputs
([`inputRecorder.ts`](../../src/core/inputRecorder.ts), lignes 38-51). Le rejeu
ne restaure ni RNG d’arme ou d’ennemi, ni munitions, cooldowns, portes, props,
états d’entités ou horloge
([`recording.ts`](../../src/game/session/recording.ts), lignes 23-29).

Deux options sont honnêtes :

1. renommer le mécanisme « rejeu d’input pour le tuning du déplacement » et
   limiter sa promesse ;
2. repartir d’une `GameSession` fraîche, versionner le snapshot initial et
   comparer un hash d’état à chaque pas fixe.

La seconde option est nécessaire avant d’utiliser F9/F10 comme preuve de
déterminisme global.

**Décidé à l’étape 3.** F9/F10 garde le contrat restreint de harnais d’input
pour le tuning du déplacement. Les promesses plus larges ont été retirées des
documents ; voir [ADR 0033](../decisions/0033-rng-presentation-et-portee-du-rejeu.md).

### `Math.random()` est une contradiction de gouvernance

Le texte de l’invariant 12 interdit tout `Math.random()`, tandis que des ADR
plus récents l’autorisent pour certains FX cosmétiques. Le code l’utilise dans
le rendu, l’audio et le gain de vues
([`fx.ts`](../../src/render/fx.ts), [`audio.ts`](../../src/core/audio.ts),
[`feedback.ts`](../../src/game/session/feedback.ts)).

Le problème n’est pas uniquement technique : les règles écrites se
contredisent. Décider une seule politique et la consigner. La solution la plus
cohérente avec les captures déterministes est un flux RNG de présentation,
seedé par session et séparé du RNG gameplay. Au minimum, le gain de vues doit
quitter `Math.random()` puisqu’il modifie un état utilisateur observable.

**Résolu à l’étape 3.** Les vues sont décidées au pas fixe avec un RNG propre
à la session. FX et audio ont deux flux cosmétiques seedés et réinitialisés au
boot, indépendants des flux gameplay. Aucun appel exécutable à `Math.random()`
ne reste dans `src/`.

## UI React : bonne base, application incomplète

La qualité des composants n’est pas le point faible actuel. Les priorités sont
plutôt :

- choisir une seule vérité de navigation : la machine XState déclare
  `options` et `levelSelect`, mais le runtime monte encore ces écrans
  impérativement ;
- ajouter quelques tests DOM ciblés sur navigation, callbacks, remapping,
  écrans mort/fin et progression de chargement ;
- modéliser un échec de chargement avec message et action de reprise ;
- compléter l’accessibilité des écrans, onglets, barres de progression,
  annonces HUD et `prefers-reduced-motion` ;
- sortir PV, munitions, cartes, secrets et audience du sous-état nommé
  `debug`, puisqu’il alimente le HUD de production.

Il faut éviter les snapshots DOM massifs. Quelques tests de comportement à
fort levier protégeront mieux la couche que la recherche d’un pourcentage de
couverture.

## Dette documentaire et commentaires

L’outil du dépôt mesure 11 975 lignes de code pour 7 997 lignes de
commentaires, soit 40 %, avec 260 blocs longs et 25 bannières. Le seuil de la
politique interne est 20 %. Une part importante des commentaires raconte des
jalons, dates, incidents de playtest ou anciennes implémentations déjà décrits
dans les ADR et documents système.

Ne pas supprimer en masse. Appliquer le protocole de migration module par
module : garder dans le code les contrats, invariants, unités, raisons
non évidentes et ancres `see:` ; déplacer l’histoire et les explications
longues vers `docs/`. Commencer par les fichiers les plus modifiés
(`updateFx.ts`, `doors.ts`, `fx.ts`) afin de réduire le risque de dérive.

Le checker documentaire échoue actuellement avec six erreurs et six warnings,
mais certains sont des faux positifs sur les liens hors de `docs/`. Il faut
d’abord tester l’outil sur des fixtures et lui apprendre les racines externes
autorisées, puis seulement en faire un gate CI.

## Assets et contenu de production

Vite copie tout `public/` dans `dist` :

- `public/audition/`, pourtant ignoré par Git, peut livrer environ 1,5 Mo de
  pages et fichiers de studio ;
- `public/assets/audio/sfx/sfx.wav`, environ 2,4 Mo, est suivi et livré alors
  que seuls OGG, M4A et JSON sont destinés au runtime ;
- le motif `.gitignore` vise `public/audio/**/*.wav`, pas le chemin réel
  ([`.gitignore`](../../.gitignore), lignes 26-29).

Sortir l’audition de `public/` ou la servir par un outil de développement,
corriger le motif et retirer le WAV de la livraison. Ajouter un petit contrôle
de contenu de `dist` évitera le retour de ces fichiers.

## État des validations au moment de l’audit

| Commande | Résultat | Lecture |
|---|---|---|
| `pnpm exec tsc --noEmit` | Échec, 15 erreurs | Tests sanitaires encore alignés sur l’ancienne API ; chantier courant. |
| Suite Vitest bornée au vrai `test/` | 343 réussis, 9 échoués sur 352 | Les neuf échecs sont sanitaires. |
| `pnpm test` | 548 réussis, 9 échoués ; six suites parasites | Découverte de `.claude/worktrees/**` par défaut. |
| `python3 tools/docs/audit_comments.py src/` | Échec du seuil | 40 % de commentaires, 260 blocs longs, 25 bannières. |
| `python3 tools/docs/check_docs_links.py docs --src src` | 6 erreurs, 6 warnings | Mélange de vraies dérives et de faux positifs hors racine. |
| `pnpm build` | Non relancé | Le typecheck échoue déjà ; un build complet n’aurait pas ajouté de preuve. |

## Plan de remédiation ordonné

### Suivi d'exécution

| Étape | État | Preuve au 25 septembre 2026 |
|---|---|---|
| 0 — signal | Terminée | Vitest borné au vrai dossier de tests, commande `pnpm check`, gate CI avant déploiement. |
| 1 — simulation | Terminée | Dégâts et mort dans le pas fixe, curseurs sur les cinq lecteurs d'impacts, visée capturée avant simulation, tests 0/1/N et regroupements 1/2/15. |
| 2 — cycle de vie | Terminée | Chargement transactionnel, arrêt en vol attendu, boot/replay unifiés, retry visible, horloge et FX remis à zéro. |
| 3 — architecture | Terminée | Shell `src/app/`, port de flux sans React/XState dans `game/`, `updateFx` limité à des capacités de présentation, RNG isolés, graphe aligné sur le KCC. |
| 4 — livraison | Non commencée | — |

La gate applicative de l'étape 3 est verte : typecheck, 432 tests et build de
production. `game/session/lifecycle.ts` n’importe plus React et son teardown
se teste sans monter d’interface ; les menus et l’orchestration de replay
vivent dans `src/app/`. `updateFx` reçoit une vue TypeScript restreinte : il
ne voit plus les drapeaux de kill ou de seuil de vie, et les commandes de dev
qui modifient le jeu sont consommées au pas fixe. La purge des files
d’événements reste une mutation de **présentation**, pas de simulation. Le
checker documentaire reste informatif jusqu’à l’étape 4.

### Étape 0 — rétablir la confiance dans le signal

1. Finir l’alignement de l’API sanitaires et de ses tests.
2. Borner Vitest au dossier `test/` et exclure les worktrees.
3. Ajouter `pnpm check` puis un job CI de qualité sur pull request et push.
4. Garder les validateurs documentaires en mode informatif jusqu’à correction
   de leurs faux positifs.

**Gate de sortie :** typecheck, tests et build verts depuis un checkout propre.

### Étape 1 — restaurer les invariants de simulation

1. Résoudre dégâts, PV et mort dans le pas fixe.
2. Garantir la consommation unique des impacts par pas.
3. Introduire la phase d’entrée d’affichage avant les pas fixes.
4. Ajouter les tests 0/1/N pas fixes et les comparaisons de regroupement.

**Gate de sortie :** les résultats gameplay sont identiques pour 1, 2 ou 15
pas fixes avant une présentation.

### Étape 2 — rendre le cycle de vie transactionnel

1. Invalider et disposer les chargements tardifs.
2. Préparer puis committer atomiquement un nouveau niveau.
3. Unifier boot, replay et changement de niveau avec attente explicite.
4. Réinitialiser horloge et FX de session.
5. Présenter un état d’échec récupérable au joueur.

**Gate de sortie :** tests d’arrêt en vol, d’échec de construction, de replay
et de non-fuite entre deux sessions.

### Étape 3 — approfondir l’architecture sans big bang

1. Extraire la couche application/shell propriétaire de React et XState.
2. Donner aux phases de boucle des capacités étroites.
3. Décider le vrai contrat du rejeu et du RNG de présentation.
4. Aligner le pathfinding sur les capacités physiques réelles.

**Gate de sortie :** le cycle de vie d’une session est testable sans monter
React, et `updateFx` ne peut plus modifier l’état de gameplay.

### Étape 4 — durcir la livraison

1. Ajouter les tests DOM ciblés et les corrections d’accessibilité.
2. Sortir les artefacts de studio du build.
3. Corriger puis activer les outils documentaires en CI.
4. Migrer progressivement les commentaires historiques vers `docs/`.
5. Instrumenter les requêtes A* et le p95 de `gameplayMs` avant toute
   optimisation de buffers ou planification des recherches.

## Ce qu’il ne faut pas faire

- Ne pas introduire d’ECS : le nombre de types d’ennemis ne le justifie pas.
- Ne pas remplacer le KCC Rapier par une collision maison.
- Ne pas déplacer de gameplay hors du pas fixe pour simplifier le rendu.
- Ne pas interpoler la rotation caméra.
- Ne pas scinder `loader.ts` uniquement à cause de sa longueur.
- Ne pas réécrire Effect/XState avant d’avoir corrigé les contrats concrets.
- Ne pas extraire une abstraction commune vitres/sanitaires pendant que la
  seconde implémentation est encore en mouvement.
- Ne pas lancer une migration massive des commentaires dans le même lot que
  les corrections de simulation.

## Conclusion

Le projet n’est pas désorganisé ; il est arrivé au moment où ses abstractions
doivent devenir plus strictes que ses commentaires. La meilleure décision est
de concentrer l’effort sur trois seams à fort levier :

1. commit de simulation → faits de présentation ;
2. chargement de niveau → activation transactionnelle de session ;
3. domaine jeu → shell React/XState.

Une fois ces frontières corrigées et couvertes par des tests d’ordonnancement,
la base actuelle peut soutenir la suite du prototype sans refonte générale.
