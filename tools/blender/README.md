# Outils Blender — PROJET_CASSANDRE

Scripts headless. Aucun ne nécessite d'interface.

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
| `export_level.py` | exporte en `.glb` avec les bons réglages (validation en étape séparée, voir la chaîne ci-dessous) |

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

## Statut

### Kit modulaire

**Les scripts tournent réellement.** `kit_hypermarche.blend` existe : 25 pièces,
3226 sommets, 2460 triangles, 6 matériaux, 24 proxies cuboid + 1 convexHull,
5 lampes de bake. `inspect_kit.py` sort `VERDICT : CONFORME (0 erreurs,
0 warnings)`, `bake_vertex_lighting.py` sort un bake exploitable sur **25
pièces sur 25** (voir ci-dessous, `kit_crate` corrigé).

**`kit_crate` corrigé (2026-08-21, option A actée) :** la pièce ressortait
entièrement noire au bake — pas un problème d'éclairage mais un défaut de la
pièce elle-même, ses quatre tasseaux d'angle étant enfermés dans un cube plein
avec 16 paires de faces exactement coplanaires (z-fighting, auto-occultation
au bake). Corrigé en SUPPRIMANT les tasseaux (`kit_spec._crate_parts`) plutôt
qu'en les décollant : l'empreinte 1×1 reste exacte au proxy cuboid, le bake est
propre par construction (plus aucune face coïncidente). `kit_crate` fait
maintenant 24 sommets / 12 triangles (un simple cube) au lieu de 120/60.

### Niveaux Zone A (Parking) et Zone B (Caisses)

**Reconstruits avec le vrai kit modulaire (2026-08-21-22)**, remplaçant les
prototypes en boîtes brutes (un seul mesh "Cube" partagé via scale, non
subdivisé, sans vertex colors). `build_level.py` tile murs et sol à partir de
runs déclarés dans `level_spec.py` (plus grand module qui tient — 4 m ici,
tout se divise exactement, aucun reste), construit la vitrine sur-mesure de la
Zone A (deux boîtes pleines, même rigueur que le kit : subdivision au mètre,
UV 64 px/m, proxy cuboid, transforms appliqués), pose les caisses de la Zone B
(`kit_checkout` ×4), les spawns/`use_crowbar`, et un rig d'éclairage de secteur
(area lights au plafond tous les 6.67–8 m, ambiante basse, sun optionnel pour
la Zone A).

