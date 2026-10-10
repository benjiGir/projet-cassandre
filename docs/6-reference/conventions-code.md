---
title: Conventions de code
tags: [reference, code]
status: brouillon
updated: 2026-10-10
---

# Conventions de code

Les règles d'écriture du code TypeScript de `src/` et `test/`, pour l'agent
principal comme pour chaque sous-agent. Elles viennent de l'audit de qualité du
2026-10-08 (`AUDIT_QUALITE_SRC_2026-10-08.md`, §7) ; les règles propres à React
sont dans [structure](react-structure.md),
[bonnes pratiques](react-bonnes-pratiques.md), [CSS](react-css.md) et
[composition](react-composition.md).

## Langue

**Les identifiants sont en anglais** : variables, paramètres, fonctions, types,
constantes, noms de fichiers. Décidé le 2026-10-10 — le code mélangeait les deux
langues dans une même fonction (`weaponEyeOrigin` à côté de `enLAir`).

**Restent en français :**

| Quoi | Exemple | Pourquoi |
|---|---|---|
| Le texte que lit le joueur | répliques, menus, messages du HUD | le jeu est en français |
| Les commentaires et la documentation | `// Une cellule n'est lue que si…` | c'est la langue de travail du dépôt |
| Les noms des choses du jeu | `Costard`, `Rampant`, `Vigile`, `VitreSystem`, `SanitaireSystem`, `EcranSystem` | ce sont des noms propres ; ils suivent les préfixes glTF (`vitre_*`, `sanitaire_*`, `ecran_*`) que les niveaux portent |
| Un champ qui porte une propriété Blender | `matiere`, `givre`, `groupe`, `chaine`, `portee`, `delai`, `referme` | il garde le nom de la propriété lue dans le `.glb` — voir [conventions de nommage glTF](conventions-nommage.md) |
| Les identifiants de contenu | perks (`boisson`, `gilet`), difficultés (`habitue`), répliques, espaces de niveau | ils sont écrits dans les niveaux, les manifestes et les sauvegardes |
| Les clés des données gardées ou générées | `sousTitres` dans `cassandre.audio`, `espaces` dans `*.espaces.json` | les changer casserait les sauvegardes des joueurs ou les outils qui écrivent ces fichiers |
| L'API de console de développement | `cassandre.filtrage()`, `cassandre.economie.appliquer()` | les outils, les pages de revue et les habitudes de frappe en dépendent ; voir [console cassandre](console-cassandre.md) |
| Les scénarios de niveau | `levelEvents.ts`, `metroEncounterEvents.ts`, `heroLines.ts` | `tools/blender/validate_level.py` relit ces fichiers par expressions régulières |

La frontière se tient à l'endroit où la donnée entre dans le code : on lit
`extras.portee`, on calcule avec `range`.

```ts
// Oui
const range = hit ? hit.timeOfImpact : this.cfg.pistolRange;
function warnOnce(key: string, reason: string) { … }

// Non
const portee = hit ? hit.timeOfImpact : this.cfg.pistolRange;
function avertirUneFois(cle: string, raison: string) { … }
```

Un nom français rencontré hors de ces exceptions se traduit quand on touche au
fichier. Le premier passage (2026-10-10) a traduit les fonctions, constantes et
variables repérées par inventaire ; il n'était pas exhaustif.

## Constantes partagées

Une valeur qui sert à plusieurs modules a **un** nom, à **un** endroit :

| Valeur | Où |
|---|---|
| Gravité (invariant #7) | `src/physics/constants.ts` |
| Graines du RNG déterministe (invariant #12) | `src/core/effect/seeds.ts` |
| Délai d'un chargement de manifeste | `src/core/net/fetchJson.ts` |

## Modules à utiliser plutôt que de réécrire

| Besoin | Module |
|---|---|
| Garder une valeur dans `localStorage` | `persisted()` — `src/core/storage/persisted.ts` |
| Charger et valider un JSON | `fetchJson()` — `src/core/net/fetchJson.ts` |
| Un flux aléatoire à partir d'une graine | `seededRandom()` — `src/app/runtime/gameRuntime.ts` |
| Une file d'évènements d'entités lue par pas | `EventQueue` — `src/game/entities/shared/eventQueue.ts` |
| Une boucle d'ambiance spatialisée | `createLoopedAmbience()` — `src/core/audio/loopedAmbience.ts` |
| Signaler une erreur dont le jeu ne se relève pas | `reportFatalError()` — `src/app/runtime/fatalError.ts` |

## Commentaires

Le *pourquoi* en une à trois lignes ; le reste dans `/docs`, avec une ancre
`// see:`. Pas de jalon (« Jalon M4 »), pas de renvoi à un plan de travail : un
plan finit par être déplacé ou supprimé, et le commentaire avec.

## Garde-fous

`pnpm verify` (typecheck, lint, tests) doit rester vert. Le plafond
d'avertissements de lint (`.oxlintrc.json`, `options.maxWarnings`) ne fait que
descendre : on le baisse quand un changement en retire.
