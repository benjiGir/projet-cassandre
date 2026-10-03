// see: docs/6-reference/notes-code-rendu.md#overlays-et-diagnostic

import { createCanvasOverlay } from "./canvasOverlay";

// Hash 2D déterministe, sans état — même formule que le bruit procédural classique (sinus + partie fractionnaire), jamais `Math.random()`.
function hash2(x: number, y: number, seed: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

const SCANLINE_ALPHA = 0.35;
const NOISE_CELL = 4;
const NOISE_ALPHA = 0.12;

export class CameraViewOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private clockSeconds = 0;

  constructor(container: HTMLElement) {
    const { canvas, ctx } = createCanvasOverlay(container, "camera-view");
    this.canvas = canvas;
    this.ctx = ctx;
  }

  // Delta réel d’affichage, jamais FIXED_DT.
  update(realDt: number): void {
    this.clockSeconds += realDt;
  }

  // Redessine l'overlay. `active=false` efface tout (canvas transparent, le rendu du jeu normal se voit sans rien par-dessus).
  render(active: boolean, label: string | null): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!active) return;

    // Le bruit par blocs garde l’effet CCTV bon marché à 640×360.
    const seed = Math.floor(this.clockSeconds * 12); // ~12 tirages de bruit/s
    for (let y = 0; y < h; y += NOISE_CELL) {
      for (let x = 0; x < w; x += NOISE_CELL) {
        const n = hash2(x, y, seed);
        if (n < 0.06) {
          ctx.fillStyle = n < 0.03 ? "#000000" : "#ffffff";
          ctx.globalAlpha = NOISE_ALPHA;
          ctx.fillRect(x, y, NOISE_CELL, NOISE_CELL);
        }
      }
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#000000";
    ctx.globalAlpha = SCANLINE_ALPHA;
    for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 1;

    if (label) {
      ctx.font = "10px monospace";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#000000";
      ctx.globalAlpha = 0.6;
      ctx.fillRect(4, 4, ctx.measureText(label).width + 8, 14);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#5fe05f";
      ctx.fillText(label, 8, 6);
    }

    ctx.strokeStyle = "#000000";
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  dispose(): void {
    this.canvas.remove();
  }
}
