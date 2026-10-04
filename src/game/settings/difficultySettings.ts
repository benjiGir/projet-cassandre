import { DEFAULT_DIFFICULTY, isDifficulty, type Difficulty } from "../session/progression/difficulty";

// see: docs/6-reference/notes-code-gameplay-outils.md#réglages

const STORAGE_KEY = "cassandre.difficulte";

function loadPersisted(): Difficulty {
  if (typeof localStorage === "undefined") return DEFAULT_DIFFICULTY;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isDifficulty(stored) ? stored : DEFAULT_DIFFICULTY;
  } catch {
    return DEFAULT_DIFFICULTY;
  }
}

let current = loadPersisted();

/** Difficulté de la PROCHAINE partie : une partie en cours garde celle de sa construction (`GameSession.difficulty`). */
export function getDifficulty(): Difficulty {
  return current;
}

export function setDifficulty(difficulty: Difficulty): void {
  current = difficulty;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, difficulty);
  } catch {
    // Dégrade silencieusement, même discipline que `audioSettings.ts`.
  }
}

/** Revient à la difficulté d'origine — pour les tests. */
export function resetDifficulty(): void {
  current = DEFAULT_DIFFICULTY;
}
