---
title: Prototype du voyage à bord — salle d’essai T4
tags: [technique, metro, trains, prototype]
status: brouillon
updated: 2026-10-06
---

# Prototype du voyage à bord — salle d’essai T4

Après le retour positif de l'utilisateur sur [T1](prototype-trains.md), ce lot
fait juger l'autre idée forte du métro : combattre dans une rame pendant le
voyage. La sensation de voyage est validée par l’utilisateur le 2026-10-06
(« pas mal la sensation est bonne »). Le rythme et le combat restent à régler
avant le raccord au niveau réel.

## Responsabilités

| Responsabilité | Fichier |
|---|---|
| Salle, rame fixe, quais, portes | `src/game/level/catalog/trainRideGym.ts` |
| Contrats | `src/game/level/trainRide/trainRideTypes.ts` |
| Valeurs et variantes | `src/game/level/trainRide/trainRideConfig.ts` |
| Horloge et commandes | `src/game/level/trainRide/trainRideSystem.ts` |
| Tunnel et afficheur | `src/render/environment/trainRide/trainRidePresentation.ts` |
| Départ, portes et embuscade | `src/game/session/player/trainRideGameplay.ts` |
| Curseurs de développement | `src/ui/dev/tuning/sections/TrainRideTuning/TrainRideTuning.tsx` |

## Rame et quais

Trois wagons de 15 m forment une rame fixe, avec un sol continu, des sièges
latéraux et deux passages de 2,24 m entre voitures. Le joueur commence à
l'arrière, déjà à bord ; le pupitre est à l'avant. Le quai de départ est à
gauche de la voiture arrière ; celui d'arrivée, à droite de la voiture avant.

Les sols, sièges, parois et toits possèdent des colliders statiques. Les
ouvertures de fenêtres sont solides pour le joueur et les tirs. Le tunnel qui
défile ne possède **aucun collider**. Aucune plateforme mobile ne porte le KCC.
Les deux portes réutilisent `DoorSystem` : corps fixes, collision seulement
fermées, rendu interpolé et refus de fermeture sur un acteur.

## Horloge et mouvement

Dans le pas fixe, `updateTrainRideGym` consomme les commandes, avance
`TrainRideSystem`, ferme les portes, déclenche la vague et libère la sortie.
Le départ est refusé hors de la rame et annulé si le joueur en sort pendant
la fermeture. La phase de fermeture attend que les
deux portes soient entièrement fermées avant de faire défiler le tunnel.

Le voyage passe par embarquement, fermeture, accélération, croisière,
freinage et arrivée. Une courbe cubique lisse la vitesse au départ et au
freinage ; sa primitive donne la distance absolue. Les quatre valeurs de
mouvement, le délai d'embuscade et son activation sont retenus au départ.
Aucun temps mural ni tirage aléatoire ne décide de ces phases.

Les variantes proposées sont **Court** (30 s, 18 m/s), **Référence** (60 s,
24 m/s) et **Long** (90 s, 28 m/s). Ce sont des candidats à comparer, pas des
valeurs d'équilibrage approuvées. L'accélération et le freinage restent chacun
sous le tiers de la durée retenue.

Une seule vague apparaît à 12 s par défaut : un Costard et deux Rampants,
dans la voiture centrale. Elle réutilise la matérialisation existante, dont les
shaders sont préchauffés à la frontière asynchrone du chargement. Le graphe
de navigation est calculé sous le toit de la rame. Le Contrôleur appartient
au lot C4 ; il ne remplace pas encore cette vague d'essai.

## Rendu et raccords

`interpolateVisuals` interpole la distance et déplace seize sections de tunnel
sans collision en boucle. La rame reste fixe. Les nervures, câbles, lampes et
signaux extérieurs donnent les repères de vitesse. L'afficheur se rafraîchit
à 10 Hz maximum et affiche phase, vitesse et temps restant.

Le changement entre quai statique et tunnel défilant se fait pendant un bref
passage noir derrière les fenêtres. Le départ et l'arrivée restent des
raccords de prototype ; le tunnel final et la gare réelle sont à construire.
À l'arrêt, le quai d'arrivée devient visible et la porte droite s'ouvre.

## Limites

- Salle de développement uniquement : `essai_voyage_rame`. Le magasin et ses
  sources Blender ne sont pas modifiés.
- Pas encore de son de roulement propre à la rame (lot T3), ni de campagne,
  objectifs, fin de niveau ou Contrôleur.
- Remettre le voyage à zéro ne restaure ni les ennemis ni les PV. La vague
  apparaît une seule fois par session pour éviter les doublons. Reconnecter
  pour rejouer le combat ; comparer le mouvement avec l'embuscade désactivée.
- F9/F10 remet le voyage et la pose initiale des portes à zéro : enregistrer depuis le pupitre, inclure le
  départ avec E, puis rejouer avec les mêmes paramètres et sans combat.
- L'aperçu embarqué peut rencontrer le défaut Howler décrit dans T1. Le son
  est à juger après activation audio dans le jeu ouvert directement.

## Vérifications

La compilation de production et le contrôle des liens documentaires passent.
L’inspection en jeu montre le défilement à 18 m/s, l’arrêt au bout de 30 s,
l’ouverture de la sortie droite et son quai. Avec les ennemis actifs, la
vague rejoint le joueur immobile et déclenche l’écran de mort avant l’arrivée.
Les captures de travail restent dans `renders/metro_t4/`. Aucun test automatisé n'est ajouté ni exécuté.

## Comment vérifier

1. Ouvrir `?level=essai_voyage_rame`, ou choisir **Essai — Voyage à bord (T4)**.
2. Traverser les trois wagons, rejoindre le pupitre avant et appuyer sur E.
3. Regarder le tunnel depuis les fenêtres pendant l'accélération et le
   freinage ; se déplacer et tirer dans la rame pendant l'embuscade.
4. À l'arrivée, sortir à droite sur le quai.
5. Ouvrir le tuning avec l'accent grave, comparer 30/60/90 s et les vitesses.
   Désactiver l'embuscade avant le départ pour juger le seul mouvement.
6. Pour rejouer la vague, reconnecter à cette salle. Pour comparer les
   mouvements, rester à bord et utiliser **Repartir à zéro**.

Console de développement : `cassandre.voyageRame.config`,
`cassandre.voyageRame.variantes` et `cassandre.voyageRame.system`.

Le gate de sensation de T4 est passé. La suite du plan commence par N0 :
préparer l’outillage du second niveau, puis les références et le plan de
masse. Le rythme, le combat et le son restent à régler ; aucun décor définitif
du métro n’est engagé.
