---
title: "Portes et vitres — 2026-09-19"
tags: [journal, niveau]
status: stable
updated: 2026-09-26
---

# Portes et vitres — 2026-09-19

Troisième passe en direct dans Blender (2026-09-19), EN ATTENTE DU VERDICT
> DE PLAYTEST.** Retour après validation de la passe précédente : « des vraies
> portes qui bougent, des vraies vitres, et il est où mon rayon surgelés ? ».
> - **Cause racine des portes** : depuis la porte à badge de la Zone E
>   (2026-08-23), AUCUNE porte n'avait jamais bougé à l'écran. Le jeu faisait
>   glisser le CORPS Rapier — invisible — et coupait son collider ; rien ne
>   recopiait cette pose sur le mesh. Seuls les `prop_*` le faisaient. Corrigé
>   par `game/level/doors.ts::DoorSystem` ([ADR 0031](../decisions/0031-portes-animees-et-vitres.md)) :
>   corps FIXE à la pose fermée, collider actif seulement fermé, mesh animé au
>   pas fixe. Quatre mouvements en extras (`battant`, `coulisse`, `monte`,
>   `descend`), groupes de vantaux, et portes `auto` qui s'ouvrent devant qui
>   s'approche — joueur OU Costard, le bake de navigation les traversant.
> - **Le niveau passe de 5 boîtes grises à 20 vantaux** : sas d'entrée à
>   portes automatiques vitrées, va-et-vient « PRIVÉ » de la réserve, rideau
>   métallique de la carte Argent, portes doubles Or/sortie/coupe-feu, quatre
>   portes de bureau, porte capitonnée du Directeur. Un vantail est UN mesh à
>   UN matériau (deux matériaux = deux primitives glTF = un groupe que le
>   loader ne reconnaît plus), quincaillerie et verre pris dans sa propre
>   texture (`tools/textures/generate_portes.py`).
> - **Portes manœuvrables à la main** (retour du 2026-09-20) : les quatre
>   portes de bureau ne s'ouvrent plus par proximité, mais à la touche E
>   (`manuelle: true`) ; elles gardent `auto: "ennemis"` pour que les Costards
>   les poussent et que le graphe de navigation les traverse. La porte
>   coupe-feu des rayons se REFERME à la main (`manuelle: "fermer"`) sans
>   perdre son sens unique : son bouton, hors de portée côté rayons, reste le
>   seul moyen de l'ouvrir.
> - **Vitres réelles** (`vitre_*`, `VitreSystem`) : la transparence n'a jamais
>   été interdite par l'invariant #5, qui porte sur le MODÈLE D'ÉCLAIRAGE —
>   plusieurs docstrings de `lib_*.py` affirmaient le contraire et ont privé le
>   niveau de verre pendant tout N9. Cloisons vitrées de l'étage et panneaux du
>   sas CASSABLES (`pv`), fenêtres sur la ville et verrières de la galerie
>   incassables et sans collider (`solide: false` — un collider au plafond
>   serait pris pour le sol par le bake de navigation). Les verrières étaient
>   jusqu'ici fermées par un panneau blanc OPAQUE : le ciel de nuit ne s'y
>   voyait pas, contrairement à ce qui avait été annoncé à la passe précédente.
> - **Rayon surgelés**, promis par le plan depuis le premier jour et jamais
>   construit : six armoires à portes vitrées contre le mur ouest dans le
>   prolongement du frais, deux bacs congélateurs à couvercles vitrés, douze
>   marques inventées de plus (`prd_surgeles`, atlas qui porte à la fois des
>   faces et deux bandes), bandeau et lumière froide. Casser une vitre lâche
>   du givre (`givre: true`).
> **Budget de lots, remesuré en jeu à quinze points de vue** : ce qui ne
> fusionne jamais coûte par objet DANS LE CÔNE, occultation comprise. Vingt
> vantaux coûtaient jusqu'à 13 lots dans une vue, le verre découpé en cellules
> jusqu'à 6, et les `use_*` n'avaient AUCUN élagage (21 lots depuis les
> caisses, dont une trousse à 150 m). Remèdes : `BatchedMesh` par matériau pour
> les vantaux (6 lots pour 20), un seul lot pour tout le verre, élagage à 48 m
> des `use_*`. Pire vue mesurée **188/200**, contre 219 avant ces trois
> correctifs et 198 avant toute la passe — tableau dans
> [Ce que coûte une image](../archive/systems-cout-de-rendu.md#ce-qui-ne-fusionne-jamais).
> Mesuré aussi : `validate_level.py --strict` 0 erreur et 7 warnings connus,
> `audit_niveau.py` à zéro partout, plan de masse relié, graphe de navigation
> qui traverse sas, va-et-vient et portes de bureau, `pnpm build` propre,
> `pnpm test` 282/282. **Non vérifié** : jouer — la sensation d'une porte qui
> s'ouvre devant soi, casser une vitre au fusil, le combat derrière les
> cloisons vitrées de l'étage.
>
> **
