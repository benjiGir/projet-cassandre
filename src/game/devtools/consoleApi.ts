import * as THREE from "three";

import { inputRecorder, recordingFromJson, recordingToJson, type Recording } from "../../core/inputRecorder";
import { isMusicEnabled, setMusicEnabled, toggleMusic } from "../../core/music";
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
import { type DoorInfo, type LevelStats, type SecretZone, type UseObject } from "../level/loader";
import { navGraphStats, type NavGraph } from "../level/pathfinding";
import { type LightPoolStats } from "../../render/lightPool";
import {
  anisotropieDisponible,
  appliquerFiltrage,
  setResolutionInterne,
  INTERNAL_HEIGHT,
  INTERNAL_WIDTH,
  type FiltrageTexture,
} from "../../render/renderer";
import { debugFindPath, spawnDirectorAt, spawnSuitAt, loadGltfLevel } from "../session/spawning";
import { grantCard } from "../session/cards";
import { setNotarget } from "./cheats";
import { LOYALTY_CARDS, type LoyaltyCard } from "../player/loyaltyCards";
import { startPlayback } from "../session/recording";
import { type GameEngine } from "../session/gameEngine";
import {
  applyCrosshairVariant,
  applyFeelVariant,
  applyFlashVariant,
  applyHitmarkerVariant,
  applyImpactVariant,
  applyKnockbackVariant,
  applyLightBudget,
  applyRecoilVariant,
  benchmarkRender,
  checkDeterminism,
  simulateRecording,
  type LightBudgetReport,
  type RenderBenchmark,
} from "./testHarness";

// Origine de ce fichier (extraction du refactor main.ts, 2026-09-05) :
// see: docs/systems/debug.md#origine-du-module-gamedevtools

/**
 * Point d'entrée console pour l'A/B de `feel-tuner` et les preuves de
 * `qa-evidence`. `engine.session` est lu à chaque accès, via des getters,
 * JAMAIS mis en cache dans une variable locale : `window.cassandre` doit
 * rester correct après un "Rejouer"/"Retour au menu" (`main()` appelle
 * cette fonction UNE SEULE FOIS, jamais reconstruite à chaque reset).
 * see: docs/systems/debug.md#point-dentrée-console-windowcassandre
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
    /** Cartes de fidélité (jalon N7, remplace `hasBadge`/`giveBadge`) :
     * `cards()` lit l'inventaire réel, `giveCard()` force une possession pour
     * tester une porte sans devoir trouver la carte — même précédent que
     * `directorManager` pour ce genre de test direct. */
    cards: () => LOYALTY_CARDS.filter((card) => engine.session.cards.has(card)),
    giveCard: (card) => {
      grantCard(engine.session, card);
    },
    /** `door_*` du niveau glTF actuellement chargé — pour inspecter/piloter une porte depuis la console (même précédent que `directors`/`suits`). */
    doors: () => engine.session.gltfLevelSession?.current?.doors ?? [],
    /** `secret_*` du niveau glTF actuellement chargé — pour inspecter les volumes AABB depuis la console (même précédent que `doors`). */
    secrets: () => engine.session.gltfLevelSession?.current?.secrets ?? [],
    /** Dev : `notarget()` rend les ennemis aveugles au joueur, `notarget(false)` les réveille (touche F8, ou la case du panneau de tuning). */
    notarget: (on = true) => setNotarget(on),
    /** Trousses de soin (`use_*` portant `soin`) du niveau glTF actuellement chargé — `visible: false` = déjà ramassée (même précédent que `secrets`). */
    heals: () => (engine.session.gltfLevelSession?.current?.useObjects ?? []).filter((u) => u.heals !== null),
    /** Jalon M4 (PLAN_EFFECT_XSTATE.md) : graphe de praticabilité du niveau glTF courant. `graph()` expose le `NavGraph` brut (tableaux typés, voir sa doc), `stats()` un résumé lisible, `findPath(from, to)` calcule un chemin en direct (`null` si pas de graphe/chemin) — même précédent console que `doors`/`secrets`. */
    pathfinding: {
      graph: () => engine.session.currentNavGraph,
      stats: () => {
        const graph = engine.session.currentNavGraph;
        return graph ? navGraphStats(graph) : null;
      },
      findPath: (from, to) => debugFindPath(engine.session, from, to),
    },
    /** Coupe/remet le thème (jamais `ambience`), même contrôle que la touche
     * M en jeu et le toggle de `RebindScreen` — pour tester sans dépendre du
     * pas fixe (voir `core/music.ts`). */
    music: {
      isEnabled: isMusicEnabled,
      setEnabled: setMusicEnabled,
      toggle: toggleMusic,
    },
    /** Répond à « pourquoi le niveau est-il éclairé comme ça ». Deux termes le
     * décident, et ils se confondent à l'œil : l'éclairage TEMPS RÉEL de la
     * scène, et la couleur CUITE dans les sommets. `lighting()` les sépare —
     * même précédent console que `doors`/`secrets`. */
    lighting: () => inspectLighting(engine),
    /** Coût de rendu de la scène telle qu'elle est, mesuré hors de la boucle
     * de jeu — le seul chiffre exploitable quand `requestAnimationFrame` est
     * bridé (automatisation navigateur). Voir `benchmarkRender`. */
    renderBench: (frames = 120) => benchmarkRender(engine.renderer, engine.scene, engine.camera, frames),
    /** Sans argument, rend l'état du POOL DE LAMPES du niveau chargé ; avec un
     * argument, change son budget (`null` = tout rallumer). Passe par le vrai pool de production
     * (`render/lightPool.ts`) : ce qu'on mesure ici est ce que le joueur aura.
     * Sur une scène sans `light_*` (la gym), retombe sur le balayage de scène
     * de `applyLightBudget`, qui n'a besoin d'aucun niveau chargé.
     * see: docs/decisions/0026-visibilite-par-espace-et-pool-de-lampes.md */
    /** Bascule le filtrage des textures RÉDUITES (vues de loin) et rend le
     * nombre de textures rebasculées. `"nearest"` est le réglage historique,
     * celui qui fait grésiller les surfaces lointaines ; `"mipmap"` et
     * `"aniso"` le corrigent. L'agrandissement reste au plus proche dans les
     * trois cas — le gros pixel de près ne bouge pas.
     * see: docs/decisions/0027-filtrage-des-textures-reduites.md */
    filtrage: (mode: FiltrageTexture = "aniso") => ({
      mode,
      textures: appliquerFiltrage(engine.scene, mode),
      anisotropieMax: anisotropieDisponible(),
    }),
    /** Change la résolution de rendu INTERNE, pour comparer. Sans argument,
     * revient aux 640×360 de l'invariant #4. Les overlays 2D (réticule,
     * hitmarker) gardent leur propre taille et ne suivent pas. */
    resolution: (width = INTERNAL_WIDTH, height = INTERNAL_HEIGHT) =>
      setResolutionInterne(engine.renderer, engine.camera, width, height),
    lightBudget: (n?: number | null) => {
      const pool = engine.session.lightPool;
      if (!pool) return applyLightBudget(engine.scene, engine.camera, n ?? null);
      // Sans argument, on RAPPORTE — `null` (tout rallumer) doit être demandé
      // explicitement. Un inspecteur qui modifie ce qu'il inspecte fausse la
      // mesure suivante.
      if (n !== undefined) {
        pool.setBudget(n);
        pool.update(engine.camera.position);
      }
      return pool.stats;
    },
  };
}

