import type { LoopStats } from "../../../core/loop/loop";
import type { GameEngine } from "../../session/gameEngine";
import type { GameSession } from "../../session/gameSession";

/** Ce que chaque étape de présentation d'une image reçoit. */
export interface FxFrame {
  readonly engine: GameEngine;
  readonly session: GameSession;
  /** Temps RÉEL écoulé depuis l'image précédente : la présentation ne suit pas le pas fixe. */
  readonly realDt: number;
  readonly stats: LoopStats;
}
