---
title: Commandes
tags: [reference, commandes]
status: brouillon
updated: 2026-10-08
---

# Commandes

Les commandes du projet viennent de `package.json`. PNPM utilise la version verrouillée des dépendances.

| Commande | Effet |
|---|---|
| `pnpm dev` | Lance Vite en développement. |
| `pnpm build` | Vérifie TypeScript puis produit le build Vite. |
| `pnpm preview` | Sert le build déjà présent pour une vérification locale. |
| `pnpm typecheck` | Lance uniquement `tsc --noEmit`. |
| `pnpm test` | Exécute Vitest une fois. |
| `pnpm test:watch` | Garde Vitest actif en mode interactif. |
| `pnpm lint` | Oxlint (avec types) sur `src`, `test` et les configs. Config : `.oxlintrc.json`. Les erreurs cassent ; les avertissements sont de la dette plafonnée par `options.maxWarnings` (le plafond ne fait que descendre). |
| `pnpm lint:fix` | Oxlint avec les correctifs sûrs (`--fix`) : `import type`, assertions inutiles, gabarits de chaîne. À lancer sur un arbre propre. Relire le diff : la règle `no-unnecessary-type-assertion` se trompe sur l'idiome XState `types: {} as {...}` (déjà marqué ligne par ligne). |
| `pnpm format` | Oxfmt écrit le formatage (`printWidth` 120, config `.oxfmtrc.json`). À lancer sur un arbre propre. Exclus du formatage : `heroLines.ts`, `levelEvents.ts`, `metroTrainEvents.ts`, lus par regex par `tools/blender/validate_level.py`. |
| `pnpm format:check` | Oxfmt vérifie sans écrire. |
| `pnpm check` | Typecheck, lint, formatage, tests Vitest et build de production. Le contrôle documentaire n'en fait pas partie ; la CI (`.github/workflows/deploy.yml`) lance `pnpm check` sans lui. |
| `pnpm check:docs` | Vérifie le graphe documentaire, les chemins de code et les ancres. À lancer à part : ni `pnpm check` ni la CI ne l'exécutent. |
| `pnpm check:docs:test` | Exécute les tests Python du vérificateur documentaire. |
| `pnpm verify` | Typecheck, lint et tests, sortie réduite aux échecs ; `-- --format` ajoute le formatage, `-- --level` le contrat et l'audit du niveau (Blender headless), `-- --docs` le contrôle documentaire. |
| `pnpm probe` | Mesure les lots de dessin en jeu aux poses de `tools/probe/poses.json`. |
| `pnpm economy` | Relève le portefeuille sur trois parties types simulées ; `-- --variante A`, `-- --difficulte client`, `-- --toutes`. |

## Audio

Voir `tools/audio/README.md` pour la chaîne complète et ses dépendances. Le Python doit disposer de NumPy et SciPy ; Matplotlib sert aux planches de spectrogrammes.

| Script | Options |
|---|---|
| `tools/audio/render_sfx.py --out DIR` | `--only NOMS`, `--cat CATEGORIE`, `--variants`, `--crush`, `--manifest FICHIER`. |
| `tools/audio/analyze_sfx.py [DIR]` | `--sheet PNG`, `--mask A B`, `--timbre WAV...`, `--boucle FICHIER...`, `--contre WAV`, `--strict`. |
| `tools/audio/build_sprite.py DIR --out DIR` | `--gap SECONDES`, `--peak NIVEAU`. |
| `tools/audio/audition.py` | `--cat CATEGORIE`, `--no-variants`. Écrit une page locale d'écoute. |
| `tools/audio/propose_pistol.py --out DIR` | Rend les propositions sonores de pistolet. |

`tools/audio/synth.py`, `tools/audio/recipes.py` et `tools/audio/enregistrements.py` sont des bibliothèques importées par les outils, pas des commandes autonomes.

## Blender et niveau

Pour un script Blender, la forme est `blender -b FICHIER -P SCRIPT -- OPTIONS`. L'option `--factory-startup` appartient à Blender et précède `-P`. Voir `tools/blender/README.md` pour les séquences de construction historiques. Le niveau v2 se modifie dans la session Blender live ; les options CLI ne remplacent pas l'inspection de cette scène.

