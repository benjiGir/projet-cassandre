/**
 * Hitmarker — confirmation de hit à l'écran, INDÉPENDANTE de la lisibilité du
 * sprite touché. Nouveau canal de feedback, absent du jeu jusqu'au retour
 * playtest Phase 3 (« la sensation de tir et de touché n'est pas bonne »).
 *
 * POURQUOI PAS REACT (invariant #2) : un marqueur de hit doit apparaître en
 * UN frame d'affichage et durer ~100-150 ms — largement sous le throttle
 * 10 Hz du HUD React (`DebugPanel`/`game/state.ts`). Un `setState` par hit
 * suivi d'un re-render à cette cadence produirait un marqueur en retard et
 * saccadé, pas une confirmation nette. Ce module dessine directement sur un
 * `<canvas>` 2D dédié, mis à jour depuis `updateFx(realDt)` — même régime
 * temps réel que `FxSystem.update(realDt)` et `BillboardSprite.updateFlash`,
 * jamais le pas fixe.
 *
 * DÉCOUPLAGE DÉLIBÉRÉ, même discipline que `render/fx.ts`/`render/billboard.ts` :
 * ce module n'importe rien de `game/*`, uniquement des primitives
 * (`"hit" | "kill"`, des nombres de config). `main.ts` fait le pont en
 * appelant `trigger("hit")` sur `weapons.hitEvents` (matière ENEMY
 * uniquement — un hit mur n'a pas vocation à alimenter le hitmarker, c'est
 * un canal de confirmation de DÉGÂT, pas d'impact générique) et
 * `trigger("kill")` sur `suitManager.deathEvents`.
 *
 * RÉSOLUTION INTERNE : dessine dans le même espace que le rendu 3D
 * (`INTERNAL_WIDTH`×`INTERNAL_HEIGHT`, invariant #4), positionné en CSS
 * exactement comme `canvas#game` (100vw/100vh, `image-rendering: pixelated`)
 * — le marqueur reste donc centré et à l'échelle du rendu rétro quelle que
 * soit la taille de fenêtre, sans recalcul de coordonnées ici.
 */

import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from "./renderer";

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
  /** Secondes restantes avant extinction. */
  remaining: number;
  /** Durée totale de CE déclenchement (pour calculer une fraction de decay au rendu). */
  totalDuration: number;
}

function hexToCss(hex: number): string {
  return `#${(hex & 0xffffff).toString(16).padStart(6, "0")}`;
}

export class HitmarkerOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cfg: HitmarkerConfig;

  // Un marqueur "kill" prime visuellement sur un marqueur "hit" s'ils se
  // chevauchent (voir `render`) — mais les deux ont leur propre minuteur,
  // jamais de sommation d'intensité (même discipline que
  // `FxSystem.triggerShake`/`BillboardSprite.setFlash`).
  private hit: ActiveMarker | null = null;
  private kill: ActiveMarker | null = null;

  constructor(container: HTMLElement, cfg: HitmarkerConfig) {
    this.cfg = cfg;

    const canvas = document.createElement("canvas");
    canvas.id = "hitmarker";
    canvas.width = INTERNAL_WIDTH;
    canvas.height = INTERNAL_HEIGHT;
    // Même contrat CSS que `canvas#game` (voir `index.html`) : plein écran,
    // aucune interception de pointeur (le hitmarker est purement décoratif),
    // filtrage au plus proche pour rester dans l'identité visuelle rétro
    // (invariant #4/#5).
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.display = "block";
    canvas.style.pointerEvents = "none";
    canvas.style.imageRendering = "pixelated";
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("[hitmarker] impossible d'obtenir un contexte 2D pour l'overlay");
    }
    this.canvas = canvas;
    this.ctx = ctx;
  }

  /** Déclenche (ou renforce) un marqueur. `"kill"` a sa PROPRE fenêtre, distincte de `"hit"` — un kill est aussi un hit, mais `main.ts` n'a besoin d'appeler que `trigger("kill")` pour ce coup-là (voir son câblage). */
  trigger(kind: HitmarkerKind) {
    if (!this.cfg.hitmarkerEnabled) return;
    const duration = kind === "kill" ? this.cfg.hitmarkerKillDuration : this.cfg.hitmarkerDuration;
    const marker: ActiveMarker = { kind, remaining: duration, totalDuration: duration };
    if (kind === "kill") this.kill = marker;
    else this.hit = marker;
  }

  /** À appeler UNE FOIS PAR FRAME D'AFFICHAGE avec le delta temps réel (même hook que `FxSystem.update(realDt)`), jamais `FIXED_DT`. */
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

  /** Redessine l'overlay. À appeler après `update()`, une fois par frame. No-op (canvas effacé) si rien n'est actif ou si le hitmarker est désactivé. */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.cfg.hitmarkerEnabled) return;

    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    // Le hit simple se dessine d'abord, le kill PAR-DESSUS s'il est actif en
    // même temps — un kill doit rester visible même si un hit tout juste
    // précédent (même pas fixe, plomb n-1 blessé puis plomb n tué) est encore
    // en train de s'effacer.
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
    // Fraction de vie linéaire [0..1], 1 = pleine intensité à l'apparition.
    // Décroissance LINÉAIRE (pas exponentielle comme le flash/shake) : un
    // hitmarker est un signal discret, pas un fondu — il doit rester net
    // jusqu'à disparaître, pas s'estomper en douceur.
    const life = Math.max(0, Math.min(1, marker.remaining / marker.totalDuration));

    ctx.globalAlpha = life;
    ctx.strokeStyle = hexToCss(color);
    ctx.lineWidth = thickness;
    ctx.lineCap = "square";

    // Croix à 4 branches, gap central (jamais un + plein qui se confondrait
    // avec le point de visée du niveau de base — pas de crosshair permanent
    // dans ce prototype, mais garde la convention standard FPS au cas où).
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

  /** Retire le canvas du DOM. Non utilisé en jeu normal (le hitmarker vit toute la session), présent pour un futur écran de menu/nettoyage de test. */
  dispose() {
    this.canvas.remove();
  }
}
