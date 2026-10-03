// see: docs/6-reference/notes-code-gameplay-outils.md#réglages

const STORAGE_KEY = "cassandre.histoire";

function loadPersisted(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

const seenIntros = loadPersisted();

/** L'intro de ce niveau a déjà été vue ou passée sur ce navigateur. */
export function hasSeenIntro(levelId: string): boolean {
  return seenIntros.has(levelId);
}

export function markIntroSeen(levelId: string): void {
  if (seenIntros.has(levelId)) return;
  seenIntros.add(levelId);
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seenIntros]));
  } catch {
    // Dégrade silencieusement, même discipline que `audioSettings.ts`.
  }
}

/** Oublie les intros vues — pour les tests. */
export function resetSeenIntros(): void {
  seenIntros.clear();
}
