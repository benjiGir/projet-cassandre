# PLAN — Niveau v2 : l'hypermarché repensé (`PROJET_CASSANDRE`)

> Chantier de contenu et de pipeline d'assets. La passe du 2026-09-10 (poser les 9 pièces du kit jamais utilisées, via `level-forge` en scripts headless) a été jugée insuffisante après avoir joué : « je vois pas trop de différence ». Diagnostic : une consigne formulée comme une liste de trous à combler produit des trous comblés, pas un décor enrichi ; et un kit d'une vingtaine de pièces génériques, sans texture, plafonne quoi qu'on en fasse. Ce chantier change trois choses à la fois : **la structure du niveau** (un hub à la Duke 3D au lieu d'un couloir A→E), **la source des assets** (packs CC0 harmonisés, textures rétro réintroduites) et **la méthode** (travail en direct dans Blender via MCP, avec une capture à chaque étape, au lieu de scripts dont on regarde le rendu après coup).

---

## 0. Cadrage

### Décisions actées (échanges du 2026-09-10 et du 2026-09-11)

| Question | Décision |
|---|---|
| Thème | Toujours l'hypermarché. Le nouveau niveau **remplace** `hypermarche_complet` à la fin du chantier ; le proto reste à un seul niveau |
| Époque, ambiance | Hypermarché de province d'aujourd'hui, **resté dans son jus années 90** : carrelage, néons, PLV défraîchie |
| Style visuel | **Build / Ion Fury** : textures pixel art 64-128 px, contrastées, un peu crasseuses, signalétique criarde |
| Textures | **Réintroduites**, ce qui revient sur le choix « vertex colors seuls » du 2026-09-10. L'éclairage reste baké en vertex colors ([ADR 0005](docs/decisions/0005-eclairage-vertex-colors.md)) ; la texture porte l'albedo |
| Source des assets | **Packs CC0 harmonisés uniquement.** Pas de génération 3D par IA. Claude harmonise, assemble et dispose ; il ne modélise pas de props de zéro, hors blockout gris et pièces de structure du kit existant. **Exception actée le 2026-09-11** : les objets sans équivalent CC0 (photomaton, lecteur de carte de fidélité, comptoir de self) sont montés simplement en direct, en volumes simples et textures maison — l'approche Build. La machine à pinces, d'abord sur cette liste, est couverte par le pack CC0 Token Gesture (voir N2) |
| Emballages | **Marques inventées**, textures générées par script dès le pilote. Jamais de pastiche d'une vraie marque : règle de satire du projet, organisations fictives uniquement |
| Méthode | Travail **en direct dans Blender** via le MCP officiel Blender Lab, avec capture et correction à chaque étape. Les scripts headless restent pour valider, baker et exporter |
| MCP | Officiel uniquement (`lab_blender_org/mcp`, Blender 5.1+, `localhost:9876`). Les packs sont téléchargés à la main, chacun validé avant par l'utilisateur (nom, source, taille, licence) |
| Structure | **Hub + départements, clés à la Duke 3D.** L'allée centrale sert de hub |
| Espaces | 10 : parking extérieur, galerie marchande, cafétéria, caisses, allée centrale (hub), rayons, électroménager / TV, réserve / quai, parking souterrain, bureaux direction |
| Clés | **Cartes de fidélité** : Argent (dans les rayons, ouvre la réserve), Or (dans l'électroménager, ouvre les bureaux), Platine (lâchée par le Directeur, ouvre la sortie ; remplace le badge actuel) |
| Fin | Porte derrière le boss. Le déclencheur de fin actuel (franchissement de `door_e_exit`) est conservé |
| Secrets | 3 : arrière-boutique du photomaton (galerie), toit des gondoles (rayons), bouche d'aération (cafétéria) |
| Durée | 8-10 minutes, comme la définition de « terminé » du plan d'origine. Plus dense, pas plus long |
| Ordre | **Deux pistes en parallèle** : A (structure → blockout gris joué) et B (salle d'essai de richesse) |
| Pilote de richesse | Une salle d'essai « rayons » indépendante du plan final ; ses assets rejoignent la bibliothèque |
| Passe du 2026-09-10 | Conservée : pièces du kit posées, 4 correctifs de bake, `tools/blender/render_preview.py`, nouvelle pièce `kit_cart_shelter` |
| Matériel cible | Portable à GPU intégré, ce qui fixe un budget de draw calls prudent |

### Structure retenue

```
 Parking extérieur ──► Galerie marchande ──► Cafétéria
 (spawn, pied-de-biche)  (pinces, photomaton)   (optionnelle, toilettes, secret)
                                │
                                ▼
                            Caisses (1er combat, fusil à pompe)
                                │
                                ▼
 Rayons ◄──────────── Allée centrale (hub, micro) ────────────► Électroménager / TV
 (carte Argent, surgelés, secret)                                (carte Or, mur d'écrans)
   │                            ▲
   ▼                            ┆ raccourci à sens unique
 [Argent] Réserve / quai        ┆
   │                            ┆
   ▼                            ┆
 Parking souterrain ┄┄┄┄┄┄┄┄┄┄┄┄┘
   │
   ▼
 [Or] Bureaux direction (Directeur) ──► [Platine] Sortie
```

L'entrée est linéaire (tutoriel implicite). À partir de l'allée centrale, le joueur choisit l'ordre entre les rayons et l'électroménager, donc entre les cartes Argent et Or. Le raccourci à sens unique évite de refaire tout le chemin si le joueur arrive devant la porte des bureaux sans la carte Or.

### Budget de temps

| Espace | Rôle | Durée |
|---|---|---|
| Parking extérieur | tutoriel, pied-de-biche | 0:45 |
| Galerie marchande | transit, gags, secret | 1:00 |
| Caisses | premier combat, fusil à pompe | 1:00 |
| Allée centrale + rayons | combat en couloirs, carte Argent | 2:00 |
| Électroménager / TV | carte Or, écrans | 1:00 |
| Cafétéria | optionnelle, soin | 0:30 |
| Réserve / quai | verticalité, gros combat | 1:15 |
| Parking souterrain | tension, embuscade entre les piliers | 1:00 |
| Bureaux direction | Directeur, sortie | 1:00 |
| **Total** | | **≈ 9:30** |

### Emplacement des objets « signature Duke » du plan d'origine

Ce chantier réserve leur **emplacement** et pose leur géométrie. Leurs **systèmes** (bris de verre, rendu dans une texture, mécanique de pince) restent des tâches séparées, dans le reliquat de la Phase 5 (voir hors scope).

| Objet | Espace |
|---|---|
| Machine à pinces (secret dérisoire) | Galerie marchande |
| Toilettes (+1 PV) | Cafétéria |
| Micro d'annonces | Allée centrale |
| Rayon surgelés qui explose | Rayons |
| Écrans de surveillance | Mur de télés de l'électroménager (montre d'autres salles, dont le bureau du Directeur) |
| Caddies (décor statique) | Parking extérieur, caisses |

### Registre de risques assumés explicitement

1. **Styles hétérogènes des packs CC0.** Kenney et Quaternius sont propres et arrondis, loin du style Build crasseux. L'harmonisation (retexture, palette, proxies) peut coûter plus que prévu. Si un pack résiste, on l'écarte plutôt que de forcer.
2. **Couverture CC0 incomplète.** Certains objets propres au jeu (machine à pinces, mur de télés, lecteur de carte de fidélité, enseigne) peuvent n'exister dans aucun pack. Décision au cas par cas avec l'utilisateur ; pas de modélisation de zéro par défaut. *Tranché le 2026-09-11 pour la première liste : voir l'exception au §0 et la carte de couverture de N2.*
3. **Un seul sol praticable par colonne.** Le pathfinding est un graphe 2.5D avec une seule hauteur de sol par cellule (`groundY` dans `src/game/level/pathfinding.ts`, échantillonné par un rayon vertical descendant). Deux espaces praticables superposés en vue de dessus ne peuvent pas être représentés : les ennemis du niveau inférieur n'auraient aucun chemin. **Contrainte de level design dure** : l'emprise au sol du parking souterrain (et de tout étage de bureaux) ne doit recouvrir, en vue de dessus, celle d'**aucun** autre espace praticable — ni la surface de vente, ni le parking extérieur, qui est lui aussi praticable. Il faut le décaler hors de ces emprises, sous une zone qui n'a **aucun collider** au-dessus (par exemple l'arrière du bâtiment, hors d'atteinte du joueur), en y descendant par une rampe ; son propre plafond n'a pas de collider, comme tout plafond (voir N5). Un pathfinding multicouche serait un chantier à part.
4. **Occlusion des lignes de vue non fiable** ([ADR 0022](docs/decisions/0022-occlusion-rangees-non-bloquante.md), cause inconnue). La nouvelle structure repose sur la couverture (allées transversales, piliers du parking souterrain). Le jalon N5 doit lever ce risque avant tout placement d'ennemis derrière un obstacle. *Piste sérieuse depuis le 2026-09-11 : les colliders neufs sont invisibles aux rayons avant le premier pas de physique (voir N5).*
5. **Draw calls.** Le loader n'a aucune instanciation, et le niveau combiné compte déjà environ 615 meshes de décor. Une bibliothèque 5 à 10 fois plus fournie impose le jalon N1 avant toute densification. *Levé le 2026-09-11 : fusion au chargement, 513 → 25 draw calls (N1, ADR 0023).*
6. **Conflit instanciation / bake.** Chaque objet rendu porte aujourd'hui sa propre géométrie pour recevoir son propre bake (piège documenté dans `tools/blender/build_level.py` et `docs/pipeline/niveau-blender.md`), ce qui empêche l'instanciation GPU telle quelle. N1 tranche. *Tranché le 2026-09-11 : la fusion garde un bake par objet, l'instanciation n'est pas utilisée (ADR 0023).*
7. **Moins de reproductibilité.** Travailler en direct fait des `.blend` versionnés la source de vérité des assets ; on perd le « tout se reconstruit depuis un script » du kit actuel. Mitigation : commits fréquents, scripts de validation conservés, décisions consignées ici.
8. **Sécurité du MCP.** Il exécute du Python sans garde-fou dans Blender. Uniquement sur des fichiers versionnés, sauvegarde avant chaque session.
9. **Dix espaces en 8-10 minutes.** Risque de niveau trop long ou trop dilué. Le garde-fou est le blockout joué et chronométré (N8), pas la théorie.
10. **Vérification en jeu limitée par l'automatisation navigateur** (boucle à pas fixe gelée quand `visibilityState` vaut `hidden`, déjà documenté dans `CLAUDE.md`). Le jugement final passe par l'utilisateur qui joue.

### Hors scope (explicitement)

Nouveaux types d'ennemis · physique dynamique des caddies (décor statique) · génération 3D par IA · pathfinding multicouche (sauf décision contraire, voir risque 3) · systèmes des objets signature (bris de verre, écrans en render-to-texture, mécanique de la machine à pinces) · voix réelles · refonte du rendu (sprites 8 directions, post-traitement) · changement d'un invariant de `CLAUDE.md`.

---

## 1. Principes transverses (valables sur TOUS les jalons)

1. **Voir avant de livrer.** Toute étape dans Blender suit la boucle capture → critique → correction (skill `visual-critique-loop`). Quand un board existe, on compare côte à côte en rouvrant les références à chaque itération, pas seulement son propre rendu précédent (skill `reference-driven-authoring`). Une étape n'est finie qu'après une capture effectivement regardée.
2. **Blender ouvert, connexion vérifiée, sauvegarde faite** avant chaque session : `get_blendfile_summary_path_info` répond, le fichier ouvert est versionné et sauvegardé. Commits fréquents.
3. **Tester en jeu tôt.** Exporter un module avant d'en finir dix. La vue Blender ne suffit pas : le loader, la conversion Lambert, le `NearestFilter` et le nombre de draw calls ne se voient qu'en jeu.
4. **Invariants de `CLAUDE.md` inchangés**, en particulier #4 (`NearestFilter`, pas de mipmaps), #5 (`MeshLambertMaterial` uniquement), #2 (HUD à 10 Hz max) et #11-13 (Effect synchrone, RNG déterministe, XState sans temps mural) pour tout code de jeu touché.
5. **Densité de texels constante : 64 px/m**, textures 128×128 maximum, palette commune (skill `retro-texture-density`). Le matériau damier `mat_kit_checker` du kit sert de contrôle.
6. **Budgets de triangles** (skill `prop-silhouette-design`) : pièce de kit 50-300, prop courant 100-500, prop signature 500-2 000, niveau entier < 200 000. Budget de draw calls fixé au jalon N1, sur mesure.
7. **Licences tracées.** Chaque asset importé a son entrée au registre : source, auteur, licence, date, modifications. CC0 uniquement.
8. **Satire.** Marques et organisations inventées, jamais une vraie marque ni une vraie personne.
9. **Le jeu actuel reste jouable.** Le nouveau niveau vit à côté (entrée dédiée dans `src/game/level/levels.ts`, menu dev) jusqu'à sa validation. `hypermarche_complet` n'est remplacé qu'au jalon N10.
10. **Conventions glTF stables.** `col_*`, `spawn_*`, `trig_*`, `door_*`, `use_*`, `secret_*` ne changent pas. Toute nouvelle convention (cartes de fidélité) est ajoutée explicitement au tableau de `CLAUDE.md` et à `docs/`, jamais implicitement.
11. **L'humain juge le fun et le goût.** Chaque piste se termine par une session de jeu de l'utilisateur ; aucun jalon « gate » ne se valide sans elle.

---

## 2. Jalon N0 — Mise en place (commun aux deux pistes)

> **✅ Livré (2026-09-11).** Passe du 2026-09-10 committée (`8eefdf7`), plan committé (`5e354b8`). Connexion MCP vérifiée sur Blender 5.1.2. Le travail en direct reste en session principale (option par défaut de l'action 3, `level-forge` inchangé).
>
> **Écart avec l'action 4 :** la bibliothèque vit dans son propre dossier, `assets_src/library/lib_hypermarche_v2.blend`, et non dans `assets_src/blender/`. Blender range les catégories de l'Asset Browser dans un fichier `blender_assets.cats.txt` placé à côté du `.blend` ; dans `assets_src/blender/`, ce fichier aurait couvert aussi le kit et les zones. Les six catégories (`assets_src/library/blender_assets.cats.txt`) sont vérifiées dans l'Asset Browser. La bibliothèque contient les collections `_REF` (repère humain de 1,8 m, exclu du rendu), `_RAW` (imports bruts) et `LIB` avec une sous-collection par catégorie ; unités en mètres, snap sur la grille absolue, grille du viewport à 0,25 m. `assets_src/cc0_raw/` est gitignoré, `assets_src/LICENCES_ASSETS.md` créé (vide). `assets_src/textures/` et `tools/textures/` seront créés en N3 avec leur premier contenu. La bibliothèque n'est pas enregistrée dans les préférences Blender de l'utilisateur ; elle s'utilise comme « Fichier courant » quand elle est ouverte.
>
> **Board complété** avec 5 sujets (`hypermarche_90s`, `galerie_marchande`, `cafeteria`, `electromenager_tv`, `parking_souterrain`), hors-sujet retiré après une planche contact. Fiche de spec versionnée dans `docs/assets/board-hypermarche.md` (liée depuis `docs/README.md`) ; `refs/SPEC.md` n'est plus qu'un renvoi. **Manques relevés** : Commons ne fournit presque rien sur les hypermarchés français des années 90 (seul le parking souterrain a le bon « jus »), l'électroménager (2 images) et la galerie (3 images) sont sous le seuil de 5 images, et le board n'a aucune référence de style Build / Ion Fury. À compléter par l'utilisateur si possible avant N3.

**Objectif.** Poser l'environnement de travail et les dossiers, sans produire de contenu.

**Actions.**
1. Committer la passe du 2026-09-10 (sur demande explicite de l'utilisateur) pour repartir d'un arbre propre.
2. Blender 5.1 ouvert, add-on MCP activé, serveur démarré ; `get_blendfile_summary_path_info` répond.
3. Trancher qui pilote le MCP. `level-forge` n'a pas les outils MCP (`tools: Read, Write, Edit, Bash, Glob, Grep` dans `.claude/agents/level-forge.md`). Soit le travail en direct se fait en session principale (défaut), soit on ajoute les outils `mcp__Blender__*` à l'agent.
4. Arborescence :
   - `assets_src/library/lib_hypermarche_v2.blend` : bibliothèque versionnée, rangée dans l'Asset Browser en catalogues Structure, Mobilier de vente, Produits, Signalétique, Déco, Gameplay ;
   - `assets_src/cc0_raw/<pack>/` : packs téléchargés tels quels, **gitignorés** (retéléchargeables, source au registre) ;
   - `assets_src/textures/` : textures finales 128×128 et `palette.png`, versionnées ;
   - `assets_src/LICENCES_ASSETS.md` : registre des licences, versionné ;
   - `tools/textures/` : scripts de quantification et de génération d'étiquettes.
5. Compléter le board `refs/` (local, gitignoré) avec un dossier `hypermarche_90s/` : hypermarchés français des années 90, signalétique, carrelage, PLV, galerie marchande, cafétéria. Même méthode que le board initial (images libres, Wikimedia Commons). Relancer `tools/refs/extract_palette.py` (dépendances dans `.venv-refs/`) et mettre à jour `refs/SPEC.md`.
6. Versionner la fiche de spec, qui est du texte dérivé sans image, par exemple sous `docs/assets/board-hypermarche.md`. Les images restent locales.

**Critères d'acceptation.** Connexion MCP vérifiée ; arborescence et registre créés ; `.gitignore` à jour ; board complété, fiche de spec versionnée.

---

## 3. Jalon N1 — Prérequis rendu (piste B, bloquant pour toute densification)

> **✅ Livré (2026-09-11)**, fait directement en session principale (pas d'agent), après N2 et N3.
>
> **Compteur** : `drawCalls` / `triangles` ajoutés à `DebugState` (lus sur `renderer.info.render`, dans le bloc throttlé à 10 Hz de `updateFx.ts`) et affichés par `DebugPanel`. Juste parce que le jeu fait une seule passe WebGL par image (`main.ts`) — voir `docs/systems/debug.md#coût-de-rendu`.
>
> **Référence mesurée** au point de départ de `hypermarche_complet` : 513 draw calls, 46 746 triangles, 1,40 ms de rendu CPU. Cause : un draw call par mesh de décor (615), et `toLambert` crée un matériau par mesh.
>
> **Décision** : fusion du décor statique au chargement plutôt qu'instanciation GPU ([ADR 0023](docs/decisions/0023-fusion-decor-au-chargement.md)). `game/level/mergeStaticDecor.ts` regroupe par contenu de matériau et par jeu d'attributs ; chaque objet garde ses sommets, donc son bake — le conflit instanciation / bake (risque 6) ne se pose plus. Portes, objets interactifs, cibles d'animation, meshes multi-matériaux et à échelle négative restent individuels. **Mesuré après** : 615 meshes → 5 lots, **25 draw calls**, 0,70 ms de rendu, statistiques du niveau identiques (plus un champ `decorBatchCount`). **Budget du niveau v2 : 200 draw calls au plus par image**, 200 000 triangles. Les FPS n'ont pas pu être comparés : le panneau du navigateur de l'automatisation était masqué et bride l'affichage (même une boucle `requestAnimationFrame` vide tombe à 2 images/s) ; à constater en jouant. 3 tests Vitest ajoutés (`test/game/level/mergeStaticDecor.test.ts`), 119/119 verts, build propre.
>
> **Bake lumière seule validé** sur une scène d'essai texturée : en `combined` une caisse rouge enregistre du rouge (0,50 / 0,15 / 0,15), que le jeu multiplierait une seconde fois par sa texture ; en `diffuse`, une lumière neutre (0,55 / 0,53 / 0,51). `--type diffuse` devient la règle du niveau v2 (`docs/pipeline/niveau-blender.md#combined-vs-diffuse`). Les valeurs sont plus claires qu'en `combined` (0,83 contre 0,57 sur le sol) : puissance des lampes à recalibrer en N4.
>
> **Pas fait, et inutile à ce stade** : l'instanciation GPU (voir l'ADR pour le signal qui la rendrait nécessaire) et la scène de test synthétique de plusieurs centaines d'objets — remplacée par la mesure sur le vrai niveau (615 meshes bakés) et un test unitaire à texture partagée.

**Objectif.** Que le moteur encaisse un décor 5 à 10 fois plus dense, et que texture et lumière bakée se combinent correctement.

**Recherche requise.** Skills `threejs-rapier-fieldguide` (budget de draw calls), `retro-texture-density` (atlas ou array texture, combinaison avec `BatchedMesh`), `vertex-color-sector-lighting`. Documentation three.js de `BatchedMesh`, `InstancedMesh` et du support `EXT_mesh_gpu_instancing` dans `GLTFLoader`.

**Conception.**
- **Mesure d'abord.** Compteur de draw calls et de triangles dans `DebugPanel` (`renderer.info.render`), lu à 10 Hz maximum (invariant #2). Mesure de référence sur `hypermarche_complet` avant tout changement.
- **Trancher le conflit instanciation / bake** (risque 6). Proposition, à confirmer par la mesure :
  - structure et gros props : géométries uniques (bake par objet) **fusionnées au chargement** par matériau/texture (`BatchedMesh` ou fusion de géométries), ce qui garde l'éclairage par sommet et divise les draw calls ;
  - petits props produits en masse (contenu des rayons) : **instanciation GPU** (`EXT_mesh_gpu_instancing` → `InstancedMesh`), avec un éclairage approximé par une teinte par instance (`instanceColor`) échantillonnée au bake à la position de l'instance.
  La décision finale fait l'objet d'un ADR.
- **Bake lumière seule.** `tools/blender/bake_vertex_lighting.py --type diffuse` existe déjà (passes directe et indirecte, sans la couleur). Valider son résultat sur des objets texturés : côté three.js, texture × vertex color est déjà géré par `toLambert` dans `src/game/level/loader.ts`. En faire le défaut pour le niveau v2 ; `--type combined` reste celui du niveau actuel.

**Critères d'acceptation.** Compteur visible en jeu ; scène de test (quelques centaines d'objets texturés et bakés) chargée avec un nombre de draw calls mesuré et consigné ; budget de draw calls fixé pour le matériel cible ; aucune régression sur `hypermarche_complet` (mêmes comptes `cassandre.level.stats()`) ; `pnpm build` et `pnpm test` verts ; ADR écrit.

---

## 4. Jalon N2 — Sourcing CC0 et registre des licences (piste B)

> **🔶 En cours (2026-09-11).** Liste validée par l'utilisateur. Pilote : pack épicerie SideQuest, Supermarket de PensamientoAzul, Kenney Food Kit ; textures : ambientCG et Aquilarius. Les packs des autres espaces sont récupérés **tout de suite** (choix de l'utilisateur, pour avoir une vue d'ensemble), pas au moment de l'habillage. Quaternius Ultimate Food n'a pas été retenu.
>
> **Téléchargé par Claude et inscrit au registre** : Kenney Food Kit, Furniture Kit, Retro Urban Kit, Car Kit (licence CC0 confirmée aussi par le `License.txt` de chaque archive) ; 17 matériaux ambientCG, dont seules les cartes de couleur sont conservées. Constats : le Furniture Kit contient une télé à tube (`televisionVintage`), ce qui couvre le mur de télés ; le Retro Urban Kit est le seul pack en vraies textures pixel, les autres sont en couleurs unies ou en atlas de dégradés.
>
> **À télécharger par l'utilisateur** : tout ce qui est hébergé sur itch.io, dont la page affiche une vérification anti-robot que Claude ne contourne pas (y compris les téléchargements Quaternius, qui passent par itch.io). La licence de ces packs vient des résultats de recherche : elle doit être confirmée sur la page au moment du téléchargement, en ne prenant que la version gratuite CC0.
>
> **Déposé par l'utilisateur et inscrit au registre** (archives rangées dans `assets_src/cc0_raw/_archives/`) : KayKit City Builder, Furniture et Restaurant Bits, Quaternius House Interior et Cars, Supermarket de PensamientoAzul, Aquilarius Retro Textures, et trois objets de Retro3DGraphicsCollection (chariot élévateur, voiture PS1 GGBot, bureau valsekamerplant). **Trouvaille hors liste** : Token Gesture — Retro Arcade Props (base pack, CC0 par `LICENSE.txt` inclus) : 17 props d'arcade dont une machine à pinces (2 810 triangles, à décimer sous le budget signature de 2 000), un mur de lots, un changeur de jetons. **Quatre packs sans fichier de licence** (GGBot, valsekamerplant, PensamientoAzul, Aquilarius) restent « à confirmer » au registre et ne s'utilisent pas en jeu avant confirmation. **Pas déposés** : l'épicerie SideQuest, introuvable pour l'utilisateur (le pilote s'en passe : étagères PensamientoAzul et produits Kenney), les fûts PS1 (xiiixvv) et la tuyauterie (chilly-durango).
>
> **Carte de couverture** : le mur de télés est couvert (Kenney `televisionVintage`), la machine à pinces aussi (Token Gesture). Restent sans équivalent CC0 le photomaton, le lecteur de carte de fidélité et le comptoir de self : exception de modélisation simple actée (voir §0). Enseignes et signalétique sont produites en textures maison (N3).

**Objectif.** Une liste de packs validée, qui couvre les besoins des 10 espaces.

**Actions.**
1. Inventaire des besoins par espace, à partir de la structure et du board : mobilier de vente, produits, signalétique, véhicules, mobilier de bureau, cafétéria, électroménager, déco murale, textures.
2. Liste de candidats avec, pour chacun : nom, auteur, URL, licence **lue sur la page**, taille, nombre d'assets, style, formats. Candidats de départ, non vérifiés : Kenney (Food Kit, Furniture Kit, Retro Urban Kit, Car Kit), KayKit, Quaternius, pack épicerie de The SideQuest Shop, Retro3DGraphicsCollection (sélection PS1 en CC0). Textures : Aquilarius Retro Textures, OpenGameArt (CC0), ambientCG, Poly Haven.
3. **Validation de l'utilisateur avant tout téléchargement.**
4. Téléchargement dans `assets_src/cc0_raw/`, une entrée au registre par pack.
5. Carte de couverture : les besoins qui restent sans asset CC0 (risque 2), soumis à l'utilisateur pour décision.

**Critères d'acceptation.** Registre à jour ; aucune licence autre que CC0 ; carte de couverture écrite et arbitrée.

---

## 5. Jalon N3 — Charte visuelle : palette, textures, règles d'harmonisation (piste B)

> **✅ Livré (2026-09-11).** ImageMagick n'est pas installé : tout passe par Pillow (`.venv-refs/`), dans `tools/textures/`.
>
> **Palette** (`build_palette.py`) : 56 couleurs par k-means en Lab sur le board, les matériaux ambientCG et les atlas des packs, à poids égal, plus 8 accents de signalétique. Écart moyen de quantification (ΔE) : 3,1 sur les matériaux, 6,1 sur les atlas, 6,8 sur le board.
>
> **16 textures de base** (`make_textures.py`) : carrelage blanc, damier, deux terrazzos, béton lisse et brut, asphalte, moquette, plâtre propre et usé, dalles de plafond, bac acier, tôle perforée, métal peint rouge, carton, bandes de danger. **Constat** : chez ambientCG, nervures, trous et losanges sont dans la carte de relief, perdue en Lambert ; ils sont repeints par programme dans la couleur, avec une période qui divise 128. La tôle striée et les dalles à grille ont été retirées (illisibles), remplacées par des bandes de danger générées.
>
> **Contrôle en 3D** : salle d'essai jetable dans Blender via MCP, UV à 64 px/m, rendu Workbench à 640×360 depuis 1,6 m, en éclairage studio puis plat. Échelle et lisibilité validées (carreaux de 50 cm, motifs nets) ; le rendu reste plus « photo réduite PS1 » que pixel art Ion Fury, à juger en jouant N4.
>
> **Fiche d'harmonisation** écrite : [docs/pipeline/harmonisation-assets.md](docs/pipeline/harmonisation-assets.md) (textures, étapes d'import, nommage `str_` / `mob_` / `prd_` / `sig_` / `deco_` / `gp_`).
>
> **Étiquettes** (`generate_labels.py`) : atlas de 16 faces de 32×32 — les 13 marques inventées validées par l'utilisateur (Pyramides, Traînées Blanches, Eau Plate de la Terre Plate, 5G Cola, Raviolis du Bunker, ALU-PROTECT, Sablés Reptiliens, Café Réveillé, Illumi, Profonde, Coquillettes du Nouvel Ordre, Sans-Fluor, Lune Truquée) et trois pastilles génériques. Police pixel 3×5 codée à la main ; exception de densité assumée (environ 100 px/m sur les produits, sinon aucun nom ne se lirait). **Trim sheet** (`generate_trims.py`) : 8 bandes répétables (tranche d'étagère avec prix, plinthe, bandeau « HYPER », bord de quai, grille, néon, cornière, joint). Les deux vérifiées en 3D à 640×360 : noms et pictos lisibles à 1,5 m, tranche d'étagère immédiatement identifiable. Le bandeau porte « HYPER » en attendant un nom d'enseigne pour le magasin.

