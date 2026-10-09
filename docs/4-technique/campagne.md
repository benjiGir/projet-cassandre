---
title: Campagne et équipement d’arrivée
tags: [campagne, session, sauvegarde, metro]
status: brouillon
updated: 2026-10-06
---

# Campagne et équipement d’arrivée

## Responsabilité et frontières

C1 raccorde la sortie d’Hyper Varan au métro. Le métro complet attend N5 ;
l’identifiant stable `metro` charge provisoirement `metro_trains.glb`.
Le menu le présente comme un pilote, sans promettre un parcours complet.

La campagne garde uniquement l’équipement de la dernière sortie du magasin.
Elle ne sauvegarde ni une position ni la progression à l’intérieur du métro.
La mort y ramène au début avec l’équipement exact de l’entrée.

## Fichiers

| Fichier | Responsabilité |
|---|---|
| `src/game/session/campaign/campaignTypes.ts` | Équipement et provenance de l’entrée |
| `src/game/session/campaign/campaignArrival.ts` | Copie figée, capture, restauration et profils |
| `src/game/session/campaign/campaignStorage.ts` | Décodage Schema et file de persistance |
| `src/game/session/campaign/campaignCatalog.ts` | Identifiants stables de campagne |
| `src/game/player/weapons/weaponInventory.ts` | Contrat de l’inventaire d’armes |
| `src/game/player/kioskOffer.ts` | Remplacement du perk déjà possédé par un consommable |
| `src/app/navigation/bootChoice.ts` | Menu, déblocage et choix de difficulté |
| `src/app/navigation/sessionFlow.ts` | Transition, chargement et reprise après mort |
| `src/game/devtools/campaignDebug.ts` | Relevé local pour l’auteur et la future télémétrie |
| `src/game/devtools/economy/economySim.ts` | Simulation des portefeuilles de deux niveaux |

## Place dans la boucle

`triggerLevelComplete` relève l’équipement dans le pas fixe, une seule fois.
Les panneaux de fin et le récapitulatif viennent après cette capture.
Le bouton Continuer consomme cet équipement déjà figé.

Le flux d’écran ajoute `NEXT_LEVEL`, autorisé depuis `levelComplete`.
Le chargement attend la fermeture de l’ancien niveau avant la construction
du suivant. Le verrou de transition absorbe les doubles clics.
Les entrées clavier en attente sont effacées aux transitions.

### Persistance

La capture enfile une copie figée en mémoire. `main.ts` vide la file après
`updateFx`, hors des arbres `runGameplaySync` et hors du pas fixe.
La transition et le retour au menu vident également cette file.

La clé locale est `cassandre.campaign.v1` ; son enveloppe porte `version: 1`.
Schema valide les armes, les perks sans doublons, les nombres finis,
les plafonds de munitions, les PV compatibles avec le gilet et la possession
de l’arme active. Un contenu invalide est ignoré avec un avertissement.

Une écriture refusée conserve la reprise dans l’onglet et affiche un message.
Elle ne garantit pas une reprise après fermeture ou rechargement.
Une nouvelle partie ne détruit pas la précédente sortie sauvegardée ;
seule une nouvelle sortie du magasin la remplace.

## Données et contrats

L’état d’arrivée contient les armes possédées, l’arme active, les deux
réserves de munitions, les perks, la cagnotte, les PV et la difficulté.
Il est figé récursivement : ni un achat ni un tir ne peut modifier la copie.

Les perks repassent par `grantPerk` sur une session neuve. Le gilet et le
premium reconstruisent les plafonds avant la restitution des PV et des
munitions. Aucune configuration globale n’est modifiée.

| Donnée | À l’entrée du métro |
|---|---|
| Difficulté | Celle de l’arrivée, sans écraser les réglages du menu |
| Cartes, portes, secrets, temps et score | Réinitialisés |
| Audience et abonnés | Nouveau direct : 12 spectateurs, 200 abonnés |
| Dons cumulés | Zéro ; la cagnotte d’arrivée n’est pas un don du nouveau direct |
| Records | Clé du niveau et de la difficulté, équipement indifférent |
| Effets temporaires de combat | Réinitialisés, notamment la pointe de vitesse |

### Entrées

| Provenance | Équipement |
|---|---|
| `new-game` | Magasin depuis zéro |
| `standalone` | Magasin depuis zéro ou métro avec l’équipement type |
| `transition` | Sortie de la partie magasin qu’on vient de finir |
| `continue` | Dernière sortie du magasin enregistrée dans ce navigateur |
| `dev` | Raccourci de niveau ; équipement type pour `?level=metro` |

