---
title: Catalogue de répliques du niveau v2
tags: [audio, voix, dialogues, niveau]
status: brouillon
updated: 2026-10-01
---

# Catalogue de répliques du niveau v2

## Utilisation pour les enregistrements

Ce catalogue propose **trois alternatives par situation**, pour le niveau
`niveau_v2`. Vous pouvez choisir une seule version ou enregistrer les trois
pour varier les réactions. A, B et C ne se disent pas à la suite.

Il contient **199 situations et 597 propositions** : 183 situations pour le
héros et 16 pour les voix secondaires facultatives. Les prises courtes
d'effort et les interactions futures sont rangées dans des sections séparées.

Le héros est un vidéaste complotiste à deux cents abonnés, persuadé d'avoir
raison. Sa voix est adulte, française, mordante et légèrement trop sûre
d'elle. Il découvre un vrai complot reptilien dans un hypermarché. L'humour
vient du contraste entre cette révélation et le quotidien du magasin :
promotions, fidélité, ressources humaines, retours et heures supplémentaires.

### Consignes de lecture

- Lisez uniquement le texte des colonnes A, B ou C. Les identifiants,
  situations et statuts ne font pas partie de la réplique.
- Parlez naturellement, avec une articulation nette. Gardez le même timbre
  sur toute la série. Évitez de crier les blagues ordinaires.
- Combat : débit court et incisif. Exploration : sarcasme plus posé.
  Blessure : souffle tendu. Révélation du Directeur : satisfaction avant la
  peur. Fin du niveau : soulagement et fierté.
- Enregistrez une réplique par fichier, sans musique, ambiance, réverbération
  ni bruitage. Gardez une petite marge de silence avant et après.
- Noms proposés : `heros_<identifiant>_a.wav`, puis `_b.wav` et `_c.wav`.
  Exemple : `heros_arme_pompe_a.wav`. Pour les voix secondaires, remplacez
  `heros` par `costard`, `directeur` ou `annonce`.
- Les versions A, B et C sont des choix éditoriaux de même niveau ; aucune
  n'est désignée comme version définitive.

### Statuts des situations

| Code | Signification |
|---|---|
| T | Une réaction textuelle du héros est déjà déclenchée pour cette famille de situations. Les propositions peuvent remplacer ce texte. |
| E | L'action ou l'événement existe dans le gameplay. La réaction vocale, et parfois sa condition précise, restent à brancher. |
| R | Le lieu ou le repère existe. Sa première visite ou son observation nécessite un déclencheur de dialogue. |
| P | Interaction ou condition proposée pour la suite ; ne pas la présenter comme déjà jouable. |

**Ce fichier est un script d'enregistrement proposé. Il n'ajoute aucune voix
au jeu.** Le canal actuel du héros affiche du texte et impose un délai global
de quinze secondes. Les visites, observations et variantes ne sont pas toutes
détectées aujourd'hui.

### Rythme conseillé lors du futur branchement

La présence d'une réplique dans ce catalogue ne signifie pas qu'elle doit
jouer à chaque occurrence. Première visite : une fois par partie. Carte,
secret, révélation et victoire : moments prioritaires. Tir, changement
d'arme, ramassage commun et mort d'un Costard : réactions occasionnelles.
Gardez les sons d'attaque et les signaux utiles audibles.

Un événement précis remplace sa réaction générique : un kill au pompe ne
déclenche pas aussi le kill générique ; une découverte de secret ne déclenche
pas aussi le commentaire de la pièce. La mort du Directeur et l'obtention
de la Platine se traitent en deux temps, ou avec une seule des deux réactions.
Une réplique d'exploration devenue hors contexte pendant un combat est abandonnée.

## 1. Départ, lieux et progression — voix du héros

