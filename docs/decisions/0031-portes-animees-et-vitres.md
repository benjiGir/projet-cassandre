---
title: Portes animées et vitres — DoorSystem/VitreSystem, collider actif seulement fermé
tags: [adr, physique, niveau, rendu]
status: accepte
updated: 2026-09-19
---

# ADR 0031 — Portes animées et vitres : `DoorSystem`/`VitreSystem`, collider actif seulement fermé

## Contexte

Retour de playtest : « j'aimerais des vraies portes qui bougent, des vraies
vitres ». En creusant, aucune porte n'avait JAMAIS bougé à l'écran depuis la
porte à badge de la Zone E (2026-08-23) : `session/doors.ts::unlockDoor`
désactivait bien le collider et glissait le CORPS Rapier
(`session.openingDoor`, une seule porte à la fois, écriture directe de
`body.setTranslation`), mais rien ne recopiait jamais cette pose sur le
MESH — seuls les `prop_*` le faisaient (`PropSystem.interpolate`). Le
vantail restait affiché à sa position fermée, et on passait au travers dès
que son collider tombait. Personne ne l'avait remarqué parce que le
critère de succès jusque-là était « le passage s'ouvre », pas « on voit la
porte bouger ».

Pas de préfixe `vitre_*` du tout : une baie vitrée était soit un `col_box_*`
opaque, soit un trou dans le mur.

Contraintes déjà en place, héritées des ADR précédents :

- **Le budget de lots de dessin**, mesuré à 200, pire vue déjà à 198
  ([ADR 0023](0023-fusion-decor-au-chargement.md)/[0026](0026-visibilite-par-espace-et-pool-de-lampes.md)).
  Un vitrage NE DOIT PAS coûter un lot par vitre.
- **Le graphe de navigation et les lignes de vue ennemies sont calculés une
  fois, au chargement**, filtrés sur `GROUP.WORLD`
  ([ADR 0030](0030-props-dynamiques.md)).
- **Le collider de porte n'était pas recentré** sur sa bounding box
  ([ADR 0012](0012-porte-collider-non-recentre.md)) — un choix qui tenait
  tant que le corps ne bougeait jamais réellement.
- **Invariant #1** (pas fixe strict) et **#13** (aucune durée sur `setTimeout`
  réel, même en dehors de XState).

## Décision

### Portes : `DoorSystem` (`game/level/doors.ts`)

Le corps Rapier d'un `door_*` reste **FIXE, à la pose FERMÉE, pour
toujours**. Seul le **collider** s'active/se désactive (activé seulement
quand le vantail est complètement fermé, désactivé dès le premier instant
d'une ouverture) et seul le **mesh** est animé — pivot ou translation,
calculés au pas fixe, interpolés au rendu comme un `prop_*`
(`snapshotPrevious`/`update`/`interpolate`, mêmes quatre moments de la
boucle).

C'est plus simple que l'ancien modèle (corps dynamique verrouillé, glissé à
la main) et plus robuste : un vantail n'existe, du point de vue de la
physique, qu'ouvert ou fermé — jamais "à moitié", jamais un pas fixe où un
personnage pourrait se retrouver coincé dans une géométrie en mouvement.
Une capsule qui chevauche encore le vantail à la fin d'une fermeture fait
ROUVRIR le groupe plutôt que de se refermer dessus.

Quatre mouvements (`mouvement`, extra Blender, défaut `descend` pour ne rien
casser des `.glb` déjà exportés) : `battant` (pivote autour d'un axe
vertical, à une extrémité du grand axe horizontal LOCAL de la bounding box),
`coulisse` (glisse le long de ce même axe), `monte`/`descend` (translation
verticale pure, own hauteur par défaut). Le repère de `charniere`
(`"min"`/`"max"`) et de `sens` (`"+"`/`"-"`) est le repère LOCAL **three.js**
du mesh chargé — donc déjà après la conversion Y-up (Blender) -> Z-up
(three.js) faite par `GLTFLoader` ; le +Y de Blender devient le −Z de three,
c'est à l'auteur du niveau de la garder en tête en pointant `charniere`/`sens`
depuis Blender.

