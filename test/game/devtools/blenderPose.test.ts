/**
 * Pont de pose jeu ↔ Blender : le repère doit être celui de l'export glTF
 * (Y-up), sinon `cassandre.tp` pose le joueur ailleurs que `C.shot` ne regardait.
 */
import { describe, expect, it } from "vitest";

import { blenderToThree, threeToBlender } from "../../../src/game/devtools/blenderPose";

describe("blenderPose", () => {
  it("suit la conversion Y-up de glTF : Blender (x, y, z) = three (x, −z, y)", () => {
    expect(blenderToThree(3, 40, 4)).toEqual({ x: 3, y: 4, z: -40 });
  });

  it("fait l'aller-retour sans perte", () => {
    const three = blenderToThree(-12.5, 88, 0.3);
    expect(threeToBlender(three.x, three.y, three.z)).toEqual({ x: -12.5, y: 88, z: 0.3 });
  });
});
