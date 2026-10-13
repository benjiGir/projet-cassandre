import { heroVoiceDuration, playAnnouncementVoice, playHeroVoice } from "../../../core/audio/heroVoice";
import { subtitlesEnabled } from "../../settings/audioSettings";
import { useGameStore } from "../../hud/state";
import {
  HERO_LINES,
  OPENING_LINES,
  heroVoiceKey,
  type HeroBarkId,
  type HeroLineDef,
  type HeroLineId,
} from "../presentation/heroLines";
import { publishLevelRecap } from "../progression/recap";
import { recordHpLost } from "../progression/score";
import type { GameSession } from "../gameSession";
import type { GameEngine } from "../gameEngine";
const HUD_MESSAGE_DURATION_MS = 1800;

// see: docs/archive/systems-session.md#feedback-joueur
export function showHudMessage(text: string): void {
  useGameStore.getState().showHudMessage(text);
  globalThis.setTimeout(() => {
    if (useGameStore.getState().hudMessage === text) {
      useGameStore.getState().showHudMessage(null);
    }
  }, HUD_MESSAGE_DURATION_MS);
}

const ANNOUNCEMENT_DISPLAY_MS = 4500;

/** Annonce du magasin ou de l'interphone : remplace la précédente, s'efface seule. `voix` : la prise à jouer, si l'annonce est enregistrée. */
export function showAnnouncement(speaker: string, text: string, voice?: string): void {
  const announcement = { speaker, text };
  useGameStore.getState().showAnnouncement(announcement);
  if (voice) playAnnouncementVoice(voice);
  const displayMs = Math.max(ANNOUNCEMENT_DISPLAY_MS, (voice ? (heroVoiceDuration(voice) ?? 0) : 0) * 1000);
  globalThis.setTimeout(() => {
    if (useGameStore.getState().announcement === announcement) {
      useGameStore.getState().showAnnouncement(null);
    }
  }, displayMs);
}

// see: docs/6-reference/notes-code-gameplay.md#feedback-et-récap
const HERO_LINE_COOLDOWN_MS = 15000;
const HERO_LINE_DISPLAY_MS = 4000;
const HERO_LINE_TAIL_MS = 600;
/** Écart minimal entre deux cris (douleur, réception) — un cri par coup encaissé serait une mitraillette. */
const HERO_BARK_MIN_INTERVAL_MS = 1500;

let shownLineSerial = 0;
/** La partie précédente s'est-elle terminée par la mort du héros ? Choisit la réplique d'ouverture. */
let previousRunLost = false;

export function triggerHeroLine(session: GameSession, id: HeroLineId): boolean {
  const def: HeroLineDef = HERO_LINES[id];
  if (def.once && session.run.heroLinesSaid.has(id)) return false;
  // Sans voix ni sous-titres, il ne resterait qu'un portrait qui remue les lèvres.
  if (def.textOnly && !subtitlesEnabled()) return false;
  const now = session.run.stats.gameplayElapsed * 1000;
  if (!def.priority) {
    if (now - session.run.lastHeroLineAt < HERO_LINE_COOLDOWN_MS) return false;
    if (def.chance !== undefined && session.run.heroLineRandom() >= def.chance) return false;
  }
  session.run.heroLinesSaid.add(id);
  session.run.lastHeroLineAt = now;

  const voice = heroVoiceKey(id);
  const displayMs = Math.max(HERO_LINE_DISPLAY_MS, (heroVoiceDuration(voice) ?? 0) * 1000 + HERO_LINE_TAIL_MS);
  playHeroVoice(voice);
  session.heroPortrait.speak(displayMs / 1000);
  // Sous-titres coupés (Options › Audio) : la voix seule, le canal texte reste vide.
  useGameStore.getState().showHeroLine(subtitlesEnabled() ? def.text : null);
  const line = ++shownLineSerial;
  globalThis.setTimeout(() => {
    // Une réplique prioritaire a pu couper celle-ci : c'est à la sienne de
    // rendre la main, pas à celle qu'elle a interrompue.
    if (line !== shownLineSerial) return;
    useGameStore.getState().showHeroLine(null);
  }, displayMs);
  return true;
}

