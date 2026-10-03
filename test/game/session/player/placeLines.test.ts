import { describe, expect, it } from "vitest";

import {
  createPlaceLineState,
  nextPlaceLine,
  PLACE_LINE_DWELL_SECONDS,
} from "../../../../src/game/session/player/placeLines";
import { PLACE_LINES, type HeroLineId } from "../../../../src/game/session/presentation/heroLines";

const DT = 1 / 60;
const aucune: ReadonlySet<HeroLineId> = new Set();
const lignes = new Map<string, HeroLineId>([...Object.entries(PLACE_LINES), ["trig_lieu_surgeles", "surgeles"]]);

function attendre(state: ReturnType<typeof createPlaceLineState>, space: string | null, secondes: number,
  said = aucune, engaged = false): HeroLineId | null {
  let line: HeroLineId | null = null;
  for (let t = 0; t < secondes; t += DT) line = nextPlaceLine(state, space, DT, said, engaged, lignes);
  return line;
}

describe("nextPlaceLine", () => {
  it("attend le temps d'observation avant de proposer la réplique", () => {
    const state = createPlaceLineState();
    expect(attendre(state, "galerie", PLACE_LINE_DWELL_SECONDS - 0.2)).toBeNull();
    expect(attendre(state, "galerie", 0.4)).toBe("galerie");
  });

  it("repropose la réplique tant qu'elle n'a pas été dite", () => {
    const state = createPlaceLineState();
    attendre(state, "galerie", PLACE_LINE_DWELL_SECONDS + 0.1);
    expect(nextPlaceLine(state, "galerie", DT, aucune, false, lignes)).toBe("galerie");
    expect(nextPlaceLine(state, "galerie", DT, aucune, false, lignes)).toBe("galerie");
  });

  it("ne propose plus une réplique déjà dite", () => {
    const state = createPlaceLineState();
    expect(attendre(state, "galerie", 3, new Set<HeroLineId>(["galerie"]))).toBeNull();
  });

  it("repart de zéro en changeant d'espace", () => {
    const state = createPlaceLineState();
    attendre(state, "galerie", PLACE_LINE_DWELL_SECONDS - 0.2);
    expect(attendre(state, "caisses", 0.4)).toBeNull();
    expect(attendre(state, "caisses", PLACE_LINE_DWELL_SECONDS)).toBe("caisses");
  });

  it("abandonne la réplique pour cette visite si un combat éclate", () => {
    const state = createPlaceLineState();
    attendre(state, "caisses", 0.5, aucune, true);
    expect(attendre(state, "caisses", 3)).toBeNull();
  });

  it("la propose de nouveau à la visite suivante", () => {
    const state = createPlaceLineState();
    attendre(state, "caisses", 0.5, aucune, true);
    attendre(state, "hub", 0.1);
    expect(attendre(state, "caisses", PLACE_LINE_DWELL_SECONDS + 0.1)).toBe("caisses");
  });

  it("une sous-zone posée par un trig_* suit les mêmes règles qu'un espace", () => {
    const state = createPlaceLineState();
    expect(attendre(state, "trig_lieu_surgeles", PLACE_LINE_DWELL_SECONDS + 0.1)).toBe("surgeles");
  });

  it("ne dit rien dans un espace sans réplique ni hors de tout espace", () => {
    const state = createPlaceLineState();
    expect(attendre(state, "secret1", 3)).toBeNull();
    expect(attendre(state, null, 3)).toBeNull();
  });
});
