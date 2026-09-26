# PLAN — La vraie documentation (`PROJET_CASSANDRE`)

> Chantier de documentation, pas de code. Aujourd'hui, `docs/` est la trace de
> tout ce qui a été fait : des commentaires sortis du code, rangés par dossier,
> utiles à qui connaît déjà le projet et illisibles pour qui le découvre. Le
> but est une documentation **structurée**, qui dit ce qu'est le projet, ce que
> fait le jeu, comment il est construit, comment chaque système fonctionne, et
> surtout **où agir** quand on veut changer quelque chose.

---

## 0. Cadrage

### Décisions actées (2026-09-25)

| Question | Décision |
|---|---|
| Lecteur principal | **Un développeur humain** qui reprend le projet sans contexte. Les agents la lisent aussi, mais leurs règles restent dans `CLAUDE.md`, les skills et les fiches d'agents |
| Sort de la doc actuelle | **Réécrire et archiver.** La nouvelle doc est rédigée à neuf ; l'existant sert de matière première puis part dans `docs/archive/`. Les ADR restent tels quels : ce sont déjà de vrais documents |
| Support | **Markdown dans `docs/`**, portable Notion/Obsidian, vérifié par `check_docs_links.py`. Aucune dépendance en plus |
| Journal « Phase courante » de `CLAUDE.md` | **Sorti dans `docs/journal/`**, daté. `CLAUDE.md` garde les invariants, les conventions et un état courant court, avec des liens |
| Rythme | Beaucoup de petits jalons, un livrable relisible à chaque fois. Pas de délai |

### Constat de départ (mesuré le 2026-09-25)

- **Environ 12 000 lignes** dans `docs/`, dont 33 ADR. Les plus gros fichiers
  (`rendu.md` 894 lignes, `niveau-blender.md` 714, `session.md` 584) mélangent
  fonctionnement, historique de bugs et pièges.
- **406 renvois** vers `docs/…` depuis **269 fichiers** (code, outils, agents,
  skills). `session.md` à lui seul est cité 43 fois dans `src/`. Archiver sans
  réécrire ces renvois casse la navigation depuis le code : c'est le risque
  principal du chantier (voir jalon D3).
- `CLAUDE.md` fait plusieurs centaines de lignes, dont l'essentiel est un
  journal de chantier. Il n'existe **aucune** page « par où commencer », aucun
  glossaire, aucune carte « je veux changer X, je touche Y ».
- Des pages existantes décrivent un état dépassé (ex. `session.md` parle
  encore de `door_e_exit` comme porte de sortie). La doc actuelle ne peut
  donc pas être recopiée : **la source de vérité est le code**.

### Principes transverses (valables sur tous les jalons)

1. **Le code fait foi.** Chaque page est écrite en lisant le code, pas
   seulement l'ancienne doc. L'ancienne doc donne des pistes et le *pourquoi* ;
   le code donne le *quoi*.
2. **Un écart n'est jamais corrigé en silence.** Un écart entre le code et
   l'ancienne doc, ou un comportement qui semble être un bug, va dans la liste
   `docs/_chantier/ecarts.md` et vous est remonté. Ce chantier ne touche pas au
   code (sauf les renvois `see: docs/…`, voir D3).
3. **Chaque page dit à quelle date elle a été vérifiée** (`updated` du
   frontmatter) et cite les fichiers qu'elle décrit. Un outil vérifie que ces
   chemins existent (D2).
4. **Un sujet par page, une page par besoin.** Une page fonctionnelle ne parle
   pas d'implémentation ; une page technique ne raconte pas l'historique des
   bugs. L'historique va au journal, le *pourquoi* d'un choix va à son ADR.
5. **Un diagramme dès qu'il y a un flux, un cycle ou une dépendance.** Mermaid,
   qui se dégrade proprement dans Notion.
6. **Rien n'est supprimé.** L'ancienne doc part à l'archive, le journal garde
   l'historique, git garde le reste.
7. **Portabilité inchangée** : liens relatifs, pas de wikilinks, frontmatter à
   quatre champs, deux niveaux de dossier maximum (skill `docs-structure`).

### Hors scope

Toute modification de gameplay, de rendu ou d'outillage · la génération d'API
depuis le TSDoc · un site de doc · la traduction en anglais · la réécriture des
ADR (seul leur index est retouché).

---

## 1. Arborescence cible

