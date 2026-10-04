// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginLoading, finishLoading, reportLoading, waitForLoadingRetry } from "../../src/core/loading/loadingProgress";
import { input } from "../../src/core/input/input";
import { useGameStore } from "../../src/game/hud/state";
import { MainMenu } from "../../src/ui/screens/mainMenu/MainMenu/MainMenu";
import { OptionsScreen } from "../../src/ui/screens/options/OptionsScreen/OptionsScreen";
import { LoadingScreen } from "../../src/ui/screens/loading/LoadingScreen/LoadingScreen";
import { DeathScreen } from "../../src/ui/screens/death/DeathScreen/DeathScreen";
import { LevelCompleteScreen } from "../../src/ui/screens/levelComplete/LevelCompleteScreen/LevelCompleteScreen";
import { StoryPanels } from "../../src/ui/screens/story/StoryPanels/StoryPanels";
import { StoryScreen } from "../../src/ui/screens/story/StoryScreen/StoryScreen";
import type { StoryPanel } from "../../src/game/hud/hudTypes";
import { DifficultyScreen } from "../../src/ui/screens/difficulty/DifficultyScreen/DifficultyScreen";
import { RecapTable } from "../../src/ui/components/layout/RecapTable/RecapTable";
import { difficultyOptions } from "../../src/game/session/presentation/difficultyOptions";
import { resetRecords, submitRun } from "../../src/game/settings/records";

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
    act(() => useGameStore.getState().setLiveRecap({ peakViewers: 4200, followers: 305, followersGained: 105, donations: 86, donationCount: 7 }));
    render(createElement(LevelCompleteScreen, { onReplay, onReturnToMenu }));
    expect(host.textContent).toContain("VIDÉO DÉMONÉTISÉE");
    expect(host.textContent).toContain("86 € retenus par la plateforme");
    expect(host.textContent).toContain("305 (+105)");
    click("REJOUER");
    expect(onReplay).toHaveBeenCalledTimes(2);
  });

  const panneaux: StoryPanel[] = [
    { id: "a", image: null, alt: "Premier", caption: ["Première légende."] },
    { id: "b", image: null, alt: "Deuxième", caption: ["Deuxième légende."] },
  ];

  it("les panneaux avancent un par un, puis rendent la main au dernier", () => {
    const onDone = vi.fn();
    render(createElement(StoryPanels, { panels: panneaux, doneLabel: "LANCER LE DIRECT", onDone }));
    expect(host.textContent).toContain("Première légende.");
    expect(host.textContent).toContain("PLAN 1 / 2");
    click("SUITE");
    expect(host.textContent).toContain("Deuxième légende.");
    expect(onDone).not.toHaveBeenCalled();
    click("LANCER LE DIRECT");
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("les panneaux se passent au bouton et au clavier, sans double avance sur une touche maintenue", () => {
    const onDone = vi.fn();
    render(createElement(StoryPanels, { panels: panneaux, doneLabel: "LANCER LE DIRECT", onDone }));
    click("PASSER");
    expect(onDone).toHaveBeenCalledOnce();

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", repeat: true })));
    expect(host.textContent).toContain("Première légende.");
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" })));
    expect(host.textContent).toContain("Deuxième légende.");
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape" })));
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it("l'écran d'histoire ne s'affiche que dans son état de flux, avec les panneaux posés dans le store", () => {
    const onDone = vi.fn();
    act(() => useGameStore.getState().setStory(panneaux));
    act(() => useGameStore.getState().setFlowState("playing"));
    render(createElement(StoryScreen, { sequence: "intro", doneLabel: "LANCER LE DIRECT", onDone }));
    expect(host.textContent).toBe("");
    act(() => useGameStore.getState().setFlowState("intro"));
    expect(host.textContent).toContain("Première légende.");
    act(() => useGameStore.getState().setFlowState("outro"));
    expect(host.textContent).toBe("");
  });

  it("l'écran de difficulté propose les trois niveaux, marque le dernier choisi et lance au clic", () => {
    submitRun("niveau_v2", "habitue", 12400, 572);
    const onChoose = vi.fn();
    const onBack = vi.fn();
    render(createElement(DifficultyScreen, { options: difficultyOptions("niveau_v2"), selected: "habitue", onChoose, onBack }));
    resetRecords();

    const choix = [...host.querySelectorAll("button[aria-current]")];
    expect(choix.map((node) => node.getAttribute("aria-current"))).toEqual(["false", "true", "false"]);
    expect(buttonWith("Habitué").textContent).toContain("Record : 12\u202f400 · 9:32");
    expect(buttonWith("Client").textContent).toContain("Aucun record");

    click("Lanceur d'alerte");
    expect(onChoose).toHaveBeenCalledExactlyOnceWith("lanceur");
    click("RETOUR");
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("le récapitulatif affiche la difficulté, et le record seulement quand la partie en pose ou en rappelle un", () => {
    const recap = { lines: [], total: 900, elapsedSeconds: 60, parTimeSeconds: null, accuracy: 0, difficulty: "Client", record: null };
    render(createElement(RecapTable, { recap }));
    expect(host.textContent).toContain("Difficulté : Client");
    expect(host.textContent).not.toContain("ecord");

    render(createElement(RecapTable, { recap: { ...recap, record: { best: 900, isNew: true } } }));
    expect(host.textContent).toContain("NOUVEAU RECORD");

    render(createElement(RecapTable, { recap: { ...recap, record: { best: 4200, isNew: false } } }));
    expect(host.textContent).toContain("Record : 4\u202f200");
  });
});
