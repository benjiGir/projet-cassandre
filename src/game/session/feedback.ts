import { heroVoiceDuration, playHeroVoice } from "../../core/heroVoice";
import { duckMusicForHeroLine, restoreMusicVolume } from "../../core/music";
import { useGameStore } from "../state";
import { HERO_LINES, heroVoiceKey, type HeroBarkId, type HeroLineDef, type HeroLineId } from "./heroLines";
import { publishLevelRecap, recordHpLost } from "./score";
import { type GameSession } from "./gameSession";
import { type GameEngine } from "./gameEngine";

const HUD_MESSAGE_DURATION_MS = 1800;

/**
 * Message HUD transitoire SYSTÈME (canal FACTUEL, sans cooldown,
 * indépendant de toute partie en cours) — voir `triggerHeroLine` ci-dessous
 * pour l'autre canal, celui des répliques.
 * see: docs/archive/systems-session.md#feedback-joueur
 */
export function showHudMessage(text: string): void {
  useGameStore.getState().showHudMessage(text);
  globalThis.setTimeout(() => {
    if (useGameStore.getState().hudMessage === text) {
      useGameStore.getState().showHudMessage(null);
    }
  }, HUD_MESSAGE_DURATION_MS);
}

// Cooldown global de 15 s MINIMUM entre deux répliques du héros, quelle
// que soit la source (règle explicite du skill `audio-sfx-pipeline` — Duke
// 3D lui-même souffre de l'enchaînement de one-liners). Les répliques
// `priority` de `heroLines.ts` (cartes, secrets, Directeur…) passent outre.
// Durée d'affichage MINIMALE, allongée à la durée de la prise enregistrée :
// le sous-titre ne disparaît jamais avant la fin de la phrase.
const HERO_LINE_COOLDOWN_MS = 15000;
const HERO_LINE_DISPLAY_MS = 4000;
const HERO_LINE_TAIL_MS = 600;
/** Écart minimal entre deux cris (douleur, réception) — un cri par coup encaissé serait une mitraillette. */
const HERO_BARK_MIN_INTERVAL_MS = 1500;

let ligneAffichee = 0;
/** La partie précédente s'est-elle terminée par la mort du héros ? Choisit la réplique d'ouverture. */
let partiePrecedentePerdue = false;

/**
 * Tente de faire dire une réplique au héros : sous-titre (`state.heroLine`),
 * prise enregistrée, bouche du portrait et musique baissée. TOUTES les
 * répliques du jeu passent par cette fonction. Une réplique non prioritaire
 * respecte le cooldown global, PROPRE À `session`, puis sa probabilité
 * (`session.heroLineRandom`, invariant #12) ; retourne `false` sans effet si
 * elle ne se dit pas.
 * see: docs/archive/systems-session.md#feedback-joueur
 * see: docs/archive/systems-hud-audio.md#ducking-pendant-les-répliques
 */
export function triggerHeroLine(session: GameSession, id: HeroLineId): boolean {
  const def: HeroLineDef = HERO_LINES[id];
  if (def.once && session.heroLinesSaid.has(id)) return false;
  const now = session.stats.gameplayElapsed * 1000;
  if (!def.priority) {
    if (now - session.lastHeroLineAt < HERO_LINE_COOLDOWN_MS) return false;
    if (def.chance !== undefined && session.heroLineRandom() >= def.chance) return false;
  }
  session.heroLinesSaid.add(id);
  session.lastHeroLineAt = now;

  const voix = heroVoiceKey(id);
  const displayMs = Math.max(HERO_LINE_DISPLAY_MS, (heroVoiceDuration(voix) ?? 0) * 1000 + HERO_LINE_TAIL_MS);
  playHeroVoice(voix);
  session.heroPortrait.speak(displayMs / 1000);
  useGameStore.getState().showHeroLine(def.text);
  duckMusicForHeroLine();
  const ligne = ++ligneAffichee;
  globalThis.setTimeout(() => {
    // Une réplique prioritaire a pu couper celle-ci : c'est à la sienne de
    // rendre la main, pas à celle qu'elle a interrompue.
    if (ligne !== ligneAffichee) return;
    useGameStore.getState().showHeroLine(null);
    restoreMusicVolume();
  }, displayMs);
  return true;
}

/**
 * Cri court (douleur, réception) : voix seule, sans sous-titre ni cooldown de
 * réplique — jamais par-dessus une réplique qui se dit encore. Décidé au pas
 * fixe sur le seul temps de gameplay, sans tirage.
 */
