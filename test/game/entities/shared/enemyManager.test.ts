/**
 * Le lot commun des gestionnaires d'ennemis : files d'événements lues « ce
 * pas » ou « depuis la dernière image », regroupement des impacts, graines
 * d'apparition — et ce que le Directeur y ajoute (révélation, carte lâchée).
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { directorConfig } from "../../../../src/game/entities/director/directorConfig";
import { DirectorManager } from "../../../../src/game/entities/director/directorManager";
import { EventQueue } from "../../../../src/game/entities/shared/eventQueue";
import { suitConfig } from "../../../../src/game/entities/suit/suitConfig";
import { SuitManager } from "../../../../src/game/entities/suit/suitManager";
import { weaponConfig } from "../../../../src/game/player/weapons/weaponConfig";
import type { HitEvent } from "../../../../src/game/player/weapons/weaponTypes";
import { initPhysics, PhysicsWorld } from "../../../../src/physics/world";

await initPhysics();

const DT = 1 / 60;
/** Assez loin pour qu'aucun ennemi ne voie ni n'attaque le joueur. */
const LOIN = new THREE.Vector3(0, 0, 500);
const YEUX = new THREE.Vector3(0, 1.6, 500);

function coup(
  cible: { position: THREE.Vector3; collider: { handle: number } | null },
  weapon: HitEvent["weapon"] = "melee",
  distance = 1.5,
): HitEvent {
  return {
    point: cible.position.clone(),
    normal: new THREE.Vector3(0, 0, 1),
    material: "flesh",
    weapon,
    colliderHandle: cible.collider!.handle,
    distance,
  };
}

describe("EventQueue", () => {
  it("`all` garde tout jusqu'à `clear` ; `stepCount`/`stepAt` ne voient que ce qui suit `beginStep`", () => {
    const queue = new EventQueue<string>();
    queue.push("pas 1 — a");
    queue.push("pas 1 — b");

    queue.beginStep();
    expect(queue.stepCount).toBe(0);
    expect(queue.stepAt(0)).toBeUndefined();

    queue.push("pas 2 — a");
    expect(queue.stepCount).toBe(1);
    expect(queue.stepAt(0)).toBe("pas 2 — a");
    expect(queue.stepAt(1)).toBeUndefined();
    expect(queue.all).toEqual(["pas 1 — a", "pas 1 — b", "pas 2 — a"]);
  });

  it("`clear` vide la file et remet le pas à zéro", () => {
    const queue = new EventQueue<number>();
    queue.push(1);
    queue.beginStep();
    queue.push(2);

    queue.clear();

    expect(queue.all).toEqual([]);
    expect(queue.stepCount).toBe(0);
    queue.push(3);
    expect(queue.stepAt(0)).toBe(3);
  });
});