Première arrivée dans le lieu, après un court temps d'observation. Les petits
passages n'ont pas besoin de parler si la réplique de la pièce vient de jouer.

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| depart | E | Début de la partie, dehors et désarmé | Ce soir, on vérifie les rumeurs. | Un magasin fermé. Une enquête ouverte. | Deux cents abonnés. Une très mauvaise idée. |
| parking | R | Première exploration du parking extérieur | Ils ont laissé les voitures. Où sont les clients ? | Parking gratuit. Sortie probablement payante. | Je filme les plaques, au cas où. |
| portes_auto | R | Passage des portes automatiques vers la galerie | Au moins, les portes sont accueillantes. | Entrez librement. Ressortez si vous pouvez. | Bon. Le magasin vient de m'inviter. |
| galerie | R | Découverte de la galerie marchande | Tout est fermé. Sauf les ennuis. | Galerie marchande, ambiance fin du monde. | Les rideaux sont baissés. Pas ma caméra. |
| passage_cafe | R | Détour vers la cafétéria | Un détour avant le carnage. | Le menu du soir sent l'embuscade. | Une enquête, ça creuse. |
| cafeteria | R | Première visite de la cafétéria | Je vais éviter le plat du jour. | Self-service. Service après-vie non compris. | Même les chaises ont l'air abandonnées. |
| toilettes | R | Entrée dans les toilettes | Enfin une pièce où je comprends le complot. | Les sanitaires. Le vrai siège du pouvoir. | Je coupe pas la caméra. Juste le cadrage. |
| entree_magasin | R | Passage de la galerie aux caisses | Derrière les caisses, ça devient sérieux. | Les promotions commencent à tirer. | On entre dans le vif du sujet. |
| caisses | R | Découverte de la ligne de caisses | Je crois que les caissiers sont armés. | Passage en caisse. Passage à tabac. | Voilà pourquoi il n'y a plus de clients. |
| hub | R | Arrivée dans l'allée centrale | Tous les rayons. Aucun choix rassurant. | À gauche les courses, à droite les preuves. | Je vais commencer par ce qui clignote. |
| entree_rayons | R | Passage dans la tête d'allée ouest | Voyons ce qu'ils ont en stock. | Rayon frais. Accueil très froid. | Ça sent l'embuscade entre les gondoles. |
| rayons | R | Première exploration des gondoles | Ils rangent même leurs pièges par catégorie. | Les employés mordent plus que les prix. | Restez avec moi. Ces allées cachent quelque chose. |
| surgeles | R | Découverte de la zone des surgelés | Certains secrets se conservent au froid. | Chaîne du froid, chaîne du complot. | Je préfère les lézards loin de mon dîner. |
| entree_electro | R | Passage dans la tête d'allée est | Ça clignote beaucoup trop pour être innocent. | Électroménager. Gros appareils, petites garanties. | Je vais regarder leurs programmes. |
| electro | R | Découverte du mur d'écrans | Ils diffusent tous le même mensonge. | Une seule chaîne. Beaucoup de cerveaux disponibles. | Cette fois, la télé regarde les clients. |
| sas_reserve | R | Arrivée au sas de la carte Argent | Voilà ce qu'ils cachent derrière la fidélité. | Accès réservé aux clients bien dressés. | Une carte pour voir l'envers du décor. |
| reserve | R | Première arrivée dans la réserve | Le vrai magasin commence derrière le magasin. | Ils ont du stock pour toute une invasion. | Regardez la taille de cette réserve. |
| mezzanine | R | Accès à la mezzanine de la réserve | Je préfère voir venir les ennuis. | Vue premium, sans supplément. | D'ici, leurs cachettes deviennent moins discrètes. |
| quai | R | Découverte du quai et du camion à hayon | Qu'est-ce qu'ils livrent après la fermeture ? | Livraison express de mauvaises nouvelles. | Ce chargement mérite une vidéo entière. |
| rampe_quai | R | Descente vers le parking souterrain | Plus on descend, moins ça sent les courses. | Le sous-sol n'est pas dans le catalogue. | Si le signal coupe, continuez d'enregistrer. |
| souterrain | R | Première arrivée au parking souterrain | Trop de piliers. Pas assez de lumière. | Stationnement longue durée. Très longue durée. | Je vais longer les murs. Vous filmez devant. |
| rampe_sortie | R | Remontée du souterrain vers le personnel | Un peu de hauteur ne fera pas de mal. | Sortie du parking. Entrée dans les problèmes. | On remonte. L'enquête aussi. |
| couloir_personnel | R | Première visite du couloir du personnel | Accès interdit. Donc accès intéressant. | Le personnel a droit à ses propres pièges. | Voilà la partie qu'on ne montre jamais aux clients. |
| couloir_service | R | Arrivée dans le couloir de service | Les coulisses sont plus grandes que la scène. | Ici, même les néons travaillent de nuit. | J'entends quelque chose derrière ces portes. |
| couloir_coupe_feu | R | Arrivée dans le couloir coupe-feu | Long couloir. Mauvaise perspective. | Le SAV est au fond des ennuis. | Je compte les portes. Pas les pas. |
| vestiaires | R | Entrée dans les vestiaires | Voilà où ils rangent leur peau de rechange. | Uniforme obligatoire. Humanité facultative. | Les casiers racontent plus que les employés. |
| fournil | R | Entrée dans le fournil | Pour une fois, ça sent presque bon. | Ils font lever la pâte et les soupçons. | Je surveille le four. Et ce qu'il contient. |
| gaine | R | Première entrée dans la gaine VMC | La visite guidée passe par les conduits. | Climatisation incluse. Dignité en option. | Voilà le genre de passage que je cherchais. |
| pc_securite | R | Entrée dans le PC sécurité des coulisses | Ils surveillent tout. Sauf leurs propres portes. | La sécurité protège surtout les secrets. | On va voir leurs images pour changer. |
| boucherie | R | Entrée dans le labo boucherie et marée | Je vais pas demander l'origine de la viande. | Traçabilité douteuse. Découpe impeccable. | Tout ce blanc ne rend rien plus propre. |
| chambre_froide | R | Entrée dans la chambre froide | Même leurs secrets ont froid. | Conservation longue durée. Espérance de vie courte. | Gardez la porte ouverte, juste au cas où. |
| sav | R | Entrée dans l'atelier SAV | Voilà où les appareils viennent mourir. | Service après-vente. Avant-enterrement. | Ils réparent les télés qui diffusent leurs mensonges. |
| compacteur | R | Entrée dans le local compacteur | Ils font disparaître les cartons. Et le reste ? | Tri sélectif. Témoins compris. | Cette presse a une sale réputation. |
| escalier | R | Montée vers les bureaux après le verrou Or | Les décisions viennent toujours d'en haut. | Un étage de plus dans la hiérarchie. | On va parler à la direction. |
| bureaux | R | Arrivée dans l'étage des bureaux | Le complot a aussi ses horaires de bureau. | Moquette épaisse. Dossiers encore plus épais. | Le patron doit être au bout. |
| bureau_securite | R | Visite du bureau sécurité à l'étage | Un autre écran pour éviter de regarder dehors. | La surveillance a son bureau particulier. | Ils aiment vraiment me regarder travailler. |
| comptabilite | R | Visite des deux postes de comptabilité | Les comptes doivent être aussi faux que leurs visages. | Ils amortissent sûrement les victimes. | Je filmerais bien le bilan. |
| ressources_humaines | R | Visite du bureau RH | Ressources humaines. J'ai comme un doute. | Recrutement ouvert aux sang-froid. | Je vais vérifier leur définition d'humain. |
| salle_pause | R | Entrée dans la salle de pause de l'étage | Même les monstres prennent leur pause. | Pause obligatoire. Café suspect. | Personne ? Je prends trente secondes. |
| direction | R | Entrée dans le bureau du Directeur, avant sa réaction de boss | Beau bureau. Sale affaire. | Le responsable des réclamations est enfin là. | Toute l'enquête mène à ce fauteuil. |

## 2. Armes, munitions, soins et nourriture — voix du héros

