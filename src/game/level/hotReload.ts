import * as THREE from "three";

import type { PhysicsWorld } from "../../physics/world";
import { loadLevel, type LevelHandle } from "./loader";

/**
 * Hot reload dev-only pour les niveaux `.glb` — voir le skill
 * `gltf-level-conventions`, section « Hot reload », et son critère de
 * validation : déplacer un mur dans Blender, exporter, le voir en jeu en
 * MOINS DE 60 SECONDES, chronométré réellement.
 *
 * ## Mécanisme choisi : sondage HTTP `HEAD`
 *
 * Un `.glb` dans `public/assets/levels/` est un asset STATIQUE servi tel
 * quel par Vite — il est HORS du graphe de modules, donc le HMR de module de
 * Vite ne s'applique pas (`import.meta.hot` ne se déclenche jamais pour un
 * fichier qui n'est référencé par aucun `import`). Deux alternatives
 * existaient :
 *   - un vrai watcher fichier (`chokidar` côté serveur Vite, exposé au client
 *     via WebSocket) — plus robuste, mais demande un plugin Vite dédié, hors
 *     de proportion pour Phase 4 ;
 *   - le sondage choisi ici : `fetch(url, { method: 'HEAD' })` à intervalle
 *     court, en comparant `ETag`/`Last-Modified`/`Content-Length` d'un appel
 *     à l'autre. Le serveur de fichiers statiques de Vite (`sirv`) pose ces
 *     en-têtes à partir du `mtime` réel du fichier sur disque, donc un
 *     export Blender qui écrase le `.glb` est détecté au prochain sondage.
 *
 * Le sondage est direct, sans dépendance supplémentaire, et largement dans le
 * budget des 60 s visées (défaut 400 ms, donc détection en <1 s dans le pire
 * cas). C'est un CHOIX DE SIMPLICITÉ pour Phase 4, pas une garantie de
 * robustesse totale : voir la doc de `createLevelSession` pour ses limites
 * connues.
 *
 * ## Préservation de la position du joueur
 *
 * `createLevelSession` NE TOUCHE JAMAIS `player.position`/`player.velocity`.
 * Un rechargement dispose l'ancien `LevelHandle` (meshes + colliders Rapier)
 * et en construit un nouveau, point final — voir `onLoaded` pour le SEUL
 * moment où l'appelant (`main.ts`) est autorisé à repositionner le joueur
 * (le tout premier chargement, `info.isFirstLoad === true`).
 *
 * Cas limite volontairement IGNORÉ en Phase 4 : si le mur qu'on vient de
 * déplacer dans Blender finit par recouvrir la position courante du joueur,
 * celui-ci se retrouve embarqué dans le nouveau collider. Rien ici ne le
 * dépénètre activement. En pratique le `KinematicCharacterController` du
 * joueur (voir `physics/world.ts`) recalcule `computeColliderMovement` à
 * CHAQUE pas fixe suivant à partir de la géométrie réelle, donc un
 * chevauchement se résorbe le plus souvent tout seul dès le prochain
 * déplacement volontaire — mais un joueur immobile dans un mur fraîchement
 * apparu peut rester visuellement coincé. Non géré : documenté ici plutôt que
 * contourné en douce, à la charge d'un futur ticket si ça gêne réellement le
 * tuning (le plan ne mentionne pas ce cas).
 */

export interface LevelSessionOptions {
  /** Intervalle de sondage HTTP HEAD, ms. 400 ms par défaut : largement sous
   * les 60 s cibles, sans matraquer le serveur dev. */
  pollIntervalMs?: number;
  /** Appelé après CHAQUE (re)chargement réussi, le tout premier compris.
   * `info.isFirstLoad` distingue le boot (où repositionner le joueur sur
   * `handle.spawnPlayer` a du sens) d'un hot reload (où NE JAMAIS le faire). */
  onLoaded?: (handle: LevelHandle, info: { isFirstLoad: boolean }) => void;
  /** Appelé si un (re)chargement échoue (export Blender à moitié écrit,
   * glb temporairement invalide pendant l'écriture...). La session garde le
   * niveau précédent affiché — jamais d'écran noir sur une erreur transitoire. */
  onError?: (error: unknown) => void;
}

export interface LevelSession {
  /** Niveau actuellement affiché, `null` avant le tout premier chargement réussi. */
  readonly current: LevelHandle | null;
  /** Résolu après le PREMIER chargement réussi — pratique pour `await` la
   * position de spawn au boot sans dupliquer la logique de `onLoaded`. */
  readonly ready: Promise<LevelHandle>;
  /** Force un rechargement immédiat, sans attendre le prochain sondage. */
  reload(): Promise<void>;
  /** Arrête le sondage et libère le niveau courant. */
  stop(): void;
}

/**
 * Ouvre une session de niveau glTF avec hot reload. Charge `url` UNE
 * PREMIÈRE FOIS immédiatement (pas d'attente du premier intervalle de
 * sondage), puis sonde `url` en continu pour détecter un export Blender
 * ultérieur.
 */
export function createLevelSession(
  url: string,
  scene: THREE.Scene,
  physics: PhysicsWorld,
  options: LevelSessionOptions = {},
): LevelSession {
  const pollIntervalMs = options.pollIntervalMs ?? 400;

  let currentHandle: LevelHandle | null = null;
  let lastSignature: string | null = null;
  let isFirstLoad = true;
  let stopped = false;
  let reloadInFlight: Promise<void> | null = null;
  let resolveReady!: (handle: LevelHandle) => void;
  const ready = new Promise<LevelHandle>((resolve) => {
    resolveReady = resolve;
  });

  async function performLoad(): Promise<void> {
    try {
      const nextHandle = await loadLevel(url, scene, physics);
      currentHandle?.dispose();
      currentHandle = nextHandle;
      const info = { isFirstLoad };
      if (isFirstLoad) {
        isFirstLoad = false;
        resolveReady(nextHandle);
      }
      options.onLoaded?.(nextHandle, info);
    } catch (error) {
      console.error(`[level] échec du (re)chargement de "${url}" — niveau précédent conservé.`, error);
      options.onError?.(error);
    }
  }

  function reload(): Promise<void> {
    if (!reloadInFlight) {
      reloadInFlight = performLoad().finally(() => {
        reloadInFlight = null;
      });
    }
    return reloadInFlight;
  }

  async function poll() {
    if (stopped) return;
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (res.ok) {
        const signature =
          res.headers.get("etag") ?? res.headers.get("last-modified") ?? res.headers.get("content-length");
        if (signature !== null) {
          if (lastSignature !== null && signature !== lastSignature) {
            console.info(`[level] changement détecté sur "${url}" — rechargement.`);
            await reload();
          }
          lastSignature = signature;
        }
      }
    } catch {
      // Serveur dev temporairement indisponible (rebuild Vite, etc.) : on
      // retente au prochain tick, jamais de throw depuis une boucle de fond.
    }
    if (!stopped) setTimeout(poll, pollIntervalMs);
  }

  void reload();
  void poll();

  return {
    get current() {
      return currentHandle;
    },
    ready,
    reload,
    stop() {
      stopped = true;
      currentHandle?.dispose();
      currentHandle = null;
    },
  };
}