`sens: "auto"` (défaut pour un battant) résout, à CHAQUE début d'ouverture, le
sens qui écarte le vantail de la position de l'ouvreur (joueur ou ennemi) —
recalculé à chaque fois, donc un va-et-vient (réserve) pousse d'un côté ou de
l'autre selon qui arrive. `groupe` fait s'ouvrir/se refermer plusieurs
vantaux ENSEMBLE (portes doubles), avec la portée `auto` mesurée depuis le
centre du groupe ; un `use_*`/une carte qui cible UN vantail du groupe ouvre
le groupe entier — sans code dédié, c'est une conséquence directe de la
résolution "porte -> groupe" avant d'agir. Les portes à carte/`use_*`
restent **toujours ouvertes** une fois débloquées (`permanent`), quel que
soit `referme`.

`autoGroupColliders` expose les colliders des groupes `auto` pour que
`session/spawning.ts` les désactive le temps du bake du graphe de
navigation (puis les réactive) : sans ça, un bureau derrière une porte
automatique fermée au chargement ne recevrait jamais d'arête.

### Vitres : `vitre_*` (`game/level/vitres.ts`)

Collider cuboid FIXE, groupe `WORLD` — bloque déplacement, tirs et ligne de
vue tant que la vitre est intacte, exactement comme un mur. `solide: false`
retire le collider entièrement (verrière au plafond, fenêtre extérieure dont
le MUR garde son propre collider) : un collider au-dessus d'un sol serait
pris pour ce sol par le bake de navigation, piège déjà connu.

Le budget de lots interdit un mesh par vitre. `mergeVitreDecor` fusionne les
`vitre_*` par cellule de `DECOR_CELL_SIZE` (48 m, la même découpe que
`mergeStaticDecor`, recalculée indépendamment parce que le résultat doit
garder la plage de sommets de CHAQUE vitre) **et** par matériau — mais
contrairement au décor fusionné, une vitre reste **individuellement
adressable** : `VitreInfo` retient `[vertexStart, vertexCount)` dans le
buffer de position du lot. Casser une vitre ÉCRASE seulement sa propre
plage sur son propre centre (`needsUpdate = true`) ; le lot reste un seul
mesh, un seul lot de dessin, pour toujours — casser dix vitres d'une même
cellule ne coûte jamais un dessin de plus.

Tir du JOUEUR : dégâts par PV, même table `damageForWeapon` qu'un `prop_*`.
Tir ENNEMI (`enemyMachine.ts::resolveAttack`, via l'aide exportée
`handleEnemyShotMiss`) : casse la vitre **d'un coup**, sans passer par ses
PV — l'effet Duke Nukem demandé par le contrat. Voir "Alternatives écartées"
pour pourquoi cette asymétrie est assumée.

## Pourquoi le corps reste FIXE plutôt que dynamique-verrouillé (comme avant)

C'est le vrai changement de modèle de cet ADR, plus que l'ajout d'un
préfixe. L'ancien `buildDoor` posait un corps **dynamique**, `lockTranslations()`/
`lockRotations()`, `setGravityScale(0)` — verrouillé, mais capable en
principe de bouger, ce qui a justifié qu'on le fasse bouger À LA MAIN
(`body.setTranslation` direct dans `updateGameplay.ts`). Ce couplage entre
"le corps porte le mouvement visuel" et "le corps porte la physique" est
exactement ce qui a produit le bug initial : quand quelqu'un a ajouté le
`.glb` mais oublié de recopier la pose sur le mesh, rien dans le type
system ni dans les tests ne pouvait le signaler — le corps bougeait
(invisible, en `console.log` seulement), le mesh restait figé.

