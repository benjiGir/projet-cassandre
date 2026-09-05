import * as THREE from "three";

import { inputRecorder, recordingFromJson, recordingToJson, type Recording } from "../../core/inputRecorder";
import { FEEL_VARIANTS, moveConfig, type MoveConfig } from "../player/moveConfig";
import {
  CROSSHAIR_VARIANTS,
  HITMARKER_VARIANTS,
  IMPACT_VARIANTS,
  RECOIL_VARIANTS,
  weaponConfig,
  type WeaponConfig,
} from "../player/weaponConfig";
import { PlayerController } from "../player/controller";
import { WeaponSystem } from "../player/weapons";
import { Suit } from "../entities/suit";
import { FLASH_VARIANTS, KNOCKBACK_VARIANTS, suitConfig, type SuitConfig } from "../entities/suitConfig";
import { Director } from "../entities/director";
import { DirectorManager } from "../entities/directorManager";
import { directorConfig, type DirectorConfig } from "../entities/directorConfig";
import { type DoorInfo, type LevelStats, type SecretZone } from "../level/loader";
import { navGraphStats, type NavGraph } from "../level/pathfinding";
import { debugFindPath, spawnDirectorAt, spawnSuitAt, loadGltfLevel } from "../session/spawning";
import { startPlayback } from "../session/recording";
import { type GameEngine } from "../session/gameEngine";
import {
  applyCrosshairVariant,
  applyFeelVariant,
  applyFlashVariant,
  applyHitmarkerVariant,
  applyImpactVariant,
  applyKnockbackVariant,
  applyRecoilVariant,
  checkDeterminism,
  simulateRecording,
} from "./testHarness";

/**
 * Extraction du refactor de `main.ts` (2229 lignes → modules, 2026-09-05) :
 * `exposeDebugApi` (point d'entrée console `window.cassandre`, harnais
 * `feel-tuner`/`qa-evidence`) prenait déjà SES DÉPENDANCES en paramètres
 * explicites (portée module dans `main.ts`, aucune fermeture) — ce jalon
 * simplifie sa signature à un seul paramètre `engine: GameEngine` (plutôt
 * que 7 callbacks séparés) : `spawnSuitAt`/`spawnDirectorAt`/`loadGltfLevel`/
 * `debugFindPath`/`startPlayback` sont maintenant des fonctions IMPORTABLES
 * directement (elles vivaient comme fonctions imbriquées de `main()` avant
 * ce refactor), ce module n'a donc plus besoin qu'on les lui passe.
 */

/**
 * Point d'entrée console pour l'A/B de `feel-tuner` et les preuves de
 * `qa-evidence`. Jalon M8 (PLAN_EFFECT_XSTATE.md, §10) : `engine.session`
 * remplace les références directes (`player`/`weapons`/`suitManager`/
 * `directorManager`) qui existaient avant ce jalon — CE fichier n'a
 * plus qu'UNE SEULE session possible tant qu'aucun reset n'a eu lieu, mais
 * `window.cassandre` doit rester correct APRÈS un "Rejouer"/"Retour au menu"
 * (`main()` appelle cette fonction UNE SEULE FOIS, jamais reconstruite à
 * chaque reset) : `engine.session` est donc lu à chaque accès (getters),
 * jamais mis en cache dans une variable locale de cette fonction.
 */
