import { Result, Schema } from "effect";

import { ALL_ACTIONS, DEFAULT_BINDINGS } from "./inputBindings";
import type { GameAction } from "./inputTypes";

const decodeStoredBindings = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown));
const decodeBindingCode = Schema.decodeUnknownResult(Schema.NonEmptyString);

const BINDINGS_STORAGE_KEY = "cassandre.keybinds";

// see: docs/6-reference/notes-code-core.md#entrées
export function loadStoredBindings(): Record<GameAction, string> {
  const bindings = { ...DEFAULT_BINDINGS };
  if (typeof localStorage === "undefined") return bindings;
  try {
    const raw = localStorage.getItem(BINDINGS_STORAGE_KEY);
    if (!raw) return bindings;
    const parsed = decodeStoredBindings(JSON.parse(raw));
    for (const action of ALL_ACTIONS) {
      const code = decodeBindingCode(parsed[action]);
      if (Result.isSuccess(code)) bindings[action] = code.success;
    }
  } catch {}
  return bindings;
}

export function saveStoredBindings(bindings: Record<GameAction, string>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
  } catch {}
}
