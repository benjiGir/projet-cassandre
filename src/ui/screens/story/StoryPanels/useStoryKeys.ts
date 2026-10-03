import { useEffect, useEffectEvent } from "react";

/** Clavier de la visionneuse : Espace, Entrée ou → avancent, Échap passe tout. */
export function useStoryKeys(onNext: () => void, onSkip: () => void): void {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.code === "Escape") {
      onSkip();
      return;
    }
    if (event.code !== "Space" && event.code !== "Enter" && event.code !== "ArrowRight") return;
    // Espace ou Entrée sur un bouton qui a le focus : son propre clic s'en charge.
    if (event.code !== "ArrowRight" && event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    onNext();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