export function exposeDebugApi(engine: GameEngine): void {
  window.cassandre = {
    moveConfig,
    get player() {
      return engine.session.player;
    },
    recorder: inputRecorder,
    lastRecording: () => engine.lastRecording,
    playRecording: (rec) => startPlayback(engine, engine.session, rec),
    exportRecording: recordingToJson,
    importRecording: recordingFromJson,
    simulateRecording: (rec, cfg = moveConfig) => simulateRecording(rec, cfg),
    checkDeterminism,
    feelVariants: FEEL_VARIANTS,
    applyFeelVariant,
    get weapons() {
      return engine.session.weapons;
    },
    weaponConfig,
    recoilVariants: RECOIL_VARIANTS,
    applyRecoilVariant,
    // --- Harnais de feedback de hit (retour playtest Phase 3) -------------
    impactVariants: IMPACT_VARIANTS,
    applyImpactVariant,
    hitmarkerVariants: HITMARKER_VARIANTS,
    applyHitmarkerVariant,
    crosshairVariants: CROSSHAIR_VARIANTS,
    applyCrosshairVariant,
    knockbackVariants: KNOCKBACK_VARIANTS,
    applyKnockbackVariant,
    flashVariants: FLASH_VARIANTS,
    applyFlashVariant,
    get suits() {
      return engine.session.suitManager.suits;
    },
    suitConfig,
    spawnSuit: (x, y, z) => spawnSuitAt(engine, engine.session, x, y, z),
    suitCount: () => engine.session.suitManager.suits.length,
    suitAliveCount: () => engine.session.suitManager.suits.filter((s) => s.isAlive).length,
    get directors() {
      return engine.session.directorManager.directors;
    },
    get directorManager() {
      return engine.session.directorManager;
    },
    directorConfig,
    spawnDirector: (x, y, z) => spawnDirectorAt(engine, engine.session, x, y, z),
    directorCount: () => engine.session.directorManager.directors.length,
    directorAliveCount: () => engine.session.directorManager.directors.filter((d) => d.isAlive).length,
    level: {
      load: (name) => loadGltfLevel(engine, engine.session, name),
      stats: () => engine.session.gltfLevelSession?.current?.stats ?? null,
    },
    /** Porte à badge (Zone E) : `hasBadge()` lit l'état réel, `giveBadge()`
     * force la possession pour tester `use_exit_door` sans devoir tuer le
     * Directeur en console (même précédent que `directorManager` pour ce
     * genre de test direct). */
    hasBadge: () => engine.session.hasBadge,
    giveBadge: () => {
      engine.session.hasBadge = true;
    },
    /** `door_*` du niveau glTF actuellement chargé — pour inspecter/piloter une porte depuis la console (même précédent que `directors`/`suits`). */
    doors: () => engine.session.gltfLevelSession?.current?.doors ?? [],
    /** `secret_*` du niveau glTF actuellement chargé — pour inspecter les volumes AABB depuis la console (même précédent que `doors`). */
    secrets: () => engine.session.gltfLevelSession?.current?.secrets ?? [],
    /** Jalon M4 (PLAN_EFFECT_XSTATE.md) : graphe de praticabilité du niveau glTF courant. `graph()` expose le `NavGraph` brut (tableaux typés, voir sa doc), `stats()` un résumé lisible, `findPath(from, to)` calcule un chemin en direct (`null` si pas de graphe/chemin) — même précédent console que `doors`/`secrets`. */
    pathfinding: {
      graph: () => engine.session.currentNavGraph,
      stats: () => {
        const graph = engine.session.currentNavGraph;
        return graph ? navGraphStats(graph) : null;
      },
      findPath: (from, to) => debugFindPath(engine.session, from, to),
    },
  };
}

