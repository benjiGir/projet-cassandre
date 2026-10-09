import { useEffect, useState, type RefObject } from "react";

export interface ScrollEdges {
  /** Du contenu est passé au-dessus du haut visible. */
  above: boolean;
  /** Il reste du contenu sous le bas visible. */
  below: boolean;
}

const NONE: ScrollEdges = { above: false, below: false };

/** De quel côté cette zone de défilement cache-t-elle du contenu ? */
export function useScrollEdges(ref: RefObject<HTMLElement | null>): ScrollEdges {
  const [edges, setEdges] = useState(NONE);

  useEffect(() => {
    const scroller = ref.current;
    if (!scroller) return;

    const measure = () => {
      const above = scroller.scrollTop > 1;
      const below = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > 1;
      // Même objet tant que rien ne change : un défilement ne re-rend pas à chaque évènement.
      setEdges((current) => (current.above === above && current.below === below ? current : { above, below }));
    };
    measure();
    scroller.addEventListener("scroll", measure, { passive: true });

    // La fenêtre ou le contenu peuvent changer de hauteur sans qu'on défile.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(scroller);
    for (const child of scroller.children) observer?.observe(child);

    return () => {
      scroller.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [ref]);

  return edges;
}
