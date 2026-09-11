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
| Source des assets | **Packs CC0 harmonisés uniquement.** Pas de génération 3D par IA. Claude harmonise, assemble et dispose ; il ne modélise pas de props de zéro, hors blockout gris et pièces de structure du kit existant |
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
2. **Couverture CC0 incomplète.** Certains objets propres au jeu (machine à pinces, mur de télés, lecteur de carte de fidélité, enseigne) peuvent n'exister dans aucun pack. Décision au cas par cas avec l'utilisateur ; pas de modélisation de zéro par défaut.
3. **Un seul sol praticable par colonne.** Le pathfinding est un graphe 2.5D avec une seule hauteur de sol par cellule (`groundY` dans `src/game/level/pathfinding.ts`, échantillonné par un rayon vertical descendant). Deux espaces praticables superposés en vue de dessus ne peuvent pas être représentés : les ennemis du niveau inférieur n'auraient aucun chemin. **Contrainte de level design dure** : le parking souterrain (et tout étage de bureaux) ne doit jamais passer sous ou sur un autre espace praticable, par exemple en le plaçant sous le parking extérieur plutôt que sous la surface de vente. Un pathfinding multicouche serait un chantier à part.
4. **Occlusion des lignes de vue non fiable** ([ADR 0022](docs/decisions/0022-occlusion-rangees-non-bloquante.md), cause inconnue). La nouvelle structure repose sur la couverture (allées transversales, piliers du parking souterrain). Le jalon N5 doit lever ce risque avant tout placement d'ennemis derrière un obstacle.
5. **Draw calls.** Le loader n'a aucune instanciation, et le niveau combiné compte déjà environ 615 meshes de décor. Une bibliothèque 5 à 10 fois plus fournie impose le jalon N1 avant toute densification.
6. **Conflit instanciation / bake.** Chaque objet rendu porte aujourd'hui sa propre géométrie pour recevoir son propre bake (piège documenté dans `tools/blender/build_level.py` et `docs/pipeline/niveau-blender.md`), ce qui empêche l'instanciation GPU telle quelle. N1 tranche.
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

**Objectif.** Poser l'environnement de travail et les dossiers, sans produire de contenu.

**Actions.**
1. Committer la passe du 2026-09-10 (sur demande explicite de l'utilisateur) pour repartir d'un arbre propre.
2. Blender 5.1 ouvert, add-on MCP activé, serveur démarré ; `get_blendfile_summary_path_info` répond.
3. Trancher qui pilote le MCP. `level-forge` n'a pas les outils MCP (`tools: Read, Write, Edit, Bash, Glob, Grep` dans `.claude/agents/level-forge.md`). Soit le travail en direct se fait en session principale (défaut), soit on ajoute les outils `mcp__Blender__*` à l'agent.
4. Arborescence :
   - `assets_src/blender/lib_hypermarche_v2.blend` : bibliothèque versionnée, rangée dans l'Asset Browser en catalogues Structure, Mobilier de vente, Produits, Signalétique, Déco, Gameplay ;
   - `assets_src/cc0_raw/<pack>/` : packs téléchargés tels quels, **gitignorés** (retéléchargeables, source au registre) ;
   - `assets_src/textures/` : textures finales 128×128 et `palette.png`, versionnées ;
   - `assets_src/LICENCES_ASSETS.md` : registre des licences, versionné ;
   - `tools/textures/` : scripts de quantification et de génération d'étiquettes.
5. Compléter le board `refs/` (local, gitignoré) avec un dossier `hypermarche_90s/` : hypermarchés français des années 90, signalétique, carrelage, PLV, galerie marchande, cafétéria. Même méthode que le board initial (images libres, Wikimedia Commons). Relancer `tools/refs/extract_palette.py` (dépendances dans `.venv-refs/`) et mettre à jour `refs/SPEC.md`.
6. Versionner la fiche de spec, qui est du texte dérivé sans image, par exemple sous `docs/assets/board-hypermarche.md`. Les images restent locales.

**Critères d'acceptation.** Connexion MCP vérifiée ; arborescence et registre créés ; `.gitignore` à jour ; board complété, fiche de spec versionnée.

---

## 3. Jalon N1 — Prérequis rendu (piste B, bloquant pour toute densification)

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

**Objectif.** Que tout ce qui entre dans la bibliothèque parle la même langue visuelle.

**Actions.**
1. **Palette commune de 64 couleurs**, dérivée du board (`refs/*/palette.json`) et du style Build, dans `assets_src/textures/palette.png`.
2. **Textures de base** 128×128 à 64 px/m : sols (carrelage, béton, asphalte), murs (faïence, parpaing, placo), plafonds (dalles, bac acier), et une trim sheet (plinthes, bandeaux, tranches d'étagère). Sources : packs CC0 retravaillés, quantifiés sur la palette sans dithering (`magick … -remap palette.png`, voir `retro-texture-density`).
3. **Fiche d'harmonisation écrite**, appliquée à chaque asset importé : échelle vérifiée contre un repère de 1,8 m, origine au coin au sol, matériau Lambert, UV à 64 px/m, texture ramenée à 128 px sur la palette, budget de triangles, proxy de collision cuboid par défaut (skill `collision-proxy-authoring`), nommage.
4. **Générateur d'étiquettes de marques inventées** (`tools/textures/`) : nom de marque, aplats, pictos simples, en 64×64 ou 128×64, sortie quantifiée sur la palette. La liste des marques est validée par l'utilisateur (ton satirique, marques fictives).

**Critères d'acceptation.** Palette et textures de base versionnées ; densité confirmée au damier sur un échantillon ; au moins 10 étiquettes générées et lisibles à 640×360 (capture en jeu) ; fiche d'harmonisation écrite.

---

## 6. Jalon N4 — Salle d'essai « rayons » (piste B, gate de richesse)

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

**Objectif.** Savoir si une rangée, un pilier ou un comptoir bloque vraiment le regard d'un ennemi (risque 4).

**Actions.**
1. Repro headless, par exemple en test Vitest : un ennemi et le joueur de part et d'autre d'un `col_box_gondola_4m` ou `col_box_rack_4m` isolé, via le vrai `RaycastService` et `hasClearWorldPath` (`src/game/entities/enemyMachine.ts`). Même test avec un mur `SHELL` comme témoin.
2. Si la cause est trouvée : correction à la source. Sinon : règle de contournement écrite pour le level design de N6.

**Critères d'acceptation.** Un test qui échoue avant correction et passe après, ou qui documente le comportement réel ; [ADR 0022](docs/decisions/0022-occlusion-rangees-non-bloquante.md) mis à jour.

---

## 8. Jalon N6 — Plan détaillé de la structure (piste A)

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
