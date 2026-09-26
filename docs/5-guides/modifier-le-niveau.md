---
title: Modifier le niveau
tags: [guide, recette]
status: brouillon
updated: 2026-09-26
---

# Modifier le niveau

## Objectif

Modifier la source du niveau v2, reconstruire la scène dans Blender,
puis contrôler et exporter le résultat destiné au jeu.

## Avant de commencer

- Ouvrez le projet Blender source correspondant au niveau v2.
- Gardez la session Blender live liée au dépôt. Une reconstruction
  headless ne met pas à jour la scène déjà ouverte.
- Lisez [Outillage Blender](../4-technique/outillage-blender.md),
  [Chargement de niveau](../4-technique/chargement-de-niveau.md) et
  [Conventions glTF](../6-reference/conventions-nommage.md).
- Repérez les espaces et passages dans
  `tools/level_v2/plan_de_masse.py`.
- Repérez le constructeur ou la table d'habillage concernée dans
  `tools/level_v2/build_niveau.py`.
- Pour un changement structurel, régénérez aussi le plan de masse et ses
  représentations.
- Avant d'éditer, vérifiez que la scène Blender ouverte est la version
  attendue par rapport au fichier disque.

## Étapes

1. Traduisez la demande en une modification précise : espace, position,
   dimensions, collision, interaction ou matériau.
2. Modifiez les données de source dans `tools/level_v2/plan_de_masse.py`
   si vous changez les limites, les connexions ou les éléments placés
   par coordonnées.
3. Modifiez `tools/level_v2/build_niveau.py` si vous changez les helpers
   de construction, l'habillage ou la pose de props.
4. Pour un nouvel objet de gameplay, définissez son préfixe et ses
   extras selon [les conventions
   glTF](../6-reference/conventions-nommage.md).
5. Posez les coordonnées sur la grille du projet. Utilisez les vraies
   dimensions de la pièce et du collider, pas une estimation visuelle.
6. Gardez les meshes d'un seul système dans leur groupe de collision
   attendu.
7. Évitez les faces coplanaires : une finition dépasse ou rentre
   légèrement de la surface qu'elle habille.
8. Pour un collider de gameplay, choisissez une forme Rapier adaptée.
   N'ajoutez pas un trimesh détaillé sans raison.
9. Mettez à jour les repères de spawn après un changement des volumes ou
   props voisins.
10. Relancez la construction depuis la session Blender ouverte avec le
    connecteur prévu. Le script doit reconstruire la scène à partir des
    sources versionnées.
11. Regardez le résultat à hauteur du joueur et depuis les points de vue
    qui révèlent l'intersection ou l'occultation.
12. Corrigez la source, puis relancez la construction. Ne gardez pas un
    correctif manuel qui disparaît au prochain rebuild.
13. Lancez `tools/level_v2/audit_niveau.py` sur la scène : examinez
    trous de sol, bords ouverts, intersections, objets flottants et
    spawns encombrés.
14. Lancez `tools/blender/validate_level.py`. Ajoutez `--strict` si tous
    les avertissements doivent bloquer cette passe ; les exceptions
    connues doivent être identifiées précisément.
15. Si nécessaire, bakiez l'éclairage avec
    `tools/blender/bake_vertex_lighting.py` et contrôlez le résultat au
    rendu cible.
16. Exportez avec `tools/blender/export_level.py` vers
    `public/assets/levels/`. N'utilisez pas l'export glTF générique de
    l'interface.
17. Rechargez le niveau depuis le jeu, inspectez l'objet et vérifiez les
    extras préservés.
18. Mettez à jour la carte, le doc technique et les validations
    associées dans le même changement.

## Vérifier

- L'audit n'a aucun trou, bord ouvert, spawn encombré ni intersection
  non expliquée.
- Le validateur ne signale aucune erreur ; chaque warning restant est
  connu et conservé volontairement.
- Le GLB exporté contient les objets, leurs noms et leurs propriétés.
- Le niveau se charge depuis `cassandre.level.load("niveau_v2")` ou
  depuis la sélection du jeu.
- Vérifiez en jeu les collisions et le cheminement réel : un audit ne
  juge pas l'expérience de saut ou la lisibilité d'une porte.
- Pour un changement d'apparence, inspectez le rendu produit par
  `tools/blender/render_ingame.py` et ouvrez l'image.
- Enregistrez les commandes, mesures et captures qui attestent le
  résultat.

## Pièges

- Un fichier Blender sur disque et la session Blender ouverte peuvent
  représenter deux états différents.
- L'audit peut cacher temporairement le décor pour ses rayons ; il doit
  le restaurer avant l'export.
- Un objet visuellement au sol peut être hors-sol par sa bbox ou son
  collider.
- Un plafond collidable peut devenir un sol dans le bake de navigation.
- Le validateur vérifie le contrat de contenu ; l'audit vérifie la
  géométrie. L'un ne remplace pas l'autre.
- L'exporteur générique peut oublier les extras ou exporter des
  collections sources.
- Une modification de structure exige le plan de masse à jour et un
  graphe de navigation encore connecté.

## Exemple réel

Commit `2f18fc1`, « Niveau v2 : murs sans fente, textures sans
chevauchement, vraies toilettes » : il corrige des jonctions, les
chevauchements et la salle des toilettes dans les sources Blender, puis
met à jour l'export du niveau.
