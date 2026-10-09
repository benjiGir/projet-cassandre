import type { LevelRecap, RecapLine } from "../../hud/hudTypes";

// see: docs/archive/systems-session.md#récapitulatif-de-fin-de-partie

export interface SessionStats {
  trainKills: number;
  trainCrossings: number;
  trainDeaths: number;
  lastDamageSource: "suit" | "director" | "train" | null;
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
    trainKills: 0,
    trainCrossings: 0,
    trainDeaths: 0,
    lastDamageSource: null,
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

// see: docs/6-reference/notes-code-gameplay.md#feedback-et-récap

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

export const SCORE_SUIT_KILL = 100;
/** Le Directeur — dix fois un Costard, sans lien avec le poids du Directeur dans l'audience du direct (`stream/streamSim.ts`) : c'est un score de fin de partie. */
export const SCORE_DIRECTOR_KILL = 1000;

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
  /** Nom de la difficulté jouée, prêt à afficher. */
  difficulty: string;
}

export function buildLevelRecap(input: LevelRecapInput): LevelRecap {
  const { stats, suitTotal, directorTotal, secretsFound, secretsTotal, parTimeSeconds, difficulty } = input;
  const lines: RecapLine[] = [];
  if (stats.trainDeaths > 0) lines.push({ label: "Fauché par une rame", detail: "Mort immédiate", points: 0 });
  if (stats.trainCrossings > 0)
    lines.push({ label: "Traversées de voie", detail: String(stats.trainCrossings), points: 0 });

  lines.push({
    label: "Costards éliminés",
    detail:
      suitTotal > 0
        ? `${stats.suitKills}/${suitTotal} × ${SCORE_SUIT_KILL}`
        : `${stats.suitKills} × ${SCORE_SUIT_KILL}`,
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

  return { lines, total, elapsedSeconds: stats.gameplayElapsed, parTimeSeconds, accuracy, difficulty, record: null };
}
