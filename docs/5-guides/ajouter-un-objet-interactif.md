---
title: Ajouter un objet interactif
tags: [guide, recette]
status: brouillon
updated: 2026-09-26
---

# Ajouter un objet interactif

## Objectif

Ajouter un nouvel objet de niveau sélectionné à la touche E ou ramassé
automatiquement, depuis sa déclaration Blender jusqu'à son comportement
runtime.

## Avant de commencer

- Choisissez le contrat : interaction manuelle, ramassage automatique,
  trigger, porte ou système dédié.
- Lisez [Chargement de niveau](../4-technique/chargement-de-niveau.md),
  [Systèmes de niveau](../4-technique/systemes-de-niveau.md) et [les
  conventions glTF](../6-reference/conventions-nommage.md).
- Identifiez la donnée exportée : préfixe glTF, extras, bbox, collision
  et point de placement.
- Repérez le lecteur de ces données dans `src/game/level/loader.ts`.
- Pour un nouveau préfixe, vérifiez si un système déjà existant peut
  héberger sa logique.
- Gardez les propriétés inconnues bruyantes : une custom property
  silencieusement ignorée devient un bug de contenu.

## Étapes

1. Décrivez le contrat dans `docs/6-reference/conventions-nommage.md` :
   préfixe, propriétés, valeurs valides, valeurs par défaut et
   comportement en cas d'erreur.
2. Ajoutez une entrée dans le validateur
   `tools/blender/validate_level.py`. Refusez les noms incomplets et les
   extras dont les valeurs ne sont pas valides.
3. Étendez le type d'objet ou de données lu par
   `src/game/level/loader.ts`. Gardez la conversion glTF → runtime à cet
   endroit.
4. Créez ou étendez un système dans `src/game/level/` si l'objet possède
   un état individuel en cours de partie.
5. Pour une règle de soin, de score ou de progression, placez la règle
   dans `src/game/session/`, pas dans le loader.
6. Branchez le système au cycle de la session depuis les modules de
   `src/game/session/`.
7. Si l'objet doit lire des événements de tir, consommez les événements
   au pas fixe avant leur nettoyage par la boucle.
8. Si son mesh change d'apparence à l'interaction, exposez la plage de
   géométrie ou le mesh au système plutôt que de reconstruire le niveau
   entier.
9. Si l'objet est mobile, choisissez un groupe de collision dédié ou le
   système `PropSystem`. Ne le déclarez pas dans WORLD si les requêtes
   de navigation supposent un décor immobile.
10. Si l'objet est visible seulement près du joueur, raccordez son
    élagage au mécanisme de la famille `use_*`.
11. Si plusieurs objets doivent fusionner, vérifiez les conséquences sur
    la forme glTF : un objet qui devient un `Group` peut ne plus être
    reconnu par le loader.
12. Déclarez le nouvel objet dans la source du niveau :
    `tools/level_v2/build_niveau.py` ou sa table de plan, selon le type.
13. Gardez le mesh attendu à un matériau unique si le système attend un
    seul mesh.
14. Exportez les propriétés personnalisées avec le glTF.
    `tools/blender/export_level.py` préserve les extras.
15. Écrivez des tests dans le dossier correspondant sous
    `test/game/level/` et, si nécessaire, `test/game/session/`.
16. Ajoutez une ligne de référence dans [Où agir](ou-agir.md) et mettez
    à jour la page technique correspondante.

## Vérifier

- Lancez le validateur de niveau sur le .blend et traitez chaque erreur
  avant l'export.
- Pour le niveau v2, lancez aussi l'audit géométrique décrit dans
  [Modifier le niveau](modifier-le-niveau.md).
- Rechargez le glTF exporté et inspectez l'objet, son préfixe et ses
  extras.
- En jeu, vérifiez portée, priorité d'appui E, consommation une seule
  fois et retour visuel/sonore.
- Vérifiez aussi le comportement au reset : aucun ancien mesh, collider
  ni compteur ne doit survivre dans la nouvelle session.
- Lancez les tests concernés, puis `pnpm check` si le changement
  traverse plusieurs systèmes.

## Pièges

- Un objet qui doit répondre à E peut être masqué par un autre
  interactif plus proche ; explicitez l'ordre de priorité.
- Une valeur présente mais invalide ne doit pas ressembler à une
  propriété absente. Avertissez ou bloquez l'export.
- Un matériau Blender unique n'assure pas toujours une primitive glTF
  unique : contrôlez les index matériaux.
- Un préfixe documenté mais non traité dans le runtime est une promesse
  sans effet.
- Un système par session doit être recréé au chargement, comme le graphe
  de navigation et les systèmes de porte.
- Les valeurs de gameplay ne doivent pas être codées à la fois dans le
  plan Blender et dans une seconde table runtime.

## Exemple réel

Commit `3d853b1`, « Toilettes à la Duke, récap de fin, pause en jeu et
sept retours de playtest » : il ajoute le contrat `sanitaire_*`, le
système runtime, la règle de soin, le validateur Blender et ses tests.
