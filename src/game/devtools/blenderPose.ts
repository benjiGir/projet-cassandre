import { moveConfig } from "../player/moveConfig";
import { type GameEngine } from "../session/gameEngine";

/**
 * Pont de POSE entre le jeu et Blender, en coordonnées BLENDER — celles qu'on
 * lit dans le `.blend` et dans `tools/blender/cassandre.py` (`C.shot`).
 *
 * glTF est Y-up : Blender (x, y, z) = three (x, −z, y). Le cap suit
 * `render_ingame.py` : 0 = vers +Y Blender, 90 = vers −X — soit exactement le
 * yaw du jeu (yaw 0 = avant −Z three), en degrés.
 */
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

/**
 * Pose le joueur en (x, y) Blender, pieds à `z`, regard au cap donné (garde le
 * cap courant sinon). Même geste que le spawn d'un premier chargement
 * (`session/spawning.ts`) : entre deux images, jamais pendant un pas fixe.
 * Un enregistrement d'input en cours ne rejouera PAS ce saut — outil de dev.
 */
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
