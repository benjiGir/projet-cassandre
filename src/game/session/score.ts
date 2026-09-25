import { useGameStore, type LevelRecap, type RecapLine } from "../state";
import { type GameSession } from "./gameSession";

/**
 * Récapitulatif de fin de partie : ce que le joueur a fait, traduit en
 * points. Compté AU PAS FIXE, dans `session.stats` (invariants #1/#12/#13 —
 * jamais `Date.now()`/`performance.now()`, jamais un évènement lu au taux
 * d'affichage) : `game/loop/updateGameplay.ts` avance `SessionStats` via les
 * fonctions `record*`/`advanceGameplayTime` ci-dessous, au même pas fixe que
 * les systèmes qu'il orchestre déjà.
 *
 * Ce module est PUR jusqu'à `publishLevelRecap` (qui, seule, touche le store
 * zustand) : `SessionStats`/`createInitialStats`/les `record*`/
 * `buildLevelRecap` ne dépendent ni de Three.js ni de Rapier ni du DOM —
 * testable avec de simples objets (`test/game/session/score.test.ts`).
 * see: docs/systems/session.md#récapitulatif-de-fin-de-partie
 */

export interface SessionStats {
  suitKills: number;
  directorKills: number;
  /** Un tir = un appui sur "tirer" qui a réellement déclenché l'arme (cooldown écoulé, munitions dispo) — jamais une tentative à sec. */
  shotsFired: number;
  /** Parmi `shotsFired`, ceux dont AU MOINS UN point d'impact touche un ennemi (`FLESH_MATERIAL`) — un coup de pompe est UN tir, qui touche si au moins un plomb touche. */
  shotsHitEnemy: number;
  propsDestroyed: number;
  vitresDestroyed: number;
  sanitairesDestroyed: number;
  /** Somme des `gameplayDt` (hitstop compris) depuis le début de la partie, secondes — jamais un chrono mural. */
  gameplayElapsed: number;
  /** PV perdus cumulés — informatif seulement dans le récap, ne rapporte aucun point. */
  hpLost: number;
}

export function createInitialStats(): SessionStats {
  return {
    suitKills: 0,
    directorKills: 0,
    shotsFired: 0,
    shotsHitEnemy: 0,
    propsDestroyed: 0,
    vitresDestroyed: 0,
    sanitairesDestroyed: 0,
    gameplayElapsed: 0,
    hpLost: 0,
  };
}

// --- Compteurs — appelés UNIQUEMENT depuis le pas fixe (`updateGameplay.ts`) ---
// Chacun mute `stats` en place plutôt que de retourner un objet neuf : même
// discipline que le reste de `GameSession` (`session.playerHp += ...`), pas
// une reconstruction par frame qui coûterait une allocation à 60 Hz pour rien.

export function advanceGameplayTime(stats: SessionStats, dt: number): void {
  stats.gameplayElapsed += dt;
}

export function recordSuitKills(stats: SessionStats, count: number): void {
  stats.suitKills += count;
}

export function recordDirectorKills(stats: SessionStats, count: number): void {
  stats.directorKills += count;
}

/** `hitEnemy` : au moins un point d'impact de CE tir a touché un ennemi. */
export function recordShot(stats: SessionStats, hitEnemy: boolean): void {
  stats.shotsFired += 1;
  if (hitEnemy) stats.shotsHitEnemy += 1;
}

export function recordPropsDestroyed(stats: SessionStats, count: number): void {
  stats.propsDestroyed += count;
}

export function recordVitresDestroyed(stats: SessionStats, count: number): void {
  stats.vitresDestroyed += count;
}

export function recordSanitairesDestroyed(stats: SessionStats, count: number): void {
  stats.sanitairesDestroyed += count;
}

export function recordHpLost(stats: SessionStats, amount: number): void {
  if (amount > 0) stats.hpLost += amount;
}

// --- Barème ---------------------------------------------------------------
// Constantes nommées, point de départ raisonnable plutôt qu'un tuning arrêté
// — voir le rapport de la tâche pour la justification de chaque valeur.

/** Un Costard neutralisé. */
export const SCORE_SUIT_KILL = 100;
/** Le Directeur — dix fois un Costard, cohérent avec `VIEWS_DIRECTOR_MULTIPLIER` (`session/feedback.ts`, ×4) sans lui être identique : c'est un score de fin de partie, pas un gain de "vues" en direct. */
export const SCORE_DIRECTOR_KILL = 1000;
/** Un secret trouvé. */
export const SCORE_SECRET = 500;
/** Bonus si TOUS les secrets du niveau sont trouvés. */
export const SCORE_ALL_SECRETS_BONUS = 1000;
/** Points par seconde sous le temps de référence du niveau (`LevelDef.parTime`) — 0 au-delà, jamais négatif. */
export const SCORE_PAR_TIME_POINTS_PER_SECOND = 10;
/** Score de précision maximal (tir 100 % précis), réparti proportionnellement à `shotsHitEnemy / shotsFired`. */
export const SCORE_ACCURACY_MAX_POINTS = 1000;
/** "Vandalisme" façon Duke 3D — casser le décor rapporte, mais nettement moins qu'un ennemi. */
export const SCORE_VANDALISM_PROP = 10;
export const SCORE_VANDALISM_VITRE = 25;
export const SCORE_VANDALISM_SANITAIRE = 50;

// `RecapLine`/`LevelRecap` sont DÉFINIS dans `game/state.ts`, pas ici — voir
// leur doc là-bas pour pourquoi (ADR 0020, `game/state.ts` reste une feuille
// de dépendances). Ce module les CONSTRUIT, il ne les possède pas.