Les deux `.blend` (`assets_src/blender/zone_a_parking.blend` /
`zone_b_caisses.blend`) passent `validate_level.py` à 0 erreur (Zone B passe
même `--strict` à 0 warning ; Zone A a 2 warnings **attendus et documentés** :
`use_crowbar` hors grille 0.25 m à Z=0.15 et sans `target`, comportement voulu
— voir CLAUDE.md). Bake `bake_vertex_lighting.py` : 0 mesh noir, 0 dégradé
plat, sur les deux niveaux (calibré à `--light-energy 180`, le rig par défaut
900 W du kit sature en clipping sur une pièce de cette taille — voir
`build_level.py::build_lighting`). Export `.glb` vérifié en le rechargeant tel
quel dans Blender (comptes d'objets, `COLOR_0` non vide) ET dans le jeu réel
(`pnpm build` + `pnpm dev`, console : `[level] "zone_a_parking.glb" chargé —
colliders 56, spawns Costard 1, ..., use 1`, `[level] "zone_b_caisses.glb"
chargé — colliders 64, spawns Costard 3, ..., use 0` — comptes runtime
inchangés par rapport au contrat documenté dans CLAUDE.md).

`spawn_suit_2` de la Zone B est maintenant à 18 m du spawn (était 15 m dans le
prototype, signalé par `entity-designer` comme sous `attackRange`=16 m dès le
départ) — décision déjà actée dans la tâche, appliquée ici.

### Piège Blender 5.1.2 découvert en exportant un vrai niveau (pas seulement le kit)

**`export_scene.gltf(export_colors=...)` n'existe plus.** L'exporteur glTF de
Blender 5.x a remplacé ce booléen par un ENUM `export_vertex_color`
(`MATERIAL` / `ACTIVE` / `NAME` / `NONE`, défaut `MATERIAL`). `MATERIAL`
n'exporte les vertex colors QUE si le graphe de matériau les référence
explicitement via un nœud Color Attribute — ce n'est jamais le cas des
matériaux du kit (Principled BSDF nu, couleur posée en dur). `export_level.py`
n'avait jamais tourné en Blender réel avant l'assemblage de la Zone A/B ; le
premier run a immédiatement révélé et corrigé ce piège (`export_vertex_color
="ACTIVE"` : exporte l'attribut de couleur actif du mesh, peu importe le
matériau). Sans ce fix, les niveaux auraient chargé sans erreur mais seraient
sortis **sans aucun éclairage de secteur**, silencieusement.

### Le piège instancing-vs-bake (nouveau, propre à l'assemblage de niveau)

`modular-kit-design` recommande de partager un mesh-datablock entre toutes
les instances d'une pièce. Correct pour la bibliothèque du kit ; FAUX pour un
niveau assemblé : les couleurs de sommet vivent sur le mesh-datablock, pas sur
l'objet. Vingt-quatre murs partageant un seul mesh ne pourraient recevoir
qu'UN SEUL bake, valide pour un seul d'entre eux. `build_level.py::
place_kit_piece` fait donc un `mesh.copy()` par instance RENDUE (chacune bake
sa propre exposition), et garde les proxies `col_*` partagés (jamais bakés,
jamais rendus — partager leur mesh est correct et moins coûteux).

### Pièges vérifiés sur ce projet, à ne pas réintroduire

**Un proxy `col_*` n'est pas seulement une non-cible du bake, c'est un
OCCULTANT.** Il est par construction coïncident avec la géométrie qu'il double :
laissé visible aux rayons, il scelle la pièce et le bake sort noir, sans que
l'opérateur signale quoi que ce soit — il retourne `FINISHED`.
`bake_vertex_lighting.py` masque donc `col_*`/`trig_*`/`secret_*` du rendu le
temps du bake et restaure l'état dans un `finally`. Mesuré : sans ce masquage,
19 des 25 pièces du kit sortent noires. `--keep-proxies` reproduit la mesure.

**`obj.matrix_world` n'est pas réévalué tant que le depsgraph n'a pas tourné.**
`build_kit.py` posait les proxies avec
`proxy.matrix_parent_inverse = obj.matrix_world.inverted()` juste après avoir
écrit `obj.location` : l'inverse valait l'identité, l'offset était appliqué deux
fois et le proxy partait à `2 × location`, sur une autre pièce du kit. Un proxy
enfant dont le mesh est déjà en coordonnées locales doit simplement rester à
l'origine de son parent. `build_level.py` évite complètement cette classe de
bug : les proxies de niveau ne sont PAS parentés (loader.ts ne lit que
`matrixWorld`, jamais la hiérarchie Blender), ils sont posés directement au
même endroit que le rendu qu'ils doublent.

**Un vérificateur qui compense un bug le rend invisible.** `inspect_kit.py`
comparait les proxies au rendu via `c.location - obj.location`, ce qui annulait
exactement le double-transform ci-dessus et affichait `0 warnings` sur un kit
dont 24 proxies sur 25 étaient à la mauvaise place. La comparaison passe
maintenant par `matrix_local`, qui est la vraie position du proxy dans le repère
de la pièce.

**Une validation qui vérifie la mauvaise custom property ne détecte rien.**
`validate_level.py` avertissait sur l'absence de `use_target`, alors que
`loader.ts::buildUseObject` lit `extras.target` (custom property Blender
`target`). Corrigé — le check n'a de valeur que s'il regarde la même clé que
le runtime.

### Niveau Zone C (Rayons)

**Construit avec le vrai kit modulaire (2026-08-22)**, sur le même schéma que
Zone A/B — `level_spec.py::ZONE_C` transcrit littéralement le plan fourni
(aucune décision de layout prise ici), `build_level.py` l'exécute
mécaniquement. Nouvelle fonction `build_gondolas` (sur le modèle de
`build_checkouts`) : tile `kit_gondola_4m` le long de chaque rangée et
accole un `kit_gondola_end` à chaque extrémité.

**Comptes obtenus** (`BUILD LEVEL — zone_c_rayons`) :

| Élément | Compte |
|---|---|
| Tuiles de sol (24 × 28 m / 4 m) | 42 |
| Murs (`kit_wall_4m` uniquement — 24/24/28/28 m, tous multiples de 4 m, 0 reste) | 26 |
| Gondoles + capuchons (3 rangées × (2 `kit_gondola_4m` + 2 `kit_gondola_end`)) | 12 |
| Spawns (1 joueur + 4 Costards) | 5 |
| Objets `use_*` | 0 |
| Lampes de secteur (grille 3 × 4, espacement ~8.00 × 7.00 m) | 12 (pas de sun) |

Bake (`bake_vertex_lighting.py --save`) : **0 mesh noir, 0 dégradé plat** sur
80 meshes, luminance moyenne globale 0.204. 16 sommets écrêtés sur les
gondoles de la rangée centrale (proches des lampes de plafond, `--light-energy`
par défaut 180 W comme A/B) — cosmétique, sans conséquence sur le verdict.

`validate_level.py -- --strict` : **`VERDICT : CONFORME (0 erreurs,
0 warnings)`** — contrairement à la Zone A, aucune exception n'a été
nécessaire ici (voir piège grille ci-dessous, résolu en amont plutôt que
documenté comme dérogation). 177 objets (160 meshes), 10648 triangles,
2 matériaux, colliders `cuboid:80`.

Export (`export_level.py`) : `public/assets/levels/zone_c_rayons.glb`,
465 Ko. Rechargé dans Blender (`import_scene.gltf`) pour vérification
indépendante du fichier produit : 165 objets (`col_*`:80, `kit_floor_4x4`
rendu:42, `kit_wall_4m` rendu:26, `kit_gondola_*` rendu:12, `spawn_player`:1,
`spawn_suit_*`:4 — comptes identiques au `.blend` source), `COLOR_0`
(attribut `Color`, domaine `CORNER`) non vide sur un mesh de rendu
échantillonné, positions des 5 spawns et bounding box d'un collider de
gondole revérifiées bit à bit contre `level_spec.ZONE_C`.

**Piège de grille rencontré et résolu (nouveau, propre à Zone C — pas dans
A/B) :** le plan donné centre chaque rangée de gondoles sur X (-4.25 / 0.0 /
4.25, espacement centre-à-centre 4.25 m). Mais l'origine d'une pièce de kit
est un COIN, jamais un centre (`kit_spec.py`) : centrer une pièce profonde de
1.25 m sur ces coordonnées demanderait un décalage de 0.625 m (1.25 / 2), qui
n'est PAS un multiple de la grille 0.25 m — et aurait fait échouer
`validate_level.py` sous `--strict` (`check_transforms` avertit sur tout
mesh hors grille, sans distinction de classe SHELL/PROP). Contrairement à
`use_crowbar` en Zone A, la consigne pour cette zone était explicitement
« 0 warning, aucune exception » : `build_gondolas` utilise donc `row["x"]`
TEL QUEL comme coordonnée d'un bord de la pièce (pas son centre visuel),
ROT 90° pour aligner la longueur (axe local X du kit) sur l'axe monde Y.
Résultat vérifié par calcul et par relecture des bounding box des colliders
exportés : les allées centrales restent à EXACTEMENT 3.0 m (valeur ferme du
plan, préservée), et validate_level passe à 0 warning. Conséquence
mécanique acceptée, pas un changement de plan : les deux couloirs latéraux
ne sont plus rigoureusement symétriques (6.5 m à l'ouest / 7.75 m à l'est,
au lieu de ~7 m des deux côtés si on avait centré) — l'écart, 0.625 m, ne
change aucun placement donné par `level_spec.py`, seulement l'implémentation
mécanique du centrage. Documenté en détail dans le docstring de
`build_gondolas`.

**Écart docstring/code trouvé pour Zone A/B, corrigé le 2026-09-06** :
`export_level.py` documentait en tête « Valide d'abord, exporte ensuite »
alors que son code n'a jamais appelé `validate_level.py` — l'export se lance
directement. Sans conséquence pratique (la chaîne documentée exécute déjà
`validate_level.py` en étape séparée avant `export_level.py`), mais la
docstring reflète maintenant cet ordre manuel plutôt qu'une garantie que le
script n'offrait pas.

### Niveau Zone D (Réserve)

**Construit avec le vrai kit modulaire (2026-08-22)**, sur le même schéma que
Zone A/B/C — `level_spec.py::ZONE_D` transcrit littéralement le plan fourni
(montée en intensité, 5 Costards, verticalité mezzanine/escalier/rambarde,
racks et palettes de réserve). Première zone avec une VRAIE verticalité :
mezzanine (dalle à Z=2.0) accessible par un escalier double, MAIS aucun
`spawn_suit_*` posé dessus — contrainte d'IA actée en amont (`suit.ts::
computeAvoidedDirection` ne fait aucun vrai pathfinding, un Costard sur la
mezzanine resterait bloqué contre la rambarde en cherchant un joueur au sol
hors de son axe direct). Les 5 Costards sont au sol.

Nouvelles fonctions dans `build_level.py` :
- `_build_row_run` : logique PARTAGÉE entre `build_gondolas` (Zone C, avec
  capuchons `kit_gondola_end`) et `build_racks` (Zone D, sans capuchon —
  `kit_rack_4m` n'a pas de pièce d'about dans le kit, `end_name=None`).
  `build_gondolas` a été refactorée pour déléguer à cette fonction commune ;
  son comportement (donc les comptes déjà validés de la Zone C) est
  inchangé, seule l'implémentation est partagée.
- `tile_floor` : nouveau paramètre optionnel `z: float = 0.0`, réutilisé tel
  quel pour la dalle de mezzanine (`z=2.0`) sans dupliquer la logique de
  tiling.
- `build_mezzanine_stairs` : pose l'escalier double (voir piège ci-dessous).
- `build_mezzanine_railing` : tile `kit_railing_2m` (2 m, aucun module plus
  petit) le long de chaque `x_runs`, sans rotation (la longueur locale de la
  pièce est déjà alignée sur l'axe des runs).
- `build_storage_props` : empile `kit_pallet` en Z (`z = i × 0.15`) et pose
  les `kit_crate` isolées.

**Comptes obtenus** (`BUILD LEVEL — zone_d_reserve`) :

| Élément | Compte |
|---|---|
| Tuiles de sol (28 × 32 m / 4 m) | 56 |
| Dalle de mezzanine (28 × 8 m / 4 m, Z=2.0) | 14 |
| Murs (`kit_wall_4m` uniquement — 28/28/32/32 m, tous multiples de 4 m, 0 reste) | 30 |
| Rayonnages (`kit_rack_4m`, 2 rangées × 4 modules, sans capuchon) | 8 |
| Escalier (`kit_stairs_2m` ×2) | 2 |
| Rambarde (`kit_railing_2m`, 6+6 segments de 2 m, brèche de 4 m pour l'escalier) | 12 |
| Palettes (`kit_pallet`, 2 piles × 3) | 6 |
| Caisses (`kit_crate` isolées) | 3 |
| Spawns (1 joueur + 5 Costards, tous au sol) | 6 |
| Objets `use_*` | 0 |
| Lampes de secteur (grille 4 × 5, espacement 7.00 × 6.40 m) | 20 (pas de sun) |

Bake (`bake_vertex_lighting.py --save`) : **0 mesh noir, 0 dégradé plat** sur
131 meshes, luminance moyenne globale 0.212, 62 sommets écrêtés (proches des
lampes de plafond, `--light-energy` par défaut 180 W — cosmétique, sans
conséquence sur le verdict, même schéma que B/C).

`validate_level.py -- --strict` : **`ECHEC` avec exactement 8 warnings**
(voir piège grille ci-dessous), **0 erreur**. Sans `--strict` :
**`VERDICT : CONFORME (0 erreurs, 8 warnings)`** — c'est le critère réel
(« 0 erreur »), même politique que Zone A. 288 objets (262 meshes), 16472
triangles / 200000, 3 matériaux utilisés (`mat_kit_shell`, `mat_kit_storage`,
`mat_kit_detail` — `mat_kit_props` n'apparaît pas, aucun mobilier de vente
en Zone D), colliders `convexHull:2 cuboid:129` (les 2 convexHull sont les
rampes d'escalier, `kit_stairs_2m`).

Export (`export_level.py`) : `public/assets/levels/zone_d_reserve.glb`,
746 Ko. Rechargé dans Blender (`import_scene.gltf`) pour vérification
indépendante : 268 objets (`col_*`:131, `kit_floor_4x4`:70, `kit_wall_4m`:30,
`kit_rack_4m`:8, `kit_stairs_2m`:2, `kit_railing_2m`:12, `kit_pallet`:6,
`kit_crate`:3, `spawn_player`:1, `spawn_suit_*`:5 — comptes identiques au
`.blend` source), `COLOR_0` (attribut `Color`, domaine `CORNER`, 288 entrées)
non vide sur une tuile de la dalle de mezzanine échantillonnée, rotation +90°
de l'escalier et des racks préservée après export/réimport (vérifiée via
`matrix_world.to_quaternion()`, pas seulement `rotation_euler` — voir piège
ci-dessous), positions des 6 spawns revérifiées bit à bit contre
`level_spec.ZONE_D`.

**Piège de rotation découvert (nouveau, plus sérieux que l'asymétrie de
grille de la Zone C) : l'escalier double atterrissait sous la rambarde
solide.** `kit_stairs_2m` ne monte vers +Y que sous rotation +90° en Z
(vérifié empiriquement en instanciant la pièce et en lisant sa bounding box
monde — sans rotation la pente est le long de X). Mais cette même rotation,
comme pour les gondoles/racks, décale l'empreinte de la LARGEUR locale de la
pièce (2 m) vers **-X** à partir de l'origine Blender, pas vers +X. Un
placement naïf des positions données par le plan (`(-2.0, 20.0, 0.0)` et
`(0.0, 20.0, 0.0)`, coin bas AVANT rotation) fait donc atterrir les deux
marches sur X∈[-4,0] au lieu de X∈[-2,2] — précisément SOUS le segment de
rambarde solide voisin (`x_runs` s'arrête à X=-2), bloquant le haut de
l'escalier contre une rambarde pleine. Contrairement à l'asymétrie de
couloirs de la Zone C (cosmétique, acceptée), ceci est une VRAIE collision
entre deux pièces que le plan place bord à bord ailleurs (la brèche de
rambarde est calculée pour loger l'escalier). Corrigé mécaniquement dans
`build_mezzanine_stairs` : chaque abscisse reçoit `+ largeur locale (2 m)`
avant l'appel à `place_kit_piece`, ce qui fait tomber l'empreinte réelle
exactement sur X∈[-2,2] — vérifié par bounding box monde après le build
(`kit_stairs_2m` : X[-2,0] ; `kit_stairs_2m.001` : X[0,2]) ET par
comparaison avec les 12 segments de rambarde exportés (la brèche entre le
6ᵉ segment ouest, qui finit à X=-2, et le 7ᵉ segment est, qui commence à
X=2, coïncide exactement avec l'empreinte de l'escalier). Aucune position du
plan n'a été modifiée — seule la valeur intermédiaire passée à Blender est
ajustée pour compenser l'effet de la rotation, mécanique pure, documentée en
détail dans le docstring de `build_mezzanine_stairs`.

**Même mécanique de rotation appliquée aux racks (`build_racks`), avec une
conséquence acceptée plutôt que corrigée** : les deux rangées sont données à
des abscisses symétriques (X=-6.0 / X=4.0), mais la même rotation +90°
décale chaque empreinte de 1.2 m vers -X, PAS vers le mur le plus proche —
donc la rangée est (X∈[2.8,4.0]) est en réalité plus proche du centre que la
rangée ouest (X∈[-7.2,-6.0]) ne l'est du sien. La travée centrale réelle
(2.8 à -6.0 = 8.8 m) correspond bien à la valeur du plan (« ~8.8 m »), mais
ses bornes exactes diffèrent des coordonnées illustratives du plan
(X=-4.8/4.0). Traité comme l'asymétrie de couloirs de la Zone C : conséquence
MÉCANIQUE de la convention « row.x = coin, rotation +90° toujours vers -X »
explicitement demandée pour cette tâche (réutiliser `build_gondolas` tel
quel), pas une décision de layout — non corrigé, documenté dans
`level_spec.py::ZONE_D`.

**Conséquence sur l'occlusion de `spawn_suit_2` — signalé, non corrigé
(vérification en jeu nécessaire, comme le bug équivalent de la Zone C).**
Le plan affirme que `spawn_suit_1`/`spawn_suit_2` sont occultés depuis le
spawn par la rangée de racks adjacente. Recalculé avec l'empreinte RÉELLE
(pas les bornes illustratives du plan) : côté ouest, le segment
spawn(0,0)→suit_1(-10,10) croise bien X∈[-7.2,-6.0] à Y∈[6.0,7.2] (dans
l'étendue Y de la rangée [4,20]) — occlusion confirmée. Côté est, le segment
spawn(0,0)→suit_2(10,10) (droite y=x) ne croise l'empreinte réelle de la
rangée est (X∈[2.8,4.0], Y∈[4,20]) qu'au point unique (4,4) — un
effleurement de coin, pas une occlusion robuste. Position NON modifiée ici
(décision de layout, hors périmètre de cette tâche) — à vérifier en jeu via
`window.cassandre.suits` comme indiqué dans le rapport ; si `spawn_suit_2`
sort en état `attack`/visible immédiatement, c'est la cause géométrique
exacte.

**Piège de grille — nouvelle famille, propre à la Zone D (empilement
vertical, pas tiling horizontal).** Les 8 warnings restants viennent tous de
l'empilement des palettes (`kit_pallet`, épaisseur 0.15 m) : `z = i × 0.15`
donne 0 / 0.15 / 0.30 par pile, et 0.15/0.30 ne sont pas des multiples de la
grille 0.25 m — `check_transforms` avertit sur X **et** Z, pas seulement le
plan horizontal. Mécaniquement inévitable : la hauteur de `kit_pallet` est
une donnée déjà figée du kit (`kit_spec.py`, construit et baké avant cette
tâche), et empiler à un pas différent de sa hauteur réelle créerait soit un
vide soit un chevauchement entre palettes — pire qu'un warning de
validateur. Exactement la même famille de dérogation que `use_crowbar` en
Zone A (Z=0.15, déjà documenté plus haut) : accepté et documenté, pas corrigé
— le critère réel du projet est « 0 erreur », pas « 0 warning ».

### Niveau Zone E (Bureau)

**Construit avec le vrai kit modulaire (2026-08-22), scope volontairement
restreint — voir CLAUDE.md.** Cette passe ne construit QUE la géométrie de
la salle + un ennemi placeholder standard (`spawn_suit_1`, le même Costard
que Zone A-D). **Le "directeur" en tant que vrai boss (nouveau type
d'entité, effet de peau qui se déchire/révèle reptilien), le badge à
ramasser et la porte de sortie VERROUILLÉE par ce badge restent À FAIRE dans
une tâche séparée ultérieure** — aucun nouveau type d'entité, aucun système
de badge, aucune porte animée n'a été introduit ici. Aucun fichier `src/**`
n'a été touché.

`level_spec.py::ZONE_E` transcrit littéralement le plan fourni (aucune
décision de layout prise ici) : une salle principale 16×16 m + une alcôve de
sortie sans issue (couloir 2×4 m), reliées par une brèche murale de 2 m au
nord dans laquelle est posé `kit_door_2m` — un encadrement de porte avec
découpe intégrée (compound de 3 cuboids : 2 jambages + linteau, voir
`kit_spec.py::_wall_opening_parts`), **pas** un `kit_door_leaf`/`door_*`
animé : la brèche reste un simple passage traversable dès le départ.

Nouvelle clé de zone optionnelle `"door_frame"` (comme `"racks"` ou
`"mezzanine"`) et nouvelle fonction `build_door_frame` dans
`build_level.py` (posée entre `build_checkouts` et `build_gondolas`) :
pose `zone["door_frame"]["piece"]` via `place_kit_piece`, à `(x, y, 0.0)`,
**rotation 0°**. Aucune rotation n'a été nécessaire : `kit_door_2m` partage
la même convention d'origine que `kit_wall_2m` (coin, x∈[0,W], y∈[0,WALL_T])
et la brèche court le long de l'axe X exactement comme les `wall_run` nord
adjacents (`theta_deg=0°` calculé par `plan_wall_run` pour ces mêmes
segments) — vérifié par calcul avant l'implémentation, puis confirmé par la
bounding box réimportée (voir plus bas). `needed_pieces` inclut
`kit_door_2m` quand `zone.get("door_frame")` existe ; le récapitulatif
final affiche `Porte : 1`.

**Comptes obtenus** (`BUILD LEVEL — zone_e_bureau`) :

| Élément | Compte |
|---|---|
| Tuiles de sol (rectangle englobant 16 × 20 m / 4 m — le sol déborde sous l'alcôve, sans conséquence) | 20 |
| Murs (`kit_wall_4m`:16, `kit_wall_2m`:3, `kit_wall_1m`:2 — les deux tronçons nord de 7 m tilent chacun en 4+2+1, aucun reste) | 21 |
| Porte (`kit_door_2m`, encadrement, PAS de `door_*` animé) | 1 |
| Spawns (1 joueur + 1 Costard placeholder) | 2 |
| Objets `use_*` | 0 |
| Lampes de secteur (grille 2 × 3, espacement 8.00 × 6.67 m) | 6 (pas de sun) |

Bake (`bake_vertex_lighting.py --save`) : **0 mesh noir, 0 dégradé plat**
sur 42 meshes, luminance moyenne globale 0.178, 0 sommet écrêté.

`validate_level.py -- --strict` : **`VERDICT : CONFORME (0 erreurs,
0 warnings)`** — comme la Zone C (et contrairement à A/D), aucune exception
n'a été nécessaire ici, tout tombe sur la grille 0.25 m par construction.
94 objets (86 meshes), 4728 triangles / 200000, 1 matériau utilisé
(`mat_kit_shell` — aucun mobilier de vente/réserve dans cette zone),
colliders `cuboid:44` (41 murs+sol + 3 pour le compound de la porte).

Export (`export_level.py`) : `public/assets/levels/zone_e_bureau.glb`,
201 Ko. Rechargé dans Blender (`import_scene.gltf`) pour vérification
indépendante du fichier produit : 88 objets (86 meshes — les 6 lampes de
bake sont exclues de l'export, `_LIGHTS["gltf_export"] = False`), comptes
par préfixe identiques au `.blend` source (`kit_floor_4x4`:20,
`kit_wall_4m`:16, `kit_wall_2m`:3, `kit_wall_1m`:2, `kit_door_2m`:1,
`col_box_*`:44 dont `col_box_door_2m_l/r/top`:1 chacun, `spawn_player`:1,
`spawn_suit_1`:1), `COLOR_0` (attribut `Color`, domaine `CORNER`) non vide
sur une tuile de sol échantillonnée, et surtout **bounding box de
`kit_door_2m` revérifiée bit à bit : X[-1.000, 1.000] Y[14.000, 14.250]
Z[0.000, 5.000]** — exactement la brèche X∈[-1,1] à Y=14 (face intérieure)
prescrite par `level_spec.ZONE_E`, épaisseur 0.25 m (`WALL_T`) et hauteur
5 m (`WALL_H`) comme les murs adjacents.

**Aucun piège nouveau rencontré** — contrairement à Zone C (asymétrie de
grille) et Zone D (rotation d'escalier), `kit_door_2m` se comporte en tout
point comme un `kit_wall_2m` du point de vue du placement mécanique
(origine, orientation par défaut), donc `build_door_frame` n'a eu besoin
d'aucune compensation.

**Rappel de scope, historique** : au moment de cette construction (2026-08-22),
trois choses restaient hors scope — (1) le directeur comme vrai boss, (2) le
badge à ramasser, (3) la porte de sortie verrouillée par ce badge. (1) et (2)
ont été faits dans des tâches séparées ultérieures (voir CLAUDE.md —
`director.ts`/`directorManager.ts`, `spawn_suit_1` remplacé par
`spawn_director_1`). (3) est traité ci-dessous.

### Zone E — vantail de porte + déclencheur (2026-08-23)

**Ferme le dernier écart de la Zone E** : `kit_door_2m` restait un simple
encadrement traversable (aucun vantail, aucune interactivité). Le câblage
runtime de la porte à badge était déjà fait et testé côté build
(`loader.ts::buildDoor`, `interactive.ts`, `main.ts` — voir CLAUDE.md) ;
cette tâche fournit UNIQUEMENT la géométrie manquante côté Blender, aucun
fichier `src/**` touché.

**Le kit n'a pas eu besoin d'être reconstruit.** `kit_door_leaf` (dims
1.5 × 0.15 × 2.5, `proxies=[]`) était déjà présent dans `kit_spec.py` ET dans
`kit_hypermarche.blend` (vérifié directement : `bpy.data.meshes` contient
`kit_door_leaf`, 52 sommets, bbox locale x∈[0,1.5] y∈[0,0.15] z∈[0,2.5],
attribut couleur `Col` déjà baké) — un ajout antérieur au kit, jamais encore
utilisé par un niveau.

**Nouvelle fonction `build_door_leaf`** (`build_level.py`, juste après
`build_door_frame`) : pose `kit_door_leaf` renommé `door_*` (piloté par une
nouvelle clé optionnelle `zone["door_frame"]["leaf_name"]`, `"door_e_exit"`
pour la Zone E), centré dans l'ouverture du `kit_door_2m` posé juste avant.
`build_use_objects` étendue pour propager une clé optionnelle `"target"` du
dict `use` comme custom property Blender `obj["target"] = ...` (jusqu'ici
aucun `use_*` n'en avait besoin — `use_crowbar`/`use_shotgun` sont des
pickups autoportants). `level_spec.ZONE_E` gagne `"leaf_name": "door_e_exit"`
dans `door_frame` et un nouvel objet `use_exit_door` (`target:
"door_e_exit"`) dans `use_objects`. `build_combined_level.py` mis à jour en
miroir (`_t_door_frame` préserve `leaf_name` à la translation,
`gather_needed_pieces` ajoute `kit_door_leaf` si besoin, le vantail est posé
dans la même boucle par zone que `build_door_frame`) — une seule zone pose un
`door_frame` à ce jour, `door_e_exit` est déjà zone-scopé par son nom, aucun
renommage supplémentaire nécessaire (contrairement à `spawn_suit_*`).

**Piège découvert, propre à `door_*` (nouveau, absent de tout `col_*`
jusqu'ici) : `loader.ts::buildDoor` ne recentre PAS la géométrie.** Il pose
le corps Rapier dynamique à la position DÉCOMPOSÉE DIRECTEMENT de
`mesh.matrixWorld` (donc l'origine locale de l'objet), et calcule les
demi-étendues depuis la bounding box LOCALE du mesh — contrairement à
`buildCuboidCollider` (tout `col_box_*`), qui calcule explicitement
`localCenter` et le reprojette en repère monde avant de poser le corps. Si
`door_e_exit` gardait la convention du reste du kit (origine à un COIN,
x∈[0,1.5] etc., comme le mesh-datablock `kit_door_leaf` lui-même), le corps
physique se serait retrouvé centré sur ce coin : la moitié du collider
serait tombée hors du battant rendu. `loader.ts` est hors scope de cette
tâche (contrat déjà câblé côté TypeScript, non modifié) — c'est donc la
géométrie qui s'y conforme : `build_door_leaf` copie le mesh du kit
(`.copy()`, même règle anti-partage que `place_kit_piece`) puis DÉCALE
CHAQUE SOMMET pour recentrer l'origine locale sur le centre de la boîte
englobante, avant de poser l'objet à son centre monde. `door_e_exit` est
donc le seul objet posé par `build_level.py` dont l'origine locale n'est pas
un coin — uniquement sur cette INSTANCE de niveau ; le mesh-datablock
`kit_door_leaf` dans `kit_hypermarche.blend` reste inchangé (convention
coin, cohérent avec `inspect_kit.py`).

**Choix de placement (grille 0.25 m, aucune exception)** : centrer le
vantail (épaisseur 0.15 m) dans l'épaisseur du mur (0.25 m) demanderait un
décalage Y de `door_spec["y"] + (0.25 − 0.15) / 2 = door_spec["y"] + 0.05` —
pour la Zone E, `14.0 + 0.05 = 14.125`, PAS un multiple de 0.25 m (aurait
fait échouer `validate_level.py --strict`, une régression sur une zone
jusqu'ici à 0 warning). Calé à la place sur la FACE INTÉRIEURE du cadre
(`door_spec["y"] = 14.0`, la même face de référence que tout `wall_run` du
projet) : le vantail dépasse légèrement (0.075 m) côté salle plutôt que
d'être centré dans l'épaisseur — cohérent avec la convention déjà en place,
zéro exception introduite. `use_exit_door` posé à `(0.0, 12.75, 1.0)`
(1.25 m au sud du centre du vantail, ≈1.28 m de distance réelle, sous les
2 m d'`USE_RANGE_METERS`), CÔTÉ SALLE (y<14, jamais dans l'alcôve sans
issue), coordonnées elles aussi pile sur la grille — aucune des deux
exceptions déjà connues (`use_crowbar`/`use_shotgun`, Z=0.15 hors grille +
`target` manquant) ne s'applique ici.

**Comptes `zone_e_bureau` avant / après** (`validate_level.py --strict`) :

| | avant | après |
|---|---:|---:|
| Objets (meshes) | 94 (86) | 96 (88) |
| Triangles | 4728 | 4784 |
| Matériaux | 1 (`mat_kit_shell`) | 2 (+ `mat_kit_detail`, `use_exit_door`) |
| Colliders | cuboid:44 | cuboid:44 (inchangé — `door_e_exit` n'ajoute AUCUN `col_*`, contrat volontaire, voir plus haut) |
| Warnings (`--strict`) | 0 | 0 |

`bake_vertex_lighting.py --save` : 44 meshes, **0 mesh noir, 0 dégradé
plat** (luminance moyenne 0.181), `door_e_exit`/`use_exit_door` bakés
correctement (17/52 et 0/24 sommets écrêtés, dans la norme des autres
pièces).

Export (`export_level.py`) : `public/assets/levels/zone_e_bureau.glb`,
207 Ko. Rechargé dans Blender pour vérification indépendante :
**`door_e_exit` bbox monde X[-0.75,0.75] Y[13.925,14.075] Z[0,2.5]**
(exactement centré sur X/Z dans l'ouverture, calé sur la face intérieure en
Y comme voulu) ; **`use_exit_door`** à `(0.0, 12.75, 1.0)` avec
`extras.target == "door_e_exit"` confirmé sur le fichier réimporté (pas
seulement sur le `.blend` source).

**Comptes `hypermarche_complet` avant / après** (`validate_level.py`, sans
`--strict` — le critère réel du projet) :

| | avant | après |
|---|---:|---:|
| Objets (meshes) | 836 (764) | 838 (766) |
| Triangles | 46 372 | 46 428 |
| Matériaux | 4 | 4 (inchangé — `mat_kit_detail` déjà utilisé par `use_crowbar`) |
| Colliders | cuboid:380 convexHull:2 | cuboid:380 convexHull:2 (inchangé) |
| Spawns | 15 | 15 (inchangé) |
| `use_*` | 2 (`use_crowbar`, `use_shotgun`) | 3 (+ `use_exit_door`) |
| Warnings | 12 (8 palettes + crowbar + shotgun, tous déjà connus) | 12 — **exactement les mêmes**, aucun nouveau |

`--strict` : `ECHEC` avec les mêmes 12 warnings qu'avant cette tâche (0
erreur dans les deux cas). Bake : 384 meshes (+2), **0 mesh noir, 0 dégradé
plat**, luminance moyenne 0.225. Export : `public/assets/levels/
hypermarche_complet.glb`, 1999 Ko. Rechargé pour vérification indépendante :
**`door_e_exit` à `(52.0, 78.0, 1.25)`**, bbox monde X[51.25,52.75]
Y[77.925,78.075] Z[0,2.5] — exactement la translation attendue
(0+52, 14+64, 1.25) ; **`use_exit_door` à `(52.0, 76.75, 1.0)`**,
`extras.target == "door_e_exit"` confirmé ; **15 spawns** (`spawn_player`,
`spawn_director_e1`, 13 `spawn_suit_*`) et **3 `use_*`** recomptés un par un
sur le fichier réimporté, identiques au `.blend` source.

### Niveau complet (hypermarche_complet)

**Fusion des Zones A, B, C, D, E en UN SEUL niveau connecté (2026-08-22)**,
sans coupure de chargement — un vrai plan continu, pas cinq boîtes
indépendantes. Tâche de grande ampleur, décidée explicitement par
l'utilisateur (« vraie carte unique fusionnée », coût assumé plutôt qu'un
enchaînement par écrans de transition). Nouveau script
`build_combined_level.py` : importe `level_spec.ZONE_A`..`ZONE_E` **sans les
muter**, construit pour B/C/D/E une COPIE traduite + renommée (jamais
l'original), taille une brèche de 4 m dans un mur de chaque zone concernée,
construit un couloir de connexion de 4 × 4 m entre chaque paire, et
réutilise TELS QUELS les builders de `build_level.py` (`tile_floor`,
`build_walls`, `build_checkouts`, `build_gondolas`, `build_racks`,
`build_mezzanine_stairs`/`_railing`, `build_storage_props`, `build_door_frame`,
`build_use_objects`, `build_lighting`) dans les mêmes collections partagées —
un seul appareil de scène (`wipe_scene()` une fois, pas par zone) pour tout
le niveau. **Vérifié : `--zone a` à `--zone e` produisent toujours exactement
les mêmes comptes qu'avant cette tâche** (rebuild de contrôle des 5 zones,
comptes `Spawns`/`Objets use_*` identiques à la lettre près à ceux déjà
documentés plus haut dans ce fichier) — le seul changement dans
`build_level.py` est un paramètre `include_player: bool = True` ajouté à
`build_spawns` (défaut inchangé, voir plus bas).

#### Ordre, translations et brèches choisies

A (ancre, ORIGINALE, non traduite) → B → C → D → E, imposé par la tâche. Pour
chaque paire, la position exacte de la brèche est **vérifiée dégagée** par
lecture directe des bounding box déjà déclarées dans `level_spec.py` (pas
devinée) — voir le docstring de chaque `prepare_zone_*` dans
`build_combined_level.py` pour le calcul complet.

| Zone | dx | dy | Brèche amont (repère local, avant dx/dy) | Brèche aval (repère local) |
|---|---:|---:|---|---|
| A (ancre) | 0 | 0 | — | **est**, x=10, y∈[2,6] |
| B | +26 | 0 | **ouest**, x=-12, y∈[2,6] | **nord**, y=22, x∈[-2,2] |
| C | +26 | +28 | **sud**, y=-2, x∈[-2,2] | **nord**, y=26, x∈[-2,2] |
| D | +26 | +60 | **sud**, y=-2, x∈[-2,2] | **est**, x=14, y∈[10,14] |
| E | +52 | +64 | **ouest**, x=-8, y∈[6,10] | (cul-de-sac, aucune sortie) |

Les 4 couloirs qui en résultent (coordonnées MONDE, après translation, tous
des dalles 4 × 4 m — le plus petit connecteur qui tile sans reste avec
`kit_floor_4x4`, une pièce fixe non redimensionnable) :

| Connecteur | Dalle (monde) | Murs de flanc |
|---|---|---|
| A-B | x∈[10,14], y∈[2,6] | y=2 et y=6 (le couloir avance selon X) |
| B-C | x∈[24,28], y∈[22,26] | x=24 et x=28 (le couloir avance selon Y) |
| C-D | x∈[24,28], y∈[54,58] | x=24 et x=28 |
| D-E | x∈[40,44], y∈[70,74] | y=70 et y=74 |

**Justification de chaque mur choisi**, avec les distances réelles relues
dans `level_spec.py` (jamais devinées) :

- **A→B, mur EST de A.** Le nord de la Zone A est occupé par la
  vitrine/l'alcôve (contrainte déjà actée, hors scope de redécision) : est et
  ouest sont les deux seuls murs francs. Le mur est est un run continu de
  x=10, y=-2 à 22 (24 m), jamais recoupé par la vitrine (qui vit en x∈[-6,6]
  au NORD, sans rapport avec le mur est) — n'importe quel y du mur est donc
  dégagé. y∈[2,6] retenu loin à la fois du crowbar (2,2) et de l'alcôve
  (y≥18), sans autre contrainte que « au milieu, dégagé ».
- **B, brèche OUEST (entrée).** Les caisses sont à y∈[9.5,10.5],
  x∈[-9,9] — 3.5 m au nord de la brèche retenue (y∈[2,6]), aucun contact.
  **B, brèche NORD (sortie).** Aucune caisse n'atteint y=22 (8 m de marge) :
  n'importe quel x est dégagé. x∈[-2,2] choisi pour retomber, une fois
  translaté par dx=26, exactement sur la colonne x∈[24,28] du monde —
  garde les connecteurs B-C et C-D alignés en une seule colonne verticale.
- **C, brèche SUD (entrée).** Les gondoles commencent à y=6.75 (rangées
  y∈[8,16] + capuchons ±1.25) — 8.75 m de marge. **C, brèche NORD (sortie).**
  Les gondoles finissent à y=17.25 — 8.75 m de marge aussi. Même colonne
  x∈[-2,2] reprise par simplicité (alignement, pas une contrainte de C
  elle-même).
- **D, brèche SUD (entrée).** Les racks commencent à y=4 — 6 m de marge,
  n'importe quel x dégagé, même colonne x∈[-2,2] reprise.
  **D, brèche EST (sortie) — PAS le nord.** Contrainte explicite de
  l'énoncé : le mur nord de la Zone D (y=30) est en réalité le bord de la
  mezzanine (Z=2 m, flush contre les murs est/ouest/nord) — une brèche au
  sol y déboucherait 2 m sous le niveau de marche réel. La rangée est de
  racks s'arrête à x=4.0 (empreinte réelle X∈[2.8,4.0] — voir la note
  mécanique déjà documentée pour la Zone D plus haut dans ce fichier),
  soit 10 m avant le mur est (x=14) : **n'importe quel y du flanc est**
  [4,20] est dégagé, pas seulement une sous-plage. y∈[10,14] retenu au
  centre de cette bande par symétrie, sans autre contrainte. Conséquence :
  la Zone E se retrouve à l'EST de D plutôt qu'au nord — « un niveau qui
  tourne », anticipé et accepté explicitement dans l'énoncé de la tâche.
- **E, brèche OUEST (entrée, cul-de-sac — pas de sortie).** Aucune
  géométrie intérieure de E n'approche le mur ouest : le seul élément posé
  (`door_frame`, `kit_door_2m`) est au NORD (x∈[-1,1], y=14), à 9 m au moins
  du mur ouest sur toute sa longueur (y∈[-2,14]). y∈[6,10] retenu au centre
  par symétrie.

Chaque `dx`/`dy` est un **entier de mètres** — un entier est automatiquement
un multiple de la grille 0.25 m du projet, donc aucune translation n'a
introduit de nouveau warning de grille (seuls les warnings déjà connus et
documentés plus haut, palette Z + crowbar, réapparaissent inchangés — voir
comptes ci-dessous).

#### Renommage

Toutes les zones SAUF A (inchangée, y compris `use_crowbar`) : `spawn_suit_N`
→ `spawn_suit_<lettre>N` (B/C/D) et `spawn_director_N` → `spawn_director_<lettre>N`
(E). `loader.ts` ne fait qu'un `startsWith(...)` sur le préfixe complet —
aucune modification runtime nécessaire, vérifié en relisant le `.glb`
réimporté (voir comptes ci-dessous).

#### Nouvel objet : `use_shotgun` (Zone B, copie combinée SEULEMENT)

Ajouté uniquement dans la copie traduite de la Zone B utilisée par ce
niveau — **absent** de `zone_b_caisses.glb` (vérifié : ce fichier individuel
n'a pas été reconstruit par cette tâche). Position monde `(15.5, 4.0, 0.15)`
: à 1.5 m de la brèche ouest translatée (x=14, l'entrée depuis la Zone A) et
5.5 m du mur sud, dans la première case de sol franchie en entrant, très
largement avant la première caisse (y=9.5) — dégagé de toute géométrie,
non manqué. Même schéma exact que `use_crowbar` (custom property `target`
volontairement absente — pickup autoportant, pas une porte à cibler),
donc les deux mêmes 2 warnings (grille + `target` manquant), déjà connus et
acceptés pour `use_crowbar` depuis la Zone A, réapparaissent à l'identique
pour `use_shotgun`.

#### Comptes obtenus (`BUILD COMBINED LEVEL — hypermarche_complet`)

| Zone | sol | murs | vitrine | caisses | gondoles | racks | mezz. sol | escalier | rambarde | palettes | caisses (crates) | porte | spawns | use_* | lampes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | 30 | 23 | 2 | 0 | 0 | 0 | — | — | — | 0 | 0 | 0 | 2 | 1 | 10 |
| B | 36 | 23 | 0 | 4 | 0 | 0 | — | — | — | 0 | 0 | 0 | 3 | 1 | 9 |
| C | 42 | 26 | 0 | 0 | 12 | 0 | — | — | — | 0 | 0 | 0 | 4 | 0 | 12 |
| D | 56 | 28 | 0 | 0 | 0 | 8 | 14 | 2 | 12 | 6 | 3 | 0 | 5 | 0 | 20 |
| E | 20 | 20 | 0 | 0 | 0 | 0 | — | — | — | 0 | 0 | 1 | 1 | 0 | 6 |

Connecteurs : A-B (sol 1, murs 2), B-C (sol 1, murs 2), C-D (sol 1, murs 2),
D-E (sol 1, murs 2) — 4 dalles + 8 murs de flanc au total.

**Totaux** : sol 188 (+ 14 dalles de mezzanine, comptées à part comme pour la
Zone D seule), murs 128 (`kit_wall_4m`:117, `kit_wall_2m`:9, `kit_wall_1m`:2
— recompté indépendamment sur le `.glb` réimporté, voir plus bas),
vitrine 2, caisses 4, gondoles+capuchons 12, racks 8, escalier 2,
rambarde 12, palettes 6, caisses (crates) 3, porte 1, **spawns 15** (1
`spawn_player` + 13 `spawn_suit_*` + 1 `spawn_director_e1`), **use_* 2**
(`use_crowbar` + `use_shotgun`), lampes 57. 5 mondes Blender orphelins
supprimés après coup (le `World` par défaut de `--factory-startup`, jamais
nettoyé par `geo_utils.wipe_scene()`, + les 4 mondes créés par les zones
A/B/C/D — seul celui de la Zone E, le dernier assigné, reste actif ; les
cinq partagent de toute façon la même couleur/force de fond, donc lequel
reste actif est sans conséquence sur le bake).

Bake (`bake_vertex_lighting.py --save`) : **382 meshes, 57 lampes, 0 mesh
noir, 0 dégradé plat**, luminance moyenne globale 0.224, 178 sommets
écrêtés (cosmétique, proches des lampes de plafond — même famille que
chaque zone individuelle).

`validate_level.py` (sans `--strict`) : **`VERDICT : CONFORME (0 erreurs,
12 warnings)`**. Sous `--strict` : `ECHEC` avec les MÊMES 12 warnings, tous
déjà connus et acceptés individuellement avant cette tâche — 8 palettes
(`kit_pallet`/`col_box_pallet` ×4 chacun, empilement Z=0.15/0.30 de la Zone
D, famille déjà documentée), `use_crowbar` (grille + `target` manquant,
Zone A) et `use_shotgun` (même famille que `use_crowbar`, voir ci-dessus).
**0 warning nouveau** que ceux déjà attendus d'après le contenu inchangé de
chaque zone — la fusion elle-même n'introduit aucune irrégularité. 836
objets (764 meshes), 46 372 triangles / 200 000, 4 matériaux utilisés
(`mat_kit_shell`, `mat_kit_props`, `mat_kit_storage`, `mat_kit_detail`),
colliders `cuboid:380 convexHull:2` (382 total — les 2 convexHull sont les
rampes d'escalier de la Zone D, inchangées).

Export (`export_level.py`) : `public/assets/levels/hypermarche_complet.glb`,
**1994 Ko**. Rechargé dans Blender (`import_scene.gltf`) pour vérification
indépendante :
- **779 objets, 764 meshes** (836 − 57 lampes non exportées, `export_lights=
  False` — écart exactement égal au compte de lampes, confirmé) ;
- **exactement 1 `spawn_player`**, à `(0, 0, 0)` — identique à celui de la
  Zone A d'origine ;
- **13 `spawn_suit_*`** tous uniques : `spawn_suit_1` (Zone A, INCHANGÉ),
  `spawn_suit_b1/b2/b3`, `spawn_suit_c1/c2/c3/c4`, `spawn_suit_d1..d5` — 0
  doublon de nom de base ;
- **1 `spawn_director_e1`** (Zone E) ;
- **2 `use_*`** : `use_crowbar` (2,2,0.15 — inchangé) et `use_shotgun`
  (15.5,4,0.15) ;
- **`kit_wall_4m`:117, `kit_wall_2m`:9, `kit_wall_1m`:2** — recompté à la
  main par zone à partir des longueurs de brèche (B : 2× segments de 10 m
  après la brèche nord → 2 `kit_wall_2m` ; C : 4× segments de 10 m après les
  brèches sud+nord → 4 `kit_wall_2m` ; E : 3 `kit_wall_2m` + 2 `kit_wall_1m`
  déjà documentés pour la Zone E seule, INCHANGÉS par la nouvelle brèche
  ouest qui, elle, tile en 8 m + 4 m sans reste) — total 2+4+3=9
  `kit_wall_2m`, exactement le compte réel : confirme qu'aucune brèche
  n'introduit un reste de tiling imprévu ;
- **`COLOR_0` non vide** (attribut réimporté sous le nom `Color`) sur un
  mesh de rendu échantillonné dans CHACUNE des 5 zones d'origine
  (`kit_floor_4x4` pour A, `kit_checkout` pour B, `kit_gondola_4m` pour C,
  `kit_rack_4m` pour D, `kit_door_2m` pour E) ;
- **bounding box monde globale** x∈[-10.25, 60.25], y∈[-2.25, 90.25] —
  cohérente avec un plan en L/zigzag (les zones ne couvrent chacune qu'une
  sous-partie de cette boîte, pas un rectangle plein) ;
- **`kit_door_2m` (Zone E) à x∈[51,53], y∈[78,78.25]** — exactement la
  brèche translatée (x=-1+52 à 1+52, y=14+64) prescrite par la translation
  ci-dessus, confirmant que la Zone E est bien posée à l'endroit calculé.

Pas de chevauchement ni de trou détecté entre zones : chaque paire de zones
adjacentes est séparée par un gap EXACTEMENT comblé par son connecteur
4 × 4 m (vérifié par calcul sur les 5 empreintes traduites — Zone A
x∈[-10,10]/y∈[-2,22], B x∈[14,38]/y∈[-2,22], C x∈[14,38]/y∈[26,54], D
x∈[12,40]/y∈[58,90], E x∈[44,60]/y∈[62,82] — et confirmé par le compte de
tuiles de sol : 202 `kit_floor_4x4` au total, dont 188 attribués aux
5 zones + 4 connecteurs et 14 à la dalle de mezzanine, aucune tuile en trop
ni manquante).

#### Pièges rencontrés

**Le monde de bake orphelin (nouveau, propre à la fusion).**
`build_level.py::build_lighting` crée un `bpy.data.worlds` et le rend actif
à CHAQUE appel — correct pour un fichier de zone isolée (un seul appel),
mais appelé 5 fois ici. Pire : `geo_utils.wipe_scene()` ne touche jamais
`bpy.data.worlds` (il ne nettoie que collections/objets/meshes/matériaux/
lampes/images) — le fichier partait donc déjà avec le `World` par défaut de
`--factory-startup` en plus. Résultat mesuré : **6** mondes après les 5
zones, pas 5. Les cinq mondes de zone partagent la même couleur/force de
fond (seul le `sun` optionnel de la Zone A diffère, et c'est un OBJET lampe
distinct, pas une propriété du monde) : lequel reste actif ne change rien
au bake. `build_combined_level.py` supprime après coup tout monde dont le
nom ne correspond pas à `bpy.context.scene.world` (comparaison par nom,
plus simple qu'une comparaison d'identité d'objet Python) — vérifié en
rechargeant le fichier produit : exactement 1 monde restant
(`zone_e_bureau_world`), correctement actif.

**Aucun piège de géométrie/collision.** Contrairement aux zones
individuelles (asymétrie de grille en Zone C, collision escalier/rambarde
en Zone D), la fusion elle-même n'a nécessité AUCUNE correction de ce
genre : chaque brèche a été choisie avec une marge d'au moins 3.5 m par
rapport à la géométrie intérieure la plus proche (voir le tableau de
justification ci-dessus), et chaque translation est un entier de mètres —
la grille 0.25 m ne pouvait donc pas être cassée par construction. Les 4
couloirs de connexion, en dalles 4 × 4 m tuilées par les mêmes fonctions que
le reste du kit, n'ont produit aucun reste de tiling (vérifié par calcul
avant l'implémentation ET recompté indépendamment sur le `.glb` exporté,
voir `kit_wall_2m`/`kit_wall_1m` ci-dessus).

**Le seul changement dans `build_level.py`** : `build_spawns(zone,
logic_coll, include_player: bool = True)` — paramètre ajouté avec une
valeur par défaut qui préserve EXACTEMENT le comportement précédent.
Vérifié par reconstruction de contrôle des 5 `--zone a|b|c|d|e` après cette
modification : mêmes comptes `Spawns`/`Objets use_*` que ceux déjà
documentés plus haut dans ce fichier pour chaque zone, aucune régression.

#### Ce qui n'a pas été touché (hors scope, rappel)

Aucune décision de layout n'a été prise ici : l'ORDRE des zones (A→B→C→D→E),
le CONTENU de chaque zone (murs intérieurs, gondoles, racks, mezzanine,
caisses, spawns d'origine) et les 5 fichiers individuels
(`zone_{a_parking,b_caisses,c_rayons,d_reserve,e_bureau}.glb`) restent
EXACTEMENT ce qu'ils étaient — seule la position dans un espace monde
partagé, l'ouverture d'une brèche de connexion, le renommage des noms en
collision, et l'ajout du pickup `use_shotgun` (dans la copie combinée
SEULEMENT) ont été ajoutés. `src/game/level/levels.ts`, l'entrée de menu, et
la vérification en jeu restent à faire par l'humain (voir CLAUDE.md).

### Secrets — Zone B (surgelés) et Zone C (toit de gondole) (2026-08-24)

**Les deux secrets prévus par le plan** (`PLAN_PROTO_BOOMER_SHOOTER.md` :
« secret 1, mur cassable, surgelés » en Zone B, « secret 2, toit, via
palettes » en Zone C) **ont leur géométrie côté Blender.** Design entièrement
pré-décidé par l'humain (placement, dimensions, mécanique de saut) — cette
tâche l'exécute mécaniquement, comme toute zone précédente. Le contrat
runtime `secret_*` (zone AABB comptée dans `LevelStats.secretCount`/
`LevelHandle.secrets`, `loader.ts::buildSecretZone`) existait déjà mais
n'était utilisé par aucun objet du niveau avant cette tâche — c'est la
première fois qu'un `secret_*` réel existe dans un `.glb` du projet.
**Aucun fichier `src/**` touché** : la détection/le compteur/le HUD sont
câblés en parallèle par l'humain, hors scope de cette tâche.

#### Secret 1 (Zone B, surgelés) — porte SANS verrou

Contrairement à `door_e_exit` (Zone E, verrouillée par badge), la porte du
secret 1 est un simple `door_*` que `use_frozen_storage` ouvre sans aucune
condition côté jeu (câblage TS hors scope ici). Brèche de 2 m dans le mur
OUEST de la Zone B (`level_spec.ZONE_B`, mur désormais scindé en deux
`wall_run` — sud 12 m, nord 10 m — pour loger la brèche Y∈[10,12], juste au
nord de la rangée de caisses X∈[-9,-6], sans contact avec elle), menant à une
alcôve 3×2 m (X∈[-15,-12], Y∈[10,12]) avec murs sur ses 3 côtés extérieurs.

**Généralisation nécessaire de `door_frame`/`build_door_leaf` (nouveau,
absent des zones précédentes) : brèche dans un mur VERTICAL, pas
horizontal.** La Zone E posait son unique `kit_door_2m`/`kit_door_leaf` avec
une rotation figée à 0° (documenté « aucune rotation nécessaire », vrai
uniquement parce que sa brèche était dans un mur nord-sud le long de X). La
porte du secret 1 est dans le mur OUEST (le long de Y) : `build_door_frame`
et `build_door_leaf` (`build_level.py`) acceptent maintenant un
`door_spec["rot_deg"]` optionnel (défaut 0.0, comportement Zone E
inchangé — revalidé, toujours 0 warning), qui fait tourner la pièce ET
recalcule le centre du vantail par rotation du même offset local
(`DOOR_JAMB + DOOR_OPEN_W/2`) utilisé par la Zone E, généralisé en
`(cos θ, sin θ)` plutôt que codé en dur sur l'axe X. `x`/`y` du `door_frame`
restent le coin AVANT rotation, choisi EXACTEMENT comme le ferait
`plan_wall_run` pour un segment de 2 m inséré à la place de la brèche dans
le run ouest d'origine (`x=-12.0, y=10.0, rot_deg=90.0`) — vérifié après
export en rechargeant le `.glb` : **`door_b_frozen` bbox monde
X[-12.075,-11.925] Y[10.250,11.750] Z[0,2.5]**, symétrique autour de la face
intérieure du mur (X=-12) exactement comme `door_e_exit` l'est autour de
Y=14, et centré sur la brèche Y∈[10.25,11.75] (jambages 0.25 m de chaque
côté de l'ouverture 1.5 m). `build_combined_level.py::_t_door_frame`
propage `rot_deg` tel quel (une rotation est invariante par translation
pure, aucun recalcul nécessaire) ; deux zones (B et E) posent désormais un
`door_frame`, `leaf_name` reste zone-scopé par construction
(`door_b_frozen`/`door_e_exit`), aucune collision de nom.

**`use_frozen_storage`** (`target: "door_b_frozen"`, même mécanique que
`use_exit_door`) posé côté salle principale à `(-10.75, 11.0, 1.0)`,
1.25 m du centre du vantail — vérifié réimporté : `extras.target ==
"door_b_frozen"`.

**Piège découvert et corrigé : étendre le rectangle englobant du `"floor"`
de la Zone B pour couvrir l'alcôve créait un CHEVAUCHEMENT avec le
connecteur A-B, une fois la zone fusionnée.** Premier essai : élargir
`"floor"` à `x∈[-16,12]` (au lieu de `[-12,12]`) pour que `tile_floor`
couvre l'alcôve X∈[-15,-12] sans casser le tiling 4 m — même schéma que la
vitrine/l'alcôve de sortie des Zones A/E (« le sol déborde sous les zones
hors-mur, sans conséquence »). Sauf que cette fois l'alcôve déborde à
l'OUEST du mur ouest EXISTANT (pas au nord, dans l'empreinte déjà couverte,
comme A/E) : `bake_vertex_lighting.py --save` sur `hypermarche_complet`
sortait alors **2 meshes entièrement noirs**
(`kit_floor_4x4.031`/`.204`, tous deux à la MÊME position monde
`(10.0, 2.0, 0.0)`) — auto-occultation par géométrie coïncidente, même
famille de symptôme que le `kit_crate` à tasseaux avant sa correction.
Cause : la Zone B (translatée par dx=26 dans le niveau combiné) a son
ancien bord ouest (x local -12) qui atterrit exactement sur le bord EST du
connecteur A-B (x monde 14) ; étendre le sol de la Zone B 4 m plus à l'ouest
(x local -16 → x monde 10) fait retomber une tuile de sol EXACTEMENT sur
celle du connecteur A-B (x∈[10,14], y∈[2,6]) — deux meshes coïncidents au
même endroit. Corrigé en **abandonnant l'extension du rectangle englobant**
au profit d'une dalle SUR-MESURE, nouvelle fonction `build_floor_patches`
(`build_level.py`, même rigueur que `build_vitrine` : subdivision au mètre,
UV 64 px/m, proxy cuboid, origine-surface-de-marche comme `kit_floor_4x4`),
limitée à l'empreinte réelle de l'alcôve (`level_spec.ZONE_B["floor_patches"]`,
X∈[-15,-12] Y∈[10,12]) — par construction, une dalle bornée à un besoin
précis ne peut chevaucher aucune autre géométrie du niveau, où qu'elle soit
translatée. Revérifié : `bake_vertex_lighting.py --save` sur
`hypermarche_complet` reconstruit → **0 mesh noir, 0 dégradé plat**. Nouvelle
clé `"floor_patches"` (liste) propagée par `build_combined_level.py::
_t_floor_patches`/`translate_zone`, symétrique à `_t_storage`.

**Secret 1** (`secret_1b`, `secret_id="1"`) : zone de présence dans
l'alcôve, X∈[-14.5,-12.5] Y∈[10.25,11.75] Z∈[0,1.5] (marge de 0.25-0.5 m de
chaque mur), posée via une nouvelle fonction `build_secret_zones`
(`build_level.py`, même mécanique que `build_use_objects` : un
`THREE.Mesh` réel avec `center`/`size`, `secret_id` propagé en custom
property → `extras.secret_id`).

#### Secret 2 (Zone C, toit de gondole) — caisse d'accès + zone sur le toit

Aucune géométrie neuve pour le « toit » lui-même : le dessus du collider de
la rangée ouest de gondoles (`kit_gondola_4m`, Z=2.0) est déjà marchable tel
quel. Empreinte RÉELLE de cette rangée relue directement dans
`_build_row_run`/le commentaire de `ZONE_C["gondolas"]` (pas redérivée à la
main, comme demandé) : X∈[-5.5,-4.25] (décalage -X dû à la rotation +90°,
même mécanique que Zone D). Une `kit_crate` (nouvelle entrée
`ZONE_C["storage_props"]`, réutilise `build_storage_props` tel quel — aucun
code nouveau nécessaire) posée à l'ouest de cette empreinte (couloir
latéral, pas l'allée centrale), origine `(-6.75, 7.5, 0.0)` → bbox
X[-6.75,-5.75] Y[7.5,8.5] Z[0,1.0], à 0.25 m de la face ouest de la rangée
(X=-5.5), près de son extrémité sud (Y=8, jonction avec le capuchon
`kit_gondola_end`).

**Vérification du saut, par calcul ET par bbox exportée (pas seulement
visuellement, comme demandé) :** sol → sommet caisse = 1.0 m de gain
(`jumpHeight` 1.1 m, marge 0.1 m) ; sommet caisse → toit de la gondole =
encore 1.0 m de gain (marge 0.1 m identique) ; écart horizontal caisse →
gondole = 0.25 m (bord est de la caisse à bord ouest de la rangée),
largement franchissable pendant la montée. **Le saut est géométriquement
faisable avec la seule caisse — aucun step intermédiaire (pile de palettes)
n'a été nécessaire.**

**Secret 2** (`secret_2c`, `secret_id="2"`) posé sur le dessus de la rangée,
à l'extrémité NORD (proche Y=16, à l'opposé de la caisse d'accès à Y≈8) :
centre `(-4.75, 15.5, 2.5)`, taille `(0.75, 0.75, 1.0)` → bbox
X[-5.125,-4.375] Y[15.125,15.875] Z[2.0,3.0], strictement à l'intérieur de
l'empreinte de la rangée (marge 0.125-0.375 m) et posé pile au niveau du
sol du toit (Z=2.0). Aucun `use_*` — détection par simple présence, comme
demandé.

#### Comptes exacts, avant / après (`validate_level.py`)

| Fichier | | avant | après |
|---|---|---:|---:|
| `zone_b_caisses` | Objets (meshes) | 141 (128) | 160 (147) |
| | Triangles | 7280 | 7912 |
| | Matériaux | 3 | 3 |
| | Colliders (cuboid) | 64 | 73 |
| | Spawns (joueur+Costards) | 4 | 4 (inchangé) |
| | `door_*` | 0 | 1 (`door_b_frozen`) |
| | `use_*` | 0 | 1 (`use_frozen_storage`) |
| | `secret_*` | 0 | 1 (`secret_1b`) |
| | `--strict` | CONFORME (0,0) | CONFORME (0,0) — inchangé |
| `zone_c_rayons` | Objets (meshes) | 177 (160) | 180 (163) |
| | Triangles | 10648 | 10684 |
| | Matériaux | 2 | 4 (+`mat_kit_storage` pour `kit_crate`, +`mat_kit_detail` pour `secret_2c`) |
| | Colliders (cuboid) | 80 | 81 (+`col_box_crate`) |
| | Spawns | 5 | 5 (inchangé) |
| | `secret_*` | 0 | 1 (`secret_2c`) |
| | `--strict` | CONFORME (0,0) | CONFORME (0,0) — inchangé |
| `hypermarche_complet` | Objets (meshes) | 836 (764) | 860 (788) |
| | Triangles | 46372 | 47096 |
| | Matériaux | 4 | 4 (inchangé) |
| | Colliders | cuboid:380 convexHull:2 | cuboid:390 convexHull:2 |
| | Spawns | 15 | 15 (inchangé) |
| | `door_*` | 1 (`door_e_exit`) | 2 (+`door_b_frozen`) |
| | `use_*` | 3 | 4 (+`use_frozen_storage`) |
| | `secret_*` | 0 | 2 (`secret_1b`, `secret_2c`) |
| | Warnings (sans `--strict`) | 12 | 12 — **exactement les mêmes** (8 palettes + crowbar + shotgun), aucun nouveau |
| | `--strict` | ECHEC (0 erreur, 12 warn) | ECHEC (0 erreur, 12 warn) — inchangé |

Bake (`bake_vertex_lighting.py --save`) sur les trois fichiers : **0 mesh
noir, 0 dégradé plat** (après correction du piège de chevauchement
ci-dessus — voir la mesure « 2 meshes noirs » avant correction). Combiné :
394 meshes (+10 sur 384), luminance moyenne globale 0.223.

Export (`export_level.py`) : `public/assets/levels/zone_b_caisses.glb`
(347 Ko), `zone_c_rayons.glb` (459 Ko), `hypermarche_complet.glb`
(2038 Ko). Les trois rechargés indépendamment dans Blender
(`import_scene.gltf`) pour vérification bit à bit des bounding box citées
ci-dessus (pas seulement sur le `.blend` source) : `door_b_frozen`,
`use_frozen_storage`, `secret_1b`, `floor_secret_1b`, `secret_2c`,
`kit_crate`/`col_box_crate` tous confirmés à leur position/`extras` exacts,
y compris après translation dans `hypermarche_complet.glb`
(`secret_1b` → `(12.5, 11.0, 0.75)` = `(-13.5+26, 11.0, 0.75)` ;
`secret_2c` → `(21.25, 43.5, 2.5)` = `(-4.75+26, 15.5+28, 2.5)` — dx/dy de
Zone B et C inchangés, appliqués automatiquement par `translate_zone` sans
aucun ajustement manuel de coordonnée, comme voulu).

#### Objets créés (noms exacts)

`door_b_frozen` (vantail), `use_frozen_storage` (`target:
"door_b_frozen"`), `secret_1b` (`secret_id: "1"`), `floor_secret_1b` +
`col_box_floor_secret_1b` (dalle sur-mesure de l'alcôve) — Zone B.
`secret_2c` (`secret_id: "2"`) — Zone C, plus une `kit_crate`/`col_box_crate`
supplémentaire (pas de nom custom, pièce de kit standard).

### Micro d'annonces + toilettes (2026-08-24)

Deux objets interactifs "signature Duke" du plan (PAS des secrets, aucune
géométrie neuve de kit nécessaire — `build_use_objects` gère déjà n'importe
quel `use_*` autoportant depuis `center`/`size`, exactement comme
`use_crowbar`/`use_shotgun`). Fait directement (pas de délégation
`level-forge` : ajout mécanique de deux entrées `use_objects` dans
`level_spec.py`, aucune fonction `build_level.py` neuve).

`use_pa_mic` (Zone C, zone dégagée nord du bloc de gondoles, X=0.0/Y=24.0,
à l'écart de `spawn_suit_3`/`spawn_suit_4` à Y=21) : `center=(0.0, 24.0, 0.5)`,
`size=(0.15, 0.15, 1.0)`. `use_toilet` (Zone D, coin sud-est dégagé,
X=12.0/Y=2.0, au sud des rangées) : `center=(12.0, 2.0, 0.25)`,
`size=(0.5, 0.5, 0.5)`.

**Piège de grille rencontré et corrigé avant le premier export propre** :
un centre Z = moitié de la hauteur choisie initialement (0.6 pour le micro,
0.2 pour les toilettes) n'était PAS un multiple de 0.25 m — `validate_level.py`
l'a signalé (`hors grille 0.25 m`) dès la première passe. Corrigé en
choisissant des hauteurs dont la moitié tombe sur la grille (1.0 m → centre
0.5 ; 0.5 m → centre 0.25), pas en ignorant l'avertissement.

Rebuild complet des trois fichiers concernés (`zone_c_rayons`,
`zone_d_reserve`, `hypermarche_complet`) : `use_*` Zone C 0→1, Zone D 0→1,
niveau combiné 4→6. Bake : 0 mesh noir sur les trois. `validate_level.py --strict`
sur `zone_c_rayons`/`zone_d_reserve` : seul le warning attendu "sans
`target`" (même classe que crowbar/shotgun) — Zone D reste non-strict
(warnings de palettes déjà connus, inchangés à 8). Niveau combiné (sans
`--strict`, comme d'habitude) : 12→14 warnings, les 2 nouveaux étant
exactement les "sans `target`" attendus pour `use_pa_mic`/`use_toilet`,
aucun autre nouveau. Vérifié en jeu (`cassandre.level.stats()`) sur les
trois fichiers : comptes `useCount` exacts.
