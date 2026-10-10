import type { LevelTexts } from "../../level/catalog/levels";
import { METRO_STREAM_TEXTS } from "./metroStreamTexts";
import { STORE_STREAM_TEXTS, type StreamTexts } from "./streamTexts";

const STREAM_TEXTS: Readonly<Record<LevelTexts, StreamTexts>> = {
  magasin: STORE_STREAM_TEXTS,
  metro: METRO_STREAM_TEXTS,
};

/** Ce que le direct écrit dans un niveau, d'après son `LevelDef.textes` ; sans indication, les textes du magasin. */
export function levelStreamTexts(texts: LevelTexts = "magasin"): StreamTexts {
  return STREAM_TEXTS[texts];
}
