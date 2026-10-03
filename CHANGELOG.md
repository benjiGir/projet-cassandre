# Changelog

Toutes les versions notables de PROJET_CASSANDRE. Format inspiré de
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), numérotation
[SemVer](https://semver.org/lang/fr/).

## [Non publié] — v1.1 « Le live »

Le niveau raconte une histoire. En attente du playtest.

### Ajouté

- Huit panneaux illustrés d'introduction et de fin, qu'on avance ou qu'on
  passe ; l'introduction se revoit depuis le menu.
- 37 répliques de première visite des lieux, en texte.
- Quatre moments scriptés qui ne retirent jamais le contrôle : l'annonce aux
  caisses, les écrans de l'atelier SAV, le quai, l'interphone du Directeur.
- Le direct : audience qui monte avec l'action et repart avec l'ennui,
  abonnés, dons, cagnotte et chat qui commente la partie. Le chat se masque
  dans Options › Audio.
- Un donateur mystère, qui revient à cinq étapes de la progression.
- Bilan du direct et bandeau « vidéo démonétisée » sur l'écran de fin.

### Modifié

- Le magasin a un nom, Hyper Varan, et le niveau un titre, « Inventaire
  exceptionnel ».
- Le viseur et les autres overlays ne se dessinent plus par-dessus les écrans
  de pause, de mort et de fin.

### Corrigé

- 40 tests des ennemis qui échouaient sur une récursion lors de la
  restauration d'état de debug.

### Technique

- Script de niveau : un `trig_*` lance un scénario nommé ou désigne une
  sous-zone à réplique (ADR 0037).
- Simulation du direct dans le pas fixe, avec son propre flux RNG (ADR 0038).
- Manifeste des espaces du niveau, tiré du plan de masse.
- Outils : `tools/level_v2/espaces_jeu.py`,
  `tools/textures/generate_panneaux.py`,
  `tools/blender/refresh_story_triggers.py`.

## [1.0.2] — 2026-10-03

Version de maintenance consacrée à la fiabilité des sessions et à
l'organisation du code.

### Corrigé

- Interpolation de la position du recul des armes en vue subjective.
- Ambiances réinitialisées entre parties : zone, respiration, délai des
  événements et enveloppes de volume. Leur horloge reste figée en pause.
- Nettoyage des ressources de niveau, de sprites et de modèles d'armes,
  y compris lors d'un chargement interrompu ou en échec.
- Ressources des ramassages préchargées et préchauffées, possédées par la
  session et protégées contre une libération prématurée au hot reload.
- Transitions de session protégées contre les appels concurrents ; pose
  caméra CCTV et timestep physique restaurés même en cas d'erreur.
- Navigation utilisant le service de raycasts injecté ; changement d'état
  des ennemis en debug via les API publiques de XState.
- Filtrage des textures étendu aux autres canaux de matériaux et aux
  entrées nodales explicitement enregistrées, avec conservation de leur
  encodage couleur.

### Technique

- Sources et tests rangés par responsabilité, avec imports, documentation
  et chemins d'outillage adaptés.
- Contrats de données séparés des implémentations et du store HUD ; santé
  et secrets conservés dans l'état canonique de la partie.
- Chargement du niveau, portes, navigation, comportements ennemis, effets
  et viewmodel répartis en modules dédiés ; overlays canvas mutualisés.
- Composition des services Effect dans l'application, avec maintien de la
  frontière synchrone stricte pour la simulation et le rendu.
- Manifestes audio, sprites et enregistrements de rejeu validés au chargement
  par Effect Schema ; commentaires nettoyés et connaissances conservées
  dans la documentation.

### Outils de développement

- Comparaison du recul « Stable / Historique » et réglage par arme dans le
  panneau de tuning ; horloge et délai d'ambiance visibles dans la console.

## [1.0.1] — 2026-10-02

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

[1.0.2]: https://github.com/benjiGir/projet-cassandre/releases/tag/v1.0.2
[1.0.1]: https://github.com/benjiGir/projet-cassandre/releases/tag/v1.0.1
[1.0.0]: https://github.com/benjiGir/projet-cassandre/releases/tag/v1.0.0
