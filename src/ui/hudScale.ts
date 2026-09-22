/**
 * Échelle du HUD en "pixels virtuels" — la même idée que la résolution
 * interne 640×360 du jeu (`INTERNAL_WIDTH`/`INTERNAL_HEIGHT`,
 * `src/render/renderer.ts`, invariant #4), appliquée au calque HUD.
 *
 * Le canvas de rendu 3D est étiré à `100vw`/`100vh` (`index.html`) : le HUD
 * dimensionné en `px` CSS fixes ne grandissait donc PAS avec la fenêtre —
 * mesuré à 0,9-2 % de la hauteur d'écran à 1920×1080, contre 5-8 % pour les
 * chiffres vitaux d'un HUD Duke 3D/Ion Fury. Sur un écran plus grand, la même
 * valeur en px occupe une part RELATIVE plus petite : le défaut s'aggrave
 * avec la résolution au lieu de se corriger.
 *
 * `vpx(n)` convertit un compte de pixels virtuels (sur une image pensée en
 * 640×360) en une taille CSS réelle, à l'échelle du plus petit facteur
 * d'agrandissement entre largeur et hauteur — comme un `object-fit: contain`
 * appliqué au calque HUD : jamais de débordement sur un écran d'un rapport
 * d'image inhabituel (ultra-large, portrait), toujours la même proportion de
 * l'écran sur un moniteur 16:9 quelle que soit sa résolution native.
 *
 * Volontairement des `calc()` en unités `vw`/`vh` natives, pas un
 * `transform: scale()` ni un rendu sur canvas bitmap : le texte reste
 * dessiné par le moteur de police du navigateur à sa taille réelle
 * (anti-crénelée, jamais interpolée à la façon d'une image agrandie) —
 * c'est ce qui garde la netteté même à une taille en pixels réels
 * fractionnaire.
 */

/** 1 pixel virtuel, exprimé comme le plus petit des deux facteurs d'échelle (largeur/640, hauteur/360). */
export const VPX = "min(0.15625vw, 0.277778vh)";

/** `n` pixels virtuels, prêts à être insérés dans n'importe quelle propriété CSS de taille. */
export function vpx(n: number): string {
  return `calc(${VPX} * ${n})`;
}
