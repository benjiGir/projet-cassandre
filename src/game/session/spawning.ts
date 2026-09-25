import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Effect } from "effect";

import { assetUrl } from "../../core/assetPath";
import { runGameplaySync } from "../../core/runtime";
import { RaycastService } from "../../physics/raycast";
import { GROUP, interactionGroups } from "../../physics/world";
import { BillboardSprite } from "../../render/billboard";
import { enemySpriteQuad } from "../../render/enemySprites";
import { dressAmmoPickup, dressHealPickup } from "../../render/pickups";
import { LightPool } from "../../render/lightPool";
import { PropSystem } from "../level/props";
import { DoorSystem } from "../level/doors";
import { VitreSystem } from "../level/vitres";
import { SanitaireSystem } from "../level/sanitaires";
import { dressWeaponPickup } from "../../render/viewmodel";
import { Suit } from "../entities/suit";
import { suitConfig } from "../entities/suitConfig";
import { Director } from "../entities/director";
import { directorConfig } from "../entities/directorConfig";
import { createLevelSession } from "../level/hotReload";
import { reportLoading } from "../../core/loadingProgress";
import { PathfindingService, navGraphStats } from "../level/pathfinding";
import { useGameStore } from "../state";
import { type GameSession } from "./gameSession";
import { type PersistentEngine } from "./gameEngine";

/**
 * Normales des sprites d'ennemis inclinées de 45° vers le haut : les lampes du
 * niveau v2 sont des néons de plafond, qu'un quad vertical ne voit presque pas.
 * see: docs/systems/rendu.md#éclairage-des-sprites
 */
const ENEMY_SPRITE_NORMAL_TILT = Math.PI / 4;

/**
 * Fait apparaître un Costard ET son `BillboardSprite`, toujours ensemble —
 * un Costard sans sprite serait invisible mais actif, un bug de lisibilité
 * silencieux. `facing` par défaut vise la position courante du joueur.
 *
 * `session` est un paramètre EXPLICITE (pas une lecture d'`engine.session`) :
 * lui faire lire `engine.session` pousserait le Costard dans l'ANCIENNE
 * partie pendant un `bootGameSession` en cours (bug silencieux : l'entité
 * semblerait juste ne jamais apparaître).
 * see: docs/systems/session.md#spawn-et-chargement-de-niveau
 */
export function spawnSuitAt(engine: PersistentEngine, session: GameSession, x: number, feetY: number, z: number): Suit {
  const facing = new THREE.Vector3(session.player.position.x - x, 0, session.player.position.z - z);
  if (facing.lengthSq() < 1e-6) facing.set(0, 0, 1);
  facing.normalize();

  const suit = session.suitManager.spawnSuit(x, feetY, z, facing);
  // Le rendu interpole le CENTRE de la capsule : les pieds de l'atlas se
  // posent sur son bas, offset du KCC compris.
  const sheet = engine.suitSheet;
  const sprite = new BillboardSprite(engine.scene, sheet.atlases.humain, {
    rows: sheet.rows,
    normalTilt: ENEMY_SPRITE_NORMAL_TILT,
    ...enemySpriteQuad(sheet, suitConfig.capsuleHalfHeight + suitConfig.capsuleRadius + suitConfig.colliderOffset),
  });
  session.suitSprites.set(suit.id, sprite);
  return suit;
}

/** Même rôle que `spawnSuitAt`, pour le Directeur — même raison pour les paramètres `engine`/`session` explicites. */
export function spawnDirectorAt(
  engine: PersistentEngine,
  session: GameSession,
  x: number,
  feetY: number,
  z: number,
): Director {
  const facing = new THREE.Vector3(session.player.position.x - x, 0, session.player.position.z - z);
  if (facing.lengthSq() < 1e-6) facing.set(0, 0, 1);
  facing.normalize();

  const director = session.directorManager.spawnDirector(x, feetY, z, facing);
  const sheet = engine.directorSheet;
  const sprite = new BillboardSprite(engine.scene, sheet.atlases.humain, {
    rows: sheet.rows,
    normalTilt: ENEMY_SPRITE_NORMAL_TILT,
    ...enemySpriteQuad(
      sheet,
      directorConfig.capsuleHalfHeight + directorConfig.capsuleRadius + directorConfig.colliderOffset,
    ),
  });
  session.directorSprites.set(director.id, sprite);
  return director;
}

const GROUND_PROBE_GROUPS = interactionGroups(GROUP.PLAYER_SHOT, GROUP.WORLD);

/** Hauteur du premier collider du monde sous `point` (3 m au plus), `null` sinon. */
function groundBelow(session: GameSession, point: THREE.Vector3): number | null {
  const ray = new RAPIER.Ray({ x: point.x, y: point.y, z: point.z }, { x: 0, y: -1, z: 0 });
  const hit = runGameplaySync(
    RaycastService.use((raycast) =>
      raycast.castRay(session.physics, ray, 3, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, GROUND_PROBE_GROUPS),
    ),
  );
  return hit ? point.y - hit.timeOfImpact : null;
}

