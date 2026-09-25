---
title: Board de références — pistolet
tags: [assets, references, armes]
status: brouillon
updated: 2026-09-25
---

# Board de références — pistolet

Fiche de spec pour refaire le pistolet du joueur (`construire_pistolet`,
`tools/blender/build_weapons.py`), écrite selon le skill
`reference-driven-authoring`. Retour de l'utilisateur, mot pour mot :
« Refaire le modèle du pistolet, parce qu'il est vraiment horrible. Essaye de
t'inspirer sur Internet. Cherche des images. Regarde des tutos ou autres qui
pourraient t'aider à reproduire un petit pistolet. »

On construit contre CETTE fiche, pas contre le souvenir des images. Aucune
image n'est versionnée ni téléchargée : les références sont citées par URL
(section 5) et décrites avec nos mots. Les cotes réelles viennent des fiches
constructeur ou ont été mesurées au pixel sur des photos de profil (méthode
dans la section 5).

> **Note** — Les « px » de cette fiche sont des pixels de la résolution
> interne 640×360, jamais des pixels d'écran.

## 1. Diagnostic du pistolet actuel

Captures (scratchpad de la session, non versionné, régénérable avec les
commandes de la fin de section) :

| Fichier | Ce qu'il montre |
|---|---|
| `…/scratchpad/jeu/jeu_hub_pistolet.png` | en jeu, 640×360, allée centrale éclairée (niveau v2) |
| `…/scratchpad/jeu/jeu_parking_pistolet.png` | en jeu, parking de départ, la nuit |
| `…/scratchpad/jeu/jeu_parking_pompe.png`, `jeu_parking_pdb.png` | les deux autres armes, même point de vue |
| `…/scratchpad/actuel/pistolet.png` | rendu Workbench depuis l'œil (celui du script) |
| `…/scratchpad/actuel/natif_droite.png`, `natif_arriere.png`, `natif_trois_quarts_joueur.png` | le pistolet seul, orthographique |
| `…/scratchpad/actuel/natif_silhouette_droite.png` | sa silhouette en aplat |

`…` = `/private/tmp/claude-501/-Users-benji-Developer-boomer-shooter/165e47b2-7b59-4271-ae62-4a5377ad936e`.

### Ce qui le rend « horrible », mesuré

1. **Des proportions de sèche-cheveux.** Le modèle fait **21,0 cm de haut
   pour 20,7 cm de long** (rapport 1,01). Un Glock 17 fait 13,9 × 20,4 cm
   (0,68), un Beretta 92FS 13,7 × 21,7 cm (0,63). La faute est à la poignée :
   un tube à **5 pans de 4 cm de diamètre et 12 cm de long**, qui se lit comme
   un manche, pas comme une crosse.
2. **Des pièces qui ne se touchent pas.** De profil, la poignée flotte
   **~0,9 cm sous la carcasse** ; le pontet est une planche posée sous la
   carcasse, sans lien avec la poignée ; la détente flotte entre les deux.
   Invisible en vue subjective (la main couvre tout), flagrant sur le modèle
   au sol, couché sur le tapis de caisse.
3. **L'empilement est inversé.** La carcasse (3,8 cm de haut, 14 cm de long)
   est PLUS haute que la culasse (2,8 cm, 17 cm) : l'arme se lit comme deux
   briques superposées. Sur un vrai pistolet, la culasse domine : Glock,
   ~2,1 cm de flanc de culasse visible sur ~1,5 cm de cache-poussière ; Beretta,
   2,4 cm sur 1,7 cm. Conséquence directe : le dessus de la culasse est à
   **11,9 cm** au-dessus du poing, contre ~8,5 cm sur un Beretta.
4. **Un canon de jouet.** Un tube à 6 pans dépasse de **3,5 cm** devant la
   culasse (4,4 cm à l'échelle de la vue subjective). Un Glock a le canon à
   fleur, un Beretta le fait dépasser de 0,8 cm. Un long tube fin devant une
   boîte, c'est un Mauser d'opérette ou un pistolet à clous.
5. **Tout est noir, et le code contredit son propre commentaire.**
   Culasse `#2c2e33`, carcasse `#4b4f57`, poignée `#1c1c1f` : trois valeurs
   dans les 30 % les plus sombres. Le commentaire de `construire_pistolet` dit
   « culasse … plus claire que la carcasse », mais la culasse reçoit
   `acier_sombre`, la couleur la PLUS sombre des deux. Mesuré en jeu : dessus
   de culasse `#0c0f12`, flanc `#080a0d` dans l'allée centrale pourtant
   éclairée, `#050607` au parking. Dans la boîte du pistolet, **50 % des
   pixels sont sous 15 % de luminance dans le hub, 82 % au parking**.
6. **Des faces nues.** La face arrière de la culasse, la plus visible de
   toutes (40×33 px), est un rectangle uni. Aucun chanfrein, aucun détail
   peint, pas de stries, pas de fenêtre, pas de chien. Le seul détail qui se
   lit est la hausse (barre claire de 30×12 px).
7. **Pas de silhouette de pistolet en vue subjective.** La main cache la
   poignée et le pontet. Ce qui reste, c'est **une boîte posée sur un poing** :
   ni cran, ni chien, ni levier, ni marche entre culasse et carcasse. Rien ne
   dit « pistolet » à part la forme d'un pavé.

### Ce qui n'est PAS le problème

- **La place à l'écran.** Le pistolet fait 125 px de large et son bout de
  canon tombe à (400, 220), à 89 px du réticule. C'est dans la norme des
  références (Half-Life, Ion Fury, Cultic : 68 à 78 px, voir section 4).
- **Le nombre de triangles.** 108 triangles pour l'arme seule (275 avec
  l'avant-bras). Le défaut vient de la forme, pas de la finesse.

### Une contrainte qui dépasse le modèle : la vue subjective est très peu éclairée

Rapport mesuré entre la couleur affichée et l'albédo (en linéaire, canal
vert), aux deux points de capture : **peau 0,088 et dessus de culasse 0,175
dans le hub, 0,057 et 0,067 au parking.** Un niveau `hybride` n'a qu'une
ambiante à 0,18 (`lifecycle.ts::applyLightRig`) et des lampes au plafond, à
plusieurs mètres de l'arme. Conséquence : **même un blanc pur ne dépasse pas
`#45`-`#76` à l'écran**, et un albédo presque noir devient du noir absolu.
Les ennemis ont eu le même problème, réglé par des normales inclinées vers
le haut ([ADR 0028](../decisions/0028-sprites-ennemis-pre-rendus.md)).
Éclairer davantage la vue subjective relève du rendu (`retro-render`), hors
du périmètre de ce modèle. **La palette de la section 3 est conçue pour se
lire avec l'éclairage actuel, et reste juste s'il est relevé un jour.**

