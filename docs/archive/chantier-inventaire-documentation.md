---
title: Inventaire des sources (D0)
tags: [archive, documentation, inventaire]
status: perime
updated: 2026-09-25
---

# Inventaire des sources (D0)

> Archive du jalon D0. Cet inventaire décrit la migration terminée ; partez de
> [la documentation actuelle](../README.md) pour chercher une information.

Jalon D0 du `PLAN_DOCUMENTATION.md`. Chaque source de connaissance existante
est ici découpée par section (`##`/`###`) et reçoit une nature et une
destination dans l'arborescence cible (section 1 du plan). Quand plusieurs
`###` consécutifs partagent la même nature et la même destination (cas
fréquent dans les journaux de chantier), ils sont regroupés en une seule
ligne — le titre de la ligne cite alors le premier et le dernier titre du
groupe. Aucune section n'est laissée sans destination.

Nature : `fonctionnel` · `technique` · `architecture` · `guide` · `reference`
· `journal` · `piege` · `perime` · `adr`.

---

## docs/README.md

| Section | Nature | Destination | Note |
|---|---|---|---|
| (tout le fichier — c'est l'actuelle carte) | guide | `docs/README.md` | Remplacé intégralement par la nouvelle carte (D7) : structure « je découvre / je veux comprendre / je veux modifier / je cherche une valeur » au lieu d'un sommaire par ancien dossier. Rien à en récupérer verbatim. |

## docs/pipeline/assets.md

