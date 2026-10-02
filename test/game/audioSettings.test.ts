/**
 * Réglages audio (`game/audioSettings.ts`) : la règle de gain et le
 * contrat « 100 % = mixage d'origine ». En environnement node, sans
 * `localStorage` : les valeurs d'origine sont celles du module.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  channelGain,
  getAudioFactoryDefaults,
  resetAudioSettings,
  setAudioSettings,
  subtitlesEnabled,
} from "../../src/game/audioSettings";

afterEach(() => {
  resetAudioSettings();
});

describe("réglages audio", () => {
  it("100 % rend le mixage d'origine, 0 % coupe, 50 % vaut −12 dB", () => {
    expect(channelGain(1)).toBe(1);
    expect(channelGain(0)).toBe(0);
    expect(20 * Math.log10(channelGain(0.5))).toBeCloseTo(-12.04, 1);
  });

  it("d'origine : tous les canaux à 100 %, sous-titres affichés, son gardé en arrière-plan", () => {
    expect(getAudioFactoryDefaults()).toEqual({
      general: 1, musique: 1, effets: 1, voix: 1, ambiances: 1, sousTitres: true, muetEnArrierePlan: false,
    });
  });

  it("un changement partiel garde le reste, et les sous-titres se lisent tout de suite", () => {
    const apres = setAudioSettings({ sousTitres: false, voix: 0.4 });
    expect(apres.voix).toBe(0.4);
    expect(apres.effets).toBe(1);
    expect(subtitlesEnabled()).toBe(false);
  });
});
