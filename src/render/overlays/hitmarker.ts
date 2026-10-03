// see: docs/6-reference/notes-code-rendu.md#overlays-et-diagnostic

import { createCanvasOverlay, hexToCss } from "./canvasOverlay";

export interface HitmarkerConfig {
  hitmarkerEnabled: boolean;
  hitmarkerDuration: number;
  hitmarkerSize: number;
  hitmarkerThickness: number;
  hitmarkerColor: number;
  hitmarkerKillDuration: number;
  hitmarkerKillSize: number;
  hitmarkerKillThickness: number;
  hitmarkerKillColor: number;
}

type HitmarkerKind = "hit" | "kill";

interface ActiveMarker {
  kind: HitmarkerKind;

  remaining: number;
  // Durée totale de CE déclenchement (pour calculer une fraction de decay au rendu).
  totalDuration: number;
}

export class HitmarkerOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cfg: HitmarkerConfig;

  // Fenêtres distinctes : kill doit rester visible au-dessus de hit.
  private hit: ActiveMarker | null = null;
  private kill: ActiveMarker | null = null;

  constructor(container: HTMLElement, cfg: HitmarkerConfig) {
    this.cfg = cfg;

    const { canvas, ctx } = createCanvasOverlay(container, "hitmarker");
    this.canvas = canvas;
    this.ctx = ctx;
  }

  trigger(kind: HitmarkerKind) {
    if (!this.cfg.hitmarkerEnabled) return;
    const duration = kind === "kill" ? this.cfg.hitmarkerKillDuration : this.cfg.hitmarkerDuration;
    const marker: ActiveMarker = { kind, remaining: duration, totalDuration: duration };
    if (kind === "kill") this.kill = marker;
    else this.hit = marker;
  }

  // Delta réel d’affichage, jamais FIXED_DT.
  update(realDt: number) {
    if (this.hit) {
      this.hit.remaining -= realDt;
      if (this.hit.remaining <= 0) this.hit = null;
    }
    if (this.kill) {
      this.kill.remaining -= realDt;
      if (this.kill.remaining <= 0) this.kill = null;
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.cfg.hitmarkerEnabled) return;

    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    // Dessiner kill en dernier préserve sa priorité après un hit proche.
    if (this.hit) this.drawMarker(ctx, cx, cy, this.hit, this.cfg.hitmarkerSize, this.cfg.hitmarkerThickness, this.cfg.hitmarkerColor);
    if (this.kill) this.drawMarker(ctx, cx, cy, this.kill, this.cfg.hitmarkerKillSize, this.cfg.hitmarkerKillThickness, this.cfg.hitmarkerKillColor);
  }

  private drawMarker(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    marker: ActiveMarker,
    size: number,
    thickness: number,
    color: number,
  ) {
    const life = Math.max(0, Math.min(1, marker.remaining / marker.totalDuration));

    ctx.globalAlpha = life;
    ctx.strokeStyle = hexToCss(color);
    ctx.lineWidth = thickness;
    ctx.lineCap = "square";

    const gap = size * 0.35;
    const outer = size;
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

    ctx.globalAlpha = 1;
  }

  dispose() {
    this.canvas.remove();
  }
}
