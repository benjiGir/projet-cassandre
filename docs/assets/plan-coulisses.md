---
title: Plan Les coulisses
tags: [niveau, assets, plan]
status: brouillon
updated: 2026-09-30
---

# Plan « Les coulisses » (validé le 2026-09-26)

Enrichir le couloir du personnel / raccourci / couloir de service (92 m vides)
par 6 pièces + 1 secret, et ajouter 3 systèmes réutilisés dans tout le niveau.

Cotes : `docs/assets/coulisses-plan.diff` (à appliquer à
`tools/level_v2/plan_de_masse.py` ; retirer le surlignage `NOUVEAUX` du SVG,
renommer `&` en « et » déjà fait). Contrôles du plan : tous OK.

## Pièces (z = 0)
A vestiaires (casiers E) · B fournil (farine cassable, poulet) · C PC sécurité
(console caméras) · D chambre froide (vivier cassable, carcasses) · E atelier
SAV (~40 TV animées cassables) · F compacteur (balles de carton, bouton gag) ·
★4 planque du vigile (secret 4, derrière les balles). Couloir de service
habillé (transpalettes/palettes props, distributeurs, néon qui clignote, fuite).

Habillage F et ★4 intégré le 30 septembre : presse verticale en maintenance,
balles cerclées, benne, palettes, caméra masquée ; canapé, télé sur la chaîne
foot, casier et butin dans la planque. Deux balles cassables masquent son
entrée. La pizza +25 est conservée sur la table basse. Le bouton gag et le
cycle de compression restent à construire. Vues, contrôles et limites dans
le [suivi de l’étape 3](../journal/analyse-agencement-2026-09-29.md#mise-en-œuvre-par-étapes).

Deux repères complètent le couloir coupe-feu le 30 septembre : entrée du SAV
bleue avec chariot de retours, entrée de la chambre froide jaune avec matériel
de maintenance. Palette, seau et fuite sont regroupés contre le mur est.
Le [suivi de l’étape 4](../journal/analyse-agencement-2026-09-29.md#mise-en-œuvre-par-étapes)
conserve les vues et les vérifications en jeu encore attendues.

## Systèmes
1. **Nourriture** : variante walk-over de `soin` (extra `aliment`), modèle +
   son dédié. donut 5, sandwich 10, jambon 15, poulet/pizza 25.
2. **Écrans animés** `ecran_*` : atlas de chaînes en boucle (journal
   reptilien, pubs marques inventées, mire, foot, fausse CCTV), extra
   `chaine`, cassables (`pv`) → neige/noir + étincelles. Horloge dérivée du
   pas fixe. Coût en lots mesuré.
3. **Destruction étendue** : `prop_*` gagne `matiere` farine/eau/electronique
   et `contenu` (lâché à la casse : canettes, nourriture).
4. **Caméras façon Duke** : `use_*` console → vue par caméras `cam_*`,
   cycle, sortie au mouvement (invariant #10), second rendu seulement pendant
   la vue. Une caméra sur le bureau du Directeur.

## Lots
1 structure (plan + blockout gris + nav) · 2 systèmes · 3 habillage A-C puis
D-F-★4 · 4 caméras · 5 semer nourriture/écrans/casse dans le reste de la carte.

## Contraintes
Invariants CLAUDE.md. Budget lots pire vue ≤ 200 à re-mesurer ; réutiliser
matériaux existants. `validate_level.py --strict`, `audit_niveau.py`,
`pnpm test` après chaque lot. Rapports d'agent : ≤ 10 lignes.