| Section | Nature | Destination | Note |
|---|---|---|---|
| Bandeau « brouillon, destination de migration » | perime | — | Boilerplate de migration jamais rempli ; à supprimer, pas à migrer. |
| Chemins des assets au déploiement | technique | `6-reference/arborescence.md` | Comportement de `assetUrl`/`BASE_URL` toujours vrai (vérifié contre `src/core/loading/assetPath.ts`, cité aussi dans l'audit `etat-des-lieux-code-architecture.md`). Renvoi secondaire utile depuis `4-technique/chargement-de-niveau.md`. |

## docs/pipeline/textures.md

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro (renvoi conventions-nommage) | technique | `4-technique/rendu.md` | — |
| Contrat `configureRetroTexture` | technique | `4-technique/rendu.md` | À vérifier au passage D35 : le texte signale lui-même deux implémentations indépendantes du même invariant (`renderer.ts` vs `loader.ts`) — piège potentiel, à recouper avec le code puis lister dans `5-guides/pieges-connus.md` si toujours vrai. |
| Atlas placeholder de billboard | technique | `4-technique/sprites-et-viewmodel.md` | Décrit un repli (`createPlaceholderAtlas`) devenu secondaire depuis les vrais sprites pré-rendus (ADR 0028) — à formuler comme repli, pas comme système principal. |

## docs/pipeline/niveau-blender.md (714 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Vue d'ensemble du pipeline | technique | `4-technique/chargement-de-niveau.md` | Cœur du chapitre chargement. |
| Convention spawn_player | reference | `6-reference/conventions-nommage.md` | Doublon partiel avec `docs/reference/conventions-nommage.md` — fusionner. |
| Extraction et le piège des transforms | piege | `4-technique/chargement-de-niveau.md` + `5-guides/pieges-connus.md` | — |
| Le nom tel que tapé dans Blender | technique | `4-technique/chargement-de-niveau.md` | — |
| Hiérarchie des colliders | technique | `4-technique/chargement-de-niveau.md` | Recoupe ADR 0004. |
| Triggers et secrets | technique | `4-technique/systemes-de-niveau.md` | — |
| Portes | technique | `4-technique/systemes-de-niveau.md` | Recoupe ADR 0012 (remplacé par 0031) et ADR 0031 — vérifier que le texte reflète bien le remplacement (mesh piloté par `DoorSystem`, pas le vieux comportement corps-invisible). |
| Objets interactifs | technique | `4-technique/systemes-de-niveau.md` | — |
| Cycle de vie du LevelHandle | technique | `4-technique/chargement-de-niveau.md` | — |
| Fusion du décor statique | technique | `4-technique/budget-de-rendu.md` | Recoupe ADR 0023/0026. |
| Hot reload | technique | `4-technique/chargement-de-niveau.md` | Recoupe ADR 0011 ; le texte doit refléter le garde `import.meta.env.DEV` ajouté le 2026-09-21 (CLAUDE.md) — à vérifier, sinon écart. |
| Kit modulaire et assemblage — Piège instancing-vs-bake | piege | `4-technique/outillage-blender.md` + `5-guides/pieges-connus.md` | — |
| … Piège du parent inverse non réévalué | piege | `4-technique/outillage-blender.md` + `5-guides/pieges-connus.md` | Groupé avec le précédent (même famille de piège Blender). |
| … Convention de placement des rangées | technique | `4-technique/outillage-blender.md` | — |
| … Vantail de porte recentré (kit_door_leaf) | piege | `4-technique/outillage-blender.md` + `5-guides/pieges-connus.md` | Recoupe ADR 0012. |
| … Vantaux et vitres du niveau v2 | technique | `4-technique/systemes-de-niveau.md` | Recoupe ADR 0031. |
| … Dalles sur-mesure et chevauchement | piege | `5-guides/pieges-connus.md` | — |
| … Mondes orphelins dans le niveau combiné | piege | `5-guides/pieges-connus.md` | — |
| … Occlusion des rangées de kit | technique | `4-technique/ennemis-et-ia.md` | Recoupe ADR 0022/0025 — la cause racine (broad-phase Rapier vide avant le premier pas) est documentée à l'ADR 0025, vérifier cohérence. |
| Bake d'éclairage (vertex colors) — Les proxies sont des occultants… | technique | `4-technique/eclairage.md` | — |
| … Diagnostic d'un mesh entièrement noir | piege | `4-technique/eclairage.md` + `5-guides/pieges-connus.md` | — |
| … Combined vs Diffuse | technique | `4-technique/eclairage.md` | — |
| … Un bake par sommet exige des sommets | piege | `5-guides/pieges-connus.md` | — |
| … Le plancher d'éclairage d'une salle close | piege | `5-guides/pieges-connus.md` | — |
| … La forme de la source fait l'ombre | technique | `4-technique/eclairage.md` | — |
| … Une couleur par sommet ne peut pas montrer une arête | technique | `4-technique/eclairage.md` | — |
| … Le rebond diffus décide du contraste | technique | `4-technique/eclairage.md` | — |
| … Cuire l'indirect seul — montage hybride | technique | `4-technique/eclairage.md` | Recoupe ADR 0024. |
| … Une source de lumière ressort noire | piege | `5-guides/pieges-connus.md` | — |
| Critère de validation | technique | `4-technique/outillage-blender.md` | Renvoi vers `validate_level.py`, matière pour `6-reference/commandes.md`. |

## docs/pipeline/harmonisation-assets.md (273 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Textures | technique | `4-technique/generateurs.md` | — |
| Étiquettes et trim sheet | technique | `4-technique/generateurs.md` | — |
| Affiches de marques | fonctionnel | `2-fonctionnel/le-niveau.md` | Satire des marques inventées — ton du jeu, pas juste technique. |
| Import d'un asset | guide | `5-guides/modifier-le-niveau.md` | — |
| La bibliothèque livrée (jalon N4) | journal | `journal/niveau-v2.md` | Gate de richesse N4, daté. |
| Des rayons à thème, pas un tas | fonctionnel | `2-fonctionnel/le-niveau.md` | — |
| Un rayon garni se fabrique, il ne se modèle pas | technique | `4-technique/outillage-blender.md` | — |
| Trois pièges de composition trouvés en regardant | piege | `5-guides/pieges-connus.md` | — |
| Regarder au bon champ de vision | technique | `4-technique/outillage-blender.md` | Lié au skill `visual-critique-loop`. |
| Nommage | reference | `6-reference/conventions-nommage.md` | — |

## docs/game/niveau-v2-plan-de-masse.md (262 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Le plan en un coup d'œil | fonctionnel | `2-fonctionnel/le-niveau.md` | Avec le SVG du plan de masse (`assets/`). |
| Ce que le plan devait respecter | architecture | `3-architecture/vue-d-ensemble.md` | Contraintes de conception (pathfinding 2.5D, un seul sol par colonne). |
| Les dix espaces (1. Parking… 10. Bureaux direction) | fonctionnel | `2-fonctionnel/le-niveau.md` | Groupé — dix `###`, même destination. Vérifier les cotes contre `tools/level_v2/plan_de_masse.py` au passage D21 (le plan a été régénéré au moins une fois, cf. CLAUDE.md « la carte n'avait pas été régénérée depuis N8 »). |
| Le parcours et les trois cartes | fonctionnel | `2-fonctionnel/le-niveau.md` | Cartes Argent/Or/Platine — aussi `2-fonctionnel/secrets-et-score.md` pour la progression. |
| Vérifications | technique | `4-technique/budget-de-rendu.md` | Comptes `validate_level.py`/`audit_niveau.py` à une date donnée — à dater en journal plutôt qu'affirmer comme état courant. |
| Les deux arbitrages, tranchés (échelle, budget de rendu) | journal | `journal/niveau-v2.md` | Décisions actées avec date. |
| Ce qui n'est pas tranché ici | journal | `journal/niveau-v2.md` | — |

## docs/game/niveau-hypermarche.md

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro + Zones individuelles | fonctionnel | `2-fonctionnel/le-niveau.md` | Table zones ↔ `startUnarmed` ↔ rôle ; reprend aussi dans `6-reference/arborescence.md` pour `LEVEL_CHOICES`. |
| Zone D — pas de spawn d'ennemi sur la mezzanine | technique | `4-technique/pathfinding.md` | Le texte note lui-même que la prémisse est « partiellement dépassée » depuis M4 — bon candidat pour `docs/_chantier/ecarts.md` si D30 confirme qu'aucune zone n'exploite le pathfinding sur verticalité. |

## docs/game/univers.md

| Section | Nature | Destination | Note |
|---|---|---|---|
| (fichier entier) | perime | — | Stub de migration jamais rempli (« Brouillon — destination de migration »), aucun contenu réel. Rien à migrer ; le contenu « univers/pitch/ton » attendu doit être écrit à neuf en `1-introduction/le-projet.md` depuis `PLAN_PROTO_BOOMER_SHOOTER.md` §0 et le pitch dans `README.md`. |

## docs/game/plan-prototype.md

| Section | Nature | Destination | Note |
|---|---|---|---|
| Bandeau « partiellement migré » | perime | — | À supprimer. |
| Phase 1 — Gym, instrument de mesure | technique | `2-fonctionnel/deplacement-et-controles.md` + `5-guides/reprendre-le-projet.md` | Contenu réel et à jour (gym.ts toujours l'instrument de mesure) ; le renvoi vers `../reference/threejs-rapier.md` en fin de page est mort (fichier stub vide, voir plus bas) — écart de lien à corriger dans D65. |

## docs/systems/joueur.md (158 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro | technique | `4-technique/joueur.md` | — |
| Résolution du pas fixe | technique | `4-technique/joueur.md` | — |
| Deux garde-fous contre la dégénérescence de Rapier (+ 4 sous-sections) | piege | `4-technique/joueur.md` + `5-guides/pieges-connus.md` | Groupé : reclip mur/pente, groundStickSpeed, snap-to-ground suspendu, vitesse d'impact. Recoupe ADR 0015/0016. |
| Vue : head bob, FOV dynamique, réception de saut | technique | `4-technique/joueur.md` | — |
| Rampe linéaire, pas exponentielle (approach()) | technique | `4-technique/joueur.md` | Recoupe ADR 0015. |
| Harnais A/B — FEEL_VARIANTS | guide | `5-guides/regler-la-sensation.md` | — |

## docs/systems/debug.md (246 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro + Champs de DebugState (+ 4 sous-sections) | technique | `4-technique/debug.md` | — |
| Origine du module game/devtools | architecture | `4-technique/debug.md` | — |
| Point d'entrée console (window.cassandre) (+ 3 sous-sections) | reference | `6-reference/console-cassandre.md` | Cœur de la future page console — vérifier l'API contre `consoleApi.ts` (le fichier a beaucoup grossi, ex. `cassandre.sfx.*`, `cassandre.doors()`, non listés ici). |
| Simulation hors écran et preuve de déterminisme | technique | `4-technique/rejeu-et-determinisme.md` | — |
| Harnais A/B — protocole général | guide | `5-guides/regler-la-sensation.md` | — |

## docs/systems/hud.md (417 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Composition de App | architecture | `4-technique/interface-react.md` | — |
| Flux d'écran | architecture | `3-architecture/effect-et-xstate.md` + `4-technique/interface-react.md` | Machine XState de flux (M8, ADR 0019/0020). |
| HUD de production | fonctionnel + technique | `2-fonctionnel/interface.md` (partie vécue) / `4-technique/interface-react.md` (partie store) | Scinder au moment de la rédaction. |
| Deux canaux de message — HudMessage et HeroLine | technique | `4-technique/interface-react.md` | — |
| Menu principal et écran de choix de niveau | fonctionnel | `2-fonctionnel/interface.md` | — |
| Écran de chargement | fonctionnel | `2-fonctionnel/interface.md` | — |
| Écrans de mort et de fin de niveau | fonctionnel | `2-fonctionnel/interface.md` | — |
| Rebinding | fonctionnel | `2-fonctionnel/deplacement-et-controles.md` | Aussi `6-reference/controles.md`. |
| Options — contrôles et affichage | fonctionnel | `2-fonctionnel/interface.md` | Le mode d'affichage (ADR 0027) est un critère de jugement humain encore en attente — le dire explicitement (« état : en attente de verdict »). |
| Panneau de tuning à chaud | guide | `5-guides/regler-la-sensation.md` | — |

## docs/systems/armes.md (275 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro | technique | `4-technique/armes.md` | — |
| Discipline de déterminisme | technique | `4-technique/rejeu-et-determinisme.md` | Recoupe ADR 0007/0033. |
| Pistolet (2026-09-16) | fonctionnel + technique | `2-fonctionnel/armes.md` / `4-technique/armes.md` | Refonte visuelle du 2026-09-25 mentionnée dans `tools/blender/README.md` — vérifier que cette section cite le bon modèle (Beretta 92FS) et pas un état antérieur. |
| Architecture munitions : un seul pool | technique | `4-technique/armes.md` | — |
| Armement, ramassage, désarmement (+ Ramassage automatique 2026-09-25) | fonctionnel + technique | `2-fonctionnel/armes.md` / `4-technique/armes.md` | Le ramassage automatique en marchant dessus est très récent (commit `6b768f1`) — bon test du principe « le code fait foi ». |
| Matériau perçu et hitstop mur/ennemi | technique | `4-technique/armes.md` | — |
| Pied-de-biche : portée en capsule | technique | `4-technique/armes.md` | — |
| Pompe : dispersion en cône | technique | `4-technique/armes.md` | — |
| Files d'événements de frame (fireEvents/hitEvents) | technique | `3-architecture/simulation-et-presentation.md` | Directement lié aux P0 de l'audit (retraitement multi-pas-fixe) — vérifier la note « curseur explicite » (ADR 0010) est bien reflétée après le fix « Restaurer les invariants de simulation ». |
| Harnais A/B (+ 4 sous-sections) | guide | `5-guides/regler-la-sensation.md` | Groupé : recul, hitstop/shake, hitmarker, réticule. |

## docs/systems/rendu.md (894 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Invariant #5 — reconversion depuis GLTFLoader | architecture | `3-architecture/invariants.md` + `4-technique/rendu.md` | — |
| Filtrage des textures | technique | `4-technique/rendu.md` | Recoupe ADR 0027 (amendement en attente) — préciser l'état non tranché. |
| Éclairage de secteur baké en vertex colors | technique | `4-technique/eclairage.md` | Recoupe ADR 0005. |
| Éclairage de scène selon le niveau (+ hybride, pool de lampes) | technique | `4-technique/eclairage.md` | Recoupe ADR 0024/0026. |
| Ciel | technique | `4-technique/rendu.md` | — |
| Découplage entre render et game | architecture | `3-architecture/carte-des-modules.md` | — |
| Temps réel contre pas fixe dans render | architecture | `3-architecture/boucle-et-temps.md` | — |
| Sprites billboard 8 directions | technique | `4-technique/sprites-et-viewmodel.md` | Recoupe ADR 0017 et skill `billboard-sprites-8dir`. |
| Animation des sprites d'ennemis (+ Éclairage des sprites, Lisibilité) | technique | `4-technique/sprites-et-viewmodel.md` | Recoupe ADR 0028, y compris la révision du 2026-09-14 (lisibilité) — vérifier que cette section la mentionne. |
| Effets visuels de tir (FxSystem) | technique | `4-technique/rendu.md` | — |
| … Le pied-de-biche n'a plus de muzzle flash (2026-09-24) | journal | `journal/playtests-2026-09.md` + `4-technique/rendu.md` | Correctif de playtest daté — le contenu technique reste dans rendu.md, l'historique du bug part au journal. |
| … Sanitaires cassés : gerbe + fontaine (InstancedMesh) | technique | `4-technique/systemes-de-niveau.md` | Recoupe ADR 0032 — statut « en attente de playtest » à conserver. |
| Overlays canvas 2D hors React (réticule, hitmarker) | technique | `4-technique/rendu.md` | — |
| Gizmos balistiques de debug | technique | `4-technique/debug.md` | — |
| Le mesh d'arme affiché à l'écran (Viewmodel) (+ 4 sous-sections) | technique | `4-technique/sprites-et-viewmodel.md` | Groupé : modèles Blender, animation, passage devant les murs, ramassages au sol dont le §2026-09-25 armes au sol. Recoupe ADR 0029. |
| Bascule wireframe de debug | technique | `4-technique/debug.md` | — |

## docs/systems/pathfinding.md (173 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro | technique | `4-technique/pathfinding.md` | — |
| Du chargement du niveau à la direction de poursuite | technique | `4-technique/pathfinding.md` | — |
| Comment le graphe est construit | technique | `4-technique/pathfinding.md` | — |
| Dimensionné sur le Costard, jamais sur le Directeur | technique | `4-technique/pathfinding.md` | — |
| MAX_STEP_HEIGHT | reference | `6-reference/valeurs-ennemis.md` + `4-technique/pathfinding.md` | Le décalage connu (1,0 m vs marche réelle 0,35 m, CLAUDE.md) est un écart candidat — vérifier s'il est corrigé depuis. |
| Un service qui ne garde aucun état | architecture | `4-technique/pathfinding.md` | — |
| Limite verticale acceptée | technique | `4-technique/pathfinding.md` | — |
| Coût | technique | `4-technique/budget-de-rendu.md` | Coût CPU du pathfinding, pas du rendu — vérifier si une page dédiée vaut mieux que de le noyer dans budget-de-rendu ; à défaut `4-technique/pathfinding.md`. |

## docs/systems/boucle-de-jeu.md (278 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Vue d'ensemble : ordre d'exécution d'une frame | architecture | `3-architecture/boucle-et-temps.md` | Diagramme candidat (Mermaid). |
| Origine des modules game/loop/ | architecture | `3-architecture/carte-des-modules.md` | — |
| Ordre des callbacks | technique | `4-technique/joueur.md`/`4-technique/ennemis-et-ia.md` (renvoi croisé) | — |
| Ordre de la frame d'affichage | architecture | `3-architecture/boucle-et-temps.md` | — |
| Ce que la boucle garantit à chaque frame | architecture | `3-architecture/boucle-et-temps.md` | — |
| Fin de partie pendant le pas fixe | technique | `3-architecture/simulation-et-presentation.md` | Lié au P0 « dégâts/mort hors pas fixe » de l'audit — vérifier que ce texte reflète le fix (étape 1, marquée « Terminée » dans `etat-des-lieux-code-architecture.md`). |
| Filet de chute | technique | `4-technique/chargement-de-niveau.md` | `game/session/player/fallRescue.ts`. |
| Mesure des temps de frame (LoopStats) | technique | `4-technique/budget-de-rendu.md` | — |
| Entrée synchronisée au pas fixe | technique | `3-architecture/boucle-et-temps.md` | — |
| Enregistrement et rejeu d'input | technique | `4-technique/rejeu-et-determinisme.md` | — |
| Frontière Effect synchrone du pas fixe | architecture | `3-architecture/effect-et-xstate.md` | Invariant #11. |
| Hitstop | technique | `4-technique/armes.md` + `5-guides/regler-la-sensation.md` | — |

## docs/systems/hud-audio.md (524 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Effets sonores ponctuels | technique | `4-technique/audio-runtime.md` | — |
| Assets sonores (+ Catalogue, Boucles exactes, Prise réelle, Grain rétro, Pourquoi la synthèse, Mesure) | technique + journal | `4-technique/audio-runtime.md` (technique) / `journal/audio.md` (les quatre passes rejetées) | Le contenu mesure/méthode va en technique ; l'historique des rejets va au journal, déjà résumé dans la mémoire `project_audio_studio.md`. |
| Ce que l'agent ne peut pas faire | guide | `5-guides/pieges-connus.md` | Limite d'outillage, pas un piège de code, mais même utilité pratique. |
| Pooling et variation de pitch | technique | `4-technique/audio-runtime.md` | — |
| Piège navigateur : déblocage du contexte audio | piege | `5-guides/pieges-connus.md` | — |
| Boucle d'eau positionnelle | technique | `4-technique/audio-runtime.md` | Ajout du 2026-09-24, vérifier `waterAmbience.ts` toujours en place. |
| Musique et nappe d'ambiance | technique | `4-technique/audio-runtime.md` | Rappel : PLACEHOLDER assumé (CLAUDE.md Phase 6) — à dire explicitement. |
| Ducking pendant les répliques | technique | `4-technique/audio-runtime.md` | — |

## docs/systems/physique.md (249 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro | technique | `4-technique/physique.md` | — |
| Groupes de collision | technique | `4-technique/physique.md` | Recoupe ADR 0008. |
| Props dynamiques | technique | `4-technique/systemes-de-niveau.md` | Recoupe ADR 0030. |
| Colliders invisibles aux rayons avant le premier pas | piege | `4-technique/physique.md` + `5-guides/pieges-connus.md` | Recoupe ADR 0025 — cause racine des « embuscades » Zones C/D des anciens journaux. |
| Service de raycasting (RaycastService) | technique | `4-technique/physique.md` | — |

## docs/systems/cout-de-rendu.md (225 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro + La machine de mesure + Comment mesurer | technique | `4-technique/budget-de-rendu.md` | — |
| Les triangles ne coûtent presque rien | technique | `4-technique/budget-de-rendu.md` | — |
| Les lampes coûtent, et elles ont un mur (+ Le mur : 254 lampes) | technique | `4-technique/budget-de-rendu.md` | Recoupe le pool de lampes (ADR 0026). |
| Découpe du décor en cellules (+ Le coude se déplace…) | technique | `4-technique/budget-de-rendu.md` | Recoupe ADR 0023/0026 ; la bonne taille de cellule (32 m → 48 m) a changé plusieurs fois — dater précisément. |
| Ce que ça change pour le niveau v2 | journal | `journal/niveau-v2.md` | — |
| Ce qui ne fusionne jamais | reference | `4-technique/budget-de-rendu.md` + `5-guides/pieges-connus.md` | Table de référence utile telle quelle. |

## docs/systems/entites.md (393 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Vue d'ensemble et diagramme d'états | technique | `4-technique/ennemis-et-ia.md` | Diagramme Mermaid déjà présent probablement en ASCII — à convertir. |
| Le contrat minimal partagé par toute entité (Entity) | architecture | `3-architecture/carte-des-modules.md` | — |
| Suit et Director : deux fines couches | technique | `4-technique/ennemis-et-ia.md` | Recoupe ADR 0009. |
| La machine partagée (+ 5 sous-sections : ce qui vit où, deux catégories de données, pourquoi hors des gardes XState, réassigner depuis les tests, zéro allocation, interdiction after) | technique | `4-technique/ennemis-et-ia.md` | Groupé — cœur technique de la machine XState. L'interdiction d'`after` recoupait l'ex-invariant #13 (retiré le 2026-09-25, `stateTimer`/`tickEnemy` reste le choix actuel du code). |
| Navigation (+ Perception) | technique | `4-technique/pathfinding.md` | — |
| Les managers (SuitManager et DirectorManager) | technique | `4-technique/ennemis-et-ia.md` | — |
| Carte lâchée par le Directeur | fonctionnel | `2-fonctionnel/secrets-et-score.md` | Carte Platine. |
| Configuration et tuning à chaud (SuitConfig/DirectorConfig) | reference | `6-reference/valeurs-ennemis.md` | — |

## docs/systems/session.md (584 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Le cycle de vie d'une partie, du boot au reset | architecture | `3-architecture/cycle-de-vie.md` | — |
| L'état persistant du process (GameEngine) | architecture | `3-architecture/cycle-de-vie.md` | Recoupe ADR 0014. |
| Un type intermédiaire pour éviter une dépendance circulaire (PersistentEngine) | architecture | `3-architecture/cycle-de-vie.md` | Recoupe ADR 0014. |
| Savoir si le monde physique est vivant (isPhysicsSessionLive) | architecture | `3-architecture/cycle-de-vie.md` | Recoupe ADR 0013. |
| L'état propre à une partie (GameSession) | architecture | `3-architecture/cycle-de-vie.md` | — |
| Construire une partie / Démolir une partie | architecture | `3-architecture/cycle-de-vie.md` | Vérifier contre le chantier « Make session lifecycle transactional » (commit `05e1084`, étape 2 de l'audit, marquée « Terminée ») — page probablement en retard sur le code, candidat fort à `ecarts.md`. |
| Rejouer et retour au menu | technique | `3-architecture/cycle-de-vie.md` | Même vérification que ci-dessus. |
| Choix du niveau au boot | fonctionnel | `2-fonctionnel/le-niveau.md` | — |
| Spawn et chargement de niveau | technique | `4-technique/chargement-de-niveau.md` | — |
| Cartes de fidélité | fonctionnel | `2-fonctionnel/objets-interactifs.md` | — |
| Portes et fin de niveau | fonctionnel + technique | `2-fonctionnel/objets-interactifs.md` / `4-technique/systemes-de-niveau.md` | `door_e_exit`/`door_exit` — vérifié à jour contre `src/game/session/progression/doors.ts` (pas d'écart, le code gère bien les deux noms). |
| Feedback joueur | fonctionnel | `2-fonctionnel/interface.md` | — |
| Récapitulatif de fin de partie | fonctionnel | `2-fonctionnel/secrets-et-score.md` | — |
| Pause | fonctionnel | `2-fonctionnel/interface.md` | — |
| Harnais F9 et F10 | technique | `4-technique/rejeu-et-determinisme.md` | — |
| Origine des modules game/session | architecture | `3-architecture/carte-des-modules.md` | — |

## docs/assets/board-hypermarche.md (147 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Vue d'ensemble chiffrée | reference | `journal/niveau-v2.md` | Board de référence visuelle, daté — matière de N3. |
| Décisions qui en découlent | journal | `journal/niveau-v2.md` | — |
| Ce qui se transfère / ne se transfère pas | guide | `5-guides/modifier-le-niveau.md` | Méthode réutilisable, recoupe skill `reference-driven-authoring`. |
| Manques du board | journal | `journal/niveau-v2.md` | — |
| Écart avec le kit v1 (historique) | journal | `journal/niveau-v2.md` | — |

## docs/assets/board-pistolet.md (625 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| 1. Diagnostic du pistolet actuel (+ 3 sous-sections) | journal | `journal/playtests-2026-09.md` | Retour « pistolet horrible », daté. |
| 2. Le modèle retenu (+ pourquoi celui-là / pas les autres) | journal | `journal/playtests-2026-09.md` | À vérifier contre la refonte du 2026-09-25 mentionnée dans `tools/blender/README.md` : ce board date d'avant, le modèle final a pu changer de détails (culasse inox, etc.) — recouper avant de citer comme état courant. |
| 3. Contraintes mesurables (+ 6 sous-sections) | guide | `5-guides/ajouter-une-arme.md` | Méthode transférable à toute arme future. |
| 4. Ce que la caméra voit (+ 2 sous-sections) | journal | `journal/playtests-2026-09.md` | — |
| 5. Références (jeux, armes réelles, articles) | journal | `journal/playtests-2026-09.md` | Ne pas migrer les images/citations telles quelles (droit d'auteur) — lien seulement. |
| 6. Ce qui n'a pas été vérifié | journal | `journal/playtests-2026-09.md` | — |

## docs/reference/react-structure.md (182 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Tout le fichier (L'arbre, sortes de dossiers, ce qui va où, nommage, pas d'index, un composant par fichier, données pas du JSX, ce qui ne vit pas dans src/ui, tests) | reference | `6-reference/react-structure.md` (repris tel quel) | Convention non négociable (CLAUDE.md) — page reprise et vérifiée, pas réécrite. Contradiction à surveiller avec l'instruction utilisateur globale « jamais d'index.ts barrel » — ce doc dit déjà « pas de fichier index », cohérent. |

## docs/reference/react-css.md (190 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Tout le fichier | reference | `6-reference/react-css.md` | Repris tel quel, relu. |

## docs/reference/react-composition.md (145 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Tout le fichier | reference | `6-reference/react-composition.md` | Repris tel quel, relu. |

## docs/reference/react-bonnes-pratiques.md (189 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Tout le fichier | reference | `6-reference/react-bonnes-pratiques.md` | Repris tel quel ; alimente aussi `5-guides/conventions-de-code.md` par renvoi. |

## docs/reference/controles.md (151 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Actions de gameplay et bindings par défaut | reference | `6-reference/controles.md` | — |
| Touches de dev | reference | `4-technique/debug.md` + `6-reference/controles.md` | — |
| Pourquoi ça marche déjà en AZERTY | technique | `4-technique/interface-react.md` | `KeyboardEvent.code` — constat de la Phase 6. |
| Limite : libellés de touches en AZERTY | piege | `5-guides/pieges-connus.md` | — |
| Persistance et couche par action | technique | `4-technique/interface-react.md` | — |

## docs/reference/threejs-rapier.md

| Section | Nature | Destination | Note |
|---|---|---|---|
| (fichier entier) | perime | — | Stub de migration jamais rempli. **Piège de lien** : `docs/game/plan-prototype.md` pointe encore dessus pour « les deux bugs de stutter » — contenu réel disponible dans le skill `threejs-rapier-fieldguide` et dans `docs/reference/etat-des-lieux-code-architecture.md`, à rapatrier en `6-reference/threejs-rapier.md` + `5-guides/pieges-connus.md`. |

## docs/reference/etat-des-lieux-code-architecture.md (600 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Verdict exécutif | journal | `journal/audit-architecture-2026-09.md` | — |
| Périmètre et limites de l'audit | journal | `journal/audit-architecture-2026-09.md` | — |
| Tableau de situation | journal | `journal/audit-architecture-2026-09.md` | — |
| Forces à conserver (+ 3 sous-sections) | architecture | `3-architecture/vue-d-ensemble.md` | — |
| Constats prioritaires (7 × P0/P1) | journal | `journal/audit-architecture-2026-09.md` | **Vérifié** : le fichier lui-même porte un tableau « Suivi d'exécution » daté du 25/09/2026 marquant les 4 étapes de remédiation « Terminée » (recoupe les commits `45b9cec`, `a6277e9`, `05e1084`, `ede868d`) — ce n'est donc pas un audit en attente mais un chantier soldé. Les pages `3-architecture/simulation-et-presentation.md` et `3-architecture/cycle-de-vie.md` doivent refléter l'état APRÈS remédiation, pas les P0/P1 tels que décrits (qui étaient l'état AVANT). |
| Architecture : approfondir les bons seams (5 sous-sections) | architecture | `3-architecture/vue-d-ensemble.md` + `3-architecture/carte-des-modules.md` | Le point 3 (« extraire une couche application/shell ») correspond au commit `a6277e9` déjà réalisé — vérifier que `src/app/` existe. |
| Déterminisme : aligner les promesses, le code et les ADR (+ 2 sous-sections) | technique | `4-technique/rejeu-et-determinisme.md` | Le sous-titre « Math.random() est une contradiction de gouvernance » recoupe l'invariant #12/ADR 0007 — vérifier qu'aucun `Math.random()` résiduel n'existe (l'audit datait d'avant la remédiation). |
| UI React : bonne base, application incomplète | architecture | `4-technique/interface-react.md` | — |
| Dette documentaire et commentaires | journal | `journal/audit-architecture-2026-09.md` | Point de départ du chantier D0 lui-même. |
| Assets et contenu de production | journal | `journal/audit-architecture-2026-09.md` | — |
| État des validations au moment de l'audit | journal | `journal/audit-architecture-2026-09.md` | — |
| Plan de remédiation ordonné (+ Suivi d'exécution + 5 étapes) | journal | `journal/audit-architecture-2026-09.md` | Table de suivi = la preuve la plus fiable de ce fichier ; à recopier intégralement dans le journal. |
| Ce qu'il ne faut pas faire | architecture | `3-architecture/vue-d-ensemble.md` | Contraintes de non-réécriture (pas d'ECS, pas de remplacement de Rapier) — recoupe les invariants. |
| Conclusion | journal | `journal/audit-architecture-2026-09.md` | — |

## docs/reference/conventions-nommage.md (444 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Préfixes glTF | reference | `6-reference/conventions-nommage.md` | Repris tel quel — doublon avec la table de `CLAUDE.md` (« Conventions de nommage glTF »), source de vérité unique à choisir en D66. |
| Custom properties (+ 7 sous-sections : cartes, portes libres, trousses, munitions, armes au sol, props physiques, portes animées, vitre, sanitaire) | reference | `6-reference/conventions-nommage.md` | Groupé — table de référence, à jour (sanitaire_* et vitre_* sont les ajouts les plus récents, cohérents avec CLAUDE.md 2026-09-23/24). |
| Constantes de construction | reference | `6-reference/conventions-nommage.md` | — |
| Classes de pièce du kit modulaire | reference | `6-reference/conventions-nommage.md` + `4-technique/outillage-blender.md` | — |

## docs/reference/valeurs-deplacement.md (59 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Joueur / Capsule et controller / Conséquences pour le level design / Impact | reference | `6-reference/valeurs-deplacement.md` | Repris tel quel, à revalider contre `moveConfig.ts` en D46 (mémoire indique le baseline validé en playtest, ne pas re-tuner). |

## docs/reference/valeurs-ennemis.md (246 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Tout le fichier (Vie, Capsule, Perception, Déplacement, Évitement, Machine à états, Combat, Knockback + variantes, Feedback visuel ×2, Révélation, Badge) | reference | `6-reference/valeurs-ennemis.md` | Repris tel quel, revalider contre `suitConfig.ts`/`directorConfig.ts`. |

---

## CLAUDE.md et AGENTS.md (racine)

`AGENTS.md` est un **miroir presque identique de `CLAUDE.md`**, légèrement en
retard (il manque les deux derniers ajouts du « Phase courante » — toilettes
sanitaires et sept retours de playtest — et contient encore une
auto-référence à lui-même sous le nom `.Codex/docs/RAPIER_GUIDE.MD` au lieu
de `.claude/docs/RAPIER_GUIDE.MD`). Traité comme une seule source ; le tableau
ci-dessous couvre `CLAUDE.md`, `AGENTS.md` n'ajoute rien de neuf.

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro (Stack) | fonctionnel | `1-introduction/le-projet.md` | — |
| Learning more about Effect | guide | `5-guides/conventions-de-code.md` | Renvoi vers `node_modules/effect/AGENTS.md`, à garder comme consigne d'agent plutôt que doc humaine. |
| Invariants — non négociables (11 points actifs + 2 retirés le 2026-09-25) | architecture | `3-architecture/invariants.md` | Cœur de la page ; chaque invariant cité avec son ADR quand il existe (#4→0027, #6→ADR pertinent Rapier, #11→ADR Effect, #12→0007/0033). #9 et #13 sont retirés (voir section « Invariants retirés »). L'invariant #4 porte un amendement EN ATTENTE (ADR 0027) — le dire explicitement, ne pas trancher. |
| Conventions React — non négociables | reference | `6-reference/react-structure.md` (renvoi) | Pointe vers les 4 fichiers `docs/reference/react-*.md`, déjà inventoriés. |
| TypeSafe (Jev) — écarté du jeu | journal | `journal/decisions-ecartees.md` | Décision de ne pas intégrer un outil — mérite sa propre petite page de journal ou une entrée dans `decisions/` (à trancher en D67 : c'est presque un ADR informel, jamais formalisé comme tel). |
| Conventions de nommage glTF (table + custom properties) | reference | `6-reference/conventions-nommage.md` | Doublon avec `docs/reference/conventions-nommage.md`, source à unifier. |
| Structure (arbre de dossiers) | reference | `6-reference/arborescence.md` | — |
| Phase courante — Chantier documentation / passes récentes (2026-09-25, sept retours playtest) | journal | `journal/playtests-2026-09.md` | — |
| … Toilettes façon Duke 3D (sanitaire_*) | journal | `journal/niveau-v2.md` | Recoupe ADR 0032. |
| … Quatrième / Troisième / Deuxième passe en direct dans Blender + Reprise de la carte (2026-09-18 au 24) | journal | `journal/niveau-v2.md` | Gros bloc journal N9, très détaillé (portes, vitres, étage bureaux, skybox, souterrain) — à découper par date dans le vrai journal, pas à recopier tel quel. |
| … Props physiques — livrés + corrections | journal | `journal/niveau-v2.md` | Recoupe ADR 0030 et mémoire `project_physical_props.md`. |
| … Armes du joueur — vrais modèles | journal | `journal/niveau-v2.md` | Recoupe ADR 0029. |
| … Ennemis — vrais sprites animés + passe de lisibilité | journal | `journal/niveau-v2.md` | Recoupe ADR 0028. |
| … Playtest complet du niveau v2 (« y a encore beaucoup de boulot ») | journal | `journal/playtests-2026-09.md` | Filet de chute, `audit_niveau.py`. |
| … Chantier Niveau v2 — état des jalons N0-N9 + 3 choses en attente utilisateur + budget de lots | journal | `journal/niveau-v2.md` | Les « TROIS CHOSES ATTENDENT L'UTILISATEUR » doivent rester visibles quelque part de facile d'accès (candidate : un encart dans `1-introduction/le-projet.md` ou `journal/README.md`), pas juste enterrées dans un journal daté. |
| … Bibliothèque d'assets du niveau v2 (lib_*.py, packs CC0, pièges d'échelle) | technique | `4-technique/outillage-blender.md` | — |
| … Éclairage hybride, limite levée (N9) | technique | `4-technique/eclairage.md` | Recoupe ADR 0024/0026. |
| Chantier Effect-TS/XState (M0-M9) — Livré | journal | `journal/effect-xstate.md` | Renvoie à `PLAN_EFFECT_XSTATE.md`. |
| Écart trouvé pendant M9, corrigé (RNG déterministe unifié) | journal | `journal/effect-xstate.md` | Recoupe ADR 0007/0033. |
| Phase 6 — Habillage, livrée (HUD, répliques, écran de mort/fin, rebinding) + 2 bugs corrigés | journal | `journal/phases-0-6.md` | — |
| Phase 5 — Le niveau (l'hypermarché) : zones A à E, directeur, niveau fusionné, secrets 1/2, micro+toilettes | journal | `journal/phases-0-6.md` | Très long, à découper par zone dans le journal. |
| Phases 0-3 codées, validées humainement | journal | `journal/phases-0-6.md` | — |
| Gate qa-evidence : abandonné (répété 2 fois dans le fichier) | journal | `journal/decisions-ecartees.md` | Décision de process, pas de jeu. |

## PLAN_PROTO_BOOMER_SHOOTER.md (456 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| 0. Cadrage (Objectif, Definition of done, scope, hors scope) | fonctionnel | `1-introduction/le-projet.md` | — |
| 1. Stack | fonctionnel | `1-introduction/le-projet.md` | Doublon avec CLAUDE.md « Stack ». |
| 2. Architecture (Principe fondateur, structure de dossiers, boucle de jeu, look rétro, sprites 8 directions) | architecture | `3-architecture/vue-d-ensemble.md` | — |
| 3. Phases (0 à 6, description originale) | journal | `journal/phases-0-6.md` | Version « plan » à comparer avec la version « livré » de CLAUDE.md — mêmes phases, deux sources : le plan dit l'intention, CLAUDE.md dit le résultat. Le journal doit distinguer les deux. |
| 4. Récapitulatif | fonctionnel | `1-introduction/le-projet.md` | — |
| 5. Pièges connus | piege | `5-guides/pieges-connus.md` | Version historique/originale des pièges — à fusionner avec les pièges trouvés depuis. |
| 6. Attaque en multi-agent | guide | `5-guides/travailler-avec-les-agents.md` | — |
| 7. Après le proto | journal | `journal/phases-0-6.md` | — |
| Note d'écriture | perime | — | Note de méthode pour la rédaction du plan lui-même, sans valeur de doc produit. |

## PLAN_EFFECT_XSTATE.md (478 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| 0. Cadrage (décisions, risques, hors scope) | journal | `journal/effect-xstate.md` | — |
| 1. Principes transverses | architecture | `3-architecture/effect-et-xstate.md` | — |
| 2. Jalon M0 — Bootstrap | journal | `journal/effect-xstate.md` | — |
| 3. Jalon M1 — Fondations déterministes + GameRuntime | architecture | `3-architecture/effect-et-xstate.md` | — |
| 4. Jalon M2 — Retrofit loader.ts / hotReload.ts | technique | `4-technique/chargement-de-niveau.md` | — |
| 5. Jalon M3 — RaycastService | technique | `4-technique/physique.md` | — |
| 6. Jalon M4 — PathfindingService | technique | `4-technique/pathfinding.md` | — |
| 7. Jalon M5 — Machine XState partagée Suit/Director | technique | `4-technique/ennemis-et-ia.md` | Recoupe ADR 0009. |
| 8. Jalon M6 — Orchestration Effect du pas fixe | architecture | `3-architecture/boucle-et-temps.md` | — |
| 9. Jalon M7 — Orchestration Effect du rendu et interpolation | architecture | `3-architecture/simulation-et-presentation.md` | — |
| 10. Jalon M8 — Machine XState de flux d'écran + reset | technique | `4-technique/interface-react.md` | Recoupe ADR 0019/0020. |
| 11. Jalon M9 — Documentation et verrouillage des conventions | journal | `journal/effect-xstate.md` | Ironique pour ce chantier : c'est le jalon qui a produit une partie de la doc qu'on refond aujourd'hui. |
| 12. Ordre d'exécution et rattachement aux agents | guide | `5-guides/travailler-avec-les-agents.md` | — |

## PLAN_NIVEAU_V2.md (1039 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| 0. Cadrage (décisions, structure retenue, budget de temps, registre de risques, hors scope) | journal | `journal/niveau-v2.md` | — |
| 1. Principes transverses | architecture | `3-architecture/vue-d-ensemble.md` | — |
| 2. Jalon N0 — Mise en place | journal | `journal/niveau-v2.md` | — |
| 3. Jalon N1 — Prérequis rendu | technique | `4-technique/rendu.md` | — |
| 4. Jalon N2 — Sourcing CC0 et registre des licences | journal | `journal/niveau-v2.md` | Les 4 licences « à confirmer » (`assets_src/LICENCES_ASSETS.md`) restent une action utilisateur ouverte — à répercuter dans les pages cibles sans source / suivi. |
| 5. Jalon N3 — Charte visuelle | technique | `4-technique/generateurs.md` | — |
| 6. Jalon N4 — Salle d'essai « rayons » (gate de richesse) | journal | `journal/niveau-v2.md` | Gate passée — le dire. |
| 7. Jalon N5 — Occlusion des lignes de vue | technique | `4-technique/ennemis-et-ia.md` | Recoupe ADR 0025/0022. |
| 8. Jalon N6 — Plan détaillé de la structure | fonctionnel | `2-fonctionnel/le-niveau.md` | — |
| 9. Jalon N7 — Cartes de fidélité côté jeu | fonctionnel | `2-fonctionnel/objets-interactifs.md` | — |
| 10. Jalon N8 — Blockout gris jouable (gate de structure) | journal | `journal/niveau-v2.md` | Gate passée. |
| 11. Jalon N9 — Habillage du niveau (très long, sous-jalons par espace) | journal | `journal/niveau-v2.md` | Recoupe très largement le bloc CLAUDE.md « Phase courante » déjà inventorié — même matière, à ne rédiger qu'une fois. |
| 12. Jalon N10 — Bascule et documentation | journal | `journal/niveau-v2.md` | N10 est le seul jalon du plan NIVEAU V2 encore ouvert (CLAUDE.md : « Les plans encore ouverts (PLAN_NIVEAU_V2.md, N10 restant) restent à la racine », décision actée en D63) — donc ce plan reste partiellement actif, pas purement archivable tant que N10 n'est pas fait. |
| 13. Ordre d'exécution et rattachement aux agents | guide | `5-guides/travailler-avec-les-agents.md` | — |

## README.md (racine, 48 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro | fonctionnel | `1-introduction/le-projet.md` | — |
| Stack | fonctionnel | `1-introduction/le-projet.md` | Doublon supplémentaire de la même liste (CLAUDE.md, PLAN_PROTO). Une seule source de vérité à choisir en D66. |
| Lancer le projet | guide | `1-introduction/demarrage-rapide.md` | À vérifier en déroulant les commandes (D5). |
| Structure | reference | `6-reference/arborescence.md` | — |
| Documentation | guide | `docs/README.md` | Pointe vers l'ancienne carte — sera réécrit en D7. |
| Déploiement | technique | `4-technique/tests-et-qualite.md` | GitHub Pages / `BASE_URL`, lié à `docs/pipeline/assets.md`. |

## tools/docs/README.md (52 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro + table des scripts | technique | `4-technique/tests-et-qualite.md` | — |
| Ce que l'audit détecte / ne détecte pas | technique | `4-technique/tests-et-qualite.md` | — |
| Ce que le vérificateur de liens détecte | technique | `4-technique/tests-et-qualite.md` | Directement pertinent pour D2 (extension du script). |
| Codes retour | reference | `6-reference/commandes.md` | — |
| Intégration CI suggérée | technique | `4-technique/tests-et-qualite.md` | — |

## tools/audio/README.md (102 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro | technique | `4-technique/studio-audio.md` | — |
| Chaîne complète | technique | `4-technique/studio-audio.md` | — |
| Boucles | technique | `4-technique/studio-audio.md` | — |
| Ce que produit la chaîne | technique | `4-technique/studio-audio.md` | — |
| Dépendances | reference | `6-reference/commandes.md` | — |
| Limite à connaître | piege | `5-guides/pieges-connus.md` | — |

## tools/blender/README.md (1340 lignes)

| Section | Nature | Destination | Note |
|---|---|---|---|
| Intro générale | technique | `4-technique/outillage-blender.md` | — |
| Bibliothèque d'assets du niveau v2 + salle d'essai N4 | technique | `4-technique/outillage-blender.md` | — |
| Sprites des ennemis (ADR 0028) | technique | `4-technique/sprites-et-viewmodel.md` | — |
| Armes du joueur (ADR 0029) + refonte pistolet 2026-09-25 | technique | `4-technique/sprites-et-viewmodel.md` | Version la plus à jour du pistolet — à préférer à `docs/assets/board-pistolet.md` en cas de contradiction. |
| Kit modulaire / Assemblage / Bake→validation→export | technique | `4-technique/outillage-blender.md` | — |
| Exporter : toujours par le script | piege | `5-guides/pieges-connus.md` | Le garde-fou « [export] contenu vérifié » (piège du .glb avec toute la bibliothèque `_LIB`) est un des pièges les plus importants du dépôt. |
| Audit d'un niveau construit (audit_niveau.py) | technique | `4-technique/outillage-blender.md` | — |
| Ce que la validation contrôle | reference | `6-reference/commandes.md` | — |
| Version de Blender | reference | `6-reference/commandes.md` | — |
| Statut — Kit modulaire | journal | `journal/niveau-v2.md` | — |
| Statut — Zones A et B | journal | `journal/niveau-v2.md` | — |
| Statut — Piège Blender 5.1.2 / piège instancing-vs-bake / pièges vérifiés | piege | `5-guides/pieges-connus.md` | — |
| Statut — Zone C (Rayons) | journal | `journal/niveau-v2.md` | — |
| Statut — Zone D (Réserve) | journal | `journal/niveau-v2.md` | — |
| Statut — Zone E (Bureau) + vantail de porte/déclencheur | journal | `journal/niveau-v2.md` | — |
| Statut — Niveau complet (hypermarche_complet), ordre/translations, renommage, use_shotgun, comptes, pièges, ce qui n'a pas été touché | journal | `journal/niveau-v2.md` | — |
| Statut — Secrets Zone B et C | journal | `journal/niveau-v2.md` | — |
| Statut — Micro d'annonces + toilettes (2026-08-24, ancienne version pré-sanitaire_*) | journal | `journal/niveau-v2.md` | **Périmé partiellement** : ce `use_toilet` historique à +1 PV illimité a été remplacé par le système `sanitaire_*` bien plus riche (ADR 0032, CLAUDE.md 2026-09-24) — le journal doit dater les deux et dire lequel est actif. |
| Statut — Sanitaires (sanitaire_*) 2026-09-24 | journal | `journal/niveau-v2.md` | Recoupe ADR 0032, en attente de verdict de playtest. |

---

## docs/decisions/ (33 ADR + README)

Chemin inchangé (`decisions/`). Chaque ADR est cité par au moins une page de
la nouvelle doc — colonne « cité par » ci-dessous, non exhaustive (les pages
techniques concernées le recoupent au fil de la rédaction).

| ADR | Sujet | Cité par |
|---|---|---|
| 0001 | Three.js vanilla | `3-architecture/vue-d-ensemble.md` |
| 0002 | Boucle à pas fixe 1/60 | `3-architecture/boucle-et-temps.md`, `3-architecture/invariants.md` |
| 0003 | React hors boucle | `3-architecture/invariants.md`, `4-technique/interface-react.md` |
| 0004 | Colliders cuboid | `4-technique/physique.md`, `4-technique/chargement-de-niveau.md` |
| 0005 | Éclairage vertex colors | `4-technique/eclairage.md` |
| 0006 | Air strafing (**proposé**, pas accepté) | `2-fonctionnel/deplacement-et-controles.md` — préciser le statut non tranché |
| 0007 | RNG déterministe unique | `3-architecture/invariants.md`, `4-technique/rejeu-et-determinisme.md` |
| 0008 | Collision ennemi-ennemi | `4-technique/physique.md` |
| 0009 | Machine XState partagée Suit/Director | `4-technique/ennemis-et-ia.md` |
| 0010 | Curseur explicite d'événements multi-pas-fixe | `3-architecture/simulation-et-presentation.md` |
| 0011 | Hot reload par sondage HTTP | `4-technique/chargement-de-niveau.md` |
| 0012 | Collider de porte non recentré (**remplacé par 0031**) | `4-technique/systemes-de-niveau.md` (mentionner le remplacement) |
| 0013 | Deux gardes distinctes flux/monde physique | `3-architecture/cycle-de-vie.md` |
| 0014 | GameEngine/PersistentEngine séparés | `3-architecture/cycle-de-vie.md` |
| 0015 | Rampe linéaire de lissage de vue | `4-technique/joueur.md` |
| 0016 | Garde-fous dégénérescence KCC | `4-technique/joueur.md`, `5-guides/pieges-connus.md` |
| 0017 | Clone de texture pour sprite billboard | `4-technique/sprites-et-viewmodel.md` |
| 0018 | Physique jouet, débris cosmétiques | `4-technique/rendu.md` |
| 0019 | Machine XState de flux d'écran | `4-technique/interface-react.md` |
| 0020 | État en feuille de dépendances | `3-architecture/effect-et-xstate.md` |
| 0021 | Export vertex color enum | `4-technique/chargement-de-niveau.md` |
| 0022 | Occlusion des rangées non bloquante (contexte historique) | `journal/niveau-v2.md` |
| 0023 | Fusion du décor au chargement | `4-technique/budget-de-rendu.md` |
| 0024 | Éclairage hybride | `4-technique/eclairage.md` |
| 0025 | Occlusion lignes de vue — cause racine (**remplace 0022**) | `4-technique/physique.md`, `4-technique/ennemis-et-ia.md` |
| 0026 | Visibilité par espace et pool de lampes | `4-technique/eclairage.md`, `4-technique/budget-de-rendu.md` |
| 0027 | Filtrage des textures réduites (**proposé, en attente**) | `4-technique/rendu.md`, `3-architecture/invariants.md` (invariant #4) |
| 0028 | Sprites ennemis pré-rendus | `4-technique/sprites-et-viewmodel.md` |
| 0029 | Armes en vue subjective | `4-technique/sprites-et-viewmodel.md` |
| 0030 | Props dynamiques | `4-technique/systemes-de-niveau.md` |
| 0031 | Portes animées et vitres | `4-technique/systemes-de-niveau.md` |
| 0032 | Sanitaires utilisables | `4-technique/systemes-de-niveau.md` |
| 0033 | RNG présentation et portée du rejeu | `4-technique/rejeu-et-determinisme.md` |
| README.md (index) | reference | `decisions/README.md` — retouché en D67 (résumé + statut par ADR, regroupés par domaine) |

---

## .claude/agents/*.md

Consignes d'agent, ne migrent pas. Une ligne par fiche ; « cite » = pages
techniques/guides que la fiche devrait référencer une fois écrites.

| Fiche | Doit citer |
|---|---|
| `core-loop.md` | `4-technique/joueur.md`, `3-architecture/boucle-et-temps.md`, `4-technique/physique.md` |
| `director.md` | `3-architecture/vue-d-ensemble.md`, `5-guides/ou-agir.md` |
| `doc-keeper.md` | `docs-structure` (skill), la nouvelle arborescence complète — révision explicitement demandée en section 5 du plan |
| `entity-designer.md` | `4-technique/ennemis-et-ia.md`, `4-technique/pathfinding.md` |
| `feel-tuner.md` | `5-guides/regler-la-sensation.md`, `6-reference/valeurs-deplacement.md` |
| `level-forge.md` | `4-technique/outillage-blender.md`, `5-guides/modifier-le-niveau.md` |
| `level-pipeline.md` | `4-technique/chargement-de-niveau.md`, `4-technique/systemes-de-niveau.md` |
| `qa-evidence.md` | `4-technique/tests-et-qualite.md` |
| `retro-render.md` | `4-technique/rendu.md`, `4-technique/sprites-et-viewmodel.md` |
| `shell.md` | `4-technique/interface-react.md`, `4-technique/audio-runtime.md` |
| `sound-forge.md` | `4-technique/studio-audio.md` |
| `ui-forge.md` | `4-technique/interface-react.md`, `2-fonctionnel/interface.md` |

## .claude/skills/*/SKILL.md (31 skills)

Consignes d'agent, ne migrent pas. Une ligne par skill.

| Skill | Doit citer |
|---|---|
| `adr-format` | `5-guides/ecrire-un-adr.md` |
| `ai-3d-asset-integration` | `4-technique/generateurs.md` |
| `ambience-and-loops` | `4-technique/audio-runtime.md`, `2-fonctionnel/son.md` |
| `audio-critique-loop` | `4-technique/studio-audio.md` |
| `audio-mix-budget` | `4-technique/studio-audio.md`, `4-technique/audio-runtime.md` |
| `audio-sfx-pipeline` | `4-technique/audio-runtime.md` |
| `billboard-sprites-8dir` | `4-technique/sprites-et-viewmodel.md` |
| `blender-level-conventions` | `6-reference/conventions-nommage.md` |
| `blender-python-automation` | `4-technique/outillage-blender.md` |
| `build-engine-look` | `4-technique/rendu.md`, `3-architecture/invariants.md` |
| `code-comment-policy` | `5-guides/conventions-de-code.md` |
| `collision-proxy-authoring` | `4-technique/physique.md`, `4-technique/outillage-blender.md` |
| `comment-migration-protocol` | `5-guides/conventions-de-code.md` |
| `docs-structure` | tout `docs/` — à réviser pour la nouvelle arborescence (D1) |
| `effect-xstate-cassandre` | `3-architecture/effect-et-xstate.md` |
| `enemy-state-machine` | `4-technique/ennemis-et-ia.md`, `4-technique/pathfinding.md` |
| `fixed-timestep-loop` | `3-architecture/boucle-et-temps.md` |
| `game-feel-tuning` | `5-guides/regler-la-sensation.md` |
| `gltf-level-conventions` | `4-technique/chargement-de-niveau.md` |
| `modular-kit-design` | `4-technique/outillage-blender.md` |
| `procedural-sfx-synthesis` | `4-technique/studio-audio.md` |
| `prop-silhouette-design` | `4-technique/outillage-blender.md` |
| `rapier-character-controller` | `4-technique/physique.md`, `4-technique/joueur.md` |
| `react-hud-bridge` | `4-technique/interface-react.md`, `3-architecture/flux-de-donnees.md` |
| `reference-driven-authoring` | `5-guides/modifier-le-niveau.md` |
| `retro-fps-invariants` | `3-architecture/invariants.md` |
| `retro-texture-density` | `4-technique/generateurs.md` |
| `threejs-rapier-fieldguide` | `6-reference/threejs-rapier.md`, `5-guides/pieges-connus.md` |
| `vertex-color-sector-lighting` | `4-technique/eclairage.md` |
| `visual-critique-loop` | `4-technique/outillage-blender.md` |
| `visual-evidence-gates` | `4-technique/tests-et-qualite.md` |
| `weapon-sound-design` | `4-technique/studio-audio.md` |

Note : `.agents/skills/` (dossier non suivi, apparu dans `git status`) contient
une quasi-copie des mêmes skills, avec deux fichiers qui divergent
(`effect-xstate-cassandre`, `enemy-state-machine`). Non traité ici — hors
périmètre explicite de D0 (qui ne cite que `.claude/skills/`) — mais signalé
en Écarts soupçonnés ci-dessous.

---

## Pages cibles sans source

Pages prévues par la section 1 du plan qu'aucune section inventoriée
n'alimente réellement (à écrire depuis le code et les commits, pas depuis
une doc existante) :

- `1-introduction/glossaire.md` — les termes existent dispersés dans tous les
  fichiers mais aucune page ne les rassemble ; à construire par lecture
  transverse.
- `1-introduction/comment-lire-cette-doc.md` — nouveau (D1).
- `3-architecture/carte-des-modules.md` — le plan lui-même demande un graphe
  « mesuré sur le code, pas dessiné de mémoire » (D10) ; `docs/systems/*.md`
  donnent des indices épars (« Origine des modules… ») mais pas de graphe.
- `3-architecture/flux-de-donnees.md` — peu de matière directe ; le skill
  `react-hud-bridge` et `docs/systems/hud.md` donnent des fragments, pas le
  flux complet input → gameplay → store → HUD.
- `5-guides/reprendre-le-projet.md` — nouveau, écrit en dernier (D62).
- `5-guides/ou-agir.md` — nouveau, construit depuis les pages techniques
  elles-mêmes (D47).
- Les onze recettes pas à pas (`ajouter-un-ennemi.md`, `ajouter-une-arme.md`,
  `ajouter-un-objet-interactif.md`, `modifier-le-niveau.md`,
  `ajouter-un-son.md`, `ajouter-un-ecran-ou-un-widget.md`,
  `regler-la-sensation.md`, `ajouter-un-niveau.md`,
  `diagnostiquer-un-bug-de-simulation.md`, `mesurer-une-perf.md`,
  `ecrire-un-adr.md`) — aucune n'existe en tant que recette pas-à-pas
  aujourd'hui ; la matière est éparpillée en fragments (voir notes
  « guide » ci-dessus) mais aucune ne suit le format « Objectif · Étapes ·
  Vérifier · Exemple réel (commit) » demandé.
- `6-reference/commandes.md` — à construire en listant les scripts
  `package.json`/`tools/*/README.md` eux-mêmes, aucune page actuelle ne les
  recense tous ensemble.

## Pages à créer proposées

Aucun contenu inventorié ne justifie une page hors de l'arborescence cible
du plan (section 1) — toutes les destinations « À CRÉER » envisagées se sont
résolues vers une page déjà prévue. Deux cas limites méritent une décision
explicite en D1/D67, pas une nouvelle page :

- **`journal/decisions-ecartees.md`** (proposée ci-dessus pour TypeSafe/Jev
  et l'abandon de `qa-evidence`) : n'est pas dans la liste nominative de
  « Journal » du plan, mais s'accorde avec son principe (« une page par
  chantier ou par période »). À confirmer en D63 plutôt qu'à inventer ici.
- **`journal/audit-architecture-2026-09.md`** (pour
  `etat-des-lieux-code-architecture.md`) : même remarque, nom proposé faute
  d'entrée nominative dans le plan.

## Écarts soupçonnés

1. **`docs/reference/etat-des-lieux-code-architecture.md` est un audit déjà
   soldé, pas un audit ouvert.** Son propre tableau « Suivi d'exécution »
   (ligne 497-501) marque les 4 étapes de remédiation « Terminée », et les
   commits `45b9cec`, `a6277e9`, `05e1084`, `ede868d` (voir `git log`)
   correspondent nom pour nom aux étapes 4/3/2/1. Toute page technique qui
   s'appuierait sur les « Constats prioritaires » (P0/P1) sans lire aussi le
   suivi d'exécution décrirait un état déjà corrigé comme un problème actuel.
2. **`docs/reference/threejs-rapier.md` est un stub vide** cité comme lien
   actif depuis `docs/game/plan-prototype.md` (« voir Rapier/Three.js — guide
   de terrain ») — lien mort en pratique, le vrai contenu vit dans le skill
   `threejs-rapier-fieldguide`.
3. **`docs/game/univers.md` est un stub vide** alors que `docs/README.md` le
   liste dans sa section « Conception » comme s'il existait.
4. **`AGENTS.md` est un miroir en retard de `CLAUDE.md`** (deux entrées de
   journal manquantes, une auto-référence à un chemin `.Codex/` inexistant
   au lieu de `.claude/`) — source de vérité à unifier avant D66, sans quoi
   la doc allégée finale risque d'être écrite depuis la version périmée.
5. **`.agents/skills/` (non suivi par git) duplique `.claude/skills/`** avec
   deux fichiers qui divergent déjà (`effect-xstate-cassandre`,
   `enemy-state-machine`) — à signaler à l'utilisateur : lequel fait foi
   pour les futurs renvois de la doc vers les skills.
6. **`docs/systems/pathfinding.md` (MAX_STEP_HEIGHT)** documente lui-même un
   écart connu (limite du graphe à 1,0 m contre une marche d'ennemi réelle de
   0,35 m) sans dire s'il a été corrigé depuis sa dernière mise à jour — à
   revérifier contre `src/game/pathfinding/` en D30 avant de le recopier
   comme acquis ou comme dette.
7. **`docs/systems/session.md`** décrit la construction/démolition d'une
   partie sans mention du chantier « cycle de vie transactionnel »
   (commit `05e1084`, étape 2 de l'audit) — probable décalage entre le texte
   et le code actuel de `game/session/lifecycle.ts`, à vérifier en D13 plutôt
   qu'à recopier tel quel.
8. **Trois copies quasi identiques de la liste « Stack »** existent
   (`README.md`, `CLAUDE.md`, `PLAN_PROTO_BOOMER_SHOOTER.md` §1) — pas un bug,
   mais un signal que la nouvelle doc doit choisir une seule source
   (`1-introduction/le-projet.md`) et faire pointer les autres vers elle.