describe("EnemyManager — files d'événements", () => {
  it("un coup non fatal blesse : un événement, lisible ce pas et à l'image", () => {
    const manager = new SuitManager(new PhysicsWorld());
    const suit = manager.spawnSuit(0, 0, 0);

    manager.update(DT, LOIN, YEUX, [coup(suit)]);

    expect(suit.hp).toBe(suitConfig.maxHp - weaponConfig.meleeDamage);
    expect(manager.hurtEvents.map((event) => event.enemy)).toEqual([suit]);
    expect(manager.deaths.stepCount).toBe(0);
  });

  it("plusieurs impacts sur un même ennemi au même pas ne font qu'un coup", () => {
    const manager = new SuitManager(new PhysicsWorld());
    const suit = manager.spawnSuit(0, 0, 0);

    manager.update(DT, LOIN, YEUX, [coup(suit), coup(suit)]);

    expect(suit.isAlive).toBe(false);
    expect(manager.deathEvents).toHaveLength(1);
    expect(manager.hurtEvents).toHaveLength(0);
  });

  it("deux morts sur deux pas fixes d'une même image : chaque pas ne compte que la sienne, l'image voit les deux", () => {
    const manager = new SuitManager(new PhysicsWorld());
    const premier = manager.spawnSuit(0, 0, 0);
    const second = manager.spawnSuit(5, 0, 0);
    const hits = [coup(premier), coup(premier)];

    manager.update(DT, LOIN, YEUX, hits);
    expect(manager.deaths.stepCount).toBe(1);
    expect(manager.deaths.stepAt(0)?.enemy).toBe(premier);

    // La file des impacts du joueur n'est vidée qu'à l'image : le second pas ne rejoue pas les deux premiers.
    hits.push(coup(second), coup(second));
    manager.update(DT, LOIN, YEUX, hits);
    expect(manager.deaths.stepCount).toBe(1);
    expect(manager.deaths.stepAt(0)?.enemy).toBe(second);
    expect(manager.deathEvents.map((event) => event.enemy)).toEqual([premier, second]);

    manager.update(DT, LOIN, YEUX, hits);
    expect(manager.deaths.stepCount).toBe(0);
    expect(manager.deathEvents).toHaveLength(2);
  });

  it("`clearFrameEvents` vide les files et relit les impacts depuis le début de la suivante", () => {
    const manager = new SuitManager(new PhysicsWorld());
    const suit = manager.spawnSuit(0, 0, 0);
    manager.update(DT, LOIN, YEUX, [coup(suit)]);

    manager.clearFrameEvents();
    expect(manager.hurtEvents).toHaveLength(0);

    manager.update(DT, LOIN, YEUX, [coup(suit)]);
    expect(suit.isAlive).toBe(false);
    expect(manager.deathEvents).toHaveLength(1);
  });

  it("un impact sur un collider inconnu ou sur un mort est ignoré", () => {
    const manager = new SuitManager(new PhysicsWorld());
    const suit = manager.spawnSuit(0, 0, 0);
    const handle = suit.collider!.handle;
    manager.debugKill(suit);
    manager.clearFrameEvents();

    manager.update(DT, LOIN, YEUX, [
      { ...coup({ position: suit.position, collider: { handle } }) },
      { ...coup({ position: suit.position, collider: { handle: 987654 } }) },
    ]);

    expect(manager.deathEvents).toHaveLength(0);
    expect(manager.hurtEvents).toHaveLength(0);
  });

  it("au pompe à bout portant, la mort demande des gibs, au point et dans l'axe du coup", () => {
    const manager = new SuitManager(new PhysicsWorld());
    const suit = manager.spawnSuit(0, 0, 0);
    const plomb = coup(suit, "shotgun", suitConfig.gibDistance - 0.1);

    manager.update(
      DT,
      LOIN,
      YEUX,
      Array.from({ length: 60 }, () => plomb),
    );

    const [mort] = manager.deathEvents;
    expect(mort.gibs).toBe(true);
    expect(mort.point.toArray()).toEqual(plomb.point.toArray());
    expect(mort.direction.toArray()).toEqual([-0, -0, -1]);
  });

  it("au-delà de la distance de gibs, la mort est ordinaire et recule à l'opposé du joueur", () => {
    const manager = new SuitManager(new PhysicsWorld());
    const suit = manager.spawnSuit(0, 0, 0);
    const plomb = coup(suit, "shotgun", suitConfig.gibDistance + 1);

    manager.update(
      DT,
      LOIN,
      YEUX,
      Array.from({ length: 60 }, () => plomb),
    );

    const [mort] = manager.deathEvents;
    expect(mort.gibs).toBe(false);
    expect(mort.direction.z).toBeCloseTo(-1);
  });

  it("`debugKill` tue un vivant une seule fois", () => {
    const manager = new SuitManager(new PhysicsWorld());
    const suit = manager.spawnSuit(0, 0, 0);

    expect(manager.debugKill(suit)).toBe(true);
    expect(manager.debugKill(suit)).toBe(false);
    expect(manager.deathEvents).toHaveLength(1);
  });
});

describe("EnemyManager — apparitions", () => {
  it("deux parties donnent les mêmes ennemis dans le même ordre : mêmes déplacements au pas près", () => {
    const partie = () => {
      const manager = new SuitManager(new PhysicsWorld());
      const suits = [manager.spawnSuit(0, 0, 0), manager.spawnSuit(4, 0, 0), manager.spawnSuit(8, 0, 0)];
      const joueur = new THREE.Vector3(2, 0.9, 6);
      for (let pas = 0; pas < 240; pas++) manager.update(DT, joueur, joueur, []);
      return suits.map((suit) => [suit.state, suit.position.toArray(), suit.forward.toArray()]);
    };

    expect(partie()).toEqual(partie());
  });

  it("chaque espèce naît avec sa configuration et son rang d'apparence", () => {
    const manager = new SuitManager(new PhysicsWorld());

    const a = manager.spawnSuit(0, 0, 0);
    const b = manager.spawnSuit(3, 0, 0, undefined, "rampant");
    const c = manager.spawnSuit(6, 0, 0);

    expect([a.kind, b.kind, c.kind]).toEqual(["costard", "rampant", "costard"]);
    expect([a.appearanceIndex, b.appearanceIndex, c.appearanceIndex]).toEqual([0, 0, 1]);
    expect(b.cfg).toBe(manager.configFor("rampant"));
    expect(manager.suits).toEqual([a, b, c]);
  });
});

