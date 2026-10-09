# Audit de qualité du code — `src/`

> **Date** : 2026-10-08 · **Branche** : `codex/metro-trains-t1` · **Dernier commit** : `d654ecc` (« feat(metro): add prototypes, asset kit and train pilot »)
> **État du worktree au moment de l'audit** : 206 entrées `git status` (dont 45 fichiers de `src/` modifiés et 10 entrées non suivies).
> **Nature** : lecture seule. Aucun fichier de `src/` n'a été modifié. Seul fichier créé dans le dépôt : ce rapport. Les scripts de mesure sont dans le scratchpad de la session (hors dépôt).

Légende : 🟢 solide · 🟠 à surveiller · 🔴 dégradé / à traiter.
Taille des efforts : **S** < ½ jour · **M** 1–2 jours · **L** 3 jours ou plus.

---

## 0. Verdict en trente secondes

**La peur est fondée, mais la dégradation est localisée.** Le socle est bon : typage strict sans `any`, frontières validées par schéma, conventions React respectées à la lettre, invariants du moteur tenus, liens de documentation tous valides. La qualité chute à quatre endroits précis, tous mesurables :

1. **Le chantier métro / campagne** (≈ 1 800 lignes ajoutées le 2026-10-06 + le worktree en cours) est écrit dans un style différent du reste du dépôt (lignes à plusieurs instructions, `.35` sans zéro, nombres magiques, physique créée depuis `render/`), **sans aucun test**, et il **fuit dans le code générique** (boucle de jeu, `GameSession`, loader, cycle de vie).
2. **Deux fonctions « dieu » dans la boucle de jeu** : `updateGameplay` (≈ 494 lignes, complexité ≈ 118) et `updateFx` (≈ 345 lignes, complexité ≈ 73).
3. **Du copier-coller structurel** : Costard ↔ Directeur (71–81 % de lignes identiques après normalisation des noms), quatre fonctions de fusion de décor quasi identiques, deux gestionnaires d'ambiance d'eau jumeaux.
4. **Rien n'impose mécaniquement la qualité** : ni linter, ni formateur, ni règle d'architecture. Tout repose sur la discipline et sur des documents — d'où la dérive dès qu'un lot est écrit vite. Et **la suite de tests est rouge** (5 échecs sur 784) dans l'état actuel du worktree.

### Chiffres clés

| Mesure | Valeur | Lecture |
|---|---|---|
| Fichiers TS/TSX dans `src/` | 332 | |
| Lignes (brutes) | ≈ 30 400 (≈ 21 600 de code, ≈ 5 600 de commentaires selon `tools/docs/audit_comments.py`) | |
| Répartition | `game` 64 % · `render` 15 % · `ui` 11 % (+ 2 000 lignes de CSS) · `core` 5 % · `app` 1,5 % · `physics` 1 % | |
| `pnpm typecheck` | ✅ passe (`tsc --noEmit`, strict) | 🟢 |
| `pnpm test` | ❌ **779 / 784 passent, 5 échecs dans 4 fichiers** | 🔴 |
| `check_docs_links.py --strict` | ✅ 0 erreur, 341 ancres `// see:` valides | 🟢 |
| `any`, `@ts-ignore`, `eslint-disable` | **0** | 🟢 |
| Barrels `index.ts` | **0** | 🟢 |
| `Math.random` | **0** (seul `DeterministicRandom`) | 🟢 |
| `console.log` | **0** (62 `warn`/`error` préfixés) | 🟢 |
| Cycles d'imports **de valeur** | **0** | 🟢 |
| Cycles d'imports **de types** | 2 (10 + 5 fichiers) | 🟠 |
| Exports jamais utilisés ailleurs dans `src/` | 200 / 1 123 (9 morts, 51 utilisés par les tests seulement, 140 « export superflu ») | 🟠 |
| Fonctions > 100 lignes / > 150 lignes (heuristique) | 13 / 8 | 🔴 |
| Lignes > 120 caractères / > 160 | 420 / 63 | 🟠 |
| Lignes à ≥ 2 instructions | 135 (dont ≥ 53 dans le code métro) | 🟠 |
| Assertions `!` / casts `as` (hors `as const`) | 177 / 194 | 🟠 |
| Champs de `GameSession` / `GameEngine` | **63** / 32 | 🔴 |
| Linter / formateur / règles de couches | **aucun** | 🔴 |
| Tests couvrant trains, voyage en rame, blockout, campagne | **0** | 🔴 |

### Les dix actions qui rapportent le plus (détail en §8)

