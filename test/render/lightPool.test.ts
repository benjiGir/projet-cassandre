import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { LightPool } from "../../src/render/lightPool";

/** Lampe de portée finie, posée sur l'axe X — `distance` par défaut, comme un néon de plafond. */
function lampe(x: number, distance = 12): THREE.PointLight {
  const light = new THREE.PointLight(0xffffff, 8, distance, 2);
  light.position.set(x, 0, 0);
  light.name = `light_${x}`;
  return light;
}

function allumees(lights: readonly THREE.PointLight[]): number[] {
  return lights.filter((l) => l.visible).map((l) => l.position.x);
}

describe("LightPool", () => {
  it("laisse tout allumé quand le niveau tient sous le budget", () => {
    const lights = [lampe(0), lampe(50), lampe(100)];
    const pool = new LightPool(lights, 48);

    pool.update(new THREE.Vector3(0, 0, 0));

    expect(pool.stats).toEqual({ total: 3, actives: 3, budget: 48 });
    expect(allumees(lights)).toEqual([0, 50, 100]);
  });

  it("n'allume que les lampes les plus proches au-delà du budget", () => {
    const lights = [lampe(0), lampe(10), lampe(20), lampe(30)];
    const pool = new LightPool(lights, 2);

    pool.update(new THREE.Vector3(22, 0, 0));

    expect(allumees(lights)).toEqual([20, 30]);
    expect(pool.stats).toEqual({ total: 4, actives: 2, budget: 2 });
  });

  it("classe sur la sphère d'influence, pas sur la distance à la lampe", () => {
    // La lampe lointaine porte à 60 m, la proche à 2 m : c'est la lointaine qui
    // éclaire peut-être ce que le joueur regarde.
    const proche = lampe(5, 2);
    const lointaine = lampe(50, 60);
    const pool = new LightPool([proche, lointaine], 1);

    pool.update(new THREE.Vector3(0, 0, 0));

    expect(lointaine.visible).toBe(true);
    expect(proche.visible).toBe(false);
  });

  it("n'éteint jamais une lampe de portée illimitée", () => {
    // `distance = 0` veut dire « sans limite » côté three.js : elle éclaire
    // partout, l'éteindre se verrait n'importe où.
    const illimitee = lampe(500, 0);
    const voisine = lampe(0, 12);
    const pool = new LightPool([illimitee, voisine], 1);

    pool.update(new THREE.Vector3(0, 0, 0));

    expect(illimitee.visible).toBe(true);
    expect(voisine.visible).toBe(false);
  });

  it("ne rejuge pas le classement tant que la caméra n'a pas bougé de 2 m", () => {
    const lights = [lampe(0), lampe(4)];
    const pool = new LightPool(lights, 1);

    pool.update(new THREE.Vector3(1.9, 0, 0));
    expect(allumees(lights)).toEqual([0]);

    // 1,6 m plus loin, la seconde lampe est devenue la plus proche — le pool ne
    // le voit pas encore. C'est l'économie recherchée, et elle est sans
    // conséquence visible : seule la lampe la plus LOINTAINE du lot bascule.
    pool.update(new THREE.Vector3(3.5, 0, 0));
    expect(allumees(lights)).toEqual([0]);

    // 2,6 m depuis la dernière évaluation : le seuil est franchi, on rejuge.
    pool.update(new THREE.Vector3(4.5, 0, 0));
    expect(allumees(lights)).toEqual([4]);
  });

  it("rallume tout sur un budget nul, et applique un nouveau budget sans attendre un déplacement", () => {
    const lights = [lampe(0), lampe(10), lampe(20)];
    const pool = new LightPool(lights, 1);
    const camera = new THREE.Vector3(0, 0, 0);

    pool.update(camera);
    expect(allumees(lights)).toEqual([0]);

    pool.setBudget(null);
    pool.update(camera);
    expect(allumees(lights)).toEqual([0, 10, 20]);
    expect(pool.stats.budget).toBeNull();

    pool.setBudget(2);
    pool.update(camera);
    expect(allumees(lights)).toEqual([0, 10]);
  });
});
