---
title: Props dynamiques — un préfixe glTF et un groupe de collision à part
tags: [adr, physique, niveau, rendu]
status: accepte
updated: 2026-09-18
---

# ADR 0030 — Props dynamiques : un préfixe glTF et un groupe de collision à part

## Contexte

Le jeu n'avait aucun objet physique manipulable. Les seuls corps dynamiques
Rapier existants étaient la balle témoin de la gym et les `door_*` — ces
derniers dynamiques mais **verrouillés** en translation et en rotation, pilotés
par écriture directe de position. Tout le reste du niveau était des corps
`fixed`. Le décor destructible listé en Phase 5 (caddies poussables, bris de
verre du rayon surgelés) n'avait jamais été construit.

Demande de l'utilisateur : pouvoir détruire des objets et en bouger d'autres.

Quatre contraintes du projet encadraient la réponse :

- **Le budget de lots de dessin, mesuré à 200** pour tout le niveau, dont 186
  déjà consommés par le décor. Un objet qui bouge ne peut pas rejoindre un lot
  fusionné ([ADR 0023](0023-fusion-decor-au-chargement.md)) : il se dessine
  seul, pour toujours.
- **Le graphe de navigation et les lignes de vue ennemies sont calculés une
  fois, au chargement**, par des requêtes filtrées sur `GROUP.WORLD`
  (`WORLD_ONLY_RAY_GROUPS`, `entities/enemyMachine.ts` et `level/pathfinding.ts`).
- **La frontière Effect synchrone stricte** du pas fixe (invariant #11).
- **Le déterminisme du rejeu d'input** F9/F10 (invariant #12).

## Décision

**Un préfixe glTF `prop_*`**, lu par `level/loader.ts` comme tous les autres,
qui construit un **corps dynamique LIBRE** avec collider cuboid ; et un
**groupe de collision `PROP` séparé de `WORLD`**.

Les custom properties Blender décident du comportement : `masse` (kg), `pv`
(**absent = indestructible, seulement poussable**), `matiere` (son de casse et
couleur des débris). Tout se règle dans le `.blend`, rien dans le code.

L'état de partie (PV courants, destruction, poses interpolées) vit dans
`PropSystem` (`game/level/props.ts`), reconstruit à chaque chargement au même
titre que le graphe de navigation et le pool de lampes.

### Pourquoi un groupe `PROP` et pas `WORLD`

C'est la seule décision réellement difficile du lot, et elle se joue entre deux
comportements également défendables.

Un prop en `WORLD` serait heurtable par tout le monde sans une ligne de code —
c'est ce que fait la balle de la gym. Mais il entrerait aussi dans le bake du
graphe de navigation et dans les rayons de ligne de vue ennemie. Or ces deux
résultats sont calculés **une fois pour toutes au chargement**, et un prop
**bouge** : un caddie poussé laisserait derrière lui un trou de navigation
fantôme et un bloqueur de vue fantôme, tous deux invisibles au débogage.

`ENEMY_SHOT` est volontairement **absent** du filtre de `PROP` : une balle
ennemie traverse les props. L'inverse produirait un ennemi qui vide son
chargeur dans une caisse qui ne bloque même pas sa ligne de vue.

Conséquence assumée : **un prop ne protège pas**. Il se pousse, il se casse, il
gêne le déplacement — il n'est jamais une couverture.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| **Réutiliser `GROUP.DEBRIS`**, déjà réservé et inutilisé | Son filtre ne contient que `WORLD` : il ne collisionnerait ni avec le joueur ni avec les ennemis, exactement ce qu'on veut ici |
| **Mettre les props en `WORLD`** (comme la balle de la gym) | Navigation et lignes de vue périmées dès le premier objet poussé, sans aucun signe visible — voir ci-dessus |
| **Rebaker le graphe de navigation quand un prop bouge** | Le bake est un balayage complet du niveau, de l'ordre de la seconde : impossible dans un pas fixe |
| **Vrais morceaux Rapier à la destruction** (une caisse en six planches) | Revient sur l'[ADR 0018](0018-physique-jouet-debris-cosmetiques.md), et chaque morceau est un corps de plus ET un lot de dessin de plus. Les débris restent de la physique jouet cosmétique |
| **Retirer le corps du monde à la destruction** (`removeRigidBody`) | `loader.ts::disposeLevelResource` retire CHAQUE corps du niveau à la libération. Un corps déjà retiré libère son handle, que Rapier peut réattribuer entre-temps : la libération du niveau détruirait alors l'objet de quelqu'un d'autre. Le corps est donc **désactivé**, jamais retiré |
| **Rendre les props via `InstancedMesh`** pour tenir le budget | Gain réel sur N props identiques, mais la destruction demande de gérer les trous dans le tampon d'instances. À reprendre si le nombre de props devient le problème — il ne l'est pas à six |
| **Étendre `door_*` plutôt qu'un nouveau préfixe** | Une porte est verrouillée et pilotée par écriture directe de position ; un prop est libre. Deux comportements opposés sous un même nom |

## Le piège que ça ouvre, et comment il est fermé

`buildDoor` pose le corps d'une porte sur la **translation brute du mesh**, pas
sur le centre de sa boîte ([ADR 0012](0012-porte-collider-non-recentre.md)).
Sans conséquence pour un vantail verrouillé ; **fatal pour un corps libre**, qui
tourne autour de son centre de masse : avec l'origine-coin du kit du projet, un
caddie poussé tournerait autour d'un point situé hors de lui.

`buildPropEffect` pose donc le corps sur le **centre de la boîte englobante**,
conserve l'écart dans `PropInfo.centerOffset`, et le réapplique au rendu. Le
mesh est aussi reparenté sous la racine du niveau (`root.attach`, qui conserve
la pose monde) : un prop resté sous un groupe Blender hériterait de la
transformation de ce groupe **en plus** de celle que la physique lui écrit.

## Conséquences

- **Chaque prop DANS LE CÔNE DE VUE coûte un lot de dessin** — voir la révision
  ci-dessous, la première formulation de cette ligne était fausse.
- **Le déterminisme est préservé** : impulsions et dégâts dérivent des
  `HitEvent` du pas fixe, jamais d'un tirage. Les débris, eux, utilisent
  `Math.random()` — ils sont cosmétiques et vivent dans `render/fx.ts`, hors du
  pas fixe, comme les gibs.
- **`validate_level.py` et `audit_niveau.py` connaissent le préfixe.** L'audit a
  immédiatement trouvé un carton encastré dans le collider d'un caddie posé au
  hasard — un prop encastré ne reste pas encastré, il est violemment éjecté au
  premier pas de simulation.
- **La sensation reste à juger en jouant.** Pousser une caisse en marchant ne
  peut pas se mesurer depuis l'automatisation navigateur (verrouillage du
  pointeur hors de portée, limitation déjà connue du projet).

