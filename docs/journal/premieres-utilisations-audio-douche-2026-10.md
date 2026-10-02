---
title: Préparation de l'audio et du shader de douche
tags: [journal, performance, audio, rendu]
status: brouillon
updated: 2026-10-02
---

# Préparation de l'audio et du shader de douche

## Période

2 octobre 2026, après le signalement de saccades au premier son et au premier
allumage de la douche.

## Objectif

Déplacer la préparation audio et GPU hors des premières actions du joueur.
Conserver le rendu de l'eau, les fondus audio et la frontière synchrone de la
simulation.

## Livré et preuve

L'audio commence à charger avant le menu. Le démarrage attend le décodage du
sprite et des deux boucles d'eau. Le pool natif Howler est amorcé avec des
lectures muettes sans consommer le RNG. Les boucles restent prêtes à volume
nul ; l'ouverture d'un jet ne crée plus une lecture ou un panoramique.
Web Audio est repris sur une interaction dès le menu, et Howler ne suspend
plus automatiquement le contexte entre deux actions espacées.

Le candidat de niveau prépare les jets TSL avant le commit. Deux rendus
masqués compilent et initialisent leur matériau, puis les jets retrouvent
leur visibilité initiale. Un dernier rendu efface la préparation avant le
paint. Le temps d'écoulement n'avance pas. La préparation asynchrone reste
dans le chargement de `LevelSession`, jamais dans le pas fixe.

Un profilage temporaire de Chrome headless relève les appels WebGL de
compilation et les créations de nœuds audio, puis active la douche par E.
Il ne reste aucun instrument de profilage dans les sources du jeu.

| Mesure | Avant | Après |
|---|---|---|
| Compilations lors du premier allumage | 4 nouveaux shaders | 0 |
| Compilations lors des bascules suivantes | 0 | 0 |
| Première lecture ponctuelle | 0,6 ms sur cette machine | 0,3–0,6 ms, aucun nouveau nœud de gain |
| Rendu le plus long dans la fenêtre du premier allumage après correction | — | 5–5,8 ms |
| Premier allumage après rechargement | — | 0 nouveau shader |

Les douze voix du sprite et les deux boucles d'eau sont amorcées pendant le
chargement. Ces mesures montrent le déplacement du travail ; elles ne
reproduisent pas une longue saccade audio dans ce navigateur et ne préjugent
pas du coût du pilote audio sur la machine du joueur. Le retour humain reste
attendu sur le premier son. La compilation initiale de l'eau peut augmenter
la durée du chargement, suivant le cache du navigateur et le GPU.

Le matériau TSL est partagé entre les jets d'une racine, et non entre deux
niveaux successifs. L'ancien niveau ne peut plus invalider la préparation du
nouveau en libérant ses matériaux.

Compilation TypeScript/Vite réussie. Les liens de documentation sont contrôlés
séparément. Aucune suite de tests n'est lancée pour ce correctif.

## Rejeté et raison

`compileAsync` est prévu pour la préparation des shaders classiques par
[Three.js](https://threejs.org/docs/pages/WebGLRenderer.html), mais
l'adaptateur `WebGLNodesHandler` utilisé ici ne le supporte pas pour les
matériaux nodaux. Un rendu réel est nécessaire.

Un render target hors écran ordinaire prépare une variante linéaire,
différente de la sortie écran. Cette tentative laisse des compilations à
effectuer en jeu. La préparation utilise finalement le framebuffer écran,
masqué par le chargement et restauré avant le prochain paint.

Arrêter puis recréer les boucles d'eau au seuil de silence conserve un coût
au premier jet. Deux boucles Web Audio silencieuses restent prêtes ; seul
leur volume varie. Les contrats du pool, du décodage et de la suspension
sont décrits dans la [documentation Howler](https://github.com/goldfire/howler.js).

## Leçons

Un fichier téléchargé n'est pas une lecture prête ; un matériau construit
n'est pas un shader compilé. La préparation doit utiliser le même chemin de
sortie et le même éclairage que le rendu réel.

Fonctionnement courant : [Audio runtime](../4-technique/audio-runtime.md),
[Rendu](../4-technique/rendu.md#préparation-des-douches) et
[Chargement de niveau](../4-technique/chargement-de-niveau.md).