```
docs/
  README.md             la carte : par où commencer selon ce qu'on cherche
  1-introduction/       le projet, démarrage rapide, glossaire
  2-fonctionnel/        ce que fait le jeu, vu du joueur
  3-architecture/       comment le tout est découpé et pourquoi
  4-technique/          comment chaque système fonctionne à l'intérieur
  5-guides/             reprendre le projet, où agir, recettes pas à pas
  6-reference/          tables de valeurs, conventions, commandes, console
  decisions/            ADR (chemin INCHANGÉ : des dizaines de renvois y pointent)
  journal/              historique daté des chantiers et des playtests
  archive/              l'ancienne doc, figée, marquée `perime`
  assets/               images et SVG
  _chantier/            fichiers de travail du chantier, supprimés à la fin
```

Les préfixes numériques imposent l'ordre de lecture dans Obsidian comme dans
Notion. Chaque dossier a son `README.md` (sommaire + à qui il s'adresse).

### Contenu visé, page par page

**1 — Introduction**
- `le-projet.md` — le pitch, le ton satirique, les références (Duke 3D, Ion
  Fury), le périmètre du prototype, où en est le projet
- `demarrage-rapide.md` — installer, lancer, le menu, le menu dev, la console
  `cassandre`, les commandes `pnpm`, Blender et Python si on touche au contenu
- `glossaire.md` — Costard, Directeur, pas fixe, lot de dessin, `LevelDef`,
  `GameSession`, `use_*`, carte de fidélité, hitstop, rejeu d'input… Le projet
  mélange français et anglais : le glossaire fait le pont
- `comment-lire-cette-doc.md` — les six parties, les parcours conseillés selon
  le profil (dev gameplay, level designer, son, UI)

**2 — Fonctionnel** (aucune ligne de code, des renvois vers la technique)
- `experience-de-jeu.md` — la boucle du joueur : explorer, combattre, trouver
  les cartes, les secrets, le Directeur, la sortie
- `deplacement-et-controles.md`
- `armes.md` — pied-de-biche, pompe, pistolet, munitions, ramassages
- `ennemis.md` — Costard et Directeur : comportements observables, télégraphie
- `le-niveau.md` — l'hypermarché, les dix espaces, le hub, la progression par
  cartes, le plan de masse
- `objets-interactifs.md` — portes, vitres, props, sanitaires, soins, `E`
- `secrets-et-score.md` — secrets, barème, récap de fin
- `interface.md` — menus, HUD « stream », pause, options, mort, fin
- `son.md` — ce qu'on entend et pourquoi (familles, ambiances, répliques)

**3 — Architecture**
- `vue-d-ensemble.md` — les quatre blocs (moteur TS, overlay React, outillage
  Blender/Python, studio audio) et les assets qui les relient
- `invariants.md` — les 13 invariants, chacun avec sa raison, ce qui casse si
  on le viole, et son ADR
- `carte-des-modules.md` — `src/core`, `physics`, `render`, `game`, `ui`,
  `app` : qui a le droit d'importer qui, graphe de dépendances
- `boucle-et-temps.md` — pas fixe, interpolation, hitstop, frontière
  synchrone Effect
- `simulation-et-presentation.md` — ce qui se décide au pas fixe, ce qui se
  dessine au taux d'affichage, comment l'information passe de l'un à l'autre
- `cycle-de-vie.md` — boot, `PersistentEngine`/`GameSession`, reset, chargement
  asynchrone
- `effect-et-xstate.md` — où et pourquoi, les deux modes d'exécution, les
  machines existantes
- `flux-de-donnees.md` — input → gameplay → état → store zustand → HUD
- `pipelines-de-contenu.md` — Blender → glTF → loader ; recettes → audio
  sprite ; générateurs de textures et de sprites

**4 — Technique** (un système par page, même gabarit partout)
- `physique.md`, `joueur.md`, `armes.md`, `ennemis-et-ia.md`, `pathfinding.md`
- `chargement-de-niveau.md` — loader, conventions glTF, fusion du décor, hot
  reload
- `systemes-de-niveau.md` — portes, props, vitres, sanitaires, interactifs
- `rendu.md`, `sprites-et-viewmodel.md`, `eclairage.md`, `budget-de-rendu.md`
- `session-et-score.md`, `rejeu-et-determinisme.md`
- `interface-react.md` — store, machine de flux, structure `src/ui/`
- `audio-runtime.md`
- `outillage-blender.md`, `studio-audio.md`, `generateurs.md` (textures, sprites)
- `tests-et-qualite.md` — vitest, CI, `pnpm check`, contrôles des docs,
  validations Python
- `debug.md` — console `cassandre`, panneau de debug, touches, harnais A/B

**5 — Guides** (le cœur de la demande)
- `reprendre-le-projet.md` — le parcours du premier jour : quoi lire, dans
  quel ordre, quoi lancer, quoi essayer, à qui/quoi se fier
- `ou-agir.md` — la table centrale : « je veux changer X » → fichiers à
  toucher, page technique, tests à lancer, pièges connus. Une ligne par
  fonctionnalité du jeu
- Recettes pas à pas, chacune appuyée sur un vrai commit du dépôt comme
  exemple :
  `ajouter-un-ennemi.md`, `ajouter-une-arme.md`,
  `ajouter-un-objet-interactif.md` (nouveau préfixe glTF de bout en bout),
  `modifier-le-niveau.md` (session Blender live, build, audit, export),
  `ajouter-un-son.md`, `ajouter-un-ecran-ou-un-widget.md`,
  `regler-la-sensation.md`, `ajouter-un-niveau.md`,
  `diagnostiquer-un-bug-de-simulation.md` (rejeu F9/F10),
  `mesurer-une-perf.md`, `ecrire-un-adr.md`
- `conventions-de-code.md` — TypeScript, Effect, React (renvoie aux quatre
  règles React), commentaires, commits, `pnpm`
- `pieges-connus.md` — tous les « pièges payés » aujourd'hui dispersés dans
  `CLAUDE.md` et l'ancienne doc, classés par domaine
- `travailler-avec-les-agents.md` — pour un humain qui reprend avec Claude :
  quel agent pour quoi, quels skills, ce qu'ils ne savent pas vérifier

**6 — Référence**
- reprise, relue et mise à jour : `valeurs-deplacement.md`,
  `valeurs-ennemis.md`, `conventions-nommage.md`, `controles.md`, les quatre
  `react-*.md`, `threejs-rapier.md`
- nouvelles : `commandes.md` (tous les scripts `pnpm` et Python, avec leurs
  options), `console-cassandre.md` (l'API complète), `arborescence.md` (chaque
  dossier du dépôt en une ligne)

**Journal**
- une page par chantier ou par période, datée : les phases 0-6, le chantier
  Effect/XState, le niveau v2 (N0-N9), le son, les passes Blender live, les
  playtests. Matière : `CLAUDE.md` « Phase courante », les trois `PLAN_*.md`,
  `git log`

---

## 2. Gabarits de page

Fixés au jalon D1, appliqués partout. En résumé :

| Type | Sections |
|---|---|
| **Fonctionnel** | Ce que vit le joueur · Règles · Valeurs (renvoi référence) · État (validé en playtest ou non) · Pour aller plus loin (technique) |
| **Architecture** | Rôle · Diagramme · Règles (ce qui est permis, interdit) · Invariants concernés · Décisions (ADR) |
| **Technique** | Responsabilité · Fichiers · Où ça s'insère dans la boucle · Données et contrats · Pièges · Tests · Comment vérifier que ça marche |
| **Recette** | Objectif · Avant de commencer · Étapes numérotées (fichier par fichier) · Vérifier · Pièges · Exemple réel (commit) |
| **Journal** | Période · Objectif · Ce qui a été livré · Ce qui a été rejeté et pourquoi · Leçons |

---

## 3. Jalons

Chaque jalon produit un livrable relisible seul et se termine par
`pnpm check:docs` vert. **Une relecture de votre part clôt chaque phase**
(A à J) ; à l'intérieur d'une phase, j'enchaîne sauf si vous voulez relire
jalon par jalon.

### Phase A — Préparer le terrain

**D0 — Inventaire.** Table de toutes les sources de connaissance : chaque
fichier de `docs/`, `CLAUDE.md`, `AGENTS.md`, les trois `PLAN_*.md`, les
`README.md` de `tools/`, les fiches d'agents et les skills. Pour chaque
section : sa nature (fonctionnel, technique, architecture, guide, journal,
périmé) et sa page de destination. Livrable :
`docs/_chantier/inventaire.md`. *Fini quand* : aucune section sans
destination.

**D1 — Charte éditoriale.** Les gabarits de la section 2 en détail, le ton
(phrases courtes, présent, vous), la longueur visée par type de page, les
règles de diagramme, la façon de citer un fichier et un ADR. Mise à jour du
skill `docs-structure` pour la nouvelle arborescence. Livrable :
`docs/1-introduction/comment-lire-cette-doc.md` (partie lecteur) et
`docs/_chantier/charte.md` (partie auteur, destinée à devenir un skill).

**D2 — Squelette et outillage.** Création des dossiers, d'un `README.md` par
dossier et de pages vides en `status: brouillon`. Extension de
`check_docs_links.py` : ignorer `archive/` et `_chantier/` pour les
orphelins, **vérifier que tout chemin `src/…` ou `tools/…` cité dans une page
existe**, signaler une page `brouillon` sans contenu. Tests Python mis à jour.
*Fini quand* : `pnpm check:docs` et `pnpm check:docs:test` verts.

**D3 — Stratégie des renvois depuis le code.** Les 406 renvois `docs/…`
restent valides pendant tout le chantier : l'ancienne doc ne bouge pas avant
la phase I. Ici on écrit le script qui, le moment venu, réécrira chaque
renvoi : vers la nouvelle page technique quand son contenu y a été repris,
vers `archive/` sinon. La table de correspondance ancien → nouveau se
remplit au fil des jalons. Livrable : `tools/docs/remap_anchors.py` + tests,
en mode simulation uniquement.

### Phase B — Introduction

**D4 — `le-projet.md`.**
**D5 — `demarrage-rapide.md`**, vérifié en déroulant chaque commande sur une
copie propre du dépôt.
**D6 — `glossaire.md`** (première version, enrichie à chaque phase).
**D7 — `docs/README.md`**, la nouvelle carte : quatre entrées selon le besoin
(« je découvre », « je veux comprendre », « je veux modifier », « je cherche
une valeur »).

### Phase C — Architecture

**D8 — `vue-d-ensemble.md`**, avec le diagramme des quatre blocs.
**D9 — `invariants.md`**, les 13, chacun relié à son ADR et au test qui le
garde quand il en existe un (et signalé quand il n'en existe pas).
**D10 — `carte-des-modules.md`**, graphe d'imports mesuré sur le code (pas
dessiné de mémoire), règles de dépendance observées et violations trouvées.
**D11 — `boucle-et-temps.md`.**
**D12 — `simulation-et-presentation.md`**, en reprenant l'audit du
2026-09-24.
**D13 — `cycle-de-vie.md`.**
**D14 — `effect-et-xstate.md`.**
**D15 — `flux-de-donnees.md`.**
**D16 — `pipelines-de-contenu.md`.**

### Phase D — Fonctionnel

**D17 — `experience-de-jeu.md`.**
**D18 — `deplacement-et-controles.md`.**
**D19 — `armes.md`.**
**D20 — `ennemis.md`.**
**D21 — `le-niveau.md`**, avec le plan de masse.
**D22 — `objets-interactifs.md`.**
**D23 — `secrets-et-score.md`.**
**D24 — `interface.md`.**
**D25 — `son.md`.**

Chaque page dit ce qui a été **validé en playtest** et ce qui **attend un
verdict** — sans quoi un repreneur prend un brouillon pour un acquis.

### Phase E — Technique, simulation

**D26 — `physique.md`.**
**D27 — `joueur.md`.**
**D28 — `armes.md`.**
**D29 — `ennemis-et-ia.md`.**
**D30 — `pathfinding.md`.**
**D31 — `session-et-score.md`.**
**D32 — `rejeu-et-determinisme.md`.**

### Phase F — Technique, niveau et rendu

**D33 — `chargement-de-niveau.md`.**
**D34 — `systemes-de-niveau.md`.**
**D35 — `rendu.md`.**
**D36 — `sprites-et-viewmodel.md`.**
**D37 — `eclairage.md`.**
**D38 — `budget-de-rendu.md`.**

### Phase G — Technique, interface, son, outillage

**D39 — `interface-react.md`.**
**D40 — `audio-runtime.md`.**
**D41 — `outillage-blender.md`.**
**D42 — `studio-audio.md`.**
**D43 — `generateurs.md`.**
**D44 — `tests-et-qualite.md`.**
**D45 — `debug.md`.**

### Phase H — Guides et référence

**D46 — Référence** : reprise des pages existantes, puis `commandes.md`,
`console-cassandre.md`, `arborescence.md`.
**D47 — `ou-agir.md`**, construit à partir de toutes les pages techniques :
chaque ligne cite ses fichiers (vérifiés par l'outil de D2).
**D48 — `pieges-connus.md`.**
**D49 — `conventions-de-code.md`.**
**D50 à D60 — une recette par jalon**, dans cet ordre : objet interactif,
modifier le niveau, son, écran ou widget, sensation, arme, ennemi, niveau,
bug de simulation, perf, ADR. Chacune suit un vrai commit du dépôt pour
vérifier que les étapes sont complètes.
**D61 — `travailler-avec-les-agents.md`.**
**D62 — `reprendre-le-projet.md`**, écrit en dernier parce qu'il renvoie à
tout le reste.

### Phase I — Journal et bascule

**D63 — Journal.** Découpage du « Phase courante » de `CLAUDE.md` et des
`PLAN_*.md` terminés en pages datées. Les plans encore ouverts
(`PLAN_NIVEAU_V2.md`, N10 restant) restent à la racine.
**D64 — Archive.** L'ancienne doc part dans `docs/archive/`, marquée
`status: perime` avec un bandeau qui renvoie à la page qui la remplace.
**D65 — Réécriture des renvois.** Le script de D3 passe pour de vrai sur les
269 fichiers ; relecture du diff ; `pnpm check:docs --strict` vert.
**D66 — `CLAUDE.md` et `AGENTS.md` allégés** : invariants, conventions, un
état courant de quelques lignes, des liens. Les fiches d'agents et les skills
qui citent des pages déplacées sont mises à jour.
**D67 — Index des ADR** retouché : une ligne de résumé et le statut par ADR,
regroupés par domaine.

### Phase J — Validation et entretien

**D68 — Test du repreneur.** Un agent lecteur « à froid » (sans `CLAUDE.md`,
sans mémoire, sans accès au code au départ) reçoit dix questions réelles
(« où changer les dégâts du pompe ? », « comment ajouter un préfixe glTF ? »,
« pourquoi pas de `Math.random()` ? »…) et doit y répondre avec la doc seule,
puis vérifier sa réponse dans le code. Chaque échec devient une correction.
**D69 — Votre relecture complète**, parcours « je découvre » de bout en bout.
**D70 — Règles d'entretien** : une modification qui change un comportement
documenté met à jour sa page dans le même commit ; `pnpm check:docs` rejoint
`pnpm check` et la CI ; le skill `docs-structure` et l'agent `doc-keeper`
reflètent la nouvelle organisation. Suppression de `docs/_chantier/`.

---

## 4. Risques

| Risque | Parade |
|---|---|
| Recopier l'ancienne doc et ses erreurs | Principe 1 : chaque page s'écrit en lisant le code ; outil de D2 sur les chemins |
| Casser les 406 renvois depuis le code | Rien ne bouge avant D65 ; script testé et relu en simulation d'abord (D3) |
| Deux docs qui divergent pendant le chantier | L'ancienne doc est gelée dès D2 : les chantiers de jeu parallèles écrivent dans la nouvelle page si elle existe, sinon dans `_chantier/a-reprendre.md` |
| Des pages qui sonnent juste mais sont creuses | Gabarits imposés, test du repreneur (D68), vos relectures de phase |
| Perdre un piège « load-bearing » en réécrivant | L'inventaire (D0) donne une destination à chaque section ; `pieges-connus.md` les rassemble |
| Le chantier s'essouffle au milieu | Chaque phase laisse une doc utilisable : la nouvelle carte (D7) renvoie vers l'ancienne pour ce qui n'est pas encore écrit |

---

## 5. Ce dont j'ai besoin de votre côté

Rien ne bloque le démarrage de la phase A. Pour la suite :

1. **Un agent `lecteur-a-froid`** (nécessaire à D68, utile dès la phase C
   pour relire chaque page) : outils `Read`, `Glob`, `Grep` seulement, **pas**
   de chargement de `CLAUDE.md` ni de la mémoire, consigne de répondre
   uniquement depuis `docs/` puis de signaler ce qu'il n'a pas trouvé ou ce
   qu'il a dû deviner.
2. **Une révision de l'agent `doc-keeper`** : sa règle « jamais supprimer,
   toujours déplacer » est faite pour la migration de commentaires ; elle
   doit admettre le mode « réécrire, puis archiver » de ce chantier, et
   connaître la nouvelle arborescence.
3. **Un skill `charte-documentaire`** tiré de `docs/_chantier/charte.md`
   (D1) : les gabarits et le ton, chargeable par n'importe quel agent qui
   écrit dans `docs/`. Je peux le rédiger moi-même si vous préférez.
4. **Optionnel** : `@mermaid-js/mermaid-cli` en dépendance de dev, pour que
   `check:docs` valide la syntaxe des diagrammes au lieu de les découvrir
   cassés dans Obsidian.

Deux choses que je ne sais pas faire seul et qui vous reviendront : juger si
la doc est **compréhensible** pour quelqu'un qui n'a pas vécu le projet (vos
relectures, et idéalement un vrai lecteur extérieur à D69), et trancher les
écarts de `ecarts.md` quand ils relèvent d'une décision de jeu.
