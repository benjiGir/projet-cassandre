---
title: Les sponsors — perks, explosifs, nouveaux ennemis et difficulté
tags: [journal, gameplay, niveau, ennemis]
status: brouillon
updated: 2026-10-04
---

# Les sponsors — perks, explosifs, nouveaux ennemis et difficulté

## Période

3 et 4 octobre 2026. Lots B1 à B8 du plan de travail `PLAN_SUITE.md`, étape
v1.2 « Les sponsors ». S'y ajoute une passe de gore, demandée en cours de
route.

## Objectif

Que l'argent du direct serve à quelque chose, et que le combat cesse d'être un
seul type de rencontre répété. La cible du plan : une partie qui permet
d'acheter au moins deux perks, croise deux nouveaux ennemis et des explosifs,
et se joue dans trois difficultés.

## Livré et preuve

| Lot | Livré | Preuve |
|---|---|---|
| B1 | Bornes : un `use_*` qui vend un perk contre la cagnotte ([ADR 0040](../decisions/0040-bornes-et-perks.md)) | tests d'achat (solde, achat unique, borne épuisée) ; un achat relevé en jeu |
| B2 | Six perks, chacun avec sa marque et sa lecture de pub | un test par perk ; trois variantes de la boisson, à trancher |
| B3 | Bonbonnes de gaz, souffle et réaction en chaîne ([ADR 0041](../decisions/0041-explosifs.md)) | même état de départ, même chaîne ; quinze bonbonnes posées |
| B4 | Le Rampant, puis le Vigile et son bouclier | tests de configuration et d'arc du bouclier ; planches de sprites ; une rencontre de chacun dans la salle de test |
| B5 | Trois difficultés, écran de choix, records par difficulté ([ADR 0042](../decisions/0042-difficulte.md)) | en « Client » : Costard à 38 PV et 4 dégâts, Directeur à 225 PV, relevés en jeu |
| B6 | Trois rencontres : arène de la réserve, meute du parking, Vigile de l'escalier | arène jouée par téléportation : quatre portes verrouillées, deux vagues, réouverture |
| B7 | Relevé simulé du portefeuille, trois variantes, six bornes au lieu de quatre | `pnpm economy` ; cible atteinte par la variante B sur le simulateur |
| B8 | Documentation de la v1.2 : trois ADR, pages fonctionnelles, techniques et de référence | `pnpm verify -- --level --docs` conforme |
| — | Gore : taches persistantes, morceaux qui retombent, son d'un ennemi qui éclate | flaque et coulures relevées dans la salle de test et sur le parking |

`pnpm verify -- --level --docs` : typage sans erreur, 762 tests sur 762,
niveau conforme, audit propre.

Rien de tout cela n'a été joué par l'utilisateur.

## Rejeté et raison

- **Quatre bornes pour six perks.** Le premier jet laissait le VPN et l'aimant
  sans borne. Le relevé d'équilibrage l'a fait voir : deux bornes ont été
  ajoutées, aux caisses et au fond de l'allée centrale.
- **Le barème de dons d'origine.** Le donateur mystère payait 176 € sur
  environ 235, et la première borne était inabordable à l'arrivée (1 € en
  poche pour un perk à 5 €). Ses dons ont été ramenés à 100 €, avec 10 € dès
  le départ.
- **Une arène fermée par les portes existantes.** Le passage nord de la
  réserve n'avait pas de porte. L'utilisateur a choisi d'y poser un rideau
  plutôt que de renoncer au verrou.
- **Attendre le verdict sur le Rampant avant le Vigile.** Le plan le
  demandait ; l'utilisateur a préféré tenir le Rampant pour validé et faire
  le Vigile tout de suite.
- **Des taches de sang sans écriture de profondeur, dessinées dans la passe
  opaque ordinaire.** Le mur, dessiné après, les repeignait. Elles passent
  après le décor.
- **Les trois autres prises du son d'éclatement.** L'utilisateur a retenu la
  troisième : immédiate, la moins écrêtée.

## Leçons

- Un relevé chiffré, même sur des parties supposées, montre des défauts qu'une
  lecture du barème ne montre pas : c'est en regardant le solde devant chaque
  borne qu'on voit laquelle ne s'achète jamais.
- Un plan qui dit « sur six » et « trois ou quatre bornes » se contredit. La
  contradiction ne se voit qu'en mesurant.
- Une rencontre demande deux choses au script : attendre et fermer. Les deux
  tiennent dans la liste d'étapes existante, sans langage de script.
- Un ennemi de plus coûte une configuration quand il partage le gestionnaire
  du Costard. Le bouclier du Vigile tient en une fonction.
- Une trace durable ne se pose que sur ce qui ne bougera jamais. La même sonde
  sert aux impacts et au sang.
- Ce qui reste à faire tient en un mot : jouer. Les valeurs de combat, la
  durée d'une partie et le choix entre les trois variantes d'économie
  attendent une vraie partie.
