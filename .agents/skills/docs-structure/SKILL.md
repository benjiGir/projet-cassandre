---
name: docs-structure
description: Organisation, écriture et entretien de /docs — structure, portabilité, gabarits, statuts et liens. Charger avant toute rédaction ou révision documentaire.
---

# Structure et écriture de `/docs`

## Organisation

```text
docs/
  README.md             carte et parcours
  1-introduction/       pitch, démarrage, glossaire
  2-fonctionnel/        règles vécues par le joueur
  3-architecture/       frontières, flux et décisions
  4-technique/          fonctionnement des systèmes
  5-guides/             reprise et recettes de travail
  6-reference/          valeurs, commandes et contrats
  decisions/            ADR et alternatives retenues
  journal/              histoire datée et retours de playtest
  archive/              anciennes pages, status perime, bannière de remplacement
  assets/               images et fichiers visuels documentaires
```

Les préfixes numériques fixent l'ordre de lecture. Un sujet par page et deux
niveaux de dossiers au plus. Tout document courant doit être atteignable depuis
`docs/README.md` en deux sauts au plus. Les notes de travail durables vont dans
un guide, le journal ou un ADR ; ne créez pas de dossier de chantier temporaire.

## Ton et exactitude

- Écrivez en français, au présent, avec des phrases courtes et une idée par
  phrase. Adressez-vous au lecteur en « vous » dans les introductions et les
  guides. Définissez les termes du projet dans le glossaire.
- Le code actuel fait foi. Consultez-le avant d'écrire ou de réviser une
  description technique. Ne recopiez pas une ancienne page sans vérifier.
- Décrivez le fonctionnement courant dans les pages fonctionnelles,
  d'architecture et techniques. Gardez bugs, playtests, livraisons et tentatives
  rejetées dans `journal/`. Gardez le pourquoi, les options et les conséquences
  d'un choix durable dans un ADR.
- Si un écart de comportement ou d'invariant demande un arbitrage, ne changez
  pas le code en silence : décrivez la preuve et remontez la question, ou
  rédigez un ADR `propose` selon `adr-format`.
- Une modification de code qui change un comportement décrit met à jour la page
  correspondante et son `updated` dans le même changement.

## Portabilité, liens et sources

- Chaque page utilise quatre champs de frontmatter : `title`, `tags`, `status`,
  `updated`. Les statuts sont `brouillon`, `stable` et `perime`.
- `brouillon` signifie que la page attend une relecture indépendante ;
  `stable` signifie qu'elle a été vérifiée contre le code ; `perime` désigne un
  contenu conservé qui ne décrit plus l'état courant.
- Un fichier source est cité depuis la racine du dépôt, entre backticks :
  `src/core/loop.ts`. Ne mettez ni chemin absolu ni chemin relatif à la page.
- Les liens vers d'autres pages sont relatifs et standard :
  `[Boucle](../3-architecture/boucle-et-temps.md)`. Aucun wikilink `[[...]]`,
  lien web local au dépôt, HTML ou lien vers une page inexistante.
- Une page d'archive porte `status: perime` et une bannière qui renvoie à son
  remplacement courant. Réécrivez d'abord la page de remplacement, puis
  archivez l'ancienne ; les commentaires de code suivent leur skill séparé.
- Les images et SVG documentaires vivent dans `docs/assets/` et sont liés par
  un chemin relatif. Utilisez des tableaux Markdown standard.

## Diagrammes Mermaid

Ajoutez un diagramme lorsqu'il clarifie un flux, un cycle ou une dépendance.
Types autorisés : `flowchart`, `sequenceDiagram`, `stateDiagram-v2`. Limitez-le
à 15 nœuds, utilisez des libellés français courts et aucun HTML. Introduisez-le
par une phrase qui précise ce qu'il montre. Découpez un diagramme trop dense.

## Gabarits et longueur visée

Gardez les sections requises dans cet ordre. Si un contenu n'entre dans aucun
gabarit, il appartient probablement à une autre page, au journal ou à un ADR.

| Type | Sections dans l'ordre | Longueur indicative |
|---|---|---:|
| Fonctionnel (`2-fonctionnel/`) | Ce que vit le joueur · Règles · Valeurs avec renvoi à la référence · État playtesté ou en attente · Pour aller plus loin | 60–120 lignes |
| Architecture (`3-architecture/`) | Rôle · Diagramme · Règles permises/interdites et leurs conséquences · Invariants concernés · Décisions liées | 80–150 lignes |
| Technique (`4-technique/`) | Responsabilité et frontières · Fichiers · Place dans la boucle · Données et contrats · Pièges · Tests · Comment vérifier | 120–250 lignes |
| Recette (`5-guides/`) | Objectif · Avant de commencer · Étapes ordonnées par fichier · Vérifier · Pièges · Exemple réel avec commit | 100–200 lignes |
| Journal (`journal/`) | Période · Objectif · Livré et preuve · Rejeté et raison · Leçons | Libre, une période par page |
| Sommaire (`README.md`) | Titre et portée · À qui ça s'adresse · Liens vers les pages avec une ligne chacune | 15–40 lignes |

## Relecture

1. Les quatre champs de frontmatter, le statut et la date correspondent à
   l'état réel ; `updated` est la dernière vérification contre le code.
2. La page n'a qu'un titre `#`, en tête, et les sections sont dans l'ordre du
   gabarit.
3. Chaque chemin `src/` ou `tools/` cité existe et chaque affirmation technique
   correspond au code actuel.
4. Les termes sont définis dans le glossaire ; les détails historiques sont au
   journal ; le raisonnement d'une décision renvoie à son ADR.
5. Les liens sont relatifs et valides, sans wikilinks, liens absolus ou pages
   manquantes ; le README racine permet de retrouver la page.
6. Les diagrammes suivent les types, limites et libellés définis ci-dessus.
7. Une évolution de comportement met à jour la documentation correspondante
   dans le même changement.
8. Lancez `pnpm check:docs`; `pnpm check` inclut ce contrôle. Les tests du
   vérificateur se lancent avec `pnpm check:docs:test`.
