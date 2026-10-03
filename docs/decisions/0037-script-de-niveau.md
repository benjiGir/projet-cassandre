---
title: Script de niveau par volumes déclencheurs et scénarios nommés
tags: [adr, niveau, gameplay, histoire]
status: accepte
updated: 2026-10-03
---

# ADR 0037 — Script de niveau par volumes déclencheurs et scénarios nommés

## Statut

Accepté.

## Contexte

Le chargeur lisait les `trig_*` depuis l'origine du pipeline, mais aucun
système de jeu ne les exploitait. La v1.1 demande des moments scriptés qui ne
retirent jamais le contrôle : une annonce, des écrans qui changent de chaîne,
une réplique à un endroit précis. Les rencontres prévues ensuite auront besoin
de faire apparaître des ennemis à la demande.

Deux contraintes cadrent la forme : tout se décide dans le pas fixe, avec des
délais en temps de jeu (invariants #1 et #11), et Blender ne doit jamais porter
de logique, seulement des noms.

## Décision

Un `trig_*` porte l'une de deux propriétés.

- `evenement` nomme un **scénario** déclaré dans le code
  (`src/game/session/progression/levelEvents.ts`) : une liste d'étapes, chacune
  avec un délai en secondes de gameplay et une action. Quatre actions existent :
  dire une réplique, diffuser une annonce, réveiller un groupe d'ennemis,
  changer la chaîne d'un groupe d'écrans.
- `replique` fait du volume une **sous-zone** : il rejoint les espaces du plan
  de masse et suit les règles des répliques de lieu (temps d'observation,
  abandon en combat, une fois par partie).

Le moteur du script (`src/game/level/scripting/levelScript.ts`) est une
fonction pure : il reçoit les déclencheurs, les scénarios, la position du
joueur et un rappel qui exécute une action. Un déclencheur ne se franchit
qu'une fois par partie ; son état vit dans la session et survit à un
rechargement à chaud du niveau.

Un `spawn_suit_*` qui porte `groupe` n'apparaît pas au chargement : il attend
l'action de réveil de son groupe.

Les noms sont validés aux deux bouts. `tools/blender/validate_level.py` lit les
scénarios et les répliques directement dans les sources du jeu et refuse un nom
inconnu. Au chargement, `readLevelScript` signale en console tout déclencheur
sans effet, tout groupe que rien ne réveille et tout scénario qui vise des
écrans absents.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Décrire les étapes d'un scénario dans des propriétés Blender | la logique partirait dans le `.blend`, sans typage ni test, et chaque retouche de texte demanderait un export |
| Une machine XState par scénario | des transitions temporisées (`after`) dépendraient du temps mural ; une liste d'étapes à délai de gameplay suffit |
| S'appuyer sur les capteurs Rapier des `trig_*` | un test de boîte sur la position du joueur donne le même résultat sans requête physique, comme pour les secrets |
| Poser les ennemis d'un groupe dès le chargement, endormis | il faudrait un état « invisible et inerte » dans la machine partagée des ennemis ; les faire apparaître au réveil ne touche pas cette machine |
| Recopier les listes de noms dans le validateur | deux listes à tenir d'accord à la main, comme pour les aliments ; lire la source supprime le risque |

## Conséquences

Ajouter un moment demande une entrée dans `LEVEL_EVENTS` et une boîte dans
Blender (`tools/blender/refresh_story_triggers.py`). Le texte se retouche sans
réexporter le niveau.

Un ennemi réveillé apparaît à son point : le point doit être hors de vue du
joueur au moment du réveil, ce que seul le placement garantit.

Les annonces ont leur propre canal d'affichage dans le store
(`announcement`), distinct de la voix du héros et des messages système.

Le validateur dépend de la mise en forme de deux fichiers TypeScript. Un test
(`test/game/session/progression/levelScriptSetup.test.ts`) échoue si elle
change.

## Comment on saurait qu'on a eu tort

Si les scénarios réclament des branches, des conditions ou des boucles, la
liste d'étapes ne suffira plus et il faudra un vrai langage de script. Si des
ennemis réveillés apparaissent régulièrement sous les yeux du joueur, l'option
« endormis dès le chargement » devra être reprise.
