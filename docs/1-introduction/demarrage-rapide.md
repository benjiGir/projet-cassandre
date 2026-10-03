---
title: Démarrage rapide
tags: [introduction]
status: stable
updated: 2026-09-25
---

# Démarrage rapide

## Prérequis

- **Node 22** et **pnpm 10** — versions utilisées par `.github/workflows/deploy.yml`
  (le dépôt n'a pas de `.nvmrc` ni de champ `engines`/`packageManager` dans
  `package.json`, ce fichier de CI fait foi).
- Un navigateur récent (Chrome ou Firefox — WebGL2, pointeur verrouillé).
- **Python 3**, seulement pour toucher au contenu du niveau ou à l'audio (pas
  pour lancer le jeu).
- **Blender 5.1**, seulement pour éditer la géométrie du niveau (voir
  `tools/blender/README.md`).
- **ffmpeg avec libvorbis**, seulement pour reconstruire l'audio sprite (le
  `ffmpeg` de Homebrew en est dépourvu par défaut — voir `tools/audio/README.md`).

## Installer et lancer

```bash
pnpm install
```

```bash
pnpm dev
```

Ouvre `http://localhost:5173` (port par défaut de Vite, non forcé dans
`vite.config.ts`).

```bash
pnpm build
```

```bash
pnpm test
```

```bash
pnpm check
```

```bash
pnpm check:docs
```

## Premier lancement

En développement, l'écran de démarrage n'est pas encore le menu principal :
`src/app/navigation/bootChoice.ts::resolveBootChoice` affiche d'abord le **menu
principal** (`src/ui/screens/mainMenu/MainMenu`), sauf si l'URL porte déjà
`?level=`. Le bouton « Jouer » lance directement `niveau_v2` (« Niveau v2 —
habillé »), désigné comme LE niveau du jeu dans le registre
`src/game/level/catalog/levels.ts`. Un lien « Options » ouvre `OptionsScreen`.

En développement uniquement, le menu principal propose aussi un accès au
**choix de zone** (`src/ui/dev/LevelMenu/LevelMenu.tsx`, outil d'auteur qui
disparaît du build de production) : il liste tous les niveaux enregistrés,
dont la gym de test, les cinq zones A à E prises séparément, la salle
d'essai et le blockout gris du niveau v2, et `hypermarche_complet` (les cinq
zones recollées en un seul fichier, gardé pour du test ciblé).

Le paramètre d'URL `?level=<id>` saute ce menu et charge directement
l'entrée correspondante du registre ; un identifiant non enregistré retombe
sur un chargement glTF brut du même nom, sans passer par le registre.

## Contrôles par défaut

Défauts de `src/core/input/input.ts` (`DEFAULT_BINDINGS`, rebindables en jeu et
persistés en `localStorage`) : ZQSD n'apparaît nulle part dans le code, ce
sont les touches physiques `KeyW`/`KeyA`/`KeyS`/`KeyD` qui sont liées, donc
déjà correctes en clavier AZERTY sans configuration.

- Déplacement : `W`/`A`/`S`/`D`, sprint `Maj (gauche)`, saut `Espace`.
- Tir : clic gauche. Changement d'arme : `1` (pied-de-biche), `2` (pistolet),
  `3` (pompe).
- Interagir : `E`.

Détail complet, y compris la limite des libellés en AZERTY :
[`../6-reference/controles.md`](../6-reference/controles.md).

## Outils de dev

La console du navigateur expose `window.cassandre` (`src/game/devtools/consoleApi.ts`,
absent du build de production). Quelques commandes utiles :

- `cassandre.level.load(nom)` — charge un niveau du registre sans repasser
  par un menu.
- `cassandre.sfx.liste()` / `cassandre.sfx.joue(id)` — quels sons existent,
  en jouer un sans provoquer la situation qui le déclenche.
- `cassandre.doors()` / `cassandre.secrets()` / `cassandre.props.liste()` —
  inspecter l'état du niveau glTF chargé.
- `cassandre.lighting()` — sépare l'éclairage temps réel de la couleur cuite
  d'un niveau.

Touches de debug (absentes du build de production, jamais rebindables) :
`KeyV` bascule le wireframe de toute la scène, `KeyB` les gizmos
balistiques, `F9`/`F10` enregistrent puis rejouent une séquence d'input
(déterminisme). Le panneau de debug (coin haut-gauche) ne s'affiche qu'en
développement ; en production, ce coin montre seulement le compteur
d'images. La page d'écoute audio (`tools/audio/audition.py`) se sert depuis
`http://localhost:5173/audition/` en développement.

Détail complet : [`../6-reference/console-cassandre.md`](../6-reference/console-cassandre.md)
et `../4-technique/debug.md`.

## Limites connues de l'automatisation

Un onglet masqué (`document.visibilityState: hidden`) gèle toute la boucle à
pas fixe, pas seulement le rendu. Le verrouillage du pointeur reste hors de
portée d'un navigateur automatisé. Les deux limitent ce qu'un agent peut
vérifier lui-même sans un humain qui joue réellement (source : `CLAUDE.md`).

## Et ensuite

- [Comment lire cette doc](comment-lire-cette-doc.md)
- Reprendre le projet : `../5-guides/reprendre-le-projet.md` (page pas
  encore écrite).