declare global {
  interface Window {
    cassandre: {
      moveConfig: MoveConfig;
      player: PlayerController;
      recorder: typeof inputRecorder;
      lastRecording: () => Recording | null;
      playRecording: (rec: Recording) => void;
      exportRecording: (rec: Recording) => string;
      importRecording: (json: string) => Recording;
      simulateRecording: (rec: Recording, cfg?: MoveConfig) => ReturnType<typeof simulateRecording>;
      checkDeterminism: (rec: Recording) => ReturnType<typeof checkDeterminism>;
      feelVariants: typeof FEEL_VARIANTS;
      applyFeelVariant: (name: keyof typeof FEEL_VARIANTS) => ReturnType<typeof applyFeelVariant>;
      weapons: WeaponSystem;
      weaponConfig: WeaponConfig;
      recoilVariants: typeof RECOIL_VARIANTS;
      applyRecoilVariant: (name: keyof typeof RECOIL_VARIANTS) => ReturnType<typeof applyRecoilVariant>;
      // --- Harnais de feedback de hit (retour playtest Phase 3) -------------
      impactVariants: typeof IMPACT_VARIANTS;
      applyImpactVariant: (name: keyof typeof IMPACT_VARIANTS) => ReturnType<typeof applyImpactVariant>;
      hitmarkerVariants: typeof HITMARKER_VARIANTS;
      applyHitmarkerVariant: (name: keyof typeof HITMARKER_VARIANTS) => ReturnType<typeof applyHitmarkerVariant>;
      crosshairVariants: typeof CROSSHAIR_VARIANTS;
      applyCrosshairVariant: (name: keyof typeof CROSSHAIR_VARIANTS) => ReturnType<typeof applyCrosshairVariant>;
      knockbackVariants: typeof KNOCKBACK_VARIANTS;
      applyKnockbackVariant: (name: keyof typeof KNOCKBACK_VARIANTS) => ReturnType<typeof applyKnockbackVariant>;
      flashVariants: typeof FLASH_VARIANTS;
      applyFlashVariant: (name: keyof typeof FLASH_VARIANTS) => ReturnType<typeof applyFlashVariant>;
      /** Référence directe, LECTURE/ÉCRITURE — pratique pour forcer `suits[i].state` depuis la console (mosaïque de diagnostic états × directions). Jalon M8 : accesseur LIVE sur la session courante (getter), reste correct après un reset. */
      suits: Suit[];
      suitConfig: SuitConfig;
      /** Fait apparaître un Costard supplémentaire à la volée (pieds à `y`), DANS LA SESSION COURANTE. Critère de rollback du plan : pousser jusqu'à 10-20 sans interface graphique dédiée. */
      spawnSuit: (x: number, y: number, z: number) => Suit;
      /** Nombre de Costards jamais spawnés (vivants + cadavres), DANS LA SESSION COURANTE. */
      suitCount: () => number;
      /** Nombre de Costards encore en jeu (hors `dead`/`corpse`), DANS LA SESSION COURANTE. */
      suitAliveCount: () => number;
      /** Mêmes rôles que `suits`/`suitConfig`/`spawnSuit`, pour le Directeur (boss Zone E) — voir `director.ts`/`directorManager.ts`. Jalon M8 : `directors`/`directorManager` sont des accesseurs LIVE (getters). */
      directors: Director[];
      /** Référence directe au manager complet (badge, files d'événements) — même précédent que `weapons` ci-dessus, utile pour du débogage console. Getter LIVE (Jalon M8). */
      directorManager: DirectorManager;
      directorConfig: DirectorConfig;
      spawnDirector: (x: number, y: number, z: number) => Director;
      directorCount: () => number;
      directorAliveCount: () => number;
      /** Pipeline de niveau glTF (Phase 4), capacité ADDITIVE dev-only — voir
       * la doc de tête de `session/spawning.ts::loadGltfLevel`. Opère sur la
       * SESSION COURANTE (Jalon M8). */
      level: {
        /** Charge (ou recharge) `public/assets/levels/<name>.glb`, avec hot reload. */
        load: (name: string) => void;
        /** Compteurs du niveau glTF actuellement chargé, `null` si aucun. */
        stats: () => LevelStats | null;
      };
      /** Porte à badge (Zone E, `use_exit_door`/`door_e_exit`) : lecture/forçage de la possession du badge, pour tester sans tuer le Directeur en console. Opère sur la SESSION COURANTE. */
      hasBadge: () => boolean;
      giveBadge: () => void;
      doors: () => DoorInfo[];
      secrets: () => SecretZone[];
      /** Jalon M4 (PLAN_EFFECT_XSTATE.md) : graphe de praticabilité du niveau glTF courant, voir `game/level/pathfinding.ts`. */
      pathfinding: {
        graph: () => NavGraph | null;
        stats: () => ReturnType<typeof navGraphStats> | null;
        findPath: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[] | null;
      };
    };
  }
}
