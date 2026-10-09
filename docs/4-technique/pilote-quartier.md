---
title: Place pilote du quartier — N4b
tags: [metro, quartier, blender, rendu]
status: brouillon
updated: 2026-10-09
---

# Place pilote du quartier — N4b

## Responsabilité et frontières

La [page de revue](../assets/pilote-quartier.html) charge le quartier dans le
moteur. Le raccourci `?level=pilote_quartier` existe en développement.
Le métro de campagne conserve le pilote des trains T2.

N4b assemble le [kit N3b](../assets/kit-quartier.md) pour juger la rue,
la place, ses accès et le repère de la tour. Les rencontres N7 et le
parcours complet N5 restent à construire. Il n'y a pas d'ennemi dans ce pilote.

## Fichiers

| Rôle | Fichier |
|---|---|
| Assemblage | `tools/metro/quartier/build_pilot.py` |
| Devantures et mobilier de place | `tools/metro/quartier/site_details.py` |
| Enveloppe de la bouche de métro | `tools/metro/quartier/station_access.py` |
| Trappe et descente de service | `tools/metro/quartier/service_access.py` |
| Helpers de pose et contrats | `tools/metro/quartier/authoring.py` |
| Recette | `tools/blender/cassandre.py`, commande `quartier_pilot` |
| Bibliothèque | `assets_src/library/lib_quartier_N3b.blend` |
| Source du pilote | `assets_src/blender/quartier_pilote.blend` |
| Export | `public/assets/levels/quartier_pilote.glb` |
| Espaces | `public/assets/levels/quartier_pilote.espaces.json` |
| Catalogue | `src/game/level/catalog/levels.ts` |
| Émissions | `src/render/environment/metro/quartierFixtures.ts` |
| Ambiances | `tools/audio/quartier_ambiances.py` |

## Place dans la boucle

Le pilote utilise le chargement glTF, le contrôleur Rapier et `DoorSystem`
existants. Les touches de la page d'auteur injectent des entrées clavier
ordinaires : l'ouverture et le déplacement se font dans le pas fixe.
Les points de vue utilisent la téléportation de développement existante.

Les scénarios sont vides. Les dons mystère du magasin sont désactivés pour
ce pilote. Les répliques, sons d'usage et soins utilisent les systèmes
existants ; aucun combat ni nouvelle progression de campagne n'est ajouté.

## Données et contrats

### Sols et limites

Repère Blender : X vers l'est, Y vers le nord, Z vertical.
La rue occupe X −5,5 à 5,5 et Y 8 à 40, à z = −0,25 m.
Les trottoirs font 2,5 m de large, à z = 0.
La place occupe X −20 à 20, Y 40 à 72, à z = 0.

Les commerces et façades ferment les côtés. Le passage de la cour est
dans la façade est, Y 64 à 68. La cour se prolonge à X 20 à 28.
Ce pilote couvre une partie du quartier N2 ; il ne représente pas encore
les 80 × 72 m du quartier complet ni son secret d'arrière-boutique.

La bouche conserve X −3 à 3, Y 72 à 84 et la descente de 5 m du plan N2.
La salle des billets est représentée par son début, Y 84 à 92.
Une paroi portant « QUAIS — HORS PILOTE » ferme la suite.

La trappe de 2 × 2 m coupe le sol de la cour, X 25 à 27, Y 70 à 72.
Son panneau de 1,90 × 1,96 m couvre le cadre et coulisse de 2,10 m vers le sud,
sous le dallage de la cour. Il ne traverse pas le mur est. Le joueur tombe sur un palier à **−2,25 m**,
puis descend onze marches de 0,25 m jusqu'à −5 m. La chute n'inflige
pas de dégât dans les systèmes actuels. Le retour se fait par l'accès public.

Les marches rejoignent le palier haut à −2,25 m et le palier bas à −5 m.
Un massif visible ferme leur dessous ; la collision reste une rampe convexe.
Les murs du puits s'arrêtent sous les dalles de la cour, sans faces superposées
sur leurs chants. Le linteau inférieur ferme le haut du passage vers les billets.

