/**
 * Actions de navigation partagées par les écrans plein cadre de fin de
 * partie (`DeathScreen.tsx`, `LevelCompleteScreen.tsx`) — "Rejouer" et
 * "Retour au menu principal".
 *
 * DÉCISION DÉLIBÉRÉE, DOCUMENTÉE ICI (voir aussi le rapport de tâche) :
 * `window.location.reload()`/`window.location.assign()` plutôt qu'un reset
 * EN PLACE de `PhysicsWorld`/`SuitManager`/`DirectorManager`/`WeaponSystem`.
 * Aucun de ces systèmes n'expose aujourd'hui de chemin de reset complet
 * (construire l'un d'eux serait un risque disproportionné pour une tâche
 * d'« habillage », voir le skill `retro-fps-invariants` — hiérarchie de
 * décision, l'élégance de l'implémentation vient en dernier). Un rechargement
 * complet de page est plus lent (quelques centaines de ms) mais garanti
 * correct : tout repart d'un état neuf, aucun risque de fuite Rapier/Three.js
 * entre deux parties.
 *
 * Purement DOM, aucun import `src/game/*` : ces deux écrans restent
 * présentationnels au même titre que `LevelMenu.tsx`.
 */

/** "Rejouer" — recharge la page en conservant EXACTEMENT la query string courante (donc `?level=...` s'il y en avait un, sinon retour au menu principal par défaut de `main.ts`). */
export function reloadSamePage(): void {
  window.location.reload();
}

/** "Retour au menu principal" — recharge la page en retirant `?level=` : `main.ts::resolveBootChoice` retombera donc sur le nouveau menu principal (Phase 6), jamais sur un niveau chargé directement. */
export function reloadToMainMenu(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("level");
  window.location.assign(url.toString());
}
