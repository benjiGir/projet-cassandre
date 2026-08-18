---
name: visual-evidence-gates
description: Régime de preuve avant toute déclaration de complétion — captures déterministes, hash de pixels exact, checks console et canvas, budget de performance, gates de phase. Charger pour toute validation ou revendication qu'une tâche est terminée.
---

# Gates de preuve

Dérivé du régime de preuve de `threejs-game-skills`, durci pour le pixel art.

## Principe

Aucune affirmation de complétion n'est acceptée sans preuve produite. « Ça
devrait marcher » et « j'ai implémenté X » ne sont pas des preuves.

## Matrice de preuve

| Élément | Déclenché par |
|---|---|
| `npm run build` sans erreur | toujours |
| Console navigateur propre | toujours |
| Check canvas non vide | toujours |
| Capture Playwright caméra fixe + seed fixe | changement visuel |
| **Hash de pixels exact** vs référence | changement visuel |
| Test de déterminisme de la boucle | changement `core/` ou `physics/` |
| `frameTime` p50 / p99 sur 30 s | rendu, entités, physique |
| Draw calls, triangles, textures en mémoire | changement de rendu |
| Profiling React (re-renders/s) | changement UI |

Le **check canvas non vide** attrape le mode d'échec le plus fréquent en
Three.js : l'écran noir sans erreur console. Lis les pixels, compte les
non-noirs, échoue en dessous d'un seuil.

## Spécificité rétro : hash exact, pas diff perceptuel

Les packs graphiques Three.js de référence comparent les captures
perceptuellement, avec tolérance. **Ça ne convient pas ici.**

À 640×360 en pixel art, un décalage d'un pixel sur un sprite est une
régression parfaitement visible à l'écran, et tout diff avec tolérance la
laissera passer.

Utilise un **hash exact** du buffer de pixels, sur captures à caméra fixe et
seed fixe. Toute différence est signalée. C'est à l'humain de décider si elle
est intentionnelle et de régénérer la référence.

Faux positifs assumés : à cette résolution, c'est le bon compromis.

## Conditions de capture déterministes

Pour qu'un hash soit stable, il faut neutraliser toutes les sources de
variation :

```
- caméra à une position et rotation fixes, listées dans le manifeste
- seed RNG figé
- animations avancées d'un nombre de steps fixe, pas d'un temps écoulé
- pas de particules temps-réel dans le cadre (ou avancées en pas fixe)
- DPR forcé à 1, viewport fixe
```

Un hash instable signale une source de non-déterminisme — c'est un bug à
diagnostiquer, pas une raison de passer au diff perceptuel.

## Budget de performance

| Métrique | Seuil |
|---|---|
| `frameTime` p99 | < 16.6 ms |
| Draw calls | < 150 |
| Triangles | < 200 k |
| Allocations par frame en régime établi | 0 |

Un dépassement est un échec de gate.

## Ce qui est hors de portée

Les critères de **feel** (« c'est agréable après 2 minutes », « vider un
chargeur est satisfaisant ») ne sont pas vérifiables mécaniquement. Constate
que le test a été fait et par qui. Ne le juge pas, ne le simule pas, ne le
déclare pas validé.

## Format de rapport

```
GATE — Phase N : <nom>
  Build              PASS
  Console            PASS (0 erreur, 0 warning)
  Canvas non vide    PASS (14.2 % de pixels non-noirs)
  Captures           3 vues, hash stable vs référence
  Déterminisme       PASS
  frameTime p99      12.4 ms      PASS (< 16.6)
  Draw calls         87           PASS (< 150)
  Allocations/frame  0            PASS
  Critères humains   <liste> → CONSTATÉ / NON CONSTATÉ

  VERDICT : PASS | BLOQUÉ sur <quoi>
```
