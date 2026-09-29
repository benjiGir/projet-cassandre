---
title: Analyse de l’agencement du niveau v2
tags: [journal, niveau, agencement, analyse]
status: brouillon
updated: 2026-09-29
---

# Analyse de l’agencement du niveau v2

## Période

Inspection du 29 septembre 2026, après les corrections des véhicules, des
caddies extérieurs et des distributeurs de la cafétéria.

## Objectif

Évaluer le placement, la circulation et la lisibilité du niveau existant.
L’inspection couvre les pièces du plan, trois couloirs de service et huit vues
à hauteur du joueur. Les rendus utilisent une lumière de contrôle et des
plafonds masqués : ils servent à juger l’agencement. Le rythme des combats et
la lisibilité sous l’éclairage du jeu restent à confirmer en jouant.

## Livré et preuve

**Avis général : la structure tient bien ; la priorité est de clarifier les
placements et les repères, puis de varier quelques compositions.**

### Ce qui fonctionne

- **Circulation principale.** L’entrée mène aux caisses puis au hub. Les
  rayons et l’électroménager se distinguent de part et d’autre. Le raccourci
  relie les coulisses à la surface de vente.
- **Rayons et caisses.** Les deux transversales de 4 m entre les tronçons de
  gondoles offrent des échappées. Les passages de 2,5 m entre les caisses
  permettent plusieurs franchissements. Conserver ces dégagements.
- **Réserve et sous-sol.** Les racks, le quai et les piliers produisent des
  volumes différents. Les véhicules occupent les places plutôt que les
  allées ; la rampe centrale de la réserve reste lisible.
- **Pièces spécialisées.** Le fournil, les vestiaires, le PC sécurité et le SAV
  ont des meubles liés à leur fonction. Leurs compositions sont plus
  convaincantes que les petits objets dispersés dans les grandes salles.

### Préconisations par priorité

| Priorité | Zone et constat | Proposition |
|---|---|---|
| 1 | Hub et sortie du sous-sol : la répétition des travées peut brouiller la destination. Les panneaux du hub annoncent surtout des rayons. | Ajouter des indications explicites « Réserve », « Bureaux » et « Retour magasin », visibles avant le choix de direction. Marquer la rampe de sortie du parking avec un signe distinctif. |
| 1 | Parking extérieur, caisses, électroménager : cartons et petits objets isolés occupent ponctuellement les dégagements. | Regrouper le réassort près des murs ou des meubles, en deux ou trois ensembles cohérents. Garder libres les approches des portes et les passages entre caisses. Préserver les obstacles utiles comme couvert. |
| 2 | Compacteur et planque du vigile : trois volumes de balles de carton dans le premier ; presque uniquement un ramassage dans la seconde. Le générateur les indique encore non habillés. | Donner une fonction lisible au compacteur (machine, commandes, balles texturées). Composer un petit coin personnel dans la planque : siège, casier, télévision et butin regroupé. |
| 2 | Couloir coupe-feu : 56 m de perspective très rectiligne et peu d’événements visuels. | Créer deux repères distincts aux accès du SAV et des locaux techniques : signalétique, matériel de maintenance regroupé, changement local de traitement du mur. Conserver un axe central dégagé. |
| 2 | Galerie, cafétéria et rayons : kiosques, tables et gondoles répètent des compositions régulières. | Garder la trame ; distinguer quelques ensembles par leur usage : table abandonnée, zone de réassort, tête de gondole signature. Varier surtout les accessoires et les repères, sans décaler systématiquement les meubles. |
| 3 | Bureau du Directeur : grand dégagement autour d’un bureau et d’un canapé, peu de volumes intermédiaires. | Essayer deux couverts bas sur les côtés. Les conserver seulement s’ils améliorent le combat contre le boss. |

### Contrôle géométrique

L’audit du fichier `assets_src/blender/niveau_v2.blend` examine 841 proxies,
avec un sondage des sols tous les 0,5 m. Il ne signale aucun trou de sol, bord
ouvert sur le vide, chevauchement au-delà du seuil de l’outil, objet flottant ou
point d’apparition encombré. Ce résultat ne mesure pas le confort en combat.

Vues consultées : [espaces publics](../assets/agencement-2026-09-29/01-public.jpg),
[coulisses](../assets/agencement-2026-09-29/02-coulisses.jpg),
[annexes](../assets/agencement-2026-09-29/03-annexes.jpg) et
[vues au sol](../assets/agencement-2026-09-29/04-au-sol.jpg).

## Rejeté et raison

Remplir uniformément les zones vides n’est pas retenu : elles donnent de
l’espace pour esquiver et rendent les passages visibles. Une recomposition
des meubles existants et quelques repères ciblés suffisent à une première passe.

## Leçons

Commencer par la signalétique et le rangement des objets isolés. Faire ensuite
une traversée en jeu, avec combats, avant d’ajouter des couverts ou de modifier
la géométrie. Le générateur de référence est
`tools/level_v2/build_niveau.py` ; le contrôle utilisé est
`tools/level_v2/audit_niveau.py`.
