---
name: ai-3d-asset-integration
description: Intégration d'assets générés par IA 3D (Tripo, Meshy, Rodin, Hunyuan3D) dans un pipeline rétro — quand c'est pertinent, décimation, pièges de topologie et d'échelle. Charger uniquement pour les props signature.
---

# Assets générés par IA 3D

## Périmètre strict

**Uniquement pour les props signature** — objets uniques porteurs de sens : la
machine à pinces, le bureau du directeur, un panneau d'enseigne.

**Jamais pour le kit modulaire.** Le kit exige des dimensions exactes sur
grille, des origines placées, des jonctions au ras et une subdivision contrôlée.
Une génération IA ne satisfait aucune de ces contraintes, et corriger prend plus
de temps que modéliser.

## État des outils

| Outil | Profil |
|---|---|
| **Tripo** | rapide, topologie de base propre, orienté moteur de jeu, API |
| **Meshy** | équilibré, plugins Blender/Unity, texturing PBR correct |
| **Rodin (Hyper3D)** | qualité géométrique la plus haute, topologie quad, plus cher |
| **Hunyuan3D** | open source, auto-hébergeable, bon image-to-3D |

Consensus des comparatifs récents : Rodin domine sur géométrie et topologie,
Tripo sur vitesse et orientation jeu, Meshy sur l'équilibre. Tous demandent
encore **retopologie, nettoyage de matériaux et reprise**.

**L'image de référence compte plus que le prompt.** L'image-to-3D donne une
géométrie nettement plus stable que le text-to-3D.

## Le décalage à gérer

Ces outils produisent du **dense, PBR, haute fréquence de détail**. Le projet
veut du **basse résolution, Lambert, silhouette-first**. L'import brut est
visuellement faux, pas seulement lourd.

```
1. Générer depuis une image de référence
2. Importer en .glb, collection _RAW
3. Décimer — budget prop signature (500-2000 tris)
   Decimate → Planar, angle 10-15°
4. Jeter les matériaux PBR. Réassigner le matériau du kit.
5. Reprojeter les UV sur la trim sheet
6. Subdiviser si nécessaire pour le bake
7. Vérifier l'échelle contre une référence de 1.8 m
8. Modéliser un proxy de collision à part — jamais le mesh généré
9. Passer la vue silhouette
```

**`Decimate → Planar` plutôt que `Collapse`** : il fusionne les faces
coplanaires et préserve les arêtes de silhouette, ce qui correspond au rendu
anguleux recherché. `Collapse` arrondit et détruit exactement ce qu'on veut
garder.

## Pièges

- **Échelle arbitraire.** Vérifier contre un cube de 1.8 m avant d'intégrer.
- **Topologie triangulée sale.** Acceptable pour du décor statique, ingérable
  dès qu'il faut animer.
- **Normales incohérentes.** `Shift+N` puis vérification en face orientation.
- **Textures hors budget.** 2K/4K par défaut, à ramener à 128×128 — ce qui
  détruit la plupart du détail généré.
- **Licence.** Vérifier les conditions d'usage commercial avant d'intégrer.

## Alternative souvent meilleure

Les banques CC0 valent souvent mieux : Kenney, Quaternius, ambientCG, Poly
Haven. Assets propres, licence claire.

Le besoin réel du projet est en **textures tileables**, pas en modèles. Une
bonne trim sheet fait plus pour le rendu que dix props générés.
