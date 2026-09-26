---
title: Charte éditoriale (D1)
tags: [chantier, documentation, charte]
status: brouillon
updated: 2026-09-25
---

# Charte éditoriale (D1)

Jalon D1 du `PLAN_DOCUMENTATION.md`. Partie **auteur** : gabarits, ton, règles
de citation, règles de diagramme, gestion des écarts. Destinée à devenir un
skill (`docs-structure` révisé, ou un nouveau skill dédié — voir la dernière
section). Toute personne ou tout agent qui écrit une page dans `docs/` suit
cette charte.

## Ton

- Français, présent de l'indicatif. Pas de futur ni de conditionnel de
  politesse (« le système gère » plutôt que « le système gèrera »).
- Phrases courtes. Une idée par phrase. Préférez deux phrases à une phrase à
  virgules.
- On s'adresse au lecteur en « vous » (guides et introduction surtout ; les
  pages technique/architecture peuvent rester impersonnelles).
- Aucun jargon non défini. Un terme du glossaire (`1-introduction/glossaire.md`)
  s'emploie librement une fois qu'il y figure ; un terme qui n'y figure pas
  encore doit y être ajouté avant d'être utilisé ailleurs.
- Pas d'historique de bug dans une page fonctionnelle, architecture ou
  technique. Un bug corrigé, une passe de playtest, une décision datée : ça va
  au journal (`journal/`). Une page technique décrit l'état actuel du code,
  jamais comment on y est arrivé.
- Le **pourquoi** d'un choix de conception ne se répète pas : il vit dans son
  ADR (`decisions/NNNN-*.md`). Une page qui a besoin de le mentionner met un
  lien, pas un résumé de plus d'une phrase.
- Pas d'exclamation, pas d'emphase décorative. Le sérieux du ton n'empêche pas
  de nommer le ton satirique du JEU quand la page en parle (ex. `le-projet.md`).

## Citer le code, une fonction, un ADR, une autre page

- **Fichier** : chemin depuis la racine du dépôt, entre backticks, jamais de
  chemin absolu ni relatif au fichier doc : `src/core/loop.ts`,
  `tools/blender/build_niveau.py`. C'est ce chemin que l'outil de D2 vérifie.
- **Fonction ou symbole** : `NomDeFonction` seul si le fichier vient d'être
  cité, sinon `` `src/game/level/doors.ts::DoorSystem` `` (fichier `::` symbole)
  la première fois dans une section.
- **ADR** : lien relatif vers `decisions/NNNN-titre.md`, jamais un numéro nu
  (« voir ADR 0031 » sans lien). Le titre du lien reprend l'intitulé de l'ADR,
  pas « ici » ou « ce document ».
- **Autre page de la doc** : lien relatif standard, `[texte](../4-technique/rendu.md)`.
  Jamais de wikilink `[[...]]` — ils ne survivent pas à un export Notion.
  Si la page ciblée n'existe pas encore (chantier en cours), texte simple avec
  le chemin prévu entre backticks, pas de lien cassé.

## Règles de diagramme (Mermaid)

