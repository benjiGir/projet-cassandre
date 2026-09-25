import * as THREE from "three";

import { inputRecorder, recordingFromJson, recordingToJson, type Recording } from "../../core/inputRecorder";
import { isMusicEnabled, setMusicEnabled, toggleMusic } from "../../core/music";
import { listSfx, playSfx, type SfxId } from "../../core/audio";
import { waterAmbienceDebugState } from "../../core/waterAmbience";
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
import type { PropSystem } from "../level/props";
import type { DoorSystem } from "../level/doors";
import type { VitreSystem } from "../level/vitres";
import type { SanitaireSystem } from "../level/sanitaires";
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
import { triggerLevelComplete } from "../session/doors";
import { applyPlayerDamage, presentPlayerDamage } from "../session/feedback";
import { type SessionStats } from "../session/score";
import { useGameStore, type LevelRecap } from "../state";
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
    /** DEV : tue le premier Costard encore vivant (vrai `deathEvent`, compté
     * par le récap de fin de partie) — `false` si aucun n'est vivant. Le seul
     * moyen de tester le récap sans viser, le verrouillage du pointeur étant
     * hors de portée de l'automatisation. */
    killSuit: () => {
      const suit = engine.session.suitManager.suits.find((s) => s.isAlive);
      return suit ? engine.session.suitManager.debugKill(suit) : false;
    },
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
    /** DEV : même rôle que `killSuit`, pour le Directeur (carte lâchée comprise). */
    killDirector: () => {
      const director = engine.session.directorManager.directors.find((d) => d.isAlive);
      return director ? engine.session.directorManager.debugKill(director) : false;
    },
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
    /** Portes ANIMÉES du niveau courant (`game/level/doors.ts::DoorSystem`) :
     * `liste()` rend l'état de chaque vantail (mouvement, groupe, ouvert/
     * fermé), `ouvrir(nom)` en ouvre un (et tout son groupe) SANS passer par
     * un `use_*`/une carte — le seul moyen de juger le mouvement et le son
     * quand le verrouillage du pointeur est hors de portée de
     * l'automatisation (même précédent que `props`).
     * see: docs/decisions/0031-portes-animees-et-vitres.md */
    doorSystem: {
      liste: () => engine.session.doorSystem?.describe() ?? [],
      ouvrir: (nom: string) => engine.session.doorSystem?.open(nom, engine.session.player.position) ?? false,
      /** La touche E sur la porte manœuvrable la plus proche (`manuelle`), depuis la position du joueur — le verrouillage du pointeur met la vraie touche hors de portée de l'automatisation. */
      actionner: () => engine.session.doorSystem?.actionner(engine.session.player.position) ?? null,
    },
    /** Vitrages du niveau courant (`game/level/vitres.ts::VitreSystem`) :
     * `liste()` rend l'état de chaque vitre (PV, cassée, givre), `casser(nom)`
     * en détruit une sans tirer dessus — même précédent que `props`. */
    vitres: {
      liste: () => engine.session.vitreSystem?.describe() ?? [],
      casser: (nom: string) => engine.session.vitreSystem?.destroyByName(nom) ?? false,
    },
    /** Sanitaires du niveau courant (`game/level/sanitaires.ts::SanitaireSystem`,
     * [ADR 0032](../../../docs/decisions/0032-sanitaires-utilisables.md)) :
     * `liste()` rend l'état de chaque sanitaire (sorte, PV, cassé), `casser(nom)`
     * en détruit un sans tirer dessus (même précédent que `vitres`/`props`),
     * `jets()` les jets d'eau actifs. `delai()`/`forcerDelai(secondes)` lisent
     * ou forcent le délai de soulagement (220 s par défaut) — le seul moyen de
     * juger le "Rien ne vient." et le plafond de PV sans attendre en jouant. */
    sanitaires: {
      liste: () => engine.session.sanitaireSystem?.describe() ?? [],
      casser: (nom: string) => engine.session.sanitaireSystem?.destroyByName(nom) ?? false,
      jets: () => engine.session.sanitaireSystem?.activeJets ?? [],
      delai: () => engine.session.sanitaireReliefCooldown,
      forcerDelai: (secondes = 0) => {
        engine.session.sanitaireReliefCooldown = secondes;
        return engine.session.sanitaireReliefCooldown;
      },
    },
    /** Effets sonores : `liste()` dit quel identifiant du jeu pointe sur quelle
     * recette du studio et si elle est bien dans le sprite, `joue(id)` déclenche
     * n'importe lequel sans avoir à provoquer la situation qui le produit. Le
     * verrouillage du pointeur est hors de portée de l'automatisation, donc
     * c'est le seul moyen d'entendre un tir sans jouer. */
    sfx: {
      liste: () => listSfx(),
      joue: (id: SfxId, volume = 1) => playSfx(id, volume),
      /** État de la boucle d'eau positionnelle (`core/waterAmbience.ts`,
       * sanitaires cassés) : `charge` = fichier chargé, `joue` = `Howl`
       * réellement en lecture, `volume`/`pan` = mélange courant — le seul
       * moyen de la vérifier sans l'entendre (même limitation que `joue`
       * ci-dessus, verrouillage du pointeur hors de portée de
       * l'automatisation). */
      eau: () => waterAmbienceDebugState(),
    },
    /** `secret_*` du niveau glTF actuellement chargé — pour inspecter les volumes AABB depuis la console (même précédent que `doors`). */
    secrets: () => engine.session.gltfLevelSession?.current?.secrets ?? [],
    /** Mobilier physique (`prop_*`) du niveau courant : `liste()` rend l'état
     * de chaque prop (PV, matière, position), `casser(nom)` en détruit un sans
     * tirer dessus — le seul moyen de juger les débris et le son quand le
     * verrouillage du pointeur est hors de portée de l'automatisation. */
    props: {
      liste: () => engine.session.propSystem?.describe() ?? [],
      casser: (nom: string) => engine.session.propSystem?.destroyByName(nom) ?? false,
    },
    /** Boîtes de munitions (`use_*` portant `munitions`) du niveau courant — `visible: false` = déjà ramassée. */
    ammo: () => (engine.session.gltfLevelSession?.current?.useObjects ?? []).filter((u) => u.ammo !== null),
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
     * M en jeu et le toggle de `ui/screens/options/controls/MusicToggle/MusicToggle.tsx` — pour tester sans dépendre du
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
    /** Récap de fin de partie (`game/session/score.ts`) : `stats()` rend les
     * compteurs BRUTS de la partie en cours (kills, tirs, casse, temps de
     * gameplay écoulé — voir `SessionStats`), `recap()` le dernier récap
     * PUBLIÉ dans le store (`null` tant qu'aucune partie ne s'est terminée).
     * `completeLevel()`/`killPlayer()` déclenchent le VRAI chemin de fin de
     * partie (mêmes fonctions que `triggerLevelComplete`/`applyPlayerDamage`
     * en jeu, publication du récap comprise) sans avoir à finir le niveau ou
     * à se faire tuer — même précédent que `killSuit`/`killDirector`
     * au-dessus, le verrouillage du pointeur étant hors de portée de
     * l'automatisation. */
    recap: {
      stats: () => engine.session.stats,
      recap: () => useGameStore.getState().recap,
      completeLevel: () => triggerLevelComplete(engine, engine.session),
      killPlayer: () => {
        applyPlayerDamage(engine, engine.session, engine.session.playerHp);
        presentPlayerDamage(engine.session);
      },
    },
    /** Pause (`docs/systems/session.md#pause`) : `pause()`/`resume()` envoient
     * directement PAUSE/RESUME à l'acteur de flux — le déclenchement réel
     * (perte du verrouillage du pointeur) est hors de portée de
     * l'automatisation navigateur, comme le reste du verrouillage. */
    pause: () => engine.flowActor.send({ type: "PAUSE" }),
    resume: () => engine.flowActor.send({ type: "RESUME" }),
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
      /** DEV : tue le premier Costard vivant (vrai `deathEvent`, compté par le récap) — `false` si aucun n'est vivant. */
      killSuit: () => boolean;
      /** Mêmes rôles que `suits`/`suitConfig`/`spawnSuit`, pour le Directeur (boss Zone E) — voir `director.ts`/`directorManager.ts`. Jalon M8 : `directors`/`directorManager` sont des accesseurs LIVE (getters). */
      directors: Director[];
      /** Référence directe au manager complet (badge, files d'événements) — même précédent que `weapons` ci-dessus, utile pour du débogage console. Getter LIVE (Jalon M8). */
      directorManager: DirectorManager;
      directorConfig: DirectorConfig;
      spawnDirector: (x: number, y: number, z: number) => Director;
      directorCount: () => number;
      directorAliveCount: () => number;
      /** DEV : même rôle que `killSuit`, pour le Directeur. */
      killDirector: () => boolean;
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
      /** Portes ANIMÉES du niveau courant — voir `game/level/doors.ts::DoorSystem`. */
      doorSystem: {
        liste: () => ReturnType<DoorSystem["describe"]>;
        ouvrir: (nom: string) => boolean;
        actionner: () => ReturnType<DoorSystem["actionner"]>;
      };
      /** Vitrages du niveau courant — voir `game/level/vitres.ts::VitreSystem`. */
      vitres: {
        liste: () => ReturnType<VitreSystem["describe"]>;
        casser: (nom: string) => boolean;
      };
      /** Sanitaires du niveau courant — voir `game/level/sanitaires.ts::SanitaireSystem`. */
      sanitaires: {
        liste: () => ReturnType<SanitaireSystem["describe"]>;
        casser: (nom: string) => boolean;
        jets: () => SanitaireSystem["activeJets"];
        delai: () => number;
        forcerDelai: (secondes?: number) => number;
      };
      sfx: {
        liste: () => ReturnType<typeof listSfx>;
        joue: (id: SfxId, volume?: number) => void;
        eau: () => ReturnType<typeof waterAmbienceDebugState>;
      };
      secrets: () => SecretZone[];
      heals: () => UseObject[];
      ammo: () => UseObject[];
      /** Mobilier physique (`prop_*`) du niveau courant — voir `game/level/props.ts`. */
      props: {
        liste: () => ReturnType<PropSystem["describe"]>;
        casser: (nom: string) => boolean;
      };
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
      /** Récap de fin de partie (`game/session/score.ts`) — voir sa doc d'implémentation pour le détail de chaque champ. */
      recap: {
        stats: () => SessionStats;
        recap: () => LevelRecap | null;
        completeLevel: () => void;
        killPlayer: () => void;
      };
      /** Pause (`docs/systems/session.md#pause`) : envoie directement PAUSE/RESUME à l'acteur de flux. */
      pause: () => void;
      resume: () => void;
    };
  }
}
