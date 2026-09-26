---
title: Écarts entre l'ancienne doc et le code
tags: [archive, documentation, ecarts]
status: perime
updated: 2026-09-26
---

# Écarts entre l'ancienne doc et le code

> Archive du suivi d'écarts des phases A à G. Les arbitrages encore ouverts
> ont été transférés, notamment à [ADR 0034](../decisions/0034-resolution-interne-configurable.md).
> La [documentation actuelle](../README.md) décrit le comportement vérifié.

Journal des écarts trouvés pendant le chantier de documentation (voir
`docs/_chantier/charte.md`, section « Le code fait foi »). Un écart n'est
jamais corrigé en silence : il est noté ici, et la page en chantier s'écrit
d'après le code, pas d'après l'écart. Ce fichier disparaît à la fin du
chantier (D70) ; ce qui reste ouvert à ce moment-là doit être tranché ou
transféré ailleurs (ADR, ticket) avant suppression.

Format d'une ligne :

| Fichier | Affirmation de l'ancienne doc | Ce que dit le code | Preuve |
|---|---|---|---|

---

## Écarts reportés depuis l'inventaire (D0)

| Fichier | Affirmation de l'ancienne doc | Ce que dit le code | Preuve |
|---|---|---|---|
| `docs/reference/etat-des-lieux-code-architecture.md` | Présenté comme un audit ouvert, avec des « Constats prioritaires » (P0/P1) à traiter | L'audit est déjà soldé : son propre tableau « Suivi d'exécution » (lignes 497-501) marque les 4 étapes de remédiation « Terminée » | Les commits `45b9cec`, `a6277e9`, `05e1084`, `ede868d` (`git log`) correspondent nom pour nom aux étapes 4/3/2/1 du tableau |
| `docs/reference/threejs-rapier.md` | Cité comme lien actif depuis `docs/game/plan-prototype.md` (« voir Rapier/Three.js — guide de terrain ») | Le fichier est un stub vide ; le vrai contenu vit dans le skill `threejs-rapier-fieldguide` | Lecture directe du fichier (vide) vs contenu du skill |
| `docs/game/univers.md` | `docs/README.md` le liste dans sa section « Conception » comme s'il existait | Le fichier est un stub vide | Lecture directe du fichier |
| `AGENTS.md` | Censé refléter `CLAUDE.md` | Miroir en retard : deux entrées de journal manquantes, une auto-référence à un chemin `.Codex/` inexistant au lieu de `.claude/` | Comparaison ligne à ligne `AGENTS.md` vs `CLAUDE.md` |
| `.agents/skills/` (non suivi par git) | — (dossier apparu hors inventaire officiel) | Duplique `.claude/skills/` avec au moins deux fichiers qui divergent déjà (`effect-xstate-cassandre`, `enemy-state-machine`) | `git status` (dossier `??`) + diff des deux copies de chaque skill divergent |
| `docs/systems/pathfinding.md` / `CLAUDE.md` (« Chantier Niveau v2 », passe du 2026-09-18) | `MAX_STEP_HEIGHT` du graphe documenté à 1,0 m contre une marche d'ennemi réelle de 0,35 m (`autostepMaxHeight`) | Dans le code actuel, `MAX_STEP_HEIGHT = suitConfig.autostepMaxHeight` (`src/game/level/pathfinding.ts`, ligne 38) : les deux valeurs sont IDENTIQUES (0,35 m), aucun écart. L'écart documenté ne correspond plus au code — **tranché au jalon D30 (2026-09-26) : corrigé depuis, page écrite d'après le code actuel** | `grep -n "autostepMaxHeight" src/game/entities/suitConfig.ts` (0.35), `grep -n "MAX_STEP_HEIGHT = " src/game/level/pathfinding.ts` (`suitConfig.autostepMaxHeight`) |
| `docs/systems/session.md` | Décrit la construction/démolition d'une partie sans mention du chantier « cycle de vie transactionnel » | Le commit `05e1084` (étape 2 de l'audit `etat-des-lieux-code-architecture.md`) a probablement changé ce comportement dans `game/session/lifecycle.ts` | À faire au jalon D13 : lire `game/session/lifecycle.ts` et comparer au texte de `session.md` |
| `README.md` / `CLAUDE.md` / `PLAN_PROTO_BOOMER_SHOOTER.md` (§1) | Trois copies quasi identiques de la liste « Stack » | Pas un bug de code, mais un signal éditorial : trois sources qui peuvent diverger avec le temps | Lecture comparée des trois fichiers |
| `README.md` (« deux armes ») et l'en-tête de `CLAUDE.md` (« 2 armes ») | Le prototype aurait deux armes | `src/game/player/weapons.ts` définit `WeaponKind = "none" \| "melee" \| "pistol" \| "shotgun"` : trois armes réelles (pied-de-biche, pistolet, pompe) plus l'état désarmé de départ | Lecture directe de `weapons.ts` (lignes 55, 79, 114) et de `weaponConfig.ts` (bloc de commentaires du pistolet, ajouté 2026-09-16) — **Tranché le 2026-09-25 : trois armes, README.md, CLAUDE.md et AGENTS.md corrigés.** |
| `docs/systems/boucle-de-jeu.md` (section « Hitstop ») et `CLAUDE.md` invariant #13 | Le hitstop scalé serait transmis aux ennemis « via l'évènement `TICK` » (`game/entities/enemyMachine.ts`), suggérant un `actor.send({ type: "TICK" })` envoyé par pas fixe | `tickEnemy(actor, dt, updateCtx)` (`src/game/entities/enemyMachine.ts`, ligne 956) est un appel de fonction directe depuis `Suit.update`/`Director.update` (`suit.ts:240`, `director.ts:248`) qui MUTE `ctx.stateTimer`/`ctx.attackCooldownRemaining`/`ctx.animClock` en place ; aucun évènement XState nommé `TICK` n'est envoyé dans tout le dépôt (`grep -rn '"TICK"' src/` ne retourne que ce commentaire) | `grep -n "tickEnemy(" src/game/entities/*.ts` (3 occurrences : la définition + 2 appels directs), `grep -rn '"TICK"' src/game/entities/` (0 `send`). **Tranché le 2026-09-25 : invariant retiré.** |
| `CLAUDE.md`, invariant #9 (« Boîtes blanches jusqu'à la Phase 5 ») | Présenté comme une règle de séquencement encore active (pas d'assets finaux avant la Phase 5) | La Phase 5 est close depuis longtemps et le chantier Niveau v2 est allé plus loin : `HABILLAGE` dans `tools/level_v2/build_niveau.py` (ligne 2835) couvre les dix espaces du niveau (`rayons`, `caisses`, `galerie`, `hub`, `electro`, `reserve`, `souterrain`, `parking_ext`, `cafeteria`, `bureaux`), et `CLAUDE.md` note lui-même « Plus un seul volume gris » pour ce niveau (section « Chantier Niveau v2 »). L'invariant n'est donc plus une contrainte active sur le niveau principal | Lecture de `HABILLAGE` (dict complet, 10 clés) et de la fonction qui imprime les espaces « encore en gris » restants (lignes 3064-3065, liste vide aujourd'hui) vs le texte de `CLAUDE.md`. Documenté sans trancher dans `docs/3-architecture/invariants.md` (#9). **Tranché le 2026-09-25 : invariant retiré.** |
| `docs/systems/session.md`, ligne 34 (diagramme) | Le diagramme de flux de fin de niveau annote la transition « `door_e_exit` franchie » comme si c'était le seul nom de porte de sortie possible | `estPorteDeSortie` (`src/game/session/doors.ts`) reconnaît DEUX noms : `door_e_exit` (ancien niveau complet, Zone E) ET `door_exit` (niveau v2) — le corps du texte de `session.md` (lignes 179, 409) le dit déjà correctement, seul le diagramme est resté sur l'ancien nom unique | `grep -n "estPorteDeSortie" src/game/session/doors.ts` (ligne 53-54 : `doorName === "door_e_exit" \|\| doorName === "door_exit"`) |
| `docs/systems/session.md` | Décrit la construction/démolition d'une partie sans mention du chantier « cycle de vie transactionnel » (ligne notée « à faire au jalon D13 » dans ce même fichier) | Traité par `docs/3-architecture/cycle-de-vie.md` (D13, 2026-09-25) : jeton de génération (`levelLoadGeneration`), candidat séparé de l'état affiché, commit en une passe, `Semaphore` à un jeton — tout vient de `src/game/session/spawning.ts::loadGltfLevel` et `src/game/level/hotReload.ts::createLevelSession`, introduits par le commit `05e1084` | Lecture directe des deux fichiers cités ; `git show --stat 05e1084` |
| `docs/game/niveau-hypermarche.md` | Décrit la progression à clé unique de l'ancien niveau complet : un seul badge, lâché par le Directeur, ouvrant `door_e_exit` en Zone E — aucune mention d'un niveau v2 | Le niveau v2 (`niveau_v2`, jalon N7) a trois cartes de fidélité (`argent`, `or`, `platine`) : Argent et Or se ramassent dans les rayons et l'électroménager et ouvrent chacune une porte propre (`door_argent`, `door_or`) qui gate la réserve/le souterrain puis l'étage des bureaux ; Platine est toujours lâchée par le Directeur et ouvre `door_exit` | `tools/level_v2/plan_de_masse.py` (repères « carte Argent »/« carte Or »/« carte Platine »), `tools/level_v2/plan_de_masse.py` lignes 787-788 (`GOULOTS`), décodage de `public/assets/levels/niveau_v2.glb` (`use_carte_argent` → `{"card": "argent"}`, `use_carte_or` → `{"card": "or"}`, `use_door_argent` → `{"target": "door_argent", "requires": "argent"}`, etc.), `src/game/session/doors.ts::estPorteDeSortie` |
| `src/game/level/loader.ts`, commentaire de tête de `buildPropEffect` (ligne ~1229) | Décrit `door_*` comme « dynamique mais verrouillé », par contraste avec le corps dynamique libre d'un `prop_*` | Depuis l'[ADR 0031](../decisions/0031-portes-animees-et-vitres.md), `buildDoorEffect` pose un corps **`RAPIER.RigidBodyDesc.fixed()`** à la pose fermée pour toujours (jamais dynamique) — le commentaire de tête de `buildDoorEffect` lui-même (ligne ~884) le dit correctement ; seul ce commentaire distant, dans `buildPropEffect`, est resté sur la description PRÉ-ADR-0031 du comportement des portes | `grep -n "RigidBodyDesc" src/game/level/loader.ts` (ligne 937 : `.fixed()` dans `buildDoorEffect`) vs le texte « dynamique mais verrouillé » à la ligne 1230 |
| `src/game/session/gameSession.ts`, commentaire de `lastHeroLineAt` (« Cooldown global des répliques du héros — PROPRE À CETTE PARTIE ») et le principe général de `game/session/` (délai de soulagement des sanitaires, temps de partie du récap : tous décrémentés/accumulés avec le `gameplayDt` réel, jamais une horloge murale, relevé pendant la rédaction de D32) | Suggère que toute minuterie de `GameSession` vit au pas fixe, sur `gameplayDt` | `game/session/feedback.ts::triggerHeroLine` compare `performance.now()` — une horloge MURALE — plutôt qu'un champ décrémenté par `gameplayDt` comme `sanitaireReliefCooldown`. Le tirage de la réplique (`session.sanitaireReliefRandom`, appelé en argument avant le test de cooldown) reste déterministe et n'est pas affecté ; seul l'AFFICHAGE de la réplique (donc le ducking musical) peut diverger entre un enregistrement F9 et son rejeu F10 si le temps réel écoulé entre deux appuis `E` diffère. Documenté tel quel (sans corriger) dans `4-technique/rejeu-et-determinisme.md`, section Pièges | `grep -n "performance.now\|lastHeroLineAt" src/game/session/feedback.ts` (ligne 41-43) ; `grep -n "sanitaireReliefRandom" src/game/session/sanitaires.ts` (ligne 129 : tiré avant l'appel à `triggerHeroLine`, donc indépendant de son résultat) |


