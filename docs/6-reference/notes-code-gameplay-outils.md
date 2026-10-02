---
title: Contrats des réglages et outils gameplay
tags: [gameplay, debug, reglages, code]
status: brouillon
updated: 2026-10-02
---

# Contrats des réglages et outils gameplay

## Réglages

Les modules audio et graphiques vivent hors React : ils persistent dans
localStorage et pilotent les systèmes. Les données invalides ou le stockage
indisponible retombent sur les valeurs de départ. Les écrans affichent les options
et appellent ces modules, sans posséder la logique de persistance.

Le curseur audio est en 0..1 et le gain vaut son carré : 50 % produit −12 dB.
Les gains se multiplient aux niveaux de repos du mix ; 100 % ne dépasse pas
le mix initial. L’application avant création des Howls garde les niveaux au boot.
La coupure d’arrière-plan combine visibilité du document et focus de la fenêtre.
Les listeners sont installés une seule fois. Le choix de sous-titres agit sur la
présentation de la réplique sans changer l’occasion ni sa voix.

Les réglages graphiques capturent les amplitudes originales une seule fois,
avant toute mutation. Le facteur de shake s’applique à ces valeurs, jamais au
résultat précédent. FOV et shake sont mutables sans renderer ; filtrage et
résolution attendent une cible scène/caméra/renderer. Cette cible persistante
survit au reset de partie. Le filtrage posé devient le défaut des textures
créées ensuite, y compris après hot reload. La résolution d’origine reste 640×360 ;
les autres valeurs sont des réglages exposés pour comparaison, pas une correction
du grésillement. Le choix de filtrage réduit est décrit dans l’ADR 0027.

## Console et harnais

La console lit `engine.session` à chaque accès, jamais une référence mise en cache
qui deviendrait périmée au reset. Ses commandes qui modifient le monde sont des
outils de dev ; elles ne participent pas au rejeu F9/F10. La bascule notarget via
clavier est consommée au pas fixe. Les setters de configuration servent au tuning.

La conversion Blender est `(x, y, z) -> (x, z, -y)` pour Three.js ; la pose
exportée représente les pieds, la hauteur des yeux et un cap de 0..360 degrés.
Le pont HTTP de pose est limité au dev et échoue sans bloquer le jeu.

Le harnais de déplacement utilise un monde minimal, pas le niveau complet ; il
vérifie position, vitesse et sorties de vue. Le benchmark de rendu fait dix
images de warmup puis `gl.finish` avant/après la série, pour inclure le travail
GPU. Ses FPS concernent seulement le dessin, pas les coûts physique et gameplay.
Il bloque volontairement la console le temps de la mesure et ne doit pas entrer
dans la boucle. Les variantes A/B gardent la même séquence d’input.

L’inspection éclairage sépare lumières temps réel et luminance des vertex colors.
Éteindre une lampe utilise `visible=false`, pas `intensity=0`, car cette dernière
la conserverait dans les tableaux de lumières du shader. Le budget de lampes
emploie le pool de production quand il existe ; le fallback classe par distance.

La gym regroupe hub, couloir chronométrable, rampes, plateformes, escaliers et
fosses récupérables. Son spawn regarde +Z (`yaw=π`) car la caméra regarde −Z à
`yaw=0`. Sa hiérarchie unique permet un teardown complet sans liste de meshes.

## Références

- [Contrats généraux](notes-code-gameplay.md)
- [Filtrage réduit](../decisions/0027-filtrage-des-textures-reduites.md)
- [Commandes de développement](console-cassandre.md)
