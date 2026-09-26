---
title: Console cassandre
tags: [reference, debug]
status: brouillon
updated: 2026-09-26
---

# Console cassandre

`window.cassandre` est une API de développement créée par `src/game/devtools/consoleApi.ts`. Elle n'est pas disponible dans le build de production. Ouvrez la console du navigateur pendant `pnpm dev` et utilisez `cassandre`.

Les propriétés qui exposent la session courante sont des accesseurs : elles suivent un reset ou une nouvelle partie. Après un changement de niveau, vérifiez que le chargement est terminé avant de lire les collections.

## Joueur, enregistrement et sensation

| Expression | Effet |
|---|---|
| `cassandre.player` | Contrôleur du joueur actif. |
| `cassandre.moveConfig`, `cassandre.weaponConfig` | Configurations modifiables pour les essais ; les changements qui concernent Rapier demandent le réapplication prévue par le contrôleur. |
| `cassandre.recorder` | Enregistreur courant. |
| `cassandre.lastRecording()` | Dernier enregistrement ou `null`. |
| `cassandre.exportRecording(rec)` / `cassandre.importRecording(json)` | Convertit un enregistrement JSON. |
| `cassandre.playRecording(rec)` | Rejoue l'input dans la session. |
| `cassandre.simulateRecording(rec, cfg?)` | Simule un enregistrement avec la config fournie. |
| `cassandre.checkDeterminism(rec)` | Compare deux simulations déterministes. |
| `cassandre.feelVariants` / `cassandre.applyFeelVariant(name)` | Compare bob, FOV et réception de saut ; `name` accepte `A`, `B` ou `C`. |
| `cassandre.recoilVariants` / `cassandre.applyRecoilVariant(name)` | Variantes et application du recul. |
| `cassandre.impactVariants` / `cassandre.applyImpactVariant(name)` | Variantes et application de l'effet d'impact. |
| `cassandre.hitmarkerVariants` / `cassandre.applyHitmarkerVariant(name)` | Variantes du hitmarker. |
| `cassandre.crosshairVariants` / `cassandre.applyCrosshairVariant(name)` | Variantes du réticule. |
| `cassandre.knockbackVariants` / `cassandre.applyKnockbackVariant(name)` | Variantes du recul subi par le Costard. |
| `cassandre.flashVariants` / `cassandre.applyFlashVariant(name)` | Variantes du flash de dégâts du Costard. |

Les enregistrements F9/F10 ne sauvegardent pas l'état complet du monde. Des ennemis ou objets actifs peuvent donc diverger pendant un rejeu.

## Ennemis et niveau

| Expression | Effet |
|---|---|
| `cassandre.suits` / `cassandre.suitConfig` | Liste des Costards et réglages. |
| `cassandre.spawnSuit(x, y, z)` | Ajoute un Costard à la session. |
| `cassandre.suitCount()` / `cassandre.suitAliveCount()` / `cassandre.killSuit()` | Compte les Costards créés, les vivants ou tue le premier vivant. |
| `cassandre.directors` / `cassandre.directorManager` / `cassandre.directorConfig` | Directeurs et gestionnaire courant. |
| `cassandre.spawnDirector(x, y, z)` | Ajoute un Directeur à la session. |
| `cassandre.directorCount()` / `cassandre.directorAliveCount()` / `cassandre.killDirector()` | Compte les Directeurs créés, les vivants ou tue le premier vivant. |
| `cassandre.level.load(name)` | Charge `public/assets/levels/<name>.glb`. |
| `cassandre.level.stats()` | Compteurs du niveau chargé, ou `null`. |
| `cassandre.cards()` / `cassandre.giveCard(card)` | Lit ou force une carte : `argent`, `or` ou `platine`. |
| `cassandre.doors()` / `cassandre.secrets()` | Objets du niveau issus du glTF. |
| `cassandre.pathfinding.stats()` / `cassandre.pathfinding.findPath(from, to)` | Statistiques du graphe et recherche de chemin. |

## Objets interactifs et audio

| Expression | Effet |
|---|---|
| `cassandre.doorSystem.liste()` / `cassandre.doorSystem.ouvrir(nom)` / `cassandre.doorSystem.actionner()` | Inspecte, ouvre par nom ou actionne la porte manuelle la plus proche. |
| `cassandre.vitres.liste()` / `cassandre.vitres.casser(nom)` | Inspecte ou casse un vitrage. |
| `cassandre.sanitaires.liste()` / `cassandre.sanitaires.casser(nom)` / `cassandre.sanitaires.jets()` | Inspecte les sanitaires, en casse un et liste les jets d'eau. |
| `cassandre.sanitaires.delai()` / `cassandre.sanitaires.forcerDelai(secondes)` | Lit ou change le délai global de soulagement. |
| `cassandre.props.liste()` / `cassandre.props.casser(nom)` | Inspecte ou casse un prop physique. |
| `cassandre.heals()` / `cassandre.ammo()` | Liste trousses ou boîtes du niveau. |
| `cassandre.sfx.liste()` / `cassandre.sfx.joue(id, volume?)` | Correspondance recette/identifiant, puis déclenchement d'un effet. |
| `cassandre.sfx.eau()` | État de l'ambiance des jets d'eau. |
| `cassandre.music.isEnabled()` / `cassandre.music.setEnabled(bool)` / `cassandre.music.toggle()` | Lit ou règle la musique. |

## Rendu, session et rapport

| Expression | Effet |
|---|---|
| `cassandre.lighting()` | Liste les lampes, matériaux et plages de couleurs de sommets. |
| `cassandre.lightBudget()` | Lit le budget et l'état du pool de lampes. |
| `cassandre.lightBudget(n)` | Applique un budget de n lampes. `null` demande d'allumer toutes les lampes. |
| `cassandre.renderBench(frames?)` | Mesure le coût de rendu hors de la boucle, 120 images par défaut. |
| `cassandre.filtrage(mode)` | Change le filtrage des textures réduites ; `mode` accepte `aniso`, `mipmap` ou `nearest`. |
| `cassandre.resolution(width?, height?)` | Change la résolution interne ; sans argument, revient à 640×360. |
| `cassandre.recap.stats()` / `cassandre.recap.recap()` | Compteurs de session et dernier récapitulatif. |
| `cassandre.recap.completeLevel()` / `cassandre.recap.killPlayer()` | Exécute un vrai chemin de fin de partie pour vérifier l'écran et le récap. |
| `cassandre.pause()` / `cassandre.resume()` | Envoie une transition de pause ou reprise au flux de session. |
| `cassandre.notarget()` / `cassandre.notarget(false)` | Rend les ennemis passifs ou les réactive. |

Ces commandes modifient la session ou son rendu. Pour une capture comparable, consignez l'état initial, la commande et les paramètres. Le panneau de tuning et le harnais de benchmark sont présentés dans [Debug](../4-technique/debug.md).

Les noms indiqués dans les cellules sont des expressions complètes. Les valeurs de `card` sont `argent`, `or` et `platine` ; les variantes A/B/C ne s'appliquent qu'aux méthodes `apply…Variant` correspondantes.
