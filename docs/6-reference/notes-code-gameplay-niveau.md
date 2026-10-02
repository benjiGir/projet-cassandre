---
title: Contrats de chargement et des objets de niveau
tags: [gameplay, niveau, gltf, rapier, code]
status: brouillon
updated: 2026-10-02
---

# Contrats de chargement et des objets de niveau

## Chargement et ressources

Le loader lit les extras Blender et expose un handle du niveau : racine, corps,
spawns, objets interactifs et statistiques. Le nom d’origine est dans
`userData.name`, car GLTFLoader peut assainir les noms. Les extras exposés retirent
ce nom réservé. Le parcours utilise une liste figée avant mutation de la hiérarchie.
Les matrices monde sont mises à jour avant toute extraction.

`col_box_*` impose un cuboid, `col_hull_*` un hull et `col_mesh_*` un trimesh.
Un `col_*` générique choisit cuboid si sa géométrie locale est une boîte, sinon
trimesh. Les sommets de hull/trimesh sont transformés en espace monde ; le corps
reste à l’origine. Les cuboids portent translation et rotation monde, et des
étendues mises à l’échelle. Un hull dégénéré retombe bruyamment sur un trimesh.
Une géométrie manquante ou vide est ignorée avec erreur ; 50 000 triangles est
un seuil d’avertissement, pas un rejet. Les colliders sont masqués au rendu.

Un `spawn_player` absent ou en double est signalé. Seul le premier est retenu.
L’orientation est déduite du vecteur avant glTF −Z. Les spawns ennemis expriment
les pieds, puis la fabrique ajoute demi-hauteur et rayon de capsule.
Les triggers sont des boîtes locales. Les bornes de triggers/secrets utilisées
par le gameplay sont des AABB ; l’auteur du niveau doit éviter leur rotation.
Les propriétés numériques positives sont lues avec un repli documenté et un
avertissement. `pv` absent signifie indestructible, pas zéro PV.

La reconversion Lambert conserve texture, couleur, transparence et COLOR_0.
Les textures suivent le mode rétro courant, y compris après hot reload.
Les lumières `light_*` sont des points avec leurs extras intensité/distance/decay.
Le rig global dépend du mode du niveau : temps réel, bake ou hybride. L’hybride
n’ajoute pas de soleil ; une ambiante faible laisse une place aux lampes locales.

Les corps et ressources GPU appartiennent au niveau. `LevelResources` est acquis
avec son finalizer avant la construction ; il suit les corps avant leurs colliders
et les ressources GPU dès leur création, y compris les temporaires de fusion.
Les ressources explicitement disposées sont retirées du suivi. Un échec ferme
le Scope manuel ; le succès garde une fermeture idempotente par le handle. Le hot reload sérialise les chargements, suspend
l’ancien niveau pendant la préparation et le restaure en cas d’échec. `stop`
attend la tentative en cours avant de libérer le monde qui la reçoit. La première
promesse de chargement publie un résultat discriminé ; `ready` représente un
premier succès et peut rester pendante après un échec initial.

Le polling HEAD tourne uniquement en dev, sur une fibre Effect, avec etag,
last-modified ou content-length comme signature. Un changement lance un reload,
une seule tentative simultanée. Les spawns et ennemis ne sont recréés qu’au
premier chargement ; les systèmes de décor sont reconstruits à chaque commit.
La génération d’installation protège une session détruite ou remplacée.

## Fusion et poses

Le décor immobile est fusionné par matériau, attributs et cellule de 48 m. Les
meshes multimatériaux, skinnés, instanciés, morphés, à enfants ou échelle négative
ne sont pas fusionnés. Le matériau partagé doit avoir les mêmes paramètres qui
influencent le dessin. La géométrie fusionnée est ramenée dans l’espace de racine.
Les enfants de porte, prop, use ou nœud animé restent mobiles et hors fusion.
Les filets de douche sont exclus du décor afin de rester activables.

