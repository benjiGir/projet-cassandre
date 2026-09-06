---
title: Hot reload de niveau par sondage HTTP HEAD
tags: [adr, pipeline]
status: accepte
updated: 2026-09-05
---

# ADR 0011 — Hot reload de niveau par sondage HTTP HEAD plutôt qu'un watcher fichier

## Statut

Accepté.

## Contexte

Le critère de validation de la Phase 4 (pipeline de niveau) est concret et
chronométré : déplacer un mur dans Blender, exporter, le voir en jeu en
moins de 60 secondes. Un `.glb` sous `public/assets/levels/` est un asset
STATIQUE servi tel quel par Vite — il est hors du graphe de modules, donc le
HMR de module de Vite ne s'applique pas (`import.meta.hot` ne se déclenche
jamais pour un fichier qui n'est référencé par aucun `import`).

## Décision

`createLevelSession` (`src/game/level/hotReload.ts`) sonde `url` par
`fetch(url, { method: "HEAD" })` à intervalle court (400 ms par défaut), en
comparant `ETag`/`Last-Modified`/`Content-Length` d'un appel à l'autre. Le
serveur de fichiers statiques de Vite (`sirv`) pose ces en-têtes à partir du
`mtime` réel du fichier sur disque, donc un export Blender qui écrase le
`.glb` est détecté au prochain sondage — dans le pire cas, sous 1 seconde,
largement dans le budget des 60 secondes visées.

## Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Watcher fichier réel (`chokidar` côté serveur Vite, exposé au client via WebSocket) | plus robuste (détection immédiate, zéro requête réseau en boucle), mais demande un plugin Vite dédié à écrire et maintenir — hors de proportion pour une Phase 4 dont le seul critère est un budget de 60 secondes déjà largement tenu par le sondage |

## Conséquences

- Simplicité : aucune dépendance supplémentaire, aucun plugin Vite, un seul
  fichier (`hotReload.ts`) porte tout le mécanisme.
- Coût accepté : une requête HTTP HEAD toutes les 400 ms pendant toute une
  session de développement — négligeable pour un serveur dev local.
- Ce n'est pas une garantie de robustesse totale (voir le rollback du skill
  `gltf-level-conventions` : si le pipeline glTF déborde au-delà d'un
  week-end, bascule possible sur TrenchBroom + un parser `.map`, décision à
  remonter au `director`).

## Comment on saurait qu'on a eu tort

Si le budget de 60 secondes cesse d'être tenu en pratique (serveur dev sous
charge, latence réseau anormale) ou si le volume de requêtes HEAD devient un
problème mesuré (jamais observé à ce jour), reconsidérer un watcher fichier
réel plutôt que d'augmenter l'intervalle de sondage — augmenter l'intervalle
dégraderait directement le critère de validation.
