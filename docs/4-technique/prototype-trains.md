---
title: Prototype des trains — salle d’essai T1
tags: [technique, metro, trains, prototype]
status: brouillon
updated: 2026-10-06
---

# Prototype des trains — salle d’essai T1

Premier lot de `PLAN_V2.md`. La salle sert à juger les règles des trains avant
le décor du métro. Le principe du prototype a reçu un retour positif le 2026-10-06 ; les valeurs proposées restent à régler.
Le magasin ne charge aucun de ces objets.

## Responsabilité et frontières

- La salle est une entrée de développement `essai_trains`, construite en
  Three.js et Rapier comme la gym existante. Aucun fichier Blender du magasin
  n'est modifié.
- `TrainSystem` possède l'horaire, les routes retenues, les arrêts et les
  passages de la partie. Il ne connaît ni React, ni le son, ni Rapier.
- `TrainPresentation` construit les rames, place leurs colliders dans le pas
  fixe, interpole le rendu et dessine les afficheurs à 10 Hz maximum.
- Les commandes des boutons de développement sont mises en file et
  consommées dans le pas fixe. Aucun temps mural ni tirage aléatoire ne décide
  du passage d'une rame.

## Fichiers

| Responsabilité | Fichier |
|---|---|
| Entrée de développement | `src/game/level/catalog/levels.ts` |
| Salle, refuges, escaliers et boîtiers | `src/game/level/catalog/trainGym.ts` |
| Contrats | `src/game/level/trains/trainTypes.ts` |
| Valeurs et trois variantes | `src/game/level/trains/trainConfig.ts` |
| Horaire et commandes | `src/game/level/trains/trainSystem.ts` |
| Parcours des routes | `src/game/level/trains/trainPath.ts` |
| Volume mortel balayé | `src/game/level/trains/trainContact.ts` |
| Rames et afficheurs | `src/render/environment/trainGym/trainPresentation.ts` |
| Santé et morts des ennemis | `src/game/session/player/trainGymGameplay.ts` |
| Curseurs de développement | `src/ui/dev/tuning/sections/TrainTuning/TrainTuning.tsx` |

## Place dans la boucle

`updateGameplay` avance les trains après les Costards et résout les contacts,
par la frontière `runGameplaySync` déjà en place. Le contact utilise le
mouvement des acteurs entre deux pas, pas leur seule position finale.

`stepPhysics` applique les poses cibles des corps kinématiques. Les colliders
arrêtent les tirs et les lignes de vue des ennemis. Le joueur ne collisionne
pas physiquement avec la rame : le volume mortel fait foi.

`interpolateVisuals` interpole chaque voiture entre les positions de train
précédente et courante. Le rendu n'avance jamais l'horaire.

`updateFx` consomme les alertes sonores accumulées. Le son provisoire réutilise
l'alerte de porte existante ; les sons de roulement et leur spatialisation
appartiennent au lot T3.

## Données et contrats

### Salle

- Deux voies traversables et deux escaliers sur chaque rive, à 15 m et −15 m.
- Quai à 0,9 m au-dessus de la voie ; remontée par saut ou escalier.
- Tunnel de 153 m depuis le quai : cinq paires de niches, espacées de 30 m.
- Une dérivation change la route des rames suivantes après le milieu du tunnel.
- Trois voitures de 15 m par rame, largeur 2,8 m, hauteur 3,2 m.
- Quatre Costards sur le quai opposé ; graphe de navigation de la station
  calculé à la construction. Les voies restent franchissables dans ce
  prototype ; leur exclusion hors des traversées arrive au lot T2.
- Boîtiers rouges : arrêt de la voie A ; levier bleu : aiguillage de la voie A.
  La voie B circule indépendamment.

### Horaire

Les passages arrivent initialement à 10 s sur A, à 25 s sur B. Le compteur
indique l'arrivée au point de voie voisin de l'afficheur. Un passage en cours
reste indiqué jusqu'à ce que sa dernière voiture ait dépassé ce point.

