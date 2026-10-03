---
title: Audit complet de src et nettoyage
tags: [journal, architecture, effect, maintenance]
status: stable
updated: 2026-10-02
---

# Audit complet de src — 2 octobre 2026

**Suite du 3 octobre 2026 :** les recommandations P2 sont traitées dans
[Corrections P2](audit-src-p2-2026-10.md). Les constats ci-dessous décrivent
l’état du 2 octobre avant cette seconde passe. Les recommandations P3 sont
ensuite traitées dans [Corrections P3](audit-src-p3-2026-10.md).


## Périmètre et méthode

Les 221 fichiers initiaux de `src/` ont été répartis entre quatre lectures :

| Domaine | Fichiers initiaux | Axes |
|---|---:|---|
| Core, physique, application, main | 21 | frontières Effect, input, audio, session, restauration d’état |
| Gameplay | 56 | niveau, joueur, ennemis, orchestration et contrats partagés |
| Rendu | 16 | matériaux, sprites, ressources et contrats de présentation |
| Interface et déclaration Vite | 128 | React, CSS, commentaires et séparation des commandes moteur |

Chaque fichier a été lu. Les commentaires ont d’abord été nettoyés sans
changer les tokens de code ; les extractions et corrections viennent dans
une seconde passe. Les pièges, contrats et unités utiles restent près du
code. Les répétitions sont retirées et les explications de conception migrées
vers les notes ci-dessous. Aucun barrel `index.ts` n’est ajouté.

## Connaissances conservées

- [Core, physique et application](../6-reference/notes-code-core.md).
- [Gameplay et session](../6-reference/notes-code-gameplay.md).
- [Joueur et armes](../6-reference/notes-code-gameplay-joueur.md).
- [Ennemis](../6-reference/notes-code-gameplay-ennemis.md).
- [Niveau](../6-reference/notes-code-gameplay-niveau.md).
- [Outils de développement](../6-reference/notes-code-gameplay-outils.md).
- [Rendu](../6-reference/notes-code-rendu.md).
- [Interface](../6-reference/notes-code-interface.md).

## Effect : bilan

La séparation existante entre pas fixe, présentation synchrone et chargement
asynchrone est adaptée au jeu. Les calculs purs, les configurations, les
contrats de données et les composants React n’ont pas besoin d’être enveloppés
dans Effect. Rapier et le rendu restent appelés par les capacités injectées
dans `GameLayer` et par `runGameplaySync`.

Le défaut de composition trouvé dans `PathfindingService` a été corrigé :
son bake fournissait lui-même `RaycastService.layer`, contournant la dépendance
choisie dans `GameLayer`. Il capture désormais l’instance injectée. Les JSON
audio, sprites et rejeu sont décodés avec Effect Schema avant leur emploi.

Les promesses natives de DOM, Howler, chargement GPU et initialisation WASM
restent dans leurs adaptateurs de chargement. Aucun transfert de ces opérations
asynchrones dans le pas fixe n’a été introduit. Le générateur aléatoire du jeu
reste `DeterministicRandom` ; aucun appel exécutable à `Math.random()` ou au
service Random par défaut n’a été trouvé dans les sources inspectées.

## Séparation des responsabilités

La décision [ADR 0036](../decisions/0036-contrats-feuilles-et-store-hud.md)
remplace le regroupement des contrats dans le store HUD. Elle définit des
modules feuilles par domaine, et maintient les interfaces locales auprès
de leur implémentation lorsqu’une extraction ne réduirait aucun couplage.

### Changements appliqués

| Domaine | Changement | Gain |
|---|---|---|
| Input | `inputTypes`, `inputBindings`, `inputPersistence`, `recordingSchema` | contrats, réglages, stockage et lecture du rejeu distincts |
| Audio | `audioTypes`, `audioCatalog`, `audioManifest` | tables et contrats indépendants de Howler ; données validées au chargement |
| Application | machine et contrats de navigation déplacés dans `app/` | le cycle de session appartient à l’application |
| Gameplay | `hudTypes`, `levelTypes`, `weaponTypes`, `enemyTypes` | les consommateurs de contrats n’importent plus le store ou les implémentations |
| Session | score pur ; publication dans `recap` ; états initiaux purs | les calculs et constantes ne chargent plus Zustand |
| Santé et secrets | données canoniques dans `GameSession` | le HUD reçoit un miroir ; il ne décide plus ces règles du jeu |
| Rendu | `enemySpriteTypes`, `enemySpriteManifest`, port `ViewmodelSource` | le viewmodel dépend des poses et horloges, sans dépendre de `WeaponSystem` |
| Tuning | contrats dans `tuningTypes`, commande moteur dans `movementTuning` | React conserve les contrôles ; le moteur applique les réglages |

Les interfaces privées restent locales quand leur déplacement ne réduit pas
les dépendances. Aucun fichier global de types ni service par formule n’a été
créé. Les skills de migration documentaire, de conventions Effect/XState et
d’audit d’architecture existants ont suffi ; trois agents ont couvert les
sous-domaines avec des fichiers attribués.

## Corrections de fiabilité

- **Chargement de niveau :** propriétaire `LevelResources` enregistré avant
  construction. Corps, géométries, matériaux et textures sont suivis dès leur
  acquisition ; un échec ferme le Scope et tente toutes les libérations.