- **Quand** : dès qu'il y a un flux (des données qui passent d'un module à un
  autre), un cycle (une boucle d'état, un pas fixe), ou une dépendance
  (qui importe qui, qui appelle qui). Une simple liste à puces qui suffit ne
  justifie pas un diagramme.
- **Types autorisés** : `flowchart`, `sequenceDiagram`, `stateDiagram-v2`.
  Pas d'autre type (pas de `gantt`, `classDiagram`, etc.) sauf besoin
  explicite validé au cas par cas.
- **Taille** : 15 nœuds maximum. Au-delà, découpez en plusieurs diagrammes
  (vue d'ensemble + détail d'une branche) plutôt que de tout montrer.
- **Libellés en français**, courts, pas de code brut dans un libellé (un nom
  de fonction peut y figurer entre backticks si le rendu Mermaid le supporte,
  sinon en clair).
- **Pas de HTML** dans un bloc Mermaid (pas de `<br/>` pour forcer un retour à
  la ligne, préférez un libellé plus court).
- Le bloc Mermaid est précédé d'une phrase qui dit ce qu'il montre — un
  diagramme ne remplace jamais sa légende.

## Le code fait foi — procédure en cas d'écart

Chaque page s'écrit en lisant le code, pas en recopiant l'ancienne doc.
Quand l'ancienne doc (ou une intuition) dit une chose et que le code en dit
une autre :

1. **Ne corrigez pas le code.** Ce chantier documente, il ne change pas le
   comportement du jeu (sauf les renvois `see: docs/…`, hors scope de D1).
2. **Ajoutez une ligne à `docs/_chantier/ecarts.md`** avec : le fichier
   concerné, ce qu'affirmait l'ancienne doc, ce que dit le code (avec chemin
   et si possible ligne), et la preuve (extrait, commande, comportement
   observé).
3. **Écrivez la page d'après le code**, pas d'après l'écart. La page ne
   mentionne pas l'écart — c'est `ecarts.md` qui le porte, jusqu'à décision.
4. Signalez l'écart à l'utilisateur dans votre rapport de jalon : c'est lui
   qui tranche si c'est un bug à corriger, un comportement voulu à documenter
   tel quel, ou une ancienne doc simplement obsolète.

## Champ `status` et `updated`

- `status: brouillon` — page écrite mais pas encore relue contre le code par
  quelqu'un d'autre que son auteur, ou jalon pas encore clos.
- `status: stable` — relue, vérifiée contre le code à la date `updated`, prête
  à être citée comme référence.
- `status: perime` — contenu qu'on garde (une ancre y pointe peut-être encore)
  mais qui ne décrit plus l'état actuel. Utilisé pour `archive/` (D64) et pour
  toute page qu'on sait dépassée sans avoir le temps de la corriger tout de
  suite.
- `updated` — date de la **dernière vérification contre le code**, pas la date
  d'écriture si la page a été relue depuis sans changer. Une modification de
  code qui change un comportement documenté doit faire remonter cette date
  dans le même commit (règle d'entretien, D70).

## Gabarits par type de page

Chaque gabarit liste les sections **obligatoires, dans l'ordre**. Une section
absente d'un gabarit ne s'ajoute pas librement : si un contenu ne rentre nulle
part, c'est le signe qu'il appartient à une autre page (souvent le journal ou
un ADR).

### Fonctionnel (`2-fonctionnel/*.md`)

Décrit ce que **vit le joueur**. Zéro ligne de code, zéro nom de fonction.
Longueur visée : **60 à 120 lignes**.

| Section | Contenu | Ne contient PAS |
|---|---|---|
| Ce que vit le joueur | Description à la première expérience : ce qu'on voit, ce qu'on fait, dans l'ordre où ça arrive | Comment c'est implémenté |
| Règles | Les règles observables (« un secret compte pour le score une fois trouvé », « la porte s'ouvre à la touche E ») | Les valeurs numériques exactes |
| Valeurs | Renvoi vers `6-reference/*.md` pour les nombres précis (dégâts, PV, délais) | Les nombres recopiés en dur (ils dérivent) |
| État | Ce qui est **validé en playtest** vs ce qui **attend un verdict**, avec la date | Une opinion sur si c'est fun |
| Pour aller plus loin | Liens vers la page technique correspondante | Une explication technique |

Squelette :

```markdown
---
title: <Titre>
tags: [fonctionnel]
status: brouillon
updated: 2026-09-25
---

# <Titre>

## Ce que vit le joueur

## Règles

## Valeurs

Détail chiffré : [<page référence>](../6-reference/<page>.md).

## État

- Validé en playtest le <date> : <quoi>.
- En attente de verdict : <quoi>.

## Pour aller plus loin

- [<Système technique>](../4-technique/<page>.md)
```

### Architecture (`3-architecture/*.md`)

Décrit **comment le tout est découpé et pourquoi**, à un niveau au-dessus du
code. Longueur visée : **80 à 150 lignes**, diagramme compris.

| Section | Contenu | Ne contient PAS |
|---|---|---|
| Rôle | Ce que ce découpage résout, en une ou deux phrases | Le détail d'implémentation d'un module |
| Diagramme | Un `flowchart` ou `stateDiagram-v2` des blocs et de leurs relations | Plus de 15 nœuds |
| Règles | Ce qui est permis, ce qui est interdit entre les blocs (ex. « React ne touche jamais la boucle ») | Une règle sans conséquence énoncée |
| Invariants concernés | Liste des invariants du jeu que cette architecture protège, avec lien vers `3-architecture/invariants.md` | Le texte complet de l'invariant (déjà là-bas) |
| Décisions | Liens vers les ADR pertinents | Le raisonnement de l'ADR recopié |

Squelette :

```markdown
---
title: <Titre>
tags: [architecture]
status: brouillon
updated: 2026-09-25
---

# <Titre>

## Rôle

## Diagramme

\`\`\`mermaid
flowchart TD
  A[...] --> B[...]
\`\`\`

## Règles

## Invariants concernés

- [Invariant #<n>](invariants.md) — <raison courte>

## Décisions

- [ADR <NNNN> — <titre>](../decisions/<NNNN>-<titre>.md)
```

### Technique (`4-technique/*.md`)

**Un système par page**, décrit de l'intérieur. C'est le gabarit le plus
consulté en travaillant sur le code. Longueur visée : **120 à 250 lignes** ;
au-delà, découpez le système en deux pages plutôt que d'allonger.

| Section | Contenu | Ne contient PAS |
|---|---|---|
| Responsabilité | Ce dont ce système a la charge, en une phrase, et ce qu'il ne fait PAS (frontière avec le système voisin) | Un historique de comment on y est arrivé |
| Fichiers | Liste des fichiers concernés, chemin depuis la racine, avec un mot sur le rôle de chacun | Le contenu du fichier recopié |
| Où ça s'insère dans la boucle | À quel moment du pas fixe / du rendu / du chargement ce système agit | La boucle elle-même (renvoi à `boucle-et-temps.md`) |
| Données et contrats | Formes de données en entrée/sortie, événements émis/consommés, types clés | Le code source complet d'un type |
| Pièges | Ce qui a fait échouer une tentative naïve, avec la raison mesurée | Une anecdote sans conséquence pratique |
| Tests | Fichiers de test qui couvrent ce système, ce qu'ils garantissent | Le contenu des tests |
| Comment vérifier que ça marche | Commande ou geste concret pour confirmer que le système fonctionne (console `cassandre`, `pnpm test -- <filtre>`) | Une simple affirmation « ça marche » |

Squelette :

```markdown
---
title: <Titre>
tags: [technique]
status: brouillon
updated: 2026-09-25
---

# <Titre>

## Responsabilité

Fait : ...
Ne fait pas : ...

## Fichiers

- `src/...` — ...

## Où ça s'insère dans la boucle

## Données et contrats

## Pièges

## Tests

- `src/....test.ts` — ...

## Comment vérifier que ça marche
```

### Recette (`5-guides/*.md`, hors guides transverses)

**Pas à pas**, orienté action, appuyé sur un vrai commit du dépôt comme
exemple. Longueur visée : **100 à 200 lignes**.

| Section | Contenu | Ne contient PAS |
|---|---|---|
| Objectif | Ce que le lecteur aura accompli à la fin, en une phrase | Le détail des étapes |
| Avant de commencer | Prérequis (outils lancés, fichiers à connaître, page technique à lire d'abord) | Une répétition de la page technique |
| Étapes | Numérotées, fichier par fichier, dans l'ordre réel où on les fait | Des étapes optionnelles non signalées comme telles |
| Vérifier | Comment savoir que ça a marché (commande, capture, comportement en jeu) | « ça devrait marcher » sans moyen de vérifier |
| Pièges | Erreurs connues à cette étape précise, avec leur symptôme | Des pièges génériques déjà dans `pieges-connus.md` (lien plutôt que redite) |
| Exemple réel | Un commit du dépôt qui a suivi ces étapes, avec son hash court | Un exemple inventé |

Squelette :

```markdown
---
title: <Titre>
tags: [guide, recette]
status: brouillon
updated: 2026-09-25
---

# <Titre>

## Objectif

## Avant de commencer

## Étapes

1. ...
2. ...

## Vérifier

## Pièges

## Exemple réel

Commit `<hash court>` : <résumé>.
```

### Journal (`journal/*.md`)

**Une page par chantier ou par période, datée.** C'est la seule catégorie qui
a le droit de raconter un historique, des tentatives rejetées, des dates.
Longueur visée : **libre**, guidée par ce qui s'est réellement passé (les
entrées existantes dans `CLAUDE.md` font 20 à 200 lignes selon le chantier) —
mais toujours découpée par période, jamais un unique fichier qui grossit sans
fin.

| Section | Contenu | Ne contient PAS |
|---|---|---|
| Période | Date ou plage de dates du chantier | — |
| Objectif | Ce qui était demandé au départ | Le résultat (section suivante) |
| Ce qui a été livré | Ce qui a été fait, vérifié comment | Une répétition de la page technique — renvoyez-y |
| Ce qui a été rejeté et pourquoi | Tentatives abandonnées, retours de playtest négatifs, avec la raison réelle | Une tentative jamais essayée |
| Leçons | Ce qui généralise au-delà de ce chantier précis | Une leçon triviale ou déjà connue |

Squelette :

```markdown
---
title: <Titre du chantier>
tags: [journal]
status: brouillon
updated: 2026-09-25
---

# <Titre du chantier>

## Période

<date ou plage>

## Objectif

## Ce qui a été livré

## Ce qui a été rejeté et pourquoi

## Leçons
```

### `README.md` de dossier

Sommaire du dossier + à qui il s'adresse. Longueur visée : **15 à 40 lignes**,
jamais un résumé du contenu des pages (ça se périme trop vite).

| Section | Contenu | Ne contient PAS |
|---|---|---|
| Titre + une phrase | Ce que couvre ce dossier | — |
| À qui ça s'adresse | Le profil de lecteur concerné (dev gameplay, level designer, tout le monde…) | Une liste de profils qui ne lisent jamais ce dossier |
| Sommaire | Liste à puces des pages du dossier avec une description d'une ligne chacune | Le contenu des pages |

Squelette :

```markdown
---
title: <Nom du dossier>
tags: [sommaire]
status: brouillon
updated: 2026-09-25
---

# <Nom du dossier>

<Une phrase sur ce que couvre ce dossier.>

À qui ça s'adresse : <profil>.

- [<page>](<page>.md) — <description en une ligne>
- [<page>](<page>.md) — <description en une ligne>
```

## Checklist de relecture d'une page

1. Le frontmatter a ses 4 champs, `status` et `updated` sont cohérents avec
   l'état réel de la page.
2. Un seul `#` en tête, pas de second niveau 1.
3. Chaque chemin `src/…` ou `tools/…` cité existe (vérifiable par l'outil de
   D2, mais relisez à l'œil en attendant).
4. Chaque terme technique employé est dans le glossaire, ou y a été ajouté.
5. Aucun historique de bug/playtest daté hors d'une page journal.
6. Aucun *pourquoi* de choix de conception recopié depuis un ADR — un lien
   suffit.
7. Aucun wikilink `[[...]]`, aucun lien absolu vers ce dépôt, aucun lien cassé
   (page pas encore écrite → texte simple + chemin en backticks).
8. Les sections du gabarit sont toutes présentes, dans l'ordre, sans section
   étrangère ajoutée.
9. La longueur reste dans la fourchette visée du type de page (ou la raison
   du dépassement est claire : plusieurs sous-systèmes qui méritent un
   découpage).
10. Un diagramme Mermaid, s'il y en a un, respecte les règles ci-dessus
    (type autorisé, ≤ 15 nœuds, libellés en français, pas de HTML).

## Modifications à apporter au skill docs-structure

Appliqué en D2.
