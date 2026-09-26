---
title: "assets — archive"
tags: [archive]
status: perime
updated: 2026-09-26
---

> **Archive — ne plus utiliser comme référence courante.** Cette page est conservée pour son historique. Voir [assets](../6-reference/arborescence.md) pour la documentation à jour.

# assets

> **Brouillon** — destination de migration. Ce document reçoit le contenu
> extrait des commentaires du code lors des passes de `doc-keeper`.
>
> Voir le skill `comment-migration-protocol`.

Retour à la [carte de la documentation](../README.md).

## Chemins des assets au déploiement

Les fichiers de `public/` sont servis sous le `base` défini par Vite. En
développement, il vaut `/` ; sur une page de projet GitHub Pages, il peut
valoir `/<repo>/`. Un chemin codé en dur qui commence par `/` pointerait vers
la racine du domaine et perdrait ce sous-chemin.

`src/core/assetPath.ts::assetUrl` préfixe donc le chemin avec
`import.meta.env.BASE_URL` et retire son éventuel `/` initial. Vite garantit
que `BASE_URL` est déjà encadré par les séparateurs nécessaires ; les appels
ne doivent pas reconstruire ce préfixe eux-mêmes.