Les portes sont regroupées dans des `BatchedMesh` par matériau et attributs.
Leur mesh de référence conserve pose et géométrie ; seule sa représentation
individuelle est masquée. Un vantail avec enfants reste individuel pour emporter
sa vitre. Les vitres enfants de portes restent elles aussi hors fusion statique.
Les lots de vitrages/sanitaires conservent une plage de sommets par objet.
La casse réduit uniquement cette plage à un point, sans déplacer les suivantes.
Les bornes du lot restent conservatrices après la casse.

La portée visuelle de 36 m correspond à environ quatre pixels pour un prop de
0,6 m à 640×360. Un corps qui vient de dormir doit encore publier sa dernière pose.
Un corps cassé reste désactivé plutôt que supprimé : réutiliser son handle avant
le teardown pourrait faire supprimer le corps d’un autre objet.

La pose physique d’un prop est au centre du cuboid, qui peut différer de l’origine
du mesh. La matrice visuelle compose pose monde, scale et translation négative du
centre local, puis applique l’inverse de la racine. Cet ordre évite un décalage
qui tourne avec le prop. Un prop hors portée est masqué ; sa réapparition force
une interpolation, même s’il dort depuis sa disparition. La présentation ne
change pas les corps Rapier et ne doit pas prendre la pose interpolée pour origine
de tir ou de pickup.

## Portes

Les mouvements sont descendant, montant, battant et coulissant. Les valeurs de
repli restent dans `parseDoorConfig`. Une charnière provient du grand axe local,
à l’extrémité min ou max. L’ouverture automatique choisit le signe qui s’éloigne
de l’ouvreur, à partir du pivot et de la direction du bord opposé. La pose battante
utilise une rotation pré-multipliée dans l’espace racine ; le pivot tient compte
du scale. Une coulisse suit son axe local tourné dans l’espace de racine.

Le collider reste toujours à la pose fermée. Il est désactivé dès l’ouverture
et réactivé seulement à fermeture complète. À la fermeture, une capsule acteur
qui chevauche cette pose provoque la réouverture plutôt qu’un enfermement.
La portée automatique est horizontale avec une tolérance verticale de 2 m.
Le groupe combine portée/délai/durée maximaux, présence d’automatisme, et referme
seulement si tous les membres le permettent. L’ouverture à carte est permanente ;
l’action manuelle peut annuler cette permanence. Les signes ne changent qu’à
l’ouverture depuis une fermeture complète, pour éviter une inversion en cours.

Le mode automatique réservé aux ennemis évite qu’une porte refermée manuellement
se rouvre immédiatement devant le joueur. Une commande manuelle de fermeture
et un bouton hors de portée de l’autre côté permettent les coupe-feu à sens unique.

Les poses précédente/courante servent au rendu interpolé. Un vantail au repos
n’actualise plus la matrice de lot ; un lot déplacé recalcule sa bounding sphere
pour éviter la disparition hors champ. Pendant le bake navigation, seuls les
colliders de portes automatiques sont temporairement désactivés.

## Objets cassables et interactions

Les props sont dynamiques, poussables, avec masse 25 kg par défaut, frottement,
amortissement et CCD. Leur collider unique n’a pas de `col_*` jumeau. Le CCD évite
qu’une forte impulsion traverse un mur. La direction de l’impulsion est l’opposé
de la normale d’impact. À la casse, mesh, corps et collider sont désactivés mais
restent possédés par le niveau pour sa libération. Le contenu `nom:nombre` peut
créer des aliments, dispersés par un PRNG dédié. Les nouveaux pickups restent
jusqu’à ce qu’un soin soit accepté ; être à PV pleins ne les consomme pas.

Chaque système cassable suit son propre curseur d’impacts. Les tirs ennemis
peuvent briser directement vitres et sanitaires indépendamment de leur PV joueur.
Les vitrages non solides n’ont ni collider ni PV. Les vitrages au-dessus du sol
restent non solides pour que le bake ne prenne pas leur surface pour un étage. Les vitres affichent les deux
faces et ne réécrivent pas la profondeur, pour éviter l’occlusion transparente.
Les sanitaires cassés gardent une origine de jet sans collider ; la visée du jet
est une boîte de 0,6 m de largeur et 1,5 m de hauteur, testée avant l’obstacle monde.
La lecture positionnelle des jets remplit un tableau existant sans allocation.

