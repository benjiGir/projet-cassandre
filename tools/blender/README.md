# Outils Blender — PROJET_CASSANDRE

Scripts headless. Aucun ne nécessite d'interface.

## Commandes `cassandre` : le pipeline en un appel

`cassandre.py` enveloppe les scripts ci-dessous sans les réécrire, et rend
un dict JSON compact (verdicts, comptes, premières erreurs) au lieu d'un log.
Le log complet et les images vont dans `renders/_cassandre/` (gitignoré).

| Commande | Rôle |
|---|---|
| `status()` | fichier ouvert, session périmée face au disque, sources plus récentes que le `.blend`, `.glb` en retard |
| `build(out=…, detail=False)` | rejoue `build_niveau.py` ; copie de sécurité si la session est modifiée, car le build vide la scène |
| `check(strict=False, audit=True)` | `validate_level.py` + `audit_niveau.py`, verdicts seuls |
| `shot(vue, mode="solid"\|"material"\|"silhouette", nom=…, isoler=…)` | `"spawn"`, `"joueur"` (dernière `cassandre.pose()` du jeu), `(x, y, cap)` à hauteur d'yeux et FOV du jeu, `"dessus:<espace>"`, ou un nom d'objet ; `isoler` limite les meshes à un motif de nom ; ne laisse rien dans la scène ; une vue joueur rend aussi la commande `cassandre.tp(…)` qui montre la même chose en jeu |
| `budget(vue=… \| cellule_de=(x, y))` | lots de dessin du décor dans le champ (estimation, −12 % à +5 % mesurés), ou matériaux déjà présents dans une cellule de 48 m, qu'on peut réutiliser pour 0 lot |
| `sheet(vues, cols=2, taille=(400, 225))` | plusieurs vues en UNE image (un seul `Read`) ; `cells` dit quelle case est quelle vue |
| `export(out=…)` | `export_level.py`, `ok` seulement si le contenu est vérifié |
| `find(motif, pres=(x, y), rayon=3)` | objets par motif `fnmatch`, avec position et dimensions |
| `where(cible \| pres=(x, y[, z]), rayon=2)` | **quelle ligne a posé cet objet** : `site` (fichier:ligne fonction), `pile`, et pour une instance de la bibliothèque `patron_site` (où l'asset est défini) |
| `run(script, *args, keep=…)` | n'importe quel script du dépôt, `sys.exit` absorbé |
| `reload()` | oublie les modules de `tools/` après une modification d'un `lib_*.py` |
| `compose_public(preview=…)` | six compositions locales dans la galerie, la cafétéria et les rayons ; candidat isolé si `preview` est fourni, sinon source sauvegardée et exportée |
| `direction_covers()` | essai isolé de deux meubles bas dans le bureau du Directeur, vues avant/après et comparaison aux hauteurs de tir ; source et export livrés conservés |
| `orient_office_screens(preview=…)` | tourne écran et clavier vers le fauteuil des postes de bureau ; correction locale avec sauvegarde, ou candidat séparé si `preview` est fourni |
| `rework_checkouts(preview=…, inspect=False)` | remplace les anciens comptoirs par six travées numérotées ; déplace les éléments qui gênent les files, sauvegarde et exporte ; `preview` produit un candidat isolé et `inspect=True` décrit les objets existants |

| `rework_backstage(preview=…, inspect=False)` | migration locale vers réserve → personnel → parking / carte Or → bureaux ; candidat Blender et GLB isolés avec `preview`, sauvegarde et export sinon ; refuse une seconde migration de la même source |
| `story_triggers(preview=…)` | pose les neuf `trig_*` du script de niveau (ADR 0037) dans la collection LOGIC ; rejouable, aperçu isolé avec `preview`, sauvegarde et export sinon |
| `perk_kiosks(preview=…)` | pose les six bornes de perks (`use_borne_*` portant `perk` et `prix`), une par perk, sur du mobilier en place ; les prix sont ceux de la variante B du lot B7 (`pnpm economy`) ; rejouable, aperçu isolé avec `preview`, sauvegarde et export sinon |
| `gas_props(preview=…)` | pose les quinze bonbonnes de gaz explosives (`prop_gaz_*`, matière `gaz`) près des points d'apparition du chemin obligé ; rejouable, aperçu isolé avec `preview`, sauvegarde et export sinon |
| `encounters(preview=…)` | pose les rencontres du lot B6 : rideau `door_reserve_nord` (ouvert au chargement), spawns à `groupe` de l'arène, de la meute du parking et du Vigile, et leurs trois `trig_*` ; retire quatre Costards du parking ; rejouable, aperçu isolé avec `preview`, sauvegarde et export sinon |
| `repair_backstage(preview=…)` | rétablit les murs et néons du sas Argent, pose deux rideaux manuels au compacteur et raccorde les panneaux aux passages ; aperçu isolé avec `preview`, sauvegarde et export sinon |

`where` lit le relevé écrit par le dernier `build()` dans
`renders/_cassandre/provenance_<blend>.json`. Le relevé est fait par
`provenance.py` (`sys.monitoring` sur `CollectionObjects.link`), sans rien
écrire sur les objets, puisque les propriétés personnalisées partent dans le
`.glb`, et sans que les scripts du pipeline aient à coopérer. Angle mort : un
objet créé par un opérateur `bpy.ops`.

**Pont jeu ↔ Blender.** Dans la console du jeu (serveur de dev) :
`cassandre.pose()` rend la pose en coordonnées Blender et la dépose dans
`renders/_cassandre/pose.json` (plugin de `vite.config.ts`), que relit
`C.shot("joueur")` / `C.budget(vue="joueur")`. `cassandre.tp(x, y, z, cap)`
fait l'inverse : il place le joueur au point vu dans Blender. Le budget exact
reste `cassandre.renderBench(3).drawCalls` en jeu, ennemis compris.

Pour trouver une fonction sans ouvrir une bibliothèque de 1 000 lignes, sans
Blender : `python3 tools/blender/api_index.py [module | --grep motif] [--all]`.

Trois façons de les appeler, pour que la recette n'existe qu'une fois :

```bash
# Headless, sous-agents compris : une ligne `[cassandre] {...}` en sortie
blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- check
blender -b assets_src/blender/niveau_v2.blend -P tools/blender/cassandre_cli.py -- shot 'vue=[0,-20,180]'
blender -b --factory-startup -P tools/blender/cassandre_cli.py -- build
```

- Depuis le MCP Blender : `import cassandre as C; result = C.check()`.
- Depuis la vue 3D : panneau N › Cassandre.

Ces deux derniers usages demandent l'extension `extension/cassandre/`,
installée comme **dépôt local** (Préférences › Get Extensions › Repositories
› Add Local Repository → `tools/blender/extension/`, puis activer
« Cassandre »). Blender lit ce dossier en place, il n'y a rien à zipper.

| Script | Usage |
|---|---|
| `kit_spec.py` | **données** du kit modulaire (pièces, dimensions, proxies) — pas exécutable seul |
| `level_spec.py` | **données** des niveaux Zone A / Zone B / Zone C / Zone D / Zone E (murs, sol, spawns, vitrine, caisses, gondoles, racks, mezzanine, portes, secrets) — pas exécutable seul |
| `geo_utils.py` | fonctions bpy partagées (boîtes subdivisées, proxies, scène) — importé par `build_kit.py` ET `build_level.py`, pas exécutable seul |
| `build_kit.py` | génère `kit_hypermarche.blend` à partir de `kit_spec.py` |
| `build_level.py` | assemble un niveau (`zone_a_parking.blend` / `zone_b_caisses.blend` / ... / `zone_e_bureau.blend`) à partir du kit + `level_spec.py` |
| `build_combined_level.py` | fusionne les 5 zones en UN SEUL niveau connecté (`hypermarche_complet.blend`) — copies traduites de `ZONE_A`..`ZONE_E`, jamais les originaux ; voir « Niveau complet » ci-dessous |
| `inspect_kit.py` | vérifie le kit produit contre le contrat du projet |
| `bake_vertex_lighting.py` | bake d'éclairage en vertex colors + rapport de plausibilité |
| `validate_level.py` | vérifie un `.blend` de niveau contre le contrat du projet |
| `../level_v2/audit_niveau.py` | cherche ce qui ne se voit qu'en jouant : trous de sol, bords ouverts sur le vide, décor encastré |
| `export_level.py` | exporte en `.glb` avec les bons réglages (validation en étape séparée, voir la chaîne ci-dessous) |
| `lib_helpers.py` | **briques** de la bibliothèque v2 (matériaux texturés, boîtes multi-parties à UV 64 px/m, trims, étiquettes, proxies, subdivision) — pas exécutable seul |
| `lib_rayons.py` | **bibliothèque d'assets** du niveau v2 : gondoles, têtes de gondole, bacs, frigos, caddies, signalétique, produits, et le générateur de garnissage — pas exécutable seul |
| `lib_checkouts.py` | six caisses en L, tapis, terminaux, présentoirs et proxies ; même recette pour le build complet et la mise à jour locale |
| `refresh_checkouts.py` | recette locale appelée par `rework_checkouts`, copie de sécurité et captures avant sauvegarde ; exclut `_LIB` du fichier livré |
| `../textures/generate_checkout_signs.py` | génère l'atlas 128×128 `sig_caisses.png` et ses coordonnées ; utilise Pillow et la police pixel existante |
| `build_library.py` | construit les assets de `lib_rayons.py` dans `lib_hypermarche_v2.blend` et les range dans l'Asset Browser |
| `build_salle_essai.py` | assemble la salle d'essai « rayons » du jalon N4 (`salle_essai_rayons.blend`) |
| `render_preview.py` | quatre vues de contrôle d'un niveau (dessus, silhouette, première personne, trois-quarts) |
| `render_ingame.py` | rendu **tel que le jeu l'affichera** — champ de vision et colorimétrie du jeu, texture × couleur cuite |
| `render_enemy_sprites.py` | atlas 8 directions + manifeste des ennemis (`public/assets/sprites/`), rendus depuis le « Man in Suit » CC0 |
| `build_weapons.py` | pied-de-biche et pompe en vue subjective, tenus par les bras du « Man in Long Sleeves » CC0 (`public/assets/weapons/armes.glb`) |

```bash
# Bibliothèque d'assets du niveau v2 + salle d'essai « rayons » (jalon N4)
blender -b assets_src/library/lib_hypermarche_v2.blend -P tools/blender/build_library.py -- --save
blender -b --factory-startup -P tools/blender/build_salle_essai.py -- --out assets_src/blender/salle_essai_rayons.blend
blender -b assets_src/blender/salle_essai_rayons.blend -P tools/blender/bake_vertex_lighting.py -- --type diffuse --pass indirect --samples 128 --ambient 0.5 --domain corner --bounces 3 --save
blender -b assets_src/blender/salle_essai_rayons.blend -P tools/blender/validate_level.py -- --strict
blender -b assets_src/blender/salle_essai_rayons.blend -P tools/blender/export_level.py -- --out public/assets/levels/salle_essai_rayons.glb
blender -b assets_src/blender/salle_essai_rayons.blend -P tools/blender/render_ingame.py -- --out renders/salle_essai_rayons --view 5.75,1.25,0 --view 2.4,10,-80
```

Six options du bake sont nées de cette salle : `--type diffuse` (obligatoire
dès qu'il y a des textures), `--domain corner` (une couleur par face, sans quoi
aucune arête ne se détache), `--bounces` (une salle blanche renvoie tant de
lumière qu'elle efface ses ombres), `--pass indirect` (montage hybride,
ADR 0024), `--ambient` (plancher d'éclairage) et `--emissive-marker` (une
source ne s'éclaire pas elle-même). Leur raison d'être est dans
[docs/5-guides/modifier-le-niveau.md](../../docs/5-guides/modifier-le-niveau.md#bake-déclairage-vertex-colors).

```bash
# Sprites des ennemis (ADR 0028) — ~10 s par personnage
blender -b --factory-startup -P tools/blender/render_enemy_sprites.py -- --personnage costard
blender -b --factory-startup -P tools/blender/render_enemy_sprites.py -- --personnage directeur
# Itération rapide : quelques animations et directions, écrit <personnage>_apercu.png
blender -b --factory-startup -P tools/blender/render_enemy_sprites.py -- --personnage costard --anims aim,fire --directions 0,2 --out renders/sprites
```

Pièges payés en écrivant ce script, tous silencieux :

- **Remettre le rig au repos avant chaque pose.** Les actions du modèle
  n'animent pas les mêmes os (`Man_Idle` : 15 canaux, `Man_Run` : 22) : un os
  absent de la nouvelle action garde la pose précédente, et un pied de course
  traîne sous la visée.
- **Accrocher toutes les pièces (pistolet, lunettes, crête) avant le premier
  rendu.** Accrochée après, une pièce hérite de la dernière pose rendue — le
  corps allongé de la mort — et flotte à côté du crâne.
- **Désélectionner avant `object.join`.** L'import glTF laisse tout le
  personnage sélectionné, et `join` avale le mesh skinné dans le pistolet.
- **Le matériau `Eyes` habille aussi la ceinture et les boutons.** Placer les
  lunettes sur son centre les posait à la taille : seuls comptent les sommets
  au-dessus de la base du crâne.
- **La veste a un jour au milieu du ventre.** Un rayon tiré de face à x = 0 la
  traverse et touche le DOS du costume (y > 0) ; une cravate calée dessus part
  en biais. Seuls les impacts sur la moitié avant du corps comptent, et la
  cravate est verticale.
- **Coupé : le reflet spéculaire de Workbench.** Sur une face tournée vers la
  caméra, il grise un noir — les lunettes disparaissaient de face.

Pour juger la lisibilité sans lancer le jeu, réduire une case à la taille
qu'elle occupe à l'écran : `360 / (2 d tan 37,5°)` pixels par mètre à `d`
mètres, soit ~38 px de haut pour un Costard à 11 m.

Côté modèle : `TieTexture` est le plastron de chemise, pas la cravate (d'où la
cravate construite par script), et le `.glb` traîne une `Icosphere` hors du rig.

```bash
# Armes du joueur (ADR 0029) — écrit aussi renders/armes/{pied_de_biche,pompe}.png, vues depuis l'œil au FOV du jeu
blender -b --factory-startup -P tools/blender/build_weapons.py
# --debug ajoute des vues orthographiques de côté et de dessus, pour voir où tombent les mains
blender -b --factory-startup -P tools/blender/build_weapons.py -- --debug
```

La place de l'arme à l'écran se règle en tête du script (`PRISE_*`, `AXE_*`,
repère de l'œil), jamais en TypeScript. Le script imprime, pour chaque bras, la
distance épaule-cible et l'écart du poignet à sa cible : au-delà de quelques
millimètres, le bras est trop court pour la prise demandée.

Pièges payés, tous silencieux :

- **L'IK écrase la rotation de la main.** Dans une même pile, le solveur IK
  réoriente la paume, qui fait partie de sa chaîne : on résout l'IK, on fige la
  pose obtenue, on coupe l'IK, PUIS on applique la rotation de main.
- **L'angle de pôle dépend du roulis des os** : le script essaie les angles de
  15 en 15° et garde celui qui pose le coude au plus près de sa cible.
- **Les doigts se ferment par une rotation NÉGATIVE** autour de l'axe X de l'os
  (vers la paume), pour les deux mains ; positive, la main s'ouvre à l'envers.
- **Retirer l'action d'animation** après la pose de départ, sinon une
  réévaluation écrase les poses figées.
- **Jamais d'extra `pivot`** : `GLTFLoader` le réserve (voir docs/4-technique/rendu.md).
- **Un bras de 1,80 m n'atteint pas le fût** : les bras sont au gabarit 2,20 m.

### Pistolet — refonte 2026-09-25

`construire_pistolet` a été entièrement réécrite d'après
[`docs/journal/playtests-2026-09.md`](../../docs/journal/playtests-2026-09.md) (board
de références, cotes, priorités de silhouette) : un Beretta 92FS deux tons
plutôt que le pavé « sèche-cheveux » d'origine (1,01 de rapport hauteur/
longueur, poignée-tube de 12 cm, aucune pièce en contact). Le nouveau modèle
tient dans **350-420 triangles** (mesuré : 360 pour `world_pistol`, plafond
dur 500) — culasse à profil hexagonal chanfreiné (biseaux 3 mm), dessus
ouvert avec le canon visible entre deux rails clairs, hausse à cran, guidon,
chien armé, deux leviers de sûreté, pontet AJOURÉ (un vrai trou, trois
barres), poignée inclinée à 18°, et 5 bandes de stries peintes par découpe de
face sur les flancs (aucun relief, donc aucun z-fighting).

`construire_pistolet(vue_subjective: bool)` applique, uniquement en vue
subjective, les trois exagérations de la planche (section 3.2), injectées
directement dans les formules de coordonnées plutôt qu'en post-transform :
section de culasse ×1,2 autour de l'axe du canon, chien ×1,3, points de
visée ×2. Le modèle au sol (`vue_subjective=False`) garde ses vraies cotes.

Deux constantes ont bougé en tête de fichier : `PRISE_PISTOLET` recule et
descend à `(0.16, 0.30, -0.20)` (la culasse, plus basse sur ce modèle,
demandait de reculer la prise pour garder le bout du canon au même endroit à
l'écran), et `BOUT_CANON_PISTOLET = (0, 0.141, 0.077)` (nouveau, lu à la fois
par la construction du canon et par le calcul de l'extra `bout_canon` — un
seul endroit à changer si la cote bouge). Le pied-de-biche et la pompe sont
inchangés : `construire_pied_de_biche`/`construire_pompe` n'ont pas été
touchées, et un export avant/après (comptes de sommets et triangles) confirme
des `vm_crowbar`/`vm_shotgun`/`vm_shotgun_pump`/`world_crowbar`/
`world_shotgun` identiques bit à bit en topologie.

**Non implémenté, par choix de budget** : le quadrillage des plaquettes de
poignée (section 3.8 de la planche, explicitement « au sol seulement », la
plus basse priorité de tout le document) et la bande de jointure culasse/
carcasse + la fausse occlusion peinte (mêmes raisons — un ajout de ~80-160
triangles pour un gain de lecture marginal à 640×360, alors que les dix
éléments de silhouette prioritaires tenaient déjà dans le budget cible).

```bash
# Kit modulaire
blender -b --factory-startup -P tools/blender/build_kit.py -- --out assets_src/blender/kit_hypermarche.blend
blender -b assets_src/blender/kit_hypermarche.blend -P tools/blender/inspect_kit.py
blender -b assets_src/blender/kit_hypermarche.blend -P tools/blender/bake_vertex_lighting.py -- --save

# Assemblage d'un niveau à partir du kit (appende les pièces, tile murs/sol,
# construit la vitrine sur-mesure de la Zone A, pose spawns/interactifs/éclairage)
blender -b --factory-startup -P tools/blender/build_level.py -- --zone a --kit assets_src/blender/kit_hypermarche.blend --out assets_src/blender/zone_a_parking.blend
blender -b --factory-startup -P tools/blender/build_level.py -- --zone b --kit assets_src/blender/kit_hypermarche.blend --out assets_src/blender/zone_b_caisses.blend

# Bake -> validation -> export, un niveau à la fois
blender -b assets_src/blender/zone_a_parking.blend -P tools/blender/bake_vertex_lighting.py -- --save
blender -b assets_src/blender/zone_a_parking.blend -P tools/blender/validate_level.py   # PAS --strict, voir note
blender -b assets_src/blender/zone_a_parking.blend -P tools/blender/export_level.py -- --out public/assets/levels/zone_a_parking.glb

blender -b assets_src/blender/zone_b_caisses.blend -P tools/blender/bake_vertex_lighting.py -- --save
blender -b assets_src/blender/zone_b_caisses.blend -P tools/blender/validate_level.py -- --strict
blender -b assets_src/blender/zone_b_caisses.blend -P tools/blender/export_level.py -- --out public/assets/levels/zone_b_caisses.glb

blender -b --factory-startup -P tools/blender/build_level.py -- --zone c --kit assets_src/blender/kit_hypermarche.blend --out assets_src/blender/zone_c_rayons.blend
blender -b assets_src/blender/zone_c_rayons.blend -P tools/blender/bake_vertex_lighting.py -- --save
blender -b assets_src/blender/zone_c_rayons.blend -P tools/blender/validate_level.py -- --strict
blender -b assets_src/blender/zone_c_rayons.blend -P tools/blender/export_level.py -- --out public/assets/levels/zone_c_rayons.glb

blender -b --factory-startup -P tools/blender/build_level.py -- --zone d --kit assets_src/blender/kit_hypermarche.blend --out assets_src/blender/zone_d_reserve.blend
blender -b assets_src/blender/zone_d_reserve.blend -P tools/blender/bake_vertex_lighting.py -- --save
blender -b assets_src/blender/zone_d_reserve.blend -P tools/blender/validate_level.py   # PAS --strict, voir note (palettes empilées)
blender -b assets_src/blender/zone_d_reserve.blend -P tools/blender/export_level.py -- --out public/assets/levels/zone_d_reserve.glb

blender -b --factory-startup -P tools/blender/build_level.py -- --zone e --kit assets_src/blender/kit_hypermarche.blend --out assets_src/blender/zone_e_bureau.blend
blender -b assets_src/blender/zone_e_bureau.blend -P tools/blender/bake_vertex_lighting.py -- --save
blender -b assets_src/blender/zone_e_bureau.blend -P tools/blender/validate_level.py -- --strict
blender -b assets_src/blender/zone_e_bureau.blend -P tools/blender/export_level.py -- --out public/assets/levels/zone_e_bureau.glb

# Niveau complet (fusion des 5 zones, voir "Niveau complet (hypermarche_complet)" ci-dessous)
blender -b --factory-startup -P tools/blender/build_combined_level.py -- --kit assets_src/blender/kit_hypermarche.blend --out assets_src/blender/hypermarche_complet.blend
blender -b assets_src/blender/hypermarche_complet.blend -P tools/blender/bake_vertex_lighting.py -- --save
blender -b assets_src/blender/hypermarche_complet.blend -P tools/blender/validate_level.py   # PAS --strict, voir note (palettes + crowbar + shotgun)
blender -b assets_src/blender/hypermarche_complet.blend -P tools/blender/export_level.py -- --out public/assets/levels/hypermarche_complet.glb
```

`--strict` fait échouer sur les warnings. À utiliser en CI, pas en itération.
**Exception connue et documentée** : `zone_a_parking.blend` sort `ECHEC` sous
`--strict` avec exactement 2 warnings, tous deux voulus — `use_crowbar` hors
grille 0.25 m (Z=0.15, convention du prop reprise du prototype remplacé) et
sans custom property `target` (pickup autoportant, pas une porte à cibler,
voir CLAUDE.md/`interactive.ts`). Sans `--strict`, `VERDICT : CONFORME
(0 erreurs, 2 warnings)` — c'est le critère réel (« 0 erreur »), pas 0 warning.

Le `.blend` du kit est un **artefact reproductible**, pas un fichier qu'on édite
à la main : toute modification du kit passe par `kit_spec.py`, puis
`build_kit.py`, puis re-bake. Même règle pour un niveau : toute modification
de plan passe par `level_spec.py`, puis `build_level.py`, puis re-bake.

## Exporter : toujours par le script, jamais par l'interface

`export_level.py` ne se contente pas d'appeler l'exporteur glTF : il pose
`use_visible=True`, ce qui est la SEULE chose qui garde les collections sources
(`_KIT`, `_LIB`) hors du fichier livré.

Un `File > Export > glTF 2.0` depuis l'interface de Blender n'a pas cette case
cochée par défaut. Le 2026-09-18, un `.glb` livré au jeu contenait ainsi toute
la bibliothèque : **1 153 nœuds de trop, 47 Mo au lieu de 29**, et tous les
patrons d'assets empilés à l'origine du monde. Le `.blend`, lui, était sain.

Ce qui rend ce défaut coûteux, c'est qu'il **ne lève rien** : le niveau se
charge, se joue, et on cherche le bug ailleurs. `export_level.py` vérifie donc
désormais le fichier qu'il vient d'écrire — tout nœud hors du view layer, ou
appartenant à `_KIT`/`_LIB`, fait échouer l'export avec le compte exact.

```bash
blender -b assets_src/blender/niveau_v2.blend -P tools/blender/export_level.py -- --out public/assets/levels/niveau_v2.glb
# [export] contenu vérifié : 2488 objets du view layer, aucun intrus, aucune fuite de _KIT/_LIB
```

Si cette ligne n'apparaît pas, le `.glb` n'est pas fiable.

## Audit d'un niveau construit (`tools/level_v2/audit_niveau.py`)

```bash
blender -b assets_src/blender/niveau_v2.blend -P tools/level_v2/audit_niveau.py
blender -b assets_src/blender/niveau_v2.blend -P tools/level_v2/audit_niveau.py -- --pas 0.25 --csv audit.csv
```

`validate_level.py` vérifie le CONTRAT (noms, grille, budgets). L'audit
vérifie ce qu'on ne découvre sinon qu'en jouant, et que la construction
headless produit en silence — il est né du premier playtest complet du niveau
v2 (2026-09-16 : « trop d'éléments pas à leur place, en collision, des trous
qui nous font tomber dans le vide ») :

| Contrôle | Ce qu'il trouve |
|---|---|
| Trous de sol | une case praticable sans rien dessous — le joueur tombe |
| Bords ouverts sur le vide | on sort d'un espace par le côté, et il n'y a rien : c'est là que sont les vraies chutes, pas dans le sol |
| Interpénétrations | deux proxies de collision qui se traversent de plus de 12 cm |
| Objets flottants ou enfoncés | une base de proxy loin du sol sous elle |

L'audit regarde aussi les **`prop_*`**, qui n'ont pourtant aucun `col_*` : ils
portent leur collider dynamique, construit à l'import depuis leur boîte
englobante. Ils sont même le cas le plus urgent des trois derniers contrôles —
un décor statique encastré fait juste moche, un prop encastré est violemment
éjecté au premier pas de simulation. C'est exactement ce qu'il a trouvé à la
première passe : un carton posé dans le collider d'un caddie placé au hasard.

Trois pièges appris en l'écrivant, qui valent pour tout outil de ce genre :

- **Ne regarder que les `col_*` réellement posés.** La bibliothèque `_LIB`
  vit à l'origine, tous ses assets empilés : la compter donnait
  15 000 interpénétrations qui n'existent pas.
- **Partir de haut et chercher une face orientée vers le HAUT.** Un rayon
  tiré à hauteur de genou commence à l'intérieur du premier canapé venu, n'en
  voit que le dessous, et signale un trou là où l'on marche très bien.
- **Un `col_hull_*` n'est pas sa boîte englobante.** Une rampe remplit sa
  boîte à moitié : comparer des boîtes y invente des collisions.

## Ce que la validation contrôle

Unités et échelle · transforms appliqués · alignement sur la grille 0.25 m ·
contrat de nommage · unicité de `spawn_player` · triggers en box · custom
properties des interactifs et des secrets · type de collider (cuboid / hull /
trimesh) et sa proportion · triangles fins qui déstabilisent Rapier · épaisseur
minimale des proxies · couverture du rendu par les proxies · taille des textures ·
présence des vertex colors · subdivision suffisante pour le bake · budget de
triangles · nombre de matériaux.

## Version de Blender

L'API `bpy` casse entre versions majeures. Version utilisée et vérifiée ici :

```
Blender : 5.1.2   (hash ec6e62d40fa9, build 2026-05-19)
```

Deux dépréciations sont déjà annoncées pour Blender 6.0 et apparaissent en
`DeprecationWarning` à l'exécution, sans conséquence aujourd'hui :
`Material.use_nodes` et `World.use_nodes`.

## Historique

Ce que chaque script a produit, jalon par jalon (kit, Zones A à E, niveau
complet, secrets, sanitaires) et les pièges rencontrés en route — comptes,
noms exacts, décisions — est dans
[docs/archive/blender-statut-par-jalon.md](../../docs/archive/blender-statut-par-jalon.md).
À ouvrir pour comprendre POURQUOI un script est fait comme il est, pas pour
savoir comment s'en servir.
