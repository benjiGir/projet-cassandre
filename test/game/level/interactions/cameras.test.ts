/**
 * `CameraViewSystem` (chantier « Les coulisses », système 4) — console de
 * vidéosurveillance : activation, défilement, sortie au mouvement.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { CameraViewSystem, type CamPoint } from "../../../../src/game/level/interactions/cameras";
import { emptyInputFrame } from "../../../../src/core/input/inputRecorder";

function cam(name: string): CamPoint {
  return { name, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), label: name };
}

describe("CameraViewSystem", () => {
  it("inactive tant qu'aucune console n'a été utilisée", () => {
    const system = new CameraViewSystem([cam("cam_1")]);
    expect(system.active).toBe(false);
    expect(system.currentCam).toBeNull();
  });

  it("activate() choisit la première caméra de la liste", () => {
    const system = new CameraViewSystem([cam("cam_1"), cam("cam_2")]);
    const names = ["cam_1", "cam_2"];
    system.activate(names, 0, 0);
    expect(system.active).toBe(true);
    expect(system.currentCam!.name).toBe("cam_1");
  });

  it("un second appel sur LA MÊME liste (même console) fait défiler, en boucle", () => {
    const system = new CameraViewSystem([cam("cam_1"), cam("cam_2")]);
    const names = ["cam_1", "cam_2"];
    system.activate(names, 0, 0);
    system.activate(names, 0, 0);
    expect(system.currentCam!.name).toBe("cam_2");
    system.activate(names, 0, 0);
    expect(system.currentCam!.name).toBe("cam_1"); // boucle
  });

  it("une liste DIFFÉRENTE (autre console) réinitialise sur la première caméra", () => {
    const system = new CameraViewSystem([cam("cam_1"), cam("cam_2"), cam("cam_3")]);
    system.activate(["cam_1", "cam_2"], 0, 0);
    system.activate(["cam_1", "cam_2"], 0, 0); // -> cam_2
    system.activate(["cam_3"], 0, 0); // console différente
    expect(system.currentCam!.name).toBe("cam_3");
  });

  it("tout mouvement (avancer, reculer, sauter) sort de la vue — invariant #10", () => {
    for (const key of ["forward", "back", "left", "right", "jump"] as const) {
      const system = new CameraViewSystem([cam("cam_1")]);
      system.activate(["cam_1"], 0, 0);
      const frame = { ...emptyInputFrame(), [key]: true };
      system.update(frame);
      expect(system.active).toBe(false);
    }
  });

  it("un léger jitter de visée ne sort pas de la vue, un vrai mouvement de visée si", () => {
    const system = new CameraViewSystem([cam("cam_1")]);
    system.activate(["cam_1"], 0, 0);
    system.update({ ...emptyInputFrame(), yaw: 0.001 });
    expect(system.active).toBe(true);
    system.update({ ...emptyInputFrame(), yaw: 0.5 });
    expect(system.active).toBe(false);
  });

  it("exit() sort immédiatement, quelle que soit la raison", () => {
    const system = new CameraViewSystem([cam("cam_1")]);
    system.activate(["cam_1"], 0, 0);
    system.exit();
    expect(system.active).toBe(false);
  });
});
