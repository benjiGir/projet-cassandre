export type GameFlowState =
  | "boot"
  | "mainMenu"
  | "options"
  | "levelSelect"
  | "loading"
  | "loadFailed"
  | "playing"
  | "paused"
  | "dead"
  | "levelComplete";

export type GameFlowEvent =
  | { type: "ENTER_MENU" }
  | { type: "OPEN_OPTIONS" }
  | { type: "BACK_TO_MENU" }
  | { type: "CHOOSE_ZONE" }
  | { type: "BEGIN_LOAD" }
  | { type: "LOAD_FAILED" }
  | { type: "RETRY_LOAD" }
  | { type: "PLAY" }
  | { type: "DIED" }
  | { type: "LEVEL_COMPLETED" }
  | { type: "REPLAY" }
  | { type: "RETURN_TO_MENU" }
  | { type: "PAUSE" }
  | { type: "RESUME" };
