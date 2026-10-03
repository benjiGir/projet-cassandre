import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from "./renderer";

export function createCanvasOverlay(container: HTMLElement, id: string) {
  const canvas = document.createElement("canvas");
  canvas.id = id;
  canvas.className = "game-overlay";
  canvas.width = INTERNAL_WIDTH;
  canvas.height = INTERNAL_HEIGHT;
  canvas.style.pointerEvents = "none";

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(`[${id}] impossible d'obtenir un contexte 2D pour l'overlay`);
  container.appendChild(canvas);
  return { canvas, ctx };
}

export function hexToCss(hex: number): string {
  return `#${(hex & 0xffffff).toString(16).padStart(6, "0")}`;
}
