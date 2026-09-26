---
title: Régler la sensation
tags: [guide, recette]
status: brouillon
updated: 2026-09-26
---

# Régler la sensation

## Objectif

Comparer des variantes de déplacement, de tir ou de feedback dans des
conditions reproductibles, puis transmettre les mesures et les preuves à
un humain pour arbitrage.

## Avant de commencer

- Lisez [Joueur](../4-technique/joueur.md),
  [Armes](../4-technique/armes.md) ou [Ennemis et
  IA](../4-technique/ennemis-et-ia.md) selon le paramètre.
- Consultez la [référence de
  déplacement](../6-reference/valeurs-deplacement.md) et la [référence
  des ennemis](../6-reference/valeurs-ennemis.md).
- Ouvrez le jeu en mode dev. L'API `window.cassandre` n'existe pas dans
  le build de production.
- Utilisez une scène et une position de départ fixes. Notez l'état
  initial avant de changer les réglages.
- Lisez le skill `.claude/skills/game-feel-tuning/SKILL.md` avant une
  tâche de tuning qui suit ce protocole.

## Étapes

1. Choisissez un seul axe de sensation : mouvement, vue, recul, impact,
   réticule, hitmarker, flash ou knockback.
2. Repérez son objet de configuration source, par exemple `moveConfig`,
   `weaponConfig`, `suitConfig` ou `directorConfig`.
3. Notez les valeurs de départ, le build, la scène et les conditions de
   test.
4. Évitez de changer simultanément plusieurs axes. Une comparaison n'est
   utile que si la variable testée est isolée.
5. Pour le bob/FOV/réception, appliquez
   `cassandre.applyFeelVariant("A")`, `"B"` ou `"C"`.
6. Pour le recul, choisissez la variante appropriée exposée dans
   `cassandre.recoilVariants`.
7. Pour le feedback d'impact, examinez les variantes distinctes dans
   `cassandre.impactVariants`.
8. Pour le Costard, utilisez `cassandre.applyKnockbackVariant("B")` ou
   `cassandre.applyFlashVariant("B")`.
9. Si vous réglez manuellement un champ de mouvement lu par Rapier,
   appelez la méthode de réapplication du contrôleur après la mutation.
10. N'utilisez pas `applyFeelVariant` pour modifier les valeurs de
    déplacement : cette fonction ne change que les paramètres visuels.
11. Enregistrez une séquence de locomotion ou de tir avec F9. Laissez-la
    se terminer dans un état connu.
12. Rejouez la séquence par F10 sous chaque variante. Elle rejoue les
    entrées au pas fixe.
13. Utilisez `cassandre.simulateRecording(rec, config)` pour les
    comparaisons hors rendu du contrôleur joueur.
14. Utilisez `cassandre.checkDeterminism(rec)` pour vérifier que deux
    simulations du même enregistrement coïncident.
15. Répétez la mesure sur plusieurs scènes ou distances si l'axe dépend
    du décor, des ennemis ou du rendu.
16. Relevez le comportement, les valeurs, les captures et les mesures
    qui distinguent les variantes.
17. Pour une décision de visée, incluez aussi le taux de
    rafraîchissement et les images du réticule / viewmodel.
18. Remettez les champs configurables à leur valeur initiale après
    l'essai ; les mutations console restent dans la session en cours.
19. Présentez les résultats sans choisir seul une valeur que le playtest
    humain doit départager.
20. Mettez à jour la référence si une valeur adoptée par l'utilisateur
    change.

## Vérifier

- Vérifiez que les entrées F9/F10 sont identiques entre les variantes.
- Pour une simulation isolée, `checkDeterminism` doit signaler une
  différence inférieure au seuil documenté dans le harnais.
- Comparez la même métrique et la même capture pour toutes les
  variantes.
- Contrôlez les invariants : pas fixe, visée non interpolée, aucune
  animation ne bloque le joueur, RNG déterministe.
- Pour le recul, vérifiez la caméra, le viewmodel et le contrôle joueur
  ; un seul rendu isolé ne suffit pas.
- Demandez un verdict humain quand le critère est la lisibilité ou le
  plaisir.

## Pièges

- Un rejeu F9/F10 ne restaure pas l'état des ennemis ni tout le monde ;
  isolez-les pour un test comparable.
- Le rejeu conserve l'état de RNG selon la portée définie par le système
  ; n'insérez pas d'appel aléatoire parasite.
- Le contrôleur ne voit pas chaque mutation config immédiatement.
  Réappliquez les réglages Rapier prévus.
- N'abaissez pas la télégraphie d'attaque sous son seuil prescrit pour «
  rendre l'ennemi plus dur ».
- Ne confondez pas un nombre console ou un écran statique avec le
  ressenti du jeu.
- Ne changez pas la résolution interne pour masquer du bruit de texture
  réduite ; utilisez le réglage de filtrage.

## Exemple réel

Commit `d8dbf40`, « Armes et feel de tir (Phase 2) + wireframe debug +
fix stutter déplacement » : il ajoute des réglages centralisés pour le
tir et le déplacement, destinés à être mesurés puis ajustés.
