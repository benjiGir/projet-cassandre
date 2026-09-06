---
title: GameEngine et PersistentEngine séparés plutôt qu'un champ session nullable
tags: [adr, core]
status: accepte
updated: 2026-09-05
---

# ADR 0014 — GameEngine et PersistentEngine séparés plutôt qu'un champ session nullable

## Statut

Accepté.

## Contexte

Le jalon qui a introduit un vrai chemin de reset de partie (`bootGameSession`/
`teardownGameSession`, voir [Session de partie](../systems/session.md)) a dû
distinguer deux catégories d'état : ce qui survit à un reset (scène/caméra/
renderer, horloge de hitstop, systèmes de rendu cosmétiques, atlas/
géométries partagés, visée, interaction) et ce qui est détruit/reconstruit à
chaque partie (monde physique, joueur, armes, managers d'ennemis, géométrie
de niveau, suivi de badge/portes/secrets, PV).

Cela crée un ordre de construction circulaire : `buildGameEngine` doit
exister avant que la toute première `GameSession` puisse être construite
(`bootGameSession` lit `scene`/`look`/`clock`/etc. de l'état persistant),
mais un type `GameEngine` unique qui porterait `session: GameSession`
directement ne pourrait pas être complètement construit tant que cette
première session n'existe pas.

## Décision

Deux types distincts plutôt qu'un seul : `GameEngine` (complet, avec
`session: GameSession` non nul) et `PersistentEngine = Omit<GameEngine,
"session">`. `buildGameEngine` retourne un `PersistentEngine`.
`bootGameSession`/`teardownGameSession`/`spawnSuitAt`/`spawnDirectorAt`/
`loadGltfLevel`/`debugFindPath` sont typées pour accepter `PersistentEngine`
— jamais `GameEngine` — ce qui les empêche PAR CONSTRUCTION de lire
`engine.session`. Un `GameEngine` complet reste assignable partout où
`PersistentEngine` est attendu par sous-typage structurel (le champ
`session` en trop est simplement ignoré), donc `replay`/`returnToMenu` (qui
possèdent le `GameEngine` complet, avec sa session courante à détruire)
appellent les mêmes fonctions sans caster quoi que ce soit.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Un seul `GameEngine` avec `session: GameSession \| null` | pousse un null-check sur CHAQUE lecture de `engine.session`, y compris dans les dizaines d'appels de `game/loop/*.ts` qui ne tournent qu'une fois la première session construite — alors que seule une poignée de fonctions (`bootGameSession` et les fonctions de spawn qu'elle appelle) ont réellement besoin de fonctionner avant que la session existe |
| `GameEngine` unique avec une session « placeholder » factice au tout premier boot | un faux `GameSession` serait plus dangereux qu'un `null` : rien n'empêcherait un appel accidentel de le lire comme s'il s'agissait d'une vraie partie, alors qu'un `null` échoue au premier accès |

## Conséquences

- Deux noms de type à connaître plutôt qu'un seul — coût de ceci mérite
  d'être mesuré face à ce qu'il achète : la classe de bug « cette fonction a
  lu l'ancienne session en cours de remplacement au lieu de la nouvelle en
  cours de construction » (voir la doc de `spawnSuitAt` dans [Session de
  partie](../systems/session.md#spawn-et-chargement-de-niveau)) est
  détectée par le compilateur, pas laissée à la discipline d'un
  commentaire.
- `PersistentEngine`-typé signifie littéralement « ce code ne peut pas
  exprimer `engine.session` » — essayer ne compile pas, contrairement à une
  convention de nommage ou un commentaire qui peuvent être ignorés.

## Comment on saurait qu'on a eu tort

Si une future fonction typée `PersistentEngine` a un besoin légitime de
lire `engine.session` (au-delà de la construire), c'est le signal que cette
séparation ne tient plus : reconsidérer si cette fonction devrait plutôt
prendre `GameEngine` complet avec un `session: GameSession` en paramètre
explicite séparé — le même patron que `spawnSuitAt` applique déjà pour une
raison voisine.
