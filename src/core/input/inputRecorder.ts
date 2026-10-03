import type { InputFrame, Recording, RecordingStart } from "./inputTypes";
import { decodeRecording } from "./recordingSchema";

// see: docs/6-reference/notes-code-core.md#rejeu-et-horloge
export function emptyInputFrame(): InputFrame {
  return {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    fire: false,
    switchToMelee: false,
    switchToPistol: false,
    switchToShotgun: false,
    use: false,
    yaw: 0,
    pitch: 0,
    dx: 0,
    dy: 0,
  };
}

class InputRecorder {
  private recording: Recording | null = null;
  private playback: Recording | null = null;
  private playbackIndex = 0;

  startRecording(start: RecordingStart, fixedDt: number) {
    this.recording = { version: 1, fixedDt, start, frames: [] };
  }

  isRecording(): boolean {
    return this.recording !== null;
  }

  record(frame: InputFrame) {
    this.recording?.frames.push({ ...frame });
  }

  stopRecording(): Recording | null {
    const rec = this.recording;
    this.recording = null;
    return rec;
  }

  startPlayback(rec: Recording) {
    this.playback = rec;
    this.playbackIndex = 0;
  }

  isPlaying(): boolean {
    return this.playback !== null;
  }

  nextFrame(): InputFrame | null {
    if (!this.playback) return null;
    if (this.playbackIndex >= this.playback.frames.length) {
      this.playback = null;
      return null;
    }
    return this.playback.frames[this.playbackIndex++]!;
  }

  stopPlayback() {
    this.playback = null;
    this.playbackIndex = 0;
  }
}

export const inputRecorder = new InputRecorder();

export function recordingToJson(rec: Recording): string {
  return JSON.stringify(rec);
}

export function recordingFromJson(json: string): Recording {
  return decodeRecording(JSON.parse(json));
}
