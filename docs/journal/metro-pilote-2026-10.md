---
title: Métro — pièce pilote N4
tags: [journal, metro, blender, audio, rendu]
status: brouillon
updated: 2026-10-06
---

# Métro — pièce pilote N4

## Période

6 octobre 2026. L'utilisateur demande « lance N4 » après la planche N3.

## Objectif

Juger le kit et la direction artistique dans le moteur, sur un quai et
60 m de tunnel, avant tout autre habillage du métro.

## Livré et preuve

Le [pilote jouable](../assets/pilote-metro.html) contient une station de
24 m, une rame garée, cinq refuges à 12 m d'écart et une porte de service.
Sa [fiche technique](../4-technique/pilote-metro.md) explique les limites.
La recette Cassandre construit une scène et un GLB distincts de l'atelier N0.

Deux nappes de 20 s et deux événements originaux sont synthétisés et encodés
en OGG/M4A. Les spectrogrammes sont ouverts et regardés. Les mesures des
régions décodées donnent environ −20 / −21 dBFS RMS pour les nappes, des
crêtes sous −6,5 dBFS et des raccords situés dans les variations normales
du signal. L'écoute humaine reste attendue.

Le premier relevé de chargement montre 337 colliders : 211 cuboids,
126 convex hulls, aucun trimesh. Le pilote possède une porte, un bouton,
29 lampes et 23 lots de décor fusionné après la régénération finale.
Ces valeurs décrivent le candidat.

Quatre vues du moteur sont capturées et regardées :
[quai](../assets/pilote-metro/quai.png),
[entrée](../assets/pilote-metro/entree.png),
[refuge](../assets/pilote-metro/niche.png) et
[fond](../assets/pilote-metro/fond.png).
Ce sont des captures de revue : les animations ne sont pas figées,
aucun déterminisme de capture n'est revendiqué.
Les vues comportent 11 à 27 draw calls et 14 479 à 44 038 triangles ;
ces chiffres ne mesurent pas une scène de combat.

Le build final passe, avec l'avertissement existant sur la taille du bundle.
Le contrôle Blender strict du profil métro passe sans erreur ni avertissement.
Le contrôle des liens documentaires passe aussi. La console de la nouvelle
page de revue ne comporte ni erreur ni avertissement lors de l'observation.
Le profil audio du pilote est actif et son enveloppe de quai monte en jeu.
L'ouverture de porte et le parcours complet restent à juger en jouant.

## Rejeté et raison

Retour utilisateur après le premier essai : éclairage accepté, mais les
portes de la rame sont cachées et certains éléments semblent se chevaucher.
Les deux voitures du kit partagent maintenant des flancs découpés autour
des portes. La frise est intégrée aux panneaux ; les vitrages occupent
des ouvertures distinctes. La rame de ligne est réexportée dans le pilote.
La page de revue ajoute deux vues : côté quai et côté voie.

La première capture du correctif révèle un manque de carrosserie au-dessus
des portes. Le bandeau est refermé et les cadres montent sous le toit,
en conservant au moins 2,05 m de hauteur sous linteau côté ligne.
Les portes restent fermées et statiques à ce stade.
Les vues finales [côté quai](../assets/pilote-metro/rame_droite.png) et
[côté voie](../assets/pilote-metro/rame_gauche.png) sont capturées dans le
moteur et regardées. Le [relevé du correctif](../assets/pilote-metro/rame-captures.json)
compte 369 colliders, 23 lots de décor et les mêmes 29 lampes.
Le contrôle Blender strict reste conforme, sans erreur ni avertissement.

Les rechargements de revue font apparaître une erreur de pile Howler :
les volumes étaient mis en file pendant l'attente du contexte audio.
Les nappes naissent maintenant muettes et leur enveloppe attend le début
effectif de lecture avant d'appliquer les volumes. Le même garde-fou est
ajouté aux boucles d'eau et de douche, préparées même dans le pilote.
Leurs réglages répétés à chaque image remplissaient aussi la file Howler.
La dernière page de revue ne produit ni erreur ni avertissement après
l'attente avant activation puis le clic dans le jeu. Son relevé montre
la nappe de quai active à un gain de 0,249. Le build final passe.

Nouveau retour : les luminaires du quai semblent flotter. Les huit luminaires
reçoivent chacun deux tiges et deux platines d'acier. Leurs fixations suivent
la voûte facettée. La [vue du quai avec suspensions](../assets/pilote-metro/quai-suspensions.png)
est rendue dans le moteur et regardée : 27 draw calls et 45 606 triangles.
Le build et le contrôle Blender strict passent. La console de cette revue
contient une erreur MutationObserver sans URL source ; elle n'est pas
attribuée au jeu et aucun verdict de console entièrement propre n'est posé.

- Le registre de scénarios du magasin validait des portes et groupes absents
  du pilote. Un registre par niveau est maintenant sélectionné au chargement
  et au pas fixe ; les contrôles du magasin restent conservés.
- Le premier tunnel est trop sombre en jeu. La texture stocke une couleur
  linéaire dans un PNG sRGB : le décodage la réduit encore. Le générateur
  N3 est corrigé, puis la bibliothèque et le pilote sont régénérés.
- Trois dossiers de sièges sont à la limite de 0,1 m et échouent par arrondi.
  Leur épaisseur passe à 0,125 m. Les inscriptions reçoivent aussi `Col`.
- Le FFmpeg disponible ne contient pas libvorbis. Le générateur sélectionne
  l'encodeur Vorbis natif, puis mesure les deux fichiers réellement encodés.

## Leçons

Le rendu Blender ne suffit pas à valider la couleur d'une texture dans le jeu.
La conversion sRGB doit être juste avant de compenser un défaut par des lampes.
Les ambiances et scénarios doivent suivre le niveau, pas seulement ses
coordonnées : les deux niveaux partagent un repère proche de l'origine.

N4 reçoit l’accord utilisateur pour poursuivre le 2026-10-06 :
« on est pas mal la tu peux continuer ». Le jugement du rythme,
de la longueur et de la dangerosité des trains attend le blockout N5/T2.

## Correction commune du placement

Après la revue du trafic T2, les bancs du pilote N4 sont également orientés
vers les voies. Le panneau d’accès est fixé au mur, les plaques des refuges
sont numérotées sans texte superposé, et les luminaires du tube ont leurs
suspentes. La commande de maintenance possède désormais son origine d’usage
sur le boîtier visible. Voir le [retour T2](metro-trains-2026-10.md#correction-après-retour-sur-le-placement).
