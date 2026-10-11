import { input } from "../../../core/input/input";
import { emptyInputFrame, inputRecorder } from "../../../core/input/inputRecorder";
import type { InputFrame } from "../../../core/input/inputTypes";
import type { GameEngine } from "../../session/gameEngine";

const liveFrame = emptyInputFrame();

function captureInputFrame(engine: GameEngine): InputFrame {
  liveFrame.forward = input.isActionDown("moveForward");
  liveFrame.back = input.isActionDown("moveBack");
  liveFrame.left = input.isActionDown("moveLeft");
  liveFrame.right = input.isActionDown("moveRight");
  liveFrame.sprint = input.isActionDown("sprint");
  liveFrame.jump = input.consumeActionJustPressed("jump");
  liveFrame.fire = input.consumeActionJustPressed("fire");
  liveFrame.switchToMelee = input.consumeActionJustPressed("switchMelee");
  liveFrame.switchToPistol = input.consumeActionJustPressed("switchPistol");
  liveFrame.switchToShotgun = input.consumeActionJustPressed("switchShotgun");
  liveFrame.switchToFlare = input.consumeActionJustPressed("switchFlare");
  liveFrame.use = input.consumeActionJustPressed("use");
  liveFrame.yaw = engine.look.yaw;
  liveFrame.pitch = engine.look.pitch;
  liveFrame.dx = engine.lookDelta.dx;
  liveFrame.dy = engine.lookDelta.dy;
  engine.lookDelta.dx = 0;
  engine.lookDelta.dy = 0;
  return liveFrame;
}

/** L'entrée du pas fixe : la frame d'un enregistrement en rejeu, sinon la capture en direct — jamais les deux. */
export function readInputFrame(engine: GameEngine): InputFrame {
  let frame: InputFrame | null;
  if (inputRecorder.isPlaying()) {
    frame = inputRecorder.nextFrame();
    if (frame) {
      engine.look.yaw = frame.yaw;
      engine.look.pitch = frame.pitch;
    }
  } else {
    frame = captureInputFrame(engine);
    if (inputRecorder.isRecording()) inputRecorder.record(frame);
  }
  return frame ?? emptyInputFrame();
}
