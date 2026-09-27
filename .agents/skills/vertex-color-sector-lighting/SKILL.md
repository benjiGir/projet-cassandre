---
name: vertex-color-sector-lighting
description: Éclairage de niveau baké en vertex colors pour MeshLambertMaterial — pourquoi pas de lightmap, contrainte de subdivision, procédure de bake Blender, export glTF COLOR_0, réglages Three.js. Charger pour toute tâche d'éclairage de niveau.
---

# Éclairage par vertex colors

## Le raisonnement

Un niveau Build est éclairé par **secteur** : chaque zone a son niveau de
lumière, baké dans la géométrie. Pas d'ombres dynamiques, pas de calcul par
pixel.

L'équivalent moderne le plus proche et le moins cher est le **bake en vertex
colors**, pas la lightmap :

- Une lightmap à 128 px/m sur un niveau entier pèse plusieurs Mo pour un rendu
  affiché en 640×360 — la résolution est perdue avant d'être vue
- Les vertex colors sont **gratuites** : aucune texture, aucun draw call, aucun
  UV supplémentaire à dépaqueter
- `MeshLambertMaterial` les supporte nativement
- Le résultat interpolé par sommet correspond exactement au registre visuel de
  l'époque (Gouraud)

## La contrainte qui décide de tout

**Un mur en 2 triangles a 4 sommets et ne peut recevoir aucun éclairage
utile.** Le bake n'a nulle part où s'inscrire.

Les pièces du kit doivent donc être **subdivisées pour l'éclairage** : une face
de 4 × 5 m découpée tous les 1 m donne 5 × 6 = 30 sommets, suffisant pour un
dégradé de secteur crédible.

C'est un arbitrage assumé : plus de triangles pour zéro texture. Sur un budget
de 200 k triangles, un niveau d'hypermarché entièrement subdivisé au mètre
reste très loin du plafond.

Corollaire pour `modular-kit-design` : **la subdivision est une propriété du
kit**, pas une correction apportée après coup. Une pièce non subdivisée devra
être refaite.

## Procédure de bake

```
1. Éclairer la scène dans Blender (area lights aux néons du plafond,
   ambiante basse, quelques ponctuelles pour les accents)
2. Sur chaque mesh : Object Data → Color Attributes → New
   Nom : "Col"   Domaine : Point (Vertex)   Type : Color (Byte)
3. Render Properties → Cycles
4. Render → Bake
     Bake Type : Combined  (ou Diffuse → Direct + Indirect)
     Output    : Active Color Attribute
     Samples   : 128 suffit largement à cette résolution
5. Repasser le viewport en Solid → Color : Attribute pour contrôler
```

Baker en **Combined** capture aussi le rebond indirect, ce qui donne
gratuitement la sensation d'espace clos que le Lambert seul n'a pas.

## Export et runtime

À l'export glTF : cocher **Vertex Colors**. L'attribut sort en `COLOR_0`.

Côté Three.js :

```ts
material.vertexColors = true;
```

**Piège de colorspace** : glTF stocke `COLOR_0` en linéaire et le multiplie à
la couleur de base. Si le rendu paraît délavé ou trop sombre par rapport au
viewport Blender, c'est presque toujours là. Vérifier que l'attribut est bien
de type `Color` et non `Byte Color` mal converti, et comparer une surface unie
de référence entre Blender et le jeu avant de tuner quoi que ce soit.

## Ce que ça ne fait pas

Les vertex colors sont **statiques**. Elles ne réagissent ni au muzzle flash,
ni aux lumières mobiles, ni à une porte qui s'ouvre sur une pièce éclairée.

C'est cohérent avec le projet — Build ne le faisait pas non plus. Les lumières
dynamiques restent réservées aux effets courts : muzzle flash, explosion,
gyrophare. Deux à trois `PointLight` à portée courte maximum en simultané, et
uniquement pour du transitoire.

## Diagnostic

Générer une capture du niveau en mode « vertex colors seules » (matériau blanc
uni + `vertexColors`). Les zones noires signalent un bake manquant, les zones
plates une subdivision insuffisante.
