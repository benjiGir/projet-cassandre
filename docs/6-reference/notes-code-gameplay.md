---
title: Contrats du gameplay conservés lors de l’audit
tags: [gameplay, code, contrats]
status: brouillon
updated: 2026-10-02
---

# Contrats du gameplay conservés lors de l’audit

Cette référence rassemble les explications nécessaires au maintien de `src/game/`.
Les avertissements locaux restent près du code. Les détails des sous-domaines
sont dans les références liées en fin de page.

## Session et moteur

`GameEngine` contient les objets qui survivent à un reset : scène, caméra,
renderer, overlays, planches de sprites, modèles, horloge et interactions.
`PersistentEngine` exclut la session pour permettre sa première construction.
`GameSession` contient le monde Rapier et l’état d’une partie. Les systèmes du
niveau sont reconstruits ensemble après préparation du nouveau niveau.

Les fonctions de spawn reçoivent explicitement la session en construction.
Lire `engine.session` à ce moment placerait les ennemis dans l’ancienne partie.
Les objets `look` et `lookDelta` restent les mêmes références pendant toute la
vie du moteur. Les spawns changent leurs champs, pas leurs références.

La caméra appartient au graphe de scène : son viewmodel est un enfant, invisible
sans ce rattachement. Le far plane de 130 m couvre la ligne de vue de 115,5 m de
la gym avec une marge. Le réticule est ajouté avant le hitmarker afin de laisser
le flash de confirmation au-dessus. Les normales des billboards sont inclinées
à 45° pour recevoir les lampes de plafond.

La santé maximale et les compteurs de secrets appartiennent à la session.
Le store en reçoit un miroir ; le récap et les règles de soin lisent la session.
Le boot réinitialise l’horloge, les effets, le miroir HUD et les générateurs
cosmétiques déterministes. La géométrie de la gym existe seulement sur son chemin
de boot. Son groupe possède aussi la balle de test. La libération attend l’arrêt
du chargement, retire le niveau et les sprites, réinitialise les effets, puis
libère le monde Rapier. Une vérification du flux « monde vivant » protège les
accès pendant la transition de retour au menu ; elle diffère de « partie jouée ».

## Boucle et présentation

Les entrées de mouvement et les fronts de touches sont consommés au pas fixe.
La visée brute est capturée à l’affichage avant les pas fixes ; aucun lissage de
rotation ne s’ajoute. Le bob modifie uniquement la position de caméra. Le FOV
utilise la vitesse réellement réalisée, pas la touche de course.

Les files de tirs, dégâts et décès s’accumulent pendant les pas fixes d’une
image. Chaque consommateur gameplay mémorise son curseur ; la présentation vide
ces files après leurs lecteurs. Une lecture répétée de la totalité des impacts
ferait appliquer plusieurs fois les dégâts pendant le rattrapage d’une image.
Les compteurs du récap sont incrémentés au pas fixe, pas à la consommation visuelle.
Le calcul pur vit dans `session/score.ts` et sa publication dans `session/recap.ts`.

L’interpolation pose d’abord la caméra puis les props et billboards qui dépendent
de sa distance. Les props sont relus après le pas Rapier. Les scratches sont
réutilisés séquentiellement : leurs consommateurs ne doivent pas les retenir.
Les événements stockés pour une lecture ultérieure possèdent leurs copies.

Les effets, sons positionnels, pickups et flashes utilisent le temps réel de
présentation ; ils ne décident pas les dégâts. Un impact sur une surface mobile
ou cassable ne reçoit pas de decal fixe, qui flotterait après déplacement ou
casse. Le pied-de-biche n’émet pas de muzzle flash. Les tirs prennent leur éclair
au canon du viewmodel, et leur trajectoire à l’œil non interpolé.

Le debug et le portrait sont publiés à 10 Hz maximum. Les notifications discrètes
(PV, carte, secret, message, fin) sont ponctuelles. Le shake s’ajoute à la caméra
après que ses lecteurs de position ont fini. Les réglages visuels restent des
références mutables lues par les systèmes concernés.

## Progression et fin

Les cartes vivent dans `session.cards` ; le store copie un inventaire ordonné
Argent, Or, Platine. Un ramassage en double est sans effet. Le hot reload garde
l’inventaire et les portes déjà déverrouillées, puis masque les cartes possédées.
Un `use_*` à carte reste réessayable tant que son exigence manque.

L’ouverture à carte déverrouille un groupe entier. Les noms de sorties sont
`door_e_exit` et `door_exit` ; une autre porte ouverte n’arme pas la fin de niveau.
La normale de traversée vient de l’axe horizontal local le plus fin du collider,
transformé par sa rotation. La marge de 1 m empêche de finir au contact du vantail.
Le récap est publié avant le changement d’écran ; les gardes mort/fin le rendent
idempotent. La fin donne le bonus de temps ; la mort n’en donne pas.

Le filet de chute mémorise uniquement un sol réellement touché : `isGrounded`
seul est insuffisant après une téléportation. La garde `numCollisions > 0` évite
de mémoriser un point dans le vide. Il rattrape une chute de 12 m sous le dernier
sol et signale les coordonnées du trou en console. Ce garde-fou ne remplace pas
la correction du niveau.

## Feedback et récap

Le canal système et les répliques sont distincts. Les répliques non prioritaires
respectent 15 s de gameplay ; les répliques prioritaires peuvent le contourner.
Chaque occasion utilise le PRNG dédié et les flags `once` de la session. Le texte
reproduit la prise audio retenue ; la clé audio est `heros_<id>_a`.
Les cris courts ne donnent pas de sous-titre et respectent leur intervalle.
Leur fenêtre minimale de protection d’une réplique n’est pas toute sa durée audio.

Les minuteries de disparition du texte sont de présentation, au temps mural.
Elles ne décident aucune règle gameplay. Les dégâts, les réactions du portrait et
les occasions de réplique sont décidés au pas fixe. Les bandages et expressions
suivent cinq bandes de santé ; la douleur et la mort ont priorité.
Les images latérales blessées ne sont pas retournées : les plaies restent du même côté.

Le score distingue un tir réel d’une tentative à sec. Un coup de pompe est un
seul tir précis si au moins un plomb touche un ennemi. Les totaux d’ennemis
incluent les morts, qui restent dans les tableaux des managers. Les pertes de PV
sont informatives et ne rapportent pas de points. Le score de précision vaut
au plus 1 000 points ; le temps donne 10 points par seconde gagnée, jamais un
malus. Les secrets donnent 500 points et 1 000 de bonus si tous sont trouvés.
La casse donne 10/25/50 pour prop/vitre/sanitaire ; Costard et Directeur donnent
100/1 000. Les « vues » en direct sont un compteur distinct, avec un PRNG dédié.

## Références de sous-domaines

- [Joueur et armes](notes-code-gameplay-joueur.md)
- [Ennemis et machines](notes-code-gameplay-ennemis.md)
- [Chargement et objets du niveau](notes-code-gameplay-niveau.md)
- [Réglages et outils](notes-code-gameplay-outils.md)
- [Interface React](../4-technique/interface-react.md)
- [Boucle et temps](../3-architecture/boucle-et-temps.md)
