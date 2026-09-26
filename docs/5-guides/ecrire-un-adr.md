---
title: Écrire un ADR
tags: [guide, recette]
status: brouillon
updated: 2026-09-26
---

# Écrire un ADR

## Objectif

Consigner une décision d'architecture encore utile à comprendre plus
tard, ses alternatives et le signal qui ferait reconsidérer le choix.

## Avant de commencer

- Lisez la skill `.claude/skills/adr-format/SKILL.md` en entier.
- Vérifiez qu'il s'agit d'un choix structurant, contre-intuitif ou
  coûteux à inverser, pas d'une valeur de tuning.
- Cherchez les ADR existants dans `docs/decisions/README.md` et les
  décisions partielles dans les pages techniques.
- Identifiez les contraintes mesurées, les invariants et les
  alternatives sérieuses.
- Déterminez si la décision remplace ou complète un ADR existant. Les
  anciens ADR restent conservés.

## Étapes

1. Prenez le prochain numéro libre sur quatre chiffres dans
   `docs/decisions/`. Ne réutilisez jamais un numéro.
2. Créez un nom de fichier concis, sans espace, par exemple
   `0034-choix-structurant.md`.
3. Ajoutez quatre champs de frontmatter : titre, tags, status et
   updated.
4. Choisissez un statut initial qui reflète la décision : `propose` si
   elle attend un arbitrage, `accepte` si elle est actée.
5. Écrivez un titre de niveau 1 comprenant le numéro et la décision.
6. Ajoutez la section `Statut`. Si l'ADR remplace un choix antérieur,
   liez explicitement l'ADR remplacé.
7. Dans `Contexte`, décrivez l'état présent, les contraintes, les
   mesures et ce qui reste inconnu.
8. Dans `Décision`, formulez l'option retenue à l'affirmative, en une ou
   deux phrases.
9. Dans `Alternatives écartées`, comparez uniquement les options
   réalistes et la raison de leur rejet.
10. Dans `Conséquences`, indiquez ce qui devient plus simple, plus
    coûteux ou contraint par le choix.
11. Dans `Comment on saurait qu'on a eu tort`, écrivez un signal
    observable qui permettrait de rouvrir la décision.
12. Gardez l'ADR sur une page. Déplacez les détails du système vers une
    page technique et liez-la.
13. Ajoutez la décision à `docs/decisions/README.md`, regroupée dans son
    domaine.
14. Ajoutez des liens depuis la page technique, le guide ou la
    documentation d'invariant concerné.
15. Ne réécrivez pas l'ADR quand le contexte évolue. Ajoutez une
    nouvelle décision qui référence l'ancienne.
16. Si un ADR déjà accepté est remplacé, changez son statut en
    `remplace` et liez le successeur.
17. Conservez les preuves et les mesures qui justifient une contrainte
    chiffrée.

## Vérifier

- Le numéro et le nom sont uniques et le lien depuis l'index fonctionne.
- Les sections suivent l'ordre du format.
- Le statut et le verbe du texte concordent avec l'arbitrage réel.
- Une alternative évidente est traitée et chaque conséquence est assumée
  explicitement.
- La dernière section décrit une condition de reconsidération
  observable.
- La vérification des liens documentaires passe.
- Une décision acceptée est liée à ses références techniques et à tout
  ADR remplacé.

## Pièges

- Une valeur de tuning réversible se documente dans la référence, pas
  dans un ADR.
- Ne transformez pas l'ADR en journal d'essais ; le journal garde la
  chronologie.
- Ne présentez pas une intuition comme une mesure. Distinguez
  explicitement les inconnues.
- N'abandonnez pas la dernière section : elle permet au choix de rester
  falsifiable.
- Un ADR au statut `accepte` sans décision actée donne une fausse
  impression de contrat.
- L'index des décisions doit être mis à jour dans le même changement.
- Un nouveau numéro ne signifie pas que l'ADR précédent disparaît.

## Exemple réel

Commit `3d853b1`, « Toilettes à la Duke, récap de fin de partie, pause
et retours de playtest » : il ajoute et indexe l'ADR 0032 sur le système
de sanitaires utilisables.
