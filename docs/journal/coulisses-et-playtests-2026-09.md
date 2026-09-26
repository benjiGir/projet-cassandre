---
title: "Coulisses et playtests — 2026-09-26"
tags: [journal, niveau]
status: stable
updated: 2026-09-26
---

# Coulisses et playtests — 2026-09-26

Les coulisses (2026-09-26), EN ATTENTE DU VERDICT DE PLAYTEST.** Les
> 92 m de couloirs vides vers les bureaux reçoivent 6 pièces + le secret 4
> (vestiaires, fournil, PC sécurité, chambre froide, atelier SAV, compacteur,
> planque du vigile) — plan : `../assets/plan-coulisses.md`. Trois systèmes
> neufs : nourriture (`use_*` `aliment`), écrans animés cassables (`ecran_*`,
> atlas `prd_chaines`, 1 lot pour les 48), caméras façon Duke (`cam_*` +
> console `cameras`, 6 caméras dont le bureau du Directeur) ; `prop_*` gagne
> `contenu` et les matières farine/eau/electronique. Mesuré en jeu : 47
> Costards, lots ≤ 120 aux 8 points de vue des coulisses (SAV 86), aucune
> erreur console nouvelle, `pnpm test` 464/464, validate/audit à zéro.
> **Non fait** : pyramides de conserves, aquarium du Directeur, mur d'écrans
> de l'électro et écrans d'ordi de l'étage en `ecran_*`, néon/fuite animés,
> vrais sons (placeholders). **Non vérifié** : touche E (console, casiers,
> compacteur), casse au tir, graphe de navigation des nouvelles pièces.
>
> **Sept retours de playtest traités (2026-09-25), EN ATTENTE DU VERDICT.**
> Tous délégués aux agents, construits et vérifiés autant que l'automatisation
> le permet :
> 1. **Toilettes trop faciles à activer** : « neartag » de Duke — un rayon Rapier
>    depuis l'œil, dans la direction visée, à 1,4 m ; une cloison bloque ; on
>    boit en visant le JET (`SanitaireSystem.resolveAim`, ADR 0032).
> 2. **Carré blanc au pied-de-biche** : c'était un muzzle flash déclenché pour
>    la mêlée aussi, quad blanc à 15 cm de l'œil. Supprimé ; le typage n'admet
>    plus `"melee"` pour un flash.
> 3. **Impacts qui flottent** : decal seulement sur le décor fixe (jamais sur
>    ennemi, joueur, prop, porte, vitre, sanitaire), giclée de sang sur un
>    ennemi (`updateFx.ts::isMovableOrBreakableHandle`).
> 4. **Secret 3 visible depuis la cafétéria** : la baie de 2 × 2 m n'avait
>    jamais eu de porte ; `door_secret_vmc`, grille de tôle perforée (matériau
>    du rideau Argent, donc 0 lot de plus), ouverte par `use_grille_vmc`,
>    hors de portée depuis le sol. Construit et exporté dans la session live.
> 5. **Pistolet « horrible »** : planche de références `docs/journal/playtests-2026-09.md`
>    (agent de recherche), puis Beretta 92FS bicolore reconstruit
>    (`build_weapons.py`, 360 triangles, culasse inox claire, prise et
>    `bout_canon` recalés, pompe et pied-de-biche identiques à l'octet). Vu en
>    jeu : lisible dans l'allée éclairée ET au parking de nuit.
> 6. **Écran de fin avec récap** : `game/session/score.ts` (comptage au pas
>    fixe, barème nommé : Costard 100, Directeur 1 000, secret 500 + 1 000 si
>    tous, précision ≤ 1 000, 10 pts/s sous `parTime`, vandalisme), récap
>    partiel à la mort, `RecapTable` révélé ligne par ligne.
> 7. **Réglages en jeu** : état `paused` de la machine de flux (déclenché par la
>    perte du verrouillage du pointeur), jeu flouté derrière, Paramètres
>    appliqués à chaud (`registerRenderTarget` dans `graphicsSettings.ts`).
> Au passage : `vitest.config.ts` exclut `.claude/**` (les worktrees de tâches
> parallèles faisaient échouer `pnpm test`). **Non vérifié** : tout ce qui
> passe par un vrai pointeur verrouillé (E, tir, Échap). `pnpm test` 391/391.
>
> **
