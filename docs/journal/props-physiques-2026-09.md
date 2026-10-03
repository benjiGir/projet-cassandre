---
title: "Props physiques — 2026-09-17"
tags: [journal, gameplay]
status: stable
updated: 2026-09-26
---

# Props physiques — 2026-09-17

Props physiques — livrés (2026-09-17), corrigés après playtest
> (2026-09-18).** Un préfixe `prop_*` donne au niveau du mobilier qui BOUGE :
> corps dynamique Rapier libre, poussable par le joueur et les ennemis (les deux
> character controllers appliquaient déjà des impulsions aux corps dynamiques),
> cassable au tir si le `.glb` lui donne des `pv`. Runtime :
> `game/level/props/props.ts` (`PropSystem`, reconstruit à chaque chargement comme le
> graphe de navigation et le pool de lampes), branché aux quatre moments de la
> boucle (`snapshotPrevious` / `update(hitEvents)` avant `physics.step` /
> `syncFromPhysics` après / `interpolate` au taux d'affichage, APRÈS le bloc
> caméra). Destruction = collider et corps DÉSACTIVÉS (jamais retirés du monde,
> voir l'ADR), mesh caché, évènement lu par `updateFx` qui pose les débris et le
> son (`prop_break_wood`/`prop_break_glass`, même pipeline Python que les 12
> autres). **Groupe de collision `PROP` séparé de `WORLD`**, décision centrale
> de l'[ADR 0030](../decisions/0030-props-dynamiques.md) : la ligne de vue
> ennemie et le bake du graphe de navigation filtrent sur `WORLD` seul et sont
> calculés UNE FOIS au chargement — un prop en `WORLD` laisserait, une fois
> poussé, un trou de navigation et un bloqueur de vue fantômes. Conséquence
> assumée : **un prop ne protège pas** (les balles ennemies le traversent).
>
> **Deux corrections après le premier playtest (« je n'ai pas trouvé de
> physique »), toutes deux dans la révision de l'ADR 0030 :**
> 1. **Placement.** Les six props du premier jet étaient tous dans deux espaces
>    à l'écart ; le hub — 48 m qu'on est OBLIGÉ de parcourir — n'en portait
>    aucun. Le placement passe maintenant par une table unique
>    (`PROPS_PHYSIQUES` dans `build_niveau.py`, appelée pour TOUT espace depuis
>    `main()`) couvrant les dix espaces : **51 props**, dont des piles de 2-3
>    qui s'écroulent. Règle qui manquait : *un prop doit être sur le chemin, pas
>    dans une pièce qu'on peut sauter.*
> 2. **Le modèle de coût annoncé était FAUX.** « Un lot par prop visible » avait
>    été mesuré dans une pièce close. La vérité est *un lot par prop dans le
>    CÔNE DE VUE* : three.js n'élimine que par le cône, jamais par occlusion, et
>    un prop ne peut pas rejoindre un lot fusionné. Mesuré : 37 props sur 51
>    dessinés depuis le spawn du parking, **210 lots pour un budget de 200**.
>    Corrigé par un **élagage par distance** (`PROP_RENDER_DISTANCE_SQ`, 36 m)
>    dans `PropSystem.interpolate` — coût retombé à **+6 lots à la galerie, +8
>    au hub, +6 au spawn**. Ce qui compte n'est donc pas le nombre total de
>    props mais leur DENSITÉ locale.
>
> **Piège d'export, payé une fois (2026-09-18)** : un `.glb` livré au jeu
> contenait TOUTE la bibliothèque `_LIB` — 1 153 nœuds de trop, 47 Mo au lieu de
> 29, tous les patrons d'assets empilés à l'origine du monde — alors que le
> `.blend` était sain. Cause : un export qui ne passe pas par
> `tools/blender/export_level.py`, seul endroit qui pose `use_visible=True`
> (l'interface de Blender ne coche pas cette case par défaut). Un `.glb` faux ne
> lève RIEN en jeu, il se charge. `export_level.py` vérifie donc désormais le
> fichier qu'il vient d'écrire et échoue sur tout nœud hors du view layer ou
> issu de `_KIT`/`_LIB` — garde-fou testé contre la vraie reproduction du
> défaut. **Si la ligne `[export] contenu vérifié` n'apparaît pas, le `.glb`
> n'est pas fiable.**
>
> Vérifié en jeu : 51 props chargés aux bonnes cotes, budget mesuré à trois
> points (pire point du niveau : la galerie à 195 lots, dont 189 de décor
> pré-existant), et surtout **une pile de trois cartons renversée en marchant
> dedans par le VRAI chemin de rejeu d'input** (carton du bas poussé de 54 cm,
> celui du milieu de 66 cm, celui du haut tombé de 1,24 m à 0,30 m et projeté à
> 1,94 m). `validate_level.py --strict` : 0 erreur, 9 warnings tous
> pré-existants. `audit_niveau.py` : 0 trou, 0 bord ouvert, 0 interpénétration,
> 0 objet flottant — il a trouvé 5 encastrements de props contre du décor déjà
> posé, tous corrigés. `pnpm build` propre, `pnpm test` vert (224/224).
> **Non vérifié** : tirer réellement à la souris sur une caisse, et la sensation
> à la manette/au clavier (verrouillage du pointeur hors de portée de
> l'automatisation, même limitation que d'habitude).

> **
