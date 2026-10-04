/**
 * Bouclier d'un ennemi (`shared/enemyShield.ts`) : l'arc avant arrête un
 * impact, vu de dessus seulement.
 */
import { describe, expect, it } from "vitest";

import { isShieldedHit } from "../../../../src/game/entities/shared/enemyShield";

const AVANT = { x: 0, z: 1 };
const BOUCLIER = { halfArcDeg: 70 };
const cote = (deg: number) => ({ x: Math.sin((deg * Math.PI) / 180), z: Math.cos((deg * Math.PI) / 180) });

describe("isShieldedHit", () => {
  it("sans bouclier, rien n'est arrêté", () => {
    expect(isShieldedHit(undefined, AVANT, AVANT)).toBe(false);
  });

  it("arrête ce qui touche l'avant, jusqu'au bord de l'arc, des deux côtés", () => {
    for (const deg of [0, 35, 69, -35, -69]) expect(isShieldedHit(BOUCLIER, AVANT, cote(deg)), `${deg}°`).toBe(true);
  });

  it("laisse passer les flancs et le dos", () => {
    for (const deg of [75, 90, 180, -75, -120]) expect(isShieldedHit(BOUCLIER, AVANT, cote(deg)), `${deg}°`).toBe(false);
  });

  it("suit l'orientation du porteur", () => {
    expect(isShieldedHit(BOUCLIER, { x: 1, z: 0 }, { x: 1, z: 0 })).toBe(true);
    expect(isShieldedHit(BOUCLIER, { x: 1, z: 0 }, { x: -1, z: 0 })).toBe(false);
  });

  it("ne lit que la direction horizontale : la longueur de la normale ne compte pas, un impact vertical ne dit rien", () => {
    expect(isShieldedHit(BOUCLIER, AVANT, { x: 0, z: 0.2 })).toBe(true);
    expect(isShieldedHit(BOUCLIER, AVANT, { x: 0, z: 0 })).toBe(false);
  });
});
