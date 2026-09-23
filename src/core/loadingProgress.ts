/**
 * Progression du chargement initial — canal minuscule entre ce qui charge
 * (physique, planches de sprites, `.glb` du niveau) et l'écran qui l'affiche
 * (`ui/screens/loading/LoadingScreen/LoadingScreen.tsx`).
 *
 * Pourquoi un canal à part et pas le store zustand du HUD : celui-ci est
 * throttlé à 10 Hz et remis à zéro par `resetGameStore()` à chaque boot de
 * session — deux comportements justes pour le HUD, faux pour une barre de
 * chargement qui doit vivre AVANT que la session existe.
 *
 * `progress` est une fraction 0..1 du chargement ENTIER, pas d'une étape :
 * c'est l'appelant qui connaît sa part du gâteau, parce que lui seul sait ce
 * qui vient après lui. Les bornes sont posées en un seul endroit, dans
 * `main.ts`.
 */

export interface LoadingState {
  /** Ce qu'on est en train de faire, en clair. */
  label: string;
  /** Fraction du chargement total, 0..1. */
  progress: number;
}

let state: LoadingState | null = null;
let done = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/**
 * Publie l'avancement. Sans effet une fois `finishLoading()` appelé : le
 * rechargement à chaud d'un niveau repasse par le même chemin de chargement,
 * et il ne doit PAS faire réapparaître l'écran de chargement en pleine partie.
 */
export function reportLoading(label: string, progress: number) {
  if (done) return;
  state = { label, progress: Math.max(0, Math.min(1, progress)) };
  emit();
}

/** Chargement terminé — l'écran peut disparaître, et plus rien ne le rouvre. */
export function finishLoading() {
  done = true;
  state = null;
  emit();
}

export function subscribeLoading(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadingSnapshot(): LoadingState | null {
  return state;
}

/**
 * Rend la main au navigateur pour qu'il PEIGNE avant de repartir.
 *
 * Indispensable ici : construire les colliders et cuire le graphe de
 * navigation sont synchrones et bloquent le fil principal plusieurs centaines
 * de millisecondes. Sans cette pause, React reçoit le nouveau libellé mais ne
 * le dessine qu'APRÈS le blocage — on afficherait donc toujours l'étape
 * précédente, et la barre paraîtrait figée exactement là où elle travaille le
 * plus.
 */
export function letBrowserPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      // Deux trames : la première laisse React commettre le rendu, la
      // seconde laisse le navigateur le présenter à l'écran.
      requestAnimationFrame(() => resolve());
    });
  });
}
