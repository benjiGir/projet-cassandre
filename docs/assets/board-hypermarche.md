---
title: Board de références — hypermarché
tags: [assets, references, niveau]
status: brouillon
updated: 2026-09-11
---

# Board de références — hypermarché

Fiche de spec du board d'images qui guide le niveau v2 (voir
`PLAN_NIVEAU_V2.md`), écrite selon le skill `reference-driven-authoring` :
contraintes mesurées, puis observations faites en regardant les images.
C'est contre cette fiche qu'on construit, pas contre le souvenir des images.

**Les images ne sont pas versionnées.** Elles vivent dans `refs/<sujet>/`
(gitignoré), toutes issues de Wikimedia Commons, pour un usage interne
uniquement (licences non auditées image par image). Les contraintes
chiffrées viennent de `tools/refs/extract_palette.py` (dépendances dans
`.venv-refs/`) et sont écrites dans `refs/<sujet>/palette.json` et
`value_profile.txt`.

## Vue d'ensemble chiffrée

| Sujet | Images | Clé | Contraste | Saturation | Température | Sombre / clair |
|---|---|---|---|---|---|---|
| `hypermarche_interieur` | 7 | mid-key (0.40) | fort (0.244) | modérée (0.25) | chaude | 35 % / 9 % |
| `hypermarche_90s` | 6 | mid-key (0.48) | moyen (0.212) | modérée (0.26) | chaude | 16 % / 9 % |
| `caisses` | 7 | mid-key (0.42) | moyen (0.236) | **modérée-haute (0.35)** | chaude | 28 % / 10 % |
| `props_mobilier` (caddies) | 7 | mid-key (0.46) | fort (0.243) | désaturée (0.20) | chaude | 24 % / 14 % |
| `reserve_quai` | 9 | mid-key (0.47) | moyen (0.232) | désaturée (0.18) | chaude | 22 % / 10 % |
| `galerie_marchande` | 3 | mid-key (0.49) | fort (0.263) | modérée (0.21) | chaude | 25 % / 16 % |
| `cafeteria` | 4 | mid-key (0.42) | moyen (0.193) | désaturée (0.16) | chaude | 19 % / 7 % |
| `electromenager_tv` | 2 | mid-key (0.43) | fort (0.257) | modérée (0.23) | **froide** | 36 % / 14 % |
| `parking_exterieur` | 8 | mid-key (0.51) | moyen (0.231) | modérée (0.22) | **neutre** | 14 % / 17 % |
| `parking_souterrain` | 7 | **low-key (0.37)** | moyen (0.221) | modérée (0.27) | chaude | **38 %** / 5 % |

## Décisions qui en découlent

- **L'intérieur du magasin est chaud** : néons, cartons, bois, carrelage.
  C'est la base de toute la surface de vente.
- **Trois espaces tranchent volontairement sur cette base**, et c'est la
  référence qui le justifie, pas une fantaisie :
  - le **parking extérieur** est neutre : lumière du jour, ciel, asphalte ;
  - l'**électroménager / TV** est froid : la lumière bleutée des écrans ;
  - le **parking souterrain** est le seul espace sombre (low-key, 38 % de
    pixels sombres) : pénombre, tubes fluo espacés.
- **Les caisses sont le pic de saturation** du magasin (confiserie,
  signalétique, promos). C'est le seul endroit où un accent couleur vif est
  justifié par la référence.
- **Contraste des ennemis** : sur presque tous les sujets, le contraste
  minimum garanti contre les six surfaces dominantes reste sous 3.0 (seule
  la cafétéria atteint 3.57 avec un blanc cassé). Le costume sombre du
  Costard risque de se fondre dans les zones sombres, en premier lieu le
  parking souterrain. À vérifier en jeu, zone par zone.

## Ce qui se transfère (observé sur les images)

**Rayons (`hypermarche_interieur`, `hypermarche_90s`)**
- Densité de produits extrême, un « mur de couleurs ». À 640×360, le
  produit individuel ne se lit pas : ce qui compte, c'est la silhouette
  des bords d'étagère (rangées régulières, tranches d'emballage) et la
  variation de couleur d'une rangée à l'autre.
- Têtes de gondole promo, étals de fruits en pyramide, pancartes
  « PROMO » accrochées aux étagères.
- Tubes fluo linéaires posés en rangées au plafond, alignés avec les
  allées : une direction de lumière lisible.