**Objectif.** Que tout ce qui entre dans la bibliothèque parle la même langue visuelle.

**Actions.**
1. **Palette commune de 64 couleurs**, dérivée du board (`refs/*/palette.json`) et du style Build, dans `assets_src/textures/palette.png`.
2. **Textures de base** 128×128 à 64 px/m : sols (carrelage, béton, asphalte), murs (faïence, parpaing, placo), plafonds (dalles, bac acier), et une trim sheet (plinthes, bandeaux, tranches d'étagère). Sources : packs CC0 retravaillés, quantifiés sur la palette sans dithering (`magick … -remap palette.png`, voir `retro-texture-density`).
3. **Fiche d'harmonisation écrite**, appliquée à chaque asset importé : échelle vérifiée contre un repère de 1,8 m, origine au coin au sol, matériau Lambert, UV à 64 px/m, texture ramenée à 128 px sur la palette, budget de triangles, proxy de collision cuboid par défaut (skill `collision-proxy-authoring`), nommage.
4. **Générateur d'étiquettes de marques inventées** (`tools/textures/`) : nom de marque, aplats, pictos simples, en 64×64 ou 128×64, sortie quantifiée sur la palette. La liste des marques est validée par l'utilisateur (ton satirique, marques fictives).

**Critères d'acceptation.** Palette et textures de base versionnées ; densité confirmée au damier sur un échantillon ; au moins 10 étiquettes générées et lisibles à 640×360 (capture en jeu) ; fiche d'harmonisation écrite.

---

## 6. Jalon N4 — Salle d'essai « rayons » (piste B, gate de richesse)

> **✅ Livré (2026-09-12). Gate de richesse PASSÉ** — « je suis très content du
> résultat, c'est vraiment excellent le rendu ». Trois demandes ont suivi,
> toutes traitées en avant, aucune n'a nécessité de retour en N2 ou N3 :
> **rayons à thème** (six catégories, l'unité de cohérence est la face de
> gondole, nouvel atlas de bandeaux `sig_bandeaux.png`), **éclairage de néon**
> (sources en forme de tube, rien au-dessus des rangées, trois tubes morts,
> blanc froid, bloc de secours vert) et **voir grand** — reporté en N6, c'est
> une consigne de plan, pas une correction. Détail des deux premières dans
> `docs/pipeline/harmonisation-assets.md` et `docs/pipeline/niveau-blender.md`.
>
> **Suite du retour (2026-09-12) : éclairage hybride adopté.** « J'ai
> l'impression qu'il y a une ambient light qui éclaire tout » — vérifié :
> l'ambiante était bien à 1.0, mais la vraie cause était qu'une couleur cuite
> PAR SOMMET ne peut pas montrer une arête. Corrigé (`--domain corner`), puis
> mesuré que seize `PointLight` ne coûtent rien à 640×360 (0,30 ms). D'où
> l'[ADR 0024](docs/decisions/0024-eclairage-hybride.md) : le direct est temps
> réel via des `light_*` portées par le niveau, l'indirect est cuit et sert
> d'ombre. **À traiter en N9** : three.js évalue toutes les lampes par
> fragment, le niveau complet en demandera plus de cent — il faudra un pool de
> taille fixe réaffecté aux luminaires proches.
>
> **🔶 Construite (2026-09-12).** Salle
> de 16 × 20 m, trois rangées coupées par une allée transversale, en jeu sous
> `Essai — Rayons (niveau v2)`. Bibliothèque de **37 assets générés par code**
> (`tools/blender/lib_rayons.py`), rangés dans l'Asset Browser par
> `build_library.py`. `validate_level.py --strict` : **0 erreur, 0 warning**.
> **96 350 triangles** (budget 200 000) et **13 à 26 lots de dessin** en jeu
> (budget 200), 120 FPS, rendu 0,20 ms. Quatre itérations visuelles, la limite
> prévue.
>
> **Trois défauts de pipeline trouvés en route, tous antérieurs à ce jalon :**
> 1. **Un bake par sommet exige des sommets.** 42 meshes sur 262 sortaient
>    entièrement noirs — panneaux à huit sommets dont chaque coin était scellé
>    par la géométrie voisine. `lib_helpers.subdivide` découpe toute arête au
>    delà d'un seuil ; zéro mesh noir ensuite.
> 2. **Une salle close n'a pas de lumière d'ambiance.** Mesuré : faire varier
>    la couleur du monde ne change rien, aucune lumière n'entre. Nouveau
>    `bake_vertex_lighting.py --ambient`, terme d'ambiant global à l'ancienne
>    (remap, sans écrêtage). Et `--emissive-marker` : un tube de néon, source
>    la plus lumineuse de la salle, ressortait noir.
> 3. **Le bake n'était pas le seul éclairage du jeu.** Une `DirectionalLight`
>    et une `AmbientLight` héritées de la Phase 1 multipliaient tout niveau
>    baké par une direction arbitraire (5, 10, 5) sans rapport avec ses néons :
>    une face à l'opposé perdait 60 % de sa luminosité cuite. `LevelDef.lighting`
>    les neutralise, **par niveau** — les zones A-E ont été éclairées à l'œil
>    SOUS cet ancien rig, leur bascule se décide à N10.
>
> **Écart assumé au plan** : le générateur de rayon garni est en Python, pas
> en Geometry Nodes — le bake travaille par sommet sur de la géométrie réelle,
> et une réalisation GN produit un mesh multi-matériaux que la fusion au
> chargement refuse (ADR 0023). Raisonnement complet dans
> `docs/pipeline/harmonisation-assets.md`.
>
> **Non utilisé** : le Supermarket de PensamientoAzul, dont la licence reste
> « à confirmer ». Les gondoles sont remontées en pièces simples, les produits
> viennent de Kenney Food et des 13 marques inventées de N3.

**Objectif.** Prouver qu'on atteint la richesse visée avant d'habiller le niveau entier.

**Actions** (en direct via MCP, capture à chaque étape).
1. Harmoniser un premier lot d'environ 15 à 20 assets : gondoles, têtes de gondole, bacs, présentoirs, produits, signalétique, caddies en décor statique.
2. **Générateur Geometry Nodes de rayon garni** : remplit une gondole avec une collection de produits CC0 et d'étiquettes inventées, en variant taille, rotation, trous et désordre (casser la symétrie, skill `prop-silhouette-design`). Son export suit la décision de N1.
3. Une salle d'environ 16 × 20 m : allées, une allée transversale, une tête de gondole promo, signalétique suspendue, néons en rangées (d'après `refs/`), carrelage.
4. Bake lumière seule, validation, export, entrée dédiée dans `levels.ts` (menu dev uniquement).
5. Comparaison côte à côte avec le board, 4 itérations au maximum (skill `reference-driven-authoring`).
6. **L'utilisateur joue la salle et tranche** : « c'est le niveau de richesse que je veux », ou pas.

