import { createElement } from "react";
import type { createRoot } from "react-dom/client";

import { LEVEL_CHOICES, type LevelDef } from "../level/levels";
import { LevelMenu } from "../../ui/LevelMenu";
import { MainMenu } from "../../ui/MainMenu";
import { RebindScreen } from "../../ui/RebindScreen";

/**
 * Extraction du refactor de `main.ts` (2229 lignes → modules, 2026-09-05) :
 * `resolveLevelChoice`/`resolveBootChoice` déplacées TELLES QUELLES (jugement
 * du jalon M8 : "la partie la moins risquée", déjà testée, déjà en prod — ni
 * l'une ni l'autre n'envoie d'évènement à l'acteur de flux, voir
 * `ui/gameFlowMachine.ts` et `main.ts` pour les deux évènements `ENTER_MENU`/
 * `PLAY` qui encadrent ce sous-flux depuis l'appelant).
 */

/**
 * Résout le `LevelDef` choisi pour ce boot, AVANT toute construction de scène
 * Three.js/monde Rapier — voir l'appel tout en haut de `main()`.
 *
 * Deux voies, dans cet ordre :
 *   1. `?level=<id>` dans l'URL. Si `<id>` correspond à une entrée du
 *      registre (`LEVEL_CHOICES`), elle est utilisée directement, SANS
 *      afficher le menu. Sinon (nom qui ne matche aucune entrée), il est
 *      traité comme un nom de fichier glTF BRUT à charger tel quel
 *      (`kind: "gltf"` implicite, pas de `startUnarmed`) — c'est le mode
 *      d'itération actuel pour tester une zone en cours d'export, avant
 *      qu'elle ait une entrée officielle dans le registre. Flexibilité
 *      délibérément préservée, ne pas la retirer.
 *   2. Sinon, affiche `LevelMenu` (voir `src/ui/LevelMenu.tsx`, composant
 *      purement présentationnel, non modifié ici) et attend le clic de
 *      l'utilisateur.
 */
export function resolveLevelChoice(root: ReturnType<typeof createRoot>): Promise<LevelDef> {
  const levelParam = new URLSearchParams(window.location.search).get("level");
  if (levelParam) {
    const registered = LEVEL_CHOICES.find((entry) => entry.id === levelParam);
    if (registered) return Promise.resolve(registered);
    return Promise.resolve({
      id: levelParam,
      label: levelParam,
      kind: "gltf",
      gltfName: levelParam,
    });
  }

  return new Promise((resolve) => {
    root.render(
      createElement(LevelMenu, {
        options: LEVEL_CHOICES.map((entry) => ({ id: entry.id, label: entry.label })),
        onChoose: (id) => {
          const chosen = LEVEL_CHOICES.find((entry) => entry.id === id);
          // `LevelMenu` n'appelle `onChoose` qu'avec un `id` qu'il a lui-même
          // reçu dans `options`, donc toujours résolvable ici — le fallback
          // ne sert qu'à satisfaire le type, jamais atteint en pratique.
          resolve(chosen ?? LEVEL_CHOICES[0]);
        },
      }),
    );
  });
}

/**
 * Porte d'entrée du jeu (Phase 6, plan section F — menu principal). Enrobe
 * `resolveLevelChoice` ci-dessus (INCHANGÉE) d'un nouveau menu principal,
 * SANS jamais l'afficher quand `?level=` est présent dans l'URL : LES DEUX
 * CHEMINS HISTORIQUES DOIVENT CONTINUER À FONCTIONNER EXACTEMENT COMME AVANT
 * (contrainte dure de la tâche) —
 *   1. `?level=<id enregistré>` : bypass total, aucun menu, jamais montré ;
 *   2. `?level=<nom>` non enregistré : fixture brute, idem.
 * Cette fonction délègue PUREMENT à `resolveLevelChoice` dans les deux cas
 * (return immédiat, `MainMenu` n'est même pas importé dans ce chemin) — la
 * logique elle-même n'est pas dupliquée, seulement enrobée.
 *
 * Absent de `?level=` : affiche `MainMenu` (Jouer / Options / Quitter).
 * "Jouer" résout DIRECTEMENT sur `hypermarche_complet` (le niveau complet,
 * chemin joueur normal) — SANS passer par `LevelMenu` (resté un outil de
 * DEV pour choisir une zone individuelle, voir son en-tête). `LevelMenu`
 * reste atteignable via le lien discret "Choisir une zone (dev)" de
 * `MainMenu`, qui délègue lui-même à `resolveLevelChoice` — c'est donc le
 * MÊME composant historique, jamais dupliqué ni réimplémenté. "Options"
 * affiche `RebindScreen` (plan section G), avec un retour vers ce même menu
 * principal (pas de pile de navigation : un seul niveau d'imbrication).
 *
 * Réutilisée par `game/session/lifecycle.ts::returnToMenu` (Jalon M8)
 * EXACTEMENT comme au tout premier boot — voir sa doc pour la raison pour
 * laquelle "Retour au menu principal" doit d'abord retirer `?level=` de
 * l'URL (`history.replaceState`, pas de rechargement) avant de rappeler
 * cette fonction, sans quoi une partie démarrée via `?level=zone_a_parking`
 * reviendrait silencieusement au même niveau au lieu du vrai menu principal.
 */
export function resolveBootChoice(root: ReturnType<typeof createRoot>): Promise<LevelDef> {
  const levelParam = new URLSearchParams(window.location.search).get("level");
  if (levelParam) return resolveLevelChoice(root);

  const fullLevel = LEVEL_CHOICES.find((entry) => entry.id === "hypermarche_complet");
  // Filet de sécurité de TYPAGE uniquement, jamais atteint en pratique tant
  // que `levels.ts` garde cette entrée enregistrée — sans lui, "Jouer"
  // retomberait sur le tout premier choix du registre plutôt que de planter.
  const playChoice = fullLevel ?? LEVEL_CHOICES[0];

  return new Promise((resolve) => {
    function showMainMenu() {
      root.render(
        createElement(MainMenu, {
          onPlay: () => resolve(playChoice),
          onOptions: () => {
            root.render(createElement(RebindScreen, { onBack: showMainMenu }));
          },
          onChooseZone: () => {
            resolveLevelChoice(root).then(resolve);
          },
        }),
      );
    }
    showMainMenu();
  });
}
