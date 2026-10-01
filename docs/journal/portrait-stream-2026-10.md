---
title: Portrait vivant du héros dans le retour de stream
tags: [journal, interface, personnage, assets]
status: brouillon
updated: 2026-10-01
---

# Portrait vivant du héros dans le retour de stream

## Période

Proposition visuelle et intégration du 1er octobre 2026. L'utilisateur valide
la planche (« C'est giga stylé, je valide »), puis le portrait rejoint le jeu.

## Objectif

Donner un visage au vidéaste RÉVEIL_DU_PEUPLE. Le retour de stream montre son
état de santé et ses réactions au combat, aux découvertes et aux répliques.
La webcam de `src/ui/hud/widgets/LiveCam/LiveCam.tsx` affiche désormais
le personnage validé dans un cadre de 96 × 54 pixels virtuels.

## Livré et preuve

La [planche originale](../assets/portrait-stream-planche-v1.png) contient
30 portraits : six colonnes d'expressions et cinq lignes de santé. L'image
mesure 1374 × 1145 px ; chaque case mesure 229 × 229 px. Le fond est
transparent. Le même personnage garde sa coiffure, sa barbe et sa tenue.

| Ligne | Santé | Apparence |
|---|---|---|
| 1 | 80–100 % | Visage sain et assuré |
| 2 | 60–79 % | Éraflures légères |
| 3 | 40–59 % | Lèvre fendue et ecchymose |
| 4 | 20–39 % | Sang au front, blessures et fatigue |
| 5 | 1–19 % | Teint pâle et œil gonflé |

Les colonnes montrent, dans l'ordre : repos, douleur, concentration,
victoire, découverte et réplique. Le niveau de blessure suit la ligne,
quelle que soit l'expression.

L'[aperçu interactif](../assets/portrait-stream-apercu.html) propose un
réglage de santé et six boutons d'expressions. Il compare le cadre actuel
de 50 × 28 pixels du jeu avec une proposition de 96 × 54 pixels. Le grand
portrait est agrandi trois fois. Une
[capture de l'aperçu](../assets/portrait-stream-apercu-v1.png) permet de
regarder l'ensemble sans démarrer de serveur.

Génération : outil intégré imagegen. Le
[prompt exact](../assets/portrait-stream-prompt-v1.txt) accompagne la planche.
Les images sont copiées dans le dépôt ; l'aperçu utilise la planche originale
sans la modifier et affiche ses cases avec un filtrage pixelisé.

### Intégration

`src/game/session/heroPortrait.ts` résout la santé et les expressions au pas
fixe. `src/game/loop/updateFx.ts` publie l'image résolue dans le store à
10 Hz maximum. `HeroFace` lit uniquement cet état ; aucune horloge React.
La mort reste prioritaire, suivie de la douleur. Un nouveau coup relance le
recul et les parasites du signal, avec une direction issue de l'impact.

| Événement | Réaction |
|---|---|
| Tir ou coup effectivement porté | Concentration |
| Ennemi éliminé | Sourire ; accent lumineux pour les éliminations rapprochées |
| Arme ou munitions ramassées | Satisfaction |
| Carte, secret ou apparition du Directeur | Surprise |
| Soin ou nourriture | Soulagement et nouveau palier de santé |
| Réplique acceptée | Alternance bouche ouverte/fermée pendant quatre secondes de jeu |
| Mort | Effondrement puis « SIGNAL PERDU » dans la webcam de l'écran de mort |

L'[atlas complémentaire](../assets/portrait-stream-animations-v1.png) fournit
regards, clignements et effondrement. Ses
[prompts](../assets/portrait-stream-animations-prompt-v1.txt) sont conservés.
Les deux images restent intactes, copiées dans `public/assets/ui/` et
échantillonnées par cases en CSS. Les animations de repos suivent un cycle
fixe, sans tirage aléatoire. Les regards vers la droite sont réservés au
personnage sain : ces cases inversent les marques du visage blessé malgré
une tentative de correction du générateur. Les blessés regardent à gauche
et clignent des yeux sans déplacer leurs blessures.

Le badge est placé au-dessus du visage. Les mouvements décoratifs respectent
la pause et la préférence de réduction des animations. La bouche suit la
durée d'affichage de la réplique, sans synchronisation phonétique : les
prises de voix restent à intégrer. Le délai entre répliques utilise
désormais le temps de gameplay ; la pause ne le consomme pas.

Compilation TypeScript et Vite réussie. Les captures d'auteur du HUD sain,
critique et de l'écran de mort sont dans `renders/portrait-stream/`
(non versionné). Le ressenti des réactions en partie attend le retour humain.

## Rejeté et raison

Un visage monochrome rend les paliers difficiles à distinguer. La proposition
garde une peau chaude, des ecchymoses violettes et un éclairage vert discret.
Un casque militaire ne correspond pas au vidéaste ordinaire décrit dans le
catalogue des répliques : la tenue proposée est un sweat olive sur un
tee-shirt rouille.

## Leçons

L'assurance du personnage se lit surtout dans ses sourcils et sa bouche.
Le portrait doit être jugé à la taille du HUD ; la planche agrandie sert à
contrôler sa cohérence et ses états de blessure.
