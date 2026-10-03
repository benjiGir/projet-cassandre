---
title: Validation de la documentation
tags: [journal, documentation]
status: brouillon
updated: 2026-09-26
---

# Validation de la documentation

## Période

26 septembre 2026.

## Objectif

Vérifier qu'une personne sans mémoire du projet peut répondre à dix
questions de reprise avec `docs/` seulement, puis contrôler ses réponses dans
le code. Le lecteur indépendant n'a consulté ni `CLAUDE.md` ni le code avant
d'avoir formulé ses réponses.

## Résultats et corrections

| Question | Résultat de la lecture à froid | Suite |
|---|---|---|
| Où changer les dégâts du pompe ? | Le guide pointait vers `WeaponConfig`, sans donner les valeurs ni préciser que le chiffre est par plomb. | Ajout de [Valeurs des armes](../6-reference/valeurs-armes.md), avec 6 PV par plomb, neuf plombs et le maximum théorique de 54 PV. |
| Comment ajouter un préfixe glTF ? | Le parcours existait, mais le point d'enregistrement dans le dispatch du loader et la mise à jour du `LevelHandle` n'étaient pas explicites. | Le guide précise l'ordre des branches `startsWith`, le contrat de données du handle et la limite du validateur face aux extras inconnus. |
| Pourquoi pas `Math.random()` ? | La référence du RNG déterministe répondait clairement et correspond au code. | Aucune correction nécessaire. |
| Où changer gravité et déplacement ? | Les pages des invariants et valeurs de déplacement donnent les bonnes sources et les unités. | Aucune correction nécessaire. |
| Quel minimum de télégraphie pour une attaque ? | La recette dépendait d'un skill externe à `docs/`. | Le plancher de lisibilité de 0,2 s, avec signaux visuel et sonore, figure désormais dans le guide et la référence des ennemis. |
| Comment ajouter une nouvelle carte de fidélité ? | Les catégories existantes étaient documentées, mais pas le travail transversal requis pour en ajouter une. | La référence décrit la liste/type/libellé, le loader, la validation Python, la session et leurs tests à garder synchronisés. |
| Que vérifie `pnpm check` ? | La commande ne lançait pas le vérificateur documentaire avant cette passe. | `pnpm check` inclut maintenant `pnpm check:docs`; la CI passe par cette même commande. |
| Comment reconstruire le niveau dans Blender ? | Le rôle de la session live et du connecteur était cité, mais l'ordre des opérations restait vague. | Les guides précisent d'ouvrir la source, vérifier la session MCP, lancer le constructeur dans Blender, attendre, inspecter puis valider et exporter. Le nom exact de l'action MCP varie selon l'installation. |
| Comment savoir si un son est réellement chargé ? | `present` pouvait être interprété comme un état de lecture, alors qu'il reflète la clé du manifeste. | Les pages audio disent ce que le champ mesure et ajoutent les vérifications Réseau, console et écoute. |
| Où modifier l'affichage d'un élément HUD ? | La page React indiquait clairement le widget, sa souscription au store et le rythme des mises à jour. | Aucune correction nécessaire. |

Le code confirme les dégâts dans `src/game/player/weapons/weaponConfig.ts` et les
neuf rayons dans `src/game/player/weapons/weapons.ts`. La liste des cartes vient de
`src/game/player/loyaltyCards.ts`, est relue par le loader et doit rester
alignée avec `tools/blender/validate_level.py`. `listSfx()` calcule bien
`present` depuis les seules clés du manifeste.

## Ce qui reste à relire

Le test à froid corrige les informations manquantes ; il ne remplace pas la
relecture humaine du parcours complet. Le jalon D69 attend votre retour sur
les pages du parcours « je découvre » avant que la phase J puisse être close.
