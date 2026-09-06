---
name: visual-critique-loop
description: Boucle générer → rendre → regarder → critiquer → réviser pour tout travail visuel dans Blender. Rend l'agent capable de voir son propre résultat au lieu de produire à l'aveugle. Charger pour toute tâche de modélisation, composition ou éclairage.
---

# Boucle de critique visuelle

## Le diagnostic

Un agent qui écrit du `bpy` sans jamais voir le résultat produit du primitif —
non par incapacité de conception, mais parce qu'il **travaille à l'aveugle**.
Le même agent, avec une capture sous les yeux, corrige une proportion en une
itération.

C'est le levier de qualité le plus important du domaine, et il précède tous les
autres. Ajouter des principes de design à un agent aveugle ne donne presque
rien ; les ajouter à un agent qui voit change le résultat immédiatement.

La littérature le confirme : les systèmes qui synthétisent des scènes Blender
par code tirent leurs gains principaux d'un cycle où la scène est rendue,
l'image relue par un modèle multimodal, et le script révisé en conséquence.

## Le protocole

```
1. Écrire le script bpy
2. Exécuter en headless
3. Rendre les vues de contrôle          ← render_preview.py
4. REGARDER les images (view)
5. Critiquer contre les critères écrits
6. Réviser le script
7. Retour en 2, maximum 4 itérations
```

**L'étape 4 n'est pas optionnelle et ne se saute jamais.** Un agent qui livre
sans avoir ouvert le rendu n'a pas fini sa tâche.

## Les vues de contrôle

| Vue | Ce qu'elle révèle |
|---|---|
| **Orthographique de dessus** | layout, circulation, proportions du plan |
| **Silhouette** (aplat noir sur fond blanc) | lisibilité de la forme |
| **Première personne à 1.6 m** | ce que le joueur voit réellement |
| **Trois-quarts perspective** | volume et composition |

La **vue silhouette** est la plus discriminante. Si un prop n'est pas
identifiable en aplat noir, il ne le sera pas non plus à 640×360 dans une pièce
sombre. C'est le test qui sépare un objet conçu d'une boîte texturée.

## Grille de critique

1. **Lisibilité** — je reconnais quoi, en une seconde ?
2. **Silhouette** — la forme se distingue-t-elle de ses voisines ?
3. **Échelle** — cohérente avec un joueur de 1.8 m ?
4. **Proportion** — variété ou tout à la même taille ?
5. **Composition** — un point d'attention, ou une bouillie uniforme ?
6. **Contraste** — un ennemi se détacherait-il devant cette surface ?

La question 6 est spécifique au projet : à 640×360 avec une palette réduite, un
ennemi sombre devant un mur sombre est un problème d'équité.

## Ce qui reste hors de portée

La boucle corrige la **conformité** : proportions fausses, silhouette illisible,
échelle incohérente, composition plate. Elle ne juge pas si un niveau est
**fun** — ça demande de le jouer.

| Délégable | Non délégable |
|---|---|
| Un layout qui respecte les principes | Est-ce que ce layout est plaisant |
| Une arène avec couverture et deux entrées | Est-ce que ce combat est tendu |
| Un prop lisible en silhouette | Est-ce que ce prop a du caractère |
| Détecter une incohérence d'échelle | Trancher une intention artistique |

L'agent produit un candidat argumenté. L'humain joue et arbitre.

## Références en contexte

Une image de référence vaut plus que trois paragraphes de description. Avant
toute tâche de modélisation ou de composition, charger les références du dossier
`refs/` correspondant.

Sans référence, l'agent génère depuis une description textuelle — et une
description textuelle d'un rayon de supermarché produit une étagère générique.

**Quand un board existe, la critique se fait côte à côte contre lui**, pas
seulement contre les critères écrits, et les références sont rouvertes à chaque
itération. Voir `reference-driven-authoring` : la dérive progressive loin du
board est le mode d'échec principal d'une boucle longue.
