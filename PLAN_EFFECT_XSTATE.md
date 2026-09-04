# PLAN — Fondations Effect-TS + XState (`PROJET_CASSANDRE`)

> Chantier d'architecture, pas de contenu. Le proto (Phases 0-6) est livré et validé humainement ("Franchement c'est fun"). L'objectif ici n'est pas d'ajouter du gameplay mais de **remplacer les patterns faits main** (validation ad hoc, duplication assumée, évitement local, flow d'écran par rechargement de page) par une base typée, testable et réutilisable pour la suite du développement (plus de types d'ennemis, plus de niveaux).

---

## 0. Cadrage

### Décisions actées (issues des échanges du 2026-08-31)

| Question | Décision |
|---|---|
| Moteur du chantier | Erreurs typées **+** testabilité **+** dédup Suit/Director **+** flow d'écran — les quatre à la fois |
| Frontière Effect | **Aucune** — Effect orchestre toute la boucle jeu : gameplay, raycasting, pathfinding, **et le rendu** |
| Risque de perf (coût `Effect.gen`/`runSync` à 60 Hz) | **Assumé** — pas de spike de perf dédié, on avance et on ajuste si un problème apparaît en jeu |
| `loader.ts` / `hotReload.ts` | **Retrofit complet** vers Effect, pas seulement le code neuf |
| Pathfinding | **Vrai système construit maintenant** (il n'en existe aucun aujourd'hui — juste 3 rayons d'évitement local), pas juste une interface de façade |
| Suit / Director | **Dédupliqués maintenant** via une machine XState partagée — revient sur la décision "duplication assumée" documentée dans `CLAUDE.md` |
| Forme du plan | Un seul plan, jalons ordonnés, chacun mergeable et vérifiable indépendamment |

### Registre de risques assumés explicitement

Ce chantier va délibérément à l'encontre de plusieurs habitudes du projet (`CLAUDE.md` invariant #9 : *"pas d'abstraction avant que la douleur soit réelle"*, et la note explicite sur Suit/Director : *"douleur pas encore réelle"*). Ce n'est pas un oubli — c'est un choix produit assumé par l'utilisateur, noté ici pour que personne ne le redécouvre par surprise plus tard :

1. **Perf non mesurée à l'avance.** `Effect.gen`/`Runtime.runSync` alloue un générateur/une fibre par appel. À 60 Hz avec plusieurs entités, plusieurs rayons (armes + vision + pathfinding) et maintenant le rendu lui-même dans l'arbre Effect, le coût cumulé est inconnu. Le jalon M6/M7 ajoute un instrumenting minimal (compteur de temps par phase dans `DebugPanel`) pour que toute dégradation soit visible **immédiatement** en jeu plutôt que découverte tard — mais aucun budget n'est fixé à l'avance, conformément au choix "on ajustera si besoin".
2. **Comportement de duplication Suit/Director abandonné.** La note de `CLAUDE.md` documentant la duplication comme choix délibéré devient obsolète après M5 — à retirer/mettre à jour (voir jalon M9).
3. **Rendu enveloppé dans Effect.** Le rendu Three.js et l'interpolation (`interpolateVisuals`) passent par des services Effect. Le seul point non négociable préservé explicitement : la **lecture de la rotation caméra reste un accès brut, sans indirection de service**, pour ne pas réintroduire de latence de visée (invariant #3). C'est une exception documentée, pas un oubli — voir M7.
4. **Un vrai pathfinding est une fonctionnalité nouvelle**, pas seulement une préparation de terrain. Il change le comportement des ennemis (ils pourront désormais suivre un chemin réel, y compris dans les escaliers de la Zone D où c'était explicitement évité jusqu'ici). Aucune zone existante n'est retouchée par ce chantier — l'usage level-design de cette nouvelle capacité (ex. placer des ennemis sur la mezzanine) reste une décision séparée, hors scope ici.

### Hors scope (explicitement)

Nouveaux types d'ennemis · nouveaux niveaux · pathfinding 3D complet (navmesh volumétrique) — un graphe de praticabilité 2.5D suffit à la géométrie actuelle (zones à plat + un escalier) · migration de l'outillage Blender (`tools/blender/*.py`, Python, hors sujet TypeScript) · réseau/multijoueur · sauvegarde de partie (peut réutiliser les patterns Effect posés ici plus tard, mais n'est pas construite maintenant).

---

## 1. Principes transverses (valables sur TOUS les jalons)

Ces règles priment sur toute commodité locale. Toute dérogation doit être documentée en commentaire à l'endroit précis, comme le fait déjà le reste du projet pour ses exceptions (`use_crowbar`, grille 0.25m, etc.).

1. **Deux modes d'exécution Effect, jamais mélangés :**
   - **Synchrone strict** (`Runtime.runSync`) pour tout ce qui vit dans le pas fixe ou dans la boucle d'affichage (gameplay, raycasting, pathfinding, rendu, interpolation). **Zéro** `Effect.tryPromise`/`Effect.promise`/`Effect.async`/`Effect.sleep` dans ces arbres — s'il en apparaît un, `runSync` lève un defect. Le jalon M1 pose un garde-fou qui transforme ce defect en erreur console explicite et actionnable plutôt qu'un crash muet (cohérent avec "on ajustera si besoin" : l'échec doit être bruyant, pas silencieux).
   - **Asynchrone à la frontière** (`Runtime.runFork`/`Runtime.runPromise`) réservé au chargement de niveau, au hot-reload, et à tout futur I/O (config, sauvegarde). Ces effets tournent **en dehors** du pas fixe, exactement comme aujourd'hui (`loadLevel`/`hotReload` ne sont jamais appelés depuis `updateGameplay`).
2. **Aucun hasard non déterministe.** Ni `Math.random()`, ni le service `Random` par défaut d'Effect. Un seul `DeterministicRandomService` (Context.Tag), qui enveloppe le PRNG mulberry32 déjà utilisé (`weapons.ts`, `suit.ts`, `director.ts`), fourni par une seule `Layer` construite au boot. Contrainte dure : le rejeu d'input (F9/F10, `core/inputRecorder.ts`) dépend de cette continuité — toute régression ici casse silencieusement une fonctionnalité déjà validée.
3. **XState sans temps mural.** Interdiction d'utiliser les transitions retardées `after` (basées sur `setTimeout` réel). Toute durée d'état (`alertDuration`, `attackTelegraphDuration`, `staggerDuration`, `lostContactTimeout`) reste un `stateTimer` dans le `context` de la machine, décrémenté manuellement par un évènement `TICK` envoyé une fois par pas fixe avec le `gameplayDt` réel (celui qui inclut le hitstop — `GameClock.tick()`). Sinon, le hitstop ne ralentirait plus les ennemis, régression invisible mais réelle.
4. **Comportement observable préservé sauf mention contraire explicite.** Le retrofit de `loader.ts` (M2) doit reproduire à l'identique chaque cas de "validate-and-continue" déjà documenté (liste complète en M2) — Effect apporte de la visibilité de compilation sur ces chemins d'erreur, pas un changement de comportement en jeu. Si un comportement doit changer, ce doit être une décision explicite notée dans l'acceptance du jalon, pas un effet de bord de la migration.
5. **Recherche avant implémentation, comme l'exige le skill `effect-ts` (version actuelle du skill, revue le 2026-08-31).** Le skill a changé de forme depuis la rédaction initiale de ce plan : plus de checkout vendoré ni de guides locaux (`references/*.md` supprimés) — la source de vérité devient `node_modules/effect/AGENTS.md` (une fois `effect` installé, voir M0) et, pour le détail d'API, `node_modules/effect/src` directement. Chaque jalon qui touche services/layers/erreurs/schedule/test doit lire `node_modules/effect/AGENTS.md` **en entier** (et suivre ses liens internes si besoin) avant d'écrire du code — ce plan ne réinvente pas les patterns Effect, il localise où aller les chercher.
6. **Un jalon = un commit (ou une petite série), buildable et vérifiable seul.** `pnpm build` propre + tests Vitest verts + vérification en jeu (capture/console) avant de passer au jalon suivant. Le blast radius de ce chantier est grand (il touche quasiment tout `src/core` et `src/game`) ; ne pas empiler plusieurs jalons dans un seul changement non testé.

---

## 2. Jalon M0 — Bootstrap (dépendances + prérequis du skill)

> **✅ Livré (2026-08-31).** `effect@4.0.0-rc.112` était déjà installé (par l'utilisateur, avant ce jalon). Ajoutés : `xstate@5.32.6`, `vitest@4.1.11`, `@effect/vitest@4.0.0-rc.112` (même canal `rc` que `effect`, confirmé aligné). `node_modules/effect/AGENTS.md` lu en entier — confirme `Context.Service` (pas `Context.Tag`, terminologie Effect 4) comme façon standard de définir un service, `Schema.TaggedError` pour les erreurs, `ManagedRuntime` pour le pont vers du code non-Effect (exactement le rôle prévu pour `GameRuntime` en M1), et `@effect/vitest`/`it.effect` confirmé comme pattern de test. Section "Learning more about Effect" ajoutée dans `CLAUDE.md`. `vitest.config.ts` (environnement `node`) + `test/bootstrap.test.ts` (smoke test `it.effect`, à retirer une fois M1 apporte de vrais tests) + scripts `pnpm test`/`pnpm test:watch` + `test`/`vitest.config.ts` ajoutés à l'`include` de `tsconfig.json`. `pnpm build` et `pnpm test` vérifiés verts.
>
> **Note terminologique pour M1+** : partout où ce plan dit `Context.Tag`, lire `Context.Service` (idiome Effect 4 confirmé par `AGENTS.md`) — le plan a été écrit avant l'installation réelle de la version `rc` et employait encore le vocabulaire Effect 3.

**Objectif.** Installer Effect et XState, et poser la référence de recherche que tous les jalons suivants doivent lire avant d'écrire du code — sans écrire de logique métier.

**Actions** (skill `effect-ts` revu le 2026-08-31 — plus léger que la version consultée à l'écriture initiale de ce plan : plus de checkout vendoré `.repos/effect`, plus de guides locaux, seulement deux étapes) :
1. `pnpm add effect@rc` à la racine (pas `effect@beta` — le skill actuel pointe vers le tag `rc`). Ce projet n'étant pas un monorepo, l'installer en dépendance normale suffit (le skill ne demande le `-D` racine que pour un monorepo qui veut exposer `node_modules/effect/src` à tous les paquets — ici il n'y a qu'un seul paquet).
2. Mettre à jour `CLAUDE.md` avec la section exacte exigée par le skill :
   ```md
   # Learning more about Effect

   This repository uses the Effect Typescript library.

   Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
   **completely**, and follow the links in the file when required.

   If you need to learn more about particular Effect apis and concepts that the
   guide doesn't cover, search through the source code in `node_modules/effect/src`.
   ```
   C'est désormais la seule source de vérité Effect pour ce projet — tous les "Recherche requise" des jalons suivants pointent vers ce fichier plutôt que vers d'anciens guides locaux.
3. Installer `xstate` (v5, dernière stable). Ne PAS installer `@xstate/react` — le pont vers React reste zustand (invariant #2, voir M8).
4. Installer `vitest` (dernière stable) et ajouter les scripts `pnpm test` / `pnpm test:watch`. Le skill ne prescrit plus de package de test Effect dédié (l'ancien `@effect/vitest` a disparu de ses recommandations) — lire `node_modules/effect/AGENTS.md` une fois installé pour vérifier s'il recommande un package de test spécifique pour le tag `rc` ; sinon, tester directement avec `Effect.runPromise`/`Effect.runSync` dans des tests Vitest nus, sans dépendance supplémentaire.
5. Garder `pnpm build` inchangé (`tsc --noEmit && vite build`).
6. Un test Vitest trivial (`1 + 1`) pour prouver que la chaîne CI locale tourne avant d'investir dans quoi que ce soit d'autre.

**Critères d'acceptation.**
- `pnpm install` propre, `effect`/`xstate`/`vitest` présents dans `package.json` avec les versions ci-dessus.
- `node_modules/effect/AGENTS.md` existe et a été lu en entier au moins une fois avant M1.
- `CLAUDE.md` contient la section "Learning more about Effect" exacte du skill.
- `pnpm build` toujours vert (aucune régression — ce jalon n'importe encore rien dans `src/`).
- `pnpm test` exécute et passe le test trivial.

---

## 3. Jalon M1 — Fondations déterministes + `GameRuntime`

> **✅ Livré (2026-08-31).** `src/core/random.ts` (`DeterministicRandom`, `Context.Service` — pas `Context.Tag`, voir la note terminologique de M0) et `src/core/runtime.ts` (`GameLayer`, `GameRuntime` via `ManagedRuntime.make`, `runGameplaySync`). Correction de conception faite avant d'écrire le code, en relisant `weapons.ts`/`suitManager.ts`/`directorManager.ts` : le PRNG actuel n'est PAS un flux partagé — `weapons.ts` a une instance unique (`SHOTGUN_SPREAD_SEED`), `SuitManager`/`DirectorManager` dérivent une graine PAR ENTITÉ spawnée (`BASE_SUIT_SEED`/`BASE_DIRECTOR_SEED` + compteur × `SEED_STRIDE`), et le commentaire source dit explicitement "jamais partagée". `DeterministicRandom` expose donc une **fabrique** (`forSeed(seed): () => number`), pas un flux unique — le service est injectable (testable), mais chaque `next()` reste un appel synchrone brut, zéro coût Effect par appel (le jitter de visée et la dispersion de tir en appellent plusieurs fois par pas fixe). Le garde-fou `runGameplaySync` détecte concrètement `Cause.AsyncFiberError` (vérifié dans `node_modules/effect/src/internal/effect.ts` — c'est ce qu'`Effect.runSync` lève réellement si l'effect suspend) et logue le message explicite avant de relancer.
>
> Tests de non-régression : la séquence de `DeterministicRandom.forSeed` a été comparée à des valeurs de référence calculées en exécutant l'algorithme de production réel (pas recopiées à la main) pour `SHOTGUN_SPREAD_SEED` et les deux premières graines dérivées de Suit/Director ; un test dédié prouve que deux générateurs indépendants ne s'entrelacent jamais. `pnpm build`/`pnpm test` verts (7/7), rien touché dans `main.ts`/`weapons.ts`/`suit.ts`/`director.ts` — leur migration reste prévue pour M6.

**Objectif.** Poser la racine de composition Effect et le service PRNG déterministe, avec un filet de sécurité "jamais async" testé.

**Recherche requise.** `node_modules/effect/AGENTS.md`, sections runtime/provisioning et services/`Context.Tag`/`Layer` ; suivre ses liens internes. Pour le détail exact des signatures, `node_modules/effect/src`.

**Conception.**
- `src/core/runtime.ts` (nouveau) : une seule `Layer` racine (`GameLayer`), assemblée au boot, exposant au minimum le service `DeterministicRandom` dans cette étape (les autres services rejoignent la layer au fil des jalons suivants — M2 à M4). Un `ManagedRuntime` unique (`GameRuntime`), construit une fois dans `main.ts`, jamais recréé pendant la partie.
- `DeterministicRandom` (`Context.Tag`) : mêmes méthodes que le PRNG mulberry32 actuel (`next()`, `range()`, etc. — signature exacte à reprendre depuis `weapons.ts`/`suit.ts`), implémentation = wrapper direct de l'algorithme existant, **pas une réécriture** — le but est de centraliser l'usage, pas de changer la séquence produite (test de régression obligatoire : même seed → même sortie, comparée byte-à-byte à l'implémentation actuelle).
- Garde-fou "jamais async" : un petit wrapper `runGameplaySync(effect)` autour de `Runtime.runSync` qui, en cas de defect de suspension, produit un `console.error` explicite ("un Effect gameplay a tenté de suspendre — vérifier qu'aucun Effect.tryPromise/async n'a été introduit dans cet arbre") avant de relancer. Utilisé par tous les jalons suivants qui exécutent du code dans le pas fixe.

**Tests Vitest.**
- `DeterministicRandom` : séquence identique à l'implémentation actuelle pour un même seed (non-régression du rejeu d'input).
- `runGameplaySync` : un effet purement synchrone passe ; un effet contenant un `Effect.tryPromise` déclenche bien le message d'erreur explicite (test qui vérifie le garde-fou lui-même, pas juste le cas nominal).

**Critères d'acceptation.** `pnpm build` vert, tests verts, aucun changement de comportement en jeu (rien n'est encore branché dans `main.ts`).

---

## 4. Jalon M2 — Retrofit complet `loader.ts` / `hotReload.ts`

> **✅ Livré (2026-08-31).** Les 7 cas de dégradation sont modélisés en
> `Schema.TaggedError` (`MissingColliderGeometryError`, `OversizedColliderWarning`,
> `MissingSpawnPlayerError`, `DuplicateSpawnPlayerError`, `NonBoxTriggerError`,
> `UntargetedUseObjectWarning`, `DegenerateConvexHullError`, + `LevelFetchError`
> pour l'échec réseau de `loadLevel`). **Patron warning-vs-échec retenu :
> un seul et même patron pour les 7 cas** — chacun est un `Effect.fail`
> (ou `return yield* new XError(...)`) immédiatement rattrapé via
> `Effect.catch`/`Effect.catchTags` AU POINT MÊME de sa détection, jamais
> laissé remonter plus haut. Conséquence assumée et documentée dans le
> fichier : le type d'erreur réel de `buildLevelFromGltf`/
> `buildLevelFromGltfEffect` est `never` (aucun des 7 cas n'est bloquant,
> exactement comme avant ce jalon) — les classes existent pour la
> vérification de compilation et la testabilité en isolation, pas parce
> qu'elles se propagent réellement. Seule vraie erreur qui traverse une
> frontière publique : `LevelFetchError` sur `loadLevel` (jamais un
> "warning", ce chemin a toujours propagé son échec).
> **Cycle de vie** : `Effect.acquireRelease`/`Scope` remplacent le flag
> `disposed` manuel — un `Scope.Closeable` créé manuellement par
> `buildLevelFromGltfEffect`/`loadLevelEffect` (PAS `Effect.scoped`, qui
> fermerait — donc libérerait — le niveau immédiatement après sa
> construction), fermé explicitement par `LevelHandle.dispose()`.
> Idempotence de `dispose()` garantie par `Scope.close` lui-même
> (`scopeCloseUnsafe` no-op si déjà `"Closed"`), plus besoin de dupliquer
> cette garantie à la main.
> **Mutex de rechargement** : le plan suggérait un `Effect.Semaphore(1)`
> "autour de `performLoad`" — un Semaphore seul SÉRIALISE des appels
> concurrents (chacun finit par déclencher un vrai rechargement) plutôt que
> de les COALESCER (un seul rechargement réseau pour N appels concurrents),
> qui est la garantie réellement attendue par le critère d'acceptation. Les
> deux mécanismes sont donc conservés : la garde JS `reloadInFlight`
> (inchangée, déjà correcte en JS mono-thread) assure le coalescing
> observable ; le `Semaphore(1)` enveloppe `performLoadEffect` en plus,
> comme garde-fou structurel documenté (ceinture et bretelles) — voir la
> doc de tête de `hotReload.ts` pour le détail complet du raisonnement.
> **Polling** : `setTimeout` récursif remplacé par
> `Effect.repeat(Schedule.spaced(pollIntervalMs))`, forké en tâche de fond
> via `GameRuntime.runFork` (jamais attendu), interrompu dans `stop()` via
> `fiber.interruptUnsafe()` (point d'entrée plain-JS, pas de générateur
> ambiant pour la variante Effect-idiomatique).
> **`main.ts` inchangé** (vérifié par `git diff` — zéro ligne touchée) :
> `LevelSession.current` reste un getter JS brut lu à chaque pas fixe par
> `main.ts`, jamais indirecté par Effect (principe transverse #1). Les deux
> harnais `tmp/harness.ts`/`tmp/harness-forced-null-hull.ts` fonctionnent
> sans modification.
> Tests : `test/game/level/loader.test.ts` (chemin heureux complet + les 7
> cas, vitest nu — même style frontière-plain-JS que `runGameplaySync` en
> M1) et `test/game/level/hotReload.test.ts` (coalescing du mutex, reload
> après complétion, `stop()`, échec réseau) — 20/20 tests verts,
> `pnpm build` vert. Comportement vérifié IDENTIQUE avant/après par diff
> strict des logs `console.error`/`console.info`/stats produits par les
> harnais Node headless existants sur `tmp/fixture.glb` (chemin heureux +
> hull forcé dégénéré) et un nouveau harnais jetable couvrant les 5 autres
> cas non exercés par cette fixture — diff vide dans les deux sens, avant
> et après migration. Non vérifié : le critère humain "déplacer un mur dans
> Blender, exporter, le voir en jeu en <60s" en conditions réelles (pas de
> serveur dev/navigateur dans cet environnement) — le mécanisme de sondage
> (400ms par défaut) et son timing ne sont pas modifiés par ce jalon.
> **Écart de style non corrigé, documenté ici** : `node_modules/effect/AGENTS.md`
> recommande `Effect.fn("name")(function*...)` plutôt que des fonctions qui
> retournent un `Effect.gen(...)` — ce fichier utilise le second style
> partout (cohérent avec `runtime.ts`/`random.ts` de M1), par prudence sur
> un fichier de cette taille plutôt que pour une raison technique.

**Objectif.** Remplacer le pattern "console.error + valeur null/booléenne + continuation" par des erreurs Effect typées, **en préservant exactement** le comportement de dégradation déjà documenté.

**Recherche requise.** `node_modules/effect/AGENTS.md`, sections erreurs taguées / `Schema.TaggedError` et `Schedule` (remplacement du `setTimeout` récursif de hot-reload) ; suivre ses liens vers `node_modules/effect/src` pour le détail d'API.

**Conception.**
- `buildLevelFromGltf` (déjà une fonction pure synchrone, sans I/O — cf. cartographie initiale) devient un `Effect<LevelHandle, LevelBuildError>` synchrone. `loadLevel` (le seul point avec un vrai I/O réseau, `GLTFLoader.loadAsync`) devient un `Effect<LevelHandle, LevelBuildError | LevelFetchError>` qui enveloppe l'appel réseau via `Effect.tryPromise`.
- Erreurs taguées à créer, une par cas déjà documenté dans le fichier actuel (liste exhaustive à conserver comme check-list d'acceptation) :
  - `MissingColliderGeometryError` (`col_*` sans géométrie / 0 triangle)
  - `OversizedColliderWarning` (> `MAX_COLLIDER_TRIANGLES` — actuellement non bloquant, doit le rester : voir note ci-dessous)
  - `MissingSpawnPlayerError` / `DuplicateSpawnPlayerError`
  - `NonBoxTriggerError` (`trig_*` non-box)
  - `UntargetedUseObjectWarning` (`use_*` sans cible)
  - `DegenerateConvexHullError` (repli automatique sur trimesh)
  - `LevelFetchError` (échec réseau/HEAD)
- **Point de vigilance explicite** : plusieurs de ces cas ne sont PAS des échecs bloquants aujourd'hui (le niveau continue de se construire en dégradé). Il ne faut pas les modéliser comme des `Effect.fail` qui interrompent le pipeline — soit ce sont des **warnings** portés dans une liste accumulée en sortie de l'Effect (succès avec un journal d'anomalies), soit des `Effect.fail` immédiatement rattrapés en interne via `Effect.catchTag(..., () => Effect.succeed(fallback))` avant de continuer la construction. Choisir l'un des deux patterns et l'appliquer uniformément (recherche recommandée dans `node_modules/effect/AGENTS.md` sur ce point précis) — ne pas laisser une erreur "warning" se propager jusqu'à l'appelant comme un vrai échec, ce serait une régression de comportement.
- Gestion de ressource : `LevelHandle` (corps Rapier + géométries/matériaux GPU) construit via `Effect.acquireRelease`/`Scope` au lieu du flag `disposed` manuel. Le hot-reload (`LevelSession`) devient un `Scope` enfant recréé à chaque rechargement, fermé (libère l'ancien niveau) seulement après que le nouveau soit prêt — même séquence qu'aujourd'hui (`currentHandle?.dispose()` après succès du nouveau chargement), mais garantie par le type plutôt que par l'ordre des lignes.
- Mutex de rechargement (`reloadInFlight` fait main) remplacé par un `Effect.Semaphore(1)` autour de `performLoad`.
- Polling HTTP (`setTimeout` récursif, 400 ms) remplacé par `Effect.repeat(Schedule.spaced("400 millis"))`, avec le même comportement de non-throw sur échec réseau transitoire (`catch` silencieux actuel → `Effect.catchAll` qui logue et laisse le `Schedule` continuer).

**Tests Vitest.** `buildLevelFromGltf` est déjà testable en Node sans réseau (fonction pure) — couvrir chacun des 7 cas de dégradation listés ci-dessus avec des fixtures glTF synthétiques minimales (le dossier `tmp/` contient déjà des générateurs de fixtures — `tmp/fixture-gen.ts` — à réutiliser/adapter plutôt que dupliquer). Un test d'intégration pour le mutex de rechargement (deux appels concurrents à `reload()` ne doivent produire qu'un seul chargement en vol).

**Vérification en jeu.** Charger un niveau valide, un niveau avec un `col_*` dégénéré volontaire (le fixture `tmp/harness-forced-null-hull.ts` existe déjà pour ce cas), vérifier les mêmes logs qu'avant dans la console, vérifier le hot-reload (modifier le `.glb`, constater le rechargement sous 400 ms, position joueur préservée).

**Critères d'acceptation.** Comportement en jeu strictement identique à avant migration (mêmes logs, mêmes reprises, mêmes reprises sur erreur) ; tests verts ; `pnpm build` vert.

---

## 5. Jalon M3 — `RaycastService`

> **✅ Livré (2026-08-31).** `src/physics/raycast.ts` : trois méthodes miroir 1:1 (`castRay`, `castRayAndGetNormal`, `intersectionsWithShape`), signature Rapier native complète, `physics: PhysicsWorld` en paramètre. `RaycastService.layer` (réelle) et `RaycastService.test(overrides?)` (scriptée, pour M5) tous deux fournis. `GameLayer` (M1) fusionne maintenant `DeterministicRandom.layer` et `RaycastService.layer` via `Layer.merge`. Les 6 call sites (`weapons.ts` ×2, `suit.ts` ×3, `director.ts` ×3 en comptant `hasClearWorldPath` — duplication Suit/Director volontairement non touchée, c'est le rôle de M5) migrés vers `runGameplaySync(RaycastService.use(...))`, un point d'entrée synchrone isolé par appel — pas de restructuration de `update(dt)`, réservée à M6. `meleeHitScratch` (scratch dédié du pied-de-biche) supprimé : le service collecte déjà les colliders dans un tableau, et ce call site n'est pas un point chaud 60Hz (un appel par coup, pas par pas fixe).
>
> **Piège Rapier découvert en écrivant les tests, à retenir pour M4/M5** : `castRay`/`castRayAndGetNormal`/`intersectionsWithShape` interrogent une structure de broad-phase qui n'est peuplée qu'après au moins un `world.step()` — un monde Rapier tout juste construit avec un collider fraîchement créé ne renvoie AUCUN hit tant qu'aucun pas n'a été simulé, même avec une géométrie correcte. `physics.step(0)` après construction suffit (aucun mouvement, juste la mise à jour de la broad-phase). Concerne uniquement les fixtures de test qui construisent un monde Rapier synthétique — le monde réel du jeu tourne déjà `world.step()` en continu, aucun impact production. `test/physics/raycast.test.ts` : 9 tests (7 contre un vrai monde Rapier, 2 contre la Layer scriptée). `pnpm build`/`pnpm test` vérifiés verts (29/29) indépendamment de l'agent qui a livré ce jalon.
>
> **Correction de conception faite avant délégation (2026-08-31).** Ce jalon a été écrit en supposant que le hitscan/la vision passaient par `THREE.Raycaster` — **faux**, vérifié par grep sur tout `src/` : zéro occurrence de `Raycaster`/`intersectObjects`. Le jeu n'utilise QUE l'API physique de Rapier pour ces requêtes : `physics.world.castRay` (booléen hit/pas-hit — ligne de vue Suit/Director, évitement local), `physics.world.castRayAndGetNormal` (hit détaillé avec collider/normale/`timeOfImpact` — résolution d'attaque ennemie, pellets du pompe), et `physics.world.intersectionsWithShape` (requête de forme callback-based — capsule du pied-de-biche). `RaycastService` enveloppe donc ces trois méthodes Rapier 1:1, pas `THREE.Raycaster`. Fichier corrigé : `src/physics/raycast.ts` (pas `src/render/`), cohérent avec la structure `CLAUDE.md` ("src/physics/ world"). Contrainte supplémentaire trouvée en lisant le code existant : `weapons.ts`/`suit.ts`/`director.ts` réutilisent déjà des `RAPIER.Ray` "scratch" (alloués une fois par instance, jamais recréés par appel) pour éviter les allocations à 60Hz — le service ne doit PAS casser cette discipline (accepter un `RAPIER.Ray`/les composants bruts en paramètre, ne pas forcer une construction interne). Comme pour `DeterministicRandom` (M1), `physics: PhysicsWorld` est passé en PARAMÈTRE de chaque méthode plutôt que stocké dans le service : `PhysicsWorld` est construit après `GameLayer`/`GameRuntime` (init WASM Rapier asynchrone dans `main.ts`), donc le service ne peut pas en dépendre à la construction de la Layer — et ça permet à une Layer de test de fournir des résultats scriptés sans jamais toucher à Rapier.

**Objectif.** Isoler les trois requêtes physiques de raycasting/shape-query derrière un service Effect synchrone, testable sans monde Rapier réel.

**Recherche requise.** `node_modules/effect/AGENTS.md`, section services/`Layer` (cas d'un service à une seule implémentation).

**Conception.**
- `RaycastService` (`Context.Service`) dans `src/physics/raycast.ts` : trois méthodes, chacune un wrapper `Effect.sync` direct et fidèle de l'appel Rapier correspondant (mêmes paramètres, même type de retour que l'API Rapier native — pas de nouvelle ADT qui perdrait de l'information dont un appelant a besoin, ex. `normal`/`timeOfImpact`/`collider`) :
  - `castRay(physics, ray, maxToi, groups): Effect<RAPIER.RayColliderHit | null>` — `hasClearWorldPath`, `castAvoidanceRay` (suit.ts/director.ts).
  - `castRayAndGetNormal(physics, ray, maxToi, groups): Effect<RAPIER.RayColliderIntersection | null>` — résolution d'attaque (suit.ts/director.ts), pellets du pompe (weapons.ts).
  - `intersectionsWithShape(physics, shapePos, shapeRot, shape, groups): Effect<RAPIER.Collider[]>` — capsule du pied-de-biche (weapons.ts), collecte les résultats du callback Rapier dans un tableau plutôt que d'exposer le callback lui-même.
- Migration des call sites existants (`weapons.ts` : capsule pied-de-biche, pellets pompe ; `suit.ts`/`director.ts` : `hasClearWorldPath`, résolution d'attaque, `castAvoidanceRay`) pour passer par `GameRuntime.runSync(RaycastService.use(...))` — chaque appel reste un point d'entrée synchrone isolé, PAS une restructuration de `update(dt)` en un seul grand Effect (ça, c'est M6). Les gizmos balistiques de debug (`src/render/ballisticsDebug.ts`) ne font AUCUN raycast propre — ils visualisent des points déjà calculés par `weapons.ts` — donc rien à migrer là, juste à vérifier qu'ils restent corrects après migration de leur source de données.
- Bénéfice immédiat : une `Layer` de test peut fournir des résultats scriptés (« ce rayon touche un mur à 3m », « ce rayon ne touche rien ») sans construire de vrai monde Rapier — précondition pour tester M5 (comportement Suit/Director) de façon déterministe.

**Tests Vitest.** `RaycastService` réel contre un vrai (petit) monde Rapier construit en mémoire (Rapier compat fonctionne en Node, cf. M2) : vérifie qu'un rayon connu touche/ne touche pas comme attendu, pour chacune des trois méthodes. Une `Layer` de test scriptée, réutilisée par M5.

**Vérification en jeu.** Tir au pompe/pied-de-biche inchangé (portée, précision, dispersion), vision et attaque des Costards/Directeur inchangées, gizmos balistiques (`B`) toujours affichés correctement.

**Critères d'acceptation.** Aucune régression de portée/précision des tirs ni de la détection de ligne de vue/évitement ; tests verts.

---

## 6. Jalon M4 — `PathfindingService` (vrai système, pas une façade)

> **✅ Livré (2026-08-31).** `src/game/level/pathfinding.ts` : bake 2 passes (hauteur de sol + élagage par capsule ; arêtes 8-connectées, chaque paire testée une seule fois), `NavGraph` en tableaux typés (`Float32Array`/`Uint8Array`, indexation `iz*cols+ix`, délibérément pas de `Map`/`Set`), A* par tas binaire maison avec tie-break `(f, index)` déterministe. `MAX_STEP_HEIGHT = 1.0m` choisi pour couvrir une marche de l'escalier à 45° de la Zone D (documenté, pas vérifié contre le vrai KCC en navigateur). Gabarit de bake = `suitConfig` (pas `directorConfig`), choix explicite assumé (risque jugé faible, le Directeur est un boss unique en salle ouverte). Type public de `bake` entièrement résolu (`Effect<NavGraph>`, `RaycastService` fourni en interne à `PathfindingService.layer` plutôt qu'exposé à l'appelant) — trouvé via une vraie erreur `tsc` pendant l'implémentation, pas anticipé au départ.
>
> Intégration `runChase` (suit.ts/director.ts, duplication préservée) strictement additive comme demandé : `computeAvoidedDirection` **intact**, utilisé comme repli si `findPath` échoue ou si aucun graphe n'est encore baké. Re-requête throttlée (`PATH_REQUERY_DISTANCE = 1.5m`), suivi de waypoint avec avance multi-cellule si besoin. `main.ts` : bake dans `onLoaded` (premier chargement ET hot reload), `window.cassandre.pathfinding.{graph,stats,findPath}`, `git diff --stat` confirmé limité à ce hook + les deux call sites `.update()`.
>
> Test dédié reproduisant la géométrie exacte de la Zone D (deux plateformes à 2m d'écart reliées par une rampe unique à 45°, un seul collider — comme un vrai proxy de kit) : un chemin est trouvé ET passe authentiquement par la rampe (hauteur intermédiaire vérifiée, pas un raccourci de géométrie). 6 tests, `pnpm build`/`pnpm test` vérifiés verts (35/35) indépendamment de l'agent. **Non vérifié** (pas d'outil navigateur dans l'environnement de l'agent) : le comportement en jeu réel, notamment si le KCC réel arrive à gravir la vraie pente du kit avec ses réglages actuels — hypothèse documentée dans le code, à confirmer en jouant.
>
> **Précisions faites avant délégation (2026-08-31), à partir d'une lecture directe du code réel.** (1) `LevelHandle` n'expose aucune liste de colliders/bodies bruts — le bake obtient l'emprise du niveau via `new THREE.Box3().setFromObject(handle.root)` et échantillonne par raycasts (`RaycastService`) contre un filtre `WORLD` seul, pas en énumérant des objets Rapier ; pas de changement nécessaire à `loader.ts`. (2) Vérifié dans `suit.ts::integratePhysics` : Suit/Director partagent un `RAPIER.KinematicCharacterController` (invariant #6, même schéma que le joueur) qui résout DÉJÀ l'autostep/l'escalade de pente à partir d'un déplacement désiré purement horizontal — le graphe reste donc 2.5D (une hauteur de sol par cellule) et le steering vers un waypoint reste une direction X/Z, jamais une trajectoire Y calculée à la main. (3) Intégration dans `runChase` volontairement PRUDENTE : `computeAvoidedDirection` n'est PAS supprimé dans ce jalon, il reste un repli explicite si `findPath` échoue (pas encore de graphe, aucun chemin trouvé) — sa suppression reste conditionnée à une confiance établie en jouant réellement, ce que ni un agent ni cette session ne peuvent garantir dans cet environnement. (4) `PathfindingService` reste stateless (même philosophie que `DeterministicRandom`/`RaycastService`) : `bake(physics, bounds): Effect<NavGraph>` et `findPath(graph, from, to): Effect<Vector3[], PathNotFoundError>`, le graphe COURANT est gardé par l'appelant (`main.ts`, variable JS simple rebâtie dans le callback `onLoaded` déjà existant), pas par le service. (5) `main.ts` PEUT être modifié pour ce jalon (contrairement à M2/M3) — c'est une fonctionnalité nouvelle, pas un pur refactor interne — mais seulement pour le hook de bake et l'entrée debug `window.cassandre.pathfinding`.

**Objectif.** Remplacer les 3 rayons d'évitement local (`computeAvoidedDirection`) par un vrai suivi de chemin, capable de traverser l'escalier de la Zone D — la limite documentée qui a jusqu'ici empêché de placer des ennemis sur la mezzanine.

**Recherche requise.** `node_modules/effect/AGENTS.md`, section composition d'Effects — pas de guide dédié au pathfinding, c'est de l'algorithmique pure, Effect ne fait que l'encapsuler proprement.

**Conception — graphe de praticabilité 2.5D, baké au chargement du niveau :**
1. **Échantillonnage** : une grille horizontale (pas de 0.5 m — multiple de la grille de construction Blender 0.25 m déjà en place) sur l'emprise AABB du niveau chargé.
2. **Hauteur de sol par cellule** : un rayon vertical descendant (via `RaycastService`, M3) depuis un point haut jusqu'au premier collider statique touché → donne la hauteur de sol praticable à cette cellule, ou "aucune" si rien n'est touché (vide/hors niveau). Cette approche générique gère nativement la mezzanine de la Zone D (Z=2m) et l'escalier (pente continue) sans code spécifique à une zone.
3. **Élagage** : une cellule est rejetée si un test de capsule/AABB (colliders `col_*` étant des proxies cuboid par convention du kit — cf. `collision-proxy-authoring`) chevauche la position debout du joueur/ennemi à cette hauteur.
4. **Arêtes** : deux cellules adjacentes (4 ou 8-connectées) sont reliées si (a) la différence de hauteur de sol est franchissable (seuil type "marche", cohérent avec la géométrie des escaliers du kit) et (b) un rayon horizontal à hauteur de "tête" d'ennemi entre les deux cellules ne touche aucun mur (`RaycastService`).
5. **Requête** : A* déterministe sur ce graphe (tie-break stable par index de grille, jamais par ordre d'itération d'une `Map`/`Set` — condition dure du déterminisme de rejeu). `PathfindingService.findPath(from, to): Effect<ReadonlyArray<Vector3>, PathNotFoundError>`.
6. **Cycle de vie** : le graphe est reconstruit une fois par (re)chargement de niveau (hook sur le même point que `onLoaded` du hot-reload, M2), jamais par pas fixe. Coût du bake assumé au chargement, pas dans la boucle 60 Hz.
7. **Fréquence de requête runtime** : un chemin n'est recalculé que si la cible (le joueur) s'est déplacée au-delà d'un seuil depuis la dernière requête — pas à chaque pas fixe, indépendamment du débat de perf Effect (c'est juste inutile de refaire un A* complet 60 fois par seconde pour une cible qui n'a pas bougé).

**Intégration Suit/Director (prépare M5).** `runChase` interroge `PathfindingService` et pilote l'entité vers le prochain waypoint plutôt que vers la position brute du joueur + évitement local. `computeAvoidedDirection` est retiré une fois la parité de comportement constatée en jeu (pas de suppression prématurée avant validation).

**Tests Vitest.** Fixtures synthétiques (grilles de colliders construites à la main, pas de vrai `.glb`) : couloir simple, obstacle contournable, **cas de l'escalier de la Zone D reproduit en fixture** (le cas documenté comme bloqué aujourd'hui) — le test doit prouver qu'un chemin est trouvé entre le rez-de-chaussée et la mezzanine.

**Vérification en jeu.** `window.cassandre.pathfinding` (nouvel objet exposé en console, même précédent que `cassandre.doors()`/`cassandre.secrets()`) pour visualiser un chemin calculé en direct. Un Costard de test placé volontairement derrière un obstacle en dur doit désormais le contourner en suivant le graphe, pas seulement par rayons locaux.

**Critères d'acceptation.** Le cas de test "escalier Zone D" passe ; le comportement de poursuite des 5 zones existantes reste au moins aussi bon qu'avant (pas de régression visible — Costards qui restent coincés, qui tremblent contre un mur, etc.) ; tests verts.

---

## 7. Jalon M5 — Machine XState partagée Suit/Director

> **✅ Livré (2026-09-03), en deux passes délibérées vu le risque.** Passe 1 : `test/game/entities/{suit,director}.test.ts` (62 tests) écrits contre le code PRÉ-refactor, non modifié, comme filet de sécurité — ni un agent ni cette session ne peuvent rejouer en navigateur pour vérifier une régression sur un combat déjà validé fun (Phase 3). Passe 2 : le refactor lui-même, avec pour règle absolue que ces 62 tests passent SANS qu'une seule assertion ne change (vérifié : horodatage des fichiers de test antérieur à celui des sources refactorées, aucune modification après coup).
>
> `src/game/entities/enemyMachine.ts` (nouveau, 1056 lignes) porte désormais TOUTE la logique auparavant dupliquée caractère pour caractère entre `suit.ts`/`director.ts` (confirmé par diff avant de lancer ce jalon : identique à l'exception de `revealed`/`justRevealed`/le badge) — table de transition, perception, évitement, pathfinding, jitter de visée, knockback, intégration physique. `suit.ts` (801→287 lignes) et `director.ts` (759→338 lignes) deviennent de fins wrappers : corps/collider Rapier, PRNG, config, acteur XState, et pour `Director` seul, `revealed`/`justRevealed`/`DirectorBadge` (restés hors de la machine partagée, champ de contexte annexe comme prévu). `main.ts`/`suitManager.ts`/`directorManager.ts` inchangés — API publique de `Suit`/`Director` préservée à l'identique.
>
> Décisions non triviales : `attackCooldownRemaining`/`timeSinceLastSeen` modélisés comme champs de contexte PERSISTANTS à travers les transitions (pas des `stateTimer` génériques remis à zéro à l'entrée d'état — la passe de caractérisation avait correctement identifié qu'ils ne suivent pas ce moule). Aucun `guard:` XState pour les transitions pilotées par `TICK` : les fonctions de décision (`runIdle`/`runChase`/etc., portées à l'identique) calculent une fois les quantités coûteuses (raycasts) et n'appellent `actor.send(...)` que quand une transition doit réellement avoir lieu — évite de dupliquer un raycast entre deux gardes sœurs qui partageraient la même quantité. `forceEnemyState` (via `enemyMachine.resolveState` + écriture du snapshot interne) comble l'écart entre l'ancienne API à champs bruts mutables (`suit.state = "chase"` dans les tests de caractérisation) et l'encapsulation normale d'un acteur XState — réservé aux setters de test, jamais utilisé par le chemin de production. Zéro allocation par pas fixe préservée : `context` construit une fois par entité, muté directement (jamais `assign()`), un `send()` réel n'alloue que lors d'une transition qui a effectivement lieu.
>
> **Interruption et reprise** : la tâche de refactor a été interrompue par une limite de session juste avant sa vérification finale. Reprise vérifiée directement par cette session (pas par un nouvel agent) : `pnpm build`/`pnpm test` relancés indépendamment, verts (97/97, aucune régression), lecture complète de `enemyMachine.ts`/`suit.ts`/`director.ts`, confirmation par horodatage que les tests de caractérisation n'ont pas été retouchés. **Non vérifié** (même limitation que tous les jalons précédents) : comportement en jeu réel sur les 5 zones + Zone E.

**Objectif.** Une seule définition de machine à états pour Suit et Director, paramétrée par configuration, remplaçant les deux fichiers texto-identiques.

**Recherche requise.** `node_modules/effect/AGENTS.md` ne couvre pas XState (bibliothèque séparée, sans lien avec Effect) — utiliser la documentation XState v5 directement (actor model, `context`, `guards`).

**Conception.**
- `src/game/entities/enemyMachine.ts` (nouveau) : une machine XState avec les 7 états existants (`idle`, `alert`, `chase`, `attack`, `stagger`, `dead`, `corpse`) et **exactement** les transitions déjà documentées et testées en jeu :
  - `idle → alert` : ligne de vue dégagée (via `RaycastService`, M3) + distance < `sightRange`.
  - `alert → chase` : inconditionnel après `alertDuration` — **sans** re-vérifier la ligne de vue (décision déjà actée, à préserver explicitement, sinon régression comportementale silencieuse).
  - `chase → attack` : en vue + distance ≤ `attackRange` + cooldown écoulé.
  - `chase → idle` : perte de contact pendant `lostContactTimeout`.
  - `attack → chase` : après `attackTelegraphDuration` tenu, résolution du tir avec re-vérification de ligne de vue.
  - `stagger → chase` : après `staggerDuration`.
  - `* → dead → corpse` : déclenché par `applyDamage`, transition automatique différée par timer (pas `after` — règle transverse #3).
- **Toutes les durées** (`alertDuration`, `attackTelegraphDuration`, `lostContactTimeout`, `staggerDuration`) vivent dans le `context` de la machine comme `stateTimer`, décrémentées par un évènement `TICK({ dt })` envoyé une fois par pas fixe avec le `gameplayDt` réel (incluant hitstop).
- **Config différentielle Suit vs Director** : un objet de config passé à la création de l'acteur (`sightRange`, `attackRange`, cooldowns, PRNG dérivé du `DeterministicRandom`, callbacks de résolution de tir spécifiques). Le `revealed` du Director (actuellement un booléen orthogonal piloté par un seuil de PV, PAS un état à part) reste un champ de `context` mis à jour par une action sur `applyDamage`, pas une région d'état parallèle — ne pas sur-ingénierer au-delà du comportement actuel.
- `Suit`/`Director` deviennent de fines classes wrapper (position, mesh, collider Rapier — tout ce qui n'est PAS la state machine) qui possèdent un acteur XState et lui délèguent `state`/transitions. `SuitManager`/`DirectorManager` (`src/game/entities/*Manager.ts`) restent des `Entity[]` + `update(dt)` — invariant #8 intact, aucun ECS introduit, seule la state machine interne change de représentation.

**Tests Vitest.** Table de transition complète rejouée avec `RaycastService` de test (M3) et un `DeterministicRandom` de test : chaque transition documentée ci-dessus doit être couverte par au moins un test (état de départ + condition → état d'arrivée attendu). Cas Director spécifique : `revealed` bascule au bon seuil de PV, indépendamment de l'état courant de la machine.

**Vérification en jeu.** Les 5 zones existantes + Zone E (Directeur) : mêmes transitions observées qu'avant (`window.cassandre.suits`/`cassandre.director` déjà exposés), mêmes timings de télégraphie, aucun Costard qui reste bloqué dans un état.

**Critères d'acceptation.** Parité comportementale complète avec `suit.ts`/`director.ts` actuels (checklist des transitions ci-dessus, toutes vérifiées) ; `director.ts`/`suit.ts` réduits à leur seule partie "présentation/physique", la logique d'état dupliquée a disparu ; tests verts.

---

## 8. Jalon M6 — Orchestration Effect du pas fixe (gameplay)

**Objectif.** Convertir le câblage géant et procédural de `updateGameplay` (`src/main.ts`, ~500 lignes) en un Effect composé, exécuté via `runGameplaySync` (M1) à chaque pas fixe.

**Recherche requise.** `node_modules/effect/AGENTS.md`, sections composition de plusieurs services dans une `Layer` finale et séquencement `Effect.gen`.

**Conception.**
- Services introduits pour les systèmes déjà existants mais aujourd'hui de simples classes appelées à la main : `PlayerService`, `WeaponService`, `EntityManagerService` (englobe `SuitManager`/`DirectorManager`). Chacun rejoint `GameLayer` (M1).
- `updateGameplay` devient : lire l'état de flux de partie (voir M8 — remplace le double flag `isDead`/`isLevelComplete` par une lecture d'état de la machine de flux d'écran), puis un seul `Effect.gen` séquençant `player.update → weapons.update (RaycastService) → entities.update (PathfindingService + machines XState, M4/M5) → résolution des événements de frame (tirs/hits/alertes)`. Même ordre qu'aujourd'hui, aucune réorganisation de séquence.
- Les files d'événements par frame (`fireEvents`/`hitEvents` de `WeaponSystem`, événements de `SuitManager`/`DirectorManager`) restent des files simples consommées par curseur — **pas** de `Queue`/`Stream` Effect ici : c'est un système qui fonctionne déjà et le risque de régression (le bug historique `hitCursor` documenté dans `CLAUDE.md`) ne vaut pas la peine d'être rouvert dans ce chantier. Ne pas migrer ce qui n'est pas cassé.

**Tests Vitest.** Test d'intégration : un pas fixe complet exécuté hors navigateur (Rapier compat fonctionne en Node via WASM), avec un joueur/un Costard synthétiques, vérifie qu'un tir résout un dégât et qu'un changement d'état de machine se propage — preuve que `runGameplaySync` ne suspend jamais sur le chemin réel.

**Vérification en jeu.** Partie complète jouée (les 5 zones), aucun changement de sensation (invariant de non-régression du feel — `feel-tuner`/`game-feel-tuning` restent la référence si un doute apparaît).

**Critères d'acceptation.** `pnpm build` vert, `runGameplaySync` ne déclenche jamais le garde-fou de suspension pendant une partie complète, aucune régression de gameplay observée.

---

## 9. Jalon M7 — Orchestration Effect du rendu et de l'interpolation

**Objectif.** Envelopper `interpolateVisuals`/`updateFx`/`render` dans Effect, avec l'exception documentée pour la rotation caméra.

**Conception.**
- `RenderService` (Context.Tag) : wrap synchrone de `WebGLRenderer.render(scene, camera)` et de l'interpolation billboard/position (`interpolateVisuals(alpha)`).
- **Exception explicite, à commenter dans le code exactement comme les autres exceptions du projet** : la lecture de `camera.rotation`/l'application du yaw/pitch brut de la souris reste un accès JS direct, en dehors de toute indirection de service — au pire enveloppée dans un `Effect.sync` feuille sans générateur imbriqué autour, pour ne pas ajouter de latence de visée (invariant #3, non négociable même dans ce chantier).
- Instrumentation : un compteur de temps par phase (gameplay / physique / rendu) ajouté à `DebugPanel` (existant), lisible en jeu (touche déjà utilisée pour le debug). C'est le filet de sécurité concret pour le risque de perf assumé en §0 — la régression sera visible dans l'overlay de dev dès qu'elle apparaît, sans instrumentation externe à construire.

**Tests Vitest.** Peu de valeur à tester le rendu lui-même (pas de WebGL en Node) — se limiter à vérifier que `RenderService` ne fait rien d'autre qu'appeler le renderer (test de contrat, pas de rendu réel).

**Vérification en jeu.** Capture d'écran avant/après, FPS affiché dans `DebugPanel` comparé à une baseline notée avant ce jalon (même si aucun budget n'est fixé a priori, avoir le chiffre "avant" est nécessaire pour juger "on ajuste" plus tard). Test de latence de visée subjectif (le "feel" de la souris ne doit percivablement pas changer).

**Critères d'acceptation.** Rendu visuellement identique, FPS noté (pas nécessairement inchangé — juste mesuré et documenté), aucune latence de visée perceptible ajoutée.

---

## 10. Jalon M8 — Machine XState de flux d'écran + reset en place

**Objectif.** Remplacer les `root.render()` impératifs + `window.location.reload()`/`assign()` par une machine de flux (`boot → mainMenu → options → levelSelect → playing → dead|levelComplete → …`), avec un vrai reset en jeu.

**Conception.**
- `src/ui/gameFlowMachine.ts` : états `boot`, `mainMenu`, `options`, `levelSelect`, `playing`, `dead`, `levelComplete`. Pas de `@xstate/react` — l'acteur pousse son état courant dans le store zustand existant (`useGameStore`) via un `subscribe()`, exactement comme le reste de l'état de jeu déjà exposé au HUD (invariant #2 : React ne s'abonne qu'à zustand, throttlé).
- `dead`/`levelComplete → playing` (rejouer) et `→ mainMenu` (retour menu) déclenchent désormais un **vrai reset en place** : dispose + reconstruction de `PhysicsWorld`, `SuitManager`, `DirectorManager`, `WeaponSystem`, et rechargement du niveau via `LevelSession` (M2) — sans `window.location.reload()`. C'est une capacité nouvelle (jusqu'ici jugée disproportionnée en Phase 6, faute d'un chemin de reset) ; documentée comme telle, pas comme un simple refactor.
- Les deux flags `isDead`/`isLevelComplete` de `state.ts` sont retirés au profit d'une lecture directe de l'état de la machine (le garde en tête d'`updateGameplay`, M6, lit cet état plutôt que deux booléens indépendants).

**Tests Vitest.** Table de transitions du flux d'écran (boot→menu→jeu→mort→rejouer→jeu, boot→menu→jeu→fin→menu, etc.) testée en isolation de tout rendu React/Three.js — l'acteur XState est une machine pure.

**Vérification en jeu.** Parcours complet : boot → menu → options → retour → jouer → mourir → rejouer (doit relancer sans rechargement de page, chronométré) → terminer un niveau → retour menu.

**Critères d'acceptation.** Aucun `window.location.reload()`/`assign()` restant dans le chemin nominal ; un reset complet observable sans rechargement de page ; toutes les combinaisons de la table de transition couvertes par un test.

---

## 11. Jalon M9 — Documentation et verrouillage des conventions

**Objectif.** Mettre à jour `CLAUDE.md` et les skills concernés pour que tout agent (ou session future) respecte ces nouvelles règles sans avoir à relire ce plan en entier.

**Actions.**
1. Ajouter les règles de la section 1 de ce plan comme nouveaux invariants numérotés dans `CLAUDE.md` (frontière synchrone stricte, PRNG déterministe unique, XState sans `after`).
2. Retirer/mettre à jour la note documentant la duplication Suit/Director comme choix délibéré (obsolète après M5).
3. Mettre à jour la ligne "Phase courante" de `CLAUDE.md` pour référencer ce chantier et son état d'avancement, comme fait pour chaque phase précédente.
4. Vérifier si les skills `enemy-state-machine`, `fixed-timestep-loop`, `react-hud-bridge`, `gltf-level-conventions` ont besoin d'une mention des nouveaux patterns (Effect/XState) — mise à jour ciblée, pas de réécriture complète.
5. Décider si un nouveau skill dédié (`effect-xstate-cassandre` ou similaire) documentant les patterns spécifiques à ce projet (le garde-fou `runGameplaySync`, le pattern "timer manuel au lieu de `after`") vaut la peine, pour que les agents spécialisés (`core-loop`, `entity-designer`, `level-pipeline`, `shell`) les suivent sans redécouvrir ce plan à chaque fois.

**Critères d'acceptation.** `CLAUDE.md` reflète l'état réel du code après M0-M8, sans contradiction entre la doc et l'implémentation.

---

## 12. Ordre d'exécution suggéré et rattachement aux agents existants

Ce chantier touche plusieurs domaines déjà couverts par des agents spécialisés. Suggestion de routage, cohérente avec le fonctionnement déjà établi du projet (`director` → agent spécialisé) :

| Jalon | Domaine | Agent suggéré |
|---|---|---|
| M0, M1 | Infra, runtime, déterminisme | `core-loop` |
| M2 | Chargement de niveau | `level-pipeline` |
| M3 | Raycasting | `core-loop` (partagé par armes + IA + rendu) |
| M4 | Pathfinding | `level-pipeline` (consomme les données de niveau) ou `entity-designer` (consommateur principal) — à trancher selon qui écrit le bake du graphe |
| M5 | Machine à états ennemis | `entity-designer` |
| M6 | Orchestration gameplay | `core-loop` |
| M7 | Rendu/interpolation | `retro-render` |
| M8 | Flux d'écran, reset | `shell` |
| M9 | Documentation | `director` (ou directement, sans agent) |

Chaque jalon reste petit et vérifiable seul — pas besoin d'attendre la fin du chantier complet pour merger et jouer.
