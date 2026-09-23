import { duckMusicForHeroLine, restoreMusicVolume } from "../../core/music";
import { useGameStore } from "../state";
import { type GameSession } from "./gameSession";
import { type GameEngine } from "./gameEngine";

const HUD_MESSAGE_DURATION_MS = 1800;

/**
 * Message HUD transitoire SYSTÈME (canal FACTUEL, sans cooldown,
 * indépendant de toute partie en cours) — voir `triggerHeroLine` ci-dessous
 * pour l'autre canal, celui des répliques.
 * see: docs/systems/session.md#feedback-joueur
 */
export function showHudMessage(text: string): void {
  useGameStore.getState().showHudMessage(text);
  window.setTimeout(() => {
    if (useGameStore.getState().hudMessage === text) {
      useGameStore.getState().showHudMessage(null);
    }
  }, HUD_MESSAGE_DURATION_MS);
}

// Cooldown global de 15 s MINIMUM entre deux répliques du héros, quelle
// que soit la source (règle explicite du skill `audio-sfx-pipeline` — Duke
// 3D lui-même souffre de l'enchaînement de one-liners). Durée d'affichage
// volontairement plus longue que `HUD_MESSAGE_DURATION_MS` (1.8 s) : une
// réplique "parlée" se lit plus lentement qu'un toast factuel court —
// valeur de confort, pas un choix de tuning arrêté.
const HERO_LINE_COOLDOWN_MS = 15000;
const HERO_LINE_DISPLAY_MS = 4000;

/**
 * Tente d'afficher une réplique du héros (`state.heroLine`) — TOUTES les
 * répliques du jeu passent par cette fonction. Respecte le cooldown global,
 * PROPRE À `session` : retourne `false` sans effet si non écoulé.
 * see: docs/systems/session.md#feedback-joueur
 * see: docs/systems/hud-audio.md#ducking-pendant-les-répliques
 */
export function triggerHeroLine(session: GameSession, text: string): boolean {
  const now = performance.now();
  if (now - session.lastHeroLineAt < HERO_LINE_COOLDOWN_MS) return false;
  session.lastHeroLineAt = now;
  useGameStore.getState().showHeroLine(text);
  duckMusicForHeroLine();
  window.setTimeout(() => {
    if (useGameStore.getState().heroLine === text) {
      useGameStore.getState().showHeroLine(null);
    }
    restoreMusicVolume();
  }, HERO_LINE_DISPLAY_MS);
  return true;
}

// Compteur de "vues" (Phase 6, voir `debug.views` dans `game/state.ts`) —
// gain ALÉATOIRE par kill (le gag du "clip qui buzz" disproportionné),
// plage et multiplicateur ARBITRAIRES. `Math.random()` ici est SANS
// CONSÉQUENCE sur le déterminisme du pas fixe : cette fonction n'est
// appelée que depuis les boucles `deathEvents`, lues au TAUX D'AFFICHAGE
// dans `game/loop/updateFx.ts` (jamais depuis `updateGameplay`).
const VIEWS_GAIN_MIN = 40;
const VIEWS_GAIN_MAX = 200;
/** "La plus grosse révélation de la chaîne" mérite un pic plus marqué qu'un Costard ordinaire — utilisé par `game/loop/updateFx.ts` pour le kill du Directeur. */
export const VIEWS_DIRECTOR_MULTIPLIER = 4;

export function grantKillViews(multiplier = 1): void {
  const gain = Math.round((VIEWS_GAIN_MIN + Math.random() * (VIEWS_GAIN_MAX - VIEWS_GAIN_MIN)) * multiplier);
  useGameStore.getState().incrementViews(gain);
}

// Seuil de la réplique "PV bas" — fraction de `playerMaxHp`, PREMIER
// franchissement DE LA PARTIE seulement (`session.lowHpLineTriggered`,
// remis à `false` par `bootGameSession` à chaque nouvelle partie).
const LOW_HP_HERO_LINE_THRESHOLD = 0.3;
const HERO_LINE_LOW_HP = "Ça va, ÇA VA. Continuez de me suivre, c'est important.";

/**
 * Appelée juste après CHAQUE décrément de `session.playerHp` (Costard ET
 * Directeur, même contrat) : détecte, dans l'ordre, la réplique "PV bas"
 * puis la mort — un coup qui amène `playerHp` à 0 pile sous le seuil ne
 * déclenche PAS la réplique en plus de l'écran de mort, la mort prime.
 * `session.deathHandled` reste nécessaire malgré la garde de
 * `updateGameplay` : voir pourquoi.
 * see: docs/systems/session.md#feedback-joueur
 */
export function handlePlayerHit(engine: GameEngine, session: GameSession): void {
  const maxHp = useGameStore.getState().debug.playerMaxHp;
  if (!session.lowHpLineTriggered && session.playerHp > 0 && session.playerHp / maxHp <= LOW_HP_HERO_LINE_THRESHOLD) {
    session.lowHpLineTriggered = true;
    triggerHeroLine(session, HERO_LINE_LOW_HP);
  }
  if (!session.deathHandled && session.playerHp <= 0) {
    session.deathHandled = true;
    engine.flowActor.send({ type: "DIED" });
    // Libère le pointeur : l'écran de mort a besoin du curseur pour ses
    // boutons "Rejouer"/"Retour au menu principal" (voir `ui/screens/death/DeathScreen/DeathScreen.tsx`).
    document.exitPointerLock();
  }
}