Une réaction de ramassage joue après un gain réel. Un objet laissé au sol à
PV ou munitions pleins ne déclenche pas la réplique de réussite.

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| arme_pied_biche | E | Premier ramassage du pied-de-biche | Ça ouvre les portes. Et les discussions. | Mon nouvel outil de négociation. | Voilà de quoi soulever quelques questions. |
| arme_pistolet | E | Premier ramassage du pistolet | Là, ils vont m'écouter. | Une réponse courte aux longues procédures. | L'enquête vient de changer de ton. |
| arme_pompe | E | Premier ramassage du fusil à pompe | Ça, c'est pour les gros dossiers. | Service client. Réponse groupée. | Je crois qu'on va faire de l'audience. |
| arme_double | E | Arme déjà possédée, sans gain possible | J'ai déjà ce qu'il faut. | Pas besoin du modèle d'exposition. | Je la laisse pour les retardataires. |
| pistolet_double | E | Pistolet supplémentaire donnant des munitions | Je prends surtout ce qu'il y a dedans. | Les accessoires sont compris. | Encore quelques arguments en poche. |
| munitions_24 | E | Ramassage d'une boîte de vingt-quatre munitions | De quoi poursuivre la conversation. | Réapprovisionnement du service réclamations. | L'enquête peut continuer. |
| munitions_36 | E | Ramassage d'une boîte de trente-six munitions | Voilà une réserve sérieuse. | Format familial. Usage personnel. | Ils avaient prévu de résister longtemps. |
| munitions_pleines | E | Tentative de ramassage au plafond de munitions | Mes poches sont pleines. | Stock maximum. Revenez après utilisation. | Je garde ça pour le prochain passage. |
| soin_25 | E | Petit ramassage de soin | Ça devrait tenir encore un peu. | Une réparation rapide, sans garantie. | Juste ce qu'il me fallait. |
| soin_50 | E | Gros ramassage de soin | Là, je respire mieux. | Remise en état avant la prochaine réclamation. | Ils vont devoir recommencer. |
| soin_plein | E | Soin proposé alors que les PV sont pleins | Ça va. Pour l'instant. | Je garde la garantie pour plus tard. | Quelqu'un d'autre en aura peut-être besoin. |
| manger_donut | E | Ramassage d'un donut donnant du soin | Le vrai carburant de la sécurité. | Une prime de sucre. | Je comprends mieux les pauses du vigile. |
| manger_sandwich | E | Ramassage d'un sandwich donnant du soin | Je préfère pas lire les ingrédients. | Menu enquêteur. À emporter. | Une bouchée entre deux révélations. |
| manger_jambon | E | Ramassage d'un plateau de jambon | Je pose aucune question sur la provenance. | Le déjeuner passe en frais d'enquête. | Bon. Ça ressemble à du jambon. |
| manger_poulet | E | Ramassage du poulet rôti | Lui, au moins, n'a plus d'écailles. | Le plat du jour mérite une seconde chance. | Je vais reprendre des forces au passage. |
| manger_pizza | E | Ramassage de la pizza de la planque | Le vigile avait bon goût. | Butin chaud. Addition froide. | Celle-là, je la récupère pour l'enquête. |
| nourriture_pleine | E | Nourriture laissée au sol à PV pleins | Je garde une place pour plus tard. | Le buffet peut attendre. | Pas faim. Mauvais signe. |
| nourriture_lachee | E | Aliment ramassé après destruction d'un prop | Pas très propre. Très pratique. | Distribution gratuite après réclamation. | La méthode est douteuse. Le résultat me va. |
| manger_canette | P | Boire une canette libérée par un distributeur | Un peu de sucre pour tenir debout. | Frais de dossier offerts. | Ça pétille plus que leur programme télé. |

Les canettes sont déclarées dans certains distributeurs du GLB, mais le
registre de nourriture courant reconnaît seulement donut, sandwich, jambon,
poulet et pizza. La ligne `manger_canette` est donc réservée à la suite.

## 3. Cartes, portes et raccourcis — voix du héros

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| carte_argent | E | Obtention de la carte Argent | L'Argent ouvre la réserve. Intéressant. | Client fidèle. Intrus récompensé. | Première carte. Premier verrou en moins. |
| carte_or | E | Obtention de la carte Or | L'Or. Ils aiment vraiment leurs privilèges. | Je monte dans leur programme de fidélité. | Voilà mon invitation pour les bureaux. |
| carte_platine | E | Carte Platine accordée après la mort du Directeur | La Platine. Mon billet de sortie. | Le patron vient de céder ses avantages. | Je prends la carte et je m'arrache. |
| manque_argent | E | Refus au sas de la réserve sans carte Argent | Il me faut leur carte Argent. | Même l'arrière-boutique a son abonnement. | Je vais fouiller les rayons. |
| manque_or | E | Refus à l'accès des bureaux sans carte Or | Pas d'Or, pas de bureau. | La direction ne reçoit que les clients premium. | Une carte Or. Je regarderais côté électroménager. |
| manque_platine | E | Refus à la sortie sans Platine | Le Directeur garde la sortie pour lui. | Il faut être Platine pour quitter le magasin. | Je vais lui demander sa carte. |
| ouvre_argent | E | Déverrouillage réussi du sas de la réserve | La réserve est à moi. | Avantage fidélité : accès aux ennuis. | On passe derrière le décor. |
| ouvre_or | E | Déverrouillage réussi vers les bureaux | Je monte voir le patron. | Accès direction validé. Réclamation imminente. | La carte marche. L'excuse aussi. |
| ouvre_platine | E | Déverrouillage réussi de l'issue finale | Enfin une porte qui mène dehors. | Résiliation de mon abonnement. | La sortie est ouverte. On y va. |
| porte_ouvre | E | Première ouverture manuelle d'une porte ordinaire | Voyons ce qu'il y a derrière. | Le service suivant est ouvert. | Encore une pièce à vérifier. |
| porte_ferme | E | Fermeture manuelle volontaire d'une porte | Un peu de tranquillité. | Merci de patienter dehors. | Je préfère les entendre arriver. |
| porte_verrouillee | E | Refus d'une autre porte verrouillée | Pas par là, pour l'instant. | Accès restreint. Curiosité renforcée. | Je trouverai une autre entrée. |
| raccourci_coupe_feu | E | Action sur `use_coupe_feu`, ouverture du raccourci | Voilà qui évitera le grand tour. | Une sortie réservée au personnel. Maintenant à moi. | Je reconnais les rayons de l'autre côté. |
| boucle_reserve | R | Retour depuis les coulisses vers la réserve déjà visitée | On revient là où tout est stocké. | Circuit court. Problèmes longs. | Cette porte recolle les morceaux du magasin. |

