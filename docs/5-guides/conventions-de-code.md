---
title: Conventions de code
tags: [guide, conventions]
status: brouillon
updated: 2026-09-26
---

# Conventions de code

Ces conventions guident les modifications courantes. Les invariants du projet et les quatre pages React font autorité lorsqu'un détail diffère.

## TypeScript et modules

- Activez `strict` par défaut ; les types décrivent les frontières entre modules.
- Utilisez `import type` lorsqu'une dépendance ne sert qu'au typage. N'introduisez pas `any`.
- Nommez les variables et fonctions en camelCase, les types en PascalCase et les constantes d'énumération en SCREAMING_SNAKE_CASE quand elles le sont déjà dans le domaine.
- Gardez un seul propriétaire pour chaque valeur de réglage. Les constantes dérivées se calculent, elles ne se recopient pas.
- Les tests reproduisent l'arborescence de `src/` sous `test/` lorsqu'un test est nécessaire.
- N'ajoutez pas de fichier `index.ts` de réexport. Importez depuis le module qui possède la fonction ou le type.
- Évitez les dépendances circulaires ; gardez les responsabilités et les directions d'import visibles.

## Simulation, Effect et XState

- Toute logique de gameplay et de physique respecte le pas fixe de 1/60 s et le RNG déterministe.
- L'arbre synchrone du pas fixe et de l'interpolation utilise `runGameplaySync` / `Runtime.runSync` seulement. Les appels réseau, temporisateurs asynchrones et `Effect.tryPromise` n'y entrent pas.
- Chargement de niveau et hot reload restent asynchrones et ne sont pas appelés depuis `updateGameplay`.
- Un service Effect s'ajoute dans son module et son `Layer` est assemblé par le runtime. Le runtime demeure l'unique propriétaire du service.
- Les machines XState expriment les états et transitions. N'y introduisez pas de temps mural dans un système qui reçoit un pas de simulation explicite.
- Avant toute modification du code Effect, lisez entièrement `node_modules/effect/AGENTS.md` et les liens qu'il demande.

Voir [Invariants](../3-architecture/invariants.md), [Effect et XState](../3-architecture/effect-et-xstate.md) et [Rejeu](../4-technique/rejeu-et-determinisme.md).

## React et CSS

Tout code de `src/ui/` respecte quatre références avant d'être écrit :

- [Structure et rangement](../6-reference/react-structure.md).
- [Bonnes pratiques React](../6-reference/react-bonnes-pratiques.md).
- [CSS](../6-reference/react-css.md).
- [Composition](../6-reference/react-composition.md).

Le HUD se met à jour via Zustand à 10 Hz au maximum. Ne placez pas la boucle, une logique persistante, le moteur ou des règles de jeu dans `src/ui/`. Utilisez un dossier par composant, CSS Modules, enfants `children` pour composer, des sélecteurs stables et aucun barrel.

## Commentaires et documentation

- Un commentaire reste dans le code s'il explique une contrainte, une raison durable ou un piège subtil utile à la modification. Le code évident n'a pas besoin d'une paraphrase.
- Un contrat plus large va dans `docs/`, avec une ancre `see:` à proximité dans le code.
- Une ancre n'est pas un garde-fou. Toute contrainte qui doit tenir en production doit être appliquée par le code ou par le build.
- La documentation cite les chemins depuis la racine, emploie des liens relatifs, respecte quatre champs de frontmatter et ne crée pas de fichier `index.ts`.
- Quand le code et une ancienne doc divergent, vérifiez le comportement actuel et corrigez la page dans le même changement. Si un invariant ou un choix de conception reste ambigu, ouvrez un ADR proposé; ne modifiez pas le gameplay pour faire correspondre le texte sans décision.

## Commandes de travail

Utilisez `pnpm dev` pour lancer, `pnpm typecheck` pour les types, `pnpm test` pour Vitest et `pnpm build` pour le paquet de production. `pnpm check` exécute le typecheck, Vitest, le contrôle documentaire strict et le build. Les commandes documentaires sont listées dans [Commandes](../6-reference/commandes.md).

Les changements de sensation demandent une comparaison A/B et des preuves ; voir [Régler la sensation](regler-la-sensation.md). Les changements d'architecture qui contraignent les prochains travaux demandent un [ADR](ecrire-un-adr.md).
