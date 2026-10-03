---
title: Audit du code de rendu — octobre 2026
tags: [journal, audit, rendu]
status: stable
updated: 2026-10-02
---

# Audit du code de rendu — octobre 2026

**Suite du 3 octobre 2026 :** le point P3 des overlays est traité dans
[Corrections P3](audit-src-p3-2026-10.md).


**Suite du 3 octobre 2026 :** les recommandations P2 sont traitées dans
[Corrections P2](audit-src-p2-2026-10.md). Les constats ci-dessous décrivent
l’état du 2 octobre avant cette seconde passe.


## Periode

2 octobre 2026. Les seize fichiers de `src/render/` sont relus.

## Objectif

Distinguer contrats utiles, descriptions redondantes et connaissances longues.
Examiner les frontières Effect et les dépendances sans mélanger la migration
documentaire avec une modification de comportement.

## Livre et preuve

Les contrats locaux sont regroupés dans
[Contrats locaux du rendu](../6-reference/notes-code-rendu.md).
Les sources gardent les avertissements de cycle de vie, repères spatiaux,
profondeur et cadence ; les autres explications renvoient à cette page.
La migration documentaire initiale modifie uniquement les commentaires :
les tokens des seize fichiers restent identiques à HEAD avant les refactors.
Les commentaires passent de 1 114 à 248 lignes, compte lexical incluant inline.
L’outil historique surestime certains JSDoc avec apostrophe ; le relevé lexical
est conservé séparément. Aucun test n’est ajouté ni exécuté ; la compilation
appartient à la passe globale.

Une seconde passe sépare les types de sprites et valide les manifestes et
vecteurs glTF par Effect Schema. Elle remplace la dépendance à `WeaponSystem`
par le contrat minimal `ViewmodelSource`, adapte le wireframe aux matériaux
mixtes et libère textures partiellement chargées et anciens matériaux glTF.

### Contexte preserve

- Le réticule apparaît après un retour sur la visée jugée hasardeuse : le
  viewmodel décalé ne permet pas d'estimer le centre de tir.
- Le hitmarker est introduit après le playtest de phase 3 pour confirmer un
  dégât même si le sprite touché est difficile à lire.
- Le flash de mêlée est retiré après un carré blanc aveuglant : le quad placé
  devant l'œil, à 0,15 m, couvrait presque l'image. L'impact, le son, le
  hitmarker et le shake fournissent le retour du coup.
- Les decals sont réservés au décor statique après des impacts flottants sur
  des surfaces déplacées ou cassées. Le reparentage et son nettoyage dans
  chaque système sont écartés pour ce prototype.
- Le budget initial de lampes répond à un shader qui cesse de compiler :
  mur mesuré à 255 lampes sur la machine de développement, plafond plus bas
  sur le minimum WebGL 2. Le niveau v2 demanderait environ 1 140 lampes à la
  densité de la salle d'essai. Ces chiffres sont historiques, pas un probe actuel.
- L'élagage des pickups répond à 21 objets dessinés depuis les caisses le
  19 septembre, dont une trousse à 150 m et deux pixels de large.
- Le 25 septembre, les armes au sol à plat ne montrent que 2,5 à 5 cm
  d'épaisseur, sous le pixel dès 5 m. Leurs géométries `world_*` restent
  chargées, mais le rendu les remplace par des billboards.
- Une première icône procédurale est refusée : elle remplit mal son quad et
  le disque noir ressemble à un trou dans le bitume. La version retenue
  pré-rend les vrais modèles, ajuste les UV, retire le disque et relève
  l'émissif de 0,18–0,6 à 0,55–1,3. Le flottement passe de 0,05 à 0,08 m.
  Le pistolet de 0,5 m se lisait encore comme une tache à 6 m et le pompe
  comme un trait à 8 m, d'où les tailles actuelles.
- Le jet permanent devient instancié pour limiter les lots : un mesh visible
  sans jet coûtait un lot dans toutes les vues, dont une ancienne vue à
  198/200. Huit gouttes par jet ne formaient que des points isolés ; 28
  produisent une colonne. Des facteurs d'échelle incorrects donnaient des
  gouttes de 2,5 mm. Un émissif est ajouté pour distinguer l'eau du carrelage.
- Le flash ennemi passe d'une durée fixe 0,25 s à une durée réglable au coup
  suivant, avec la même décroissance exponentielle.

### Constats prioritaires

| Priorité | Fichiers | Constat et suite proposée |
|---|---|---|
| P1 | `src/render/sprites/enemySprites.ts`, `src/render/viewmodel/viewmodel.ts` | JSON et extras sont castés ou validés partiellement. Corrigé : décodage Effect Schema à la frontière de chargement ; calcul des poses toujours synchrone et pur. |
| P2 | `src/render/debug/debugView.ts` | Le message accuse l'invariant #5 retiré ; le wireframe ignore les matériaux mixtes. Corrigé : capacité `wireframe` vérifiée et diagnostic révisé. |
| P2 | `src/render/viewmodel/viewmodel.ts` | `Viewmodel.update` reçoit le `WeaponSystem` concret. Contrat minimal `ViewmodelSource` livré. Le découpage chargement/calcul reste une prochaine passe. |
| P2 | `src/render/fx/fx.ts` | Shake, flashes, decals, débris et fontaines partagent un module. Extraire des sous-systèmes par responsabilité en gardant `FxSystem` comme façade et les pools spécifiques. |
| P2 | `src/render/pipeline/renderer.ts` | Le changement de filtrage parcourt uniquement `map`, pas les autres textures ni les uniformes TSL. Préciser sa portée ou centraliser le registre des textures configurables. |
| P2 | `src/render/pickups/pickups.ts` | Chargement implicite de l'atlas d'armes et caches GPU globaux. Préchauffage explicite au démarrage et propriété des ressources à documenter avant extraction des loaders. |
| P3 | `src/render/overlays/crosshair.ts`, `src/render/overlays/hitmarker.ts`, `src/render/overlays/cameraView.ts` | Construction de canvas et conversion hex CSS répétées. Une petite primitive commune suffit ; les contrats de widgets peuvent rester près de leurs implémentations. |

Les fonctions purement mathématiques n'ont pas besoin d'une enveloppe Effect.
Les entrées/sorties de chargement gagnent davantage à disposer d'erreurs typées,
d'une validation et d'une propriété explicite des ressources. Aucun appel
asynchrone ni `runSync` concurrent n'est découvert dans ce dossier.

## Découpages proposés

Le découpage de `FxSystem` en pools spécialisés figure dans les recommandations.
Il demande de préserver l’ordre des mises à jour et les allocations existantes.

## Lecons

Les commentaires anciens sur Lambert exclusif, les boîtes blanches et le RNG
non seedé ne décrivent plus le projet. Les avertissements utiles restent près
de l'opération : upload avant image, UV inversés, repères local/monde,
profondeur à restaurer et ressources partagées.