/**
 * Sépare les deux termes du rendu d'un niveau : `texture × couleur de sommet ×
 * éclairage temps réel`.
 *
 * `lights` liste ce que la scène éclaire vraiment — `visible: false` marque une
 * lampe ÉTEINTE PAR LE POOL (`render/lightPool.ts`), pas une lampe absente :
 * c'est la première chose à regarder quand un espace paraît trop sombre.
 * `batches` mesure, sur la
 * géométrie réellement dessinée (donc APRÈS la fusion de `mergeStaticDecor`),
 * si la couleur cuite est bien là et quel contraste elle porte. Un niveau plat
 * a soit `vertexColors: false` (le bake n'arrive pas au matériau), soit un
 * `range` écrasé (le bake lui-même est plat) — ce ne sont pas les mêmes
 * corrections.
 * see: docs/systems/rendu.md#éclairage-de-scène-selon-le-niveau
 */
function inspectLighting(engine: GameEngine) {
  const lights: { name: string; type: string; intensity: number; color: string; visible: boolean }[] = [];
  const batches: {
    name: string;
    vertexColors: boolean;
    hasColorAttribute: boolean;
    min: number;
    mean: number;
    max: number;
  }[] = [];

  engine.scene.traverse((obj) => {
    const light = obj as THREE.Light;
    if (light.isLight) {
      lights.push({
        name: light.name,
        type: light.type,
        intensity: light.intensity,
        color: `#${light.color.getHexString()}`,
        visible: light.visible,
      });
    }
  });

  const root = engine.session.gltfLevelSession?.current?.root;
  root?.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || !mesh.visible) return;
    const material = mesh.material as THREE.MeshLambertMaterial;
    const attribute = mesh.geometry.getAttribute("color");
    let min = 1;
    let max = 0;
    let sum = 0;
    if (attribute) {
      for (let i = 0; i < attribute.count; i += 1) {
        // Luminance Rec. 709, la même pondération que le rapport de bake.
        const luma =
          0.2126 * attribute.getX(i) + 0.7152 * attribute.getY(i) + 0.0722 * attribute.getZ(i);
        min = Math.min(min, luma);
        max = Math.max(max, luma);
        sum += luma;
      }
    }
    batches.push({
      name: mesh.name,
      vertexColors: material.vertexColors === true,
      hasColorAttribute: attribute !== undefined,
      min: attribute ? +min.toFixed(3) : 0,
      mean: attribute ? +(sum / attribute.count).toFixed(3) : 0,
      max: attribute ? +max.toFixed(3) : 0,
    });
  });

  return { lights, batches };
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
      cards: () => LoyaltyCard[];
      giveCard: (card: LoyaltyCard) => void;
      doors: () => DoorInfo[];
      secrets: () => SecretZone[];
      heals: () => UseObject[];
      /** Dev : rend les ennemis aveugles au joueur (voir `devtools/cheats.ts`). */
      notarget: (on?: boolean) => boolean;
      /** Jalon M4 (PLAN_EFFECT_XSTATE.md) : graphe de praticabilité du niveau glTF courant, voir `game/level/pathfinding.ts`. */
      pathfinding: {
        graph: () => NavGraph | null;
        stats: () => ReturnType<typeof navGraphStats> | null;
        findPath: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[] | null;
      };
      music: {
        isEnabled: () => boolean;
        setEnabled: (enabled: boolean) => void;
        toggle: () => boolean;
      };
      lighting: () => ReturnType<typeof inspectLighting>;
      renderBench: (frames?: number) => RenderBenchmark;
      filtrage: (mode?: FiltrageTexture) => { mode: FiltrageTexture; textures: number; anisotropieMax: number };
      resolution: (width?: number, height?: number) => { width: number; height: number };
      lightBudget: (n?: number | null) => LightBudgetReport | LightPoolStats;
    };
  }
}