describe("DirectorManager — ce que le boss ajoute", () => {
  const TROP_LOIN_POUR_LA_CARTE = new THREE.Vector3(50, 0, 50);

  function boss() {
    const manager = new DirectorManager(new PhysicsWorld());
    const director = manager.spawnDirector(0, 0, 0);
    /** Retire `amount` PV en coups de pied-de-biche, un pas fixe par coup. */
    const frapper = (coups: number) => {
      for (let i = 0; i < coups; i++) {
        manager.update(DT, LOIN, YEUX, [coup(director)]);
        manager.clearFrameEvents();
      }
    };
    return { manager, director, frapper };
  }

  it("tombe le masque en passant sous le seuil de PV : lisible ce pas et à l'image, une seule fois", () => {
    const { manager, director, frapper } = boss();
    const seuil = directorConfig.revealHpFraction * directorConfig.maxHp;
    frapper(Math.ceil((directorConfig.maxHp - seuil) / weaponConfig.meleeDamage) - 1);
    expect(director.revealed).toBe(false);

    manager.update(DT, LOIN, YEUX, [coup(director)]);
    expect(director.revealed).toBe(true);
    expect(manager.reveals.stepCount).toBe(1);
    expect(manager.revealEvents.map((event) => event.enemy)).toEqual([director]);
    expect(manager.hurtEvents).toHaveLength(1);

    manager.clearFrameEvents();
    manager.update(DT, LOIN, YEUX, [coup(director)]);
    expect(manager.revealEvents).toHaveLength(0);
    expect(director.tintColor).toBe(directorConfig.revealedTintColor);
  });

  it("meurt sans gibs, même au pompe à bout portant, et lâche sa carte à ses pieds", () => {
    const { manager, director } = boss();
    const plomb = coup(director, "shotgun", 0.5);

    manager.update(
      DT,
      LOIN,
      YEUX,
      Array.from({ length: 200 }, () => plomb),
    );

    expect(director.isAlive).toBe(false);
    expect(manager.deathEvents).toHaveLength(1);
    expect(manager.deathEvents[0].gibs).toBe(false);
    const piedsY = director.position.y - (directorConfig.capsuleHalfHeight + directorConfig.capsuleRadius);
    expect(manager.droppedCard?.position.y).toBeCloseTo(piedsY + 0.15);
    expect(manager.droppedCard?.collected).toBe(false);
  });

  it("la carte ne se ramasse qu'après son délai, à portée, et une seule fois", () => {
    const { manager, director } = boss();
    manager.debugKill(director);
    const surLaCarte = manager.droppedCard!.position.clone();

    expect(manager.tryCollectCard(surLaCarte)).toBe(false);

    for (let t = 0; t < directorConfig.cardPickupDelay + DT; t += DT) manager.update(DT, LOIN, YEUX, []);
    expect(manager.tryCollectCard(TROP_LOIN_POUR_LA_CARTE)).toBe(false);
    expect(manager.tryCollectCard(surLaCarte)).toBe(true);
    expect(manager.tryCollectCard(surLaCarte)).toBe(false);
  });

  it("sans Directeur mort, il n'y a ni carte ni ramassage", () => {
    const { manager } = boss();

    expect(manager.droppedCard).toBeNull();
    expect(manager.tryCollectCard(new THREE.Vector3())).toBe(false);
  });

  it("le souffle d'une explosion blesse le Directeur sans jamais le démembrer", () => {
    const { manager, director } = boss();

    manager.applyBlast(
      director.position,
      () => directorConfig.maxHp * 2,
      () => true,
    );

    expect(director.isAlive).toBe(false);
    expect(manager.deathEvents[0].gibs).toBe(false);
  });
});