- **Chargement de sprites :** les textures déjà acquises sont libérées quand
  un autre chargement du même ensemble échoue.
- **Viewmodel :** les matériaux et textures glTF remplacés sont libérés ; les
  géométries réutilisées restent vivantes. Les vecteurs d’extras sont validés.
- **Transitions de session :** un garde empêche deux transitions concurrentes.
  Une demande reçue pendant une transition rejoint la promesse en cours ;
  ce mécanisme ne constitue pas une file de commandes.
- **État temporaire :** caméra CCTV et timestep Rapier restaurés dans `finally`.
- **Debug du rendu :** wireframe vérifié par capacité du matériau, compatible
  avec la coexistence des matériaux classiques et TSL.

Ces corrections sont relues et compilées. Les chemins d’échec et le rendu en
jeu n’ont pas été exercés pendant cet audit.

## Mesures du nettoyage

Le comptage porte sur les lignes non vides occupées **uniquement** par des
commentaires, hors commentaires en fin de ligne de code. Le scanner TypeScript
reconnaît notamment les chaînes, templates et JSDoc ; le CSS est compté
séparément. Cette définition évite les faux comptes du script historique.

| Mesure | Avant | Après |
|---|---:|---:|
| Fichiers `src/` | 221 | 242 |
| Fichiers TS/TSX | 168 | 189 |
| Fichiers CSS | 53 | 53 |
| Lignes de commentaires seules | 7 366 | 1 757 |
| Lignes de code non vides | 17 902 | 18 235 |

**76,1 % des lignes de commentaires seules ont été retirées du code.**
Les connaissances ont été regroupées dans les huit références liées plus haut.
Les nouvelles lignes de code viennent des validations, contrats extraits et
corrections de possession des ressources.

La passe documentaire initiale est contrôlée avant les refactors : **aucune
différence de tokens dans les 168 TS/TSX**, et contenu CSS hors commentaires
identique dans les 53 feuilles. Une passe finale retire 553 liens documentaires
répétés dans le même fichier, également sans modifier les tokens de code.
Ces contrôles établissent la neutralité de la migration de commentaires ;
ils ne prétendent pas que les corrections ultérieures sont sans effet.

## Recommandations restantes

P2 désigne une fragilité de maintenance ou un comportement à examiner ; P3
une amélioration de confort. Aucun blocage de compilation ne reste.

| Priorité | Zone | Constat | Suite proposée |
|---|---|---|---|
| P2 | `enemyMachine.forceEnemyState` | mutation privée de `actor._snapshot` par le debug | restauration par API publique avec acteur recréé ; vérifier contexte et actions d’entrée |
| P2 | `weapons.viewmodelPose` | position précédente du recul capturée mais jamais lue | comparer l’interpolation positionnelle sous le harnais de sensation de jeu |
| P2 | `level/loader` | parsing, diagnostics, colliders et orchestration restent groupés | extraire parsers et diagnostics autour du propriétaire de ressources livré |
| P2 | `level/doors`, `level/pathfinding`, `enemyMachine` | contrats partiellement isolés, algorithmes encore volumineux | séparer géométrie, graphe/bake et perception en gardant ordre et conventions |
| P2 | `render/fx/fx` | sept responsabilités et plusieurs pools dans une façade | extraire les pools par effet, conserver ordre de mise à jour et absence d’allocations |
| P2 | `render/pickups/pickups` | caches GPU globaux et acquisition d’atlas implicite | rendre explicites propriétaire et durée de vie, puis préchauffage |
| P2 | `render/pipeline/renderer` | filtrage central limité aux `map` classiques | étendre le registre si d’autres canaux de textures ou uniformes TSL entrent dans ce contrat |
| P3 | `core/effect/runtime` | composition du jeu hébergée dans core | envisager une racine de composition dans `app/` si d’autres modes de jeu arrivent |
| P3 | `zoneAmbience` | réinitialisation RNG sans remise à zéro complète de l’horloge de présentation | préciser le contrat de continuité entre sessions avant changement |
| P3 | widgets canvas | conversions CSS et construction canvas répétées | petite primitive commune si les variantes continuent à croître |

Le découpage des gros systèmes est un chantier distinct : l’ordre des effets,
les ressources partagées et la sensation de recul demandent une validation
comportementale. Les rapports [gameplay](audit-src-gameplay-2026-10.md) et
[rendu](audit-src-render-2026-10.md) précisent ces points.

## Contrôles et limites

- Construction de production et vérification TypeScript : réussies.
- Liens documentaires : aucun lien cassé ni avertissement.
- Graphe des imports statiques locaux : 189 modules TS/TSX, aucun cycle runtime
  détecté. Aucun import depuis `ui/` dans game/core/physics/render ; `app` et
  `main` restent les points de composition. Les imports dynamiques et les
  dépendances transitives externes ne sont pas couverts par ce graphe.
- Vérification des espaces du diff : réussie.
- Aucun test ajouté ni exécuté. Imports et données des fixtures existantes
  adaptés aux nouveaux contrats.
- Aucun playtest, rejeu déterministe, capture visuelle ou mesure de performance
  effectué ; leur résultat n’est donc pas garanti par la compilation.

Les changements restent dans le checkout, sans commit.