## 4. Interactions précises — voix du héros

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| micro_annonces | T | Utiliser le micro de l'allée centrale | Chers clients, les reptiliens sont rappelés en caisse. | Promotion exceptionnelle sur les costumes vides. | Attention, magasin : votre Directeur passe en direct. |
| pointeuse | T | Actionner la pointeuse des vestiaires | Je pointe. Vous payez les heures supplémentaires ? | Employé fictif. Horaires bien réels. | Mon numéro existe pas. Ça commence bien. |
| sonnette_sav | T | Sonner au guichet SAV | J'ai un problème avec votre personnel. | Retour sans ticket. Motif : tentative de meurtre. | Ça sonne. Personne ne vient. Classique. |
| douche_ouvre | E | Allumer une douche | Cinq secondes pour enlever la poussière. | L'eau chaude est dans les avantages salariés ? | Au moins, ça couvre un peu le bruit. |
| douche_ferme | E | Couper une douche | Ça suffit. On reprend. | Fin de la pause hygiène. | Je préfère entendre ce qui approche. |
| toilettes_soulagement | T | Utiliser un sanitaire intact et recevoir du soin | Ah. Voilà une bonne décision. | Le meilleur service de ce magasin. | Ça va mieux. On peut reprendre. |
| toilettes_delai | E | Réutiliser un sanitaire pendant le délai de soulagement | Rien. J'ai déjà tout donné. | Service momentanément indisponible. | Ça se commande pas. |
| toilettes_plein | E | Utiliser un sanitaire à PV pleins | Je suis déjà en état de marche. | Pas besoin de maintenance. | Je vais pas forcer le destin. |
| boire_fuite | E | Boire au jet d'un sanitaire cassé et gagner un PV | Je boirai vraiment n'importe quoi. | Eau courante. Conscience absente. | Ça reste entre nous. |
| boire_fuite_plein | E | Tenter de boire au jet à PV pleins | Pas assez soif pour ça. | Je refuse cette offre sanitaire. | J'ai encore un peu de dignité. |
| photomaton_ouvre | E | Actionner `use_photomaton` et ouvrir le pan de mur | Belle photo. Drôle de fond. | Trois portraits et un passage secret. | Le flash vient de montrer un peu trop de choses. |
| grille_vmc_ouvre | E | Actionner `use_grille_vmc` et ouvrir l'accès du secret | Les conduits finissent toujours quelque part. | Ventilation gratuite. Passage compris. | Un courant d'air pareil, ça cache une pièce. |
| pousse_ouvre | E | Ouvrir la chambre de pousse du fournil | La pâte a pris possession des lieux. | Ils ont dépassé leurs objectifs de croissance. | Quelqu'un a oublié la recette. Ou le minuteur. |
| froid_secours | E | Actionner le déverrouillage intérieur de la chambre froide | Je reste pas enfermé avec ça. | Enfin une procédure qui sert à quelque chose. | La porte s'ouvre. Je respire déjà mieux. |
| camera_active | E | Activer la console du PC sécurité | À mon tour de surveiller. | J'emprunte votre dispositif de contrôle. | On va comparer leurs images aux miennes. |
| camera_suivante | E | Changer de caméra sur la console | Autre angle. Même problème. | Chaîne suivante, s'il vous plaît. | Voyons ce qu'ils regardent ailleurs. |
| camera_quitte | E | Quitter la vue caméra en reprenant le mouvement | Assez regardé. J'y vais. | Fin de la surveillance à distance. | Je préfère vérifier en personne. |
| camera_rayons | R | Première observation des rayons par caméra | Les gondoles font de belles cachettes. | Surveillance des prix. Et des survivants. | Je reconnais ce passage entre les allées. |
| camera_hub | R | Première observation du hub par caméra | Ils gardent même le carrefour. | Contrôle du flux client, version armée. | L'allée centrale est encore surveillée. |
| camera_reserve | R | Première observation de la réserve par caméra | Ils filment aussi leurs propres stocks. | Inventaire sous haute surveillance. | Je vais retenir ces angles morts. |
| camera_souterrain | R | Première observation du souterrain par caméra | Les ombres ne montrent pas tout. | Caméra présente. Sécurité discutable. | Les piliers coupent leur champ de vision. |
| camera_electro | R | Première observation de l'électroménager par caméra | Une caméra qui regarde des écrans. Charmant. | La publicité se surveille elle-même. | Ils ont vraiment peur qu'on change de chaîne. |
| camera_direction | R | Première observation du bureau du Directeur par caméra | Voilà le fauteuil qui dirige tout ça. | Le patron profite aussi du contrôle qualité. | Je sais maintenant où le trouver. |

## 5. Combat, armes utilisées et réactions — voix du héros

