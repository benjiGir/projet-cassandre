---
title: "Armes, sprites et éclairage — 2026-09-13"
tags: [journal, rendu]
status: stable
updated: 2026-09-26
---

# Armes, sprites et éclairage — 2026-09-13

Armes du joueur — vrais modèles (2026-09-13), EN ATTENTE DU VERDICT DE
> PLAYTEST.** Pied-de-biche et pompe en 3D basse définition, tenus par les
> avant-bras du « Man in Long Sleeves » CC0 posés par IK
> ([ADR 0029](../decisions/0029-armes-en-vue-subjective.md),
> `tools/blender/build_weapons.py`). Placement à l'écran réglé DANS BLENDER
> (repère de l'œil), animations procédurales en TypeScript : balayage autour
> du coude, coup de pompe (le fût et la main gauche reculent), changement
> d'arme (descente / remontée). Horloges au pas fixe dans `WeaponSystem`, qui
> ne retardent jamais un tir (invariant #10, testé). Les armes passent devant
> les murs grâce à `gl.depthRange(0, 0.05)` ; l'éclair du pompe naît au bout du
> canon ; `use_crowbar`/`use_shotgun` montrent la vraie arme posée au sol.
> Vérifié en jeu : placement, balayage, pompage, changement d'arme par la
> touche 1, mur, éclair, ramassages du niveau v2. **Non vérifié** : un vrai tir
> à la souris (verrouillage du pointeur hors de portée de l'automatisation) et
> la sensation en mouvement.

> **Ennemis — vrais sprites animés (2026-09-13), EN ATTENTE DU VERDICT DE
> PLAYTEST.** L'atlas numéroté est remplacé par des sprites 8 directions
> pré-rendus depuis le « Man in Suit » CC0 de Quaternius
> ([ADR 0028](../decisions/0028-sprites-ennemis-pre-rendus.md)) : Costard en
> costume noir, cravate rouge, lunettes noires ; Directeur en costume beige,
> peau `revele` verte à crête posée par `setAtlas` à la révélation. Vingt
> lignes par atlas : repos, alerte, course (6 frames entraînées par la
> DISTANCE parcourue), visée à deux mains, tir avec éclair, recul, mort
> (6 frames, un plongeon en avant). Régénérer : `render_enemy_sprites.py`
> (`tools/blender/README.md`), le jeu lit le manifeste JSON au démarrage.
> Horloges d'animation dans le contexte XState (`animClock`,
> `strideDistance`, `timeSinceShot`), avancées au pas fixe, lues par le rendu
> seul. Vérifié en jeu (gym et niveau v2) : les huit directions, la course,
> la visée, le tir, les six frames de mort et la bascule de peau. **Pas
> encore jugé en jouant** ; chaque ennemi visible reste un lot de dessin sur
> un budget de 186/200.
> **Passe de lisibilité (2026-09-14)** après « trop low res » : la cause
> mesurée est le budget de pixels (38 px de haut à 11 m) et un modèle fin et
> sombre, pas le filtrage. Membres épaissis, tête ×1,22, veste ardoise, plastron
> blanc, lunettes et cravate élargies, atlas à 96 px/m (1920 × 3840, ~118 Mo de
> VRAM pour les trois), normales des quads inclinées de 45° vers le haut pour
> capter les néons. Résolution interne inchangée (invariant #4). Détail :
> ADR 0028, section « Révision du 2026-09-14 ».

> **Playtest complet du niveau v2 (2026-09-16) : « y a encore beaucoup de
> boulot ».** Retour après la première traversée de bout en bout : trop
> d'éléments pas à leur place ou en collision, et des trous qui font tomber
> dans le vide. Nouvel outil `tools/level_v2/audit_niveau.py` (trous de sol,
> bords ouverts sur le vide, interpénétrations, objets flottants) — à lancer
> APRÈS chaque construction, au même titre que `validate_level.py`. Il a
> trouvé les deux vraies chutes, toutes deux structurelles : le mur nord des
> rayons percé sur toute sa hauteur sous le couloir de service (un passage à
> sens unique reçoit désormais un PARAPET côté bas), et la porte de sortie qui
> donnait sur rien — la fin de niveau n'était armée que pour l'ancienne porte
> `door_e_exit` (`estPorteDeSortie`, plus un palier derrière la sortie).
> Un **filet de chute** (`game/session/player/fallRescue.ts`) remet le joueur sur le
> dernier sol touché au-delà de 12 m de chute, et écrit les coordonnées du trou
> en console : un trou coûte désormais trois secondes, plus une partie.
> État de l'audit après cette passe : **0 trou, 0 bord ouvert, 0
> interpénétration, 0 objet flottant**. Ce qui reste, et que l'audit ne sait
> PAS voir : la composition, l'échelle, ce qui « fait faux » à l'œil — donc un
> deuxième playtest.
>
> **Chantier Niveau v2 — En cours (2026-09-13) : N0, N1, N3, N4 (gate de
> richesse PASSÉ), N5, N7 et N8 livrés (gate de STRUCTURE PASSÉ — l'utilisateur
> a joué le blockout et validé), N6 validé, N2 presque (quatre licences à
> confirmer). N9, l'habillage, est CONSTRUIT de bout en bout : prérequis de
> rendu (N9.0), puis les dix espaces en cinq lots (N9.1 rayons, N9.2 caisses +
> galerie, N9.3 hub + électroménager, N9.4 réserve + souterrain, N9.5 parking +
> cafétéria + bureaux), enfin l'entrée des packs CC0 Kenney (N9.6). **Plus un
> seul volume gris.** Jouable sous `Niveau v2 — habillé`.**
>
> **TROIS CHOSES ATTENDENT L'UTILISATEUR, et rien ne devrait avancer sans
> elles :**
> 1. **Le verdict de playtest sur N9** — aucun lot n'a encore été validé ; le
>    critère du plan est « verdict positif à chaque lot ».
> 2. **L'amendement de l'invariant #4** proposé par l'[ADR 0027](../decisions/0027-filtrage-des-textures-reduites.md),
>    après un retour « ça pixelise au loin » : mipmaps + anisotropie à la
>    RÉDUCTION, gros pixel conservé à l'agrandissement. Le code tourne déjà
>    ainsi pour qu'il juge sur pièce. **Depuis le 2026-09-22, le choix se fait
>    sans console** : menu principal › Paramètres du signal › Affichage, trois
>    modes décrits par ce qu'on voit (« gros pixel partout » = comportement
>    historique). `cassandre.filtrage("nearest")` reste disponible en dev.
> 3. **Quatre licences à confirmer** dans `assets_src/LICENCES_ASSETS.md`
>    (`retro3d_car`, `retro3d_office`, `pensamientoazul_supermarket`,
>    `aquilarius_retro_textures`) : tant qu'elles sont marquées « à confirmer »,
>    ces packs NE S'UTILISENT PAS — c'est la règle du registre. Les trancher
>    demande d'ouvrir chaque page source, une action utilisateur.
>
> **Deux dettes techniques connues avant N10** : le **BAKE** (le niveau n'a
> aucune ombre portée, c'est le dernier écart visuel avec la salle d'essai de
> N4) et le **budget de lots de dessin, à 186 sur 200** — tout ajout de décor
> passe d'abord par la mutualisation des matériaux ou `BatchedMesh`.
> Refonte complète du niveau, détail jalon par jalon (N0-N10) dans
> `PLAN_NIVEAU_V2.md`. Point de départ : la passe du 2026-09-10 (poser les
> 9 pièces du kit jamais utilisées, via `level-forge` en scripts headless)
> a été conservée mais jugée insuffisante après avoir joué. Décisions :
> structure en hub à la Duke 3D (10 espaces, cartes de fidélité comme
> clés), bibliothèque d'assets tirée de **packs CC0 harmonisés**, **textures
> rétro 64-128 px réintroduites** (style Build / Ion Fury, hypermarché
> resté dans son jus années 90), marques d'emballage inventées, travail
> **en direct dans Blender via le MCP officiel Blender Lab** (Blender 5.1,
> `localhost:9876`, que `level-forge` ne peut pas piloter en l'état). Deux
> pistes en parallèle : structure → blockout gris joué, et salle d'essai
> « rayons » pour valider la richesse. Le niveau actuel reste jouable
> jusqu'à la bascule (N10). Contraintes à connaître avant de dessiner : un
> seul sol praticable par colonne (pathfinding 2.5D). **L'occlusion des
> lignes de vue, elle, est fiable — mesuré à N5 (ADR 0025, qui remplace
> l'ADR 0022)** : une rangée couvre, une allée ne couvre rien, et rien sous
> 1,6 m ne bloque un rayon (1,8 m face au Directeur). Le décor statique est
> fusionné au chargement par matériau **et par cellule de 48 m** (ADR 0023,
> granularité révisée par l'ADR 0026 à N9) : sans la découpe, un lot couvre
> toute la carte et le tri d'écart n'élimine plus rien — une pièce close de
> 28 × 26 m dessinait 82 836 triangles, contre 11 184 après. **La bonne taille
> de cellule DÉPEND de l'habillage et se re-mesure** : 32 m sur le blockout
> gris, 48 m dès trois espaces habillés (un décor texturé porte bien plus de
> matériaux par cellule, et le nombre de lots suit le nombre de matériaux). Budget mesuré du
> niveau v2 : **1 500 000 triangles, 200 lots de dessin, 48 lampes allumées**
> (les 200 000 triangles posés a priori à N1 étaient trop prudents d'un ordre
> de grandeur ; ce sont les LAMPES qui font mur, et le shader ne compile plus
> du tout au-delà de ~255 sans lever la moindre exception — d'où le pool de
> `src/render/environment/lightPool.ts`). `cassandre.lightBudget()` rapporte l'état du
> pool ; une lampe éteinte par lui apparaît en `visible: false` dans
> `cassandre.lighting()` — c'est le premier réflexe quand un espace paraît trop
> sombre. Bake en `--type diffuse` (lumière seule) dès qu'il y a des textures ;
> un plafond n'a jamais de collider (le bake du pathfinding le prendrait pour
> le sol).
> **Piège de banc de mesure** : `cassandre.player.spawn(...)` ne déplace pas la
> caméra tant que la boucle d'affichage ne tourne pas, et elle ne tourne pas
> dans un onglet masqué — une série de mesures « à différentes positions » peut
> être six fois la même vue sans que rien ne le trahisse. Poser
> `camera.position`/`lookAt` à la main ; le témoin est `Steps: 0` au panneau de
> debug. **Le pathfinding n'a réellement fonctionné en jeu qu'à partir du
> 2026-09-11** (graphe vide depuis M4, faute de `refreshSceneQueries()` au
> chargement) : tout retour de playtest sur le comportement des ennemis
> est à lire à cette lumière.
> Bibliothèque d'assets du niveau v2 : **deux modules générés par code**,
> `tools/blender/lib_rayons.py` (37 assets, la surface de vente : gondoles,
> produits, bandeaux de catégorie) et `tools/blender/lib_facade.py` (l'avant-
> magasin et la galerie : caisses, portiques, kiosques, devantures à rideau
> baissé, photomaton, machine à pinces) et `tools/blender/lib_electro.py`
> (l'électroménager et le carrefour : mur d'écrans, cabines de démonstration,
> rangées de gros blanc, estrade du micro). **Un appareil électroménager est une
> boîte blanche avec une façade dessinée** — un hublot peint dans l'albedo fait
> un lave-linge à 640×360 — et `tools/blender/lib_reserve.py` (l'arrière du
> magasin : racks à palettes, portes de quai, fûts, suspensions industrielles,
> voitures, piliers de béton) et `tools/blender/lib_bureaux.py` (cafétéria et
> bureaux). **Pour une surface qui ne veut AUCUN motif** — une carrosserie, un
> pneu, un vitrage — utiliser `uv="aplat:#rrggbb"`, qui mappe tout sur un pavé
> de `palette.png`, le nuancier commun : une carrosserie texturée en plâtre
> taché se lit comme un matelas, pas comme une voiture sale.
> **Packs CC0 tiers : le critère d'admission est le nombre de MATÉRIAUX, pas le
> style.** Le budget sous tension du niveau est le nombre de lots de dessin, et
> un pack à vingt textures séparées en coûterait vingt. Deux voies existent,
> toutes deux dans `lib_helpers.import_kit` : un pack à atlas unique se
> requantifie sur la palette (`make_kenney_atlas.py`, multi-packs) ; un pack
> SANS texture, dont les matériaux ne sont que des couleurs nommées (le Kenney
> Furniture Kit, 140 modèles), s'importe avec `repeindre=True`, qui reporte
> chaque teinte sur `palette.png` — tout le kit tient alors dans un matériau.
> **Deux pièges d'échelle** : les kits Kenney sont à des proportions de jouet
> (une berline à 4,40 m de long sort à 2,24 m de HAUT), d'où `dimensions=(x,y,z)`
> qui remet chaque axe à sa cote ; et les modèles arrivent longueur le long de
> **+Y** (conversion Y-up → Z-up de l'import glTF).
> **Un pack marqué « à confirmer » dans `assets_src/LICENCES_ASSETS.md` NE
> S'UTILISE PAS** — c'est la règle du registre lui-même. `retro3d_car`,
> `retro3d_office`, `pensamientoazul_supermarket` et `aquilarius_retro_textures`
> sont dans ce cas : trancher demande d'ouvrir chaque page source, une action
> utilisateur (reliquat de N2).
> Cinq atlas de bandes et d'étiquettes, tous PLEINS : trois de bandes
> (`trim_hypermarche`, `sig_bandeaux`, `sig_facade`) et trois d'étiquettes
> (`prd_etiquettes`, `prd_kiosque`, `prd_ecrans`) ; `uv="label:<nom>"` accepte
> `front="+z"` pour un objet posé à plat (une pile de journaux se regarde d'en
> haut) ; `lib_hypermarche_v2.blend` est un produit
> régénérable, jamais un fichier qu'on édite à la main. Salle d'essai jouable
> via le menu dev (`salle_essai_rayons`). Trois règles de bake nées de N4 :
> **subdiviser** toute grande surface (un bake par sommet exige des sommets,
> sinon mesh noir), **`--ambient`** (une salle close n'a aucune lumière
> d'environnement), **`--emissive-marker`** (une source ne s'éclaire pas
> elle-même). Et surtout : un niveau baké NE DOIT PAS rester en
> `LevelDef.lighting: "temps-reel"`, sans quoi le soleil hérité de la Phase 1
> multiplie tout le bake par une direction arbitraire.
> **Le niveau v2 habillé se construit PAR-DESSUS le blockout, pas à côté**
> (`tools/level_v2/build_niveau.py` importe `build_blockout`) : la structure
> validée à N8 n'est jamais redessinée, seuls changent les matériaux de la
> coque, les plafonds (toujours sans collider), les lampes et le contenu des
> espaces habillés. Le registre `HABILLAGE` décide quels espaces sont habillés ;
> les autres gardent leurs volumes GRIS, exprès — le niveau reste jouable de
> bout en bout à chaque lot, et ce qui est gris est ce qui reste à faire.
> **Piège de subdivision** : `lib_helpers.subdivide(cible)` s'arrête quand plus
> aucune arête ne dépasse `cible × 1.5` — la garantie réelle est 1,5 fois la
> valeur passée. Pour tenir le seuil d'un sommet par m² de `validate_level.py`,
> passer 0,6 et non 1,0.
> **Piège d'UV des enseignes** : `lib_helpers._uv_trim` mappe U depuis la
> coordonnée MONDE — ce qu'il faut pour une plinthe qui se poursuit sans
> raccord d'une boîte à la suivante, un piège pour une enseigne (le mot tombe
> où il veut selon l'endroit où l'objet est posé, d'où des panneaux
> « CAISSE CAISS »). Pour tout panneau porteur de TEXTE, utiliser
> `uv="enseigne:<bande>"`, calé sur le panneau. Les trois atlas de bandes
> (`trim_hypermarche`, `sig_bandeaux`, `sig_facade`) sont PLEINS : huit bandes
> de 16 px occupent exactement les 128 px d'une texture, un besoin nouveau
> demande un atlas de plus.
> **Piège de construction de niveau, le plus coûteux du chantier** : habiller un
> espace REMPLACE l'appel à `bo.volumes()`, qui ne pose pas que du décor —
> c'est lui qui construit la plateforme de quai de la réserve ET SA RAMPE, seul
> accès au parking souterrain. Un habillage qui ne les reconstruit pas coupe le
> niveau en deux, sans aucune erreur. Vérifier le graphe de navigation après
> chaque lot, pas seulement les comptes.
> **Piège de mesure** : `render_ingame --eye` est une cote MONDE, pas une
> hauteur au-dessus du sol local — cadrer le souterrain (z = −6) à `--eye 1.6`
> place la caméra au-dessus de son plafond, et rend une image vide qui n'est
> pas une pièce vide.
> Dans `build_niveau.py`, le sol et le
> plafond sont posés PAR DÉFAUT pour tout espace, et seuls les espaces listés
> dans `SOL_SUR_MESURE`/`PLAFOND_SUR_MESURE` s'en chargent eux-mêmes. Le défaut
> inverse a déjà été payé : un espace habillé se retrouvait sans sol.
> **Piège de l'outil de rendu** : `render_ingame.py` reconstruit
> `texture × attribut Col`, et un nœud Attribut dont le nom n'existe pas sur le
> mesh renvoie du NOIR, pas du neutre. Un niveau pas encore baké sortait donc
> entièrement noir — on croit le niveau éteint alors que c'est l'outil qui ment.
> Corrigé (masque blanc posé d'office sur les meshes sans `Col`) ; l'outil
> applique aussi le pool de 48 lampes par point de vue, sans quoi une capture
> promet une luminosité que le jeu ne tient pas.
> **Éclairage hybride, limite levée (N9)** : la note de l'ADR 0024 « il faudra
> un pool réaffecté au-delà d'une centaine de lampes » est réglée — `LightPool`
> n'en laisse que 48 allumées, les plus proches, classées sur la distance au
> BORD de leur sphère d'influence (`distance − light.distance`) et non sur la
> distance à la lampe. Un niveau sous le budget n'est jamais touché.
> Après le gate : les rayons sont **thématiques** (six catégories, l'unité de
> cohérence est la FACE de gondole, atlas de bandeaux `sig_bandeaux.png`) et
> l'éclairage imite un plafond de néons — **la forme de la source fait l'ombre**
> (tubes de 3,9 × 0,3 m, rien au-dessus des rangées, quelques tubes morts).
> Consigne pour la suite : **voir grand** sur la taille des pièces et de la
> carte, l'exploration prime (les 16 × 20 m de la salle d'essai sont un
> plancher, pas un gabarit).
> **Éclairage hybride (ADR 0024, 2026-09-12)** : un niveau v2 porte ses propres
> lampes (empties `light_*` en Blender → `THREE.PointLight`), le bake ne cuit
> plus que l'indirect (`--pass indirect --domain corner`) et la couleur de
> sommet ne porte plus l'éclairage mais **l'ombre**. `LevelDef.lighting` choisit
> le régime par niveau (`temps-reel` par défaut, `bake`, `hybride`) — les zones
> A-E restent en `temps-reel`, leur bascule se décide à N10. Limite connue :
> three.js évalue toutes les lampes par fragment, il faudra un pool réaffecté
> au-delà d'une centaine (à traiter en N9). `cassandre.lighting()` en console
> sépare éclairage temps réel et couleur cuite.
>
> **
