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

interface LoadingBaseState {
  /** Ce qu'on est en train de faire, en clair. */
  label: string;
  /** Fraction du chargement total, 0..1. */
  progress: number;
}

export type LoadingState =
  | (LoadingBaseState & { status: "loading" })
  | (LoadingBaseState & {
      status: "failed";
      message: string;
      retry: () => void;
    });

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
  state = { status: "loading", label, progress: Math.max(0, Math.min(1, progress)) };
  emit();
}

/** Ouvre une nouvelle séquence de chargement (boot, replay ou retry). */
export function beginLoading(label = "Démarrage", progress = 0): void {
  done = false;
  reportLoading(label, progress);
}

/**
 * Publie un échec récupérable et attend l'action explicite de l'utilisateur.
 * La promesse ne résout qu'une fois, même si le bouton reçoit deux clics.
 */
export function waitForLoadingRetry(error: unknown): Promise<void> {
  done = false;
  const message = error instanceof Error ? error.message : String(error);
  return new Promise((resolve) => {
    let consumed = false;
    const retry = () => {
      if (consumed) return;
      consumed = true;
      resolve();
    };
    state = {
      status: "failed",
      label: "Chargement interrompu",
      progress: state?.progress ?? 0,
      message: message || "Le niveau n’a pas pu être chargé.",
      retry,
    };
    emit();
  });
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
