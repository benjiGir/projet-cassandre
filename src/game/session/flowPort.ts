/** Capacités de flux nécessaires au jeu ; XState et le DOM restent dans l'application. */
export interface GameFlowPort {
  isPlaying(): boolean;
  isPhysicsLive(): boolean;
  playerDied(): void;
  levelCompleted(): void;
  pause(): void;
  resume(): void;
}
