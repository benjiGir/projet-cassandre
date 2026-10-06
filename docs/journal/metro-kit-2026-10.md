---
title: Métro — kit N3
tags: [journal, metro, blender, assets]
status: brouillon
updated: 2026-10-06
---

# Métro — kit N3

## Période

6 octobre 2026. Après le plan N2, l'utilisateur demande de continuer.
Son accord pour poursuivre est inscrit au suivi ; le lot suivant est N3.

## Objectif

Produire les pièces de station, de tunnel, de rame, d'accès et de signalétique
avant la pièce pilote. Garder les cotes et la direction du board N1.

## Livré et preuve

La [présentation N3](../assets/kit-metro.html) rassemble huit rendus.
La [fiche de kit](../assets/kit-metro.md) décrit 26 collections d'assets,
leurs cotes, les surfaces originales et les limites d'intégration.
La bibliothèque est `assets_src/library/lib_metro_N3.blend`.

La recette Cassandre reconstruit les pièces, sauvegarde la bibliothèque,
produit l'inventaire et les rendus à 640 × 360. Les instances de présentation
ne deviennent pas des doublons dans la bibliothèque.
Les rendus de couleur, silhouettes et courbes sont ouverts et regardés.
Le board est rouvert pour confronter la station et les deux rames à leurs
références. Les sources restent créditées dans les planches.

## Rejeté et raison

- Première rame : trop rectangulaire ; nez resserré, pare-brise incliné et
  toit à pans ajoutés. La peinture remplace la texture de carrelage sur la caisse.
- Première présentation de quai : un tube étroit occupait le volume de station.
  Remplacé par deux voies et un second quai sous la voûte de 18 m.
- Panneau de refuge initial : trop loin dans la niche, vu par la tranche.
  Posé en amont de l'ouverture sur le mur extérieur.
- Glyphes initiaux : trop subdivisés pour cette résolution. Résolution des
  courbes réduite, sans extrusion ; le kit passe d'environ 26 000 à 19 000 triangles.

## Leçons

Les pièces doivent se comparer à l'échelle du joueur et en assemblage.
Une belle vue de catalogue ne révèle pas une allée bouchée ni une niche
invisible depuis la voie. Le fret conserve la vue traversante du board et
déplace les sièges hors de l'allée centrale.

Les éclairages de présentation EEVEE ne valident pas le rendu Three.js.
L'assemblage aux points arrondis de N2, les colliders Rapier, les volumes
de refuge et la lisibilité des ennemis restent à exercer au pilote/blockout.
Le candidat N3 attend le jugement visuel de l'utilisateur.
