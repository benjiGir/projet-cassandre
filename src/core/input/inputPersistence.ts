import { Result, Schema } from "effect";

import { persisted } from "../storage/persisted";
import { ALL_ACTIONS, DEFAULT_BINDINGS } from "./inputBindings";
import type { GameAction } from "./inputTypes";

const decodeStoredBindings = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown));
const decodeBindingCode = Schema.decodeUnknownResult(Schema.NonEmptyString);

/** Une touche illisible garde sa valeur d'origine, sans faire perdre les autres. */
function decodeBindings(stored: unknown): Record<GameAction, string> {
  const parsed = decodeStoredBindings(stored);
  const bindings = { ...DEFAULT_BINDINGS };
  for (const action of ALL_ACTIONS) {
    const code = decodeBindingCode(parsed[action]);
    if (Result.isSuccess(code)) bindings[action] = code.success;
  }
  return bindings;
}

const storedBindings = persisted("cassandre.keybinds", decodeBindings, () => ({ ...DEFAULT_BINDINGS }));

// see: docs/6-reference/notes-code-core.md#entrées
export function loadStoredBindings(): Record<GameAction, string> {
  return storedBindings.load();
}

export function saveStoredBindings(bindings: Record<GameAction, string>) {
  storedBindings.save(bindings);
}