Réactions occasionnelles. Les variantes par arme supposent de conserver
l'origine du kill au moment du branchement ; le jeu ne les choisit pas
encore. Une menace ne déclenche pas simultanément une remarque de visite.

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| costard_apercu | R | Première observation d'un Costard, avant le combat | Beau costume. Regard très froid. | Le vigile a oublié son sourire commercial. | Regardez ses yeux. Je vous avais prévenus. |
| costard_alerte | E | Un Costard repère le joueur | Ils m'ont vu. Tant mieux. | Je crois que ma visite n'est pas autorisée. | La caméra leur plaît pas. |
| costard_tire | E | Première attaque ennemie reçue ou observée | Ah. Voilà leur politique d'accueil. | Service client à balles réelles. | Vous avez vu qui a commencé. |
| premier_kill | T | Premier ennemi tué dans la partie | Un de moins. Une preuve de plus. | Premier licenciement de la soirée. | Ils vont encore parler de trucage. |
| kill_costard | E | Mort d'un Costard, variante générique | Ton service est terminé. | Poste supprimé. Définitivement. | Voilà ce que cachait la cravate. |
| kill_pied_biche | E | Costard tué au pied-de-biche | On a réglé ça de près. | Entretien individuel terminé. | Pas besoin de zoom pour celui-là. |
| kill_pistolet | E | Costard tué au pistolet | Une réponse précise. | Dossier classé sans discussion. | Celui-là, je l'ai bien cadré. |
| kill_pompe | E | Costard tué au fusil à pompe | Ça remet les idées en place. | Retour immédiat à l'expéditeur. | Il va falloir élargir le cadre. |
| kill_gibs | E | Mort d'un Costard avec débris corporels visibles | Il avait beaucoup de choses à cacher. | Le costume n'est plus échangeable. | Je vais flouter certains détails. |
| kill_serie | P | Plusieurs kills rapprochés, condition à ajouter | Vous faites la queue pour ça ? | Traitement des dossiers par lots. | Ça mérite une compilation. |
| combat_termine | P | Tous les ennemis d'une rencontre locale sont morts, condition à ajouter | Plus personne ? Je vérifie. | Le rayon est enfin disponible. | On souffle. Mais on continue de filmer. |
| arme_melee_selection | E | Sortir le pied-de-biche en situation utile | Revenons aux outils simples. | Traitement manuel des réclamations. | Je vais m'approcher un peu. |
| arme_pistolet_selection | E | Sortir le pistolet en situation utile | On va faire ça proprement. | Une demande à la fois. | Je garde un peu de distance. |
| arme_pompe_selection | E | Sortir le pompe en situation utile | Ça demande une réponse plus large. | Le service express est ouvert. | J'ai prévu quelque chose de plus convaincant. |
| premier_tir_pistolet | E | Premier tir effectif au pistolet | Le message est parti. | Réclamation envoyée. | On ne peut plus dire que je bluffe. |
| premier_tir_pompe | E | Premier tir effectif au pompe | Là, tout le magasin a entendu. | Avis général à tous les services. | Je crois qu'on a réveillé le patron. |
| melee_ratee | E | Coup de pied-de-biche sans contact, très occasionnel | Bouge pas autant. | Entretien reporté. | Je règle encore la distance. |
| pistolet_vide | E | Tentative de tir au pistolet sans munitions | Plus de balles. Mauvais moment. | Rupture de stock. | Il me faut des munitions. Vite. |
| pompe_vide | E | Tentative de tir au pompe sans cartouches | Le gros argument est épuisé. | Fin de l'offre spéciale. | On change de méthode. |
| desarme | E | Tentative de tir avant le premier ramassage d'arme | Il me faut quelque chose pour me défendre. | Je suis venu sans équipement de sécurité. | Cherchons un outil avant de discuter. |
| touche | E | Le héros reçoit un coup, réaction verbale rare | Ça, tu vas le payer. | Réclamation supplémentaire. | Je filme encore, abruti. |
| pv_bas | T | Premier passage sous le seuil de PV bas | Ça va. Continuez de regarder. | Je suis encore dans la garantie. | Il me faut un soin, maintenant. |
| retour_sante | P | Remontée au-dessus d'un seuil de santé après danger, condition à ajouter | Là, je peux reprendre. | Remise en service. | Vous pouvez arrêter de vous inquiéter. |
| tomber_palier | E | Réception d'une chute de hauteur, commentaire occasionnel | Mauvaise estimation. | L'escalier était sûrement plus conforme. | Je pensais que c'était moins haut. |
| saut_obstacle | E | Franchir un obstacle par un saut, une fois dans une séquence utile | Ça passe. | Accès par-dessus le règlement. | Je prends le chemin court. |
| objet_pousse | E | Pousser un meuble physique qui encombre le passage | Pousse-toi de là. | Réorganisation du rayon. | Je me fais un peu de place. |

La chute désigne ici un mouvement observé, pas une promesse de dégâts de
chute. Aucun rechargement, tir à la tête spécialisé ou véhicule pilotable
n'est supposé par ces répliques.

## 6. Destruction et objets remarquables — voix du héros

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| casse_carton | E | Destruction d'un carton physique | Emballage supprimé. | Je déballe sans demander. | Voyons ce qu'ils cachaient dedans. |
| casse_bois | E | Destruction d'un objet en bois | Ça tenait pas à grand-chose. | Montage rapide. Démontage plus rapide. | C'était pas du massif. |
| casse_metal | E | Destruction d'un prop métallique cassable | Solide, mais pas assez. | La garantie vient de s'arrêter. | Ils ont économisé sur la résistance. |
| casse_vitre | E | Destruction d'une vitre cassable | Je préfère les passages ouverts. | Transparence totale, maintenant. | Plus rien entre nous. |
| casse_ecran | E | Destruction d'un écran animé cassable | Fin du programme. | Votre publicité rencontre un incident technique. | Voilà. Plus de désinformation. |
| casse_electronique | E | Destruction d'un prop électronique | Il fonctionnera plus. C'est une amélioration. | Réparation devenue inutile. | Je lui ai coupé la parole. |
| casse_farine | E | Destruction d'un sac de farine | Ça, c'est de la poudre blanche. | Farine en promotion sur tout le sol. | Je vais encore passer pour un fantôme. |
| casse_eau | E | Destruction d'un prop contenant de l'eau | Nettoyage automatique. | Dégât des eaux à votre charge. | Au moins, ça rince un peu. |
| casse_sanitaire | E | Destruction d'une cuvette ou d'un urinoir | La plomberie n'a pas apprécié. | Maintenance urgente au fond du magasin. | On va prétendre que c'était déjà cassé. |
| casse_distributeur | E | Destruction d'un distributeur physique cassable | Il vient de rendre la monnaie. | Réclamation acceptée. Distribution immédiate. | La méthode fonctionne mieux que les boutons. |
| casse_casier_vigile | E | Destruction du casier cadenassé du vigile | Un cadenas pour cacher un sandwich ? | Pause déjeuner déverrouillée. | Il protégeait vraiment son repas. |
| casse_balle_secret | E | Destruction des balles masquant la planque du vigile | Derrière les déchets, encore une cachette. | Le recyclage vient d'ouvrir une porte. | Ce carton était un peu trop bien placé. |
| machine_pinces | R | Observation de la machine à pinces, sans supposer une partie jouable | Même la pince a l'air truquée. | Une chance sur mille. Tarif plein. | Je connais déjà le gagnant : le magasin. |
| portrait_directeur | R | Observer le portrait du Directeur | La photo révèle déjà quelque chose. | Employé du mois. Espèce de l'année. | Regardez bien ce visage. |
| television_reptilien | R | Observer le présentateur reptilien sur un écran intact | Ils cachent même plus les écailles. | Journal officiel du sang-froid. | Mettez ça en pause. C'est la preuve. |
| television_pub | R | Observer une chaîne publicitaire | Même leurs pubs ont quelque chose à cacher. | Achetez maintenant. Posez vos questions jamais. | La propagande a de jolies couleurs. |
| television_foot | R | Observer la chaîne foot, notamment dans la planque | Même eux regardent le match. | Le vigile suit surtout le classement. | Une soirée normale, au milieu de tout ça. |
| television_mire | R | Observer la mire | Voilà le programme le plus honnête. | Aucun contenu. Aucun mensonge. | Je préfère presque celle-là. |
| vivier | R | Observer le vivier du labo, sans supposer de comportement animal | Ils ont du monde en aquarium aussi. | Produits vivants. Ambiance morte. | Je vais garder mes doigts pour l'instant. |
| carcasses | R | Observer les carcasses et le rail de la chambre froide | Je veux pas connaître le fournisseur. | Rayon viande. Questions interdites. | Filmez le rail. Pas trop près. |
| panier_caddies | R | Observer l'abri ou un groupe de caddies | Ils ont même rangé les caddies. Suspect. | Le jeton coûte moins cher que la sortie. | Un chariot ne suffira pas pour toutes ces preuves. |
| voiture | R | Observer une voiture dans un parking | Les propriétaires vont revenir dans quel état ? | Parking clients. Clients introuvables. | Je laisse les voitures. J'ai un magasin à vider. |
| moto | R | Observer une moto ou un scooter | J'aurais préféré repartir avec ça. | Deux roues. Beaucoup trop d'ennuis autour. | Pour l'instant, je reste à pied. |
| camion_hayon | R | Observer le camion à hayon de la réserve | Le hayon est prêt. Pour quel chargement ? | Livraison de nuit. Bon de commande suspect. | Ce camion doit avoir quelques histoires. |
| maintenance_sav | R | Observer le repère bleu et le chariot de retours du SAV | Les pannes s'accumulent ici. | Retours clients. Retours de bâton à suivre. | Tout ce matériel venait vraiment du magasin ? |
| maintenance_froid | R | Observer le repère jaune et le chantier près du froid | Quelqu'un bricolait encore tout ça. | Intervention en cours depuis très longtemps. | Je vais éviter ce seau et continuer. |
| compacteur_hs | R | Lire le repère de maintenance du compacteur | Même la machine à tout écraser est en panne. | Hors service. Comme leur sens de l'accueil. | Je touche pas au mécanisme. Pour l'instant. |
| cle_crochet_vide | R | Observer le crochet de clé vide au PC sécurité | Une clé manque. Quelqu'un s'est installé ailleurs. | Matériel perdu. Explication absente. | Je retiens ce crochet vide. |
| butin_antivols | R | Observer le butin encore sous antivol dans la planque | Le vigile surveillait surtout ses propres prises. | Avantage salarié : démarque personnelle. | Même planqué, il a gardé les antivols. |