| # | Action | Effort | Gain |
|---|---|---|---|
| 1 | Remettre la suite de tests au vert (5 échecs) | S | CI de nouveau fiable |
| 2 | Ajouter formateur + linter + règles de couches en CI | M | Stoppe la dérive de style et d'architecture |
| 3 | Écrire les tests du code métro (contact mortel, ordonnanceur, voyage, sauvegarde de campagne) **avant** tout nouveau lot métro | M | Filet de sécurité sur le code le plus risqué |
| 4 | Sortir gyms de test, trains et blockout de `GameSession` / de la boucle / du loader (point d'extension par niveau) | L | Arrête la fuite du prototype dans le cœur |
| 5 | Découper `updateGameplay` et `updateFx` en systèmes nommés | M–L | Lisibilité, testabilité, revue de diff |
| 6 | Dédupliquer Costard ↔ Directeur (entité + gestionnaire + événements) | L | −300 lignes, un seul endroit à corriger |
| 7 | Une seule fonction générique de fusion de décor (×4 → ×1) | M | −250 lignes |
| 8 | Une seule source de vérité pour la gravité, les graines RNG, les timeouts | S | Invariant #7 tenu partout |
| 9 | Décider et écrire la convention de langue des identifiants (FR/EN) | S | Harmonisation |
| 10 | Corriger les écarts React restants (4 points, §6) et supprimer le code mort (§4.9) | S | Conformité 100 % aux règles du projet |

---

## 1. Méthode et limites

**Ce qui a été fait**

- Lecture directe du code (profondeur par dossier dans le tableau ci-dessous).
- Mesures automatisées par scripts jetables : graphe d'imports (couches, cycles, fan-in/fan-out, exports morts), métriques de style par fichier, longueur de fonctions par comptage d'accolades, rapprochement des tests par import direct.
- Outils du dépôt : `pnpm typecheck`, `pnpm test`, `tools/docs/audit_comments.py`, `tools/docs/check_docs_links.py`.
- Comparaison avec les règles écrites du projet : invariants de `CLAUDE.md`, `docs/6-reference/react-*.md`.

**Limites à garder en tête**

- Les longueurs de fonctions et les complexités sont **heuristiques** (comptage d'accolades / mots-clés), précises à quelques pour cent. Elles servent à classer, pas à chiffrer au centime.
- La couverture est estimée par **import direct** d'un fichier de test, pas par un vrai outil de couverture (non installé).
- Les points de **performance** (allocations par frame, coût de `runSync`) sont signalés comme *à mesurer* ; je n'ai pas profilé le jeu.
- Je n'ai ni lancé le jeu, ni jugé le rendu, le son ou la sensation (invariant #10 non audité).
- Les 332 fichiers n'ont pas été lus en entier ; le tableau suivant dit ce qui l'a été.

| Zone | Profondeur de lecture |
|---|---|
| `main.ts`, `app/`, `core/`, `physics/` | Lecture intégrale |
| `render/pipeline`, `render/sprites` | Lecture intégrale |
| `render/fx`, `render/environment` | Partielle (`toyDebris`, `trainPresentation`) + métriques |
| `render/pickups`, `viewmodel`, `overlays`, `debug`, `materials` | Survol (métriques + graphe) |
| `game/loop` | `updateGameplay` intégral, `updateFx` ≈ 60 %, `interpolateVisuals` partiel |
| `game/session` | `gameSession`, `gameEngine`, `lifecycle` (build + teardown), `campaignStorage` ; le reste en survol |
| `game/entities` | Fichiers `shared/` petits, `suitManager` (début), comparaison Costard/Directeur par diff normalisé |
| `game/player` | `controller.update`, `weapons` (début + `fire*`) ; le reste en survol |
| `game/level` | `trains/*`, `trainRide/*`, `blockout/` (partiel), `loader` (partiel), 3 fonctions de fusion, `catalog/levels`, `navSearch` ; `doors`, `props`, `scripting`, `interactions` en survol |
| `game/devtools`, `game/settings`, `game/hud` | `cheats`, début de `consoleApi`, `graphicsSettings` (début), `records`, `state.ts` (début) |
| `ui/` | Structure complète vérifiée par script, 8 composants lus, métriques CSS complètes |

---

## 2. Ce qui va bien (à protéger)

Ces points sont la raison pour laquelle le jugement global reste positif. Il faut les rendre **impossibles à casser par accident** (cf. §8, action 2).

1. **Typage strict et propre.** `strict`, `noUnusedLocals`, `noUnusedParameters` ; zéro `any`, zéro `@ts-ignore`. Le typecheck passe.
2. **Validation aux frontières par schéma Effect.** `Schema` valide les manifestes audio (`core/audio/audioManifest.ts`), les enregistrements d'input (`core/input/recordingSchema.ts`), les raccourcis clavier stockés, la sauvegarde de campagne (`game/session/campaign/campaignStorage.ts`, versionnée, avec message utilisateur en cas d'échec), les manifestes de sprites, les extras Blender des trains.
3. **Frontière Effect synchrone respectée (invariant #11).** `Effect.tryPromise` / `promise` / `async` / `sleep` n'apparaissent que dans `game/level/loading/loader.ts:454` et `hotReload.ts:120,140,156` ; `runPromise` / `runFork` seulement là. Le garde-fou de `core/effect/runtime.ts` rend les défauts bruyants.
4. **Déterminisme tenu (invariant #12).** Aucun `Math.random` ; seeds dérivées de compteurs de spawn ; `Date.now` n'existe que dans l'UI (`ui/screens/loading/LoadingScreen/useLoadingStatus.ts:20`, hors simulation) ; `performance.now()` dans `navSearch.ts:106,153` n'alimente que des métriques (documenté : « n'entrent jamais dans les décisions de simulation »).
5. **Pas fixe et rotation non interpolée (invariants #1, #3).** `core/loop/loop.ts` clampe à 0,25 s ; `game/loop/interpolateVisuals.ts:46` lit `engine.look.yaw/pitch` directement.
6. **Character controller = Rapier (invariant #6)** : `physics/world.ts::configureCharacterController`, `game/player/movement/controller.ts`. Le code de déplacement est **bien écrit** : fonctions pures de calcul dans `moveConfig.ts`, commentaires qui expliquent le *pourquoi* (snap-to-ground suspendu en montée, etc.).
7. **Teardown exemplaire** : `game/session/lifecycle.ts::teardownGameSession` agrège les erreurs (`AggregateError`) et libère chaque ressource isolément.
8. **UI : conformité quasi totale aux règles écrites** (§6) : un dossier par composant (100 %), zéro `<style>`, zéro `style=` hors `cssVars()`, zéro export par défaut / `forwardRef` / `React.FC`, jetons CSS utilisés partout (aucune couleur de palette réécrite en dur), zéro `!important`, aucun état par frame.
9. **Documentation reliée au code** : 341 ancres `// see:` toutes valides ; 76 fichiers de tests, 784 tests.
10. **Pas d'ECS prématuré (invariant #8)** : `Entity[]` + `switch`.
11. **CI** : le workflow GitHub exécute `pnpm check` (typecheck + tests + build) sur chaque PR — le garde-fou existe, il faut qu'il reste vert.

---

## 3. Constats transversaux

### 3.1 Architecture : les couches ne sont pas étanches 🟠

Matrice des imports entre couches (nombre d'imports, de → vers) :

| de ↓ / vers → | app | core | physics | render | game | ui |
|---|---|---|---|---|---|---|
| **app** | – | 4 | 1 | 1 | **20** | 8 |
| **core** | | – | | | **4** (types) | |
| **physics** | | | – | | **1** (valeur) | |
| **render** | 1 | 5 | 1 | – | **20** | |
| **game** | **18** | 52 | 39 | 51 | – | |
| **ui** | | 8 | | 1 | 61 | – |

L'ordre voulu est `core → physics → render → game → app → ui`. Les écarts :

| Écart | Où | Gravité |
|---|---|---|
| `core` dépend de `game` (types `FiringWeapon`, `DoorMovement`) | `core/audio/audio.ts:1,14`, `audioCatalog.ts:1,2` | 🟠 (types seulement, mais `core` n'est plus un socle) |
| `physics` dépend de `game` (valeur : `moveConfig` en paramètre par défaut) | `physics/world.ts:3,66,94` | 🟠 |
| `render` dépend de `game` (20 imports) et de `app` | `render/environment/trainGym/*`, `trainRide/*`, `render/fx/*` (`FiringWeapon`), `render/pickups/*`, `render/viewmodel/*`, `render/environment/metro/warmTrainModel.ts:2` (`runGameplaySync`) | 🔴 pour les trains, 🟠 ailleurs |
| `game` dépend de `app` (18 imports) | presque tous vers `app/runtime/gameRuntime` | 🟠 |
| `app/runtime/gameRuntime.ts` importe `game/level/navigation/pathfinding` et `render/pipeline/renderService` puis est lui-même importé par `game` | racine de composition située *sous* le code qu'elle compose | 🟠 |
| `game/entities/shared/enemyCombat.ts:61,75`, `enemyMachine.ts:245,272,280` lisent `game/devtools/cheats` en production | un drapeau de dev dans le chemin de gameplay | 🟠 |
| `game/hud/state.ts` importe un type de `app/navigation` | | 🟢 (type seul) |
| `ui/components/layout/RecapTable` importe un type de `game/hud/hudTypes` | viole « `components/` n'importe que `lib/` » | 🟠 (cf. §6) |
| `render/environment/trainGym/trainPresentation.ts` **crée des corps et colliders Rapier** et expose une méthode `updateFixed` | de la physique et de la logique de pas fixe dans la couche rendu | 🔴 |

**Cycles d'imports (types uniquement, aucun cycle de valeur)** :

- 10 fichiers : `game/level/blockout/metroBlockout.ts`, `trains/levelTrains.ts`, `trains/trainLevelData.ts`, `render/environment/trainGym/trainBeacons.ts`, `loading/levelTypes.ts`, `levelDiagnostics.ts`, `levelExtras.ts`, `interactions/vitres.ts`, `interactions/interactive.ts`, `props/props.ts`. **Six des dix sont du code métro.** La cause : `LevelTrains` (jeu) construit `TrainPresentation` (rendu) qui importe en retour les types du système de trains (jeu).
- 5 fichiers : `session/gameEngine.ts`, `gameSession.ts`, `player/feedback.ts`, `player/placeLines.ts`, `progression/recap.ts`. Le contournement `PersistentEngine = Omit<GameEngine, "session">` (`gameEngine.ts`) est le symptôme.

**Couplage** (fan-out = modules locaux importés) : `consoleApi.ts` 52 · `spawning.ts` 37 · `updateGameplay.ts` 36 · `lifecycle.ts` 36 · `main.ts` 33 · `gameSession.ts` 32. Fan-in le plus fort : `game/hud/state.ts` 37, `physics/world.ts` 32, `session/gameEngine.ts` 22.

### 3.2 Le chantier métro / campagne : le foyer de la dérive 🔴

Périmètre (≈ 1 800 lignes, ≈ 6 % de `src/`) : `game/level/trains/` (689 lignes), `trainRide/` (115), `blockout/` (116), `catalog/trainGym.ts` + `trainRideGym.ts`, `render/environment/trainGym/`, `trainRide/`, `metro/`, `game/session/player/{levelTrain,trainGym,trainRide}Gameplay.ts`, `game/session/campaign/`, `ui/dev/tuning/sections/Train*`.

**Preuves chiffrées de la rupture de style** (comparées au reste du dépôt) :

| Indicateur | Métro | Reste de `src/` |
|---|---|---|
| Décimaux écrits `.35` (sans zéro) | `trainGym.ts` 34 · `trainRideGym.ts` 25 · `trainPresentation.ts` 12 · `trainRidePresentation.ts` 12 → **83 sur 123 (67 %)** | quasi nul |
| Lignes à plusieurs instructions (`a; b; c;`) | `trainPresentation.ts` 19 · `metroBlockout.ts` 13 · `trainRidePresentation.ts` 11 · … → **≥ 53 sur 135 (39 %)** | |
| Lignes de 170–183 caractères | `trainLevelData.ts`, `trainPresentation.ts`, `trainContact.ts:66` | |

**Problèmes de conception** (avec leurs emplacements) :

| # | Problème | Emplacement |
|---|---|---|
| 1 | **Aucun test** : `trainTouchesActor` (contact mortel), `TrainSystem`, `TrainRideSystem`, `readTrainLevel`, `MetroBlockout`, `campaignStorage`/`campaignArrival` — rien ne les importe dans `test/`. | `test/` |
| 2 | **Fuite dans le code générique** : `GameSession` embarque `trainGym`, `trainRideGym`, `gymRoot`, `ballMesh`, `ballBody`, `devCompleteRequested`, `devCampaignCommands` ; `updateFx` lit `session.trainGym` ; `interpolateVisuals` appelle 4 présentations de train ; `lifecycle.buildGameSession` a une chaîne `if/else` sur `choice.kind` (`gym`, `train-gym`, `train-ride-gym`) ; `loader.ts:303` instancie `MetroBlockout` si l'objet `n5_voyage_centre` existe ; `loader.ts:100` liste en dur les préfixes `train_modele_`, `stage_voyage_`. | `session/gameSession.ts`, `loop/updateFx.ts:83,109`, `loop/interpolateVisuals.ts:71–77`, `session/lifecycle.ts:99–139,232–250`, `level/loading/loader.ts:100,303` |
| 3 | **Noms de niveau codés dans la logique** : `"n5_voyage_centre"`, `"stage_voyage_*"`, `"use_n5_*"`, voies `"VB"`, `"A"`, seuils `-366`, `30.6`, `1.55`. | `blockout/metroBlockout.ts:24–29,46,81,88`, `blockoutConfig.ts` |
| 4 | **Physique dans la couche rendu** : `TrainPresentation` fait `createRigidBody` / `createCollider` et a un `updateFixed`. | `render/environment/trainGym/trainPresentation.ts:75–77,92` |
| 5 | **Logique de visibilité triplée** (même expression de 120+ caractères) : `trainContact.ts:66`, `trainPresentation.ts:110`, `:131`. | |
| 6 | **Deux modèles d'erreur pour une même fonctionnalité** : `readTrainLevel` lève des exceptions (`invalid()`), `auditTrainSafety` renvoie des erreurs typées Effect ; messages construits par concaténation `+` au lieu de gabarits. | `trains/trainLevelData.ts:46`, `trains/trainSafety.ts` |
| 7 | **Nombres magiques non nommés** : `.01`, `.6`, `.25`, `.3`, `.1`, `.2` (gabarit), `20 * 20`, `Math.max(10, …)`, `Math.max(1, …)`, `9`, `1.58`, `.8` (refuges), `4` (bogie), `.15`. | `trains/trainLevelData.ts`, `trainSystem.ts:85,92,114,123`, `trainSafety.ts`, `trainPath.ts:36–37` |
| 8 | **`TrainSystem.update` (≈ 60 lignes, complexité ≈ 29)** : chaîne `if` sur `command.type` dont le dernier `else if` traite *implicitement* `"stop"` ; pas de `switch` exhaustif. | `trains/trainSystem.ts:48–106` |
| 9 | **`TrainRideSystem.update`** : clamp de configuration *dans* la boucle de commandes, variables `a`, `b`, `t`, `u`, polynômes de lissage avec coefficients littéraux, `else if` implicite pour la commande de départ. | `trainRide/trainRideSystem.ts:24–76` |
| 10 | **Singletons mutables partagés** : `trainConfig` (export mutable) sert de défaut à `TrainSystem`, est lu par `updateFx`, modifié par le panneau de tuning ; `LevelTrains` code `trainDifficulty("habitue")` en dur. | `trains/trainConfig.ts`, `levelTrains.ts:16` |
| 11 | **Chaînes d'interface dans la logique** : `"TRAFIC — VOIE " + signal.lane`, `"ESSAI T1 — TRAINS"`, messages d'aiguillage dans `TrainSystem`. | `levelTrains.ts:33`, `trainPresentation.ts:37`, `trainSystem.ts:69,76,78` |
| 12 | **Registre de niveaux** : l'entrée de production `"metro"` pointe sur `metro_blockout` (placeholder), dupliquée mot pour mot par `blockout_metro` en dev ; commentaire de tête orphelin ; sept `...(DEV ? [{…}] : [])` aux formats hétérogènes. | `game/level/catalog/levels.ts:31–45` |
| 13 | Convention Blender non documentée au bon endroit : `voie_`, `rail_`, `signal_train_`, `refuge_train_`, `nav_voie_`, `traversee_train_`, `train_modele_`, `stage_voyage_` sont absents du tableau de `CLAUDE.md` et de `docs/6-reference/conventions-nommage.md` (ils sont dans `docs/4-technique/trains-metro.md`). | docs |

**À son crédit** : l'idée est bonne et soignée sur le fond — volume balayé par enveloppe convexe plutôt que capsule transportée, audit de sécurité des refuges par lancers de rayons au chargement, validation Blender stricte, sauvegarde de campagne versionnée et schématisée, documentation `docs/4-technique/` fournie. Le problème est l'habillage et l'absence de filet, pas l'idée.

### 3.3 Fonctions et fichiers trop gros 🔴

Classement par longueur (heuristique) :

| Lignes | Complexité ≈ | Fonction | Remarque |
|---|---|---|---|
| 494 | 118 | `game/loop/updateGameplay.ts:167` `updateGameplay` | cf. §4.6 |
| 345 | 73 | `game/loop/updateFx.ts:90` `updateFx` | cf. §4.6 |
| 302 | 46 | `game/level/loading/loader.ts:63` `buildLevelResourceEffect` | routeur de préfixes en `if` successifs |
| 255 | 37 | `game/devtools/consoleApi.ts:89` `exposeDebugApi` | ligne max 523 caractères |
| 184 / 177 | 37 / 36 | `game/session/spawning.ts` `loadGltfLevel` / `install` | |
| 181 | 18 | `game/session/lifecycle.ts:75` `buildGameSession` | chaîne de branches par type de niveau |
| 152 | 37 | `game/player/movement/controller.ts:191` `update` | linéaire, bien commenté — acceptable, découpable |
| 141 | 24 | `game/level/loading/hotReload.ts:54` `createLevelSession` | |
| 132 | 14 | `main.ts:47` `main` | |
| 103 / 76 | 32 / 18 | `catalog/trainGym.ts` / `trainRideGym.ts` | |
| 93 | 55 | `trains/trainLevelData.ts:56` `readTrainLevel` | **complexité la plus dense par ligne** |

Au total : 34 fonctions > 60 lignes, 13 > 100, 8 > 150. Fichiers les plus longs : `updateGameplay.ts` 660 · `weapons.ts` 629 · `consoleApi.ts` 585 · `props.ts` 478 · `loader.ts` 475 · `levelObjects.ts` 444 · `sanitaires.ts` 436 · `updateFx.ts` 434 · `enemyMachine.ts` 409.

### 3.4 Duplication 🔴

| Doublon | Mesure | Où |
|---|---|---|
| Costard ↔ Directeur : gestionnaire | **96 lignes sur 136 (71 %)** identiques après normalisation `Suit`/`Director` | `entities/suit/suitManager.ts` ↔ `director/directorManager.ts` |
| Costard ↔ Directeur : entité | **70 / 86 (81 %)** | `suit/suit.ts` ↔ `director/director.ts` |
| Costard ↔ Directeur : config | 29 / 46 (63 %) | `suitConfig.ts` ↔ `directorConfig.ts` |
| Fusion de décor ×4 (groupement par matériau, clonage, `applyMatrix4`, `mergeGeometries`, plages de sommets, libération) | ≈ 70–90 lignes chacune | `loading/mergeStaticDecor.ts:67`, `interactions/vitres.ts:87`, `sanitaires/sanitaires.ts:113`, `interactions/ecrans.ts:154` — le commentaire de `sanitaires.ts` admet « même garde que `mergeVitreDecor` » |
| Boucle de gestion d'événements par espèce dans `updateFx` (alerte, télégraphie, tir, blessure, mort, coup au joueur) | ≈ 2 × 60 lignes, avec des `void event;` pour faire taire le compilateur (`updateFx.ts:231,235,239`) | `loop/updateFx.ts` |
| Soin du joueur (mêmes 8 lignes) | 2 fois | `loop/updateGameplay.ts:405–448` |
| Tirage d'un plomb (échantillonnage du disque, remplissage du rayon, lancer, extrémité) | pistolet et pompe | `player/weapons/weapons.ts` `firePistol` / `fireShotgun` |
| `SuitAlertEvent` / `SuitTelegraphEvent` / `SuitShotEvent` = `{ suit: Suit }` ×3, file d'événements ×6 par gestionnaire | | `suitManager.ts:15–43`, `:76–102` |
| Ambiance d'eau ↔ ambiance de douche | ≈ 80 % du fichier identique (même état, mêmes constantes `AUDIBLE_GAIN_EPSILON`, `PAN_SMOOTH_TAU`) | `core/audio/waterAmbience.ts` ↔ `showerAmbience.ts` |
| `fetch(...).then(r => r.ok ? r.json() : Promise.reject(...)).then(decode…)` + `AbortSignal.timeout(15000)` | ×3, plus `LOAD_TIMEOUT_MS = 15000` ailleurs | `core/audio/audio.ts:54`, `heroVoice.ts:25`, `zoneAmbience.ts:53`, `audioPreparation.ts:3` |
| `runGameplaySync(DeterministicRandom.useSync(r => r.forSeed(x)))` | ×9, dont 3 avec graine littérale | `session/lifecycle.ts:81–83` |
| Gravité −25 | 4 déclarations indépendantes | `physics/world.ts:86`, `render/fx/goreChunks.ts:8`, `waterJets.ts:4`, `toyDebris.ts:6` |
| `SEED_STRIDE = 0x9e3779b1` | ×2 ; `SHOTGUN_SPREAD_SEED = 0x9e3779b9` ressemble au même nombre d'or | `suitManager.ts:55`, `directorManager.ts:58`, `weapons.ts:34` |
| Persistance `localStorage` | 7 modules, 2 styles de validation (Schema pour 2, garde de type manuelle pour 5) | `core/input/inputPersistence.ts`, `game/settings/{records,storySettings,graphicsSettings,audioSettings,difficultySettings}.ts`, `session/campaign/campaignStorage.ts` |

> La CLAUDE.md et la mémoire de projet parlent d'une « dédup Suit/Director » livrée : elle l'est pour **la machine à états** (`shared/enemyMachine.ts`), pas pour le gestionnaire ni l'entité.

### 3.5 Nommage et langue 🟠

Aucune règle écrite ne fixe la langue des identifiants (aucune occurrence dans `CLAUDE.md`, `docs/6-reference/`, `docs/5-guides/`). Résultat : le code mélange les deux **dans la même fonction**.

- Dans `updateGameplay` : `weaponEyeOrigin`, `gameplayDt`, `activeFrame` à côté de `enLAir`, `chute`, `consomme`, `tireur`, `guetteur`, `souffle`, `ligneCasse`, `dejaPossede`, `avantAmmo`, `pris`, `etat`.
- Dans `core/audio/audio.ts` : `playSfx`, `setSfxGain` à côté de `avertirUneFois`, `cles`, `chargement`, `lecture`, `avertis`, `manifeste`.
- Dans `render/pipeline/renderer.ts` : `configureRetroTexture` à côté de `appliquerFiltrage`, `setResolutionInterne`, `filtrageCourant`, `anisotropieDisponible`, `FiltrageTexture`.
- Dans le métro : `TrainSystem`, `lane`, `pass` (EN) mais `aiguillage`, `courant`, `raccourci`, `voie`, `commande`, `trajet`.
- API de console de dev : `etat()`, `variantes`, `voyageRame`, `morts`, `ennemis`, `traversées`.

Une partie du français est **légitime** (vocabulaire du contrat Blender : `vitre_`, `sanitaire_`, `ecran_`, `matiere`, `givre`, `voie`…, et texte à l'écran). Le défaut est le français **dans les variables locales et les noms de fonction** sans règle.

Autres incohérences :

| Incohérence | Exemples |
|---|---|
| Deux vocabulaires pour la même chose | `GameAction` (`moveForward`, `switchMelee`) vs `InputFrame` (`forward`, `switchToMelee`) dans `core/input/inputTypes.ts` |
| Fichier ≠ contenu | `core/loop/time.ts` exporte `GameClock` ; `Suit` désigne trois espèces (`costard`/`rampant`/`vigile`) et `SuitManager` les gère toutes ; `SuitKind` |
| Type mal rangé | `Vec3Like` défini dans `core/audio/waterAmbienceMix.ts` et importé par `zoneAmbience.ts` ; `approach()` défini dans `controller.ts` et importé par `weapons.ts:12` |
| Style d'import de types | `import type {…}` ×317 · `import { type X }` ×46 · `import { a, type B }` ×99 |
| Décimaux | `0.35` (majorité) vs `.35` (123 occurrences, 2/3 dans le métro) |
| Construction de messages | gabarits `` `…${x}` `` (majorité) vs concaténation `"…" + x` (métro) |
| Seeds | constantes nommées (`STREAM_SEED`, `HERO_LINE_SEED`) vs littéraux (`lifecycle.ts:81–83`) |

### 3.6 Typage : de faux garde-fous 🟠

- **177 assertions `!`** dont la grande majorité sont des accès indexés (`route.points[i]!`). Or `tsconfig.json` **n'active pas `noUncheckedIndexedAccess`** (jamais, d'après l'historique git) : ces `!` sont sans effet. Elles donnent une fausse impression de vérification et masquent les vrais cas où elles comptent (`Map.get`, `find`). Soit on active le drapeau et on garde les `!` utiles, soit on supprime le bruit.
- **194 casts `as`** (hors `as const`) : `main.ts:48–49` (`getElementById(...) as HTMLCanvasElement` sans test de nullité) ; `atlas!`, `waterHowl!`, `showerHowl!`, `warning!` dans les callbacks Howler (`core/audio/*`) alors que la valeur vient d'être assignée juste au-dessus.
- Tables à clés `string` là où le domaine est fermé : `PROP_BREAK_SFX`, `MATERIAL_IMPACT_SFX` (`core/audio/audioCatalog.ts`) et `playImpactSfx(material: string)`, `playPropBreakSfx(matiere: string)`.
- Unions écrites à la main et dupliquées par une table : `SfxId` (31 membres) ↔ `SFX_TABLE`, `GameAction` ↔ `DEFAULT_BINDINGS` ↔ `ACTION_LABELS`, `GameFlowState` ↔ états de la machine. Dériver le type de la table (`keyof typeof`) supprime la double maintenance.
- Types de « tranches » écrits à la main : `FxSession` / `FxEngine` dans `updateFx.ts:78–86` listent ~35 noms de champs entre guillemets — à chaque ajout de champ, ils se désynchronisent.
- Paramètres positionnels en cascade : `RaycastServiceShape.castRay` à **9** paramètres positionnels optionnels, `castShape` à 10 (`physics/raycast.ts`).

### 3.7 Commentaires et documentation 🟠

L'outil du projet (`tools/docs/audit_comments.py`) rapporte : **20,5 %** de lignes de commentaires, **86 blocs longs** candidats à la migration vers `/docs`, **12 fichiers > 20 %**, 4 bannières de section.

Constats complémentaires :

- **Commentaires-journal** (qui racontent l'historique plutôt que le code ; 11 occurrences de « Jalon M… » dans `consoleApi.ts`, `updateFx.ts:394`, `enemyMachine.ts:293`, `gameSession.ts:82`…) : « Jalon M6 (PLAN_EFFECT_XSTATE.md, §8) … EXACTEMENT le même ordre qu'avant ce jalon » (`updateGameplay.ts:182`), « Jalon M3 (PLAN_EFFECT_XSTATE.md) » (`weapons.ts:583`), « depuis l'extraction de ce fichier hors de `main.ts` » (`updateGameplay.ts:61`), « remplace la variable mutable `currentSession` de `main()` » (`gameEngine.ts`). Ces plans ont été retirés du dépôt : la référence est morte, l'information est dans git.
- **Références à l'outillage d'agent** dans du code de production : « valeur prescrite par le skill » (`billboard.ts:26`), « Règle non négociable du skill » (`updateFx.ts:193`), « PRESCRIT par le skill (30°) » (`directorConfig.ts:40`, `suitConfig.ts:42`), « Diagnostic imposé par le skill » (`controller.ts:51`), `levelTypes.ts:84`, `DebugPanel.tsx:13`. La justification doit être un ADR ou une page de `/docs`, pas un nom de skill.
- **Docstrings monstrueuses** dans les types : `GameSession.gymRoot` (≈ 600 caractères), `GameEngine.session` (tronquée par le formateur), `directorManager.ts:56` (≈ 330 caractères sur une ligne).
- **Ancres `// see:` orphelines**, séparées de leur code par des lignes vides : `weapons.ts:25–31`, `gameSession.ts` (en-tête), `core/audio/showerAmbience.ts:22`.
- **Lignes vides en double** : 20 occurrences, concentrées dans `weapons.ts` (5), `toyDebris.ts` (4).
- **Texte joueur qui cite un invariant interne** : `ui/screens/options/display/DisplayTab/DisplayTab.tsx:39,52` — « … (invariant #4) » dans une infobulle visible par le joueur.
- **Les 62 `console.warn/error`** sont préfixés `[zone]` pour la plupart, sans abstraction de journalisation ; jusqu'à 26 n'ont pas de préfixe littéral sur la ligne de l'appel (certains en portent un à la ligne suivante ou via une fonction `format…`), p. ex. `core/effect/runtime.ts:11`, `waterAmbience.ts:52`, `debugView.ts:17`, `levelColliders.ts:83,119,208,213,288`, `levelDiagnostics.ts:309,314`.

### 3.8 Tests 🔴

- **État actuel** : 779/784. Les 5 échecs sont tous des tests qui n'ont pas suivi le code :

| Test | Cause apparente |
|---|---|
| `test/ui/screens.test.ts` — « le menu déclenche jouer et paramètres » | le bouton cherché (`REJOINDRE LE DIRECT`) n'existe plus dans `MainMenu` |
| `test/game/level/loading/mergeStaticDecor.test.ts:133` | `decorBatchCount` attendu 2, reçu 1 (comportement de fusion changé) |
| `test/game/session/progression/perks.test.ts:148` | `usePerkKiosk` renvoie `"achete"` au lieu de `"epuisee"` |
| `test/game/session/progression/perks.test.ts:179` | `perkOffer.sold` attendu `true`, reçu `false` |
| `test/game/session/progression/score.test.ts:49` | `createInitialStats()` a gagné `trainKills`, `trainDeaths`, `trainCrossings` |

  La CI (`pnpm check`) échouerait sur une PR dans cet état.
- **Test d'une fiction** : `test/app/navigation/gameFlowMachine.test.ts:45–60` teste les transitions `OPEN_OPTIONS`, `BACK_TO_MENU`, `CHOOSE_ZONE` — des événements que **aucun code de production n'envoie** (§4.1).
- **Fichiers > 150 lignes sans import direct par un test** : `updateGameplay.ts` (661), `updateFx.ts` (435), `spawning.ts` (364), `enemyMachine.ts` (410, testé indirectement), `consoleApi.ts`, `levelObjects.ts` (445), `levelColliders.ts`, `levelDiagnostics.ts`, `levelExtras.ts`, `zoneAmbience.ts`, `main.ts`, `trainPresentation.ts`, et la plupart des modules `render/fx/`, `render/pickups/`.
- **Part de lignes importées directement par un test** (proxy) : `game/player` 97 % · `game/session` 78 % · `game/entities` 72 % · `game/level` 54 % · `core/audio` 10 % · `render/*` 0–25 % (sauf `sprites` 86 %) · `ui/hud` 7 % · `ui/dev` 0 %. Une partie du manque côté `render` et `core/audio` est normale (GPU, Howler) ; celui de `updateGameplay` et du code métro ne l'est pas.

### 3.9 Outillage 🔴

- **Aucun** ESLint / Biome / oxlint, **aucun** Prettier / EditorConfig. Les effets sont visibles : doubles lignes vides, `catch {\n  }` à moitié formatés (`core/input/inputPersistence.ts` ×2, `input.ts:78`), lignes de 523 caractères, styles différents selon l'auteur (humain ou agent).
- **Aucune règle de couches** : rien n'empêche `core` d'importer `game` ni `render` de créer des corps Rapier.
- `tsconfig.json` : pas de `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`.
- Le projet possède déjà des garde-fous maison (`pnpm verify`, `check_docs_links.py`, `audit_comments.py`) — la culture est là, il manque le même niveau pour le code.

### 3.10 Robustesse et performance (à mesurer) 🟠

- **Pas de frontière d'erreur** : `main.ts:180` `main();` sans `.catch` (un échec au démarrage laisse un écran vide) ; aucun `ErrorBoundary` React, aucun `window.onerror` / `unhandledrejection`. Une exception levée dans `frame()` ne stoppe pas la boucle (`requestAnimationFrame` est replanifié en tête) : elle se **répète à 60 Hz** sans retour visible pour le joueur.
- **`Effect.sync` en rafale dans le pas fixe** : `updateGameplay` enveloppe son corps dans un `Effect.gen` de **12** `yield* Effect.sync(() => {…})`, `updateFx` de 10, `interpolateVisuals` de 4. Aucun de ces blocs ne peut échouer, suspendre ni requérir de service : ils ne servent qu'à satisfaire l'invariant #11, au prix de closures et d'objets Effect recréés à chaque pas. *À mesurer.* Un seul `runGameplaySync(Effect.sync(() => step(engine, dt)))` satisfait le même invariant.
- **Un `runSync` par rayon** : `weapons.ts` (chaque plomb), perception des ennemis, etc. passent par `runGameplaySync(RaycastService.use(...))`. Le service n'a qu'un intérêt (substituer en test). *À mesurer* sous 8 plombs + N ennemis ; un chemin direct pour le chaud et le service pour les tests serait équivalent.
- **A\* alloue 3 tableaux typés de la taille de la grille à chaque requête** (`navSearch.ts:110–112`, `Float64Array` + `Int32Array` + `Uint8Array`). *À mesurer* selon la fréquence de recalcul de chemin.
- **`?level=<nom>` actif en production** (`app/navigation/bootChoice.ts:45–57`) : accepte n'importe quel nom de `.glb`, y compris les niveaux de dev et le blockout (seul `campaignProfile` est gardé par `DEV`). Probablement voulu pour les mesures — à décider explicitement.
- **Écouteurs globaux** (`input.ts:26–33`, `audioSettings.ts:105–107`) : durée de vie = onglet, pas de fuite réelle, mais pas de `detach()` (gênant pour des tests ou du hot-reload d'`input`).

---

## 4. Dossier par dossier

### 4.1 `src/app/` (471 lignes, 5 fichiers) 🟠

**Va** : `sessionFlow.ts` est clair, bien documenté, avec une file de transitions (`runTransition`) qui interdit les doubles ; `gameFlowMachine.ts` utilise `satisfies Record<GameFlowState, unknown>` (exhaustivité vérifiée) ; frontière asynchrone bien tenue.

**Ne va pas**
- **États et événements morts dans la machine XState** : `options`, `levelSelect` et les événements `OPEN_OPTIONS`, `CHOOSE_ZONE`, `BACK_TO_MENU` (`gameFlowMachine.ts:24,25,30` ; `gameFlowTypes.ts:17–19`) ne sont envoyés par **aucun** code de production. La navigation réelle du menu est faite par des fermetures (`showMainMenu`, `showLevels`, `showDifficulty`, `OptionsScreen`) dans `bootChoice.ts` qui appelle `root.render(createElement(...))`. **Deux sources de vérité** pour « quel écran est affiché », dont une fictive (et testée : cf. §3.8).
- **`bootChoice.ts` mélange** logique métier (résolution `?level=`, déblocage de campagne, profils `type`/`pauvre`/`riche`), textes d'interface (« Hyper Varan », « Le premier direct… ») et rendu React impératif. `URLSearchParams(window.location.search)` y est relu **trois fois** (`:45,60,62`) et une quatrième dans `main.ts:89`.
- **`sessionFlow.ts`** : `nextLevel`, `replaySession`, `returnToMenuSession` répètent la même séquence (`clearPendingEdges` → `beginLoading` → `letBrowserPaint` → `teardown` → `bootGameSessionWithRetry` → `waitForGameSessionReady`).
- **Dépendances** : `app` importe 20 modules de `game` et 8 de `ui` ; en retour 18 imports `game → app/runtime`. `app/runtime/gameRuntime.ts` importe `game/level/navigation/pathfinding` et `render/pipeline/renderService` : la racine de composition est importée par ce qu'elle compose.

**Pistes**
- Soit la machine pilote vraiment les écrans de menu (états `mainMenu`/`options`/`levelSelect`/`difficulty` + `useGameStore.flowState`), soit on supprime les états et événements morts et leur test (S–M).
- Extraire `reloadSession(choice, entry, label)` dans `sessionFlow.ts` (S). Centraliser les paramètres d'URL dans un module `launchParams.ts` (S).
- Déplacer `runGameplaySync` dans `core/effect` avec un enregistrement du runtime au démarrage (`main.ts` compose `GameLayer`) : plus de dépendance `game → app/runtime` (M).

### 4.2 `src/core/` (1 609 lignes, 24 fichiers) 🟢 / 🟠

| Sous-dossier | Verdict | Détail |
|---|---|---|
| `loop/` (130) | 🟢 | `loop.ts`, `rollingP95.ts`, `time.ts` : petits, clairs, aucune allocation parasite. Seul défaut : `time.ts` exporte `GameClock` (renommer `gameClock.ts`), `startLoop` ne retourne aucun handle d'arrêt. |
| `effect/` (45) | 🟢 | `random.ts` (mulberry32) et `runtime.ts` (garde-fou) sont exemplaires. |
| `input/` (420) | 🟢 | `input.ts` bien structuré (fronts consommables vs fronts d'affichage), schémas pour l'enregistrement. Défauts : `catch {}` vides sans commentaire dans `inputPersistence.ts` (×2), `input.ts:78` ; vocabulaires `GameAction` / `InputFrame` divergents ; pas de `detach()`. |
| `loading/` (84) | 🟢 | `assetPath.ts`, `loadingProgress.ts` : petit store externe (utilisé via `useSyncExternalStore`, comme le prévoit la doc React). |
| `audio/` (930) | 🟠 | Voir ci-dessous. |

**`core/audio/` — ce qui ne va pas**
- **Dépendance vers `game`** : `audio.ts:1,14`, `audioCatalog.ts:1,2` importent `FiringWeapon` et `DoorMovement`. Inverser : `core` définit ses clés d'événement, `game` fait la correspondance.
- **Duplication** (cf. §3.4) : eau/douche ≈ 80 %, `fetch + decode + timeout` ×3 avec le même `15000` en dur.
- **État de module mutable** dans 7 fichiers (`let atlas`, `let chargement`, `let channelGain`…) : `zoneAmbience.ts` 12 `let`, `waterAmbience.ts` 9, `showerAmbience.ts` 8. Impossible à tester sans réinitialisation, ordre d'init implicite (`initZoneAmbience` appelle `clearZoneAmbienceSession()` **deux fois**, `:109` et `:116`, sans commentaire).
- **Assertions `!`** après assignation dans des callbacks Howler (`audio.ts:66`, `waterAmbience.ts:46`, `showerAmbience.ts:39`, `trainWarning.ts:13`).
- **Nombres magiques** : `0.22` et `450` dans `trainWarning.ts`, `pool: 2`, `10 ** (db / 20)`…
- **Ordre de déclaration incohérent** (`waterAmbience.ts` : fonction exportée, puis constantes, puis état).
- **Langue mixte** : `avertirUneFois`, `cles`, `chargement`, `lecture`, `manifeste` / `playSfx`, `setSfxGain`.
- **Types** : `PROP_BREAK_SFX: Record<string, SfxId>` (clés ouvertes), `SfxId` écrit à la main, doublonné par `SFX_TABLE`.

**Pistes** : `fetchJson(url, decoder)` partagé (S) ; un `LoopedAmbience` paramétré pour eau/douche (S–M) ; `SfxId = keyof typeof SFX_TABLE` (S) ; table de correspondance `weapon → sfx` côté `game` (S).

### 4.3 `src/physics/` (276 lignes, 2 fichiers) 🟠

**Va** : `world.ts` — groupes de collision lisibles (`GROUP`, `COLLISION_GROUPS`) avec la raison des exclusions en commentaire ; `refreshSceneQueries` bien expliqué.

**Ne va pas**
- `world.ts:3` importe `game/player/movement/moveConfig` (paramètres par défaut `cfg = moveConfig`) : `physics` ne devrait pas connaître le gameplay. Passer la config en paramètre obligatoire ou en injecter.
- **Gravité −25** déclarée ici (`:86`) et **trois fois** dans `render/fx/` (§3.4) : l'invariant #7 n'a pas de source unique.
- `raycast.ts` : API à 9–10 paramètres positionnels, signature répétée trois fois (interface + implémentation ×3) ; passer à un objet d'options (`{ filterFlags, groups, excludeCollider, … }`) diviserait le fichier par deux.
- `Effect.sync` par rayon : à mesurer (§3.10).

### 4.4 `src/render/` (4 629 lignes, 58 fichiers) 🟢 / 🔴 selon le sous-dossier

| Sous-dossier | Verdict | Notes |
|---|---|---|
| `pipeline/` (169) | 🟢 | Propre ; rôle de `textureRegistry` bien commenté. Défauts : nommage FR/EN dans `renderer.ts` ; `filtrageCourant()` et `registerMaterialTextureInputs()` **jamais utilisés** ; état global `filtrage` en variable de module. Le défaut `"aniso"` (renderer.ts, `graphicsSettings`) applique déjà l'amendement de l'ADR 0027 que `CLAUDE.md` dit **encore en attente de validation**. |
| `sprites/` (453) | 🟢 | `billboard.ts` : vecteurs réutilisés, `dispose()` complet, clonage de texture justifié. `enemySprites.ts` : `switch` exhaustif, repli sur atlas numéroté, libération des textures chargées après un échec partiel. Défauts : ligne vide au milieu de `BillboardSpriteOptions`, `atlases.humain!`, référence « le skill ». |
| `viewmodel/` (369) | 🟢 | Survol : petits fichiers, types à part. `kickAnimation.ts` et `viewmodel*.ts` importent `game/player/weapons/*`. |
| `overlays/`, `debug/`, `materials/` | 🟢 | Survol. |
| `pickups/` (536) | 🟢 | Survol ; `pickupResources.ts` 298 lignes, aucune couverture. |
| `fx/` (1 990) | 🟠 | 18 fichiers. `toyDebris.ts` : bon usage de constantes nommées, mais 7 tableaux de particules parallèles, deux lignes vides en double ×4, 2 bannières de section (`explosions.ts:27`, `gore.ts:12,16` selon l'outil), gravité −25 dupliquée ; `new THREE.Mesh` à chaque particule (allocations par impact). `waterJets.ts` : 10 `new THREE.Vector3` et 9 `!`. |
| `environment/` (642) | 🔴 pour les trains, 🟢 ailleurs | `trainGym/trainPresentation.ts` (196) : style dense (19 lignes multi-instructions), nombres magiques (`.35`, `512×192`, `4.8×1.8`), **corps/colliders Rapier créés ici**, `updateFixed` dans le rendu, chaîne d'interface `"ESSAI T1 — TRAINS"` en défaut de paramètre, `interpolate` de complexité ≈ 27. `trainRide/trainRidePresentation.ts` : même style. Les autres (`ciel`, `lightPool`, `storeSign`, `useObjectCulling`) sont courts et propres. |

**Dépendances** : `render` importe 20 modules de `game` (types d'armes, `food.ts`, `loyaltyCards`, trains) et `app/runtime` (`warmTrainModel.ts`). La couche rendu devrait recevoir des données (interfaces locales ou types partagés dans un module neutre), pas importer les systèmes de jeu.

**Pistes** : rapatrier la création de corps/colliders des trains dans `game/level/trains` et ne laisser à `render` que le placement de meshes (M) ; module `shared/types` (armes, nourriture, cartes) importable par `core`, `render` et `game` (S–M) ; gravité unique (S).

### 4.5 `src/game/hud/` et `src/game/settings/` (354 + 443 lignes)

**`hud/` 🟢** — `state.ts` (zustand, 36 actions) est documenté champ par champ avec le contrat de fréquence (« jamais par image », invariant #2) ; `hudTypes.ts` est lisible. Défaut mineur : `GameState` est un gros store plat (une scission par domaine — débogage, dialogue du héros, campagne, flux — faciliterait les sélecteurs).

**`settings/` 🟠** — 5 modules qui font chacun leur propre lecture/écriture `localStorage` avec leur propre garde de type, alors que `campaignStorage` et `inputPersistence` utilisent Schema (§3.4). `graphicsSettings.ts` dépasse 120 caractères sur 11 lignes (libellés de présets en gabarits) et dépend de `render/pipeline/renderer` et de deux configs de gameplay. Pistes : helper `persisted(key, schema, défaut)` unique (M).

### 4.6 `src/game/loop/` (1 301 lignes, 6 fichiers) 🔴

**`updateGameplay.ts`** (660 lignes ; fonction de 494 lignes ; fan-out 36)
- Une seule fonction orchestre : entrée, mouvement, rattrapage de chute, interactions (≈ 60 lignes de table de rappels `onXxxUse` ×13), ramassages (munitions, armes, soins, nourriture), tir, Costards, Directeur, **trains, blockout, voyage en rame**, props, explosions, vitres, sanitaires, écrans, douches, panneau, portes, cartes, sortie, secrets, script de niveau, flux de chat.
- **Noms de contenu codés dans le moteur** : `useObject.name === "use_munitions_gaine_1"`, `amount >= 36 ? "munitions_36" : "munitions_24"` (`:342–343`), `name.slice("use_douche_".length)` (`:293`).
- **Répétition du motif « longueur avant / après »** (`xxxBefore = queue.length` … `queue.length - xxxBefore`) une douzaine de fois : fragile (un oubli décale tous les compteurs). Un `drain()` par file est plus sûr.
- **Soin dupliqué** (`:405–431` et `:436–448`).
- Mélange français/anglais dans les locales (§3.5), commentaires-journal (§3.7).
- Tout l'ensemble est enveloppé dans un `Effect.gen` de 12 `Effect.sync` (§3.10).

**`updateFx.ts`** (434 lignes ; fonction de 345) : même structure en blocs `Effect.sync` ; gestion d'événements Costard/Directeur dupliquée avec des `void event;` ; types de tranches à ~35 noms (`:78–86`) ; `trainGym` lu directement (`:109`) ; `trainConfig.soundWarning` global.

**`interpolateVisuals.ts`** : quatre appels `…presentation.interpolate(...)` pour des prototypes de trains (`:71–77`).

**Pistes** : transformer la boucle en **liste ordonnée de systèmes** (`{ name, fixedStep(ctx) }`) enregistrés par fonctionnalité — `inputSystem`, `movementSystem`, `interactionSystem`, `pickupSystem`, `combatSystem`, `breakablesSystem`, `trainSystem`, `scriptSystem`… — exécutés par **un seul** `runGameplaySync`. L'ordre actuel (commenté « même ordre qu'avant ») devient une liste lisible. Chaque système devient testable isolément (L, à faire par tranches ; commencer par extraire les ramassages et le soin).

### 4.7 `src/game/session/` (3 625 lignes, 37 fichiers) 🟠

| Fichier / sous-dossier | Verdict | Notes |
|---|---|---|
| `gameSession.ts` (170) | 🔴 | **63 champs** : état de partie, état de niveau (« reconstruit à chaque commit »), systèmes (`propSystem`, `doorSystem`, `vitreSystem`, `sanitaireSystem`, `ecranSystem`, `cameraView`), ramassages, héros, flux, statistiques, **et** prototypes (`trainGym`, `trainRideGym`) et état dev (`devCompleteRequested`, `devCampaignCommands`). Trois durées de vie mélangées (partie / niveau / frame). |
| `gameEngine.ts` (176) | 🟠 | 32 champs, `PersistentEngine = Omit<GameEngine,"session">` pour contourner un cycle ; 8 lignes > 120 caractères. |
| `lifecycle.ts` (294) | 🟠 | `buildGameSession` (181 lignes) enchaîne `if/else` par type de niveau (`gym`, `train-gym`, `train-ride-gym`, gltf) avec positions d'apparition et boîtes de navigation **en dur** (`lifecycle.ts:99–139, 232–250`) ; graines littérales (`:81–83`). `teardownGameSession` : exemplaire. |
| `spawning.ts` (363) | 🟠 | `loadGltfLevel`/`install` ≈ 180 lignes, fan-out 37, aucun test direct. |
| `campaign/` (≈ 150) | 🟢 | Schémas, version, échec de persistance signalé au joueur ; seul reproche : `flushCampaignSave()` est appelé **à chaque image** depuis `main.ts:151`, et le module écrit dans le store HUD. **Aucun test.** |
| `progression/` (≈ 700) | 🟢 | `score.ts`, `perks.ts`, `levelEvents.ts` : lisibles, partiellement testés — mais 3 des 5 tests rouges viennent d'ici (`perks`, `score`). |
| `presentation/`, `stream/`, `player/` | 🟢 (survol) | `heroLines.ts`, `streamTexts.ts` sont surtout de la donnée. |

**Pistes** : scinder `GameSession` en `RunState` (partie), `LevelState` (reconstruit à chaque chargement) et `Systems` ; sortir `trainGym` / `trainRideGym` / dev vers un mécanisme d'extension de niveau (`LevelKind` → `{ build(engine), teardown(), fixedStep, interpolate }`) ; `seeded(seed)` pour les 9 `forSeed` (L).

### 4.8 `src/game/entities/` (2 494 lignes, 18 fichiers) 🟠

**Va** : `shared/enemyMachine.ts` est la bonne abstraction (une machine à états pour tout le monde) ; `enemyPerception`, `enemyNavigation`, `enemyCombat`, `enemyPhysics` bien séparés ; `tuneEnemyConfig` neutre renvoie la config elle-même pour que le panneau de tuning agisse dessus ; graines par spawn (déterministes).

**Ne va pas**
- **Copier-coller Costard/Directeur** (§3.4) : gestionnaire (71 %), entité (81 %), config (63 %). `SuitManager` gère déjà trois espèces (`costard`, `rampant`, `vigile`) : le Directeur est le seul à avoir son propre manager.
- **Six files d'événements × 2 gestionnaires** avec getters un à un (`_alertEvents` + `get alertEvents()` …) et trois interfaces identiques `{ suit: Suit }`.
- `cheats.notarget` lu en production (`enemyCombat.ts:61,75`, `enemyMachine.ts:245,272,280`) : dépendance `entities → devtools`.
- `Entity` : `allocateEntityId()` utilise un compteur de module jamais remis à zéro entre parties (aucune graine n'en dérive aujourd'hui ; piège pour le rejeu si cela change).
- `enemySpawnConfig.ts` fait **une ligne** (`ENEMY_MATERIALIZATION_DURATION`), `rampantConfig.ts` / `vigileConfig.ts` ~50 lignes chacun : bien, mais le fait que `Suit` serve trois espèces sous un nom qui en désigne une est source d'erreur.
- `enemyMachine.ts` (409 lignes) n'a pas d'import direct par un test.

**Pistes** : `EnemyManager<TEnemy>` générique avec `EventQueue<T>` ; le Directeur devient une `kind: "director"` avec ses spécificités (révélation, carte lâchée) en extension ; renommer `Suit` → `Grunt`/`Enemy` (L, mais mécanique).

### 4.9 `src/game/player/` (1 867 lignes, 11 fichiers) 🟢 / 🟠

**Va** : `movement/controller.ts` et `moveConfig.ts` — de loin le meilleur code du dépôt : commentaires sur le *pourquoi*, fonctions pures, scratch, KCC Rapier.
**`weapons.ts` (629 lignes) 🟠** : `firePistol` et `fireShotgun` dupliquent le tirage de plomb (§3.4) ; quatre paires `sinceXFire` / `previousSinceXFire` (clocks courante/précédente) à la main — un petit `FireClock` ou un tableau indexé par arme les remplacerait ; `approach` importé de `controller.ts:12` ; commentaire-journal « Jalon M3 » (`:583`) ; lignes vides en double ×5 ; 21 `new THREE.Vector3` (la plupart pour des événements — acceptable, un événement garde son vecteur).
**Pistes** : `castPellet()` partagé (S) ; `core/math` pour `approach`/`clamp` (S).

### 4.10 `src/game/level/` (7 958 lignes, 54 fichiers) 🟠 / 🔴

| Sous-dossier | Lignes | Verdict | Notes |
|---|---|---|---|
| `loading/` | 2 444 | 🟠 | `loader.ts` : `buildLevelResourceEffect` (302 lignes) = routeur de préfixes en `if` successifs (`spawn_suit_`, `spawn_rampant_`, `spawn_vigile_`, `spawn_director_`, `light_`, `cam_`, …) avec trois blocs de spawn identiques à un champ près ; préfixes de trains codés en dur (`:100`) et `MetroBlockout` instancié ici (`:303`). `levelObjects.ts` : 444 lignes, 39 `new THREE.Vector3`, aucun test direct. `levelExtras.ts` : 13 `console.*`. Les diagnostics (`levelDiagnostics.ts`) sont typés (`TaggedError`) : bonne pratique. |
| `interactions/`, `sanitaires/` | 1 071 / 678 | 🟠 | Fusion de décor ×3 (§3.4) ; `interactive.ts:171` `dispatch` (85 lignes, 13 rappels). |
| `doors/` | 850 | 🟢 (survol) | Géométrie de charnière isolée (`doorGeometry.ts`) et testée. |
| `props/` | 527 | 🟢 (survol) | |
| `navigation/` | 627 | 🟢 | `navGraph.ts` à 88 % de commentaires (outil du projet) : candidat à migration vers `/docs`. A\* sans `decrease-key`, métriques isolées. 13 `!` dans `navSearch.ts`. Export mort : `isCellWalkable`. |
| `scripting/` | 130 | 🟢 | |
| `catalog/` | 711 | 🟠 | `gym.ts` (404 lignes, 29 lignes > 120) est un décor de test écrit à la main ; `levels.ts` : cf. §3.2 n° 12. |
| `trains/`, `trainRide/`, `blockout/` | 689 / 115 / 116 | 🔴 | Cf. §3.2. |

**Pistes** : un **registre de gestionnaires de préfixe** (`{ prefix, handle(obj, ctx) }`) enregistré par fonctionnalité — le loader ne connaît plus ni `train_` ni `n5_` ; `mergeBreakableDecor<T>()` unique (M) ; sortir les gyms de test du chemin de production (`import.meta.env.DEV` + chargement dynamique) (M).

### 4.11 `src/game/devtools/` (1 522 lignes, 11 fichiers) 🟠

- `consoleApi.ts` (585 lignes, **fan-out 52**, ligne max 523 caractères, 27 lignes > 120) : `exposeDebugApi` assemble un objet global de ≈ 250 lignes — nouvelle section « trains / voyageRame » en clés françaises (`etat`, `morts`, `traversées`). Il est protégé par `import.meta.env.DEV` (`main.ts:177`) : pas un risque production, mais difficile à maintenir et à typer (un type global parallèle est déclaré plus bas).
- `cheats.ts` : trois lignes utiles ; à déplacer côté `entities/shared` (drapeau d'override) pour casser la dépendance.
- `economy/` (économie simulée, `economySim.ts` 255 lignes, `simulateRun` complexité ≈ 32) : outillage soigné mais 2 exports morts (`simulateCampaign`, `ECONOMY_BEFORE`).
- `replay/testHarness.ts` : 9 `console.*`, `performance.now()`, aucun test direct.

**Pistes** : découper `consoleApi` en modules par domaine qui s'enregistrent (`registerDebug("trains", …)`) (M).

### 4.12 `src/ui/` (3 333 lignes TS + 2 010 lignes CSS, 97 fichiers) 🟢

**C'est la partie la plus conforme.** Résumé de la conformité aux règles écrites : §6. Détails :

- 🟢 Structure : dossier par composant (100 %), `.tsx` + `.module.css` voisins, familles par rôle, aucun barrel.
- 🟢 Plus long composant de production : 99 lignes (`DisplayTab.tsx`) ; plus long CSS : 124 lignes (`RecapTable`).
- 🟢 `useMemo` / `useCallback` / `memo` : 0 ; `useEffectEvent` : 7 ; `useSyncExternalStore` : 2 ; aucun `setState` par frame ; un seul minuteur (`useLoadingStatus.ts:23`, avec nettoyage).
- 🟢 Chaque widget du HUD lit ses propres données (`StreamChat`, etc.) ; sélecteurs primitifs.
- 🟢 Jetons : 108 usages de jetons sémantiques, 37 de la palette ; **aucune** valeur de palette réécrite en dur dans un module (les 10 couleurs de `tokens.css` : 0 occurrence ailleurs).
- 🟠 Écarts : voir §6 (4 points).
- 🟠 **70 `rgba(…)` en dur** hors thème/dev, dont des variantes d'alpha du vert phosphore répétées (`rgba(120,255,140,0.04)` ×3, `rgba(140,255,150,0.2/0.3/0.4)`…) : tokeniser les niveaux d'alpha (ou `color-mix`) éviterait la dérive de teinte.
- 🟠 `hud/` : 16 valeurs en `px` (probablement des filets de 1 px) au lieu de `--vpx` — à vérifier au cas par cas.
- 🟠 Pas de test pour la plupart des écrans (`ui/hud` 7 %, `ui/dev` 0 %).
- 🟠 Textes joueur en dur dans les `.tsx` (pas de couche de traduction — acceptable pour un jeu mono-langue ; à noter si le français n'est pas définitif).
- 🟠 `ui/dev` (32 fichiers) importe de nombreux modules internes de `game` : légitime derrière `import.meta.env.DEV`, mais couple les panneaux à des chemins de fichiers qui bougent (métro).

### 4.13 `src/main.ts` (180 lignes) 🟠

- `main()` : 132 lignes, 33 imports ; sait tout (audio, physique, sprites, moteur, flux, session, boucle, dev). Porte aussi la logique de **vue caméra** dans la fermeture `render()` (`:154–174`) : échange de la pose de caméra puis restauration en `finally` — à extraire en `renderFrame(engine)`.
- `getElementById(...) as HTMLCanvasElement` sans test (`:48–49`) ; `main();` sans `.catch` (`:180`).
- `currentLevelId` : fermeture mutable réassignée plus bas (`:62`, `:132`).
- `flowActor.subscribe(...)` : pont XState → zustand correct.

---

## 5. Conformité aux invariants de `CLAUDE.md`

| # | Invariant | Verdict | Preuve / réserve |
|---|---|---|---|
| 1 | Pas fixe 1/60, delta clampé 0,25 | 🟢 | `core/loop/loop.ts:4,5,41` |
| 2 | React ne touche jamais la boucle ; HUD ≤ 10 Hz | 🟢 | aucun `setState` par frame ; `debugAccumulator` ; 36 setters ponctuels documentés |
| 3 | Rotation caméra non interpolée | 🟢 | `interpolateVisuals.ts:46` |
| 4 | 640×360, `NearestFilter` à l'agrandissement | 🟢 / 🟠 | `renderer.ts:magFilter = NearestFilter` ; défaut `"aniso"` = amendement ADR 0027 appliqué avant sa validation |
| 5 | *(retiré)* | – | |
| 6 | KCC de Rapier | 🟢 | `physics/world.ts`, `controller.ts`, `suitManager.ts` |
| 7 | Gravité −25 | 🟠 | exacte dans `physics/world.ts:86`, mais redéclarée 3 fois dans `render/fx/` |
| 8 | Pas d'ECS | 🟢 | |
| 9 | *(retiré)* | – | |
| 10 | Aucune animation ne bloque le joueur | ⚪ | non audité (nécessite d'exécuter le jeu) |
| 11 | Frontière Effect synchrone stricte | 🟢 | aucun `tryPromise/promise/async/sleep` hors loader/hot-reload ; réserve : usage « décoratif » d'`Effect.sync` (§3.10) |
| 12 | RNG déterministe | 🟢 | aucun `Math.random` ; réserves : graines littérales (`lifecycle.ts:81–83`), compteur d'ID de module non remis à zéro |
| 13 | *(retiré)* | – | |

---

## 6. Conformité aux conventions React (`docs/6-reference/react-*.md`)

| Règle | Verdict | Détail |
|---|---|---|
| Un dossier par composant | 🟢 | 100 % ; 17 `.tsx` sans `.module.css` (composition ou conteneur sans style : `App`, `Hud`, `StoryScreen`, sections de tuning) — conforme |
| Pas de `<style>`, pas de style inline hors `cssVars()` | 🟢 | 0 occurrence |
| Pas d'export par défaut / `forwardRef` / `React.FC` / `defaultProps` | 🟢 | 0 |
| Pas de barrel | 🟢 | 0 |
| Pas de `setState` par frame, pas de rAF dans un composant | 🟢 | |
| Une primitive de `components/` ne lit ni le store ni `game/` | 🟠 | `components/layout/RecapTable/RecapTable.tsx:1` importe `LevelRecap` de `game/hud/hudTypes` (type seul). Déplacer le type dans `ui/lib` ou passer le contrat par props génériques. |
| Un écran ne connaît pas un autre écran | 🟠 | `screens/pause/PauseScreen/PauseScreen.tsx:12` importe `OptionsScreen` |
| « Réinitialiser un état quand une prop change — c'est une `key`, pas un effet » | 🟠 | `PauseScreen.tsx:25–27` : `useEffect(() => { if (flowState === "paused") setPane("menu"); }, [flowState])` |
| Pas de dossier fantôme | 🟠 | `ui/components/RecapTable/` est un **dossier vide** (le composant vit dans `components/layout/RecapTable/`) |
| Pas de jargon interne dans le texte joueur | 🟠 | `DisplayTab.tsx:39,52` : « (invariant #4) » |
| Aucune couleur de palette en dur | 🟢 | 0 occurrence ; 70 `rgba` d'alpha à tokeniser (§4.12) |
| `dev/` jamais sans garde `import.meta.env.DEV` | 🟢 | `App.tsx`, `bootChoice.ts` gardés |

---

## 7. Harmonisation : règles à écrire une fois pour toutes

À consigner dans un document de référence (`docs/6-reference/conventions-code.md`) **et** à faire appliquer par l'outillage (§8, action 2).

| Sujet | Règle proposée | Pourquoi |
|---|---|---|
| Langue | Identifiants de code en **anglais** ; **français** pour le texte joueur et pour une liste fermée de termes du contrat Blender / du domaine (`vitre`, `sanitaire`, `ecran`, `matiere`, `givre`, `voie`, `trajet`, `porte`, `prop`) ; variables locales en anglais | Aujourd'hui les deux cohabitent dans la même fonction |
| Import de types | `import type { … }` uniquement ; activer `verbatimModuleSyntax` | 317 vs 145 formes mixtes |
| Décimaux | `0.35`, jamais `.35` | 123 occurrences |
| Instructions | Une par ligne ; largeur 120 ; fin de fichier + sauts normalisés | 135 lignes multi-instructions, 420 lignes longues |
| Constantes | Toute valeur partagée (gravité, graines, timeouts, seuils de gabarit) = constante nommée à **un** endroit | Gravité ×4, timeout ×4, graines littérales |
| `catch` | Jamais vide sans commentaire ; message préfixé `[zone]` via un petit `warn(zone, msg)` | 3 `catch {}` nus |
| Erreurs | Chargement/validation de niveau : erreurs typées (`TaggedError`) partout, pas de `throw new Error` ; messages en gabarits, pas en concaténation | `readTrainLevel` vs `auditTrainSafety` |
| Commentaires | Pas de jalons, pas de renvoi à un plan supprimé ni à « le skill » ; le *pourquoi* en une à trois lignes, le reste dans `/docs` + ancre `// see:` | 11 références « skill », 11 « Jalon » |
| Événements d'entités | `EventQueue<T>` générique (`push`, `drain`, `clear`, lecture seule) | 12 files écrites à la main |
| Persistance | `persisted(key, schema, défaut)` pour tout `localStorage` | 7 modules, 2 styles |
| Types dérivés | `SfxId = keyof typeof SFX_TABLE`, `GameAction = keyof typeof DEFAULT_BINDINGS`, etc. | Doubles maintenances |
| Tranches de session | Interfaces `Pick<>` nommées et partagées, ou injection de dépendances explicites | `FxSession`, `FxEngine` |
| Fichiers | Nom = contenu (`time.ts` → `gameClock.ts`) | |
| Couches | Interdits vérifiés par l'outil : `core ↛ game/render/physics/app/ui`, `physics ↛ game`, `render ↛ game/app` (types partagés dans un module neutre), `game ↛ app`, `ui ↛` internes de `game` hors `hud/state` et `settings` (hors `dev/`) | §3.1 |
| Tests | Tout nouveau système de simulation arrive avec son test de plus bas niveau ; une PR rouge ne se fusionne pas | §3.8 |

---

## 8. Plan d'action priorisé

### P0 — à faire avant le prochain lot (≈ 2–3 jours au total)

| # | Action | Effort | Détail |
|---|---|---|---|
| 1 | **Remettre les tests au vert** | S | Mettre à jour les 5 tests (ou corriger le code s'ils signalent une régression : `usePerkKiosk` « épuisée » et `perkOffer.sold` sont à examiner avant de « corriger le test »). |
| 2 | **Outillage** | M | Formateur (Prettier ou Biome), linter (ESLint + `typescript-eslint` ou Biome/oxlint) avec `consistent-type-imports`, `no-non-null-assertion` (en avertissement), `max-lines-per-function` (avertissement à 120), `import/no-cycle` ; **règles de couches** (`dependency-cruiser` ou `eslint-plugin-boundaries`) selon §7 ; ajouter ces commandes à `pnpm check`. Commencer en *avertissement* avec un fichier de base (« baseline ») pour ne pas bloquer le travail courant, puis resserrer. Activer `noUncheckedIndexedAccess` et `noFallthroughCasesInSwitch`. |
| 3 | **Tests du code métro** | M | `trainTouchesActor` (cas : rame qui traverse un joueur immobile, joueur qui traverse la voie entre deux pas, rame en virage), `TrainSystem` (arrivée, arrêt/cooldown, aiguillage, `singlePass`), `TrainRideSystem` (phases, distance continue en `u=1`), `readTrainLevel` (chaque `invalid`), `campaignStorage` (aller-retour, version, entrée corrompue, échec d'écriture). |
| 4 | **Rattraper le style du code métro** | S | Une fois le formateur en place, un seul passage `format` sur les fichiers métro + constantes nommées pour les nombres magiques de §3.2 n° 7. |

### P1 — structure (≈ 2 semaines, à étaler)

| # | Action | Effort |
|---|---|---|
| 5 | **Point d'extension par type de niveau** (`LevelKind`) : sortir `trainGym`, `trainRideGym`, gyms de test, `MetroBlockout`, chaînes `if` de `lifecycle` / `loader` / `interpolateVisuals` / `updateFx` ; renommer/retirer l'entrée de production `"metro"` → `metro_blockout`. | L |
| 6 | **Découper `updateGameplay` puis `updateFx`** en systèmes nommés dans un tableau ordonné ; commencer par les ramassages/soins (dupliqués), puis le tir et les événements d'ennemis ; un seul `runGameplaySync` par pas. | M–L |
| 7 | **Dédupliquer Costard/Directeur** : `EnemyManager<T>` + `EventQueue<T>`. | L |
| 8 | **`mergeBreakableDecor<T>()` unique** pour décor / vitres / sanitaires / écrans. | M |
| 9 | **Scinder `GameSession`** (`RunState` / `LevelState` / `Systems`) et supprimer `PersistentEngine`. | L |
| 10 | **Rendre `render` sans physique ni logique de pas fixe** : déplacer la création de corps de `trainPresentation` côté `game`. | M |

### P2 — hygiène et cohérence (au fil de l'eau)

| # | Action | Effort |
|---|---|---|
| 11 | Source unique de la gravité, des graines, des timeouts (`physics/constants.ts`, `core/effect/seeds.ts`, `core/net/timeouts.ts`) | S |
| 12 | Convention de langue + renommages mécaniques | M |
| 13 | `fetchJson` + `LoopedAmbience` + `SfxId` dérivé (audio) | S–M |
| 14 | `persisted()` pour toutes les préférences | M |
| 15 | Supprimer le code mort : 9 exports (`audioManifest` ×2 types, `economySim::simulateCampaign`, `economyVariants::ECONOMY_BEFORE`, `navGraph::isCellWalkable`, `moveConfig::capsuleTotalHeight`, `levelEvents::LevelEventId`, `renderer::filtrageCourant`, `textureRegistry::registerMaterialTextureInputs`), les états morts de `gameFlowMachine` (+ leur test), `ui/components/RecapTable/` vide ; retirer l'`export` de 140 symboles utilisés seulement localement | S |
| 16 | Corriger les 4 écarts React (§6) et le texte « invariant #4 » | S |
| 17 | `catch` globaux : `main().catch(…)`, `window.addEventListener("error"/"unhandledrejection")`, `ErrorBoundary` racine avec écran de secours | S |
| 18 | Commentaires : retirer jalons/renvois à des plans ou skills supprimés ; migrer les 86 blocs longs vers `/docs` (le dépôt a déjà l'outil) | M |
| 19 | Mesurer (`pnpm probe`, profil Chrome) : coût d'`Effect.sync` en rafale, `runSync` par rayon, allocations d'A\* — **décider avec des chiffres** | S |
| 20 | Décider du sort de `?level=` en production | S |

### Garde-fous pour que la qualité ne rechute pas

1. Le formateur/linter/couches **dans** `pnpm check` (donc dans la CI).
2. Un seuil de « baseline » : le nombre d'avertissements (fonctions longues, `!`, cycles) ne peut pas augmenter.
3. Règle d'équipe : tout lot qui ajoute un système de simulation arrive avec son test et sa ligne dans le tableau de conventions Blender.
4. Revue d'agent : le prompt des sous-agents (`level-pipeline`, `entity-designer`, `shell`…) doit citer `conventions-code.md`, comme c'est déjà le cas pour les conventions React — c'est ce qui explique que `ui/` soit propre et que le métro ne le soit pas.

---

## Annexe A — Exports jamais utilisés (morts)

| Fichier | Symbole |
|---|---|
| `core/audio/audioManifest.ts` | `type AudioSpriteManifestData`, `type ZoneAmbienceManifestData` |
| `game/devtools/economy/economySim.ts` | `simulateCampaign` |
| `game/devtools/economy/economyVariants.ts` | `ECONOMY_BEFORE` |
| `game/level/navigation/navGraph.ts` | `isCellWalkable` |
| `game/player/movement/moveConfig.ts` | `capsuleTotalHeight` |
| `game/session/progression/levelEvents.ts` | `type LevelEventId` |
| `render/pipeline/renderer.ts` | `filtrageCourant` |
| `render/pipeline/textureRegistry.ts` | `registerMaterialTextureInputs` |

Fichiers avec le plus d'exports « superflus » (utilisés seulement dans leur propre fichier) : `directorManager.ts` 7 · `suitManager.ts` 6 · `sanitaires.ts` 4 · `weaponConfig.ts` 4.

## Annexe B — Fichiers à surveiller par taille

`updateGameplay.ts` 660 · `weapons.ts` 629 · `consoleApi.ts` 585 · `props.ts` 478 · `loader.ts` 475 · `levelObjects.ts` 444 · `sanitaires.ts` 436 · `updateFx.ts` 434 · `enemyMachine.ts` 409 · `gym.ts` 404 · `weaponConfig.ts` 403 · `controller.ts` 377 · `doors.ts` 374 · `spawning.ts` 363.

## Annexe C — Mesures reproductibles

Les scripts utilisés (graphe d'imports et cycles, exports morts, métriques de style, longueur de fonctions, rapprochement tests/sources, fan-in/fan-out) sont dans le scratchpad de la session, hors dépôt. Ils peuvent être versés dans `tools/audit/` pour produire cette photographie à chaque jalon et la comparer (nombre de cycles, de fonctions > 100 lignes, de lignes > 120, d'exports morts) ; c'est la base naturelle d'une « baseline » pour la CI (§8, action 2).

---

## Suite donnée (2026-10-08) — outillage en place

L'action 2 du plan (§8) est faite : **Oxlint 1.87.0** (avec `oxlint-tsgolint`, lint typé) et **Oxfmt 0.72.0**, versions épinglées. Config : `.oxlintrc.json` et `.oxfmtrc.json` ; scripts `pnpm lint`, `lint:fix`, `format`, `format:check` ; `pnpm check` et `pnpm verify` incluent le lint. Principe : `error` = garde-fou propre aujourd'hui, `warn` = dette plafonnée par `options.maxWarnings` (694 au départ). Le §3.9 ci-dessus décrit l'état *avant* cette mise en place.