export function triggerHeroBark(session: GameSession, id: HeroBarkId): void {
  const now = session.stats.gameplayElapsed * 1000;
  if (now - session.lastHeroLineAt < HERO_LINE_DISPLAY_MS) return;
  if (now - session.lastHeroBarkAt < HERO_BARK_MIN_INTERVAL_MS) return;
  session.lastHeroBarkAt = now;
  playHeroVoice(heroVoiceKey(id));
}

/** Délai de gameplay avant la réplique d'ouverture : le joueur a le temps de voir où il est. */
const OPENING_LINE_DELAY_SECONDS = 1.5;

/** Réplique d'ouverture, une fois par partie : « nouvelle tentative » si la précédente s'est finie par la mort. */
export function sayOpeningLine(session: GameSession): void {
  if (session.stats.gameplayElapsed < OPENING_LINE_DELAY_SECONDS) return;
  if (session.heroLinesSaid.has("depart") || session.heroLinesSaid.has("nouvelle_tentative")) return;
  triggerHeroLine(session, partiePrecedentePerdue ? "nouvelle_tentative" : "depart");
}

/** Retient l'issue de la partie pour la réplique d'ouverture de la suivante. */
export function noteRunOutcome(died: boolean): void {
  partiePrecedentePerdue = died;
}

// Compteur de "vues" (Phase 6, voir `debug.views` dans `game/state.ts`) —
// gain par kill (le gag du "clip qui buzz" disproportionné), décidé au pas
// fixe avec un flux dédié : le taux d'affichage n'influence pas l'audience.
const VIEWS_GAIN_MIN = 40;
const VIEWS_GAIN_MAX = 200;
/** "La plus grosse révélation de la chaîne" mérite un pic plus marqué qu'un Costard ordinaire. */
export const VIEWS_DIRECTOR_MULTIPLIER = 4;

export function grantKillViews(session: GameSession, multiplier = 1): void {
  const gain = Math.round((VIEWS_GAIN_MIN + session.viewsRandom() * (VIEWS_GAIN_MAX - VIEWS_GAIN_MIN)) * multiplier);
  useGameStore.getState().incrementViews(gain);
}

// Seuil de la réplique "PV bas" — fraction de `playerMaxHp`, PREMIER
// franchissement DE LA PARTIE seulement (`session.lowHpLineTriggered`,
// remis à `false` par `bootGameSession` à chaque nouvelle partie).
const LOW_HP_HERO_LINE_THRESHOLD = 0.3;
/** Un coup d'au moins ce montant arrache le cri fort plutôt que le petit. */
const HEAVY_HIT_DAMAGE = 10;

/** Résout les PV et la mort dans le pas fixe. Aucun effet visuel ou timer mural. */
export function applyPlayerDamage(engine: GameEngine, session: GameSession, amount: number,
  normal?: { readonly x: number; readonly z: number }, source: "suit" | "director" = "suit"): void {
  const hpBefore = session.playerHp;
  session.playerHp = Math.max(0, session.playerHp - Math.max(0, amount));
  recordHpLost(session.stats, hpBefore - session.playerHp);

  const maxHp = useGameStore.getState().debug.playerMaxHp;
  const lateral = normal ? normal.x * Math.cos(engine.look.yaw) - normal.z * Math.sin(engine.look.yaw) : 0;
  session.heroPortrait.damage(session.playerHp, maxHp, lateral < -.25 ? "left" : lateral > .25 ? "right" : "front");
  if (session.playerHp > 0 && !session.lowHpLineTriggered && session.playerHp / maxHp <= LOW_HP_HERO_LINE_THRESHOLD) {
    session.lowHpLineTriggered = true;
    triggerHeroLine(session, "pv_bas");
  } else if (session.playerHp > 0 && amount > 0
    && !triggerHeroLine(session, source === "director" ? "boss_touche_hero" : "touche")) {
    triggerHeroBark(session,
      amount >= HEAVY_HIT_DAMAGE || session.playerHp / maxHp <= LOW_HP_HERO_LINE_THRESHOLD ? "douleur_forte" : "douleur_legere");
  }

  if (!session.deathHandled && session.playerHp <= 0) {
    session.deathHandled = true;
    triggerHeroLine(session, "mort_hero");
    noteRunOutcome(true);
    publishLevelRecap(session, false);
    engine.flow.playerDied();
  }
}

/** Publie les PV et les retours perceptifs, au taux d'affichage. */
export function presentPlayerDamage(playerHp: number): void {
  useGameStore.getState().setPlayerHp(playerHp);
}
