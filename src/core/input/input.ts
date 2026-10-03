import { DEFAULT_BINDINGS } from "./inputBindings";
import { loadStoredBindings, saveStoredBindings } from "./inputPersistence";
import type { GameAction } from "./inputTypes";

// see: docs/6-reference/notes-code-core.md#entrées
class InputManager {
  private keysDown = new Set<string>();

  private edgesPendingFixedStep = new Set<string>();

  private edgesThisDisplayFrame = new Set<string>();

  private mouseDeltaX = 0;
  private mouseDeltaY = 0;

  private canvas: HTMLCanvasElement | null = null;
  private pointerLocked = false;

  private fixedStepsThisFrame = 0;

  private bindings: Record<GameAction, string> = loadStoredBindings();

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    canvas.addEventListener("click", this.requestPointerLock);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.keysDown.has(e.code)) {
      this.edgesPendingFixedStep.add(e.code);
      this.edgesThisDisplayFrame.add(e.code);
    }
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.mouseDeltaX += e.movementX;
    this.mouseDeltaY += e.movementY;
  };

  private onMouseDown = (e: MouseEvent) => {
    // Le clic qui obtient le verrouillage ne doit pas tirer.
    if (!this.pointerLocked) return;
    const code = e.button === 0 ? "Mouse0" : e.button === 2 ? "Mouse2" : null;
    if (!code) return;
    if (!this.keysDown.has(code)) {
      this.edgesPendingFixedStep.add(code);
      this.edgesThisDisplayFrame.add(code);
    }
    this.keysDown.add(code);
  };

  private onMouseUp = (e: MouseEvent) => {
    const code = e.button === 0 ? "Mouse0" : e.button === 2 ? "Mouse2" : null;
    if (!code) return;
    // Toujours accepter le relâchement, même après la perte du verrouillage.
    this.keysDown.delete(code);
  };

  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  private requestPointerLock = () => {
    this.canvas?.requestPointerLock().catch(() => {
    });
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  isDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  // Lecture non destructive réservée à l’affichage ; interdite dans le pas fixe.
  wasJustPressed(code: string): boolean {
    return this.edgesThisDisplayFrame.has(code);
  }

  // Lecture destructive du pas fixe : un appui ne déclenche qu’une action.
  consumeJustPressed(code: string): boolean {
    return this.edgesPendingFixedStep.delete(code);
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  requestPointerLockNow(): void {
    this.requestPointerLock();
  }

  clearPendingEdges(): void {
    this.edgesPendingFixedStep.clear();
    this.edgesThisDisplayFrame.clear();
  }

  // Lire une fois par image, hors du pas fixe, pour ne pas ajouter de latence de visée.
  consumeMouseDelta(): { dx: number; dy: number } {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }


  isActionDown(action: GameAction): boolean {
    return this.isDown(this.bindings[action]);
  }

  consumeActionJustPressed(action: GameAction): boolean {
    return this.consumeJustPressed(this.bindings[action]);
  }

  // Réservé à l’affichage ; ne jamais lire ces fronts dans le pas fixe.
  wasActionJustPressed(action: GameAction): boolean {
    return this.wasJustPressed(this.bindings[action]);
  }

  getBinding(action: GameAction): string {
    return this.bindings[action];
  }

  getAllBindings(): Record<GameAction, string> {
    return { ...this.bindings };
  }

  // Réglage hors simulation ; les conflits de touches relèvent de l’interface.
  rebind(action: GameAction, code: string) {
    this.bindings = { ...this.bindings, [action]: code };
    saveStoredBindings(this.bindings);
  }

  resetBindings() {
    this.bindings = { ...DEFAULT_BINDINGS };
    saveStoredBindings(this.bindings);
  }

  beginFrame() {
    this.fixedStepsThisFrame = 0;
  }

  beginFixedStep() {
    this.fixedStepsThisFrame++;
  }

  // Doit rester le dernier appel de l’image pour préserver les fronts d’affichage.
  endFrame() {
    this.edgesThisDisplayFrame.clear();
    if (this.fixedStepsThisFrame > 0) this.edgesPendingFixedStep.clear();
  }
}

export const input = new InputManager();
