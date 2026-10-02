# Changelog

Toutes les versions notables de PROJET_CASSANDRE. Format inspiré de
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), numérotation
[SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Retiré

- La musique de thème : la piste, la touche `M`, le canal « Musique » et
  l'interrupteur de l'onglet Options › Audio. Les ambiances de zone et les
  répliques du héros suffisent.

## [1.0.0] — 2026-10-02

Première version publique : le MVP jouable, publié en open source sous
licence MIT.

### Jeu

- **Le niveau v2, l'hypermarché** : un hub à la Duke Nukem 3D en dix espaces
  (parkings, galerie, caisses en six travées, rayons, électroménager, réserve,
  souterrain, bureaux), les coulisses (vestiaires, fournil, boucherie, SAV,
  PC sécurité), trois cartes de fidélité comme clés, quatre secrets.
- **Trois armes** en vue subjective — pied-de-biche, pistolet, pompe —
  ramassées en marchant dessus.
- **Deux ennemis** en sprites pré-rendus 8 directions : le Costard et le
  Directeur (boss), machine à états partagée, pathfinding 2.5D.
- **Monde interactif** : portes animées, vitres cassables, props physiques
  poussables et destructibles, sanitaires utilisables, écrans animés,
  caméras de surveillance, nourriture et trousses de soin.
- **Habillage** : HUD « stream » avec portrait réactif du héros, menus,
  pause, écran de mort, récapitulatif de fin, options d'affichage, de
  contrôles et d'audio.
- **Son** : effets et répliques du héros voisées (ElevenLabs), une ambiance
  par zone, studio sonore procédural dans `tools/audio/`.

### Technique

- Boucle à pas fixe 1/60 orchestrée par Effect, rendu interpolé, rejeu
  d'input déterministe (F9/F10).
- Rendu rétro 640×360 upscalé, éclairage hybride (lampes du niveau + bake en
  vertex colors), fusion du décor en lots au chargement.
- Pipeline Blender → glTF piloté par les commandes `cassandre`, validation
  et audit automatiques du niveau.
- Déploiement continu sur GitHub Pages ; le build embarque
  `THIRD_PARTY_LICENSES.txt`, les licences des dépendances incluses.

[1.0.0]: https://github.com/benjiGir/projet-cassandre/releases/tag/v1.0.0