Les sols sont émis en surfaces distinctes : place, rue, trottoirs et trois
dalles autour de la trappe. Aucune dalle de cour ne ferme son ouverture.
Les escaliers utilisent des proxies de rampe convexe. Les plafonds restent
visuels, sauf le plafond de raccord au bas de l'escalier public, qui ferme
aussi la collision de l'enveloppe.

### Enveloppe de l'escalier public

La place s'arrêtait à Y 72 alors que les bandes latérales de la bouche
allaient jusqu'à Y 84. Leurs garde-corps étaient visuels ; en sautant au-dessus
des murets, le joueur sortait du sol et tombait dans le vide.

`station_access.enclose` ferme le volume à l'assemblage du pilote :
murs extérieurs aux X −3,25 / 3, de Y 71,85 à 84,25, depuis −5,5 jusqu'à
3,5 m ; retour au fond au-dessus de la descente ; soubassements sous les
bandes latérales ; socle sous toute la bouche et raccords du palier inférieur.
Les murs hauts se raccordent aux deux fronts bâtis, et dépassent de 2,5 m
les anciens murets : le saut standard de 1,1 m ne permet pas de les franchir.

Le bas du proxy de rampe existant est prolongé à −5,25 m, sans changer sa
pente supérieure. Un massif visible ferme le dessous des marches. Le plafond
de raccord commence à Y 81 et z = −1,5 m ; la hauteur libre au départ vaut
2,5 m. Les quatre mètres de passage et les deux portes sont conservés.
Les nouveaux proxies sont des cuboids ; aucune forme trimesh n'est ajoutée.

### Composition de la place

Retour utilisateur du 6 octobre : lumière validée, place trop vide,
commerces répétitifs, jours entre immeubles et abribus sans logique.
La surface reste 40 × 32 m ; la composition en réduit la sensation de vide.

