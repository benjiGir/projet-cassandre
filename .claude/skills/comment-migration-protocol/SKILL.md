---
name: comment-migration-protocol
description: Protocole de migration des commentaires vers /docs — jamais supprimer toujours déplacer, découpage par dossier, ancres, ordre des opérations, critères de relecture. Charger pour toute passe de nettoyage de commentaires.
---

# Protocole de migration

## La règle

**Jamais supprimer, toujours déplacer.**

Un commentaire retiré part quelque part dans `/docs`, avec une ancre laissée à
sa place.

Deux exceptions, et deux seulement :

1. **Code commenté** — git conserve l'historique
2. **Répétition du code** — `// incrémente i` sur `i++`

Le mode d'échec à craindre n'est pas un fichier verbeux. C'est un avertissement
load-bearing supprimé parce qu'il ressemblait à du bruit — et découvert six
semaines plus tard, en reproduisant le bug qu'il prévenait.

## Découpage

**Un dossier par passe.** `src/core/`, puis `src/render/`, puis `src/game/`.

Un diff qui touche 40 fichiers ne se relit pas sérieusement, et c'est
exactement là que les avertissements disparaissent sans qu'on le voie.

## Ordre des opérations

```
1. Audit
     python3 tools/docs/audit_comments.py src/core/ --json audit.json

2. Lire le rapport, classer chaque commentaire signalé
     → reste / supprimé / migré vers <fichier>

3. ÉCRIRE d'abord dans /docs
     Le document existe AVANT que le commentaire disparaisse.

4. Puis retirer du code et poser l'ancre
     // see: docs/systems/loop.md#hitstop

5. Valider le graphe
     python3 tools/docs/check_docs_links.py docs/ --src src/

6. Build + tests

7. Relire le diff intégralement
```

L'ordre de 3 et 4 n'est pas cosmétique : si la passe est interrompue entre les
deux, on préfère un doublon à une perte.

## Le diff doit être pur

Une passe de migration ne touche **que** les commentaires et les ancres. Pas de
renommage, pas d'extraction de fonction, pas de reformatage.

Un diff mixte est irrelisible, et c'est là que se glissent les régressions. Si
le nettoyage révèle un problème de conception, le noter et le traiter dans une
passe séparée.

## Critères de relecture

Avant commit, sur chaque commentaire retiré :

- [ ] A-t-il une destination dans `/docs` ?
- [ ] Le document de destination existe-t-il déjà ?
- [ ] L'ancre pointe-t-elle vers un titre réel ?
- [ ] Est-ce que je comprends encore le *pourquoi* en lisant seulement le code
      et l'ancre ?
- [ ] S'il s'agissait d'un piège, est-il **plus** visible qu'avant, pas moins ?

Le dernier point mérite une exception explicite : **un avertissement critique
peut légitimement rester dans le code en entier**, même long. Un piège Rapier
qui coûte trois heures de diagnostic vaut ses six lignes sur place.

## Cas particulier : le pourquoi introuvable

Si un commentaire dit « on fait X » sans dire pourquoi, et que ni le code, ni
git blame, ni les ADR existants ne donnent la raison :

- Créer un ADR avec `status: raison inconnue`
- Y consigner le comportement observé et ce qui casse si on le change
- **Ne pas fabriquer une justification plausible**

Une raison inventée est pire qu'une raison absente : elle sera crue.

## Mesure

`audit_comments.py` donne le ratio avant et après. Le rapporter dans le commit.

Mais le ratio n'est pas la cible. Un fichier passé de 40 % à 5 % en supprimant
trois avertissements de piège est une régression, quel que soit le chiffre.
