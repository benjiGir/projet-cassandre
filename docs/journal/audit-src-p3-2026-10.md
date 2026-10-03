---
title: Corrections P3 de src
tags: [journal, architecture, effect, audio, rendu]
status: stable
updated: 2026-10-03
---

# Corrections P3 de src

## Période

3 octobre 2026, après le commit P2 `19419a1`.
Cette passe traite les trois recommandations P3 de l'[audit initial](audit-src-2026-10.md).

## Objectif

Déplacer la composition des services vers l'application, préciser puis
appliquer la continuité des ambiances entre parties et partager les
opérations communes aux overlays canvas.

## Livré et preuve

| Point | Changement | Contrat conservé |
|---|---|---|
| Composition Effect | `src/app/runtime/gameRuntime.ts` assemble les quatre Layers et crée le runtime ; `src/core/effect/runtime.ts::createGameplayRunner` construit le garde-fou générique. | Une seule instance par onglet, diagnostic de suspension puis propagation, services et RNG identiques. |
| Ambiances | Reset de l'horloge, de la zone, du premier délai, des enveloppes et des sons ponctuels à chaque partie ; arrêt à la destruction. | Fichiers préchargés, nappes bouclées et réglages utilisateur conservés ; flux cosmétique dédié avec la seed existante. |
| Overlays | `src/render/overlays/canvasOverlay.ts` partage la construction et `hexToCss` entre réticule, hitmarker et CCTV. | Dimensions 640×360, IDs, classe CSS, absence d'interception du pointeur et instructions de dessin inchangés. |

Les imports de runtime des systèmes et des tests existants pointent désormais
vers leur propriétaire dans `app/`. Aucun barrel de compatibilité n'est ajouté.
`gameRuntime.ts` ne charge aucun écran ni module React. Le noyau générique
ne dépend d'aucun service de jeu, de physique ou de rendu.

### Continuité audio retenue

Une nouvelle partie démarre avec une respiration à l'instant zéro, une zone
non sélectionnée et un premier événement après 6 secondes actives. La zone
sous la caméra est choisie au premier affichage actif ; hors des boîtes, la
zone par défaut s'applique. Aucun volume ni son ponctuel de la partie
précédente ne reste dans son état de présentation.

En pause, au menu, pendant un chargement ou sur un écran de fin, l'horloge,
la zone et le délai ne progressent plus. Les gains peuvent finir de descendre
vers le silence. Les nappes Howler restent en boucle, même silencieuses :
leur curseur audio n'est pas réinitialisé. Ce choix réutilise les lectures
préchargées et conserve la continuité du fond sonore.

La seed d'ambiance reste `0xa4b1a7`, indépendante de la simulation.
Le calendrier utilise toujours le delta d'affichage ; ce reset ne prouve
aucun déterminisme sonore entre des fréquences d'affichage différentes.
`cassandre.sfx.ambiance()` expose aussi `horloge` et `prochainEvenementDans`,
en secondes, pour rendre cette continuité inspectable.

### Contrôles effectués

- Construction de production et TypeScript réussis : 482 modules transformés.
- Liens documentaires contrôlés : 191 documents, aucune erreur ni avertissement.
- Diff sans erreur d’espacement.
- Le build conserve l'avertissement de taille du bundle principal (>500 ko).
- Relevé statique local : 223 modules TS/TSX, 811 imports relatifs types compris, aucun cycle entre fichiers à l'exécution détecté.
- Les seuls imports vers `ui/` venant de l'extérieur restent dans `main`, `app/navigation/bootChoice` et `app/navigation/sessionFlow`.

Le relevé utilise les déclarations d'import relatives statiques ; les imports
dynamiques et packages externes ne sont pas couverts. Le contexte 2D est
obtenu avant l'insertion DOM : un échec n'ajoute plus de canvas inutilisable.
La relecture du diff conserve les commandes de dessin et les horloges propres
aux widgets ; elle ne remplace pas une comparaison visuelle.

Aucun test ajouté ou exécuté. Les cinq fichiers de test concernés ont
uniquement leurs imports adaptés, avec deux références documentaires corrigées.
Aucun playtest, écoute, capture de pixels ni mesure de performance exécuté.
Le contrat audio est établi par le code et sa documentation, puis compilé ;
le rendu et le résultat audible restent à vérifier en jeu.

## Rejeté et raison

- Recréer le runtime à chaque partie : les services appartiennent à l'onglet.
- Recharger les nappes au reset : les fichiers et lectures préparées appartiennent à l'application.
- Partager le RNG d'ambiance avec celui du combat : le nombre d'images ne doit pas influer sur les tirs.
- Déplacer les commandes de dessin des widgets dans la primitive commune : chaque widget conserve son comportement et ses contrats propres.

## Leçons

Distinguer la durée de vie des fichiers audio de celle de l'état cosmétique
évite de garder une zone ou un délai provenant d'une partie précédente.
Le point de composition peut vivre dans l'application sans transformer le
noyau en registre des services du jeu.

La documentation courante est mise à jour dans la
[carte des modules](../3-architecture/carte-des-modules.md),
[Effect et XState](../3-architecture/effect-et-xstate.md),
[Audio runtime](../4-technique/audio-runtime.md) et les références
[noyau](../6-reference/notes-code-core.md) et
[rendu](../6-reference/notes-code-rendu.md).
Les rapports d'audit restent locaux, selon la consigne de commit précédente.
