---
title: Notes de conception de l’interface
tags: [react, interface, maintenance]
status: stable
updated: 2026-10-02
---

# Notes de conception de l’interface

Connaissances déplacées depuis les commentaires de `src/ui/`. Les conventions de
[composition](react-composition.md), de [CSS](react-css.md) et de
[React](react-bonnes-pratiques.md) restent les contrats de référence.

## Écrans et navigation

`App` compose l’interface en jeu ; `app/bootChoice.ts` monte les menus qui
précèdent la partie. Les actions de reprise, de rejeu et de retour au menu
arrivent par callbacks : l’écran ne décide pas comment reconstruire une
session. Le graphe XState de navigation n’a besoin ni du DOM, ni de Three,
ni de Rapier. Un seul acteur vit pendant toute la durée de l’onglet.

Le pas fixe et le rendu continuent en pause ; le contenu du pas de gameplay
est ignoré. `PauseScreen` compose l’écran d’options avec un fond translucide,
et revient toujours à son panneau principal lors d’une nouvelle pause.
Le menu principal emploie le fond opaque. Réutiliser les options ici est une
composition, sans transférer la navigation vers cet écran.

Le récapitulatif est calculé par le jeu puis présenté par `RecapTable`.
À la mort, il est partiel : aucun bonus de rapidité. À la fin du niveau,
le temps et les spectateurs restent en tête, les secrets sont déjà détaillés
dans la table. Les lignes se révèlent en CSS grâce à `--i` ; aucun bouton
n’est retardé par cette animation.

## Présentation et abonnements

Chaque widget sélectionne sa propre donnée Zustand. Le compteur de FPS
et les munitions sélectionnent directement le texte ou le nombre affiché
afin d’éviter un rendu si la valeur visible n’a pas changé. Les canaux
message système et réplique du héros sont distincts ; leurs durées relèvent
du jeu. Le portrait reçoit une image déjà résolue par le contrôleur de jeu.

Les primitives transmettent leurs couleurs par la cascade CSS. Leur taille,
leurs marges et leur disposition appartiennent au parent. `CornerFrame`
règle ses coins avec `--corner-size`, `--corner-offset`, `--corner-width`.
`Screen` capture les clics ; le HUD laisse la souris atteindre le jeu.
Le pixel virtuel `--vpx` suit l’image de 640×360 contenue dans la fenêtre.
La largeur fixe des nombres de debug évite que le panneau tremble.
Le texte du bandeau défilant est doublé pour éviter un trou dans sa boucle.

Les règles de mouvement réduit de la table doivent rester après les règles
animées de même spécificité, pour rétablir immédiatement opacité et position.
Le centrage CSS `safe` maintient le titre accessible lorsque le contenu dépasse
la fenêtre. Les largeurs utilisent `clamp` pour ne pas déborder sur les petits
écrans. Le flou du fond de pause n’entraîne pas de mise à jour React par image.

## Chargement et réglages

La barre de chargement décrit la progression réelle ; les phrases satiriques
ne remplacent jamais son libellé. Elles tournent toutes les 2,4 secondes,
avec un décalage initial d’horloge qui ne consomme pas le RNG du gameplay.

Les réglages audio et graphiques sont persistés et appliqués par leurs
modules de jeu. Le remappage des touches relit les bindings après une action,
l’entrée n’étant pas un store React. La capture annule sur Échap, ignore les
codes vides, ne reconnaît que les clics gauche et droit, et bloque le menu
contextuel pendant une capture.

## Outils de développement

Le choix de zone, le debug, le tuning et `?uiPreview=` sont réservés au
développement. Le preview fournit une scène de fond factice et des données
préparées sans démarrer une session ni demander le verrouillage du pointeur.
Les gardes `import.meta.env.DEV` permettent leur élimination au build.

Le panneau lit des configurations mutables : exception délibérée réservée
au développement, les variantes et la console pouvant les modifier ailleurs.
Les valeurs par défaut sont copiées à l’import, avant l’application des
réglages persistés. Les curseurs portant ⚙ nécessitent la reconstruction
de la capsule ou du character controller. Elle est limitée à une application
toutes les 100 ms pendant un glissement, puis forcée au relâchement.
Les variantes de déplacement ne changent que la vue, sans cette reconstruction.

Les bornes des curseurs encadrent les valeurs exposées ; elles ne remplacent
pas un arbitrage de sensation de jeu. Les harnais de feedback ne modifient
que les paramètres explicitement listés, pas toute la machine de l’ennemi.
Le retour aux défauts des impacts remet néanmoins toute la configuration
d’arme à sa référence d’import. Le collage au sol est borné à 0,6 m/s :
voir les [mesures de stabilité](../archive/systems-joueur.md#une-vitesse-de-collage-au-sol-volontairement-faible-groundstickspeed).
