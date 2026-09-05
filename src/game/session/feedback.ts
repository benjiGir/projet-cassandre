import { duckMusicForHeroLine, restoreMusicVolume } from "../../core/music";
import { useGameStore } from "../state";
import { type GameSession } from "./gameSession";
import { type GameEngine } from "./gameEngine";

/**
 * Extraction du refactor de `main.ts` (2229 lignes → modules, 2026-09-05) :
 * `showHudMessage`/`triggerHeroLine`/`grantKillViews`/`handlePlayerHit`
 * déplacées telles quelles, `session`/`engine` en paramètres explicites au
 * lieu d'une fermeture sur le scope de `main()`.
 */

const HUD_MESSAGE_DURATION_MS = 1800;

/**
 * Affiche un message HUD transitoire SYSTÈME, effacé après
 * `HUD_MESSAGE_DURATION_MS` (sauf s'il a déjà été remplacé par un autre
 * message entre-temps). Canal FACTUEL (porte, badge, secret n/total...),
 * voir la doc de `hudMessage` dans `game/state.ts` pour la ligne de partage
 * avec `triggerHeroLine` ci-dessous — AUCUN cooldown ici, contrairement aux
 * répliques. Ne dépend d'aucune partie en cours (store global) : pas de
 * paramètre `session`.
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
 * Tente d'afficher une réplique du héros sur le canal DÉDIÉ
 * (`state.heroLine`, voir `ui/HeroLine.tsx`) — TOUTES les répliques du jeu
 * passent par cette fonction. Respecte le cooldown global — PROPRE À
 * `session` depuis le jalon M8 (`session.lastHeroLineAt`, voir sa doc) : une
 * réplique juste avant la mort ne doit pas geler le canal de la PROCHAINE
 * partie après "Rejouer". Retourne `false` sans effet si non écoulé.
 *
 * Ducking musique (-6 dB, remontée sur 400 ms) déclenché ICI. Le
 * `setTimeout` de restauration ne dépend d'AUCUN état de partie (juste du
 * texte affiché et du volume musique, tous deux globaux) : il reste
 * correct même si un reset survient pendant la fenêtre d'affichage.
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
 * Appelée juste après CHAQUE décrément de `session.playerHp` (boucles
 * `playerHitEvents` du Costard ET du Directeur, même contrat) — factorisé
 * pour ne pas dupliquer cette logique entre les deux. Détecte, dans
 * l'ordre : la réplique "PV bas" (premier franchissement de la partie), et
 * la mort. Un coup qui amène `playerHp` à 0 pile sous le seuil ne
 * déclenche PAS la réplique "PV bas" en plus de l'écran de mort
 * (`playerHp > 0` dans la condition ci-dessous) — la mort prime.
 *
 * Jalon M8 : envoie `DIED` à l'acteur de flux au lieu d'écrire
 * `state.isDead` directement (retiré de `game/state.ts`). L'idempotence
 * (`session.deathHandled`) reste nécessaire malgré la garde de
 * `updateGameplay` (`flowState !== "playing"` -> return) : PLUSIEURS
 * `playerHitEvents` peuvent arriver dans le MÊME pas fixe (deux Costards
 * qui touchent au même instant), or c'est `updateFx` (jamais gatée par le
 * flux — elle continue de drainer les files après la mort, voir sa doc)
 * qui les traite, un par un, dans la même frame — sans ce flag, le
 * deuxième appel enverrait un second `DIED` (no-op côté machine, la
 * transition n'existe pas depuis `dead`) et un second
 * `exitPointerLock()` (idempotent côté DOM) : inoffensif mais the flag
 * documente l'intention plutôt que de compter sur ces deux idempotences
 * accidentelles.
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
    // boutons "Rejouer"/"Retour au menu principal" (voir `DeathScreen.tsx`).
    document.exitPointerLock();
  }
}