/**
 * Charge (ou recharge) `public/assets/levels/<name>.glb` dans `session` —
 * voir `game/level/hotReload.ts` pour le mécanisme de hot reload lui-même.
 * `engine`/`session` explicites, même raison que `spawnSuitAt` ci-dessus.
 * see: docs/systems/session.md#spawn-et-chargement-de-niveau
 */
export function loadGltfLevel(engine: PersistentEngine, session: GameSession, name: string): void {
  session.gltfLevelSession?.stop();
  const url = assetUrl(`assets/levels/${name}.glb`);
  session.gltfLevelSession = createLevelSession(url, engine.scene, session.physics, {
    // Bornes du chargement : le `.glb` occupe la part du lion, le reste de
    // `main.ts` se partage ce qui l'encadre. Elles sont ici plutôt qu'au
    // rapporteur parce que seul l'appelant sait ce qui vient après lui.
    onProgress: (fraction) => reportLoading("Chargement du niveau", 0.3 + fraction * 0.55),
    onLoaded: (handle, info) => {
      // Jets d'eau permanents des sanitaires cassés (`FxSystem.addWaterJet`) :
      // propres au niveau qui vient de disparaître — un hot reload comme un
      // premier chargement doivent tous deux repartir sans jet fantôme, même
      // raison que le rechargement de `session.vitreSystem`/`propSystem` plus
      // bas (les corps Rapier du niveau précédent n'existent déjà plus).
      engine.fx.clearWaterJets();

      // Le glTF est là mais tout ce qui suit est SYNCHRONE et bloque : on
      // annonce l'étape avant de la commencer, sinon le libellé n'apparaît
      // qu'une fois le travail fini — c'est-à-dire jamais.
      reportLoading("Construction du décor et des portes", 0.86);
      // Portes ANIMÉES : construites AVANT le bake du graphe de navigation,
      // pour pouvoir rendre les groupes `auto` PASSANTS le temps du bake
      // (sinon un bureau derrière une porte automatique fermée ne reçoit
      // jamais d'arête — un vantail verrouillé, lui, doit rester bloquant).
      // see: docs/decisions/0031-portes-animees-et-vitres.md
      const doorSystem = new DoorSystem(handle.doors);
      const autoColliders = doorSystem.autoGroupColliders;
      for (const collider of autoColliders) collider.setEnabled(false);

      reportLoading("Cuisson du graphe de navigation", 0.92);
      const navGraphBounds = new THREE.Box3().setFromObject(handle.root);
      session.physics.refreshSceneQueries();
      session.currentNavGraph = runGameplaySync(
        PathfindingService.use((pf) => pf.bake(session.physics, navGraphBounds)),
      );

      for (const collider of autoColliders) collider.setEnabled(true);
      session.doorSystem = doorSystem;

      // Portes déjà déverrouillées CETTE PARTIE (hot reload) : le nouveau
      // `.glb` reconstruit des corps/colliders neufs, toujours à l'état
      // fermé — sans ceci, un hot reload reverrouillerait silencieusement
      // une porte à carte/`use_*` déjà ouverte. `silent` : pas de son, pas de
      // ré-ouverture visible pour rien.
      for (const name of session.unlockedDoors) {
        doorSystem.open(name, session.player.position, { silent: true });
      }

      // Vitrages : même raison de les reconstruire ici que le reste — un hot
      // reload remplace les corps/colliders du niveau, les vitres reviennent
      // donc intactes avec le fichier (comme les PV des props).
      session.vitreSystem = new VitreSystem(handle.vitres);

      // Sanitaires : même raison de les reconstruire ici que les vitres — un
      // hot reload remplace les corps/colliders du niveau, ils reviennent donc
      // intacts avec le fichier (délai de soulagement à part : c'est un état
      // de PARTIE, dans `session.sanitaireReliefCooldown`, pas touché ici).
      session.sanitaireSystem = new SanitaireSystem(handle.sanitaires);

      // Pool de lampes : reconstruit à CHAQUE chargement (le hot reload peut
      // ajouter, déplacer ou retirer des `light_*`), et dès maintenant plutôt
      // qu'à la première image — une scène qui dépasse le mur d'uniformes ne
      // lève aucune exception, elle affiche du vide.
      // see: docs/decisions/0026-visibilite-par-espace-et-pool-de-lampes.md
      session.lightPool = new LightPool(handle.lights);

      // Mobilier physique : même raison de le reconstruire ici que le pool de
      // lampes et le graphe de navigation — un hot reload remplace les corps
      // Rapier du niveau, donc toute table indexée sur leurs handles.
      session.propSystem = new PropSystem(handle.props, handle.root);

      // Ramassages d'armes et trousses de soin : la boîte du `.glb` cède la
      // place au vrai modèle, posé sur la surface réellement sous elle.
      for (const useObject of handle.useObjects) {
        if (useObject.heals !== null) {
          dressHealPickup(useObject.object, groundBelow(session, useObject.position));
          continue;
        }
        if (useObject.ammo !== null) {
          dressAmmoPickup(useObject.object, groundBelow(session, useObject.position));
          continue;
        }
        const weapon =
          useObject.name === "use_crowbar"
            ? "melee"
            : useObject.name === "use_pistol"
              ? "pistol"
              : useObject.name === "use_shotgun"
                ? "shotgun"
                : null;
        if (!weapon) continue;
        const groundY = groundBelow(session, useObject.position);
        dressWeaponPickup(useObject.object, weapon, engine.weaponModels, groundY);
      }

      const navStats = navGraphStats(session.currentNavGraph);
      console.info(
        `[pathfinding] graphe baké — ${navStats.walkableCount}/${navStats.cellCount} cellules praticables, ` +
          `${navStats.edgeCount} arêtes (grille ${navStats.cols}×${navStats.rows}, pas ${navStats.cellSize} m)`,
      );

      console.info(
        `[level] "${name}.glb" chargé — colliders ${handle.stats.colliderCount} ` +
          `(cuboid ${handle.stats.colliderKindCounts.cuboid}, hull ${handle.stats.colliderKindCounts.convexHull}, ` +
          `trimesh ${handle.stats.colliderKindCounts.trimesh}), ` +
          `spawns Costard ${handle.stats.spawnSuitCount}, spawns Directeur ${handle.stats.spawnDirectorCount}, ` +
          `triggers ${handle.stats.triggerCount}, ` +
          `portes ${handle.stats.doorCount}, use ${handle.stats.useCount}, ` +
          `secrets ${handle.stats.secretCount}, meshes non préfixés ${handle.stats.unprefixedMeshCount}, ` +
          `lampes ${handle.stats.lightCount} (${session.lightPool.stats.actives} allumées), ` +
          `props ${handle.stats.propCount}, ` +
          `vitres ${handle.stats.vitreCount} (${handle.stats.vitreBatchCount} lots), ` +
          `sanitaires ${handle.stats.sanitaireCount} (${handle.stats.sanitaireBatchCount} lots), ` +
          `lots de décor ${handle.stats.decorBatchCount}`,
      );
      // Seul le TOUT PREMIER chargement DE CETTE SESSION déplace le joueur
      // — un hot reload ne doit JAMAIS respawn (voir `hotReload.ts`).
      // see: docs/systems/session.md#spawn-et-chargement-de-niveau
      if (info.isFirstLoad && handle.spawnPlayer) {
        session.player.spawn(handle.spawnPlayer.position.x, handle.spawnPlayer.position.y, handle.spawnPlayer.position.z);
        engine.look.yaw = handle.spawnPlayer.yaw;
        engine.look.pitch = 0;
      }

      // `handle.spawnSuits` (Empties `spawn_suit_*`, voir `loader.ts`) :
      // MÊME garde `isFirstLoad` que `spawn_player` juste au-dessus.
      // `SuitManager` n'expose aucun retrait en masse aujourd'hui (seul un
      // retrait par mort individuelle) — un hot reload PENDANT une partie
      // ne duplique donc jamais de Costards et n'interrompt jamais un
      // combat en cours.
      if (info.isFirstLoad) {
        for (const spawn of handle.spawnSuits) {
          spawnSuitAt(engine, session, spawn.position.x, spawn.position.y, spawn.position.z);
        }
        // `handle.spawnDirectors` (Empties `spawn_director_*`) : même garde
        // `isFirstLoad`, même raison exacte que `spawn_suit_*` ci-dessus.
        for (const spawn of handle.spawnDirectors) {
          spawnDirectorAt(engine, session, spawn.position.x, spawn.position.y, spawn.position.z);
        }
      }

      // Compteur de secrets (`debug.secretsTotal`) : fixé à CHAQUE
      // chargement (pas seulement `isFirstLoad`) puisque `handle.secrets`
      // change avec le niveau chargé — contrairement aux spawns, ce n'est
      // pas un événement ponctuel de partie mais une propriété du niveau
      // courant.
      useGameStore.getState().setSecretsTotal(handle.stats.secretCount);
    },
  });
}

/**
 * Wrapper console pour `PathfindingService.findPath` sur le graphe
 * COURANT DE `session` (`cassandre.pathfinding.findPath(...)`), pour
 * visualiser/vérifier un chemin en direct. `null` si aucun graphe n'est
 * encore baké ou si aucun chemin n'a été trouvé — jamais d'exception qui
 * remonterait à la console.
 */
export function debugFindPath(session: GameSession, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
  const graph = session.currentNavGraph;
  if (!graph) return null;
  const result = runGameplaySync(
    PathfindingService.use((pf) => pf.findPath(graph, from, to)).pipe(Effect.catch(() => Effect.succeed(null))),
  );
  return result ? Array.from(result) : null;
}
