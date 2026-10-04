/**
 * Souffle d'un prop `gaz` sur les vivants (lot B3) : dégâts selon la distance,
 * mur qui arrête le souffle, morts comptées comme des kills.
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DirectorManager } from "../../../../src/game/entities/director/directorManager";
import { suitConfig } from "../../../../src/game/entities/suit/suitConfig";
import { SuitManager } from "../../../../src/game/entities/suit/suitManager";
import { useGameStore } from "../../../../src/game/hud/state";
import { blastDamageAt, explosionConfig } from "../../../../src/game/level/props/propConfig";
import { type GameEngine } from "../../../../src/game/session/gameEngine";
import { type GameSession } from "../../../../src/game/session/gameSession";
import { applyBlast } from "../../../../src/game/session/player/explosions";
import { HeroPortrait } from "../../../../src/game/session/presentation/heroPortrait";
import { createInitialStats } from "../../../../src/game/session/progression/score";
import { createStreamState } from "../../../../src/game/session/stream/streamSim";
import { COLLISION_GROUPS, initPhysics, PhysicsWorld } from "../../../../src/physics/world";

vi.mock("../../../../src/core/audio/audio", () => ({ playSfx: vi.fn(), playHeroVoice: vi.fn(() => false) }));

await initPhysics();

const CENTRE = new THREE.Vector3(0, 1, 0);
const engine = { look: { yaw: 0 }, flow: { playerDied: vi.fn() } } as unknown as GameEngine;

function session(joueur: THREE.Vector3): GameSession {
  const physics = new PhysicsWorld();
  return {
    physics,
    player: { position: joueur },
    playerHp: 100,
    playerMaxHp: 100,
    suitManager: new SuitManager(physics),
    directorManager: new DirectorManager(physics),
    heroPortrait: new HeroPortrait(),
    lastHeroLineAt: -Infinity,
    lastHeroBarkAt: -Infinity,
    heroLinesSaid: new Set(),
    heroLineRandom: () => 0.99,
    deathHandled: false,
    lowHpLineTriggered: false,
    stats: createInitialStats(),
    stream: createStreamState(),
    choice: {},
  } as unknown as GameSession;
}

/** Un mur plein en x = 2, entre le centre du souffle et tout ce qui est à +X. */
function mur(physics: PhysicsWorld): void {
  const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(2, 1.5, 0));
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 3, 6).setCollisionGroups(COLLISION_GROUPS.WORLD), body);
}

beforeEach(() => {
  useGameStore.getState().resetGameStore();
  vi.mocked(engine.flow.playerDied).mockClear();
});

describe("applyBlast — souffle d'une explosion", () => {
  it("tue les Costards proches, blesse les plus lointains, épargne ceux hors du rayon", () => {
    const s = session(new THREE.Vector3(0, 1, 50));
    const proche = s.suitManager.spawnSuit(1.5, 0, 0);
    const loin = s.suitManager.spawnSuit(4.2, 0, 0);
    const dehors = s.suitManager.spawnSuit(8, 0, 0);
    s.physics.step(0);

    const bilan = applyBlast(engine, s, CENTRE);

    expect(bilan.suitKills).toBe(1);
    expect(proche.isAlive).toBe(false);
    expect(loin.isAlive).toBe(true);
    expect(loin.hp).toBeLessThan(suitConfig.maxHp);
    expect(dehors.hp).toBe(suitConfig.maxHp);
    // À bout portant du souffle, le Costard part en morceaux.
    expect(s.suitManager.deathEvents[0]!.gibs).toBe(true);
  });

  it("un mur arrête le souffle : ni le Costard ni le joueur derrière lui ne sont touchés", () => {
    const s = session(new THREE.Vector3(3, 1, 0));
    const abrite = s.suitManager.spawnSuit(3.5, 0, 1);
    mur(s.physics);
    s.physics.step(0);

    const bilan = applyBlast(engine, s, CENTRE);

    expect(bilan).toEqual({ suitKills: 0, directorKills: 0, playerDamage: 0 });
    expect(abrite.hp).toBe(suitConfig.maxHp);
    expect(s.playerHp).toBe(100);
  });

  it("le joueur encaisse une part des dégâts, publiée au HUD", () => {
    const s = session(new THREE.Vector3(2, 1, 0));
    s.physics.step(0);
    const attendu = Math.round(blastDamageAt(2) * explosionConfig.playerDamageScale);

    const bilan = applyBlast(engine, s, CENTRE);

    expect(bilan.playerDamage).toBe(attendu);
    expect(s.playerHp).toBe(100 - attendu);
    expect(s.stats.hpLost).toBe(attendu);
    expect(useGameStore.getState().debug.playerHp).toBe(100 - attendu);
    expect(engine.flow.playerDied).not.toHaveBeenCalled();
  });

  it("même au centre, une seule explosion ne tue pas un joueur en pleine forme", () => {
    const s = session(CENTRE.clone());
    s.physics.step(0);

    applyBlast(engine, s, CENTRE);

    expect(s.playerHp).toBeGreaterThan(0);
  });

  it("le Directeur encaisse le souffle sans en mourir d'un coup", () => {
    const s = session(new THREE.Vector3(0, 1, 50));
    const directeur = s.directorManager.spawnDirector(1.5, 0, 0);
    const pvAvant = directeur.hp;
    s.physics.step(0);

    const bilan = applyBlast(engine, s, CENTRE);

    expect(bilan.directorKills).toBe(0);
    expect(directeur.hp).toBeLessThan(pvAvant);
  });
});
