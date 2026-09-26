---
title: Diagnostiquer un bug de simulation
tags: [guide, recette]
status: brouillon
updated: 2026-09-26
---

# Diagnostiquer un bug de simulation

## Objectif

Capturer une séquence d'entrées qui reproduit un problème de gameplay et
distinguer une divergence de simulation d'un défaut de rendu ou de
contenu.

## Avant de commencer

- Lisez [Boucle et temps](../3-architecture/boucle-et-temps.md), [Rejeu
  et déterminisme](../4-technique/rejeu-et-determinisme.md) et
  [Debug](../4-technique/debug.md).
- Lancez le build en développement. F8 à F10 et `window.cassandre` ne
  sont pas des outils de production.
- Identifiez le niveau, la position de départ, l'équipement et la
  version du contenu.
- Écrivez les étapes et le résultat attendu avant d'enregistrer.
- Réduisez le nombre d'ennemis, d'objets et de systèmes impliqués autant
  que possible.

## Étapes

1. Reproduisez le défaut manuellement une fois et notez exactement les
   touches, la visée, le niveau et le moment.
2. Revenez à l'état initial ; évitez de capturer après un état qui
   dépend déjà d'une divergence.
3. Activez l'enregistrement F9 et exécutez seulement la séquence
   nécessaire.
4. Terminez l'enregistrement puis utilisez F10 pour rejouer les entrées
   au pas fixe.
5. Vérifiez si le défaut apparaît au même pas et au même endroit.
6. Pour les outils console, récupérez `cassandre.lastRecording()` après
   l'enregistrement.
7. Exportez une copie JSON avec `cassandre.exportRecording(rec)` si la
   séquence doit être conservée dans un dossier de preuve.
8. Importez la séquence avec `cassandre.importRecording(json)` avant de
   la rejouer dans une session compatible.
9. Lancez `cassandre.checkDeterminism(rec)` pour exécuter deux
   simulations isolées du contrôleur joueur.
10. Comparez position, vitesse, distance parcourue et grandeurs
    visuelles retournées.
11. Reproduisez le test avec un réglage ou un commit à la fois.
    Conservez les mêmes frames, pas fixe et état initial.
12. Si le résultat console est déterministe mais le rendu varie,
    inspectez interpolation, canvas, textures et taux d'affichage.
13. Si le défaut dépend du décor, vérifiez le collider avec l'API
    console, l'outil wireframe V ou les statistiques du niveau.
14. Si le défaut dépend d'un ennemi, consignez son état, sa position,
    son RNG et les tirs pris. Un rejeu d'input seul ne réinitialise pas
    l'IA.
15. Pour un bug de physique, réduisez la scène et les corps mobiles puis
    capturez la séquence minimale.
16. Pour un bug de chargement, utilisez le rapport du loader et la
    génération de hot reload plutôt que de traiter cela comme un rejeu
    gameplay.
17. Conservez le JSON, l'identifiant du commit, le navigateur, la
    version du niveau et les logs utiles avec la fiche de bug.
18. Ajoutez un test de non-régression au module propriétaire lorsque le
    défaut est réduit à un contrat déterministe.
19. Mettez à jour [Pièges connus](pieges-connus.md) si la cause ajoute
    un piège transversal.

## Vérifier

- La séquence démarre avec la position, vitesse et orientation initiales
  documentées.
- Le nombre de frames enregistré reste identique entre les répétitions.
- `checkDeterminism` renvoie un écart sous le seuil et affiche `OK` pour
  la simulation isolée.
- Le bug est reproductible sans autre input caché.
- Un test automatisé décrit la cause minimale s'il s'agit d'une règle de
  code.
- Si la preuve est visuelle, capturez le même état avec le même appareil
  et le même rendu.

## Pièges

- F9/F10 rejouent les inputs, pas un snapshot complet de tous les
  systèmes.
- Les ennemis, les props, l'horloge audio et l'état de session peuvent
  diverger indépendamment de la séquence joueur.
- Un changement de binding peut changer l'enregistrement qui est
  produit, même si la séquence ancienne garde ses frames.
- Le taux d'affichage influe sur la présentation, mais ne doit pas
  influer sur la simulation.
- Un succès de `checkDeterminism` ne prouve pas l'exactitude de la
  physique ; il prouve la répétabilité des deux simulations comparées.
- N'enregistrez pas une longue partie quand une reproduction de quelques
  secondes suffit.

## Exemple réel

Commit `ede868d`, « Harden quality gates and fixed-step simulation » :
il renforce les contrôles de simulation à pas fixe et les garde-fous de
qualité associés.
