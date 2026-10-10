import { persisted } from "../../core/storage/persisted";
import { DEFAULT_DIFFICULTY, isDifficulty, type Difficulty } from "../session/progression/difficulty";

// see: docs/6-reference/notes-code-gameplay-outils.md#réglages

function decodeDifficulty(stored: unknown): Difficulty {
  return isDifficulty(stored) ? stored : DEFAULT_DIFFICULTY;
}

// Gardée en texte brut, pas en JSON : c'est le format des sauvegardes déjà en place.
const stored = persisted("cassandre.difficulte", decodeDifficulty, () => DEFAULT_DIFFICULTY, { format: "text" });

let current = stored.load();

/** Difficulté de la PROCHAINE partie : une partie en cours garde celle de sa construction (`GameSession.difficulty`). */
export function getDifficulty(): Difficulty {
  return current;
}

export function setDifficulty(difficulty: Difficulty): void {
  current = difficulty;
  stored.save(difficulty);
}

/** Revient à la difficulté d'origine — pour les tests. */
export function resetDifficulty(): void {
  current = DEFAULT_DIFFICULTY;
}