La destruction utilise les familles réellement cassables : les vitrines,
écrans ou décors statiques non destructibles ne déclenchent pas une réplique
de casse. `vivier` reste une observation ; aucune fuite d'animaux n'est promise.

## 7. Secrets et découvertes — voix du héros

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| secret_generique | T | Secret trouvé, réaction commune de secours | Je savais qu'ils cachaient une pièce. | Surface non déclarée. Comme par hasard. | Voilà pourquoi je regarde partout. |
| secret_photomaton | E | Découverte de `secret_1_photomaton` | Un labo derrière les photos d'identité. Évidemment. | Le développement photo cache un autre développement. | Ce fond de cabine mérite une enquête. |
| secret_gondoles | E | Découverte de `secret_2_gondoles`, campement en hauteur | Quelqu'un vivait au-dessus des courses. | Logement avec vue sur les promotions. | Je n'étais pas le seul à observer d'en haut. |
| secret_aeration | E | Découverte de `secret_3_aeration`, local VMC | Tout ce détour pour cacher cette pièce. | Annexe hors catalogue. | Je vous avais dit de regarder les conduits. |
| secret_vigile | E | Découverte de `secret_4_planque` | Le vigile s'était fait son petit royaume. | Pause prolongée, butin compris. | La télé, la pizza, les cartons. Tout s'explique. |
| secrets_tous | E | Dernier secret du niveau trouvé, toutes les zones comptabilisées | J'ai trouvé toutes leurs cachettes. | Inventaire complet des espaces non déclarés. | Ils pourront plus dire que j'ai pas fouillé. |
| cache_gaine | E | Ramassage des munitions dissimulées dans la gaine | Ils ravitaillent même les conduits. | Stock de secours en hauteur. | Ce détour venait avec un bonus. |

## 8. Directeur, mort du héros et fin — voix du héros

La réaction `boss_rencontre` remplace `direction` si l'entrée déclenche
immédiatement le combat. `boss_revelation` suit la transformation réelle,
avant que le héros ait pu commenter la peau ou les écailles en détail.

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| boss_rencontre | E | Le Directeur engage la confrontation | J'aimerais parler au responsable. Ah, parfait. | Votre magasin pose quelques problèmes de sécurité. | Souriez, patron. Vous êtes en direct. |
| boss_attaque | E | Première attaque du Directeur | Même le patron fait le sale boulot. | Votre réponse manque de professionnalisme. | Il a vraiment pas aimé la caméra. |
| boss_revelation | E | Transformation du Directeur en reptilien | Je le savais. Je le savais ! | Voilà la vraie direction du magasin. | Gros plan sur les écailles. Maintenant ! |
| boss_revele_combat | E | Reprise du combat après sa révélation | Maintenant, au moins, on se parle franchement. | Plus besoin de costume pour diriger. | Tu peux plus te cacher derrière ton sourire. |
| boss_touche_hero | E | Le Directeur blesse le héros, réaction rare | T'as de la force pour un bureaucrate. | Je vais ajouter ça à la plainte. | Même blessé, je te vois très bien. |
| boss_mort | E | Mort du Directeur | Fin de mandat. | La direction vient de fermer. | Deux cents abonnés viennent de voir la vérité. |
| mort_hero | E | Mort du joueur, formule très courte | J'étais pourtant si près. | Mauvaise journée au magasin. | Gardez les images. |
| nouvelle_tentative | E | Nouvelle partie après une mort | Cette fois, je connais les pièges. | Deuxième passage en caisse. | On reprend. Rien n'est coupé au montage. |
| victoire | E | Franchissement final de la sortie, niveau terminé | J'avais raison. Et j'en suis sorti. | Merci de votre visite. Je reviendrai jamais. | Les images sont là. Maintenant, publiez-les. |
| victoire_secrets | E | Victoire avec tous les secrets trouvés | Rien caché. Rien oublié. | Audit complet. Magasin condamné. | J'ai les preuves et toutes les coulisses. |
| victoire_rapide | E | Victoire sous le temps de référence, si cette variante est choisie | Ils m'ont pas retenu longtemps. | Réclamation traitée en un temps record. | Même mon montage prendra plus de temps. |