**Critères d'acceptation.** `validate_level.py --strict` sans erreur ; draw calls et triangles dans le budget de N1 ; captures Blender et en jeu ; verdict positif de l'utilisateur. En cas de verdict négatif, retour en N3 (charte) ou N2 (sources) selon le diagnostic, jamais de passage direct à N9.

---

## 7. Jalon N5 — Occlusion des lignes de vue (piste A, avant tout placement d'ennemis)

> **✅ Livré (2026-09-12). L'hypothèse du 2026-09-11 est CONFIRMÉE, et le
> risque 4 tombe : on peut compter sur l'occlusion.** Repro headless écrit
> (`test/game/entities/lineOfSight.test.ts`, 12 cas, aucun raycast scripté :
> vrai `RaycastService`, vrai monde Rapier, vrai `Suit`, et pour les cas
> décisifs les `.glb` RÉELLEMENT exportés, relus par `GLTFLoader.parse` aux
> positions de spawn d'origine). Résultat net : à la position que l'ADR 0022
> avait déplacée, le Costard reste `idle` quand le monde a été « pas-sé », et
> passe `alert` quand il ne l'a pas été. **Zéro ligne de code de gameplay
> écrite** : le correctif était déjà là depuis le 2026-09-11
> (`refreshSceneQueries()` au chargement, posé pour le graphe de navigation —
> il réparait la ligne de vue par la même occasion, sans que personne le
> sache). [ADR 0022](docs/decisions/0022-occlusion-rangees-non-bloquante.md)
> passé en `remplace`, nouvel [ADR
> 0025](docs/decisions/0025-occlusion-lignes-de-vue-cause-racine.md) qui porte
> la décision et les règles de placement.
>
> **Deux surprises que seule la mesure pouvait donner**, et qui changent la
> lecture des anciennes zones : la position « occultée par la rangée » de la
> Zone D l'est en fait par un **pilier** posé pour tout autre chose, et celle
> de la Zone D est ne tient qu'à un **effleurement du coin** de la rangée
> (occlusion réelle, robustesse nulle — un pas de côté du joueur l'annule).
> Cette dernière répond à une question restée ouverte dans
> `tools/blender/README.md`. Les tests sur niveau réel vérifient donc QUEL
> collider arrête le rayon, pas seulement qu'il s'arrête.
>
> **Trois règles pour N6**, toutes mesurées : (1) une rangée couvre, une
> embuscade par occlusion est un outil disponible ; (2) une allée ne couvre
> rien, l'embuscade se pose dans une allée transversale ; (3) rien sous 1,6 m
> ne bloque un rayon (1,8 m face au Directeur) — caisses, palettes et
> comptoirs bas sont des obstacles de déplacement, pas du couvert.
>
> **Non fait, délibérément** : rapprocher les spawns des Zones C et D de leur
> position de plan d'origine, désormais possible. Ces zones sont remplacées
> au jalon N10, le travail serait jeté. Et **pas de vérification en jeu** :
> le repro tourne sur les octets exacts du `.glb` servi au jeu, c'est plus
> fidèle qu'un relevé console — mais la scène réelle peut différer sur un
> point non couvert (collider créé APRÈS le chargement : hot reload, porte,
> prop dynamique), noté dans l'ADR 0025.
>
> Une dette de typage, assumée : `test/node-builtin-shims.d.ts` déclare la
> tranche minimale de `node:fs`/`node:path` utilisée pour relire un `.glb`.
> `@types/node` n'est pas installé, et le charger redéfinirait des globales
> partagées avec le DOM (`setTimeout` en tête) dans un projet qui cible le
> navigateur. Le fichier est limité au dossier `test/`.
>
> `pnpm build` propre, `pnpm test` vert (132/132).
>
> ---
>
> **Contexte, écrit avant le jalon — correctif trouvé en préparant N4 (2026-09-11), hors jalon.** Rapier ne rend un collider visible aux rayons qu'après un `world.step()`. Le code de production bakait le graphe de navigation juste après le chargement, sans jamais avancer la simulation : **depuis M4 (2026-09-03), le graphe sortait vide dans tous les niveaux** (0 cellule praticable, vérifié en jeu), et les ennemis se contentaient de l'évitement local. Corrigé par `PhysicsWorld.refreshSceneQueries()` (pas de durée nulle) avant le bake, avec un test de non-régression. Une fois le graphe réellement calculé, un second défaut est apparu : les **plafonds** ajoutés le 2026-09-10 (zones B, C, E) avaient un collider, et le rayon descendant du bake les prenait pour le sol (6 542 cellules à 5 m). Leurs 98 proxies ont été supprimés du kit et des niveaux, réexportés sans refaire le bake ; règle désormais écrite : un plafond n'a jamais de collider. Résultat sur `hypermarche_complet` : 9 209 cellules au sol au lieu de 3 954, graphe hors toit. **Le pathfinding agit en jeu pour la première fois** : le comportement des ennemis peut changer, à surveiller en jouant. **Hypothèse pour ce jalon** : le premier rayon de ligne de vue de chaque ennemi partait lui aussi avant le premier pas de physique, ce qui expliquerait l'ADR 0022 ; le repro doit la confirmer ou l'écarter.

**Objectif.** Savoir si une rangée, un pilier ou un comptoir bloque vraiment le regard d'un ennemi (risque 4).

**Actions.**
1. Repro headless, par exemple en test Vitest : un ennemi et le joueur de part et d'autre d'un `col_box_gondola_4m` ou `col_box_rack_4m` isolé, via le vrai `RaycastService` et `hasClearWorldPath` (`src/game/entities/enemyMachine.ts`). Même test avec un mur `SHELL` comme témoin.
2. Si la cause est trouvée : correction à la source. Sinon : règle de contournement écrite pour le level design de N6.

**Critères d'acceptation.** Un test qui échoue avant correction et passe après, ou qui documente le comportement réel ; [ADR 0022](docs/decisions/0022-occlusion-rangees-non-bloquante.md) mis à jour.

---

## 8. Jalon N6 — Plan détaillé de la structure (piste A)

> **Consigne de l'utilisateur (2026-09-12), après le gate N4 : VOIR GRAND.**
> « Il ne faudra pas hésiter à voir grand pour la taille des pièces et de la
> map, il faut donner envie d'explorer — et qui dit exploration dit fun à
> trouver des secrets et des trucs marrants. » À lire comme une contrainte de
> ce jalon : les cotes de la salle d'essai (16 × 20 m) sont un plancher, pas un
> gabarit. Les deux garde-fous connus restent : un seul sol praticable par
> colonne (pathfinding 2.5D) et le budget de 200 lots de dessin — la salle
> d'essai n'en consomme que 18 pour 90 000 triangles, il y a de la marge.

**Objectif.** Passer du schéma à un plan de masse coté, validé avant de construire.

**Actions.**
1. Une fiche par espace : rôle, dimensions, hauteur sous plafond, entrées et sorties, ennemis (nombre, positions de principe), carte / secret / objet signature, durée cible.
2. Un plan de masse en vue de dessus, coté.
3. Vérifier sur le plan les contraintes connues :
   - **un seul sol praticable par colonne** (risque 3) : aucun espace praticable superposé à un autre ;
   - allées d'au moins 3 m pour pouvoir strafer ;
   - embuscades par allées transversales, jamais dans l'allée que le joueur regarde (leçon des Zones C et D) ;
   - spawns hors `attackRange` (16 m) du point d'arrivée du joueur, sauf intention explicite (salle du boss) ;
   - secrets en hauteur compatibles avec `jumpHeight` (1,1 m) ;
   - portée des `use_*` (2 m).
4. Validation par l'utilisateur.

**Critères d'acceptation.** Fiches et plan validés par l'utilisateur ; les placements d'ennemis relus par `entity-designer`.

---

## 9. Jalon N7 — Cartes de fidélité côté jeu (piste A)

**Objectif.** Remplacer le badge unique par un inventaire de cartes, pour que le blockout soit jouable.

**Conception.**
- `hasBadge` (booléen de session, `src/game/session/gameSession.ts`) devient un ensemble de cartes possédées : Argent, Or, Platine.
- Nouvelle convention glTF explicite pour les cartes à ramasser et les portes qui en demandent une, à définir avec `level-pipeline` (par exemple une propriété personnalisée Blender sur les `door_*` / `use_*` indiquant la carte requise). Ajoutée au tableau des conventions de `CLAUDE.md` et à `docs/`.
- Le Directeur lâche la carte Platine (`DirectorBadge` dans `src/game/entities/director.ts`, à généraliser) ; `door_e_exit` reste le déclencheur de fin.
- HUD : cartes possédées (zustand, 10 Hz max), messages de refus et de succès via `HudMessage.tsx`.
- Console : remplacer `cassandre.hasBadge()` / `giveBadge()` par l'équivalent pour les cartes.

**Critères d'acceptation.** `pnpm build` et `pnpm test` verts, tests de l'inventaire ; niveau actuel non régressé (sa porte de sortie fonctionne avec la carte Platine) ; vérification en jeu.

---

## 10. Jalon N8 — Blockout gris jouable (piste A, gate de structure)

**Objectif.** Jouer la structure avant d'y mettre un seul asset.

**Actions** (en direct via MCP).
1. Construire les 10 espaces avec le kit existant (murs, sols, escaliers, rampes, encadrements de porte) et des boîtes grises pour les volumes (gondoles, comptoirs, voitures).
2. Poser `spawn_player`, pied-de-biche, fusil à pompe, `spawn_suit_*`, `spawn_director_*`, cartes, portes à carte, les 3 `secret_*`, les emplacements des objets signature (boîtes repérées) et le raccourci à sens unique.
3. Export, entrée dédiée dans `levels.ts` (menu dev, `startUnarmed: true`), puis vérification : comptes (`cassandre.level.stats()`), graphe de navigation (`cassandre.pathfinding`), états des ennemis au spawn (`cassandre.suits`).
4. **L'utilisateur joue le blockout** : circulation, lisibilité, combats, secrets, durée chronométrée.

**Critères d'acceptation.** `validate_level.py --strict` sans erreur ; une partie complète possible du spawn à la sortie ; durée mesurée ; verdict positif de l'utilisateur. On itère ici tant que la structure ne convainc pas : c'est le moment où changer le plan coûte le moins cher.

---

## 11. Jalon N9 — Habillage du niveau (convergence des deux pistes)

**Prérequis.** N4 et N8 validés par l'utilisateur.

**Objectif.** Habiller la structure validée avec la bibliothèque validée.

**Actions.** Espace par espace, en commençant par les rayons (reprise directe de la salle d'essai). Compléter la bibliothèque au fil de l'eau en repassant par N2 et N3 pour tout besoin nouveau. Éclairage de secteur par espace (néons de la surface de vente, pénombre du parking souterrain). Bake, validation, export et test en jeu après chaque espace ou lot d'espaces ; l'utilisateur joue chaque lot.

**Critères d'acceptation.** Moins de 200 000 triangles ; draw calls dans le budget de N1 ; `validate_level.py --strict` sans erreur ; captures ; verdict positif de l'utilisateur à chaque lot.

---

## 12. Jalon N10 — Bascule et documentation

**Actions.**
1. Le nouveau niveau devient la cible du bouton « Jouer » à la place de `hypermarche_complet`. Les anciennes zones restent dans le menu dev ou en sortent, selon la décision de l'utilisateur.
2. `CLAUDE.md` : phase courante, tableau des conventions glTF (cartes), mention des textures dans la stack.
3. `docs/` : `docs/game/niveau-hypermarche.md` réécrit pour le nouveau niveau ; `docs/pipeline/` (bibliothèque `.blend`, MCP, harmonisation CC0, textures) ; ADRs pour les textures et la palette, la bibliothèque `.blend` comme source de vérité des assets, les packs CC0 comme source, et la décision instanciation / fusion de N1 ; mise à jour de l'ADR 0022.
4. Skills : `modular-kit-design` (bibliothèque v2), `blender-python-automation` (arbitrage script / MCP mis à jour avec l'usage réel), `gltf-level-conventions` (cartes).
5. Ce fichier est tenu à jour jalon par jalon (« ✅ Livré » avec date et constats, comme `PLAN_EFFECT_XSTATE.md`).

---

## 13. Ordre d'exécution et rattachement aux agents

```
Piste B : N0 → N1 → N2 → N3 → N4 (gate richesse) ──┐
                                                    ├──► N9 → N10
Piste A : N0 → N5 → N6 → N7 → N8 (gate structure) ─┘
```

N5 et N6 peuvent avancer en même temps. N7 doit être livré avant que le blockout de N8 soit joué.

| Jalon | Domaine | Qui |
|---|---|---|
| N0 | mise en place, MCP | session principale |
| N1 | loader, rendu, bake | `level-pipeline` (loader), `retro-render` (fusion, instanciation), `level-forge` (bake) |
| N2 | sourcing, licences | session principale, téléchargements validés un par un |
| N3 | palette, textures, étiquettes | `level-forge` (scripts) et session principale (essais dans Blender) |
| N4 | salle d'essai | session principale (MCP) |
| N5 | occlusion | `entity-designer` avec `core-loop` (`RaycastService`) |
| N6 | plan détaillé | session principale, relecture par `entity-designer` |
| N7 | cartes de fidélité | `level-pipeline` (convention, loader, interactions) et `shell` (HUD) |
| N8 | blockout | session principale (MCP), `entity-designer` pour les placements |
| N9 | habillage | session principale (MCP) |
| N10 | documentation | `doc-keeper` |

« Session principale » signifie le travail en direct dans Blender via MCP, que les agents ne peuvent pas faire tant qu'on ne leur a pas ajouté les outils `mcp__Blender__*` (voir N0, action 3).
