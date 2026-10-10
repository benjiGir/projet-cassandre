import { persisted } from "../../core/storage/persisted";

// see: docs/6-reference/notes-code-gameplay-outils.md#réglages

function decodeLevelIds(stored: unknown): string[] {
  return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
}

const stored = persisted("cassandre.histoire", decodeLevelIds, () => []);

const seenIntros = new Set(stored.load());

/** L'intro de ce niveau a déjà été vue ou passée sur ce navigateur. */
export function hasSeenIntro(levelId: string): boolean {
  return seenIntros.has(levelId);
}

export function markIntroSeen(levelId: string): void {
  if (seenIntros.has(levelId)) return;
  seenIntros.add(levelId);
  stored.save([...seenIntros]);
}

/** Oublie les intros vues — pour les tests. */
export function resetSeenIntros(): void {
  seenIntros.clear();
}