export interface LevelRecapInput {
  stats: SessionStats;
  /** Total de Costards apparus CE niveau — `session.suitManager.suits.length` (jamais retirés à la mort, voir sa doc), indépendant du chemin gym/gltf. */
  suitTotal: number;
  /** Même principe que `suitTotal`, pour le Directeur. */
  directorTotal: number;
  secretsFound: number;
  secretsTotal: number;
  /** `null` = pas de bonus de chrono dans ce récap — soit le niveau n'a pas de `parTime` (gym, zones de test), soit la partie s'est terminée par une mort (récap partiel, voir `publishLevelRecap`). */
  parTimeSeconds: number | null;
}

/**
 * Construit le récap à partir de compteurs déjà figés — fonction PURE, zéro
 * lecture d'horloge, zéro accès au store : ce que fait exactement une ligne
 * et pourquoi elle vaut ce nombre de points est visible ici et nulle part
 * ailleurs.
 */
export function buildLevelRecap(input: LevelRecapInput): LevelRecap {
  const { stats, suitTotal, directorTotal, secretsFound, secretsTotal, parTimeSeconds } = input;
  const lines: RecapLine[] = [];

  lines.push({
    label: "Costards éliminés",
    detail: suitTotal > 0 ? `${stats.suitKills}/${suitTotal} × ${SCORE_SUIT_KILL}` : `${stats.suitKills} × ${SCORE_SUIT_KILL}`,
    points: stats.suitKills * SCORE_SUIT_KILL,
  });

  // Pas de ligne "Directeur" sur un niveau qui n'en a aucun (gym, zones A-D) :
  // un "0/0" n'apprend rien au joueur.
  if (directorTotal > 0) {
    lines.push({
      label: "Directeur éliminé",
      detail: `${stats.directorKills}/${directorTotal} × ${SCORE_DIRECTOR_KILL}`,
      points: stats.directorKills * SCORE_DIRECTOR_KILL,
    });
  }

  if (secretsTotal > 0) {
    const allFound = secretsFound >= secretsTotal;
    const bonus = allFound ? SCORE_ALL_SECRETS_BONUS : 0;
    lines.push({
      label: "Secrets trouvés",
      detail: allFound
        ? `${secretsFound}/${secretsTotal} × ${SCORE_SECRET} + ${SCORE_ALL_SECRETS_BONUS} (tous trouvés)`
        : `${secretsFound}/${secretsTotal} × ${SCORE_SECRET}`,
      points: secretsFound * SCORE_SECRET + bonus,
    });
  }

  const accuracy = stats.shotsFired > 0 ? stats.shotsHitEnemy / stats.shotsFired : 0;
  lines.push({
    label: "Précision",
    detail: `${stats.shotsHitEnemy}/${stats.shotsFired} tirs (${Math.round(accuracy * 100)} %)`,
    points: Math.round(accuracy * SCORE_ACCURACY_MAX_POINTS),
  });

  const vandalismCount = stats.propsDestroyed + stats.vitresDestroyed + stats.sanitairesDestroyed;
  if (vandalismCount > 0) {
    lines.push({
      label: "Vandalisme",
      detail: `${stats.propsDestroyed} caisses/palettes, ${stats.vitresDestroyed} vitres, ${stats.sanitairesDestroyed} sanitaires`,
      points:
        stats.propsDestroyed * SCORE_VANDALISM_PROP +
        stats.vitresDestroyed * SCORE_VANDALISM_VITRE +
        stats.sanitairesDestroyed * SCORE_VANDALISM_SANITAIRE,
    });
  }

  if (parTimeSeconds !== null) {
    const secondsUnder = parTimeSeconds - stats.gameplayElapsed;
    const timePoints = secondsUnder > 0 ? Math.round(secondsUnder * SCORE_PAR_TIME_POINTS_PER_SECOND) : 0;
    lines.push({
      label: "Rapidité",
      detail:
        secondsUnder > 0
          ? `${Math.round(secondsUnder)} s sous le temps de référence × ${SCORE_PAR_TIME_POINTS_PER_SECOND}`
          : "Temps de référence dépassé",
      points: timePoints,
    });
  }

  const total = lines.reduce((sum, line) => sum + line.points, 0);

  return { lines, total, elapsedSeconds: stats.gameplayElapsed, parTimeSeconds, accuracy };
}

/**
 * Construit le récap depuis `session` et le pousse dans le store, UNE FOIS —
 * jamais par image (invariant #2). Seul point d'entrée impur du module :
 * `game/session/doors.ts::triggerLevelComplete` (fin de niveau,
 * `includeTimeBonus: true`) et `game/session/feedback.ts::applyPlayerDamage`
 * (mort, `includeTimeBonus: false` — récap PARTIEL, sans bonus de chrono
 * pour une partie non terminée) sont les deux seuls appelants.
 */
export function publishLevelRecap(session: GameSession, includeTimeBonus: boolean): void {
  const debug = useGameStore.getState().debug;
  const recap = buildLevelRecap({
    stats: session.stats,
    suitTotal: session.suitManager.suits.length,
    directorTotal: session.directorManager.directors.length,
    secretsFound: debug.secretsFound,
    secretsTotal: debug.secretsTotal,
    parTimeSeconds: includeTimeBonus ? (session.choice.parTime ?? null) : null,
  });
  useGameStore.getState().setRecap(recap);
}
