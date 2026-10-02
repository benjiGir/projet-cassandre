import { INITIAL_HERO_PORTRAIT } from "./portraitState";
import type { HeroPortraitReaction, HeroPortraitView } from "../hudTypes";
const PRIORITIES: Record<HeroPortraitReaction, number> = {
  idle: 0, talk: 10, focus: 20, victory: 30, heal: 35, discover: 40, hurt: 80, dead: 100,
};
const COLUMNS: Record<HeroPortraitReaction, number> = {
  idle: 0, hurt: 1, focus: 2, victory: 3, discover: 4, talk: 5, heal: 5, dead: 0,
};
const DURATIONS: Record<HeroPortraitReaction, number> = {
  idle: 0, talk: 4, focus: .3, victory: .8, heal: .7, discover: 1.1, hurt: .6, dead: Infinity,
};

/** Réactions et horloge au pas fixe ; le HUD ne lit que la dernière image résolue.
 * see: docs/journal/portrait-stream-2026-10.md */
export class HeroPortrait {
  private time = 0;
  private reaction: HeroPortraitReaction = "idle";
  private until = 0;
  private speakingUntil = 0;
  private previousHp = 100;
  private healthBand = 0;
  private impact = 0;
  private side: HeroPortraitView["side"] = "front";
  private lastKill = -Infinity;
  private killChain = 0;
  private _view: HeroPortraitView = INITIAL_HERO_PORTRAIT;

  get view(): HeroPortraitView { return this._view; }

  advance(dt: number, hp: number, maxHp: number): void {
    this.time += Math.max(0, dt);
    if (hp < this.previousHp) this.damage(hp, maxHp);
    else if (hp > this.previousHp) this.heal(hp, maxHp);
    this.setHealth(hp, maxHp);
    this.resolve();
  }

  damage(hp: number, maxHp: number, side: HeroPortraitView["side"] = "front"): void {
    const lost = this.previousHp - hp;
    this.setHealth(hp, maxHp);
    if (lost <= 0) return;
    this.impact++;
    this.side = side;
    this.react(hp <= 0 ? "dead" : "hurt", lost >= maxHp * .2 ? .85 : .6);
  }

  heal(hp: number, maxHp: number): void {
    this.setHealth(hp, maxHp);
    this.react("heal");
  }

  speak(duration = 4): void {
    this.speakingUntil = this.time + duration;
    this.resolve();
  }

  kill(count = 1): void {
    if (count <= 0) return;
    this.killChain = this.time - this.lastKill <= 2 ? this.killChain + count : count;
    this.lastKill = this.time;
    this.react("victory", this.killChain > 1 ? 1.2 : .8);
  }

  react(reaction: HeroPortraitReaction, duration = DURATIONS[reaction]): void {
    const active = this.time < this.until ? this.reaction : "idle";
    if (PRIORITIES[reaction] < PRIORITIES[active]) return;
    this.reaction = reaction;
    this.until = reaction === "dead" ? Infinity : this.time + duration;
    this.resolve();
  }

  private setHealth(hp: number, maxHp: number): void {
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    this.healthBand = ratio >= .8 ? 0 : ratio >= .6 ? 1 : ratio >= .4 ? 2 : ratio >= .2 ? 3 : 4;
    this.previousHp = hp;
    if (hp <= 0) {
      this.reaction = "dead";
      this.until = Infinity;
    }
  }

  private resolve(): void {
    let reaction = this.time < this.until ? this.reaction : "idle";
    if (reaction === "idle" && this.time < this.speakingUntil) reaction = "talk";
    let sheet: HeroPortraitView["sheet"] = "reactions";
    let column = COLUMNS[reaction];
    if (reaction === "dead") { sheet = "ambient"; column = 3; }
    else if (reaction === "talk" || reaction === "heal") column = Math.floor(this.time * 5) % 2 === 0 ? 5 : 0;
    else if (reaction === "idle") {
      const phase = this.time % 10;
      if ((phase >= 2.6 && phase < 2.8) || (phase >= 7.2 && phase < 7.4)) {
        sheet = "ambient"; column = 2;
      } else if (phase >= 4.0 && phase < 4.8) { sheet = "ambient"; column = 0; }
      else if (phase >= 8.2 && phase < 9.0 && this.healthBand === 0) { sheet = "ambient"; column = 1; }
    }
    this._view = {
      sheet, frame: this.healthBand * (sheet === "ambient" ? 4 : 6) + column,
      reaction, healthBand: this.healthBand, side: this.side, impact: this.impact,
      combo: reaction === "victory" && this.killChain > 1,
    };
  }
}