## Comment on saurait qu'on a eu tort

Si le fait qu'un prop **ne bloque ni les balles ennemies ni les lignes de vue**
se lit en jouant comme un bug plutôt que comme une convention — typiquement un
joueur qui s'abrite derrière une caisse et se fait toucher quand même. La
réponse ne serait alors PAS de remettre les props dans `WORLD`, mais d'ajouter
`PROP` au seul filtre `ENEMY_SHOT`, en laissant navigation et lignes de vue
intactes.

## Révision du 2026-09-18 — le modèle de coût était faux, et six props ne se trouvaient pas

Deux choses sont revenues du playtest, et la seconde a corrigé cette décision.

**« Je n'ai pas trouvé de physique dans le jeu. »** C'était exact. Les six props
du premier jet étaient tous dans deux espaces à l'écart (les allées des rayons,
la réserve) ; le hub — 48 m que le joueur est OBLIGÉ de parcourir — n'en portait
aucun, pas plus que le parking, la galerie, les caisses ou l'électroménager. On
pouvait traverser le niveau d'un bout à l'autre sans en croiser un.

Le placement passe donc par une table unique (`PROPS_PHYSIQUES` dans
`tools/level_v2/build_niveau.py`) qui couvre **les dix espaces**, avec la règle
qui manquait : *un prop doit être sur le chemin, pas dans une pièce qu'on peut
sauter*. Cinquante et un props, dont des PILES de deux ou trois — une pile qui
s'écroule dit « physique » bien plus fort qu'une boîte isolée au sol.

**Le modèle de coût annoncé ici (« un lot par prop VISIBLE ») était faux.** Il
avait été mesuré dans une pièce close, où un seul prop était dans le champ. La
mesure honnête est *un lot par prop dans le CÔNE DE VUE* : three.js n'élimine
que par le cône, jamais par occlusion. Le décor y échappe parce qu'il est
fusionné par cellule de 48 m ([ADR 0023](0023-fusion-decor-au-chargement.md)) ;
un prop, jamais — il est un mesh à part par construction. Résultat mesuré depuis
le spawn du parking, qui regarde l'axe long du magasin : **37 props sur 51
dessinés à travers tout le niveau, 210 lots pour un budget de 200.**

Correctif : **élagage par distance** dans `PropSystem.interpolate`
(`PROP_RENDER_DISTANCE_SQ`, 36 m — un carton de 0,6 m y fait quatre pixels de
haut en 640×360). Un prop qui revient dans la portée après avoir bougé hors de
vue voit sa pose réécrite une fois, sinon il réapparaîtrait à son ancienne
place. Coût après correctif, mesuré à trois points : **+6 lots à la galerie,
+8 au hub, +6 au spawn** — pour cinquante et un props au lieu de six.

Ce que ça change pour la suite : le nombre total de props n'est PAS le budget.
Ce qui compte est combien en tombent dans 36 m, donc la DENSITÉ locale. Un
espace peut en porter beaucoup ; c'est un tas dans un mouchoir de poche qui
coûte.
