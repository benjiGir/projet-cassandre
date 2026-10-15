import { persisted } from "../../core/storage/persisted";
import { isDifficulty, type Difficulty } from "../session/progression/difficulty";

// Les records : meilleur score et meilleur temps d'un niveau TERMINÉ, tenus
// par difficulté et gardés sur ce navigateur. Une mort n'en pose aucun.

const STORAGE_KEY = "cassandre.records";

export interface LevelRecord {
  /** Meilleur score total. */
  readonly score: number;
  /** Meilleur temps de jeu, en secondes — pas forcément celui de la partie au meilleur score. */
  readonly seconds: number;
}

type RecordBook = Map<string, LevelRecord>;

function bookKey(levelId: string, difficulty: Difficulty): string {
  return `${levelId}/${difficulty}`;
}

function isRecord(value: unknown): value is LevelRecord {
  if (typeof value !== "object" || value === null) return false;
  const { score, seconds } = value as Partial<LevelRecord>;
  return typeof score === "number" && Number.isFinite(score) && typeof seconds === "number" && Number.isFinite(seconds);
}

/** Une ligne illisible est écartée sans faire perdre les autres ; un carnet illisible repart vide. */
function decodeBook(stored: unknown): Record<string, LevelRecord> {
  const records: Record<string, LevelRecord> = {};
  if (typeof stored !== "object" || stored === null) return records;
  for (const [key, value] of Object.entries(stored)) {
    if (isDifficulty(key.slice(key.lastIndexOf("/") + 1)) && isRecord(value)) records[key] = value;
  }
  return records;
}

const stored = persisted(STORAGE_KEY, decodeBook, () => ({}));

const book: RecordBook = new Map(Object.entries(stored.load()));

export function recordFor(levelId: string, difficulty: Difficulty): LevelRecord | null {
  return book.get(bookKey(levelId, difficulty)) ?? null;
}

export interface RecordOutcome {
  /** Record de score après cette partie. */
  readonly best: number;
  /** Cette partie vient de battre le record de score (ou d'en poser un premier). */
  readonly isNew: boolean;
}

/** Inscrit une partie TERMINÉE : le score et le temps progressent chacun de leur côté. */
export function submitRun(levelId: string, difficulty: Difficulty, score: number, seconds: number): RecordOutcome {
  const previous = recordFor(levelId, difficulty);
  const isNew = previous === null || score > previous.score;
  const next: LevelRecord = previous
    ? { score: Math.max(previous.score, score), seconds: Math.min(previous.seconds, seconds) }
    : { score, seconds };
  book.set(bookKey(levelId, difficulty), next);
  stored.save(Object.fromEntries(book));
  return { best: next.score, isNew };
}

/** Oublie tous les records — pour les tests. */
export function resetRecords(): void {
  book.clear();
}
