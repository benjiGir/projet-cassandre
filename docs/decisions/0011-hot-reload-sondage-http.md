---
title: Hot reload de niveau par sondage HTTP HEAD
tags: [adr, pipeline]
status: accepte
updated: 2026-09-25
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

## Révision du 2026-09-20 — la décision n'était pas appliquée

Signalé par l'utilisateur, qui voyait passer un `HEAD` toutes les 400 ms sans
savoir d'où il venait.

Cet ADR dit « pendant toute une session de **développement** », et l'en-tête du
module disait « dev-only ». Rien ne l'appliquait : aucune garde nulle part, et
le sondage partait bel et bien dans le bundle de production — vérifié en
cherchant `no-store` dans `dist/assets/*.js`, il y était.

Conséquence réelle : un build déployé interrogeait le `.glb` **2,5 fois par
seconde, indéfiniment, pour chaque joueur**, alors que le fichier ne change
jamais en production. Du trafic, de la batterie, et des requêtes facturées sur
un hébergement qui les compte, pour apprendre en boucle que rien n'a bougé.

La création de la fibre de sondage est maintenant enveloppée dans
`if (import.meta.env.DEV)`. Vite remplace cette expression par une constante au
build, donc la branche — et `pollOnceEffect` avec elle — disparaît du bundle
livré au lieu d'y dormir. Vérifié dans les deux sens : plus aucune occurrence
de `no-store` en production, et en développement un `touch` sur le `.glb`
déclenche toujours « changement détecté » suivi d'un rechargement complet.

`reload()` reste disponible partout : c'est un appel explicite, pas une boucle
de fond. La leçon est moins le bug que sa durée de vie — **un commentaire qui
annonce une contrainte ne l'applique pas**, et celui-ci a survécu à tout le
retrofit Effect du jalon M2 sans que personne le vérifie.

## Révision du 2026-09-25 — cycle de vie transactionnel

`stop()` retourne désormais une promesse : il interrompt le sondage, attend le
chargement en vol, puis dispose le handle courant. Un handle qui arrive après
l’arrêt est disposé sans préparation ni publication ; le monde Rapier n’est
donc jamais libéré pendant qu’un loader peut encore y ajouter des corps.
Un token `levelLoadGeneration` invalide aussi l’installation différée d’un
autre fichier demandée depuis la console si un second choix ou un teardown la
dépasse.

Un reload prépare ses systèmes dérivés dans des variables locales. L’ancien
handle est suspendu en mémorisant la visibilité de sa racine et l’état actif de
chaque corps. Le commit publie le nouvel ensemble en une fois et dispose
l’ancien ; toute exception dispose le candidat et restaure exactement
l’ancien état. `firstLoad` expose un résultat discriminé (`committed`,
`failed`, `cancelled`) pour que le boot puisse proposer un retry sans confondre
« tentative terminée » et « niveau prêt ».
