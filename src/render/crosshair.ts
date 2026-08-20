/**
 * Réticule permanent — repère de visée au centre exact de l'écran, absent du
 * jeu jusqu'au retour playtest (son ajouté juste avant) : « le tir est assez
 * hasardeux ... j'ai l'impression de ne pas toucher à bout portant ». Sans
 * réticule, le seul indicateur visuel de visée était le viewmodel
 * (`render/viewmodel.ts`), affiché en bas-droit de l'écran — décalé du
 * centre réel, donc trompeur pour estimer où pointe réellement `aimForward`.
 *
 * POURQUOI PAS REACT (invariant #2) : même raisonnement que
 * `render/hitmarker.ts` — ce module dessine directement sur un `<canvas>` 2D
 * dédié, mis à jour depuis `updateFx(realDt)`, jamais le pas fixe. Un
 * `setState` React ne changerait rien ici (le réticule est statique la
 * plupart du temps), mais le pattern doit rester cohérent avec le reste du
 * pipeline de rendu temps réel.
 *
 * CORRECTITUDE DE LA POSITION (pas un axe de variante — voir la doc de
 * `WeaponConfig.crosshairEnabled` dans `game/player/weaponConfig.ts`) : ce
 * module dessine TOUJOURS au centre géométrique exact du canvas interne
 * (`INTERNAL_WIDTH`×`INTERNAL_HEIGHT`, invariant #4). La caméra utilise une
 * projection perspective symétrique à ce même ratio d'aspect (aucun
 * `camera.setViewOffset` nulle part dans le projet), donc son axe optique
 * (`camera.getWorldDirection`, dérivé de la MÊME convention Euler 'YXZ' que
 * `WeaponSystem.computeAimBasis`) se projette TOUJOURS exactement au centre
 * du viewport — c'est une propriété géométrique de la projection, pas
 * quelque chose que ce module doit recalculer ou pourrait désaligner. Seul
 * le STYLE (croix/point, taille, épaisseur, couleur, pulsation au tir) est
 * tunable, voir `CROSSHAIR_VARIANTS`.
 *
 * DÉCOUPLAGE DÉLIBÉRÉ, même discipline que `hitmarker.ts`/`render/fx.ts` : ce
 * module n'importe rien de `game/*`, uniquement des nombres de config
 * (`CrosshairConfig`, structurellement compatible avec `WeaponConfig`).
 * `main.ts` fait le pont en appelant `notifyFire()` sur `weapons.fireEvents`.
 */

import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from "./renderer";

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

function hexToCss(hex: number): string {
  return `#${(hex & 0xffffff).toString(16).padStart(6, "0")}`;
}

export class CrosshairOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cfg: CrosshairConfig;

  // Enveloppe de pulsation 0..1 (1 = pic juste après un tir, décroît vers 0),
  // même mécanique que `recoilEnvelope` dans `weapons.ts` mais purement
  // cosmétique — décroît au dt RÉEL (jamais le pas fixe), voir `update`.
  private pulseEnvelope = 0;

  constructor(container: HTMLElement, cfg: CrosshairConfig) {
    this.cfg = cfg;

    const canvas = document.createElement("canvas");
    canvas.id = "crosshair";
    canvas.width = INTERNAL_WIDTH;
    canvas.height = INTERNAL_HEIGHT;
    // Même contrat CSS que `canvas#game`/`canvas#hitmarker` (voir
    // `index.html`/`hitmarker.ts`) : plein écran, aucune interception de
    // pointeur, filtrage au plus proche (invariant #4/#5).
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
      throw new Error("[crosshair] impossible d'obtenir un contexte 2D pour l'overlay");
    }
    this.canvas = canvas;
    this.ctx = ctx;
  }

  /**
   * À appeler à CHAQUE tir réellement déclenché (`weapons.fireEvents`),
   * quelle que soit l'arme et indépendamment d'un hit — contrairement à
   * `HitmarkerOverlay.trigger`, qui ne confirme qu'un hit ennemi. No-op si le
   * réticule ou sa pulsation est désactivé(e).
   */
  notifyFire() {
    if (!this.cfg.crosshairEnabled || !this.cfg.crosshairPulseEnabled) return;
    this.pulseEnvelope = 1;
  }

  /** À appeler UNE FOIS PAR FRAME D'AFFICHAGE avec le delta temps réel, jamais `FIXED_DT` — même contrat que `HitmarkerOverlay.update`. */
  update(realDt: number) {
    if (this.pulseEnvelope <= 0) return;
    const duration = Math.max(this.cfg.crosshairPulseDuration, 1e-4);
    this.pulseEnvelope = Math.max(0, this.pulseEnvelope - realDt / duration);
  }

  /** Redessine l'overlay. À appeler après `update()`, une fois par frame. No-op (canvas effacé) si le réticule est désactivé. */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.cfg.crosshairEnabled) return;

    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const scale = this.cfg.crosshairPulseEnabled
      ? 1 + (this.cfg.crosshairPulseScale - 1) * this.pulseEnvelope
      : 1;

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

  /** Retire le canvas du DOM. Non utilisé en jeu normal, présent pour un futur écran de menu/nettoyage de test — même contrat que `HitmarkerOverlay.dispose`. */
  dispose() {
    this.canvas.remove();
  }
}
