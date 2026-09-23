import { useEffect, useEffectEvent } from "react";

export interface InputCaptureHandlers {
  /** Code de la touche (`KeyboardEvent.code`) ou du clic (`Mouse0`, `Mouse2`) capturé. */
  onCapture: (code: string) => void;
  onCancel: () => void;
}

/**
 * Tant que `active`, capte la PROCHAINE touche ou le prochain clic, avant
 * que le navigateur n'en fasse quoi que ce soit. Échap annule : un rebind
 * vers Échap laisserait le joueur sans issue évidente.
 */
export function useInputCapture(active: boolean, handlers: InputCaptureHandlers) {
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    e.preventDefault();
    if (e.code === "Escape") {
      handlers.onCancel();
      return;
    }
    // `code` vide : jamais produit par un vrai clavier, mais un évènement
    // synthétique peut en émettre un, et le rebind vers "" rendrait l'action
    // injouable sans que rien ne le signale.
    if (e.code) handlers.onCapture(e.code);
  });

  const onMouseDown = useEffectEvent((e: MouseEvent) => {
    e.preventDefault();
    // Clic milieu et boutons latéraux ignorés : pas de code stable pour eux.
    if (e.button === 0) handlers.onCapture("Mouse0");
    else if (e.button === 2) handlers.onCapture("Mouse2");
  });

  useEffect(() => {
    if (!active) return;

    const keyListener = (e: KeyboardEvent) => onKeyDown(e);
    const mouseListener = (e: MouseEvent) => onMouseDown(e);
    // Un rebind vers le clic droit ne doit pas ouvrir le menu contextuel.
    const blockContextMenu = (e: Event) => e.preventDefault();

    window.addEventListener("keydown", keyListener);
    window.addEventListener("mousedown", mouseListener);
    window.addEventListener("contextmenu", blockContextMenu);
    return () => {
      window.removeEventListener("keydown", keyListener);
      window.removeEventListener("mousedown", mouseListener);
      window.removeEventListener("contextmenu", blockContextMenu);
    };
  }, [active]);
}
