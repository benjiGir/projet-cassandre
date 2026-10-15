import { createElement } from "react";
import type { Root } from "react-dom/client";

import { stopAllAudio } from "../../core/audio/audio";
import { CrashScreen } from "../../ui/screens/crash/CrashScreen/CrashScreen";
import { fatalErrorDetail } from "../runtime/fatalError";

/**
 * Remplace toute l'interface par l'écran de secours. Ne touche ni au moteur ni
 * à la partie : ils sont peut-être ce qui a cassé. Recharger la page est la
 * seule sortie proposée.
 */
export function showCrashScreen(root: Root, error: unknown): void {
  stopAllAudio();
  // Le pointeur est peut-être capturé par le jeu : il faut pouvoir cliquer le bouton.
  if (document.pointerLockElement) document.exitPointerLock();
  root.render(
    createElement(CrashScreen, {
      detail: fatalErrorDetail(error),
      onReload: () => window.location.reload(),
    }),
  );
}