**Caisses (`caisses`)**
- Comptoirs à façade arrondie, souvent en stratifié bois chaud.
- Panneaux de numéro de caisse suspendus au plafond, lisibles de loin.
- Sol différent du reste du magasin (damier ou terrazzo clair).

**Réserve (`reserve_quai`)**
- Racks de 3 à 4 niveaux de palettes, fermes métalliques du toit
  visibles, luminaires suspendus : pas de plafond plat.
- Béton nu au sol, diables et chariots entre les racks.

**Galerie marchande (`galerie_marchande`)**
- Long couloir carrelé, plafond bas avec des rangées de spots encastrés.
- Vitrines en verre surmontées d'un bandeau d'enseigne rétroéclairé, qui
  donne son rythme au couloir. Bacs à plantes au milieu du passage.

**Cafétéria (`cafeteria`)**
- Long comptoir de self en inox, vitre de protection, rail à plateaux.
- Rangées de tables avec des chaises de couleur vive (rouge) sur un
  carrelage à motifs. Distributeur de tickets.

**Électroménager / TV (`electromenager_tv`)**
- Présentoirs et socles d'exposition, écrans allumés : lumière froide.
- Sujet très maigre (2 images), voir les manques ci-dessous.

**Parking extérieur (`parking_exterieur`)**
- Grande nappe d'asphalte, places peintes au sol, îlots de végétation,
  mâts d'éclairage, un abri à caddies (structure à toit courbé).
- Véhicules bas et longs (SUV, camion de livraison) : quelques formes
  génériques plutôt qu'un parking plein.

**Parking souterrain (`parking_souterrain`)**
- Piliers massifs en béton avec **des bandes de couleur peintes par
  niveau** (jaune, vert, rouge), des lettres et des flèches géantes peintes
  (« C1 », « SORTIE »). C'est la signature la plus « années 90 » de tout le
  board.
- Tubes fluo sur les poutres, rampes, cages d'escalier taguées.
- Piste de level design : le code couleur par niveau sert aussi à
  s'orienter, exactement comme les cartes de couleur d'un boomer shooter.

**Caddies (`props_mobilier`)**
- Treillis métallique fin avec une poignée plastique colorée (souvent
  rouge), toujours en rangées imbriquées, jamais isolés.

## Ce qui ne se transfère pas (délibérément ignoré)

- **Marques, logos et texte réels** : invisibles à 640×360, et exclus de
  toute façon par la règle de satire (marques inventées uniquement).
- La forme exacte d'un objet précis (un comptoir, un modèle de voiture) :
  on garde le vocabulaire de silhouettes, pas l'objet.
- Le reflet du métal (caddies, inox de la cafétéria) : l'invariant #5
  (`MeshLambertMaterial` uniquement) interdit tout spéculaire. La lecture
  « métal » passe par la silhouette et une teinte claire désaturée.
- Le détail photographique des sols et des murs : les textures du niveau
  v2 sont produites à 128 px et 64 px/m à partir de sources CC0,
  quantifiées sur la palette commune, pas découpées dans ces photos.

## Manques du board

- **L'époque n'est pas captée.** Commons ne fournit presque aucune photo
  d'hypermarché français des années 90 ; `hypermarche_90s` contient en
  réalité des grandes surfaces génériques. Seul le parking souterrain a le
  bon « jus ».
- **Électroménager / TV (2 images) et galerie marchande (3 images)** sont
  sous le seuil de 5 images que demande `reference-driven-authoring` pour
  dégager un dénominateur commun.
- **Aucune référence de style Build / Ion Fury** dans le board.

Pistes : photos personnelles ou trouvées par l'utilisateur d'hypermarchés
restés dans leur jus, et captures de Duke 3D / Ion Fury pour le style,
toujours en usage interne et dans `refs/` (non versionné).

## Écart avec le kit v1 (historique)

- `kit_checkout` est resté une boîte droite malgré les façades arrondies
  de la référence (décision de la passe du 2026-09-10, coût nul).
- L'abri à caddies a été ajouté au kit (`kit_cart_shelter`) lors de la
  même passe.

Dans le niveau v2, ces pièces sont remplacées par la bibliothèque tirée
des packs CC0 (voir `PLAN_NIVEAU_V2.md`, jalons N2 à N4).
