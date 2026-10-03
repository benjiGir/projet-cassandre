---
title: "Prototype — habillage et interface — 2026-08-24"
tags: [journal, prototype]
status: stable
updated: 2026-09-26
---

# Prototype — habillage et interface — 2026-08-24

Phase 6 — Habillage, livrée (2026-08-24). Décomposée et routée par l'agent
> `director` vers `core-loop` (rebinding) puis `shell` (tout le reste) — voir
> `docs/journal/plan-prototype-2026-08.md`, section "Phase 6", pour les 6 livrables du
> plan (HUD stream, répliques du héros, musique/nappe, écran de mort, écran
> de fin de niveau, menu principal + rebinding AZERTY).
> **Rebinding réel** (`src/core/input/input.ts`, `GameAction`/`DEFAULT_BINDINGS`,
> persistance `localStorage`) : constat au passage, le moteur d'input lisait
> déjà `KeyboardEvent.code` (position physique, indépendant du layout) —
> ZQSD fonctionnait donc déjà nativement en AZERTY avant cette tâche, sans
> aucun code neuf. Ce qui manquait réellement, c'est le remapping par-dessus
> (`RebindScreen.tsx`, écran "Options" du menu principal).
> **HUD de prod** (`src/ui/Hud.tsx`) façon overlay de stream (webcam
> factice, badge "EN DIRECT", compteur de "vues" — la blague du HUD, gain
> aléatoire disproportionné par kill, ×4 pour le Directeur) + PV/munitions.
> **5 répliques du héros** sur un canal dédié (`state.heroLine`, distinct de
> `state.hudMessage` — l'un est une réaction de personnage avec cooldown
> global 15s, l'autre une info système factuelle sans cooldown), ducking
> musical -6dB/400ms à chaque réplique (`core/music.ts`).
> **Écran de mort réel** : `playerHp` pouvait déjà tomber à 0 sans aucun
> effet avant cette tâche — trou comblé, `isDead` stoppe maintenant tout le
> gameplay au sommet d'`updateGameplay` (le pas fixe continue de tourner,
> invariant #1, seul le contenu du pas est ignoré). **Écran de fin de
> niveau** : détection générique par franchissement du plan de `door_e_exit`
> une fois déverrouillée (projection vectorielle sur l'axe local le plus fin
> du vantail, transformé par sa rotation réelle — pas de coordonnées en dur,
> ne se déclenche jamais sur un niveau qui n'a pas cette porte). "Rejouer"/
> "Retour au menu" : rechargement de page complet (`screenNav.ts`), pas de
> reset en place — aucun système du jeu n'expose aujourd'hui de chemin de
> reset complet, en construire un aurait été disproportionné pour une tâche
> d'habillage.
> **Musique + nappe** (`core/music.ts`) : deux pistes synthétiques de plus
> (même pipeline stdlib Python que les 12 SFX existants), PLACEHOLDER SONORE
> ASSUMÉ — à remplacer par un vrai morceau libre de droits dès que possible,
> aucun accès réseau côté agent pour en choisir un.
> **Deux bugs trouvés et corrigés après coup, à la revue humaine du travail
> des agents** (pas par les agents eux-mêmes) : (1) le bloc webcam/vues du
> nouveau `Hud.tsx` était posé en haut-gauche, exactement sur `DebugPanel`
> (toujours monté, coin haut-gauche depuis la Phase 1) — texte des deux
> illisible, entrelacé, constaté en jeu par capture d'écran. Déplacé en
> haut-droite (`Hud.tsx`/`HeroLine.tsx`), `DebugPanel` non touché (outil de
> dev établi, hors sujet). Un second chevauchement, interne au HUD cette
> fois (légende sous la webcam vs. bloc "vues" juste en dessous, 7px
> d'écart), a suivi immédiatement après le premier déplacement — espacement
> corrigé. (2) `RebindScreen.tsx` acceptait `e.code` sans le valider :
> un événement clavier synthétique avec un `code` vide (constaté avec
> l'outil de test navigateur utilisé pour cette vérification, jamais produit
> par un vrai clavier physique) corrompait silencieusement le binding vers
> `""` — plus aucune touche ne déclenchait l'action, jusqu'à
> "Réinitialiser". Garde ajoutée (`if (!e.code) return;`).
> Vérifié en jeu après ces deux corrections : `pnpm build` propre, menu
> principal → Options → rebind d'une touche → Retour, sans chevauchement ;
> "Jouer" → niveau complet, HUD lisible dans les deux coins hauts, PV/
> munitions cohérents avec l'état réel (`activeWeapon: "none"` → "À MAINS
> NUES" sur ce niveau qui démarre désarmé, comportement historique
> inchangé).
> **Non vérifié en conditions réelles** (même limitation d'environnement que
> pour la porte à badge et les secrets — `document.visibilityState: hidden`
> gèle la boucle à pas fixe entière en automatisation navigateur, empêchant
> tout déclenchement par vraie entrée du joueur) : mourir pour de vrai
> (écran + boutons), franchir `door_e_exit` jusqu'à l'écran de fin, entendre
> la nappe/musique et le ducking, rebinder avec de vraies touches physiques,
> et surtout le critère de validation du plan lui-même — **« la blague
> fonctionne, quelqu'un rit »** — qui ne peut être jugé que par un humain en
> train de jouer.
>
>
