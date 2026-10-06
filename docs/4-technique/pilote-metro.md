---
title: Pièce pilote du métro — N4
tags: [metro, blender, rendu, audio]
status: brouillon
updated: 2026-10-06
---

# Pièce pilote du métro — N4

## Responsabilité et frontières

Vous pouvez juger le kit dans le moteur avec le raccourci
`?level=pilote_metro`. Cette entrée est réservée au développement.
[La page de revue](../assets/pilote-metro.html) ouvre le même jeu et propose
six points de vue, les captures et les nappes à écouter.

Le pilote contient une station de 24 m, deux quais de 5 m, deux voies,
une rame garée, puis un tube de **60 m** à cinq refuges et un local de service.
Il sert à juger proportions, matériaux, éclairage et ambiance.
Le tracé complet N2, le quartier et la campagne restent dans leurs lots.
Les trains mobiles relèvent de T2 ; les rencontres du niveau relèvent de N7.

## Fichiers

| Responsabilité | Source / sortie |
|---|---|
| Assemblage | `tools/metro/pilot/build_pilot.py` |
| Recette | `tools/blender/cassandre.py`, commande `metro_pilot` |
| Bibliothèque | `assets_src/library/lib_metro_N3.blend` |
| Scène | `assets_src/blender/metro_pilote.blend` |
| Runtime | `public/assets/levels/metro_pilote.glb` et `public/assets/levels/metro_pilote.espaces.json` |
| Catalogue | `src/game/level/catalog/levels.ts` |
| Émission des tubes | `src/render/environment/metro/metroFixtures.ts` |
| Ambiances originales | `tools/audio/metro_ambiances.py`, sorties `public/assets/audio/metro_pilote/` |
| Captures locales | `tools/probe/pilotCapture.ts`, utilisé par `vite.config.ts` |

## Place dans la boucle

Le pilote suit le chargement glTF habituel : import, colliders Rapier,
graphe de navigation, portes, matériaux Lambert et pool de lampes.
Il ne crée pas une boucle de jeu supplémentaire.

`LevelDef.scenarios` sélectionne les scénarios propres au niveau.
Un objet vide laisse le pilote sans scénarios de combat ; une valeur absente
conserve le registre historique du magasin. Le chargeur et le pas fixe
utilisent le même registre. Les erreurs de référence restent signalées.

La porte au fond utilise `door_pilote_service` et son bouton
`use_pilote_service`. **E** ouvre le vantail ; il peut être refermé à la main.
Le mouvement et l'interaction passent par les systèmes existants.

## Données et contrats

Repère Blender : X transversal, Y longitudinal, Z vertical.
La station occupe X 0–18, Y 0–24. Le tube occupe X 4,75–9,25,
Y 24–84. Les niches sont à gauche, centrées en Y 30, 42, 54, 66 et 78.
Le petit local de maintenance prolonge le tube jusqu'à Y 88.

Le quai est à 0,75 m au-dessus du rail. Une descente de trois marches,
giron 0,5 m, relie son bord à la voie. Les niches offrent
3 × 1,5 × 2,75 m libres au-delà de la paroi.

Les colliders de toiture du kit sont écartés à l'assemblage. Le graphe 2,5D
prendrait leur dessus pour le sol ; les plafonds restent visuels, comme dans
les scènes actuelles du magasin. Le tube n'est pas un gabarit 3D de train
déjà validé. Les contacts en courbe et les prolongements de voie restent T2/N5.

### Matériaux et lampes

Le niveau utilise le mode **hybride** existant : ambiante 0,18, lumière
directionnelle éteinte, **29 marqueurs de lampes** lus par le pool de 48.
Il conserve le rendu 640 × 360, Lambert et le nearest à l'agrandissement.
Les textures réduites gardent les mipmaps et l'anisotropie du moteur.

Les matériaux `metro_lampe` et `metro_signal` conservent leur émission à
l'import Lambert. Les autres matériaux du magasin ne sont pas concernés.
Les couleurs `Col` du kit sont initialement blanches : l'éclairage de ce
pilote provient des lampes, **pas d'un bake Cycles déjà livré**.

Les huit luminaires du quai portent deux tiges d'acier de 7,5 cm de section
chacun. Leurs platines suivent la pente de la voûte facettée ; la longueur
des tiges est calculée depuis le dessus du luminaire jusqu'à cette surface.
Ces suspensions sont du décor sans collider.

Le PNG des textures doit porter des valeurs **sRGB encodées** ; les
matériaux unis portent des valeurs linéaires. N4 corrige le générateur N3
qui écrivait les couleurs linéaires dans les PNG. Le moteur les décodait
une deuxième fois, ce qui assombrissait fortement le béton et le sol.

