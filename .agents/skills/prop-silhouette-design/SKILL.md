---
name: prop-silhouette-design
description: Conception de props pour un rendu 640×360 Lambert — pourquoi la silhouette et la texture priment sur le détail géométrique, méthode, budget de triangles, erreurs qui font "primitif". Charger pour toute création d'asset de décor.
---

# Conception de props

## L'axe à optimiser n'est pas celui qu'on croit

Le réflexe pour « faire moins primitif » est d'ajouter de la géométrie :
biseaux, panel lines, greebles, subdivisions. Bonne réponse pour du
photoréaliste. **Mauvaise ici.**

À 640×360, avec du Lambert et des textures de 128 px, un biseau de 3 mm occupe
zéro pixel. Les greebles disparaissent.

| Levier | Impact | Coût |
|---|---|---|
| **Silhouette** | déterminant | quelques triangles |
| **Texture** | déterminant | une case d'atlas |
| **Vertex colors** | fort | gratuit |
| **Proportion et variété d'échelle** | fort | nul |
| Détail géométrique fin | quasi nul | élevé |

C'est la répartition du moteur Build : le détail était dans la texture, la
géométrie servait la silhouette et la circulation.

**Un prop primitif ne se corrige pas en le subdivisant.** Il se corrige en
retravaillant son contour et sa texture.

## Méthode

**1. Dessiner la silhouette d'abord.** Quelle forme, en aplat noir, distingue
cet objet de ses voisins ?

Un caddie, une caisse et un distributeur peuvent tous être des boîtes de
1 × 0.6 × 1. Ce qui les sépare : le caddie a une poignée qui dépasse et une
base ouverte, la caisse un tapis en avancée et un écran en hauteur, le
distributeur une vitrine en retrait.

**2. Trois volumes maximum.** Au-delà, la silhouette devient du bruit à cette
résolution.

**3. Casser au moins une symétrie.** Un objet parfaitement symétrique et aligné
lit comme du CAD. Un présentoir de travers, une palette mal empilée, une
étagère à moitié vide : c'est ce qui donne un lieu habité.

**4. Varier les échelles.** Une pièce où tout mesure entre 1 et 2 m est
visuellement plate. Du très grand (rack de 6 m), du moyen (gondoles), du petit
(cartons au sol).

**5. Texturer en dernier, sur la trim sheet existante.**

## Budget

| Catégorie | Triangles |
|---|---|
| Pièce de kit | 50 – 300 |
| Prop courant | 100 – 500 |
| Prop signature | 500 – 2 000 |
| Total niveau | < 200 000 |

Un prop courant à 3 000 triangles est un signal d'erreur de méthode.

## Les six erreurs qui font « primitif »

1. **Boîte non retravaillée** — aucune saillie, contour carré
2. **Tout à la même échelle** — composition sans hiérarchie
3. **Alignement parfait partout** — lit comme un plan technique
4. **Une seule masse** — pas de décomposition volumétrique
5. **Texture non tileable ou à densité incohérente**
6. **Aucune subdivision** — impossible de baker, donc rendu plat

L'erreur 6 est traître : le prop peut avoir une bonne silhouette et rester plat
parce qu'il ne reçoit aucune lumière de secteur.

## Validation

Passer chaque prop par la **vue silhouette**, à côté de trois autres props de
la même pièce :

- Est-il identifiable ?
- Se distingue-t-il de ses voisins ?
- Sa taille est-elle lisible sans référence ?

Un prop qui échoue ne sera jamais sauvé par sa texture.
