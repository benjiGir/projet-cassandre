---
title: Objets interactifs
tags: [fonctionnel]
status: stable
updated: 2026-10-01
---

# Objets interactifs

## Ce que vit le joueur

L'hypermarché n'est pas qu'un décor à traverser : des portes s'ouvrent devant
vous, des rayons entiers se poussent et s'effondrent, des vitres explosent au
tir, et une salle de toilettes rend service à qui sait viser. Rien de tout ça
ne vous ralentit ni ne vous immobilise : chaque interaction se résout en un
instant, sans animation qui vous cloue sur place.

### Les portes

La plupart des portes s'ouvrent toutes seules dès que vous — ou un employé —
vous en approchez, puis se referment un instant après que tout le monde s'en
soit écarté. Certaines ne réagissent qu'aux employés : à vous de les
actionner à la main, en appuyant sur `E` tout près. D'autres portes, à
l'inverse, ne s'ouvrent QUE à la main — les employés, eux, continuent de les
pousser au passage.

Une porte à carte reste verrouillée tant que vous n'avez pas la bonne carte de
fidélité en poche : un message vous le rappelle si vous essayez sans elle, et
rien ne vous empêche de réessayer plus tard. Une fois ouverte, elle le reste
pour le reste de la partie. Une porte peut aussi s'ouvrir sans aucune
condition à la première pression sur son bouton — un simple passage qu'on
libère.

Un cas particulier mérite d'être connu : une porte à sens unique s'actionne
d'un côté seulement. De l'autre côté, une fois franchie, vous pouvez la
refermer derrière vous à la main, mais son bouton d'ouverture reste hors de
portée — pour rouvrir, il faut retourner le chercher. C'est ce qui fait d'un
raccourci un vrai raccourci : utile une fois qu'on l'a atteint par le chemin
normal, jamais avant.

Une porte prend plusieurs formes selon l'endroit : un battant qui pivote, un
panneau qui coulisse sur le côté, un rideau qui descend ou un autre qui
remonte. Une porte double s'ouvre toujours d'un seul mouvement, ses deux
vantaux ensemble. Aucune porte ne se referme jamais sur vous : si vous êtes
encore dans l'embrasure au moment où elle devrait se refermer, elle rouvre
plutôt que de vous bloquer.

### Les boutons et les objets à activer

D'autres objets se déclenchent à la touche `E`, à courte portée, sans qu'il
soit nécessaire de viser précisément — il suffit d'être assez près. Un micro
d'annonces, par exemple, lance une réplique du héros à volonté, autant de
fois que vous voulez. D'autres déclenchent un passage : un pan de mur qui
s'efface, une grille qui se lève. Rien de tout cela ne se consomme une fois
utilisé, sauf quand l'action a déjà eu son effet (une porte déjà ouverte
n'a plus rien à faire).

### Les ramassages

Une trousse de soin ou une boîte de munitions se ramassent simplement en
marchant dessus, sans rien à confirmer — et seulement si vous en avez besoin :
à pleine vie ou au plafond de munitions, l'objet reste au sol pour plus tard.
Les armes au sol suivent la même règle ; leur détail complet est dans
[Armes](armes.md).

Les cartes de fidélité se présentent comme des cartes à puce flottantes qui
restent face à vous, comme les armes au sol. Argent, Or et Platine ont chacune
leur couleur, leur nom et un nombre d'étoiles distinct.

Une carte de fidélité, elle, se ramasse à la touche `E` en vous en
approchant : elle disparaît aussitôt et ouvre la porte qui l'attend ailleurs
dans le niveau. La Platine apparaît à la mort du Directeur et se récupère
en marchant dessus.

### Le mobilier physique

Caisses, cartons et autres meubles ne sont pas de simples décors : vous
pouvez les pousser en marchant dedans, et les ennemis font de même. Une pile
de cartons s'effondre si vous la bousculez. Certains de ces meubles
encaissent des coups avant de se briser en débris — bois, carton, verre ou
métal, chacun avec son propre bruit de casse — quand d'autres résistent
indéfiniment et se contentent de reculer sous la poussée.

Une limite à connaître : un meuble physique, même massif, n'arrête jamais un
tir ennemi. Il peut vous cacher à la vue, mais une balle le traverse comme
si de rien n'était.

### Les vitres

Certaines parois vitrées se brisent au tir — cloisons de bureau, panneaux du
sas d'entrée — quand d'autres, comme les grandes baies sur la ville ou les
verrières, sont incassables et ne réagissent à rien. Un vitrage donnant sur
un espace surgelé libère un nuage de givre en éclatant. Un ennemi qui vous
tire dessus à travers une vitre sur son chemin la fait systématiquement
exploser d'un coup, sans lien avec sa résistance habituelle au tir.