### Flancs de rame

Après le retour utilisateur sur N4, les deux voitures du kit ont de vrais
emplacements latéraux de portes : Y 4,5–6 et 9,5–11 m, de chaque côté.
Les panneaux bas, la frise et les fenêtres s'interrompent à ces emplacements.
Chaque porte fermée possède deux vantaux, un joint central, deux vitres
indépendantes et un encadrement. Aucun panneau opaque ne couvre une vitre.
La frise fait partie des panneaux : elle n'est plus superposée sur une face
de carrosserie identique. Les colliders ferment toujours les portes ;
ce correctif ne les transforme pas en portes animées.

### Ambiances par niveau

`LevelDef.ambience` désigne un dossier sous `assets/audio/`.
`bootGameSession` attend sa préparation à la frontière asynchrone.
La valeur absente conserve le dossier historique `ambiances` ; le pilote
utilise `metro_pilote` et son manifeste indépendant.

`initZoneAmbience` conserve les profils préparés en cache. Un changement
de profil remet à zéro et rend muettes les anciennes enveloppes. Un compteur
de sélection empêche une préparation ancienne de remplacer la plus récente.
Le reset de partie réinstalle le RNG déterministe existant et remet les
événements au début. Un événement partagé entre zones n'est chargé qu'une fois.
Les nappes naissent au volume zéro. L'enveloppe attend l'événement Howler
de début de lecture avant d'appliquer les volumes : tant que le navigateur
attend un geste utilisateur, aucune file de volumes ne s'accumule.

La nappe du quai contient un bourdon et un souffle plus large ; celle du
tunnel est plus grave. Les événements sont une résonance métallique et une
goutte à échos. Ils reprennent les gains, le fondu et les tirages du lecteur
Howler existant. Aucun nouvel appel réseau de génération n'est effectué.

Les nappes durent 20 s et portent 0,5 s de marge de chaque côté.
Howler boucle la région `[500, 20000, true]` pour éviter les bords d'encodage.
Les deux formats OGG et M4A sont livrés. Le générateur choisit libvorbis si
disponible, sinon l'encodeur Vorbis natif de FFmpeg.
[Mesures après décodage](../assets/pilote-metro/audio-mesures.json) et
[spectrogrammes](../assets/pilote-metro/audio-spectres.png).
La mesure ne remplace pas votre écoute au casque.

### Captures du moteur

La page de revue pilote l'API de développement par ses boutons.
Elle rend une image avant de lire le canvas, puis propose la capture.
Le serveur de développement accepte uniquement six noms de vue,
un PNG et un corps de 2 Mio au plus. Il écrit sous `renders/metro_n4/`.
Ce point d'entrée n'existe pas dans le build de production.

Le [relevé des quatre captures conservées](../assets/pilote-metro/captures.json)
provient du moteur après la correction sRGB. Les animations ne sont pas
figées : les hashes identifient les images sans valider le déterminisme.

## Pièges

- Le kit N3 est une bibliothèque, pas une scène de jeu. La recette copie
  ses meshes avec les transformations figées et exclut `_LIB` de l'export.
- L'atelier N0 et le niveau complet futur gardent leurs sorties distinctes.
- Les images Blender servent à relire l'assemblage. Le rendu du navigateur
  est la référence pour la lisibilité dans le moteur.
- Les chiffres de lots et de triangles sont des relevés de pose ; ils ne
  constituent pas un verdict de performance sur toutes les machines.

## Tests

Aucune suite de tests automatisés n'est ajoutée ni exécutée dans ce lot.
Le build, le contrat Blender et les vues réellement rendues sont relevés
dans le [journal N4](../journal/metro-pilote-2026-10.md).
Le gate humain reste ouvert jusqu'à votre jugement du pilote et du son.

## Comment vérifier

### Recette Blender

Depuis une session neuve :

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  -P tools/blender/cassandre_cli.py -- metro_pilot
```

Pour les ambiances, utilisez un Python avec NumPy et Pillow, puis FFmpeg :
`tools/audio/metro_ambiances.py`. Le script ne reconstruit pas les ambiances
du magasin. La recette Blender sauvegarde, exporte et rend trois vues.

### Relecture utilisateur

1. Ouvrez la page de revue, puis cliquez dans le jeu pour marcher.
2. Descendez du quai par les marches et avancez de refuge en refuge.
3. Ouvrez la porte de service avec E, puis revenez sur le quai.
4. Jugez la clarté du quai, la lecture des niches et le contraste du fond.
5. Écoutez le changement d'ambiance et les raccords de boucle au casque.
