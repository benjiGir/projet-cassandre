# Outils Blender — PROJET_CASSANDRE

Scripts headless. Aucun ne nécessite d'interface.

| Script | Usage |
|---|---|
| `kit_spec.py` | **données** du kit modulaire (pièces, dimensions, proxies) — pas exécutable seul |
| `level_spec.py` | **données** des niveaux Zone A / Zone B / Zone C / Zone D / Zone E (murs, sol, spawns, vitrine, caisses, gondoles, racks, mezzanine, porte) — pas exécutable seul |
| `geo_utils.py` | fonctions bpy partagées (boîtes subdivisées, proxies, scène) — importé par `build_kit.py` ET `build_level.py`, pas exécutable seul |
| `build_kit.py` | génère `kit_hypermarche.blend` à partir de `kit_spec.py` |
| `build_level.py` | assemble un niveau (`zone_a_parking.blend` / `zone_b_caisses.blend` / ... / `zone_e_bureau.blend`) à partir du kit + `level_spec.py` |
| `inspect_kit.py` | vérifie le kit produit contre le contrat du projet |
| `bake_vertex_lighting.py` | bake d'éclairage en vertex colors + rapport de plausibilité |
| `validate_level.py` | vérifie un `.blend` de niveau contre le contrat du projet |
| `export_level.py` | valide puis exporte en `.glb` avec les bons réglages |

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

**Observation, hors scope de cette tâche (notée, pas traitée)** : `export_level.py`
documente en tête « Valide d'abord, exporte ensuite » mais son code
n'appelle en réalité jamais `validate_level.py` — l'export se lance
directement. Sans conséquence ici puisque la chaîne documentée exécute
`validate_level.py` en étape séparée avant `export_level.py`, mais l'écart
entre la docstring et le code existe déjà pour Zone A/B, pas introduit par
Zone C.

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

**Rappel de scope, à ne pas perdre de vue** : ce qui suit N'EST PAS fait et
reste dans le périmètre d'une tâche dédiée séparée, comparable en ampleur à
la Phase 3 (l'ennemi Costard) — (1) le directeur comme vrai boss (nouveau
type d'entité, peau qui se déchire pour révéler un reptilien), (2) le badge
à ramasser, (3) la porte de sortie verrouillée par ce badge (remplacerait
`kit_door_2m` par un vrai `door_*`/`kit_door_leaf` + logique de
verrouillage). Le Costard placeholder posé ici (`spawn_suit_1`) n'a aucune
des propriétés du directeur — c'est un ennemi standard, identique à ceux
des zones A-D.
