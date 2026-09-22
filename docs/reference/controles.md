---
title: Contrôles et bindings
tags: [reference, input]
status: stable
updated: 2026-09-22
---

# Contrôles et bindings

Contrat du moteur d'input rebindable (`src/core/input.ts`). Pour la
synchronisation des fronts avec le pas fixe, voir
[boucle de jeu](../systems/boucle-de-jeu.md#entrée-synchronisée-au-pas-fixe).

## Actions de gameplay et bindings par défaut

Une action par élément d'`InputFrame` (`core/inputRecorder.ts`) qui provient
d'une touche ou d'un bouton — `yaw`/`pitch`/`dx`/`dy` restent hors de cette
table, ce ne sont pas des bindings discrets.

| Action | Touche par défaut | Libellé |
|---|---|---|
| `moveForward` | `KeyW` | Avancer |
| `moveBack` | `KeyS` | Reculer |
| `moveLeft` | `KeyA` | Aller à gauche |
| `moveRight` | `KeyD` | Aller à droite |
| `sprint` | `ShiftLeft` | Sprint |
| `jump` | `Space` | Sauter |
| `fire` | `Mouse0` | Tirer |
| `switchMelee` | `Digit1` | Arme : pied-de-biche |
| `switchPistol` | `Digit2` | Arme : pistolet |
| `switchShotgun` | `Digit3` | Arme : pompe |
| `use` | `KeyE` | Utiliser |

Table identique aux codes qu'avait en dur `captureInputFrame` (aujourd'hui
`game/loop/updateGameplay.ts`) avant l'introduction de cette API — à une
exception près, assumée : l'arrivée du pistolet (2026-09-16) a pris la touche
`2` et repoussé le pompe en `3`, l'ordre classique du genre. Un joueur qui
avait déjà rebindé ses touches garde les siennes : `localStorage` l'emporte
sur cette table.

Les touches de DEBUG (voir ci-dessous) sont volontairement absentes de cette
table : outils de dev, jamais montrées au joueur, jamais persistées, jamais
rebindables via cette API.

## Touches de dev

Lues au taux d'affichage dans `game/loop/updateFx.ts` (sauf le panneau de
tuning, qui écoute lui-même), jamais rebindables. **Absentes du build de
production** : leur lecture est sous `import.meta.env.DEV`, constante au
build, donc la branche n'existe pas dans le bundle livré — même régime que le
panneau de debug, le panneau de tuning et `window.cassandre`. Sans ça, un
joueur qui aurait rebindé une action sur `V` ou `B` basculerait le wireframe
ou les gizmos en jouant.

