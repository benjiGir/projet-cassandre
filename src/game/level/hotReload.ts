import * as THREE from "three";
import { Effect, Fiber, Schedule, Semaphore } from "effect";

import type { PhysicsWorld } from "../../physics/world";
import { loadLevel, type LevelHandle } from "./loader";
import { GameRuntime } from "../../core/runtime";

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
 *
 * ## Jalon M2 (PLAN_EFFECT_XSTATE.md) — retrofit Effect
 *
 * **Frontière Effect→Promise/plain-JS.** `LevelSession` garde EXACTEMENT sa
 * forme d'avant cette migration (`current`, `ready`, `reload()`, `stop()`) —
 * `main.ts` lit `gltfLevelSession?.current` À CHAQUE PAS FIXE (voir les
 * appelants dans `main.ts`), donc ce getter DOIT rester un accès JS brut,
 * sans la moindre indirection Effect (zéro `Effect.runSync` caché dedans) :
 * c'est exactement le genre de frontière que le principe transverse #1 du
 * plan réserve au pas fixe (synchrone strict, zéro Effect). `currentHandle`/
 * `lastSignature`/`isFirstLoad`/`resolveReady` restent donc des variables JS
 * ordinaires capturées par fermeture, PAS un `Ref` Effect — un `Ref` n'aurait
 * apporté aucun bénéfice ici (JS est mono-thread, aucune interposition
 * possible entre la lecture et l'écriture de ces variables dans le code
 * ci-dessous) pour un coût réel (chaque lecture de `.current` depuis le pas
 * fixe deviendrait un aller-retour Effect). Effect reste un détail
 * d'implémentation du CHARGEMENT/SONDAGE (frontière async), jamais du getter
 * lu à 60 Hz.
 *
 * **Mutex de rechargement.** Le plan demande un `Effect.Semaphore(1)` autour
 * de `performLoad`. Un `Semaphore.withPermit` SEUL changerait le
 * comportement observable : il SÉRIALISE les appels concurrents (chacun finit
 * par déclencher un vrai rechargement, l'un après l'autre) plutôt que de les
 * COALESCER (un seul rechargement réseau pour N appels concurrents à
 * `reload()`) — c'est cette dernière garantie que le code d'avant cette
 * migration fournissait (`reloadInFlight` partagé), et que le test de ce
 * jalon vérifie explicitement ("deux appels concurrents à reload() ne
 * doivent produire qu'un seul chargement en vol"). Les deux mécanismes sont
 * donc conservés, chacun pour son propre rôle : la garde JS `reloadInFlight`
 * (inchangée, déjà correcte en JS mono-thread — aucune interposition possible
 * entre le test `if (!reloadInFlight)` et l'affectation qui suit) assure le
 * COALESCING observable ; le `Semaphore(1)` enveloppe le VRAI travail
 * (`performLoadEffect`) comme garde-fou structurel supplémentaire, au cas où
 * un futur appelant déclencherait un jour `performLoad` par un autre chemin
 * que `reload()` sans passer par cette garde — ceinture ET bretelles,
 * documenté ici pour qu'on ne redécouvre pas la distinction plus tard.
 *
 * **Polling.** Le `setTimeout` récursif devient `Effect.repeat(Schedule.spaced(...))`
 * — `pollOnceEffect` ne peut jamais échouer (un `HEAD` raté est avalé, comme
 * avant, silencieusement), donc la boucle tourne indéfiniment jusqu'à
 * interruption explicite de la fibre. Exécutée en tâche de fond via
 * `GameRuntime.runFork` (jamais attendue, comme l'ancien `void poll()`),
 * interrompue dans `stop()` via `fiber.interruptUnsafe()` — la variante
 * synchrone de l'API (voir `node_modules/effect/src/Fiber.ts`), choisie ici
 * précisément parce que `stop()` est un point d'entrée PLAIN-JS (pas un
 * `Effect`), donc il n'y a pas de générateur ambiant pour `yield* Fiber.interrupt(...)`.
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
  let reloadInFlight: Promise<void> | null = null;
  let resolveReady!: (handle: LevelHandle) => void;
  const ready = new Promise<LevelHandle>((resolve) => {
    resolveReady = resolve;
  });

  // Garde-fou structurel supplémentaire autour du VRAI travail de
  // rechargement — voir la doc de tête de fichier ("Mutex de rechargement")
  // pour la raison exacte pour laquelle ceci NE remplace PAS `reloadInFlight`
  // ci-dessus (un Semaphore seul sérialiserait au lieu de coalescer).
  const reloadSemaphore = Semaphore.makeUnsafe(1);

  function performLoadEffect(): Effect.Effect<void> {
    return Effect.tryPromise({
      try: () => loadLevel(url, scene, physics),
      catch: (cause) => cause,
    }).pipe(
      Effect.map((nextHandle) => {
        currentHandle?.dispose();
        currentHandle = nextHandle;
        const info = { isFirstLoad };
        if (isFirstLoad) {
          isFirstLoad = false;
          resolveReady(nextHandle);
        }
        options.onLoaded?.(nextHandle, info);
      }),
      Effect.catch((error) =>
        Effect.sync(() => {
          console.error(`[level] échec du (re)chargement de "${url}" — niveau précédent conservé.`, error);
          options.onError?.(error);
        }),
      ),
    );
  }

  function performLoad(): Promise<void> {
    return GameRuntime.runPromise(reloadSemaphore.withPermit(performLoadEffect()));
  }

  function reload(): Promise<void> {
    if (!reloadInFlight) {
      reloadInFlight = performLoad().finally(() => {
        reloadInFlight = null;
      });
    }
    return reloadInFlight;
  }

  function pollOnceEffect(): Effect.Effect<void> {
    return Effect.gen(function* () {
      const res = yield* Effect.tryPromise({
        try: () => fetch(url, { method: "HEAD", cache: "no-store" }),
        catch: () => null,
      }).pipe(
        // Serveur dev temporairement indisponible (rebuild Vite, etc.) : on
        // retente au prochain tick, jamais de throw depuis la boucle de fond
        // — même comportement silencieux qu'avant cette migration.
        Effect.catch(() => Effect.succeed(null)),
      );
      if (!res || !res.ok) return;

      const signature =
        res.headers.get("etag") ?? res.headers.get("last-modified") ?? res.headers.get("content-length");
      if (signature === null) return;

      if (lastSignature !== null && signature !== lastSignature) {
        console.info(`[level] changement détecté sur "${url}" — rechargement.`);
        yield* Effect.promise(() => reload());
      }
      lastSignature = signature;
    });
  }

  // `Effect.repeat(Schedule.spaced(...))` a pour type de sortie celui du
  // Schedule (un compteur `number`), pas `void` — sans intérêt ici (jamais
  // lu), donc typé au plus large (`unknown`) ; `Fiber<out A, ...>` est
  // covariant en `A`, ce qui rend cette annotation valide sans cast.
  let pollFiber: Fiber.Fiber<unknown, never> | null = GameRuntime.runFork(
    pollOnceEffect().pipe(Effect.repeat(Schedule.spaced(pollIntervalMs))),
  );

  void reload();

  return {
    get current() {
      return currentHandle;
    },
    ready,
    reload,
    stop() {
      currentHandle?.dispose();
      currentHandle = null;
      if (pollFiber) {
        pollFiber.interruptUnsafe();
        pollFiber = null;
      }
    },
  };
}
