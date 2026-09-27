/**
 * Overlay de la vue par caméra (chantier « Les coulisses », système 4) :
 * bruit + scanlines + étiquette par-dessus le rendu WebGL pendant qu'une
 * console de vidéosurveillance est active — même patron que
 * `CrosshairOverlay`/`HitmarkerOverlay` (canvas 2D 640×360 hors React, voir
 * leur doc de tête), jamais du post-processing 3D (pas de bloom global, pas
 * de shader plein écran sur le rendu principal : cet effet est DIÉGÉTIQUE,
 * propre à l'écran de la console, pas au jeu entier).
 *
 * Le second rendu à 640×360 lui-même (le joueur qui voit par les yeux d'une
 * caméra fixe du niveau au lieu des siens) est la responsabilité de
 * l'appelant : `main.ts` substitue la caméra/transform utilisée par
 * `RenderService.render` pendant que `CameraViewSystem.active` est vrai, PUIS
 * appelle cet overlay — deux étapes bien séparées, comme le rendu et le
 * hitmarker aujourd'hui.
 *
 * Bruit dérivé d'un hash déterministe (jamais `Math.random()`, invariant
 * #12) sur un compteur de frame avancé au dt RÉEL — un scintillement
 * cosmétique n'a pas besoin du RNG de gameplay `DeterministicRandom` : rien
 * ici n'influence une décision rejouable.
 */

import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from "./renderer";

/** Hash 2D déterministe, sans état — même formule que le bruit procédural
 * classique (sinus + partie fractionnaire), jamais `Math.random()`. */
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
    const canvas = document.createElement("canvas");
    canvas.id = "camera-view";
    canvas.className = "game-overlay";
    canvas.width = INTERNAL_WIDTH;
    canvas.height = INTERNAL_HEIGHT;
    canvas.style.pointerEvents = "none";
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("[camera-view] impossible d'obtenir un contexte 2D pour l'overlay");
    this.canvas = canvas;
    this.ctx = ctx;
  }

  /** À appeler UNE FOIS PAR FRAME D'AFFICHAGE avec le dt RÉEL, jamais le pas
   * fixe — même contrat que `CrosshairOverlay.update` : le grésillement de
   * l'écran est un effet cosmétique, pas une horloge de gameplay. */
  update(realDt: number): void {
    this.clockSeconds += realDt;
  }

  /**
   * Redessine l'overlay. `active=false` efface tout (canvas transparent, le
   * rendu du jeu normal se voit sans rien par-dessus).
   */
  render(active: boolean, label: string | null): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!active) return;

    // Bruit : une grille grossière (NOISE_CELL px) plutôt que pixel par
    // pixel — un CCTV rétro grésille par blocs, pas par photosite, et ça
    // reste bon marché à 640×360.
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

    // Scanlines : une ligne sombre sur deux, immobile — le trait qui dit
    // « écran », pas un vrai balayage entrelacé (coût nul, effet suffisant).
    ctx.fillStyle = "#000000";
    ctx.globalAlpha = SCANLINE_ALPHA;
    for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 1;

    // Vignette + étiquette, coin haut-gauche façon Duke Nukem 3D.
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