| Touche | Effet |
|---|---|
| `F8` | **Ennemis passifs** (`notarget`) : ils ne voient plus le joueur et leurs attaques ne font rien — pour parcourir un niveau et le regarder |
| `F9` / `F10` | Enregistre / rejoue une séquence d'input (harnais A/B, preuve de déterminisme) |
| `KeyV` | Wireframe de toute la scène |
| `KeyB` | Gizmos balistiques (actifs par défaut en dev, éteints en prod) |
| `` ` `` | Panneau de tuning à chaud (`ui/TuningPanel.tsx`) |

`KeyM` (musique) n'est pas dans cette liste : c'est une touche joueur, fixe
et non rebindable, doublée par l'écran Options.

**`notarget` est la seule de ces bascules qui touche le GAMEPLAY**, pas
seulement l'affichage — d'où son message HUD à chaque bascule, qui évite de
prendre plus tard des ennemis inertes pour une IA cassée. Elle vit dans
`game/devtools/cheats.ts`, se coche aussi dans le panneau de tuning et
s'appelle en console (`cassandre.notarget()` / `cassandre.notarget(false)`).
Un ennemi déjà lancé perd le contact immédiatement, sans attendre
`lostContactTimeout`. Conséquence : une séquence enregistrée à F9 avec
`notarget` actif ne se rejoue pas à l'identique sans lui — les ennemis ne
prennent plus les mêmes décisions, même si le RNG, lui, reste continu
(invariant #12).

## Pourquoi ça marche déjà en AZERTY

`KeyboardEvent.code` identifie la touche par sa POSITION PHYSIQUE sur le
clavier — nommée par convention d'après la disposition QWERTY US, mais
INDÉPENDANTE du layout système réellement actif. `KeyboardEvent.key`, à
l'inverse, dépend du layout : c'est le caractère produit, ce que
l'utilisateur voit imprimé sur sa touche. C'est la définition du spec W3C
[UI Events KeyboardEvent code](https://www.w3.org/TR/uievents-code/) : les
valeurs de `code` sont choisies pour rester stables quel que soit le
layout, précisément pour permettre ce genre de contrôle « par position »
(jeux, raccourcis). Comportement implémenté de façon cohérente par tous les
navigateurs evergreen (Chrome, Firefox, Safari, Edge) sur Windows/macOS/
Linux pour un layout installé normalement (pas un remap au niveau pilote
type Karabiner, hors du cadre du spec DOM).

Concrètement, sur un clavier AZERTY français : la touche physiquement à
l'emplacement du « W » QWERTY (étiquetée « Z » sur le capuchon AZERTY)
déclenche quand même `code === "KeyW"`. Ce moteur d'input a TOUJOURS lu
`.code`, jamais `.key` — un joueur AZERTY utilisant ZQSD obtient donc déjà,
structurellement, le bon binding physique, SANS AUCUN changement de table
par défaut.

`Digit1`/`Digit2`/`KeyE` ne posent pas davantage de problème : seules Q/A
et W/Z sont interverties entre QWERTY et AZERTY, E occupe la même position
physique sur les deux ; la rangée de chiffres est à une position identique
sur les deux layouts (le fait qu'elle nécessite Shift pour produire un
chiffre en AZERTY est sans importance : `.code` identifie la touche
pressée, jamais le caractère qu'elle produit).

Le vrai livrable de cette table n'est donc PAS un correctif AZERTY (déjà
acquis structurellement, avant même ce fichier) : ce sont les mécanismes de
REMAPPING par-dessus une base déjà correcte — un joueur DVORAK, BÉPO,
gaucher côté souris, ou qui préfère simplement d'autres touches, a toujours
besoin d'un vrai rebind, indépendamment de la question AZERTY.

## Limite : libellés de touches en AZERTY

`formatKeyCode` dérive un libellé court à partir du NOM du code (convention
QWERTY), pas du glyphe réellement imprimé sur la touche physique du
joueur : `formatKeyCode("KeyW")` renvoie `"W"` même pour un joueur AZERTY,
qui voit « Z » sur ce capuchon.

Corriger ça précisément demanderait soit `navigator.keyboard.getLayoutMap()`
(async, non supporté partout — absent de Firefox), soit de capturer
`KeyboardEvent.key` (dépendant du layout, donc correct pour l'affichage) AU
MOMENT du rebind, en plus de `.code` (indépendant du layout, utilisé pour
la logique) — un flux d'UI que `shell` est mieux placé pour implémenter,
puisqu'il construit l'écran « appuie sur une touche ».

## Persistance et couche par action

Les bindings sont chargés depuis `localStorage` (clé
`cassandre.keybinds`) dès la construction d'`InputManager`, pas dans
`attach()` — la persistance est prête sans dépendre de l'ordre d'appel de
`main.ts`. Jamais de throw : un `localStorage` corrompu, indisponible (mode
privé strict) ou absent (environnement de test) dégrade silencieusement
vers les valeurs par défaut.

La couche par action (`isActionDown`, `consumeActionJustPressed`,
`wasActionJustPressed`) est une pure traduction action → code par-dessus
les méthodes par code (`isDown`, `consumeJustPressed`, `wasJustPressed`) :
même contrat destructif/non-destructif, mêmes garanties de déterminisme —
aucune lecture de `localStorage` pendant un pas fixe, seulement de
`this.bindings` déjà résolu en mémoire. C'est la surface que
`captureInputFrame` (`game/loop/updateGameplay.ts`) utilise pour toute action
de GAMEPLAY.

`rebind(action, code)` ne valide AUCUN conflit (deux actions pouvant
partager le même code après coup) : ce n'est pas le rôle du moteur d'input
de décider si une UI doit l'interdire, l'avertir ou l'autoriser (par
exemple un joueur AZERTY qui dupliquerait volontairement une touche).
Laissé à `shell`.

Retour à la [carte de la documentation](../README.md).