### Les sanitaires

Une cuvette ou un urinoir intact se soulage en le visant vraiment — s'y tenir
à proximité sans le regarder ne suffit pas — puis en appuyant sur `E`. La
chasse d'eau part à chaque fois, mais l'effet ne se répète pas indéfiniment :
un court repos de jeu s'impose avant le prochain soulagement, pendant lequel
rien ne se passe d'autre que le bruit de la chasse. À pleine vie, l'appareil
ne consomme pas ce délai pour rien.

Un sanitaire suffisamment endommagé au tir se brise et laisse échapper un jet
d'eau permanent : viser ce jet et appuyer sur `E` permet d'en boire autant de
fois que vous le voulez, sans aucun délai cette fois — juste un peu moins
d'un coup à chaque gorgée qu'un vrai soulagement.

### Récapitulatif

| Objet | Interaction | Effet | Cassable |
|---|---|---|---|
| Porte automatique | S'approcher | S'ouvre, puis se referme seule | Non |
| Porte manuelle | `E`, à portée | S'ouvre et/ou se referme | Non |
| Porte à carte | `E`, à portée | S'ouvre si la carte est en poche, sinon message | Non |
| Porte à sens unique | `E` (fermer des deux côtés, ouvrir d'un seul) | Ouvre un raccourci | Non |
| Bouton / objet à activer | `E`, à portée | Réplique, passage débloqué | Non |
| Carte de fidélité | `E`, à portée | Ramassée, ouvre une porte | Non (ramassage) |
| Trousse de soin | Marcher dessus | Soigne si besoin | Non |
| Boîte de munitions | Marcher dessus | Recharge si besoin | Non |
| Arme au sol | Marcher dessus | Ramassée ou recharge le pistolet | Non |
| Meuble physique | Pousser, tirer | Se déplace, s'effondre, se brise selon la matière | Selon le meuble |
| Vitre cassable | Tirer | Explose, givre si surgelés | Oui |
| Vitre incassable | — | Ne réagit à rien | Non |
| Sanitaire intact | Viser, `E` | Soulagement (+PV), délai avant le prochain | Oui (au tir) |
| Sanitaire cassé | Viser le jet, `E` | Gorgée d'eau (+PV), illimité | Déjà cassé |

## Règles

- Aucune interaction ne bloque le déplacement, le saut ou le tir : pas
  d'animation qui immobilise le joueur.
- Un objet ramassé au contact (trousse, munitions, arme) ne disparaît que
  s'il sert à quelque chose ; sinon il reste au sol.
- Une porte ou un bouton refusé (carte manquante, délai en cours) reste
  réessayable : rien n'est jamais consommé sur un échec.
- Une porte ne se referme jamais sur un joueur ou un ennemi resté dans son
  passage : elle rouvre plutôt que de continuer à se fermer.
- Un meuble physique protège du regard, jamais des balles ennemies.
- Un ennemi qui tire à travers une vitre sur son chemin la brise toujours
  d'un coup, quelle que soit sa résistance au tir d'un joueur.
- Se soulager à un sanitaire exige de le regarder vraiment, pas seulement de
  s'en approcher.
- Un seul délai de repos vaut pour tous les sanitaires intacts du niveau : se
  soulager à l'un impose le même délai partout ailleurs.

## Valeurs

Cette page ne fixe aucun nombre. Détail chiffré (pourcentage de soin, durée
du délai des sanitaires, points de vie des meubles et des vitres, portées) :
`6-reference/valeurs-objets-interactifs.md`.

## État

- Validé en playtest : rien de spécifique à cette page n'a encore reçu de
  verdict humain — l'attention du dernier tour de jeu a porté sur le combat
  et le niveau, pas sur ces objets pris isolément.
- En attente de verdict : les portes animées, les vitres cassables, le
  mobilier physique poussable et cassable, et les sanitaires façon Duke 3D
  (soulagement, casse, gorgée d'eau) — les cinq passes qui les ont ajoutés
  attendent toutes une vraie partie jouée jusqu'au bout.

## Pour aller plus loin

- [Systèmes de niveau](../4-technique/systemes-de-niveau.md) — portes,
  vitres, mobilier physique et sanitaires vus de l'intérieur.
- [Conventions de nommage](../6-reference/conventions-nommage.md) — les
  préfixes d'objet Blender qui pilotent chaque comportement.
- [ADR 0030 — Props dynamiques](../decisions/0030-props-dynamiques.md)
- [ADR 0031 — Portes animées et vitres](../decisions/0031-portes-animees-et-vitres.md)
- [ADR 0032 — Sanitaires utilisables](../decisions/0032-sanitaires-utilisables.md)