Les variantes de victoire sont alternatives : n'enchaînez pas victoire,
tous les secrets et rapidité. Le texte ne suppose pas que la vidéo est
effectivement publiée par un système du jeu.

## 9. Voix courtes d'effort — héros, facultatif

Ces prises sont des réactions vocales brèves, séparées des phrases longues.
Leur jeu peut être plus physique. Elles restent occasionnelles et ne se
substituent pas aux signaux sonores utiles des armes.

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| effort_saut | E | Effort au saut | Hop ! | Hah ! | Allez ! |
| effort_reception | E | Réception d'une chute | Ouf ! | Ah ! | Doucement ! |
| effort_coup | E | Effort d'un coup de pied-de-biche | Tiens ! | Hah ! | Prends ça ! |
| douleur_legere | E | Petite blessure | Aïe ! | Ah ! | Merde ! |
| douleur_forte | E | Blessure forte, intensité vocale accrue | Argh ! | Ça pique ! | Putain ! |
| souffle_mort | E | Mort, alternative à une phrase | Non... | Ah... | Merde... |

## 10. Interactions futures — héros, réserves d'enregistrement

Ces lignes sont volontairement isolées des actions disponibles. Elles
permettent de préparer des prises pour les intentions du board des coulisses.

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| casier_ouvre | P | Ouvrir un casier ordinaire avec une interaction dédiée | Voyons ce qu'ils laissent au vestiaire. | Effets personnels. Secrets professionnels. | Une petite fouille de routine. |
| casier_embuscade | P | Un Costard apparaît en ouvrant un casier | Même les meubles sont occupés ! | Vestiaire complet. Accueil compris. | T'aurais dû garder la porte fermée. |
| radio_allume | P | Allumer la radio du fournil | Un peu de musique pour travailler. | La pause a enfin une bande-son. | Je préfère ça à leurs annonces. |
| radio_eteint | P | Éteindre cette radio | Silence. J'écoute les vrais problèmes. | Fin du programme musical. | Quelque chose a bougé derrière. |
| compacteur_demarre | P | Actionner un futur cycle jouable de la presse | Ça va faire un peu de place. | Réduction des volumes. Sans réunion. | On va voir ce qu'elle avale. |
| compacteur_fin | P | Fin de ce cycle de compression | Ça prend nettement moins de place. | Nouveau format économique. | Le résultat est plutôt convaincant. |
| compacteur_ennemi | P | Ennemi réellement tué par un futur mécanisme de presse | Le costume est maintenant bien repassé. | Réorganisation du personnel par compression. | Ça, c'est une fin très compacte. |
| cle_planque | P | Ramasser une future clé dans la planque | Voilà la clé du crochet vide. | Matériel retrouvé. Propriétaire absent. | Ce détail méritait bien le détour. |

## 11. Voix secondaires — prises séparées, facultatives

Ces répliques complètent le catalogue si vous souhaitez aussi des ennemis
parlants. Elles ne sont pas celles du héros. Les actions ennemies existent,
mais ces mots ne sont pas actuellement diffusés. Lisez chaque rôle avec une
voix distincte ; aucun acteur ne lit les choix d'un autre rôle.

### Costard — voix froide, ton de vigile trop procédurier

Noms : `costard_<identifiant>_a.wav`, `_b.wav`, `_c.wav`.

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| alerte | E | Repérage du joueur | Vous n'êtes pas autorisé à entrer. | Le magasin est fermé. | Posez cette caméra. |
| attaque | E | Télégraphie d'une attaque | Dernier avertissement. | Ne bougez plus. | Incident client confirmé. |
| recherche | E | Perte du contact, recherche du joueur | Il était ici. | Sortez de votre cachette. | Je vous retrouverai. |
| blessure | E | Le Costard reçoit un coup | Vous allez le payer. | Aïe ! | Incident aggravé. |
| mort | E | Mort du Costard | Pas... prévu... | Argh ! | La direction... |

### Directeur — voix autoritaire, puis plus rauque après révélation

Noms : `directeur_<identifiant>_a.wav`, `_b.wav`, `_c.wav`.

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| rencontre | E | Repérage du héros avant transformation | Vous auriez dû prendre rendez-vous. | Cette visite n'est pas approuvée. | Personne ne vous croira. |
| attaque_humain | E | Télégraphie d'attaque avant transformation | La direction met fin à cet entretien. | Vous dépassez largement votre rôle. | Vous ne quitterez pas ce bureau. |
| blessure_humain | E | Blessure avant transformation | Vous êtes en train de tout gâcher. | Mon costume ! | Ça suffit ! |
| revelation | E | Transformation en reptilien | Vous vouliez la vérité ? Regardez ! | Le costume commençait à me gêner. | Assez joué à l'humain. |
| attaque_reptile | E | Télégraphie d'attaque après transformation | Vous allez disparaître ici. | Maintenant, vous savez trop de choses. | Votre enquête s'arrête là. |
| blessure_reptile | E | Blessure après transformation | Insolent ! | Argh ! | Je vais vous dévorer. |
| mort | E | Mort du Directeur | Ce n'est... pas fini... | Mon magasin... | Personne... ne doit savoir... |

### Annonces du magasin — voix souriante, artificiellement rassurante

Noms : `annonce_<identifiant>_a.wav`, `_b.wav`, `_c.wav`. Le héros garde sa
propre voix lorsqu'il parle dans le micro : `micro_annonces` reste une ligne
du héros, avec un éventuel effet de haut-parleur ajouté plus tard.

