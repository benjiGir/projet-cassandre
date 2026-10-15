import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fatalErrorDetail,
  installFatalErrorHandling,
  reportFatalError,
  resetFatalErrorHandling,
} from "../../../src/app/runtime/fatalError";

function evenement(type: string, champs: Record<string, unknown>): Event {
  return Object.assign(new Event(type), champs);
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  resetFatalErrorHandling();
  vi.restoreAllMocks();
});

describe("erreurs fatales", () => {
  it("une exception non rattrapée arrête le jeu", () => {
    const fenetre = new EventTarget();
    const onFatal = vi.fn();
    installFatalErrorHandling(fenetre, onFatal);
    const erreur = new TypeError("position indéfinie");

    fenetre.dispatchEvent(evenement("error", { error: erreur }));

    expect(onFatal).toHaveBeenCalledExactlyOnceWith(erreur);
  });

  it("seule la première erreur compte : une boucle cassée relance la même à chaque image", () => {
    const fenetre = new EventTarget();
    const onFatal = vi.fn();
    installFatalErrorHandling(fenetre, onFatal);

    for (let image = 0; image < 60; image++) {
      fenetre.dispatchEvent(evenement("error", { error: new Error(`image ${image}`) }));
    }
    reportFatalError(new Error("encore une"));

    expect(onFatal).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("un évènement d'erreur sans objet d'erreur (script d'une autre origine) n'arrête rien", () => {
    const fenetre = new EventTarget();
    const onFatal = vi.fn();
    installFatalErrorHandling(fenetre, onFatal);

    fenetre.dispatchEvent(evenement("error", { error: null, message: "Script error." }));

    expect(onFatal).not.toHaveBeenCalled();
  });

  it("une promesse rejetée sans suite est journalisée, sans arrêter le jeu", () => {
    const fenetre = new EventTarget();
    const onFatal = vi.fn();
    installFatalErrorHandling(fenetre, onFatal);
    const raison = new Error("lecture audio refusée");

    fenetre.dispatchEvent(evenement("unhandledrejection", { reason: raison }));

    expect(onFatal).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith("[erreur] promesse rejetée sans suite", raison);
  });

  it("une erreur signalée à sa source arrête le jeu", () => {
    const onFatal = vi.fn();
    installFatalErrorHandling(new EventTarget(), onFatal);
    const erreur = new Error("niveau introuvable");

    reportFatalError(erreur);

    expect(onFatal).toHaveBeenCalledExactlyOnceWith(erreur);
  });
});

describe("fatalErrorDetail", () => {
  it("rend le nom et le message, jamais la pile", () => {
    expect(fatalErrorDetail(new TypeError("position indéfinie"))).toBe("TypeError : position indéfinie");
  });

  it("se contente du nom quand l'erreur n'a pas de message", () => {
    expect(fatalErrorDetail(new RangeError())).toBe("RangeError");
  });

  it("accepte ce qui n'est pas une erreur", () => {
    expect(fatalErrorDetail("moteur perdu")).toBe("moteur perdu");
    expect(fatalErrorDetail(undefined)).toBe("Erreur inconnue");
    expect(fatalErrorDetail({ code: 3 })).toBe("Erreur inconnue");
  });
});