| Script | Options du script |
|---|---|
| `tools/blender/build_kit.py` | `--out`, `--checker`, `--light-energy`, `--no-lights`. |
| `tools/blender/build_level.py` | `--zone CLE`, `--kit`, `--out`, `--light-energy`. Les clés de zone sont a à e. |
| `tools/blender/build_combined_level.py` | `--kit`, `--out`, `--light-energy`. |
| `tools/blender/build_library.py` | `--save` ou `--out FICHIER`. |
| `tools/blender/build_salle_essai.py` | `--out`, `--light-energy`. |
| `tools/blender/inspect_kit.py` | `--piece NOM`, `--strict`, `--verbose`. |
| `tools/blender/bake_vertex_lighting.py` | `--type`, `--pass`, `--samples`, `--ambient`, `--domain`, `--bounces`, `--emissive-marker`, `--save`, `--out`, `--dry-run`, `--strict`, `--keep-proxies`. |
| `tools/blender/validate_level.py` | `--strict`, `--kit`. |
| `tools/blender/export_level.py` | `--out FICHIER`. |
| `tools/blender/render_preview.py` | `--out DIR`, `--res-x N`, `--res-y N`, `--spawn NOM`. |
| `tools/blender/render_ingame.py` | `--out DIR`, `--eye M`, `--res-x N`, `--res-y N`, répétition de `--view X,Y,CAP`. |
| `tools/blender/render_enemy_sprites.py` | `--personnage` (`costard`, `directeur`, `rampant`, `vigile`), `--anims`, `--directions`, `--out DIR`. |
| `tools/blender/build_weapons.py` | `--out FICHIER`, `--renders DIR`, `--debug`. |
| `tools/blender/render_weapon_pickups.py` | `--out PNG`. |
| `tools/level_v2/build_blockout.py` | `--out FICHIER`. |
| `tools/level_v2/build_niveau.py` | `--out FICHIER`. |
| `tools/level_v2/audit_niveau.py` | `--pas M`, `--csv FICHIER`. |
| `tools/level_v2/plan_de_masse.py` | `--ascii`, `--svg FICHIER`. |

Les ajouts locaux au niveau v2 passent par les recettes rejouables de `tools/blender/cassandre_cli.py`, lancées sur `assets_src/blender/niveau_v2.blend` : `story_triggers` (déclencheurs de l'histoire), `perk_kiosks` (les six bornes), `gas_props` (bonbonnes de gaz), `encounters` (rencontres : rideau de la réserve, groupes d'ennemis, déclencheurs). Chacune retire ce qu'elle pose avant de le reposer, sauvegarde et exporte ; `preview=FICHIER` produit un essai isolé. Sur ce poste, `blender` n'est pas dans le `PATH` : l'exécutable est `/Applications/Blender.app/Contents/MacOS/Blender`.

`--save` réécrit le fichier Blender d'entrée pour la bibliothèque et le bake ; préférez `--out` pour conserver la source. Les valeurs par défaut sont documentées près des commandes dans `tools/blender/README.md`, `tools/level_v2/build_blockout.py` et `tools/level_v2/build_niveau.py`. L'audit accepte aussi une ouverture de fichier en cours dans Blender. Ne traitez pas l'absence de sortie d'un bake sans `--save` ou `--out` comme un résultat exporté.

## Textures, palette et documentation

| Script | Options |
|---|---|
| `tools/textures/make_textures.py [NOM...]` | Sans argument, génère toutes les textures du script ; un ou plusieurs noms limitent la génération. |
| `tools/refs/extract_palette.py DOSSIER` | `--colors N` (défaut 24), `--out FICHIER`. |
| `tools/textures/build_palette.py` | Pas d'option CLI ; écrit la palette configurée dans le script. |
| `tools/textures/generate_affiches.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/textures/generate_banners.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/textures/generate_chaines.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/textures/generate_ciel.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/textures/generate_ecrans.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/textures/generate_facade.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/textures/generate_kiosque.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/textures/generate_labels.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/textures/generate_portes.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/textures/generate_surgeles.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/textures/generate_trims.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/textures/make_kenney_atlas.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/textures/generate_panneaux.py` | `--raw DOSSIER`, `--out DOSSIER`, `--couleurs N`, `--check`. |
| `tools/textures/generate_backstage_signs.py`, `generate_card_pickups.py`, `generate_checkout_signs.py`, `generate_compacteur.py`, `generate_door_controls.py`, `generate_public_compositions.py`, `generate_service_landmarks.py` | Aucune option CLI ; sortie définie dans le générateur. |
| `tools/docs/check_docs_links.py DOCS` | `--src DIR`, `--strict`, `--allow-empty-drafts`. |
| `tools/docs/audit_comments.py RACINE` | `--max-ratio N`, `--long-block N`, `--json FICHIER`. |
| `tools/docs/remap_anchors.py` | `--root DIR`, `--table FICHIER`, `--dry-run`, `--diff FICHIER`, `--archive-plan`. `--apply` écrit réellement les changements, après revue du `--diff` ; la migration déjà menée est appliquée. |
| `python3 -m unittest discover -s tools/docs -p 'test_*.py'` | Lance les tests de `tools/docs/test_check_docs_links.py` et `tools/docs/test_remap_anchors.py`. |

Les scripts Blender de support, les spécifications et les helpers Python comme `tools/blender/kit_spec.py`, `tools/blender/level_spec.py`, `tools/blender/geo_utils.py` et `tools/blender/lib_helpers.py` fournissent des fonctions aux commandes ci-dessus ; ils ne sont pas des commandes autonomes.