Les interactions persistantes consomment des références de mesh dans un WeakSet,
pas des noms. La liste des objets est relue à chaque appel : la conserver après
un hot reload pointerait vers des meshes libérés. Un niveau rechargé crée donc des objets naturellement réutilisables.
La touche E choisit le plus proche à portée ; la visée sanitaire ne s’exécute
qu’après un E non consommé, puis une porte manuelle prend ce qui reste.
Les armes, munitions et soins se ramassent à 1,2 m en marchant. Un handler doit
accepter avant que le pickup soit masqué. Une carte est un objet interactif à E.
Les consoles à liste de caméras ont priorité sur les autres extras d’un use.

Un soulagement rend 10 % des PV max avec 220 s de délai global gameplay. À PV
pleins, il ne consomme pas ce délai. La chasse d’eau se joue même sans soin.
Une gorgée sur un jet rend 1 PV sans délai, et reste silencieuse à PV pleins.
La portée de visée 1,4 m exige de regarder de près, plus courte que le use à 2 m.
Le rayon sanitaire inclut WORLD seulement pour respecter murs et cloisons.

## Navigation

Les requêtes gardent le gabarit du Costard ; elles ne valident pas celui du Directeur.
Le graphe est une grille X/Z de 0,5 m qui garde un seul sol par cellule. Le bake
interroge WORLD, ignore props/ennemis et vérifie pente, espace debout et continuité.
Les rampes acceptent une différence de hauteur dérivée de leur pente ; les paliers
emploient l’autostep. Les arêtes sur paliers vérifient aussi le passage de la
capsule, pour empêcher les chemins à travers un angle de mur. Les diagonales
exigent les deux liaisons cardinales aux deux extrémités.

A* emploie huit directions et une heuristique octile. Les égalités sont départagées
par index de cellule pour garder le déterminisme. Une cellule bloquée recherche
une cellule praticable voisine sur six anneaux. Le chemin exclut la cellule de
départ sauf quand départ et cible sont identiques. L’échec est `PathNotFoundError`,
interprété comme absence de chemin par la poursuite. Le temps mural ne sert qu’à
mesurer les coûts A*, jamais à choisir un chemin.

## Écrans et douches

L’ordre des chaînes et des cellules correspond à `CHAINES` de
`tools/textures/generate_chaines.py`. L’atlas est dessiné depuis le haut, tandis
que V commence en bas : la conversion inverse cette origine verticale.

Les façades écrans possèdent un atlas 4×4 à cellules de 32 px, des UV normalisés
par écran et un track par chaîne. Les durées restent propres aux chaînes ; la
casse passe en neige/noir. L’animation avance au pas fixe avec le hitstop, et ne
réécrit les UV que si une frame change. La fusion conserve les plages et UV
normalisés de chaque façade, afin de ne pas animer ses voisines.

La douche crée un matériau TSL partagé par racine et un temps borné à 16 s.
Son bruit est un calcul shader déterministe, pas du RNG gameplay. Les filets
sont cachés jusqu’à la commande de leur poste. Avant le premier jeu et le commit
d’un nouveau niveau, le warmup les rend visibles hors culling, retire l’ancienne
racine du dessin, passe par `RenderService`, puis restaure visibilité, cible et
hiérarchie. L’origine d’ambiance est calculée une fois depuis le premier filet.

Une vue par caméra mémorise la liste par identité, le cap/pitch de départ et
l’index. E sur la même console avance l’index. Mouvement, saut ou visée dépassant
0,02 rad la quittent ; le corps du joueur n’est pas déplacé à la caméra.

## Pour aller plus loin

- [Contrats généraux](notes-code-gameplay.md)
- [Conventions glTF](../archive/reference-conventions-nommage.md)
- [Portes et vitrages](../decisions/0031-portes-animees-et-vitres.md)
- [Sanitaires utilisables](../decisions/0032-sanitaires-utilisables.md)
