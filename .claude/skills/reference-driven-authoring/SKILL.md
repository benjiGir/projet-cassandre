---
name: reference-driven-authoring
description: Travailler à partir d'un board d'images d'inspiration — ce qui se transfère et ce qui ne se transfère pas, extraction de contraintes mesurables, protocole de comparaison côte à côte, ré-ancrage entre itérations. Charger dès qu'une tâche s'appuie sur des références visuelles.
---

# Travail à partir de références

## Ce qui se transfère, et ce qui ne se transfère pas

Une image de référence n'est pas une chose à copier. C'est une source de
**contraintes**. Les contraintes chiffrables se transfèrent bien ; l'ambiance ne
se transfère pas du tout.

| Transfert | Fidélité | Comment |
|---|---|---|
| **Palette et valeurs** | très haute | mesuré, `extract_palette.py` |
| **Contraste et clé lumineuse** | très haute | mesuré |
| **Proportions et échelle** | haute | lues sur l'image contre une référence humaine |
| **Densité d'encombrement** | haute | comptage d'objets par m² |
| **Direction et température de lumière** | haute | appliqué au bake vertex colors |
| **Structure de composition** | moyenne | lignes de force, plans de profondeur |
| **Vocabulaire de silhouettes** | moyenne | anguleux/arrondi, vertical/horizontal |
| **Forme exacte d'un objet précis** | **faible** | voir plus bas |
| **Détail de texture** | **faible** | l'agent ne peint pas |
| **« Le feeling »** | **nul** | non mesurable, donc non transférable |

**La ligne à retenir** : l'agent reproduira de façon fiable la *logique* d'une
image — sa palette, son échelle, sa densité, son éclairage. Il ne reproduira
pas de façon fiable un *objet particulier* qu'on y voit.

Pour un objet précis identifiable, la modélisation par script `bpy` donne un
résultat médiocre : elle construit à partir de primitives et de modificateurs,
ce qui est le point faible documenté du pilotage de Blender par agent. Passer
plutôt par l'image-to-3D (voir `ai-3d-asset-integration`), qui est justement
fait pour ça.

## Le board, pas l'image

**Une image unique produit un résultat générique.** L'agent n'a aucun moyen de
distinguer ce qui est essentiel de ce qui est accidentel.

Un board de **5 à 10 images** permet d'identifier le dénominateur commun, et
c'est ce dénominateur qui constitue la direction artistique.

```
refs/
  hypermarche/       intérieurs commerciaux, nuit, néons
  reserve/           entrepôts, racks, quais
  props/             mobilier de vente, caddies, présentoirs
  ennemis/           costards, silhouettes, ambiance paranoïaque
```

Un dossier par sujet. Les mélanger dilue les contraintes.

## Protocole

```
1. Extraire les contraintes mesurables
     python3 tools/refs/extract_palette.py refs/hypermarche/ --colors 24

2. OUVRIR les images de référence (view) et écrire une fiche de spec :
     - proportions relevées (hauteur sous plafond / hauteur humaine)
     - densité (objets par m², surfaces vides vs chargées)
     - direction et nombre de sources lumineuses
     - vocabulaire de silhouettes récurrent
     - ce qui, dans le board, N'EST PAS transférable

3. Construire contre la spec écrite, pas contre le souvenir des images

4. Rendre les vues de contrôle (render_preview.py)

5. COMPARER côte à côte : rendu et référence ouverts ensemble
     - la palette correspond-elle au palette.json ?
     - la clé lumineuse est-elle la même ?
     - la densité est-elle comparable ?
     - l'échelle tient-elle contre la référence humaine ?

6. Réviser. Retour en 4. Maximum 4 itérations.
```

**L'étape 2 est celle qu'on saute et qui coûte le plus cher.** Sans fiche de
spec écrite, l'agent dérive dès la deuxième itération : il corrige contre son
propre rendu précédent au lieu de la référence.

## Ré-ancrage

À chaque itération, **rouvrir les références**, pas seulement le rendu
précédent. La dérive est le mode d'échec principal d'une boucle de critique
longue : on optimise progressivement vers autre chose, et le résultat final est
cohérent avec lui-même mais éloigné du board.

Symptôme : la troisième itération est meilleure que la deuxième, mais plus loin
de la référence. Si ça arrive, repartir de la spec écrite.

## Contraintes chiffrées à extraire systématiquement

`extract_palette.py` produit ces valeurs, et elles doivent apparaître dans la
spec :

- **Clé** — low-key / mid-key / high-key, avec la luminance moyenne
- **Contraste** — écart-type de luminance
- **Saturation** — désaturé / modéré / saturé
- **Température** — chaude / froide / neutre
- **Part sombre et part claire** — en pourcentage de pixels
- **Couleur d'ennemi recommandée** — celle qui garantit le meilleur contraste
  minimum contre les six surfaces dominantes

Le dernier point est spécifique au projet : à 640×360, un ennemi qui ne se
détache pas de son fond est un problème d'équité. L'outil donne directement la
couleur qui maximise le contraste garanti — viser un ratio d'au moins 3.0.

## Attentes réalistes

Avec un board correct et ce protocole, attends-toi à :

- **Palette et ambiance lumineuse** : très proches du board
- **Échelle et proportions d'architecture** : correctes
- **Densité et rythme d'encombrement** : proches
- **Familles de silhouettes** : reconnaissables
- **Objets individuels** : de la même famille, mais pas les mêmes objets
- **Caractère et personnalité** : c'est toi qui l'apportes

Un agent qui rend un niveau partageant la palette du board mais rien d'autre a
échoué. C'est le mode d'échec à surveiller, et la comparaison côte à côte de
l'étape 5 existe pour l'attraper.