Séparer strictement "le corps ne bouge JAMAIS, seul le collider
s'active/se désactive" de "le mesh est purement cosmétique, animé par un
système dédié" rend le bug structurellement impossible à reproduire : le
mesh n'a plus d'autre source de vérité que `DoorSystem.interpolate`, et un
oubli de brancher cet appel casse visiblement TOUTES les portes d'un coup
(regression facile à repérer), pas une seule silencieusement.

Conséquence : le collider de porte est maintenant recentré sur sa bounding
box, comme `buildCuboidCollider` — voir [ADR 0012](0012-porte-collider-non-recentre.md),
remplacé par cette décision.

## Pourquoi le tir ennemi casse la vitre d'un coup, sans passer par ses PV

Un ennemi ne "vise" jamais le verre : `resolveAttack` re-vérifie la ligne de
vue vers le joueur avant de tirer (le rayon direct doit être dégagé), puis
disperse le tir d'un jitter d'angle. Une vitre qui ne bloquait pas cette
ligne de vue directe (trop excentrée) peut donc quand même se trouver sur la
trajectoire DÉVIÉE d'un coup — c'est le scénario que le contrat appelle
« l'effet Duke Nukem ». Faire encaisser des PV à la vitre dans ce cas
demanderait de suivre un total de dégâts PAR ENNEMI PAR VITRE sans qu'aucune
arme ennemie n'ait de notion de "dégâts contre le décor" — un système entier
pour un cas qui, par construction, arrive rarement et n'a pas besoin d'être
progressif : un raté qui frôle une vitre la fait logiquement voler en
éclats.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| **Continuer à glisser le corps Rapier à la main** (modèle historique) | C'est la cause racine du bug initial — le mesh n'a jamais de raison de suivre un corps qu'aucun système ne relit |
| **Corps dynamique + `KinematicCharacterController` pour le vantail** | Sur-ingénierie : un vantail n'a pas de collisions à RÉSOUDRE (glissement contre un mur, autostep) comme un personnage, juste une pose calculée |
| **Garder le collider actif pendant tout le mouvement, avec une géométrie qui suit** | Réintroduit exactement le risque qu'un personnage se retrouve coincé dans un vantail en cours de fermeture ; le modèle "actif seulement fermé" l'élimine par construction |
| **Un mesh par vitre, jamais fusionné** | Le budget de 200 lots (pire vue déjà à 198) ne survit pas à un rayon de gondoles surgelées avec dix vitrines de porte |
| **Vitre cassée = mesh retiré de la scène** | Retirerait aussi les vitres SAINES du même lot fusionné (un seul mesh pour plusieurs vitres) — l'écrasement de sommets casse UNE vitre sans toucher aux autres |
| **Tir ennemi endommage la vitre progressivement (mêmes PV que le joueur)** | Demanderait un budget de dégâts par ennemi, pour un cas rare et déjà lisible comme "raté qui casse une vitre" — voir la section dédiée ci-dessus |

## Conséquences

- **`session.openingDoor`/`OpeningDoor` ont disparu** de `GameSession` —
  remplacés par `session.doorSystem: DoorSystem | null`, reconstruit à
  chaque chargement comme `PropSystem`/`currentNavGraph`/`lightPool`. Une
  porte déjà dans `session.unlockedDoors` (hot reload) est rouverte
  silencieusement à la reconstruction, sans quoi un rechargement de niveau
  reverrouillerait une porte déjà ouverte de LA MÊME partie.
- **Trois sons neufs** (`door_swing`, `door_slide`, `door_shutter`), un par
  MOUVEMENT plutôt que par porte — trois timbres suffisent à distinguer un
  battant d'un coulissant/rideau. Joués une seule fois, au DÉBUT d'une
  ouverture depuis l'état fermé (jamais à la fermeture).
