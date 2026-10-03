---
title: Contrats détaillés du noyau et de ses adaptateurs
tags: [reference, core, audio, input, physique]
status: stable
updated: 2026-10-03
---

# Contrats détaillés du noyau et de ses adaptateurs

Cette page conserve les précisions migrées des commentaires de `src/core/`,
`src/physics/`, `src/app/` et `src/main.ts`. Elle complète les pages techniques
sans redéfinir leurs frontières.

## Organisation des contrats et adaptateurs

| Fichier | Responsabilité |
|---|---|
| `src/core/input/inputTypes.ts` | Actions, frames et formats d'enregistrement, sans runtime. |
| `src/core/input/inputBindings.ts` | Bindings par défaut, ordre, libellés et formatage. |
| `src/core/input/inputPersistence.ts` | Lecture et écriture du stockage de bindings. |
| `src/core/input/input.ts` | Capture DOM, verrouillage et consommation des entrées. |
| `src/core/input/recordingSchema.ts` | Validation du format importé, hors simulation. |
| `src/core/audio/audioTypes.ts` | Contrats de sons et événements sonores. |
| `src/core/audio/audioCatalog.ts` | Tables de routage et valeurs du mix SFX. |
| `src/core/audio/audioManifest.ts` | Schémas communs aux manifests SFX/voix et schéma des zones. |
| `src/core/audio/audio.ts` | Chargement et lecture Howler des SFX. |
| `src/core/effect/runtime.ts` | Fabrique du garde-fou synchrone, sans services du jeu. |
| `src/app/runtime/gameRuntime.ts` | Composition des services, runtime unique et runner lié. |
| `src/app/navigation/gameFlowTypes.ts` | États et événements du flux d'écran. |
| `src/app/navigation/gameFlowMachine.ts` | Construction de la machine et de son acteur. |

Les modules de contrat ne réexportent pas leurs voisins. Les consommateurs
importent chaque responsabilité à son emplacement.

## Entrées

`src/core/input/input.ts` conserve deux ensembles de fronts montants. Celui du pas
fixe est consommé une seule fois par action et survit aux images sans pas
fixe. Celui de l'affichage est lu sans consommation et vidé à chaque image.
Consommer le premier ne masque pas le second. `endFrame` doit donc rester
après l'interpolation, les effets et le rendu. Lire `wasJustPressed` dans le
pas fixe rendrait la simulation dépendante de la fréquence d'affichage.

Les événements DOM accumulent les entrées ; `beginFrame` remet seulement le
compteur de pas fixes à zéro. Les répétitions de clavier ne créent pas de
nouveau front tant que la touche reste tenue. La souris utilise les mêmes
ensembles sous les codes `Mouse0` et `Mouse2`. Son appui est ignoré hors
verrouillage du pointeur pour que le clic de verrouillage ne tire pas.
Le relâchement est toujours accepté, même après la perte du verrouillage.
Le menu contextuel du clic droit est empêché sur le canvas.

La visée lit et vide le delta souris une fois par image, avant les pas fixes.
`requestPointerLockNow` doit rester dans la chaîne synchrone du geste
utilisateur ; un refus du navigateur laisse le jeu fonctionner sans verrou.
`clearPendingEdges` enlève les fronts de menu sans enlever les touches tenues.

Les bindings sont chargés dès la construction du singleton, avant `attach`.
Le stockage JSON passe par Schema ; chaque binding absent ou mal typé retombe
indépendamment sur son défaut, sans invalider les autres actions.
Le stockage absent, inaccessible ou corrompu retombe sur les défauts.
L'échec d'écriture ne retire pas le binding gardé en mémoire. Une action
absente ou invalide conserve son défaut. `rebind` s'applique immédiatement,
persiste et ne résout pas les conflits entre actions. C'est un réglage, jamais
une opération du pas fixe. Le snapshot de tous les bindings est une copie.

`ALL_ACTIONS` fournit l'ordre commun de présentation. Les libellés humains
sont séparés des identifiants d'action. `formatKeyCode` enlève `Key` ou
`Digit`, affiche les touches spéciales et garde tout code inconnu tel quel.
Les libellés dérivent du code QWERTY, pas du glyphe physique sur AZERTY.
Les actions de debug sont absentes des bindings joueur. Les touches persistées
priment sur les défauts 1/2/3 pour pied-de-biche/pistolet/pompe.

Voir [Contrôles](controles.md), [Boucle et temps](../3-architecture/boucle-et-temps.md)
et [Rejeu](../4-technique/rejeu-et-determinisme.md).