## Phase F — Technique, niveau et rendu (2026-09-26)

| Fichier | Affirmation de l'ancienne doc | Ce que dit le code | Preuve |
|---|---|---|---|
| `docs/3-architecture/invariants.md` (#4) et `AGENTS.md` (#4) | La résolution interne 640×360 est présentée comme non négociable ; `cassandre.resolution` est décrite comme un outil de comparaison seulement | Le menu Affichage propose aussi 960×540, 1280×720 et 1600×900. `setGraphicsSettings` applique ces valeurs au renderer en jeu. Le défaut reste 640×360, mais l'implémentation et la formulation stricte de l'invariant ne concordent pas | `src/game/graphicsSettings.ts::RESOLUTION_PRESETS`, `setGraphicsSettings` et `applyRenderSettings` ; `src/render/renderer.ts::setResolutionInterne` ; `src/ui/screens/options/display/DisplayTab/DisplayTab.tsx` |


## Phase G — Interface, audio et outillage (2026-09-26)

| Fichier | Affirmation de l'ancienne doc ou du commentaire | Ce que dit le code | Preuve |
|---|---|---|---|
| `src/core/audio.ts` (commentaire de tête) | Tous les sons du jeu sont synthétisés par code depuis le 2026-09-20 | Le studio audio déclare une recette hybride `ceramic_break` qui combine des prises réelles de vaisselle Kenney et des couches de synthèse ; les autres recettes du catalogue sont synthétisées actuellement | `tools/audio/README.md` indique explicitement une recette hybride ; `tools/audio/recipes.py::ceramic_break` appelle `prise(ASSIETTE...)` pour les couches de fracture |
