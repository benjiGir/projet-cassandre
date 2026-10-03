export type GameFlowState =
  | "boot"
  | "mainMenu"
  | "options"
  | "levelSelect"
  | "loading"
  | "loadFailed"
  | "intro"
  | "playing"
  | "paused"
  | "dead"
  | "outro"
  | "levelComplete";

export type GameFlowEvent =
  | { type: "ENTER_MENU" }
  | { type: "OPEN_OPTIONS" }
  | { type: "BACK_TO_MENU" }
  | { type: "CHOOSE_ZONE" }
  | { type: "BEGIN_LOAD" }
  | { type: "LOAD_FAILED" }
  | { type: "RETRY_LOAD" }
  | { type: "SHOW_INTRO" }
  | { type: "PLAY" }
  | { type: "DIED" }
  | { type: "SHOW_OUTRO" }
  | { type: "LEVEL_COMPLETED" }
  | { type: "REPLAY" }
  | { type: "RETURN_TO_MENU" }
  | { type: "PAUSE" }
  | { type: "RESUME" };