## Rejeu et horloge

`InputFrame` représente l'entrée effectivement consommée au pas fixe :
jump, fire, changements d'arme et use sont des fronts, les déplacements et
le sprint sont des états tenus. Yaw et pitch sont des angles en radians ;
dx et dy restent des diagnostics en pixels. Un éventuel tir automatique
relève du système d'armes, pas du contrat du champ fire semi-automatique.
L'appelant du rejeu restaure la position, la vitesse et la visée de départ.
Le recorder copie chaque frame et s'arrête à l'épuisement de la séquence.
`fixedDt` conserve le pas utilisé à l'enregistrement, en secondes.
L'import JSON valide par Schema la version 1, les vecteurs et nombres finis,
le pas strictement positif et tous les booléens de frames. Il conserve les
champs supplémentaires. Le format valide reste inchangé ; les payloads
malformés échouent à l'import, avant tout accès au pas fixe.

`GameClock.tick` avance l'horloge avec le pas fixe et retourne un delta de
gameplay réduit pendant le hitstop. La physique garde son pas fixe brut.
`reset` rétablit l'horloge neutre pour la nouvelle partie.
`RollingP95` réutilise ses buffers pour conserver une fenêtre bornée et
mesurer le percentile sans allocation de buffer à chaque échantillon.

`LoopStats.gameplayMs` et `physicsMs` somment tous les pas fixes de l'image.
`renderMs` décrit l'image précédente car sa durée n'est disponible qu'après
son rendu ; `alpha` est le reste de l'accumulateur divisé par le pas fixe.
Zéro pas dans une image à haute fréquence d'affichage est normal.
Le gameplay précède `world.step` pour que la translation kinématique cible
soit appliquée pendant le même pas. Le clamp de 0,25 s évite la spirale de
rattrapage après un blocage.

## Chargement et orchestration

`src/core/loading/loadingProgress.ts` utilise un canal indépendant du store HUD :
il existe avant la session, n'est pas remis à zéro avec le HUD et n'est pas
limité à 10 Hz. La progression représente le chargement entier ; l'appelant
connaît la part de chaque étape. `beginLoading` ouvre une séquence ; après
`finishLoading`, les publications d'un hot reload ne rouvrent pas l'écran.
Un retry se résout une seule fois malgré plusieurs clics.

`letBrowserPaint` attend deux requestAnimationFrame : la première laisse
React commettre le rendu et la seconde laisse le navigateur le présenter.
Les constructions synchrones de colliders et de navigation peuvent bloquer
le fil principal ; sans ce relais la nouvelle étape ne serait visible
qu'après le travail, donnant l'impression d'un chargement figé.

`src/app/navigation/bootChoice.ts` ne pilote pas l'acteur de flux. Le menu principal
lance niveau_v2 ; le choix des zones et blockouts est un outil de développement.
Une URL level enregistrée utilise sa définition ; une URL inconnue reste
une fixture glTF brute. Cette URL court-circuite le menu aussi en production.
Les fallbacks sur la première entrée servent au typage du registre.

`src/main.ts` vérifie l'aperçu UI de développement avant toute construction
physique ou de session. Il installe les gains audio avant les Howl et les
réglages graphiques avant le menu. Le filtrage et la résolution, qui exigent
le moteur, sont enregistrés avant le premier boot de session pour servir
à toutes les textures futures, y compris après replay et hot reload.
Un acteur de flux unique vit pour tout l'onglet. La perte du verrouillage du
pointeur fait passer playing à paused : Échap ne livre pas nécessairement
un événement clavier à la page, donc pointerlockchange est le signal fiable.

Le moteur persistant se construit avant la session et ne la construit pas
lui-même. L'orchestrateur attend le premier commit glTF réussi avant de
jouer : la pose transitoire avant spawn ne doit pas tomber dans une scène
vide. Un échec reste sur l'écran de chargement avec retry. App se monte
après la construction du moteur pour que ses commandes ferment sur lui.
Les ressources réseau/WASM restent à la frontière asynchrone du boot.

La vue CCTV substitue la pose caméra pendant un seul rendu et la restaure
dans un finally, même si le rendu lève. Les matrices sont ensuite rafraîchies. Elle réutilise le même render target 640×360. Ses vectors et
quaternions scratch sont créés avant la boucle. Le grésillement d'overlay
suit le delta d'affichage réel, pas le hitstop. La console cassandre reste
un outil de développement absent de production.

