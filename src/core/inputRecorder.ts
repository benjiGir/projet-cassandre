// Enregistrement / rejeu d'input, pas fixe par pas fixe (harnais A/B de
// feel-tuner, preuve de déterminisme).
// see: docs/systems/boucle-de-jeu.md#enregistrement-et-rejeu-dinput

/** État d'input consommé par un pas fixe de gameplay. */
export interface InputFrame {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  /** Front montant déjà consommé (jamais `isDown`) : un appui = un saut. */
  jump: boolean;
  sprint: boolean;
  /**
   * Front montant déjà consommé depuis `Mouse0`, même contrat que `jump` : un
   * clic = un tir. Couvre le cas semi-auto par défaut (pied-de-biche, pompe).
   * Si un tir automatique est un jour voulu, la couche arme reste libre de
   * lire `isDown("Mouse0")` directement au lieu de ce champ — ce n'est pas le
   * rôle d'`InputFrame` de trancher la cadence de tir.
   */
  fire: boolean;
  /** Front montant consommé, même contrat que `jump` : sélection pied-de-biche. */
  switchToMelee: boolean;
  /** Front montant consommé, même contrat que `jump` : sélection pistolet. */
  switchToPistol: boolean;
  /** Front montant consommé, même contrat que `jump` : sélection fusil à pompe. */
  switchToShotgun: boolean;
  /** Front montant déjà consommé, même contrat que `jump` : interaction (`use_*`, `KeyE`). */
  use: boolean;
  /** Orientation de la vue au moment du pas fixe, en radians. */
  yaw: number;
  pitch: number;
  /** Delta souris agrégé depuis le pas fixe précédent, en pixels. Diagnostic. */
  dx: number;
  dy: number;
}

/** État initial du joueur, indispensable pour qu'un rejeu parte du même endroit. */
export interface RecordingStart {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
}

export interface Recording {
  version: 1;
  /** Pas fixe utilisé à l'enregistrement, en secondes. */
  fixedDt: number;
  start: RecordingStart;
  frames: InputFrame[];
}

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

  /** Démarre un enregistrement. `start` est l'état du joueur à cet instant. */
  startRecording(start: RecordingStart, fixedDt: number) {
    this.recording = { version: 1, fixedDt, start, frames: [] };
  }

  isRecording(): boolean {
    return this.recording !== null;
  }

  /** À appeler une fois par pas fixe, avec l'input effectivement consommé. */
  record(frame: InputFrame) {
    this.recording?.frames.push({ ...frame });
  }

  stopRecording(): Recording | null {
    const rec = this.recording;
    this.recording = null;
    return rec;
  }

  /** Rejoue une séquence. L'appelant doit replacer le joueur sur `rec.start`. */
  startPlayback(rec: Recording) {
    this.playback = rec;
    this.playbackIndex = 0;
  }

  isPlaying(): boolean {
    return this.playback !== null;
  }

  /**
   * Input du pas fixe courant pendant un rejeu. Retourne `null` quand la
   * séquence est épuisée (le rejeu s'arrête alors de lui-même).
   */
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
  const rec = JSON.parse(json) as Recording;
  if (rec.version !== 1) throw new Error(`Recording version non supportée : ${rec.version}`);
  return rec;
}
