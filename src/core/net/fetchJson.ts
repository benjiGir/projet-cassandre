/** Délai au-delà duquel un manifeste est tenu pour perdu, en millisecondes. */
export const FETCH_TIMEOUT_MS = 15000;

/**
 * Charge un manifeste JSON et le valide. Rejette sur un délai dépassé, un
 * statut HTTP d'erreur ou un contenu que `decode` refuse : à l'appelant de
 * décider si le jeu continue sans.
 */
export async function fetchJson<T>(url: string, decode: (raw: unknown) => T): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return decode(await response.json());
}