### Refaire les captures

```bash
# Rendus Blender, sans toucher public/ : sortie dans un dossier jetable
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  -P tools/blender/build_weapons.py -- --out <tmp>/armes.glb --renders <tmp> --debug
```

En jeu (`pnpm run dev`, fenêtre en 16:9, sinon le cadre est déformé) :
`cassandre.weapons.pickUpPistol()`, `cassandre.notarget(true)`,
`cassandre.player.spawn(0, 0, -50)` pour l'allée centrale. Le premier
`<canvas>` (640×360) se lit par `toDataURL` dans un `requestAnimationFrame`,
après le rendu de la frame.

## 2. Le modèle retenu : Beretta 92FS deux tons, gabarit compact

**Un Beretta 92FS (la famille du PAMAS G1 français) : culasse inox satinée,
carcasse et plaquettes noires, raccourci vers le 92 Compact (~19 cm).**
Photo de ce deux-tons exact (culasse inox sur carcasse noire) : IMFDB,
section 5.

### Pourquoi celui-là

1. **C'est le pistolet qui a le plus à montrer depuis l'œil.** La caméra voit
   l'arrière, le flanc gauche et le dessus (section 4). Le dessus d'un Glock
   est un plat uni. Celui d'un Beretta a **la culasse ouverte** : une longue
   bande sombre (le canon) entre deux rails clairs, sur la face la mieux
   éclairée de l'arme. L'arrière porte **le chien**, qui crante la silhouette
   au-dessus de la culasse, et **les deux leviers de sûreté** qui dépassent
   comme des oreilles. Le nez de la culasse enveloppe le canon, qui dépasse
   de 0,8 cm. Aucun de ces traits n'existe sur un Glock.
2. **Le ton du jeu.** C'est LE pistolet du cinéma d'action de l'époque :
   *L'Arme fatale* (1987), *Piège de cristal* (1988), *The Killer* (1989),
   *Nikita* (1990), *À toute épreuve* (1992), *Léon* (1994). Côté français,
   la Gendarmerie adopte en 1989 le **PAMAS G1**, un 92 fabriqué sous licence
   à Saint-Étienne. Un héros de stream qui ramasse sur un tapis de caisse
   l'arme de *Piège de cristal*, dans un hypermarché de 1995 : ça tient.
3. **Une identité de valeur distincte des deux autres armes.** Le pompe est
   sombre avec du bois, long, en diagonale ; le pied-de-biche est rouge et
   courbe ; le pistolet sera **clair, court et tenu haut**. Au changement
   d'arme, on le reconnaît à sa valeur avant sa forme. Les Costards portent
   des automatiques noirs (`render_enemy_sprites.py`) : celui du héros est
   deux tons.
4. **Une culasse claire survit à l'éclairage mesuré.** Voir la section 1 : un
   pistolet noir ne peut que disparaître dans la vue subjective, et sur le
   tapis de caisse, en caoutchouc sombre, où il est posé
   (`lib_facade.py`, `trim:joint_caoutchouc`).
5. **« Un petit pistolet »** : on garde les proportions du 92 et on le
   raccourcit vers le 92 Compact (19,7 cm au lieu de 21,7). Il reste petit à
   côté du pompe, et la culasse courte laisse lire l'ouverture.

### Pourquoi pas les autres

