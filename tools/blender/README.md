# Outils Blender — PROJET_CASSANDRE

Scripts headless. Aucun ne nécessite d'interface.

| Script | Usage |
|---|---|
| `kit_spec.py` | **données** du kit modulaire (pièces, dimensions, proxies) — pas exécutable seul |
| `level_spec.py` | **données** des niveaux Zone A / Zone B (murs, sol, spawns, vitrine, caisses) — pas exécutable seul |
| `geo_utils.py` | fonctions bpy partagées (boîtes subdivisées, proxies, scène) — importé par `build_kit.py` ET `build_level.py`, pas exécutable seul |
| `build_kit.py` | génère `kit_hypermarche.blend` à partir de `kit_spec.py` |
| `build_level.py` | assemble un niveau (`zone_a_parking.blend` / `zone_b_caisses.blend`) à partir du kit + `level_spec.py` |
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