- Fontaine octogonale de 4,8 m, décalée à X −2,5 / Y 56,
  contournable des deux côtés. Les deux vasques sont remplies par
  un [effet d’eau TSL](rendu.md#fontaine-du-quartier-en-tsl) : jet central,
  huit cascades et ondulations aux impacts. L’eau reste visuelle.
- Deux arbres en jardinières basses à X −12 / Y 61 et X 12 / Y 58.
  Les bancs se regroupent autour ; les accès au métro et à la cour restent dégagés.
- Trois guéridons et six chaises devant « LE PASSAGE », en bordure ouest.
- Une laverie et une épicerie, chacune présente une seule fois. Un café,
  une pharmacie et un atelier complètent les commerces. Les autres bases
  deviennent des entrées d'immeubles ; les étages se regroupent par travées
  de 8 m, avec la même variante sur toute la hauteur d'un bâtiment.
- Abribus sur le trottoir ouest, Y 28 à 32, ouvert vers la chaussée.
  Poteau « BUS 24 », marquage au bord de route et passage piéton à l'entrée
  de la place. Le fourgon rejoint le bord de chaussée, avant la place.
- Les jours de 1 m aux angles nord sont remplis ; murs de retour, fonds
  et toitures ferment les enveloppes. Des étages et un plafond prolongent
  le bâtiment au-dessus du porche de la cour, dont le passage au sol reste libre.

Le mobilier neuf est consolidé par matériau avant export. Jardinières,
troncs, bassin, tables et chaises ont des proxies cuboids ; les feuillages
restent visuels. Les nouvelles devantures du café, de la pharmacie et de
l'atelier sont fermées ; elles ne donnent pas accès à de nouveaux intérieurs.
Les 21 lampes gardent exactement leurs positions, couleurs et intensités.

### Passages

`use_quartier_trappe` ouvre `door_quartier_trappe` avec E.
Le panneau possède son propre collider, sans `col_*` jumeau.
Les poignées non mobiles de la source de kit ne sont pas reprises sur le
panneau du pilote, pour ne pas les laisser flotter à sa pose fermée.

Les trois meshes de la grille partagent le groupe `door_quartier_grille`.
Ils montent ensemble de 3 m ; des guides et un boîtier au-dessus de l'entrée
expliquent ce mouvement. La grille n'est pas manœuvrable depuis la place.
`use_quartier_grille`, au bas de la descente, l'ouvre pour le retour.
Les deux passages restent ouverts une fois déverrouillés.

Un soin de 25 PV est disponible près du kiosque, avant les accès.
La signalétique indique la cour depuis la place et le retour depuis les billets.

### Éclairage

Le mode hybride du moteur conserve son ambiante de 0,18 et le ciel `nuit`.
Le pilote fournit **21 marqueurs de lampes**, sous le pool existant de 48 :
18 pour rue, place et accès, et trois pour les billets.
Le kit porte `Col` blanc ; **aucun bake Cycles n'est livré dans ce lot**.

Les surfaces `quartier_lampe` et `quartier_vitre_chaude` conservent leur
émission après conversion Lambert. La conversion des autres matériaux
reste identique. Les textures gardent le nearest à l'agrandissement et le
filtrage de réduction du moteur.

La tour de 56 m se place hors parcours à Y 150, centrée sur l'axe de la rue.
C'est un repère provisoire : son placement dans le ciel du niveau complet
reste à adapter à N5. La vapeur n'est pas encore animée.

### Ambiance

Deux nappes originales de vent filtré, sans bourdon tonal : rue et service.
Elles sont chargées via le profil `quartier_pilote` et les mécanismes Howler
existants. Le profil du magasin et les sons de trains ne sont pas utilisés.

Boucle utile de 20 s, marge de codec de 0,5 s à chaque bord, 44 100 Hz stéréo,
OGG et M4A. Les bords reçoivent un fondu de 1,5 s. Les nappes respirent
lentement et n'ont pas d'événement ponctuel à ce stade.

Le RMS après décodage vaut environ −31 dBFS pour la rue et −35 dBFS pour le
service, avant le gain du lecteur. Le son est volontairement discret.
Les [mesures](../assets/pilote-quartier/audio-mesures.json) et
[spectrogrammes](../assets/pilote-quartier/audio-spectres.png) sont conservés.
Le raccord et l'agrément restent à écouter au casque.

## Pièges

- Un palier exactement 2 m sous le mur ne suffit pas : la capsule et la
  marge du contrôleur se heurtent au dessous. Le palier est abaissé à 2,25 m.
- Un bloc de bâtiment plein avalerait les intérieurs des vitrines. Les murs
  de fond restent des peaux, en retrait derrière le mobilier des boutiques.
- Les textes orientés depuis la cour doivent regarder vers la place ; les
  textes au bas de l'escalier doivent regarder vers l'intérieur des billets.
- Le rendu EEVEE sous-éclaire les zones sans lumière directe. Les images
  réellement capturées du moteur servent au jugement du pilote.

## Tests

La compilation de production passe. Aucune suite de tests automatisés n'est
ajoutée ni lancée pour ce lot. Le contrat d'export vérifie le contenu du GLB.
Les vues et observations de la revue manuelle restent dans le
[journal N4b](../journal/quartier-pilote-2026-10.md).
Le gate humain reste ouvert jusqu'au jugement de la place jouable.

## Comment vérifier

### Reproduire

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  -P tools/blender/cassandre_cli.py -- quartier_pilot
```

La recette sauvegarde la source dédiée, exporte le GLB et rend cinq vues.
`tools/audio/quartier_ambiances.py` produit les nappes, mesures et spectres
avec NumPy, Pillow et FFmpeg, sans modifier les ambiances du métro.

### Relecture en jeu

1. Remontez la rue vers la place et regardez la tour au-dessus des toits.
2. Repérez la grille fermée puis l'indication vers la cour, à droite.
3. Ouvrez la trappe avec E ; avancez dans le trou et descendez vers les billets.
4. Ouvrez la grille depuis le bas de l'escalier et revenez sur la place.
5. Jugez l'échelle, les passages, la lumière et la discrétion des deux nappes.

Les boutons de points de vue facilitent la revue, sans remplacer le parcours
à pied. « Recommencer le pilote » referme les passages et remet le joueur
dans la rue.
