---
name: code-comment-policy
description: Ce qu'un commentaire doit contenir pour rester dans le code, et ce qui part dans /docs. Catégories qui restent, catégories qui partent, forme des ancres. Charger pour toute tâche de nettoyage ou d'écriture de commentaires.
---

# Politique de commentaires

## Le principe

Le code dit **quoi**. Le commentaire dit **pourquoi**. Tout ce qui n'est ni
l'un ni l'autre appartient à `/docs`.

Un commentaire est du code qu'aucun compilateur ne vérifie : il pourrit en
silence. Chaque ligne conservée est une ligne à maintenir. La question n'est
donc pas « est-ce utile ? » mais « est-ce que ça vaut son coût de
maintenance ? ».

## Ce qui reste — cinq catégories, pas une de plus

**1. Le pourquoi non évident**

```ts
// Gravité à -25 et non -9.81 : le réalisme donne un saut mou et flottant.
const GRAVITY = -25;
```

**2. Les invariants et contrats**

```ts
// Doit être appelé DANS le pas fixe. Hors accumulateur, casse le déterminisme.
function updateGameplay(dt: number) {
```

**3. Les pièges — le plus haute valeur du lot**

```ts
// FIX_INTERNAL_EDGES obligatoire : sans lui le joueur accroche sur les arêtes
// entre triangles coplanaires, et ça se diagnostique à tort comme un bug de
// character controller.
```

Un piège documenté fait gagner des heures. C'est la catégorie qu'il faut
protéger le plus férocement pendant une migration.

**4. Les nombres magiques, avec renvoi vers leur tuning**

```ts
// see: docs/reference/valeurs-deplacement.md
const GROUND_ACCEL_TIME = 0.08;
```

**5. TODO avec propriétaire ou issue**

```ts
// TODO(#42) autostep non testé sur les palettes de la réserve
```

Un `// TODO fix this later` sans référence est du bruit : soit tu l'ouvres en
issue, soit tu le supprimes.

## Ce qui part

| Catégorie | Destination |
|---|---|
| Répétition du code (`// incrémente i`) | **supprimé** |
| Code commenté | **supprimé** — git a l'historique |
| Bannières `// ===== HELPERS =====` | supprimé + signaler la découpe du fichier |
| JSDoc qui ne fait que répéter les types | supprimé — TypeScript les porte déjà |
| Explication longue d'un algorithme | `docs/systems/` |
| Historique, « on avait essayé X » | `docs/decisions/` (ADR) |
| Tutoriel, mode d'emploi | `docs/systems/` ou `docs/pipeline/` |
| Tables de valeurs, conventions | `docs/reference/` |
| Changelog dans le fichier | `CHANGELOG.md` |

## La forme de l'ancre

Une seule ligne, format fixe, validable automatiquement :

```ts
// see: docs/systems/loop.md#hitstop
```

`see:`, `voir:` et `cf:` sont reconnus par `check_docs_links.py --src`. Le
chemin part de la racine du dépôt, l'ancre est le slug d'un titre existant.

Ne pas écrire de résumé à côté de l'ancre : soit le résumé suffit et l'ancre
est inutile, soit il ne suffit pas et il induit en erreur.

## JSDoc

Sur une fonction exportée, seulement si la signature ne suffit pas :

```ts
// Inutile — TypeScript dit tout
/** @param dt delta @returns void */
export function update(dt: number): void

// Utile — le contrat n'est pas dans les types
/**
 * Avance le gameplay d'un pas fixe.
 * `dt` est déjà scalé par le hitstop — ne pas le rescaler.
 */
export function update(dt: number): void
```

Pas de JSDoc sur les fonctions internes. Un bon nom fait le travail.

## Le seuil

**20 % de lignes de commentaire** est le plafond par défaut d'un fichier de
gameplay. Au-delà, `audit_comments.py` le signale.

Ce n'est pas une cible à atteindre : un fichier à 3 % peut être parfait. C'est
un seuil d'alerte qui déclenche une relecture, pas une règle à satisfaire.

## Le signal derrière le commentaire

Un commentaire qui explique **comment** une fonction marche signale souvent que
la fonction est trop longue ou mal nommée. Une bannière de section signale
souvent qu'un fichier veut être coupé.

Dans ces cas, le déplacement traite le symptôme. Remonter la cause au
`director` comme dette de conception.
