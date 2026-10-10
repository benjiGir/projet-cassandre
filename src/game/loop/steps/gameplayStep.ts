import type * as THREE from "three";

import type { InputFrame } from "../../../core/input/inputTypes";
import type { GameEngine } from "../../session/gameEngine";
import type { GameSession } from "../../session/gameSession";

/** Ce que chaque étape du pas fixe reçoit : la partie, le pas de gameplay et l'entrée de ce pas. */
export interface GameplayStep {
  readonly engine: GameEngine;
  readonly session: GameSession;
  /** Durée du pas pour le gameplay, hitstop appliqué. */
  readonly dt: number;
  /** Entrée du pas : capturée en direct, ou lue dans un enregistrement en rejeu. */
  readonly frame: InputFrame;
  /** Origine des tirs : l'œil du joueur, écrit par `fireWeapons` après le déplacement, lu par les ennemis du même pas. */
  readonly eyeOrigin: THREE.Vector3;
}