Le métro seul est verrouillé jusqu’à une première sortie du magasin.
Il demande sa propre difficulté. Continuer garde la difficulté enregistrée.

L’équipement type possède les trois armes, 75 balles et 48 cartouches,
perche/boisson/aimant, 40 € et 100 PV. Le plafond du pompe, jusqu’ici absent,
est exposé dans `weaponConfig.shotgunMaxAmmo` : 96 cartouches. Ce réglage
permet de définir une demi-réserve et de plafonner les recharges aux bornes.
Il reste à éprouver dans le métro complet.

### Consommables

Boisson, VPN et gilet déjà possédés proposent jusqu’à 25 PV pour 10 €.
Perche, premium et aimant proposent 24 balles et 8 cartouches pour 12 €.
Seules les armes possédées sont rechargées. Les plafonds sont respectés.
Un achat sans aucun bénéfice est refusé sans débit ; l’invite affiche PLEIN.
Les prix et quantités sont dans `kioskConfig`, réglables séparément des perks.

### Relevé d’économie

`pnpm economy -- --campagne` enchaîne la simulation du magasin et un parcours
de métro hypothétique. `--toutes` croise variantes et difficultés ;
`--graines` règle le nombre de parties simulées. Le RNG vient du service
canonique, dans des flux isolés de ceux du jeu.

Les huit étapes hypothétiques totalisent 44 ennemis avant partage de
difficulté. Chaque borne détenue est supposée utile : ce modèle ne simule
ni les PV ni la dépense réelle de munitions. Le solde est donc une estimation
avec des achats de consommables, pas une preuve de survie ou d’équilibre.

Sur 200 graines, variante B, Habitué :

| Profil | Arrivée métro, médiane | Sortie métro, médiane | Consommables au métro |
|---|---|---|---|
| Pressé | 57 € / 2 perks | 9 € / 3 perks | 2 |
| Normal | 80 € / 3 perks | 20 € / 5 perks | 3 |
| Complétiste | 93 € / 3 perks | 31 € / 5 perks | 4 |

L’objectif de six perks pour un joueur moyen n’est pas atteint par ces
hypothèses. Il faut régler le parcours, les recettes et les passages devant
les bornes après N5, avec de vraies fins de magasin.

## Pièges

Ne pas prendre l’équipement courant après la mort pour reconstruire le
départ : `entryArrival` reste la référence. Ne pas restaurer les PV avant
les perks, au risque d’ajouter une guérison gratuite avec le gilet.
Ne pas donner les dons scénarisés du magasin dans le métro : son registre
porte `mysteryDonations: false` en attendant son propre scénario d’histoire.

La page d’auteur simule une sortie et remplace donc la reprise sauvegardée.
Ses profils sont des aides de revue, pas des boutons du menu de production.

## Tests

Compilation TypeScript et build de production contrôlés pendant C1.
La suite de tests n’a pas été lancée pour ce lot.
La revue en jeu a couvert la transition, la reprise après rechargement,
les deux profils, le métro seul et la mort après achat. Les états lus dans
la page d’auteur sont gardés dans le [relevé](../assets/campagne/releve.json).
Le playtest utilisateur et la télémétrie distante restent ouverts ; leur
état est distingué dans le [journal C1](../journal/campagne-2026-10.md).

## Comment vérifier

La [page d’auteur](../assets/campagne.html) propose les profils type, pauvre
et riche au magasin, une sortie simulée dans le pas fixe et une mort.
Elle peut aussi simuler une dépense de munitions et un dégât, puis utiliser
les vrais achats Perche et Boisson. Ces commandes passent par une file lue
dans le pas fixe, comme la sortie et la mort de démonstration.
Elle affiche l’équipement d’entrée, l’équipement courant, la sauvegarde
et les effets des perks. Les écrans du jeu restent les vrais écrans.

1. Sortir du magasin, passer ses panneaux, choisir Continuer.
2. Comparer les deux équipements ; seules les données propres au niveau changent.
3. Mourir, Rejouer et comparer avec l’entrée, après avoir acheté ou ramassé.
4. Recharger, revenir au menu, utiliser Continuer.
5. Choisir le métro seul ; constater l’équipement type et choisir sa difficulté.
6. Essayer une borne détenue, avec puis sans capacité libre.

La [décision de reprise](../decisions/0045-campagne-et-arrivee.md) expose le
choix architectural. La télémétrie distante reste à raccorder sur sa branche ;
la provenance et l’équipement initial existent localement dans la session.
