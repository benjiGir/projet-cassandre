// see: docs/6-reference/notes-code-core.md#chargement-et-orchestration

interface LoadingBaseState {
  label: string;
  progress: number;
  /** Ce vers quoi on charge, tel que `beginLoading` l'a reçu : l'écran y accorde ses phrases d'attente. */
  destination: string | null;
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
let destination: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function reportLoading(label: string, progress: number) {
  if (done) return;
  state = { status: "loading", label, progress: Math.max(0, Math.min(1, progress)), destination };
  emit();
}

/** `towards` : ce vers quoi on charge. Omis (nouvelle tentative), la destination en cours est gardée. */
export function beginLoading(label = "Démarrage", progress = 0, towards?: string): void {
  done = false;
  if (towards !== undefined) destination = towards;
  reportLoading(label, progress);
}

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
      destination,
      message: message || "Le niveau n’a pas pu être chargé.",
      retry,
    };
    emit();
  });
}

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

export function letBrowserPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      // La première image laisse React commettre ; la seconde présente le résultat.
      requestAnimationFrame(() => resolve());
    });
  });
}
