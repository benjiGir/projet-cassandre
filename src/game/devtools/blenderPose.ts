import { moveConfig } from "../player/movement/moveConfig";
import type { GameEngine } from "../session/gameEngine";

// see: docs/6-reference/notes-code-gameplay-outils.md#console-et-harnais
export interface BlenderPose {
  /** Position au sol, mètres, repère Blender. */
  x: number;
  y: number;
  /** Altitude des PIEDS. */
  z: number;
  /** Altitude des yeux — ce que `C.shot("joueur")` reprend. */
  eye: number;
  /** Degrés. 0 = +Y Blender, 90 = −X. */
  cap: number;
  /** Degrés, positif vers le haut. */
  pitch: number;
}

const DEG = 180 / Math.PI;

export function threeToBlender(x: number, y: number, z: number): { x: number; y: number; z: number } {
  return { x, y: -z, z: y };
}

export function blenderToThree(x: number, y: number, z: number): { x: number; y: number; z: number } {
  return { x, y: z, z: -y };
}

const round = (v: number, digits: number): number => Number(v.toFixed(digits));

export function readBlenderPose(engine: GameEngine): BlenderPose {
  const player = engine.session.player;
  // `moveConfig` : la config que porte le contrôleur du joueur (valeur par défaut de son constructeur).
  const cfg = moveConfig;
  const centre = player.position;
  const feet = threeToBlender(centre.x, centre.y - cfg.capsuleHalfHeight - cfg.capsuleRadius, centre.z);
  return {
    x: round(feet.x, 2),
    y: round(feet.y, 2),
    z: round(feet.z, 2),
    eye: round(centre.y + player.eyeOffset, 2),
    cap: round((((engine.look.yaw * DEG) % 360) + 360) % 360, 1),
    pitch: round(engine.look.pitch * DEG, 1),
  };
}

export function teleportBlender(engine: GameEngine, x: number, y: number, z: number, cap?: number): BlenderPose {
  const feet = blenderToThree(x, y, z);
  engine.session.player.spawn(feet.x, feet.y, feet.z);
  if (cap !== undefined) {
    engine.look.yaw = cap / DEG;
    engine.look.pitch = 0;
  }
  return readBlenderPose(engine);
}

/** DEV : dépose la pose pour Blender (`renders/_cassandre/pose.json`, plugin de `vite.config.ts`). */
export async function publishBlenderPose(pose: BlenderPose): Promise<boolean> {
  if (!import.meta.env.DEV) return false;
  try {
    const response = await fetch("/__cassandre/pose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pose),
    });
    return response.ok;
  } catch {
    return false;
  }
}
