---
title: "Reprise live et props — 2026-09-18"
tags: [journal, niveau]
status: stable
updated: 2026-09-26
---

# Reprise live et props — 2026-09-18

Deuxième passe en direct dans Blender (2026-09-18, soir), EN ATTENTE DU
> VERDICT DE PLAYTEST.** Retours : lampadaires mal placés devant l'entrée,
> secrets incompréhensibles, couloir des bureaux qui débouche en hauteur sur
> les rayons, Costards qui apparaissent dans les props, accès au Directeur
> incohérent — et deux envies : un ÉTAGE de bureaux avec le Directeur au bout,
> une skybox. Tout est à la source (`plan_de_masse.py`, `build_niveau.py`), bâti
> dans la session live :
> - **Étage des bureaux** (z = 4, au-dessus d'un vide) : escalier de service
>   derrière la porte Or (collider en rampe lisse, marches rendues à ±10 cm),
>   couloir aux fenêtres de nuit, quatre bureaux derrière des cloisons
>   (vidéosurveillance, comptabilité, RH, salle de pause), et au bout le
>   **bureau du Directeur** (son portrait est le présentateur reptilien du mur
>   d'écrans), dont l'issue de secours termine le niveau. `poser()` place tout
>   meuble d'après ses VRAIES cotes et le côté où regarde sa façade.
> - **Raccourci** de plain-pied, fermé par une **porte coupe-feu** à sens
>   unique (`PORTES_SENS_UNIQUE` au plan, bouton hors de portée côté rayons).
>   Nouveau concept moteur : la porte LIBRE (`use_*` avec `target` sans
>   `requires`, `onDoorUse`, testé).
> - **Secrets réels**, au lieu de volumes au sol qu'on traversait en passant :
>   labo derrière un pan de mur que le photomaton efface ; campement sur le
>   toit des gondoles (caisse, puis deux allées à sauter) ; couvée reptilienne
>   dans le local VMC, par la bouche au-dessus d'un distributeur (l'ancienne
>   chaîne passait par un frigo de 2,20 m, infranchissable). Récompense dans
>   chacun. `plan.PASSAGES` rétrécit une façade commune à une vraie porte.
> - **Spawns recalés à la construction** (`recaler_spawns`) : posés sur le sol
>   réel (quai à 3 m, rampe) puis écartés des colliders et des props, chaque
>   déplacement au journal ; onze l'étaient. L'audit a un contrôle « spawns
>   encombrés ».
> - **Skybox de nuit** : `LevelDef.ciel`, cubemap en `scene.background`
>   (`render/ciel.ts`, `tools/textures/generate_ciel.py`, docs/archive/systems-rendu.md#ciel).
> - Lampadaires : deux encadrent l'entrée, tête vers elle, les autres dans les
>   files de places. Armoires et fauteuils de bureau n'ont plus de rayures de
>   chantier (bandes de bordure projetées au hasard).
> **Budget de lots, le point à surveiller** : 188 lots de décor (187 avant) ;
> pire vue mesurée **198/200** (haut de la rampe de sortie vers le sud), à
> cause de ce qui ne fusionne jamais — le ciel, deux portes, six récompenses.
> La fusion groupe par matériau ET jeu d'attributs : un mesh sans `Col` ne
> rejoint pas un mesh qui en porte un. Un matériau neuf dans une cellule de
> 48 m coûte un lot : habiller une cachette avec la matière de la pièce
> qu'elle prolonge. Mesuré : audit à zéro partout (spawns compris),
> `validate_level.py --strict` 0 erreur et 7 warnings (tous connus), graphe de
> navigation relié (escalier, étage, Directeur, cachettes ; pas les toits),
> `pnpm build` propre, `pnpm test` 226/226. **Non vérifié** : jouer — le saut de
> toit en toit, la porte coupe-feu à la vraie touche E, le combat à l'étage.
>
> **Reprise de la carte en direct dans Blender (2026-09-18), EN ATTENTE DU
> VERDICT DE PLAYTEST.** Retour : « des incohérences entre le parking souterrain
> et le couloir des bureaux, beaucoup de props mal placés à l'électroménager ».
> **Méthode décidée avec l'utilisateur** : on travaille dans le Blender OUVERT
> via le MCP (regarder à hauteur d'œil, corriger, re-regarder), mais chaque
> correction va dans les scripts, et `build_niveau.py` est relancé DANS la
> session live (≈ 10 s), jamais en headless. Le `.blend` reste un produit
> régénérable. Ce qui a été trouvé en regardant, et corrigé à la source :
> 1. **13 jonctions sur 21 ouvraient sur le vide** : deux voisins aux plafonds
>    de hauteurs différentes, façade percée sur toute la hauteur — 6,5 m aux
>    deux rampes du souterrain, d'où l'on voyait PAR-DESSUS le toit du parking.
>    `poser_linteaux` pose des linteaux (et des impostes au-dessus des portes)
>    RENDUS SEULEMENT, sans collider : la règle « aucun linteau » du blockout
>    visait le bake de navigation, qu'un mesh sans collider ne touche pas.
> 2. **Plafond d'une rampe = pente**, plus un plat au point haut ; **le sol
>    d'une rampe porte des UV** (il sortait en gris uni). Rampes du souterrain en
>    béton, secteur personnel (couloir de direction, montée et couloir de
>    service) en béton et plâtre usé. Les couloirs ont des luminaires visibles
>    (la lumière sortait de nulle part). Rampes gardées à 37°, sur décision.
> 3. **Souterrain redessiné sur UNE trame** : piliers tous les 8 m, places de
>    5 m perpendiculaires aux allées, voitures DANS les places (elles étaient
>    en travers de l'allée), rampe de sortie encadrée par deux piliers.
> 4. **Électroménager recomposé par zone** : l'entrée dégagée (une étagère et
>    trois téléviseurs AU SOL y barraient le passage), le mur d'écrans
>    autonome face à l'entrée — `suit_el2/3/5` sont VRAIMENT derrière,
>    `suit_el1` VRAIMENT dans une cabine (vérifié contre les colliders ; ni
>    l'un ni l'autre n'était vrai avant). Téléviseurs Kenney tournés vers la
>    salle (ils regardaient le mur depuis N9 : ils font face au −y local comme
>    le reste de la bibliothèque, donc `rot 90` contre un mur ouest). Cabines
>    où l'on entre (un collider plein fermait leur ouverture), rangées
>    d'appareils au collider à leur silhouette (un bloc de 1,90 m arrêtait les
>    tirs au-dessus des lave-linge). Carte Or dans la cabine nord-est, ouverte
>    au sud : la carte est un repère plat, vue par la tranche sinon.
> **Piège payé une fois, corrigé** : `audit_niveau.py` désactivait tout le
> décor pour ses rayons sans le restaurer — sans effet en headless, mais dans
> une session ouverte l'export suivant (`use_visible`) n'écrivait que les
> colliders (722 Ko de `.glb`). Il restaure maintenant l'état. **Autre piège** :
> la session Blender ouverte peut être PLUS VIEILLE que le `.blend` sur disque
> (une reconstruction headless ne la recharge pas) — vérifier avant de
> sauvegarder depuis elle. Mesuré : 0 trou, 0 bord ouvert, 0 interpénétration,
> 0 objet flottant ; `validate_level.py --strict` 0 erreur et les 9 warnings
> déjà connus ; 187 lots de décor, pire vue mesurée 190/200 (haut de la rampe
> de sortie) ; graphe de navigation relié partout où il faut ; `pnpm test`
> 224/224. **Non vérifié** : le ressenti en jouant. **Écart connu, pas
> corrigé** : le couvert « pilier » déclaré pour `suit_so4` n'existe pas (ni
> avant ni après) ; `MAX_STEP_HEIGHT` du graphe (1,0 m) dépasse la marche des
> ennemis (0,35 m), d'où les 5 cm de marge sur les colliders d'appareils.
>
> **