L'origine de l'orchestrateur mince est conservée dans
[l'historique de session](../archive/systems-session.md#origine-des-modules-gamesession).
Voir aussi [Cycle de vie](../3-architecture/cycle-de-vie.md).

`createSessionFlow` garde une seule transition de replay ou retour au menu
en cours. Un second appel pendant cette transition partage sa promesse ;
il ne détruit pas une deuxième fois le monde ni ne construit une session
concurrente. Le verrou se libère dans finally, y compris après un échec.

## Adaptateurs audio

Les identifiants SfxId nomment les événements du jeu, les clés de sprite
nomment les recettes. Une nouvelle entrée nécessite son type et sa table,
ainsi que la table de matériau si nécessaire. Le manifeste généré contient
les sources et les couples début/durée en millisecondes ; il se régénère par
le studio et ne s'édite pas à la main. Le gain effets multiplie chaque lecture,
le gain général et la coupure globale couvrent tous les canaux.

Volume et pitch se posent sur l'identifiant de lecture, jamais sur tout le
Howl : les neuf plombs du pompe ne doivent pas modifier les lectures déjà
en cours. Le pool par défaut de douze couvre ces chevauchements. Le pitch
varie de ±8 % par défaut ; les armes enregistrées utilisent ±2,5 à 4 % pour
éviter une variation de calibre perceptible. Une clé absente du sprite est
signalée au chargement, une fois, puis la lecture reste non fatale.
`listSfx` inspecte les clés du manifeste, pas la disponibilité réelle du son.

Les choix timbraux de la table distinguent télégraphie, arme ennemie,
soin et munitions. La télégraphie est jouée avant l'attaque et garde son
volume de base de 1. Les soins courts restent sous cette alerte. Les sons de
porte distinguent battant, coulisse/descend et rideau monte ; l'appelant
les joue au début de l'ouverture, pas en boucle ni à la fermeture.
La casse bois/carton partage son craquement ; le verre son bris ; le métal
son impact. Les matières farine, eau et électronique réutilisent des timbres
existants : papier sec, liquide et métal. Les matières inconnues retombent
sur béton pour l'impact et bois pour la casse. Ce sont des chaînes libres,
pas des dépendances de l'adaptateur sur les types de matières du niveau.

Les manifestes SFX et voix passent par le même Schema à la frontière réseau.
Les sources sont une liste non vide de noms ; chaque sprite porte un offset
fini positif ou nul et une durée strictement positive. Le pool facultatif
est un entier positif. Le format Howler reste inchangé. Les champs inconnus
comme _note sont conservés. Une erreur de validation rejoint le même
avertissement non fatal qu'un manifeste absent.

Le Schema d'ambiance valide aussi les boîtes à bornes ordonnées, les boucles,
les listes d'événements et l'existence de la zone par défaut. Il conserve
les métadonnées espace des boîtes. Ces validations tournent pendant le
chargement, jamais dans le pas fixe ni à chaque mise à jour du mix.

Les voix utilisent un sprite distinct, une seule lecture à la fois et aucune
variation de hauteur pour conserver le personnage. Les choix de réplique
appartiennent au gameplay ; le module Howler ne connaît que la clé de prise.
Le gain voix s'applique immédiatement, la durée vient du manifeste.

Le préchargement est idempotent et non fatal pour un fichier absent.
`audioPreparation.ts` reprend Web Audio dans un geste utilisateur et évite
l'auto-suspension entre deux actions. Il amorce les voix en silence sans
consommer de RNG. Les ambiances de zone gardent une nappe par zone,
une respiration et des événements espacés de 6 à 14 s. La boîte de plus
petite surface horizontale prime dans un chevauchement. Hors des boîtes,
la zone précédente reste sélectionnée. Le fondu interzone a tau = 0,7 s ;
les fichiers de nappes exposent leur région bouclée en millisecondes.

`resetZoneAmbienceSession` remet l'horloge à zéro, le premier délai à 6 s,
la zone à null et les enveloppes au silence. Il arrête les sons ponctuels
et installe un nouveau flux RNG dédié. `stopZoneAmbienceSession` applique
le même silence à la destruction de la partie. Les gains de réglage et
les fichiers déjà chargés restent conservés. La lecture des nappes continue
en silence : sa position audio ne fait pas partie de l'état de session.
En pause, au menu et pendant le chargement, l'horloge, la zone et le délai
restent figés ; seules les enveloppes finissent leur fondu vers zéro.
Ces choix sont de présentation et n'ajoutent aucun tirage au RNG de gameplay.

L'ancien commentaire qui disait « tout est synthétisé » et « les répliques
restent du texte » décrivait un état antérieur, pas le runtime actuel.
Le rejet des premières passes CC0 et la comparaison de timbre à 0,976 sont
conservés dans [l'archive audio](../archive/systems-hud-audio.md#pourquoi-la-synthèse-et-pas-des-enregistrements).
Le remplacement de la nappe unique jugée monotone appartient au chantier
audio du 2026-10-02 ; le runtime courant utilise les zones.

Voir [Audio runtime](../4-technique/audio-runtime.md).

## Mixage de l'eau

`waterAmbienceMix.ts` reste pur et indépendant de Howler, du DOM et de Three.
Les vecteurs minimaux acceptent Vector3 par structure. Le mélange s'écrit
dans out et retourne ce même objet ; l'appelant réutilise son scratch.
Le gain est plein jusqu'à 1,5 m et muet après 11 m. Le smoothstep a une
dérivée nulle aux deux bornes, évitant une cassure de pente audible.
Les gains s'additionnent puis plafonnent à 1,6, soit environ +4,1 dB :
plusieurs jets s'entendent davantage sans doubler le niveau de deux jets.
Le pan du jet dominant est projeté sur listenerRight, supposé unitaire
et horizontal, et plafonne à ±0,55. On ne normalise que cette direction.
Un jet confondu avec l'auditeur ou aucun jet donne un pan centré.

Le lissage exponentiel dépend de dt et de tau, jamais d'un coefficient
fixe par image. Tau inférieur ou égal à zéro rejoint immédiatement la cible.
Le gain d'eau est lissé sur 50 ms, le pan sur 90 ms pour éviter les sauts
entre oreilles. Un seuil de 0,01 impose le silence exact car le lissage
n'atteint jamais mathématiquement zéro. Avec un volume crête de 0,35 et
le plafond 1,6, l'eau reste à 0,56 sous les alertes et ramassages. La douche
utilise respectivement 0,3, 60 ms et 90 ms.

Une seule boucle Web Audio est amorcée par module et reste active à volume
nul en l'absence de source ; HTML5 ne fournit pas le panoramique attendu et
peut produire un raccord audible. Hors partie active, la cible est le silence.
Le remplacement des sanitaires au rechargement vide les origines et provoque
le même fondu sans traitement dédié. Le debug d'eau expose le mélange même
si l'asset manque, sans prouver à lui seul que le son est audible.

## Physique et services

Les groupes Rapier combinent appartenance sur les seize bits de poids fort
et filtre sur les seize bits de poids faible. Les interactions exigent la
compatibilité dans les deux sens. Les débris ne touchent que le monde pour
ne pas bloquer les tirs. PROP reste séparé de WORLD pour que navigation
cuite et visibilité filtrée sur le décor ne dépendent pas de mobilier mobile.
Les tirs ennemis ne rencontrent pas les props : leur perception ignore ces
objets et ne saurait expliquer une balle bloquée par eux.

`configureCharacterController` est séparée de la fabrique pour rejouer les
valeurs de déplacement à chaud. La gravité verticale se lit sur le monde
Rapier, jamais sur une seconde constante. Rapier ne peuple sa broad-phase
qu'après un step ; un pas nul rend les nouveaux colliders interrogeables.
Son timestep est restauré dans finally même si le rafraîchissement lève.

RaycastService reçoit PhysicsWorld à chaque appel : ce monde se construit
après le runtime et le WASM asynchrone, et la Layer de test peut fournir des
résultats sans monde Rapier. Les rayons/formes scratch viennent de l'appelant.
Le service expose les mêmes filtres que Rapier. Les intersections de forme
retournent un tableau et leur callback continue jusqu'au dernier collider.
La Layer de test renvoie par défaut null ou tableau vide et accepte des
overrides par méthode. Toutes les méthodes de requête sont synchrones.

`src/app/runtime/gameRuntime.ts` héberge GameLayer, qui compose tous les services ; la Layer de Pathfinding reçoit la
Layer canonique de Raycast par injection. GameRuntime est unique pour tout
l'onglet. Les générateurs forSeed sont indépendants pour que leur ordre
d'appel n'entrelace pas les consommateurs. Leur next reste une fonction
synchrone brute dans les boucles de tirs. Le runner est construit par
`src/core/effect/runtime.ts::createGameplayRunner`, qui reçoit le runtime sans
importer ses services. runGameplaySync doit laisser
remonter toute erreur ; une suspension est signalée explicitement.
Voir [Effect et XState](../3-architecture/effect-et-xstate.md).