export function triggerHeroBark(session: GameSession, id: HeroBarkId): void {
  const now = session.run.stats.gameplayElapsed * 1000;
  if (now - session.run.lastHeroLineAt < HERO_LINE_DISPLAY_MS) return;
  if (now - session.run.lastHeroBarkAt < HERO_BARK_MIN_INTERVAL_MS) return;
  session.run.lastHeroBarkAt = now;
  playHeroVoice(heroVoiceKey(id));
}

/** Délai de gameplay avant la réplique d'ouverture : le joueur a le temps de voir où il est. */
const OPENING_LINE_DELAY_SECONDS = 1.5;

/** Réplique d'ouverture, une fois par partie : « nouvelle tentative » si la précédente s'est finie par la mort. */
export function sayOpeningLine(session: GameSession): void {
  if (session.run.stats.gameplayElapsed < OPENING_LINE_DELAY_SECONDS) return;
  const opening = OPENING_LINES[session.choice.textes ?? "magasin"];
  if (session.run.heroLinesSaid.has(opening) || session.run.heroLinesSaid.has("nouvelle_tentative")) return;
  triggerHeroLine(session, previousRunLost ? "nouvelle_tentative" : opening);
}

/** Retient l'issue de la partie pour la réplique d'ouverture de la suivante. */
export function noteRunOutcome(died: boolean): void {
  previousRunLost = died;
}

// Seuil de la réplique "PV bas" — fraction de `playerMaxHp`, PREMIER
// franchissement DE LA PARTIE seulement (`session.run.lowHpLineTriggered`,
// remis à `false` par `bootGameSession` à chaque nouvelle partie).
const LOW_HP_HERO_LINE_THRESHOLD = 0.3;
/** Un coup d'au moins ce montant arrache le cri fort plutôt que le petit. */
const HEAVY_HIT_DAMAGE = 10;

/** Résout les PV et la mort dans le pas fixe. Aucun effet visuel ou timer mural. */
export function applyPlayerDamage(
  engine: GameEngine,
  session: GameSession,
  amount: number,
  normal?: { readonly x: number; readonly z: number },
  source: "suit" | "director" | "train" | "controleur" = "suit",
): void {
  const hpBefore = session.run.playerHp;
  session.run.playerHp = Math.max(0, session.run.playerHp - Math.max(0, amount));
  recordHpLost(session.run.stats, hpBefore - session.run.playerHp);
  if (amount > 0) session.run.stats.lastDamageSource = source;

  const maxHp = session.run.playerMaxHp;
  const lateral = normal ? normal.x * Math.cos(engine.look.yaw) - normal.z * Math.sin(engine.look.yaw) : 0;
  session.heroPortrait.damage(
    session.run.playerHp,
    maxHp,
    lateral < -0.25 ? "left" : lateral > 0.25 ? "right" : "front",
  );
  if (
    session.run.playerHp > 0 &&
    !session.run.lowHpLineTriggered &&
    session.run.playerHp / maxHp <= LOW_HP_HERO_LINE_THRESHOLD
  ) {
    session.run.lowHpLineTriggered = true;
    triggerHeroLine(session, "pv_bas");
  } else if (
    session.run.playerHp > 0 &&
    amount > 0 &&
    !triggerHeroLine(session, source === "director" ? "boss_touche_hero" : "touche")
  ) {
    triggerHeroBark(
      session,
      amount >= HEAVY_HIT_DAMAGE || session.run.playerHp / maxHp <= LOW_HP_HERO_LINE_THRESHOLD
        ? "douleur_forte"
        : "douleur_legere",
    );
  }

  if (!session.run.deathHandled && session.run.playerHp <= 0) {
    session.run.deathHandled = true;
    if (source === "train") session.run.stats.trainDeaths++;
    if (!(source === "train" && triggerHeroLine(session, "metro_mort_rame"))) triggerHeroLine(session, "mort_hero");
    noteRunOutcome(true);
    publishLevelRecap(session, false);
    engine.flow.playerDied();
  }
}

/** Publie les PV et les retours perceptifs, au taux d'affichage. */
export function presentPlayerDamage(playerHp: number): void {
  useGameStore.getState().setPlayerHp(playerHp);
}
