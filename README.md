# PROJET_CASSANDRE

Boomer shooter rétro façon Duke Nukem 3D / Ion Fury, en Three.js vanilla.
Un youtubeur complotiste à 200 abonnés avait raison sur toute la ligne.

Prototype : un niveau (l'hypermarché), trois armes (pied-de-biche, pistolet, pompe), un type d'ennemi de base
plus un boss, quelques minutes de jeu.

## Stack

Vite + TypeScript · [three.js](https://threejs.org/) (vanilla) ·
[@dimforge/rapier3d-compat](https://rapier.rs/) (physique) · React en overlay
uniquement (HUD/menus) · zustand · howler (audio) · Blender → glTF ·
[effect](https://effect.website/) · [xstate](https://stately.ai/docs/xstate)

## Lancer le projet

```bash
pnpm install
pnpm dev       # serveur de dev, http://localhost:5173
pnpm build     # build de prod dans dist/
pnpm test      # tests (vitest)
```

## Structure

```
src/core/     boucle à pas fixe, input, audio, RNG déterministe
src/render/   rendu rétro (résolution interne, sprites, effets)
src/physics/  monde Rapier
src/game/     joueur, ennemis, niveau, session
src/ui/       overlay React (HUD, menus)

tools/blender/   scripts headless (kit modulaire, niveaux, export)
public/assets/   assets servis en runtime (.glb, audio)
```

## Documentation

Le détail (systèmes, décisions d'architecture, pipeline Blender,
conventions) vit dans [`docs/`](docs/README.md).

## Crédits

La plupart des effets sonores du jeu (armes, impacts, ennemis, portes,
ramassages) sont générés avec [ElevenLabs](https://elevenlabs.io) (Sound
Effects). Les autres sons et les ambiances sont synthétisés par les outils du
dépôt (`tools/audio/`). Le détail des assets
tiers et de leurs licences est dans
[`assets_src/LICENCES_ASSETS.md`](assets_src/LICENCES_ASSETS.md).

## Déploiement

Un push sur `main` déclenche un déploiement automatique sur GitHub Pages
(voir [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) —
active `Settings > Pages > Source > GitHub Actions` sur le repo pour que ça
prenne effet.
