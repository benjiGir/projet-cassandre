---
title: Son
tags: [fonctionnel]
status: stable
updated: 2026-09-26
---

# Son

## Ce que vit le joueur

Chaque tir a son timbre propre : le pistolet claque, sec et médium ; le pompe
pèse, grave et sourd ; le pied-de-biche ne fait qu'un souffle d'air déplacé
tant qu'il touche le vide. Un impact sonne selon ce qu'il frappe — béton,
métal, chair — et jamais deux fois exactement pareil, une légère variation de
hauteur empêche l'oreille de reconnaître un échantillon répété.

Un Costard passe par quatre sons qui racontent le combat sans qu'on ait besoin
de le regarder : un grognement d'alerte quand il vous repère, un cliquet aigu
et reconnaissable au moment où il vous met en joue — le signal qui dit qu'un
coup arrive avant qu'il ne parte —, une expiration forcée quand il encaisse un
tir, un grondement qui tombe quand il meurt. Un tir ennemi qui vous rate joue
en plus un son distinct au moment du coup, pensé pour percer même par-dessus
le bruit de votre propre arme : c'est ainsi que vous savez qu'on vous tire
dessus hors champ, sans le voir.

Les portes animées annoncent leur mouvement dès qu'elles s'ouvrent — un
grincement de charnière pour un battant, un glissement pneumatique pour un
coulissant, le déroulé d'un rideau métallique pour les rideaux — et se
referment sans bruit. La porte à carte de fidélité répond par un bip : deux
notes descendantes si elle refuse, deux notes montantes suivies d'un déclic
mécanique si elle accepte. Ramasser une trousse de soin ou une boîte de
munitions déclenche chacun son carillon bref, sans jamais se confondre l'un
avec l'autre. Trouver un secret sonne instantanément différent de tout le
reste du jeu : un arpège qui monte, la seule récompense purement sonore du
jeu.

Les sanitaires cassables ont leur propre petit théâtre : tirer la chasse d'une
cuvette intacte joue son déroulé complet, du déclic du levier au sifflement du
remplissage ; casser la faïence d'un coup de feu fait éclater un bruit de
faïence épaisse suivi d'une gerbe d'eau ; boire au jet d'un sanitaire cassé
(touche `E`) déclenche une gorgée courte à chaque appui, et le jet lui-même
bruit en continu, plus fort à mesure qu'on s'en approche, glissant d'une
oreille à l'autre selon la direction du regard.

En fond, chaque zone du niveau a sa propre ambiance — parking extérieur la
nuit, magasin fermé aux néons et vitrines frigo, réserve métallique qui
résonne, parking souterrain, coulisses, bureaux de l'étage. Elle change en
fondu quand on passe d'une zone à l'autre, son niveau respire lentement, et
toutes les 6 à 14 secondes un bruit isolé tombe à gauche ou à droite (un néon
qui grésille, un caddie au loin, une tôle qui travaille, un téléphone qui
sonne dans un bureau vide). Le jeu n'a pas de musique : l'ambiance de
zone et les répliques du héros suffisent à habiller le silence.

## Règles

- Un son important qui doit rester audible en plein combat — la mise en joue
  d'un Costard, le jet d'eau d'un sanitaire cassé — est construit pour ne
  jamais être noyé par le bruit de votre propre tir : c'est un canal de jeu,
  pas de l'habillage.
- Un son qui se répète beaucoup (tirs, impacts, feedback ennemi) varie
  légèrement de hauteur à chaque lecture, pour ne jamais sonner comme une
  boucle identique ; un son rare et signifiant (secret trouvé, badge accepté)
  ne varie pas.
- Le jet d'eau d'un sanitaire cassé est le seul son positionnel du jeu : son
  volume et sa direction suivent votre position et votre regard en continu,
  tant qu'il reste actif.
- Entre deux répliques du héros, il y a toujours un délai minimum.
- Options › Audio règle le volume général et celui de chaque catégorie
  (effets, voix du héros, ambiances), et affiche ou masque les sous-titres des répliques.
- Mettre le jeu en pause éteint en fondu le jet d'eau positionnel et les
  ambiances de zone, et aucun nouveau son de gameplay ne peut se
  déclencher tant que la partie ne reprend pas.

## Valeurs

Volumes par catégorie : l'onglet Audio des options ([Interface](interface.md)) ;
détail des touches : `6-reference/controles.md`.

## État

**Chantier en cours, direction arrêtée le 2026-09-21** après quatre passes
rejetées à l'écoute : de vrais enregistrements pour tout ce qui est un objet
(armes, impacts, verre, bois, portes, ramassages, voix des Costards), la
synthèse pour ce qui n'existe pas physiquement (interface, lecteur de carte,
secret trouvé, ambiances de zone). En attendant les enregistrements, la quasi-
totalité du jeu est **synthétisée par calcul**, y compris ce qui est destiné à
devenir un enregistrement plus tard :

| Famille | Origine prévue | État actuel |
|---|---|---|
| Armes (pistolet, pompe, mêlée) | Enregistrement | Placeholder de synthèse |
| Impacts (béton, métal, chair, bois, verre) | Enregistrement | Placeholder de synthèse |
| Ennemis (alerte, douleur, mort, voix) | Enregistrement (voix) | Placeholder de synthèse |
| Télégraphie d'attaque ennemie | Non tranché — signal de jeu pensé pour ne ressembler à rien d'autre | Synthèse |
| Portes (mouvement des vantaux) | Enregistrement | Placeholder de synthèse |
| Porte à carte de fidélité (refus/acceptation) | Synthèse | Définitif |
| Ramassages (soin, munitions) | Enregistrement | Placeholder de synthèse |
| Secret trouvé | Synthèse | Définitif |
| Sanitaires — chasse, gorgée, jet d'eau | Enregistrement | Placeholder de synthèse |
| Sanitaires — casse de la faïence | Enregistrement | Placeholder hybride (faïence déjà réelle, eau encore synthétisée) |
| Ambiances de zone (6 zones, nappe + bruits isolés) | Générées (ElevenLabs) | Choisies à l'écoute le 2026-10-02, pas encore jugées en jeu |

- Validé en playtest : rien de spécifiquement sonore n'a encore reçu de
  verdict de playtest — le jeu s'est joué jusqu'ici avec ces placeholders sans
  retour dédié au son.
- En attente de verdict : absolument tout ce qui précède. Aucun agent n'a
  entendu ces sons — seules des mesures (spectre, masquage, facteur de crête)
  ont pu être vérifiées sans les écouter. Le jugement final revient à un
  humain, au casque.

## Pour aller plus loin

- Fonctionnement du lecteur de sons, de l'audio sprite et de la boucle d'eau
  positionnelle : `4-technique/audio-runtime.md`.
- Comment un son est composé, mesuré et empaqueté : `4-technique/studio-audio.md`.
- Chaîne complète depuis la recette jusqu'au fichier livré en jeu :
  `3-architecture/pipelines-de-contenu.md`.
