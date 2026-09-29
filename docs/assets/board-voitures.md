---
title: Board de références — voitures du parking
tags: [assets, references, voitures, parking]
status: brouillon
updated: 2026-09-29
---

# Board de références — voitures du parking

Références de silhouette pour cinq modèles originaux destinés au parking du
niveau v2. Les photos servent à relever des proportions et des traits de
catégorie ; aucun badge, détail distinctif ni carrosserie exacte n'est repris.

## Références

### Citadine — petite 5 portes européenne

- [Renault Super 5 — Classic Trader](https://www.classic-trader.com/nl/oldtimer/zoeken/renault/r-5) : hauteur de caisse, porte-à-faux courts, hayon abrupt, pare-chocs noirs.
- [Renault Super 5 — fiche et dimensions](https://en.wikipedia.org/wiki/Renault_Super_5) : 3,59–3,65 m de long, 1,59 m de large, 1,39 m de haut.

### Berline — familiale trois volumes

- [Peugeot 505 — profil latéral, Barrett-Jackson](https://barrettjacksoncdn.azureedge.net/staging/Content/Pages/InventoryDetails/211231.html) : capot long, coffre marqué, ceinture basse et bande latérale.
- [Peugeot 505 — Mecanicus](https://www.mecanicus.com/autopedia/peugeot-505) : vitrages et montants droits, chrome discret, proportions de berline européenne.
- [Peugeot 505 1985 — dimensions](https://www.carsales.com.au/research/peugeot/505/1985/) : longueur 4,58 m, largeur 1,73–1,74 m, hauteur 1,43–1,45 m.

### SUV — 4×4 familial carré

- [Range Rover Classic — fiche technique constructeur 1987](https://www.landroverusa.com/content/dam/lrdx/pdfs/1987_Range_Rover_Classic.pdf) : 4,45 × 1,818 × 1,80 m.
- [Range Rover Classic 1985 — Collecting Cars](https://collectingcars.com/for-sale/1985-range-rover-classic) : volume haut et carré, flancs simples, roues et garde au sol marquées.

### Camion — porteur léger de livraison à hayon

- [IVECO Daily carrossé, communiqué constructeur](https://www.iveco.com/uk/discover-iveco/press-room/Press-Releases/2015/International-Van-of-the-Year-makes-its-CV-Show-debut) : référence de gabarit 3,5 t, empattement 3,75 m, caisse de 4,20 m et hayon de livraison.
- [Renault Trucks Master carrossé](https://novarnish.mws-prod-mea.renault-trucks.com/en-mea/product/renault-trucks-master) : autre lecture de la cabine courte, de la caisse fermée et du hayon. Le modèle proposé n'en reproduit pas la carrosserie.

### Muscle car — coupé américain du début des années 1970

- [Brochure Dodge Challenger 1972 numérisée](https://xr793.com/wp-content/uploads/2016/11/1972-Dodge-Challenger.pdf) : 191,3 pouces de long, 76,3 pouces de large, 50,9 pouces de haut, empattement de 110 pouces ; base des proportions du coupé original.
- [Challenger Rallye 1972 de profil](https://barrettjacksoncdn.azureedge.net/staging/Content/Pages/InventoryDetails/180479.html) : capot long, cabine reculée, pavillon bas et poupe courte. Ces traits de catégorie guident la silhouette, sans reprendre badges ni carrosserie exacte.

## Contraintes tirées du projet

- Blender : 1 unité = 1 m ; longueur alignée sur +Y et sol à Z=0.
- Parking existant : voitures du Kenney Car Kit, une matière atlas commune et
  teintes unies ; tailles de référence dans `tools/blender/lib_reserve.py`.
- Les modèles existants relevés dans `niveau_v2.blend` font 2 032–2 474 faces.
- Direction proposée : volumes anguleux années 70–80, facettes peu nombreuses,
  arêtes hautes de carrosserie biseautées, montants apparents et vitrages
  translucides laissant voir sièges et tableau de bord. Pneus noirs et peinture
  par couleurs de sommets ; aucun atlas supplémentaire et aucune marque réelle.

Les vitrages exportés sont des surfaces dédiées au matériau glTF `BLEND`
(alpha 0,36), séparées de la carrosserie opaque. Chaque modèle contient deux
primitives dans un seul objet. La scène source et les aperçus sont dans
`assets_src/blender/propositions_voitures.blend` et
`assets_src/blender/propositions_voitures/`.

## Cotes proposées

| Modèle | Longueur | Largeur | Hauteur | Lecture de silhouette |
|---|---:|---:|---:|---|
| Citadine | 3,65 m | 1,59 m | 1,46 m | 5 portes, capot court, pavillon rehaussé, hayon incliné |
| Berline | 4,58 m | 1,73 m | 1,52 m | capot + habitacle rehaussé + coffre séparé |
| SUV | 4,45 m | 1,82 m | 1,84 m | garde au sol, pavillon haut, roues épaisses, galerie |
| Camion | 6,40 m | 2,12 m | 2,90 m | cabine courte, caisse fermée, hayon arrière replié |
| Muscle 72 | 4,86 m | 1,94 m | 1,42 m | coupé 2 portes, long capot, habitacle reculé et rehaussé, roues arrière larges |

Les largeurs sont mesurées hors rétroviseurs ; la hauteur du SUV inclut sa
galerie de toit.

Les cinq propositions sont des modèles originaux génériques : la citadine
emprunte une silhouette de supermini française, la berline un profil familial
trois volumes, le SUV un 4×4 européen anguleux et le camion un porteur léger de
livraison. La muscle car reprend les proportions d'un coupé américain du début
des années 1970, avec une peinture prune, un toit sombre et quatre phares ronds.
Les proportions sont inspirées
des sources liées ci-dessus ; les pièces, couleurs et détails ont été dessinés
pour cette proposition.

Révision du 2026-09-29 : la planche pleine auparavant posée sur le pavillon du
SUV a été retirée. Les sièges des cinq modèles sont dimensionnés selon leur
hauteur intérieure pour rester sous le toit. Les pavillons de la citadine et de
la berline ont été rehaussés de 7 cm ; leurs phares et détails de calandre sont
maintenant posés sur le nez incliné, à l'extérieur de la carrosserie. Le hayon
du camion est représenté replié contre sa porte arrière ; `camion_hayon.png` en
donne une vue dédiée. `muscle_72.png` présente le coupé en vue trois quarts.

Le pavillon de la muscle car est rehaussé de 12 cm. Les vitres, montants et
dossiers suivent cette nouvelle hauteur, y compris dans les trois livrées.

## Extension : pickup, sportive, 4×4 et couleurs

Trois silhouettes originales rejoignent les propositions. Les cotes viennent de
références constructeur ; les carrosseries, vitrages et détails sont dessinés
pour le jeu.

- [Toyota Hilux, communiqué et cotes 2005](https://media.toyota.co.uk/bigger-and-better-the-toyota-hilux-moves-one-size-up/) : longueur 5,255 m, largeur 1,76 m et hauteur 1,68 à 1,81 m selon version. Le pickup proposé mesure 5,22 × 1,82 × 1,72 m. Il a une cabine courte, une benne réellement creuse et des phares visibles sur la face avant.
- [Porsche 924 GTP, fiche Porsche Classic](https://www.porsche.com/uk/accessoriesandservice/classic/924-gtp-restoration/) : longueur 4,20 m, largeur 1,85 m, hauteur 1,20 m. La sportive proposée mesure 4,23 × 1,84 × 1,29 m. Sa ligne en coin, son habitacle vitré et ses prises d'air latérales la distinguent de la muscle car à long capot.
- [Suzuki Jimny, dimensions constructeur](https://www.globalsuzuki.com/globalnews/2021/0120.html) : longueur 3,645 m, largeur 1,645 m et hauteur 1,72 m. Le 4×4 proposé est un véhicule utilitaire original de 4,25 × 1,72 × 1,90 m, roue de secours incluse. Deux portes, empattement court, garde au sol haute, admission surélevée et roue extérieure le distinguent du SUV familial.

Trois teintes par voiture sont livrées en GLB séparés. La première teinte de
chaque ligne reprend la couleur du modèle initial ; les deux autres sont des
variantes nouvelles. Le camion de livraison garde sa livrée propre.

| Voiture | Teinte initiale | Variante 1 | Variante 2 |
|---|---|---|---|
| Citadine | miel `#bd8d3c` | bleu orage `#537384` | rouge brique `#a94f42` |
| Berline | bleu acier `#71899a` | ivoire `#b8afa0` | vert sauge `#687e69` |
| SUV | olive `#6f7c57` | sable `#b09265` | bleu pétrole `#456c76` |
| Muscle car | prune `#684266` | cuivre `#a65c3f` | noir bleuté `#374650` |
| Pickup | terre `#7b5d44` | crème `#bdad8d` | vert pin `#4a6960` |
| Sportive | turquoise `#2f6570` | rouge corail `#a7433b` | argent `#9aabb0` |
| 4×4 | sable `#b29b72` | vert forêt `#536953` | bleu ardoise `#536c78` |

La source Blender `assets_src/blender/propositions_extension.blend` contient les
cinq nouveaux modèles et les 21 versions colorées des voitures. Les GLB et aperçus
sont dans `assets_src/blender/propositions_extension/`. Le script reproductible
est `tools/blender/propositions_extension_vehicules.py`.

## Placement dans le niveau

Le parking extérieur contient dix véhicules : les quatre voitures initiales,
un pickup crème, une sportive turquoise, un 4×4 sable, une seconde citadine
rouge, un roadster et un scooter. Le camion est réservé au quai de la réserve,
hayon orienté vers le mur nord.

Le sous-sol utilise les modèles originaux et leurs teintes, avec des deux-roues.
Les places occupées et les exclusions autour des ramassages et apparitions
restent celles du placement déterministe initial. Le pickup et la muscle car
sont exclus de ces places de cinq mètres : leur encombrement réel dépasse la
limite de 4,90 m.

Les placements sont partagés avec le générateur dans
`tools/level_v2/build_niveau.py`. Pour actualiser uniquement les véhicules d'une
source existante, ouvrir `niveau_v2.blend` avec Blender et exécuter
`tools/blender/refresh_level_vehicles.py`. Le script sauvegarde une copie dans
un dossier temporaire, remplace les meshes et leurs proxies, puis réexporte
le niveau sans reconstruire son décor.
