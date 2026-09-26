---
title: Ajouter un ennemi
tags: [guide, recette]
status: brouillon
updated: 2026-09-26
---

# Ajouter un ennemi

## Objectif

Ajouter un type d'ennemi sans dupliquer la machine à états, le chemin de
simulation ou le contrat des collisions existants.

## Avant de commencer

- Lisez [Ennemis et IA](../4-technique/ennemis-et-ia.md),
  [Pathfinding](../4-technique/pathfinding.md) et [les valeurs de
  référence](../6-reference/valeurs-ennemis.md).
- Lisez le skill `.claude/skills/enemy-state-machine/SKILL.md` avant de
  modifier la machine partagée.
- Vérifiez si le nouveau personnage est un nouveau type ou une variante
  des paramètres d'un ennemi existant.
- Les entités sont dans `src/game/entities/`. L'invariant interdit l'ECS
  avant le seuil du projet.
- Les captures et les essais de combat nécessitent une preuve visuelle
  et souvent un playtest humain.

## Étapes

1. Définissez les différences propres au type : PV, gabarit, vitesse,
   portée, attaque, reveal ou récompense.
2. Ajoutez un fichier de configuration dédié à `src/game/entities/` si
   ses paramètres diffèrent réellement.
3. Gardez les nombres de comportement dans cette configuration, pas
   dispersés dans les branches de l'IA.
4. Implémentez une classe qui satisfait `Entity` dans
   `src/game/entities/entity.ts`.
5. Réutilisez les fonctions communes de
   `src/game/entities/enemyMachine.ts` pour corps, collider, acteur,
   RNG, machine et interpolation.
6. Gardez la machine partagée aussi générique que les états
   véritablement communs. Les propriétés de boss restent dans la classe
   du boss.
7. Déclarez un manager pour la collection si le type a un cycle de
   spawn, update, mort ou retrait distinct.
8. Raccordez le manager aux quatre temps du cycle : snapshot précédent,
   mise à jour fixe, synchronisation physique et interpolation.
9. Respectez les groupes Rapier existants. Les rayons du joueur et des
   ennemis ne doivent pas commencer à toucher d'autres groupes par
   accident.
10. Donnez une graine déterministe propre à chaque entité. Aucun accès à
    `Math.random()` ni au service `Random` standard.
11. Si l'ennemi suit le graphe de navigation, utilisez les mêmes
    requêtes `WORLD` que le système existant.
12. Une attaque doit avertir le joueur avant d'appliquer des dégâts.
    Respectez le seuil minimal de télégraphie du skill.
13. Envoyez dégâts et effets via les événements de gameplay et de
    présentation déjà présents ; ne mettez pas le son ou Three.js dans
    la machine d'états.
14. Ajoutez une animation sprite ou un atlas et raccordez ses états de
    rendu dans le système qui les affiche.
15. Ajoutez un point de spawn reconnu dans `src/game/level/loader.ts` et
    dans le contrat de nommage glTF.
16. Mettez à jour `tools/blender/validate_level.py` si le nouveau nom ou
    les nouvelles propriétés demandent une validation.
17. Écrivez des tests pour la transition, l'attaque, la perte de
    contact, les dégâts, la mort, le spawn et le retrait.
18. Mettez à jour les docs technique, les valeurs de référence et le
    guide [Où agir](ou-agir.md).

## Vérifier

- Exécutez les tests de la machine d'états et du manager.
- Vérifiez la séquence d'attaque à la vitesse réelle et contrôlez le
  délai entre télégraphie et dégâts.
- Vérifiez les rayons de vision et d'attaque avec un décor, un prop
  mobile, une vitre et le joueur.
- Faites apparaître plusieurs instances et confirmez que leurs graines
  produisent un résultat stable.
- Vérifiez reset, nouvel essai et changement de niveau : aucun ennemi ou
  collider ne doit survivre à la session précédente.
- Inspectez un rendu à distance réelle, puis demandez un playtest pour
  la lisibilité et le niveau de menace.

## Pièges

- Une nouvelle entité ne doit pas gérer elle-même le rendu, l'audio ou
  le store.
- Un changement de la machine partagée peut modifier le Costard et le
  Directeur ; ajoutez des tests de non-régression pour les deux.
- Un collider de `PROP` n'est pas un collider `WORLD` pour la navigation
  ni la ligne de vue.
- L'animation de mort ne doit pas retarder la libération logique ni
  bloquer le joueur.
- Ne copiez pas un nouveau contrôleur Rapier ; la fabrique KCC et la
  machine partagées sont le contrat.
- Un spawn visuellement libre peut toucher un collider ou un prop.
  Faites vérifier le point de départ dans le niveau.

## Exemple réel

Commit `df6a30c`, « Directeur (boss Zone E) : entité + câblage main.ts »
ajoute l'entité, sa configuration et son manager. Le commit `5819f7c`
partage ensuite la machine d'ennemi entre le Costard et le Directeur.
