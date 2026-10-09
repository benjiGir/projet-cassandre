// see: docs/6-reference/notes-code-rendu.md#overlays-et-diagnostic

import { createCanvasOverlay, hexToCss } from "./canvasOverlay";

export interface CrosshairConfig {
  crosshairEnabled: boolean;
  crosshairStyle: "cross" | "dot";
  crosshairSize: number;
  crosshairGap: number;
  crosshairThickness: number;
  crosshairDotRadius: number;
  crosshairColor: number;
  crosshairPulseEnabled: boolean;
  crosshairPulseScale: number;
  crosshairPulseDuration: number;
}

export class CrosshairOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cfg: CrosshairConfig;

  private pulseEnvelope = 0;

  constructor(container: HTMLElement, cfg: CrosshairConfig) {
    this.cfg = cfg;

    const { canvas, ctx } = createCanvasOverlay(container, "crosshair");
    this.canvas = canvas;
    this.ctx = ctx;
  }

  // Chaque tir accepté déclenche une pulsation, même sans hit ennemi.
  notifyFire() {
    if (!this.cfg.crosshairEnabled || !this.cfg.crosshairPulseEnabled) return;
    this.pulseEnvelope = 1;
  }

  // Delta réel d’affichage, jamais FIXED_DT.
  update(realDt: number) {
    if (this.pulseEnvelope <= 0) return;
    const duration = Math.max(this.cfg.crosshairPulseDuration, 1e-4);
    this.pulseEnvelope = Math.max(0, this.pulseEnvelope - realDt / duration);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.cfg.crosshairEnabled) return;

    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const scale = this.cfg.crosshairPulseEnabled ? 1 + (this.cfg.crosshairPulseScale - 1) * this.pulseEnvelope : 1;

    ctx.strokeStyle = hexToCss(this.cfg.crosshairColor);
    ctx.fillStyle = hexToCss(this.cfg.crosshairColor);
    ctx.lineWidth = this.cfg.crosshairThickness;
    ctx.lineCap = "square";

    if (this.cfg.crosshairStyle === "dot") {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0.5, this.cfg.crosshairDotRadius * scale), 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const gap = this.cfg.crosshairGap * scale;
    const outer = this.cfg.crosshairSize * scale;
    ctx.beginPath();
    ctx.moveTo(cx - outer, cy);
    ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy);
    ctx.lineTo(cx + outer, cy);
    ctx.moveTo(cx, cy - outer);
    ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap);
    ctx.lineTo(cx, cy + outer);
    ctx.stroke();
  }

  // Retire le canvas du DOM. Non utilisé en jeu normal, présent pour un futur écran de menu/nettoyage de test — même contrat que `HitmarkerOverlay.dispose`.
  dispose() {
    this.canvas.remove();
  }
}
