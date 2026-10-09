---
title: Déplacement et contrôles
tags: [fonctionnel]
status: stable
updated: 2026-10-08
---

# Déplacement et contrôles

## Ce que vit le joueur

Vous avancez, reculez et vous déplacez latéralement au clavier, vous visez à
la souris. Une touche de sprint fait passer de la marche à la course tant
qu'elle reste enfoncée — pas de bascule à cliquer, pas de jauge d'endurance à
gérer. Sauter donne toujours la même hauteur, un peu plus d'un mètre, que
vous couriez ou marchiez au moment de l'appui.

Il n'y a pas d'accroupi. En l'air, vous gardez une petite marge de manœuvre
pour corriger votre trajectoire, mais nettement moins qu'au sol : un saut
raté ne se rattrape pas en changeant brutalement de direction en plein vol.

Le sol n'est pas toujours plat : une petite marche ou un rebord bas se
franchit sans ralentir, comme une marche d'escalier qu'on monte sans y
penser ; une pente modérée se grimpe normalement, une pente trop raide fait
glisser. Si vous tombez d'une hauteur bien supérieure à tout ce que le niveau
demande de sauter volontairement, vous êtes remis debout sur le dernier sol
solide que vous avez touché — un filet de sécurité contre les trous du
niveau, pas une mécanique de jeu en soi : il ne devrait jamais se
déclencher en jouant normalement.

Votre vue réagit à ce que vous faites : elle se balance légèrement au rythme
de vos pas, s'élargit un peu quand vous sprintez à pleine vitesse, et
s'enfonce brièvement à la réception d'un saut ou d'une chute. Ce sont des
retours purement visuels : ils n'affectent jamais votre visée, qui reste
toujours exactement là où pointe votre souris, sans le moindre délai ni le
moindre lissage — contrairement au reste de la vue, la rotation de la caméra
suit la souris à l'instant même où vous bougez.

## Règles

- La course se maintient tant que la touche de sprint est enfoncée ; elle ne
  se déclenche pas au premier appui puis ne s'arrête pas au second.
- La hauteur de saut est fixe, indépendante de la vitesse de déplacement.
- Il n'y a ni accroupi, ni double saut.
- Une petite marche ou un rebord bas se franchit automatiquement, sans
  interrompre la course ; un obstacle plus haut bloque le passage.
- Une pente trop raide n'est pas grimpable et fait glisser vers le bas.
- Aucune action, aucun réglage de mouvement, ne dépend de la manette de jeu :
  clavier et souris seulement.
- Aucune animation ou temporisation n'empêche jamais de bouger, sauter,
  viser ou tirer — pas de geste qui vous immobilise, même brièvement.
- La rotation de la caméra suit la souris sans aucun délai ; seuls les
  petits mouvements de vue cosmétiques (balancement des pas, élargissement du
  champ de vision à la course, tassement à la réception) sont progressifs.
- La sensibilité de la souris n'a pas de réglage dans les options du jeu : elle
  est fixée dans `moveConfig`, et ne se règle qu'en développement, dans le
  panneau de tuning.

### Contrôles par défaut

| Action | Touche |
|---|---|
| Avancer / reculer | `W` / `S` |
| Aller à gauche / à droite | `A` / `D` |
| Sprint | Maj (gauche), maintenue |
| Sauter | Espace |
| Viser | Souris |
| Tirer (ou coup de pied, sans arme) | Clic gauche |
| Utiliser | `E` |
| Changer d'arme | `1` / `2` / `3` |

Ce tableau donne les touches par défaut sur un clavier QWERTY. Le jeu lit la
position physique de la touche plutôt que le caractère imprimé dessus : sur
un clavier AZERTY, les mêmes emplacements donnent déjà ZQSD sans aucun
réglage à faire. Toutes les actions ci-dessus se remappent librement dans
les options, et le remappage est conservé d'une session à l'autre. Seules
les touches de débogage, jamais montrées au joueur, échappent à ce
remappage.

## Valeurs

Détail chiffré (vitesses, hauteur de saut, gravité, distance de chute
déclenchant le filet de sécurité, marges de franchissement) :
[Valeurs de déplacement](../6-reference/valeurs-deplacement.md). Table complète
des actions et de leurs touches : [Contrôles et bindings](../6-reference/controles.md).

## État

- Validé en playtest : la sensation de déplacement de base (marche, course,
  saut) — retour direct de l'utilisateur, comparée à Quake et Half-Life 1.
- En attente de verdict : le dosage fin des retours de vue (balancement des
  pas, élargissement du champ de vision, tassement à la réception), le
  comportement en l'air en cas de changements de direction répétés (une
  proposition d'aller plus loin dans ce sens, à la Quake, n'est pas encore
  tranchée), et le filet de sécurité en cas de chute — jamais déclenché par
  une vraie chute de joueur en conditions de jeu réelles à ce jour.

## Pour aller plus loin

- Le fonctionnement interne du contrôleur de déplacement : [Joueur](../4-technique/joueur.md).
- La physique et les collisions sous-jacentes : [Physique](../4-technique/physique.md).
- La table complète des contrôles et leur remappage : [Contrôles et bindings](../6-reference/controles.md).
- Toutes les valeurs numériques de déplacement : [Valeurs de déplacement](../6-reference/valeurs-deplacement.md).