- **Le déterminisme est préservé** : la pose des portes est un calcul pur
  (progression 0..1 × géométrie), pas un tirage. Les débris de vitre cassée
  et la bouffée de givre, eux, utilisent `Math.random()` — cosmétiques,
  vivent dans `render/fx.ts`, hors du pas fixe, même statut que les gibs/
  débris de prop ([ADR 0018](0018-physique-jouet-debris-cosmetiques.md)).
- **`docs/reference/conventions-nommage.md`** documente l'API complète des
  extras (`mouvement`, `charniere`, `angle`, `sens`, `course`, `duree`,
  `auto`, `referme`, `delai`, `groupe`, `portee` pour `door_*` ; `solide`,
  `pv`, `givre` pour `vitre_*`).

## Comment on saurait qu'on a eu tort

Si un vantail `auto` bloque encore le passage d'un ennemi après le bake du
graphe de navigation (un chemin calculé qui longe un mur au lieu de
traverser une porte automatique fermée au chargement), c'est le signe que
`autoGroupColliders`/le bake temporaire dans `session/spawning.ts` ne
couvre pas un cas réel — vérifier en premier qu'un `groupe` n'a pas été
oublié sur l'un des deux vantaux d'une porte double (un seul membre `auto`
suffit à rendre tout le GROUPE passant, mais si les deux membres ne
partagent pas le même `groupe`, seul celui marqué `auto` est réellement
neutralisé, l'autre resterait bloquant).

Si une vitre cassée par un tir ennemi surprend en jouant ("pourquoi ma
vitre a explosé, je n'ai pas tiré dessus"), c'est le signal que l'effet
Duke Nukem est trop fréquent pour rester lisible — resserrer le jitter
d'attaque plutôt que de retirer l'effet, qui reste la demande explicite du
contrat.

## Révision du 2026-09-19 (soir) — le coût de rendu, mesuré

Cette décision a été prise avant de mesurer le niveau v2 réel. Trois chiffres
ont suivi, tous pris dans le jeu (`cassandre.renderBench`, caméra posée à la
main à chaque point de vue) :

1. **Vingt vantaux coûtaient jusqu'à treize lots de dessin dans une seule
   vue** (le bout nord du hub). Ils sont désormais regroupés par MATÉRIAU dans
   un `BatchedMesh` (`batchDoorMeshes`, un lot par matériau pour tout le
   niveau, élimination par vantail conservée) : six lots pour les vingt
   vantaux. Le mesh d'origine reste dans la scène, caché — c'est toujours lui
   qui porte la pose, `DoorSystem.interpolate` la recopie dans le lot.
2. **Le verre découpé par cellules de 48 m coûtait six lots** au spawn du
   parking. La découpe en cellules sert à écarter du rendu de gros lots hors
   champ ; tout le verre du niveau pèse quelques centaines de triangles.
   `mergeVitreDecor` ne découpe donc plus : un lot par matériau, un seul pour
   le niveau entier.
3. **Les `use_*` n'avaient aucun élagage** : vingt-et-un ramassages dessinés
   ensemble depuis les caisses, dont une trousse à 150 m large de deux pixels.
   `render/useObjectCulling.ts` les élague à 48 m — plus loin que les 36 m des
   props, parce qu'une trousse est un signal de jeu et pas du décor.

Pire vue mesurée après ces trois corrections : **188 lots sur un budget de
200** (contre 219 avant, et 198 avant toute cette passe). Tableau complet et
méthode : [Ce que coûte une image](../systems/cout-de-rendu.md#ce-qui-ne-fusionne-jamais).

**Un défaut trouvé par le test du regroupement, pas par l'œil** :
`DoorSystem.interpolate` sautait un vantail dès que ses poses précédente et
courante étaient égales — donc dès l'arrivée en butée. La dernière pose écrite
restait alors une interpolation (`alpha < 1`) : un battant pouvait s'arrêter
trois degrés avant sa butée, ouvert comme fermé, pour toujours. Il écrit
maintenant la pose exacte une dernière fois (`settled`).
