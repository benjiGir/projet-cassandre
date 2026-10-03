---
title: Contrôles et bindings
tags: [reference, input]
status: brouillon
updated: 2026-09-26
---

# Contrôles et bindings

Les actions de gameplay sont définies dans `src/core/input/input.ts`. Les touches de débogage sont séparées et ne peuvent pas être remappées depuis cette API.

## Contrôles joueur par défaut

| Action | Code clavier/souris | Affichage |
|---|---|---|
| Avancer | `KeyW` | W (Z physique sur AZERTY) |
| Reculer | `KeyS` | S |
| Aller à gauche | `KeyA` | A (Q physique sur AZERTY) |
| Aller à droite | `KeyD` | D |
| Sprint | `ShiftLeft` | Maj gauche |
| Sauter | `Space` | Espace |
| Tirer | `Mouse0` | Clic gauche |
| Pied-de-biche | `Digit1` | 1 |
| Pistolet | `Digit2` | 2 |
| Pompe | `Digit3` | 3 |
| Utiliser | `KeyE` | E |

Le jeu lit `KeyboardEvent.code`, qui désigne la position physique de la touche. Le déplacement par défaut convient donc à ZQSD sur un clavier AZERTY. Le libellé de rebinding est dérivé du code QWERTY et affiche W/A, même si le capuchon physique porte Z/Q.

## Persistance et remappage

Les bindings personnalisés sont stockés dans `localStorage` sous la clé `cassandre.keybinds`. Les bindings manquants ou invalides retombent individuellement sur la valeur par défaut. La capture des actions ne consulte pas le stockage pendant la simulation.

`InputManager.rebind(action, code)` change le binding en mémoire et le persiste. Cette couche ne résout pas les conflits : l'interface peut autoriser ou signaler deux actions liées au même code.

## Touches de développement

Ces entrées ne sont pas des actions de gameplay. Elles sont disponibles uniquement en développement.

| Touche | Action |
|---|---|
| F8 | Rend les ennemis passifs ou les réactive. |
| F9 | Commence l'enregistrement des entrées joueur. |
| F10 | Rejoue le dernier enregistrement. |
| V | Affiche la scène en fil de fer. |
| B | Bascule les gizmos balistiques. |
| Accent grave | Ouvre le panneau de réglage à chaud. |

F9/F10 enregistrent les entrées du joueur, pas la totalité de l'état du monde. Un enregistrement ne fige pas les décisions des ennemis, l'état des objets ou les variations d'environnement.

Source du tableau : `src/core/input/input.ts` et `src/game/loop/devGameplayInput.ts`. Pour le contrat de capture et de rejeu, voir [Rejeu et déterminisme](../4-technique/rejeu-et-determinisme.md).