| Identifiant | Statut | Situation | A | B | C |
|---|---|---|---|---|---|
| fermeture | P | Future annonce ambiante de fermeture | Chers clients, notre magasin est fermé. | Merci de rejoindre la sortie dans le calme. | Toute présence après fermeture est regrettable. |
| incident | P | Future annonce après déclenchement d'un combat | Un incident mineur est en cours de traitement. | Notre personnel assure votre tranquillité. | Merci de ne pas gêner les opérations de sécurité. |
| fidelite | P | Future annonce liée aux cartes | Votre fidélité vous ouvre de nouvelles portes. | Découvrez les privilèges de notre programme Or. | L'accès Platine est réservé à notre direction. |
| direction | P | Future annonce avant la confrontation finale | La direction vous remercie de votre discrétion. | Merci de ne pas solliciter le Directeur sans rendez-vous. | Votre réclamation a été transmise à la direction. |

## 12. Correspondance avec les objets et événements du niveau

Plusieurs exemplaires d'un même objet partagent la même famille de répliques.
Cette table couvre les objets interactifs du GLB consulté le 1er octobre.
Les soins et munitions restent groupés par type, pour éviter un fichier vocal
différent pour chaque boîte identique.

| Objet ou famille dans le niveau | Répliques correspondantes |
|---|---|
| `use_crowbar`, `use_pistol`, `use_shotgun` | `arme_pied_biche`, `arme_pistolet`, `arme_pompe` ; les refus ou gains supplémentaires utilisent `arme_double` ou `pistolet_double`. |
| `use_munitions_caisses_1`, `use_munitions_rayons_1`, `use_munitions_electro_1`, `use_munitions_reserve_1`, `use_munitions_souterrain_1` | `munitions_24` ou `munitions_pleines`. |
| `use_munitions_rayons_2`, `use_munitions_bureaux_1`, `use_munitions_secret1_1` | `munitions_36` ou `munitions_pleines`. |
| `use_munitions_gaine_1` | `cache_gaine` remplace `munitions_24` pour souligner le détour. |
| `use_soin_caisses_1`, `use_soin_rayons_1`, `use_soin_rayons_2`, `use_soin_electro_1`, `use_soin_reserve_1`, `use_soin_reserve_2`, `use_soin_souterrain_1` | `soin_25` ou `soin_plein`. |
| `use_soin_cafeteria_1`, `use_soin_bureaux_1`, `use_soin_secret1_1`, `use_soin_secret3_1` | `soin_50` ou `soin_plein`. |
| `use_nourriture_galerie_1`, `use_nourriture_vestiaires_1` | `manger_sandwich` ou `nourriture_pleine`. |
| `use_nourriture_cafeteria_1`, `use_nourriture_labo_1` | `manger_jambon` ou `nourriture_pleine`. |
| `use_fournil_poulet`, `use_nourriture_fournil_1` | `manger_poulet` ou `nourriture_pleine`. |
| `use_nourriture_bureaux_1`, `use_nourriture_pc_secu_1` | `manger_donut` ou `nourriture_pleine`. |
| `use_nourriture_secret4_1` | `manger_pizza` ou `nourriture_pleine`. |
| Nourriture libérée par les props | La famille de l'aliment ou `nourriture_lachee`, une seule réaction. |
| `use_carte_argent`, `use_carte_or`, carte du Directeur | `carte_argent`, `carte_or`, `carte_platine`. |
| `use_door_argent`, `use_door_or`, `use_door_exit` | Famille `manque_*` ou `ouvre_*`, selon le résultat réel. |
| `use_pa_mic`, `use_pointeuse`, `use_sav_sonnette` | `micro_annonces`, `pointeuse`, `sonnette_sav`. |
| `use_douche_1`, `use_douche_2` | `douche_ouvre` ou `douche_ferme`. |
| `use_fournil_pousse`, `use_chambre_froide_secours` | `pousse_ouvre`, `froid_secours`. |
| `use_pc_secu` et ses six caméras | `camera_active`, `camera_suivante`, `camera_quitte` et les six observations `camera_*`. |
| `use_photomaton`, `use_grille_vmc`, `use_coupe_feu` | `photomaton_ouvre`, `grille_vmc_ouvre`, `raccourci_coupe_feu`. |
| Quatre volumes `secret_*` | Réplique propre au secret, ou `secret_generique` ; `secrets_tous` peut remplacer la dernière réaction. |
| Portes manuelles des pièces | `porte_ouvre`, `porte_ferme`, éventuellement `porte_verrouillee`. |
| Cuvettes et urinoirs `sanitaire_*` | Famille `toilettes_*`, `boire_fuite*` ou `casse_sanitaire`, selon l'action. |
| Écrans cassables `ecran_*`, vitres `vitre_*`, mobilier physique `prop_*` | Familles de casse ; le casier, les distributeurs et les balles de la planque ont une réaction spécifique. |
| Costards, Directeur, joueur | Réactions de combat et de fin ; voix secondaires dans une série séparée. |
| Lieux et repères visuels | Section 1 et observations de la section 6 ; déclenchement spatial ou visuel à ajouter. |

### Sources de l'inventaire

- `public/assets/levels/niveau_v2.glb` : noms et propriétés des objets présents.
- `tools/level_v2/plan_de_masse.py` : pièces, passages, progression et secrets.
- `src/game/loop/updateGameplay.ts` : interactions, ramassages, combats et secrets.
- `src/game/session/player/feedback.ts` : réactions existantes et PV bas.
- `src/game/session/player/sanitaires.ts` : soulagement, délai et gorgée.
- `src/game/session/progression/cards.ts` et `src/game/session/progression/doors.ts` : cartes et accès.
- `src/game/player/weapons/weapons.ts` : armes, tirs et munitions.
- `src/game/level/interactions/food.ts` et `src/game/level/props/props.ts` : nourriture et mobilier cassable.
- `src/game/level/interactions/ecrans.ts` et `src/game/level/interactions/cameras.ts` : écrans et caméras.
- [Plan des coulisses](../assets/plan-coulisses.md) et
  [board des coulisses](../assets/board-coulisses.md) : interactions futures.

Les anciennes zones de test, les outils de développement, les messages
d'erreur et le dépannage du moteur n'ont pas de voix de personnage prévue.
