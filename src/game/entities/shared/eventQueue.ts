/** Ce qu'un lecteur voit d'une file : tout ce qui attend d'être présenté, et la part émise au dernier pas fixe. */
export interface StepEvents<T> {
  /** Tout ce qui s'est accumulé depuis la dernière présentation — plusieurs pas fixes pour une image. */
  readonly all: readonly T[];
  /** Nombre d'événements émis depuis le dernier `beginStep`. */
  readonly stepCount: number;
  /** Le `index`-ième événement émis depuis le dernier `beginStep`. */
  stepAt(index: number): T | undefined;
}

// see: docs/decisions/0010-curseur-evenements-multi-pas-fixe.md
export class EventQueue<T> implements StepEvents<T> {
  private readonly items: T[] = [];
  private stepStart = 0;

  get all(): readonly T[] {
    return this.items;
  }

  get stepCount(): number {
    return this.items.length - this.stepStart;
  }

  stepAt(index: number): T | undefined {
    return this.items[this.stepStart + index];
  }

  push(event: T): void {
    this.items.push(event);
  }

  /** Début d'un pas fixe : ce qui est déjà en file appartient aux pas précédents. */
  beginStep(): void {
    this.stepStart = this.items.length;
  }

  /** Après présentation, une fois par image. */
  clear(): void {
    this.items.length = 0;
    this.stepStart = 0;
  }
}