| Candidat | Pourquoi non |
|---|---|
| **Glock 17/19** (Duke 3D, Half-Life) | Le plus simple, mais son dessus plat répète l'échec actuel, « une boîte ». Duke et Half-Life s'en sortent par des reflets PEINTS image par image, ce qu'un modèle temps réel sous Lambert ne sait pas faire (section 5). C'est le repli si le Beretta coûte trop, avec les mêmes contraintes : voir en fin de section 3. |
| **Revolver** (Loverboy d'Ion Fury, Cultic) | La référence d'Ion Fury est déjà prise par le genre. Surtout, il jure avec la cadence semi-automatique de 0,22 s et avec les automatiques des Costards. |
| **Walther PPK** | 10 cm de haut : il disparaît dans une main au gabarit 2,20 m. |
| **SIG P226** (l'arme des « hommes en costume ») | Un bloc à chien, plus lisible qu'un Glock mais sans l'ouverture du dessus, qui est le vrai atout du Beretta dans cet angle. |

## 3. Contraintes mesurables

### 3.1 Cotes réelles (modèle au sol, échelle 1)

| Cote | Cible | Réel (source) |
|---|---|---|
| Longueur totale (bouche → queue de castor) | **19,1 cm** | 92FS 21,7 ; 92 Compact 19,7 ; Glock 17 20,4 |
| Hauteur totale (semelle → chien armé) | **13,6 cm** | 92FS 13,7 ; Glock 17 13,9 |
| Rapport hauteur / longueur | **0,71** (tolérance 0,63-0,72) | actuel : 1,01 |
| Culasse, longueur | **17,0 cm** = arrière plein 7,4 + ouverture 8,0 + nez 1,6 | 92FS : ~18 cm, soit 8,1 + 8,3 + 1,7 (mesuré) |
| Culasse, hauteur de la partie pleine | **2,4 cm** | 92FS 2,4 (mesuré) ; Glock ~2,1 |
| Flanc de culasse dans l'ouverture | **1,5 cm**, avec le canon visible **0,8 cm** au-dessus | mesuré : 1,5 et 0,76 |
| Nez de la culasse | **1,6 cm** de long, de haut en bas de l'avant (4,0 cm), enveloppe le canon | mesuré : 1,7 × 3,6 |
| Culasse, largeur | **2,8 cm** ; 3,6 cm avec les leviers | Glock : culasse 2,55 ; 92FS : 3,8 hors-tout |
| Canon | ⌀ **1,4 cm**, dépasse de **0,8 cm** devant le nez | mesuré : 0,8 |
| Cache-poussière (carcasse sous la culasse) | **1,7 cm** de haut, du pontet au nez | mesuré : 1,7 |
| Carcasse entre la main et la culasse, à l'arrière | **1,5 cm** | mesuré : 1,56 ; actuel : 3,8 |
| Pontet | **6,3 cm** hors-tout, ajouré (trou ~5,3 × 2,7), avant carré, barre de 0,5 cm | mesuré : 6,3 |
| Bas du pontet sous le dessus de culasse | **7,3 cm** | mesuré : 7,3 |
| Poignée | **9,0 cm** (sous la queue de castor → semelle), **5,5** de profondeur, **3,4** d'épaisseur | 92FS : ~9,5 × 5,5 × 3,8 |
| Angle de la poignée | **18°** vers l'arrière depuis la verticale (tolérance 15-20°) | Beretta ~16° (mesuré, moyenne devant / dos), 1911 et P226 18°, Glock 22° (109° à l'axe) |
| Queue de castor (au-dessus de la main) | dépasse **1,3 cm** derrière la culasse | mesuré : 1,3-1,6 |
| Chien (armé) | **0,9** de large, dépasse **0,6** au-dessus de la culasse | — |
| Leviers de sûreté | **1,3 × 0,8 cm**, saillie **0,4** de chaque côté, à 0,7 cm de l'arrière | — |
| Hausse | **2,0 × 0,5 × 0,6 cm**, cran de 0,4 × 0,3 | — |
| Guidon | **0,3 × 0,6 × 1,0 cm** | — |

### 3.2 Ce qui triche en vue subjective

La vue subjective garde son échelle générale (`ECHELLE_PISTOLET_VM = 1.25`,
comme les bras : voir [ADR 0029](../decisions/0029-armes-en-vue-subjective.md))
et ajoute trois exagérations, que le modèle au sol ne porte pas. Un
paramètre de `construire_pistolet`, 1,0 au sol et les valeurs ci-dessous en
vue subjective, suffit.

- **Section de culasse ×1,2** (largeur et hauteur, autour de l'axe de la
  culasse), longueurs inchangées : 3,3 × 2,9 cm. Le pistolet de Duke est
  « bien plus massif qu'un vrai Glock » (IMFDB), et celui des Costards est
  déjà exagéré ×1,6.
- **Points de visée ×2** : 4 mm au lieu de 2 mm, sinon ils font moins d'un
  pixel.
- **Chien ×1,3.**

### 3.3 Repères dans le repère de l'arme

Même repère que le `construire_pistolet` actuel : **origine au centre du
poing, +Y vers la bouche, +Z en haut, +X à droite de l'arme**. Échelle
réelle, en mètres. C'est une grille de cotes, pas un modèle.

| Repère | Y | Z |
|---|---|---|
| Arrière de culasse / nez / bouche du canon | −0,037 / +0,117 → +0,133 / +0,141 | — |
| Partie pleine de la culasse / ouverture | −0,037 → +0,037 / +0,037 → +0,117 | — |
| Dessus de culasse (partie pleine et nez) | — | +0,085 |
| Dessus du canon dans l'ouverture / haut du flanc | — | +0,084 / +0,076 |
| Axe du canon (⌀ 1,4) | — | +0,077 |
| Bas de culasse = haut de carcasse | — | +0,061 |
| Bas du cache-poussière et du nez | — | +0,044 |
| Queue de castor (dessous = creux de la main) | −0,050 → poignée | +0,045 |
| Chien armé | −0,048 → −0,037 | sommet +0,091 |
| Hausse / guidon | −0,034 → −0,028 / +0,122 → +0,132 | sur le dessus de culasse |
| Leviers | −0,030 → −0,017 | +0,066 → +0,074 |
| Stries (deux flancs) | −0,033 → +0,002 | +0,063 → +0,083 |
| Pontet | +0,010 → +0,073 | bas à +0,012 |
| Détente | +0,035 | +0,044 → +0,022 |
| Poignée (axe incliné de 18°, passe par l'origine) | profondeur 5,5 | +0,045 → −0,045 (semelle) |

Deux conséquences pour le script :

- **À prise égale, la culasse descend d'environ 3,4 cm** (dessus à +0,085
  contre +0,119 aujourd'hui). Pour garder le bout du canon au même endroit à
  l'écran, le point de départ est `PRISE_PISTOLET ≈ (0.16, 0.30, −0.20)`,
  qui projette le bout du canon à (395, 223), à 86 px du réticule. C'est une
  projection de gabarits : **à confirmer au rendu et au rapport de l'IK**
  (distance épaule-cible).
- L'extra `bout_canon` est aujourd'hui calculé depuis un point codé en dur,
  `(0, 0.175, 0.105)` dans `assembler`. **Il doit suivre la nouvelle bouche,
  `(0, 0.141, 0.077)`**, sinon l'éclair de tir naît dans le vide.

Profil gauche, le flanc que voit la caméra (bouche à gauche, cm, pas à
l'échelle) :

```
        guidon                                 hausse     chien armé
          v                                     v   v      v
 canon  +---+---------------------------+---------------+  #
 0,8  ==|nez| canon visible (bande 0,8)  | partie pleine |  #     dessus : +8,5
        |   |===========================| ||||| stries (o)levier  2,4
        |4,0| flanc de culasse 1,5       |               |
        |   +---------------------------+-------+-------+----+
        +---| cache-poussière 1,7              |  carcasse 1,5 | queue de
            +---------+------------------+     |              _\ castor 1,3
                      |  pontet 6,3      |    /  poignée      /
                      |  (ajouré)    )   |   /  9,0 x 5,5    /   18° vers
                      +------------------+  /   x 3,4       /    l'arrière
                                           +---------------+ semelle
   |<-1,6->|<------------ 8,0 ------------>|<---- 7,4 ---->|<1,3>|
     nez           ouverture                  pleine         chien
```

### 3.4 Éléments de silhouette, par priorité

Chacun doit se lire dans le rendu de `pistolet.png`, en aplat noir compris :

1. **La culasse**, volume dominant, avec ses **chanfreins de dessus** (biseau
   à 45° de 3 mm sur les deux arêtes hautes) : c'est le liseré clair qui
   sépare le dessus du flanc, la signature des pistolets de Half-Life et
   d'Ion Fury.
2. **L'ouverture du dessus et le canon** : bande sombre entre deux rails
   clairs sur 8 cm, nez qui enveloppe le canon, canon qui dépasse de 0,8 cm.
3. **La hausse à cran** (deux montants, le cran fait au moins 3 px à
   l'écran) **et le guidon**.
4. **Le chien armé**, qui crante le haut de la silhouette arrière.
5. **Les deux leviers de sûreté**, qui débordent de la face arrière.
6. **La queue de castor** au-dessus du creux de la main : c'est elle qui
   laisse voir 1,5 cm de carcasse entre la main et la culasse.
7. **Le pontet ajouré** à l'avant carré : un trou réel, pas une plaque. Il
   se voit au sol et sous la culasse devant l'index.
8. **Le cache-poussière**, qui marque la séparation des deux tons sur le
   flanc.
9. **La poignée** : un pavé à dos chanfreiné, semelle de chargeur débordant
   d'un millimètre. Cachée en vue subjective, elle ne compte qu'au sol.
10. **La détente**, lisible au sol seulement.

### 3.5 Ce qu'on supprime

Ne se lit pas à 11 px/cm (section 4), ou jamais dans le champ :

- les gravures et le texte de culasse, le médaillon et les vis des
  plaquettes ;
- l'arrêtoir de culasse, le levier de démontage, le bouton de chargeur,
  l'extracteur, les goupilles, l'indicateur de chargement, l'anneau de
  dragonne, le quadrillage de l'avant du pontet et du devant de poignée ;
- le relief des stries : elles sont PEINTES (section 3.8) ;
- le rond de la bouche : le canon est un prisme à 6 pans, sa face avant ne
  se voit qu'au sol ;
- ce que l'existant avait de trop : le tube-poignée, la carcasse de 3,8 cm,
  le canon qui dépasse de 3,5 cm.

### 3.6 Budget

| Poste | Triangles (estimation) |
|---|---|
| Culasse en trois tronçons, chanfreins compris | 90-110 |
| Canon (prisme à 6 pans, partie visible + bouche) | 25-30 |
| Hausse (2 montants), guidon, chien, 2 leviers | 60-70 |
| Carcasse : cache-poussière, pontet ajouré (anneau de 8 segments), queue de castor | 80-100 |
| Poignée et semelle | 30-40 |
| Détente | 10 |
| Découpes de faces pour le détail peint | 40-60 |
| **Total arme seule** | **~350-420, plafond dur 500** (l'actuel : 108) |

L'avant-bras en ajoute ~170. Toujours **un seul lot de dessin**, arme et bras
fusionnés, un matériau à couleurs de sommets. Une culasse séparée qui recule
à chaque tir serait un beau geste (même montage que le fût du pompe, un lot
de plus), mais elle suppose du code dans `render/viewmodel.ts` : c'est une
option, pas une exigence de ce modèle. Référence de budget : le « PS1 style
handgun » de Sketchfab tient en 473 triangles avec un pontet ajouré.

### 3.7 Palette

Trois familles (inox clair, noir, accent blanc). L'inox porte trois valeurs
pour peindre l'éclairage à la manière du Build. Albédo en sRGB, puis valeur
PRÉVUE à l'écran avec les rapports mesurés en section 1 (0,06 au parking,
0,18 au mieux dans le hub) :

| Nom | Albédo | Pièces | À l'écran (0,06 → 0,18) |
|---|---|---|---|
| `inox_clair` | `#d4d7dc` | dessus de culasse, chanfreins, dessus du nez | `#38` → `#61` |
| `inox` | `#a2a7b0` | flancs et face arrière de culasse, nez, bandes claires des stries | `#28` → `#48` |
| `inox_ombre` | `#6e737c` | bandes sombres des stries, bas des flancs (fausse occlusion), fond du cran de hausse | `#18` → `#2f` |
| `acier_bleui` | `#2c2e33` (l'`acier_sombre` existant) | canon, chien, leviers, hausse et guidon, détente, trait de jointure | `#05` → `#0e` |
| `carcasse` | `#3b3d44` | cache-poussière, pontet, queue de castor, poignée | `#09` → `#16` |
| `plaquettes` | `#25262a` + damier `#34363c` | plaquettes de poignée | `#04` → `#0b` |
| `point` | `#f3f0e6` | 3 points de visée | `#42` → `#70` |

**Pourquoi la culasse plus claire que la carcasse**, dans cet ordre :

1. C'est la pièce que la caméra voit, et le dessus est la face tournée vers
   les lampes du plafond.
2. Le contraste culasse claire / carcasse noire, environ 8 fois en
   luminance, fait lire « pistolet » même en vignette.
3. Elle sépare le pistolet du pompe au premier coup d'œil.
4. Elle reste lisible sur le tapis de caisse sombre.

Pour comparaison, la main s'affiche entre `#34` et `#5b` : la culasse sera
aussi claire que la peau, contre 3 à 6 fois plus sombre aujourd'hui (valeurs
sRGB mesurées : 3 fois dans l'allée centrale, 6 au parking).

### 3.8 Détail peint plutôt que modelé

Les armes n'ont ni UV ni texture (`export_materials="NONE"`, un
`MeshLambertMaterial` à couleurs de sommets partagé dans
`render/viewmodel.ts`). Tout détail « de texture » se fait donc en
**découpant une face et en peignant ses morceaux**, sans relief : aucun
chevauchement, donc aucun z-fighting.

| Détail | Comment | À l'écran |
|---|---|---|
| Stries arrière | 5 bandes alternées `inox` / `inox_ombre` de 7 mm (3 claires, 2 sombres) sur 3,5 cm, sur les deux flancs (la vraie arme en a ~14 : illisible) | ~4-5 px par bande sur le flanc gauche (6,5 px/cm le long du flanc, près de l'arrière) |
| Points de visée | 3 faces `point` de 4 mm : 2 sur la face arrière de la hausse, 1 sur le guidon | 3-4 px |
| Liseré du dessus | les chanfreins de la section 3.4 (géométrie), en `inox_clair` | 2-3 px |
| Jointure culasse / carcasse | bande de 2 mm en `acier_bleui` au bas du flanc de culasse | 2 px |
| Fausse occlusion | bande de 4 mm en `inox_ombre` sous le flanc `inox` : la valeur peinte d'Ion Fury, ici dans les sommets | 3-4 px |
| Quadrillage des plaquettes | damier 2 tons, cases de 8 mm | au sol seulement |

Une texture de 64 px serait la vraie manière du Build : à 11 px/cm, 64
texels sur 18 cm donnent ~3 px par texel, la même densité apparente que les
murs du niveau. Elle demande des UV sur l'arme ET les bras, et un matériau
propre au pistolet dans `render/viewmodel.ts` (filtrage de l'ADR 0027).
C'est une décision de rendu, **hors du périmètre de ce modèle**.

### Repli : un Glock

Si le Beretta est refusé, tout ce qui précède reste valable, sauf l'ouverture
du dessus et le chien : culasse pleine de 18,6 × 2,1 cm sur un
cache-poussière de 1,5 cm, canon à fleur, poignée à 22°. Cotes mesurées sur
un Glock 17 de 2ᵉ génération : 3,36 px/mm, contrôle 204 mm de long pour
138 mm de haut, contre 204 × 139 à la fiche constructeur. Il faut alors
reporter toute la lisibilité sur les chanfreins clairs et la hausse, et
garder une culasse `inox`. Un Glock noir retomberait dans le défaut 5.

## 4. Ce que la caméra voit

**La caméra voit l'arrière, le flanc GAUCHE et le dessus de l'arme**, jamais
le flanc droit. L'arme est à droite de l'œil (`PRISE_PISTOLET.x > 0`), sous
lui, et pointe presque droit devant. Produit scalaire entre la normale de
chaque face et la direction milieu de culasse → œil, calculé à la prise
proposée `(0.16, 0.30, −0.20)` (à la prise actuelle entre parenthèses) :
**arrière +0,82 (+0,74), flanc gauche +0,46 (+0,50), dessus +0,34 (+0,44),
flanc droit −0,46 (−0,50)**. La face arrière est donc celle qui fait face à
l'œil. Le dessus, le plus raccourci des trois, reste une grande surface parce
qu'il est long. Tout détail de flanc qui compte (stries, levier, séparation
des deux tons) va **sur le flanc gauche**, quitte à tricher comme Duke 3D, qui a
mis sa fenêtre d'éjection à gauche pour voir voler les douilles (IMFDB).
Avec le Beretta, la question ne se pose pas : l'éjection passe par le dessus
ouvert.

Faces par ordre d'importance, avec leur taille projetée (gabarits de la
section 3.3, échelle 1,25, section ×1,2, prise `(0.16, 0.30, −0.20)`) :

| Face | Taille à l'écran | Ce qui doit s'y lire |
|---|---|---|
| Dessus de culasse | 39 px de large à l'arrière, 21 px à la bouche (culasse entière : boîte de 111×89 px) ; ouverture 46×32 px | bande sombre du canon, rails clairs, hausse, guidon |
| Face arrière | 42×36 px, **53 px avec les leviers** | cran de hausse et ses 2 points, chien, leviers, bord clair |
| Flanc gauche de culasse | bande de 34 px de haut à l'arrière, 19 px à la bouche, sur ~70 px de long | stries, levier, trait de jointure, séparation des deux tons |
| Queue de castor | ~50×40 px, en partie sous la main | 1,5 cm de carcasse noire entre la main et la culasse |
| Avant du pontet | quelques px devant l'index | le trou |
| Jamais vus | — | flanc droit, dessous, poignée (sous la main), bouche |

Densité : **1 cm vaut 11 px sur la face arrière et 8,6 px le long du dessus**
(raccourci). Tout détail sous 4 mm est exagéré ou supprimé.

### Taille visée, comparée aux références

Mesures à l'œil sur des captures redimensionnées à 640×360, à ±10 px près :

| Arme | Bout du canon | Distance au réticule | Bloc arrière | Arme + main, largeur |
|---|---|---|---|---|
| Half-Life, Glock 17 | (354, 239) | 68 px | 19×25 px | ~120 px |
| Ion Fury, Loverboy | (383, 224) | 77 px | ~45×69 px (chien, barillet) | ~116 px |
| Cultic, C96 | (392, 210) | 78 px | ~32×100 px | ~120 px |
| CASSANDRE actuel | (400, 220) | 89 px | 40×33 px | 125 px |
| **Cible** | **~(395, 223)** | **70-95 px** | **≥ 45 px de large, leviers compris** | **110-130 px** |

Règles de placement :

- **Rien de l'arme à moins de 60 px du réticule.** Le bout du canon est le
  point le plus proche.
- **Le haut de la main reste au moins 1 cm sous le bas de la culasse**, côté
  arrière. Aujourd'hui le poing monte jusqu'à la culasse et avale la
  carcasse. Refermer le poing (`fermer_poing`) sur une poignée de 5,5 × 3,4
  cm au lieu d'un tube de ⌀ 4 demandera sans doute un nouveau réglage.
- **L'arme ne dépasse pas ~20 % de la largeur de l'écran.** Leçon d'Ion
  Fury : les premières armes « très grosses et trapues » cachaient trop
  l'écran.

### Contrôles à faire après construction

1. `renders/armes/pistolet.png` en aplat noir : le chien, le cran de hausse
   (≥ 3 px), les leviers et la marche canon / nez se voient dans la
   silhouette.
2. Sur le même rendu : bloc arrière ≥ 45 px, bout du canon à 70-95 px du
   réticule dans le quart bas-droit, rien à moins de 60 px.
3. En jeu, captures du parking de départ et de l'allée centrale (méthode de
   la section 1) : luminance médiane de la culasse ≥ 3 fois celle de la
   carcasse, culasse jamais sous `#28` ; en vignette, le pistolet se
   distingue du pompe par sa valeur.
4. Modèle au sol de profil : rapport hauteur / longueur entre 0,63 et 0,72,
   **aucun jour entre les pièces**.
5. Arme seule ≤ 500 triangles ; `bout_canon` recalé sur la nouvelle bouche.

## 5. Références

### Jeux (vue subjective)

- **Half-Life, Glock 17** — [IMFDB, Half-Life](https://www.imfdb.org/wiki/Half-Life),
  capture [Hl_glock_original.jpg](https://www.imfdb.org/images/6/6d/Hl_glock_original.jpg).
  La référence d'angle la plus proche de la nôtre : arme tenue haut, pointée
  droit devant, très raccourcie. On voit la face arrière de la culasse (cran
  de hausse en U), le dessus clair et le flanc strié. **Le dessus est la
  surface la plus claire, ses arêtes portent un liseré clair**, les flancs
  sont plus sombres, le gant orange fait contraste dessous. La page note
  aussi une fenêtre d'éjection modélisée un peu trop en avant, sans effet
  sur la lecture de l'arme dans la capture.
- **Duke Nukem 3D, « Pistol »** —
  [IMFDB, Duke Nukem 3D](https://www.imfdb.org/wiki/Duke_Nukem_3D), capture
  de rechargement [Duke3d_gun2.jpg](https://www.imfdb.org/images/thumb/7/7c/Duke3d_gun2.jpg/600px-Duke3d_gun2.jpg).
  Un Glock imaginaire, **bien plus massif que le vrai**, à culasse carrée aux
  grosses stries. Construit en 3D sans peinture, puis passé au noir et repris
  au pixel. Fenêtre d'éjection mise à GAUCHE pour le spectacle des douilles.
  Le [forum duke4.net](https://forums.duke4.net/topic/11347-duke-nukem-3d-duke-doesn%E2%80%99t-have-a-glock-17/)
  y voit un Hi-Point C9 lourdement retouché, pas un Glock. Le
  [wiki Duke](https://dukenukem.fandom.com/wiki/Pistol) le décrit gris
  foncé, proche d'un Glock 26. Apport : l'exagération de section est permise,
  et l'on triche sur le côté qui se voit. Non vu : l'image au repos.
- **Ion Fury, Loverboy** —
  [IMFDB, Ion Fury](https://www.imfdb.org/wiki/Ion_Fury), capture
  [IonFuryLoverBoy.jpg](https://www.imfdb.org/images/5/5a/IonFuryLoverBoy.jpg).
  Revolver vu presque de dos, canons très raccourcis vers le centre. La masse
  lisible est **l'arrière** : chien clair au centre, barillet dont le contour
  festonné crante la silhouette. Acier gris-bleu MOYEN, au moins quatre
  valeurs sur l'arme, plus clair que le gant sombre. Apport : la valeur de
  l'arme au-dessus de celle de la main.
- **Ion Fury, fabrication d'une arme** —
  [Yij Art, « Ion Fury development process »](https://yijart.artstation.com/projects/dO2rxx),
  récit de l'Uzi du jeu, avec la capture finale
  [yij-art-23.jpg](https://cdna.artstation.com/p/assets/images/images/025/772/608/medium/yij-art-23.jpg?1586878719).
  Cinq leçons :
  - la couleur s'essaie EN JEU (un dessus bleu, « horrible » une fois en jeu,
    remplacé par un gris métal plus clair et un seul accent rouge) ;
  - on retire ce qui ne se voit pas (le garde-main) ;
  - la version « très grosse et trapue » cachait trop l'écran ;
  - la caméra se règle dans Blender, en vue subjective ;
  - le rendu 3D brut est « plat » : chaque image est repeinte à la main,
    reflets et ombres compris.

  Sur la capture finale, les arêtes hautes portent toutes un liseré clair et
  un logo blanc sert d'accent. Nous ne pouvons pas repeindre (temps réel) :
  la valeur doit être peinte dans les couleurs de sommets (section 3.8).
- **Cultic, Mauser C96** — [IMFDB, Cultic](https://www.imfdb.org/wiki/Cultic),
  capture [20240831153908_1.jpg](https://www.imfdb.org/images/7/79/20240831153908_1.jpg).
  Le plus proche de notre technique : une vue subjective 3D temps réel,
  rendue en basse résolution avec palette et tramage. Acier clair sur les
  arêtes hautes, flancs sombres, contraste interne fort ; le bloc chien +
  hausse est le repère visuel. Apport : un modèle 3D basse définition se lit
  par ses arêtes claires.
- **« PS1 style handgun », bftd** —
  [Sketchfab](https://sketchfab.com/3d-models/ps1-style-handgun-2b8a333e1d8a4bf49efd330e50e9cfdb),
  CC BY 4.0. Compact à la Walther P99 en **473 triangles** : culasse
  gris-bleu plus CLAIRE que la carcasse noire, stries en texture (bandes
  claires et sombres, zéro relief), pontet ajouré en vraie géométrie,
  poignée inclinée d'environ 20°. Le précédent de budget et de répartition
  valeur / géométrie.

### Armes réelles

- **Glock 17** — [fiche constructeur](https://us.glock.com/en/products/law-enforcement/pistols/g17) :
  204 × 139 mm, culasse 186 × 25,5 mm, largeur 32 mm, canon 114 mm. Profil
  gauche mesuré au pixel sur [Glock17EarlyModel.jpg](https://www.imfdb.org/images/8/8c/Glock17EarlyModel.jpg)
  (IMFDB) :
  - 3,36 px/mm, contrôle 204 × 138 mm ;
  - flanc de culasse visible 20,5 mm, organes de visée 4,5 mm,
    cache-poussière 15,5 mm ;
  - bas du pontet 66 mm sous le dessus ;
  - dos de poignée ~24° (bosse de paume comprise), devant ~22° ;
  - la culasse déborde de 13 mm derrière le haut du dos ;
  - stries sur les 35 mm arrière.

  [Wikipédia](https://en.wikipedia.org/wiki/Glock) donne 109° entre la
  poignée et l'axe.
- **Beretta 92FS** — [Wikipédia](https://en.wikipedia.org/wiki/Beretta_92) :
  217 mm, canon 125 mm ; 137 × 38 mm (5,4 × 1,5 in). Profil droit du
  deux-tons [Beretta92FS_2ToneType01.jpg](https://www.imfdb.org/images/4/49/Beretta92FS_2ToneType01.jpg)
  (IMFDB, « Stainless Slide on a standard Frame »), mesuré à ~3,15 px/mm :
  - partie pleine de culasse ~81 mm, ouverture ~83 mm, nez ~17 mm ;
  - canon visible 7,6 mm au-dessus d'un flanc de 15 mm ; nez de 36 mm de
    haut ; canon qui dépasse de 8 mm ;
  - cache-poussière 17 mm ; bas du pontet 73 mm sous le dessus ;
  - dessus de culasse 40 mm au-dessus du creux de la main ;
  - poignée : devant ~11°, dos ~21°, soit ~16° en moyenne.

  Profil inox : [Inoxflipside.jpg](https://www.imfdb.org/images/e/ec/Inoxflipside.jpg).
  Filmographie : [IMFDB, Beretta 92](https://www.imfdb.org/wiki/Beretta_92)
  (*Die Hard*, *Lethal Weapon*, *The Killer*, *Hard Boiled*, *Nikita*,
  *Léon*, Half-Life HD, Max Payne).
- **PAMAS G1** — [Wikipédia (fr)](https://fr.wikipedia.org/wiki/PAMAS_G1) :
  Gendarmerie en 1989, armée de l'air en 1992, armée de terre et Marine en
  1999 ; MAS de Saint-Étienne ; 217 mm, canon 125 mm.
- **SIG P226** — [Wikipédia](https://en.wikipedia.org/wiki/SIG_Sauer_P226) :
  196 × 140 × 38,1 mm, canon 112 mm.
- **Walther PP / PPK** — [Wikipédia](https://en.wikipedia.org/wiki/Walther_PP) :
  PP 170 × 109 × 30 mm, PPK 100 mm de haut.
- **Angles de poignée** — [American Rifleman, « All In The Grip »](https://www.americanrifleman.org/content/all-in-the-grip-angles-contours-texturing-in-modern-handguns/)
  et la recherche associée : Glock 22°, 1911 et P226 18°.

### Articles et tutos : ce qu'on en retient

- [Nasty Rodent, « 3D Weapon Art for Games »](https://nastyrodent.com/3d-weapon-art-for-games/) —
  en vue subjective, la lisibilité de la silhouette sous l'angle de la
  caméra est LA contrainte ; la densité va aux organes de visée, à la zone
  de détente et à l'avant, le dessous de poignée peut rester pauvre. Une
  arme de vue subjective et une arme vue de loin sont deux objets distincts,
  d'où la section 3.2.
- [80.lv, « Weapon Art: Tips for Design, Texturing and Presentation »](https://80.lv/articles/weapon-art-tips-for-design-texturing-and-presentation) —
  une ou deux saillies de silhouette, pas partout (ici : le chien et les
  leviers) ; des plans d'orientations variées pour gagner du contraste de
  valeur, d'où les chanfreins ; hiérarchie 70-20-10 : une grosse zone
  d'intérêt, une moyenne, une petite.
- [Room8 Studio, « FPS Weapon Creation »](https://room8studio.com/news/fps-weapon-creation-how-to-match-aaa-standards/) —
  bloquer d'abord les grandes silhouettes et la façon dont les pièces
  s'emboîtent. C'est exactement le défaut 2 de l'existant.
- [Marmoset, « Presenting First Person View Weapons »](https://marmoset.co/posts/presenting-first-person-view-weapons-in-toolbag/) —
  présenter l'arme avec les mains, cadrée comme en jeu ; ne montrer que la
  partie de l'arme que le joueur voit.
- ResetEra, [position du pistolet à l'écran](https://www.resetera.com/threads/first-person-shooters-and-where-your-pistol-is-held-on-the-screen.1346569/)
  et [« cool gun, bad viewmodel »](https://www.resetera.com/threads/at-the-risk-of-turning-this-thread-into-gun-fetishism-first-person-shooters-have-a-cool-gun-bad-viewmodel-problem.1468174/) —
  Doom, Wolfenstein, Quake et Duke centrent l'arme ; décalée à droite, elle
  montre davantage d'elle-même et cache moins la scène. Une belle arme mal
  cadrée devient « une bouillie à peine identifiable ».
- Vidéos, **titres et descriptions seulement, non regardées** :
  - [« Low Poly PS1 Style FPS Gun in Blender Timelapse »](https://www.youtube.com/watch?v=zPbJuZCevMg) :
    un Walther P99 modélisé, texturé et animé ;
  - [« How to make low poly pistol for games »](https://www.youtube.com/watch?v=Z_EJhkHq8jk) ;
  - [« PS1 Style Graphics in Blender »](https://www.youtube.com/watch?v=5ycmDpYen-4) :
    peu de polygones, dépliage, textures basse résolution ;
  - [CG Cookie, « Modeling Weapons for a First Person Shooter »](https://cgcookie.com/courses/modeling-weapons-for-a-first-person-shooter) :
    un pistolet de A à Z. Page inaccessible au robot (403).

  Leur méthode commune (bloquer sur des vues de profil, puis tailler)
  recoupe les articles ci-dessus ; rien de plus n'en a été tiré.

### Ce qui ne se transfère pas (délibérément ignoré)

- **Le reflet de l'inox** : l'invariant #5 interdit le spéculaire. L'inox se
  lit par sa valeur claire et par les chanfreins, pas par un reflet.
- **La repeinte image par image** (Duke, Ion Fury) : c'est la source de la
  lisibilité de leurs armes, impossible en temps réel. Son équivalent ici est
  la valeur peinte dans les sommets.
- **Les marques, gravures et le médaillon** : invisibles à 640×360, et la
  règle du projet veut des marques inventées.
- **L'échelle réelle en vue subjective** : on triche (×1,25 et section ×1,2),
  comme les bras.
- **Le rechargement et le chargeur** : le jeu n'a pas de rechargement
  (réserve unique, voir [Armes du joueur](../systems/armes.md#pistolet-2026-09-16)).
  La semelle n'existe que pour le modèle au sol.

## 6. Ce qui n'a pas été vérifié

- **Aucun modèle n'a été construit** : les tailles à l'écran de la section 4
  sont des projections de gabarits (boîtes) avec le champ de vision et la
  prise du script, pas des rendus.
- **Les valeurs à l'écran de la palette sont des prédictions**, calculées à
  partir de rapports d'éclairage mesurés en deux points seulement (parking de
  départ, allée centrale).
- **La prise `(0.16, 0.30, −0.20)` n'a pas été soumise à l'IK** : le bras
  peut ne pas l'atteindre sans retouche.
- Les cotes de culasse du Beretta et du Glock sont mesurées au pixel sur UNE
  photo chacune, recalées sur les fiches constructeur (±1 mm). La largeur de
  culasse du Beretta (~28 mm) est une estimation.
- Les tutos vidéo n'ont pas été regardés ; l'image au repos du pistolet de
  Duke 3D, DUSK et Prodeus n'ont pas été vus (pages inaccessibles ou
  absentes).
