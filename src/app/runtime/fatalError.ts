// Les erreurs qui arrêtent le jeu. Sans ce module, une exception dans la
// boucle, au démarrage ou pendant un changement de partie laissait le joueur
// devant une image figée ou un chargement sans fin.
// see: docs/4-technique/interface-react.md#écran-de-secours

type FatalHandler = (error: unknown) => void;

let handler: FatalHandler | null = null;
let reported = false;

/** Le texte montré au joueur : le message de l'erreur, jamais sa pile. */
export function fatalErrorDetail(error: unknown): string {
  if (error instanceof Error) return error.message ? `${error.name} : ${error.message}` : error.name;
  return typeof error === "string" && error !== "" ? error : "Erreur inconnue";
}

/**
 * Signale une erreur dont le jeu ne se relève pas. Seule la première compte :
 * une boucle cassée relance la même exception à chaque image.
 */
export function reportFatalError(error: unknown): void {
  if (reported) return;
  reported = true;
  console.error("[fatal] le jeu s'arrête sur une erreur", error);
  handler?.(error);
}

/**
 * Branche les erreurs que rien n'a rattrapées. Une exception non rattrapée
 * arrête le jeu ; une promesse rejetée sans suite est seulement journalisée,
 * parce qu'il en existe d'inoffensives (lecture audio refusée par le
 * navigateur, requête annulée) : celles qui comptent sont signalées à leur
 * source, par `reportFatalError`.
 */
export function installFatalErrorHandling(target: EventTarget, onFatal: FatalHandler): void {
  handler = onFatal;
  target.addEventListener("error", (event) => {
    // Sans objet d'erreur : script d'une autre origine (extension) ou avertissement du navigateur.
    const error = (event as ErrorEvent).error as unknown;
    if (error instanceof Error) reportFatalError(error);
  });
  target.addEventListener("unhandledrejection", (event) => {
    console.error("[erreur] promesse rejetée sans suite", (event as PromiseRejectionEvent).reason);
  });
}

/** Oublie l'erreur signalée et le gestionnaire — pour les tests. */
export function resetFatalErrorHandling(): void {
  handler = null;
  reported = false;
}
