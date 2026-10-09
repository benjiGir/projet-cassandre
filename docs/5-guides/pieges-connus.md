---
title: Pièges connus
tags: [guide, diagnostic]
status: brouillon
updated: 2026-10-08
---

# Pièges connus

Ce sont des défauts silencieux ou des erreurs de méthode qui reviennent dans plusieurs systèmes. Pour une tâche, lisez aussi la section « Pièges » de la page technique concernée.

## Boucle et simulation

- Le gameplay et la physique avancent uniquement au pas fixe de 1/60 s. Un minuteur navigateur ou une mutation au taux d'affichage rend le rejeu différent. Voir [Boucle et temps](../3-architecture/boucle-et-temps.md).
- Le déplacement et le rendu/interpolation passent par la frontière synchrone Effect. Un effet asynchrone dans cet arbre fait échouer `runSync` ; gardez chargement et hot reload à la frontière asynchrone.
- Le RNG de gameplay est `DeterministicRandom`. `Math.random()` ou le service `Random` par défaut d'Effect rompt la continuité du rejeu.
- Ne partagez pas une file d'événements en supposant qu'elle sera vidée après chaque ennemi : plusieurs systèmes la lisent avec des curseurs distincts.
- La caméra ne s'interpole pas. Interpoler son orientation donne une latence de visée.

## Physique et niveau

- Le KCC Rapier ne fournit ni gravité ni rotation et ne possède pas le collider piloté. Gardez la gravité dans le vecteur de déplacement et utilisez le contrôleur Rapier existant.
- Des groupes Rapier asymétriques ne se touchent pas : le test d'appartenance/filtre doit réussir dans les deux sens.
- Les props dynamiques restent dans `PROP`, séparés du décor `WORLD`. Les placer dans WORLD laisserait la navigation et la ligne de vue figées sur leur ancienne position.
- Un mesh de porte déplacé sans synchroniser son collider ne montre qu'une moitié du comportement. `DoorSystem` garde le corps fixe fermé et pilote le mesh.
- Le loader attend les formes de mesh annoncées par le préfixe. Un objet gameplay fusionné en plusieurs primitives glTF peut devenir un `Group` et ne plus passer le chemin qui attend un mesh.
- Les plafonds ne doivent pas devenir des sols de navigation. Sur les vitres au plafond, désactivez le collider via `solide: false`.
- Une pièce à plusieurs matériaux peut se séparer en primitives lors de l'export. Les portes, sanitaires et objets qui doivent rester un mesh ont un matériau unique.
- Le placement visuel n'est pas une preuve. Vérifiez aussi les colliders, les extras exportés, les spawns et les trous avec les validations de Blender et l'audit niveau.
- Un objet physique posé en intersection avec le décor peut être éjecté au premier pas. Relancez l'audit après chaque construction.

Pour les conventions exactes, voir [Chargement de niveau](../4-technique/chargement-de-niveau.md), [Physique](../4-technique/physique.md) et [Nommage glTF](../6-reference/conventions-nommage.md).

## Rendu

- Une seule primitive Blender peut devenir plusieurs primitives glTF si des index matériaux résiduels subsistent, même quand Blender n'affiche qu'un slot.
- Une baisse de résolution ne répare pas l'aliasing des textures réduites. Le filtrage nearest reste exigé pour l'agrandissement ; les surfaces lointaines demandent mipmaps et anisotropie.
- Un objet hors champ n'est pas nécessairement gratuit s'il désactive l'élagage de frustum. Mesurez les lots depuis plusieurs positions de caméra.
- Un matériau ou un attribut différent empêche souvent la fusion. Ajouter un matériau neuf dans une cellule coûte un lot de dessin.
- Un `InstancedMesh` sans élagage de frustum peut coûter un lot même quand aucune instance utile n'est visible.

Voir [Rendu](../4-technique/rendu.md) et [Budget de rendu](../4-technique/budget-de-rendu.md).

## Audio

- Un agent peut vérifier des mesures et la présence d'un son, mais ne peut pas juger à l'oreille s'il ressemble à l'objet attendu. Écoutez les résultats avant de conclure.
- Howler choisit un format disponible ; fournissez le sprite Ogg et M4A. Un encodage avec pertes peut dépasser le pic de son entrée.
- La synthèse donne une enveloppe et un spectre contrôlés, mais ne remplace pas le désordre d'un enregistrement d'objet. Suivez la direction de source indiquée dans [Studio audio](../4-technique/studio-audio.md).
- Une prise CC0 manquante ou non inscrite au registre rend la génération audio non livrable.

## Interface et outils

- React n'écrit pas dans la boucle et ne stocke pas l'état de gameplay. Chaque widget lit les données dont il a besoin via Zustand, à 10 Hz maximum.
- N'utilisez pas un sélecteur Zustand qui retourne un nouvel objet à chaque lecture : l'identité change et peut provoquer une boucle de rendu.
- Un import de panneau de développement n'est sûr que si tout usage reste derrière la garde de build correspondante. Contrôlez le bundle produit.
- Ne réutilisez pas la session Blender ouverte sans vérifier qu'elle correspond au fichier source attendu : elle peut être plus ancienne que le disque.
- Le rapport d'un agent sur une capture ne remplace pas la capture. Utilisez le harnais déterministe et conservez la preuve demandée par [Tests et qualité](../4-technique/tests-et-qualite.md).
