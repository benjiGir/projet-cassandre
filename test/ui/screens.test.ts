// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginLoading, finishLoading, reportLoading, waitForLoadingRetry } from "../../src/core/loadingProgress";
import { input } from "../../src/core/input";
import { useGameStore } from "../../src/game/state";
import { MainMenu } from "../../src/ui/screens/mainMenu/MainMenu/MainMenu";
import { OptionsScreen } from "../../src/ui/screens/options/OptionsScreen/OptionsScreen";
import { LoadingScreen } from "../../src/ui/screens/loading/LoadingScreen/LoadingScreen";
import { DeathScreen } from "../../src/ui/screens/death/DeathScreen/DeathScreen";
import { LevelCompleteScreen } from "../../src/ui/screens/levelComplete/LevelCompleteScreen/LevelCompleteScreen";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

function render(element: ReturnType<typeof createElement>): void {
  act(() => root.render(element));
}

function buttonWith(text: string): HTMLButtonElement {
  const button = [...host.querySelectorAll("button")].find((node) => node.textContent?.includes(text));
  if (!button) throw new Error(`bouton introuvable : ${text}`);
  return button;
}

function click(text: string): void {
  act(() => buttonWith(text).click());
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  useGameStore.getState().resetGameStore();
  input.resetBindings();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  finishLoading();
  input.resetBindings();
});

describe("écrans React — comportements DOM", () => {
  it("le menu déclenche jouer et paramètres par leurs boutons", () => {
    const onPlay = vi.fn();
    const onOptions = vi.fn();
    render(createElement(MainMenu, { onPlay, onOptions }));
    click("REJOINDRE LE DIRECT");
    click("PARAMÈTRES DU SIGNAL");
    expect(onPlay).toHaveBeenCalledOnce();
    expect(onOptions).toHaveBeenCalledOnce();
  });

  it("les onglets d'options restent navigables au clavier et le retour fonctionne", () => {
    const onBack = vi.fn();
    render(createElement(OptionsScreen, { onBack }));
    const controls = host.querySelector<HTMLButtonElement>('#options-tab-controles')!;
    expect(controls.getAttribute("aria-selected")).toBe("true");
    act(() => controls.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    const display = host.querySelector<HTMLButtonElement>('#options-tab-affichage')!;
    expect(display.getAttribute("aria-selected")).toBe("true");
    expect(display.getAttribute("tabindex")).toBe("0");
    expect(document.activeElement).toBe(display);
    expect(host.querySelector('[role="tabpanel"]')?.getAttribute("aria-labelledby")).toBe("options-tab-affichage");
    click("RETOUR");
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("une touche remappée est annoncée et enregistrée", () => {
    render(createElement(OptionsScreen, { onBack: vi.fn() }));
    const binding = host.querySelector<HTMLButtonElement>('button[aria-label^="Avancer :"]')!;
    act(() => binding.click());
    expect(host.querySelector('button[aria-label^="Avancer :"]')?.getAttribute("aria-pressed")).toBe("true");
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF", bubbles: true })));
    expect(input.getBinding("moveForward")).toBe("KeyF");
    expect(host.querySelector('button[aria-label="Avancer : F"]')).not.toBeNull();
  });

  it("la progression est lisible et l'échec propose un retry explicite", async () => {
    beginLoading("Chargement du niveau", 0.2);
    render(createElement(LoadingScreen));
    act(() => reportLoading("Décor", 0.45));
    const progress = host.querySelector('[role="progressbar"]')!;
    expect(progress.getAttribute("aria-valuenow")).toBe("45");
    expect(progress.getAttribute("aria-valuetext")).toContain("Décor");
    let retry!: Promise<void>;
    act(() => { retry = waitForLoadingRetry(new Error("Niveau illisible")); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Niveau illisible");
    click("RÉESSAYER");
    await retry;
  });

  it("mort et fin de niveau exposent les actions de reprise sans changer la boucle", () => {
    const onReplay = vi.fn();
    const onReturnToMenu = vi.fn();
    act(() => useGameStore.getState().setFlowState("dead"));
    render(createElement(DeathScreen, { onReplay, onReturnToMenu }));
    click("RECONNECTER");
    click("RETOUR AU MENU");
    expect(onReplay).toHaveBeenCalledOnce();
    expect(onReturnToMenu).toHaveBeenCalledOnce();

    act(() => useGameStore.getState().setFlowState("levelComplete"));
    render(createElement(LevelCompleteScreen, { onReplay, onReturnToMenu }));
    click("REJOUER");
    expect(onReplay).toHaveBeenCalledTimes(2);
  });
});