À l'annonce, la route et la vitesse sont retenues. Un aiguillage ultérieur
ne les change pas. L'arrêt retarde un passage encore non annoncé, ou ajoute
son délai après le passage annoncé. Le délai de réemploi est commun aux
boîtiers de la voie A.

Les variantes **Apprendre**, **Tension** et **Pression** comparent respectivement
18/24/30 m/s, 7/5/4 s de préavis, 30/20/20 s d'intervalle et 12/8/5 s d'arrêt.
Les curseurs permettent les autres combinaisons, dont un délai de réemploi nul.
Les paramètres nouveaux s'appliquent aux passages suivants ; choisir une
variante remet l'horaire à zéro.

### Contact mortel

Le contact compare la capsule verticale de l'acteur au ruban de voie balayé
par la rame pendant le pas. La largeur comprend le rayon de l'acteur et les
extrémités sont arrondies. Le déplacement de l'acteur est également balayé,
ce qui évite de traverser une rame entre deux pas.

Le joueur perd tous ses PV et rejoint l'écran de mort existant. Un Costard
rejoint le chemin de mort du gestionnaire : le compteur de kills, les effets
et le direct reçoivent sa mort une seule fois. Le prototype utilise le gain
de kill habituel ; la prime spécifique aux trains et la cause de mort dans
la télémétrie restent au lot T2.

## Pièges

- Les clés, la campagne, le Contrôleur et le voyage à bord ne sont pas dans T1.
- Les alertes sonores sont provisoires : leur timbre ne valide pas le lot T3.
  L'aperçu embarqué sans activation audio a également montré une récursion
  Howler dans sa file de volume, déjà observée avant T1 ; le son doit être
  réécouté dans la salle ouverte directement, après un clic dans le jeu.
- Le panneau peut masquer le visuel ou le son pour comparer leur lisibilité.
  Ces modes volontairement incomplets servent seulement au playtest.
- Les valeurs et l'espacement des niches sont des candidats, pas un
  équilibrage validé. La règle automatique de lisibilité appartient à T2.
- F9/F10 remet l'horaire à zéro, mais ne restaure pas les ennemis ni les PV :
  comparer sans combat, sur une trajectoire qui survit aux trois variantes.

## Vérifications

La compilation et les liens documentaires passent à la préparation.
L'inspection manuelle confirme les retours d'arrêt et d'aiguillage, puis le
contact mortel : 0 PV et écran de mort pour le joueur, un kill comptabilisé
pour un Costard placé dans le passage. La rame et un refuge sont regardés en
jeu ; les captures de travail restent dans `renders/metro_t1/`.

Aucun test automatisé n'est ajouté ni exécuté à ce lot. La lisibilité, le
rythme, l'esquive et le comportement en pause attendent le playtest dans la
salle, avant d'autoriser le décor.

## Comment vérifier

1. Lancer le serveur de développement et ouvrir `?level=essai_trains`, ou
   choisir **Essai — Trains du métro (T1)** dans le choix de zone du menu.
2. Rester sur le quai pour lire A et B, puis traverser aux deux passages.
3. Dans le tunnel, suivre les bandes jaunes et rejoindre les niches vertes.
4. Appuyer sur la touche d'usage près d'un boîtier rouge ou du levier bleu.
   Essayer avant une annonce, puis pendant : la rame annoncée passe toujours.
5. Ouvrir le tuning avec la touche habituelle (accent grave), comparer les
   trois variantes, puis les alertes visuelles et sonores séparément.
6. F8 rend les ennemis passifs. F9 démarre/arrête un parcours de 15 s et F10
   le rejoue avec le même début d'horaire.
7. Réactiver les ennemis et tenter de les attirer dans la traversée au passage
   d'une rame. Mourir sur une voie puis vérifier que « Reconnecter » repart
   avec l'horaire initial.

Console de développement : `cassandre.trains.config`,
`cassandre.trains.variantes` et `cassandre.trains.system`.

Les réglages fins attendent les sept réponses de `PLAN_V2.md` §3. Le
[prototype T4](prototype-voyage-rame.md) prépare le voyage à bord ; aucun
habillage du métro n’est engagé.
