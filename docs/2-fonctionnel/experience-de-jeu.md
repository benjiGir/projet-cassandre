---
title: Expérience de jeu
tags: [fonctionnel]
status: stable
updated: 2026-09-25
---

# Expérience de jeu

## Ce que vit le joueur

Le signal s'ouvre sur un menu principal habillé comme une diffusion piratée :
un bandeau défilant annonce un canal non autorisé, un nombre d'abonnés
dérisoire. « Jouer » lance directement le niveau, sans cinématique.

Vous apparaissez sur le parking extérieur de l'hypermarché, de nuit,
désarmé. Un pied-de-biche traîne sur le capot d'une voiture à quelques pas :
c'est votre première arme, ramassée en marchant dessus. Deux employés en
costume-cravate rôdent au loin, trop distants pour réagir — un premier
contact visuel qui installe la menace sans la déclencher.

Vous entrez par la galerie marchande, transit calme entre kiosques et
devantures baissées, avant de déboucher aux caisses pour le premier vrai
combat et le premier pistolet, ramassé sur un tapis. Au-delà s'ouvre le hub :
un carrefour qui donne à l'ouest sur les rayons, à l'est sur l'électroménager,
et au nord sur une porte verrouillée. Deux Costards y patrouillent, bien
visibles — ce carrefour doit rester lisible, pas être une embuscade.

Les rayons et l'électroménager s'explorent dans l'ordre de votre choix.
Les rayons donnent le fusil à pompe et la première carte de fidélité, la
carte Argent, planquée derrière le comptoir du rayon frais — combat en
allées, embuscades aux croisements. L'électroménager donne la carte Or,
dans une cabine de démonstration devant un téléviseur, au milieu d'un mur
d'écrans et d'appareils en rangées. La carte Argent ouvre la porte du hub qui
mène à la réserve : un grand espace vertical, mezzanine comprise, qui donne
aussi accès à un parking souterrain tendu, éclairé aux piliers. C'est depuis
la réserve qu'un escalier de service, verrouillé par la carte Or, monte à
l'étage des bureaux.

L'étage aligne quatre bureaux (sécurité, comptabilité, ressources humaines,
salle de pause) avant de refermer sur le bureau du Directeur. Là vous
attend le combat final : le Directeur, escorté d'un garde du corps, engage
sans détour — pas d'approche furtive à gâcher, la confrontation doit être
immédiate. À sa mort, sa peau se déchire pour révéler le reptilien en
dessous, et il lâche la carte Platine : la clé de l'issue de secours qui
termine le niveau. La franchir bascule sur l'écran de fin, avec son
récapitulatif.

Deux détours sont facultatifs. La cafétéria, près de l'entrée, propose des
toilettes façon Duke 3D — s'y soulager sur une cuvette ou un urinoir intacts
rend un peu de vie, avec un long délai avant de recommencer ; un sanitaire
cassé au tir laisse couler une eau qu'on peut boire à volonté, par petites
gorgées. Trois secrets sont disséminés dans le niveau : un labo caché
derrière un pan de mur qu'un photomaton efface, un campement sur le toit
des gondoles des rayons, et une couvée dans un local technique atteint par
une bouche d'aération. Chacun récompense l'exploration.

Mourir coupe le signal : un écran « STREAM COUPÉ » affiche un récapitulatif
partiel et propose de reconnecter (rejouer depuis le début) ou de revenir au
menu — un vrai redémarrage de partie, pas un rechargement de page. Tout du
long, le jeu commente sa propre fiction : un HUD façon overlay de stream
(webcam factice, compteur de « vues », mention « EN DIRECT »), des répliques
ponctuelles du héros, et des marques de supermarché inventées peuplent les
rayons — le ton et le détail de cette satire sont décrits dans
`2-fonctionnel/interface.md` et `2-fonctionnel/son.md`.

Le chemin de progression, avec ses deux verrous à carte et sa boucle de
mort :

```mermaid
flowchart TD
  A[Parking extérieur - spawn désarmé] --> B[Galerie puis caisses - premier pistolet]
  B --> C[Hub]
  C --> D[Rayons - Carte Argent, pompe]
  C --> E[Électroménager - Carte Or]
  D --> F{Porte Argent}
  E --> F
  F --> G[Réserve puis souterrain]
  G --> H{Porte Or}
  H --> I[Étage des bureaux]
  I --> J[Bureau du Directeur]
  J --> K[Carte Platine à sa mort]
  K --> L{Porte de sortie}
  L --> M[Écran de fin et récapitulatif]
  C -.mort.-> N[Écran de mort]
  J -.mort.-> N
  N -.rejouer.-> A
```

## Règles

- Le joueur démarre désarmé sur ce niveau : le pied-de-biche au sol est la
  première arme, ramassée en marchant dessus, sans confirmation.
- Une carte de fidélité s'obtient en marchant sur son emplacement ou, pour
  la carte Platine, en vainquant le Directeur qui la lâche à sa mort.
- Une porte à carte refuse de s'ouvrir tant que la carte requise n'est pas
  en poche, avec un message et un son d'échec ; elle reste réessayable.
  Une fois ouverte avec la bonne carte, elle le reste pour toute la partie.
- Les cartes Argent et Or se trouvent chacune dans un espace accessible
  sans carte (rayons et électroménager depuis le hub) ; elles déverrouillent
  ensuite des espaces plus loin dans le niveau (réserve puis étage des
  bureaux).
- Un secret compte pour le score une fois trouvé, même sans y ramasser sa
  récompense.
- Un sanitaire intact rend de la vie en l'utilisant, avec un long délai
  avant de pouvoir recommencer ; un sanitaire cassé au tir laisse une eau
  qu'on peut boire sans limite.
- Franchir la porte de sortie déverrouillée met fin au niveau et ouvre
  l'écran de fin ; mourir avant ouvre l'écran de mort avec un récapitulatif
  partiel, sans bonus de rapidité.
- Rejouer ou revenir au menu depuis un écran de fin remet la partie à zéro
  pour de vrai, cartes et progression comprises.

## Valeurs

Détail chiffré des dégâts, points de vie, munitions, temps de référence et
barème de score : `6-reference/valeurs-deplacement.md`,
`6-reference/valeurs-ennemis.md`. Détail des préfixes et conventions du
niveau (dont les cartes de fidélité) : `6-reference/conventions-nommage.md`.

## État

- Validé en playtest : la sensation de déplacement (« Quake / Half-Life
  1 »), et le combat contre plusieurs Costards jugé fun malgré des sprites
  provisoires. La structure du niveau v2 (circulation, durée, lisibilité,
  sans aucun habillage) a été jouée et validée avant l'habillage.
- En attente de verdict : l'habillage complet du niveau v2 (décor, éclairage,
  contenu des dix espaces), les sprites d'ennemis pré-rendus, les modèles
  d'armes en vue subjective, les sanitaires façon Duke 3D, l'écran de fin
  avec récapitulatif, et le menu Pause/Options en cours de partie.

## Pour aller plus loin

- `2-fonctionnel/deplacement-et-controles.md` — comment on se déplace et vise.
- `2-fonctionnel/armes.md` — pied-de-biche, pistolet, pompe.
- `2-fonctionnel/ennemis.md` — Costard et Directeur.
- `2-fonctionnel/le-niveau.md` — les dix espaces et le plan de masse.
- `2-fonctionnel/objets-interactifs.md` — portes, sanitaires, ramassages.
- `2-fonctionnel/secrets-et-score.md` — secrets et barème de score.
- `2-fonctionnel/interface.md` — menus, HUD « stream », écrans.
- `2-fonctionnel/son.md` — ambiances et répliques.
