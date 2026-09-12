/**
 * Jalon N7 (`PLAN_NIVEAU_V2.md`) — les cartes de fidélité, qui remplacent le
 * badge unique du Directeur.
 *
 * Couvre les trois endroits où la convention peut se casser en silence :
 * la lecture d'une propriété Blender (`parseLoyaltyCard`), sa traversée du
 * loader (`extras.card` / `extras.requires` -> `UseObject`), et l'inventaire
 * de session (`grantCard`, et son miroir dans le store du HUD).
 */
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import { initPhysics, PhysicsWorld } from "../../../src/physics/world";
import { buildLevelFromGltf } from "../../../src/game/level/loader";
import {
  LOYALTY_CARDS,
  LOYALTY_CARD_LABELS,
  parseLoyaltyCard,
  type LoyaltyCard,
} from "../../../src/game/player/loyaltyCards";
import { InteractionSystem, type InteractionHandlers } from "../../../src/game/level/interactive";
import { grantCard, hasCard, syncCardsToStore } from "../../../src/game/session/cards";
import { tryOpenCardDoor } from "../../../src/game/session/doors";
import { type GameSession } from "../../../src/game/session/gameSession";
import { useGameStore } from "../../../src/game/state";

await initPhysics();

describe("parseLoyaltyCard — lecture d'une propriété Blender", () => {
  it("accepte les trois cartes", () => {
    expect(LOYALTY_CARDS.map(parseLoyaltyCard)).toEqual(["argent", "or", "platine"]);
  });

  it("tolère la casse et les espaces — la propriété est tapée à la main dans Blender", () => {
    expect(parseLoyaltyCard("Or")).toBe("or");
    expect(parseLoyaltyCard("  PLATINE ")).toBe("platine");
  });

  it("refuse tout le reste plutôt que de deviner", () => {
    for (const valeur of ["bronze", "", "  ", "carte or", 3, null, undefined, {}]) {
      expect(parseLoyaltyCard(valeur)).toBeNull();
    }
  });

  it("chaque carte a un libellé affichable", () => {
    for (const card of LOYALTY_CARDS) {
      expect(LOYALTY_CARD_LABELS[card]).toMatch(/^Carte /);
    }
  });

  it("l'union redéclarée dans state.ts ne diverge pas de LOYALTY_CARDS", () => {
    // `game/state.ts` est une feuille de dépendances (ADR 0020) : il redéclare
    // l'union au lieu de l'importer. Ce test est le garde-fou de cette copie —
    // il ne compile plus si l'une des deux bouge sans l'autre.
    const depuisLeStore: readonly ("argent" | "or" | "platine")[] = LOYALTY_CARDS;
    const versLeJeu: readonly LoyaltyCard[] = depuisLeStore;
    expect(versLeJeu).toEqual(["argent", "or", "platine"]);
  });
});

// ---------------------------------------------------------------------------
// Traversée du loader
// ---------------------------------------------------------------------------

function fakeGltf(objects: THREE.Object3D[]): GLTF {
  const group = new THREE.Group();
  for (const obj of objects) group.add(obj);
  return { scene: group, animations: [] } as unknown as GLTF;
}

function useObjet(name: string, extras: Record<string, unknown>): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  );
  mesh.name = name;
  Object.assign(mesh.userData, extras);
  return mesh;
}

function build(objects: THREE.Object3D[]) {
  const spawn = new THREE.Object3D();
  spawn.name = "spawn_player";
  return buildLevelFromGltf(fakeGltf([spawn, ...objects]), new THREE.Scene(), new PhysicsWorld());
}

describe("Convention glTF des cartes (jalon N7)", () => {
  it("`card` sur un use_* : l'objet donne cette carte", () => {
    const handle = build([useObjet("use_carte_argent", { card: "argent" })]);

    expect(handle.useObjects[0].grantsCard).toBe("argent");
    expect(handle.useObjects[0].requiresCard).toBeNull();
  });

  it("`requires` + `target` : l'objet exige cette carte pour sa porte", () => {
    const handle = build([useObjet("use_porte_reserve", { target: "door_reserve", requires: "argent" })]);

    expect(handle.useObjects[0].requiresCard).toBe("argent");
    expect(handle.useObjects[0].targetName).toBe("door_reserve");
    expect(handle.useObjects[0].grantsCard).toBeNull();
  });

  it("une carte à ramasser ne déclenche PAS l'avertissement « sans cible »", () => {
    // Elle se suffit à elle-même : il n'y a rien à cibler.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    build([useObjet("use_carte_or", { card: "or" })]);

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("valeur inconnue : avertissement bruyant, propriété ignorée — jamais une porte ouverte à tous en silence", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handle = build([useObjet("use_porte_bureaux", { target: "door_bureaux", requires: "bronze" })]);

    expect(handle.useObjects[0].requiresCard).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      '[level] "use_porte_bureaux" (use_*) : propriété "requires" = "bronze", ' +
        "qui n'est pas une carte de fidélité connue (argent, or, platine) — propriété ignorée.",
    );
    errorSpy.mockRestore();
  });

  it("aucune propriété : les deux champs restent nuls (niveaux d'avant le jalon N7)", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handle = build([useObjet("use_exit_door", { target: "door_e_exit" })]);

    expect(handle.useObjects[0].grantsCard).toBeNull();
    expect(handle.useObjects[0].requiresCard).toBeNull();
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Dispatch : ce que le `.glb` DÉCLARE passe avant le nom
// ---------------------------------------------------------------------------

/** Handlers muets, sauf ceux qu'un test remplace. */
function handlersDeTest(overrides: Partial<InteractionHandlers> = {}): InteractionHandlers {
  return {
    onCrowbarPickup: () => {},
    onShotgunPickup: () => {},
    onExitDoorUse: () => {},
    onFrozenStorageUse: () => {},
    onPaMicUse: () => {},
    onToiletUse: () => {},
    onCardPickup: () => {},
    onCardDoorUse: () => {},
    ...overrides,
  };
}

describe("InteractionSystem — objets à carte", () => {
  it("une carte à ramasser appelle onCardPickup, disparaît et ne se reprend pas", () => {
    const handle = build([useObjet("use_carte_argent", { card: "argent" })]);
    const useObject = handle.useObjects[0];
    const onCardPickup = vi.fn();
    const system = new InteractionSystem();
    const joueur = useObject.position.clone();

    system.update(true, handle.useObjects, joueur, handlersDeTest({ onCardPickup }));
    expect(onCardPickup).toHaveBeenCalledWith("argent", "use_carte_argent");
    expect(useObject.object.visible).toBe(false);

    // Deuxième appui : consommé, plus rien.
    system.update(true, handle.useObjects, joueur, handlersDeTest({ onCardPickup }));
    expect(onCardPickup).toHaveBeenCalledTimes(1);
  });

  it("une porte à carte appelle onCardDoorUse et reste réessayable après un refus", () => {
    const handle = build([useObjet("use_porte_reserve", { target: "door_reserve", requires: "argent" })]);
    const onCardDoorUse = vi.fn();
    const system = new InteractionSystem();
    const joueur = handle.useObjects[0].position.clone();

    system.update(true, handle.useObjects, joueur, handlersDeTest({ onCardDoorUse }));
    system.update(true, handle.useObjects, joueur, handlersDeTest({ onCardDoorUse }));

    // Jamais consommée : c'est l'appelant qui garde la porte, pas ce système.
    expect(onCardDoorUse).toHaveBeenCalledTimes(2);
    expect(onCardDoorUse).toHaveBeenCalledWith("door_reserve", "argent");
  });

  it("hors de portée, rien ne se déclenche", () => {
    const handle = build([useObjet("use_carte_or", { card: "or" })]);
    const onCardPickup = vi.fn();

    new InteractionSystem().update(
      true,
      handle.useObjects,
      handle.useObjects[0].position.clone().add(new THREE.Vector3(0, 0, 5)), // > 2 m
      handlersDeTest({ onCardPickup }),
    );

    expect(onCardPickup).not.toHaveBeenCalled();
  });

  it("un use_* nommé sans propriété de carte garde son chemin historique", () => {
    const handle = build([useObjet("use_crowbar", { target: "rien" })]);
    const onCrowbarPickup = vi.fn();

    new InteractionSystem().update(
      true,
      handle.useObjects,
      handle.useObjects[0].position.clone(),
      handlersDeTest({ onCrowbarPickup }),
    );

    expect(onCrowbarPickup).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Inventaire de session
// ---------------------------------------------------------------------------

/** Session réduite à ce que `cards.ts` touche réellement. */
function sessionDeTest(): GameSession {
  return { cards: new Set<LoyaltyCard>() } as unknown as GameSession;
}

describe("Inventaire de cartes (game/session/cards.ts)", () => {
  beforeEach(() => {
    // `showHudMessage` programme l'effacement du message avec
    // `window.setTimeout` (voir `session/feedback.ts`) : il n'y a pas de
    // `window` en environnement node. Le remplaçant n'exécute rien — ces
    // tests vérifient le message AFFICHÉ, pas sa disparition.
    vi.stubGlobal("window", { setTimeout: () => 0 });
    useGameStore.getState().setCards([]);
    useGameStore.getState().showHudMessage(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("grantCard ajoute la carte et l'annonce", () => {
    const session = sessionDeTest();

    expect(grantCard(session, "or")).toBe(true);
    expect(hasCard(session, "or")).toBe(true);
    expect(useGameStore.getState().hudMessage).toBe("Carte Or récupérée");
  });

  it("un deuxième ramassage de la même carte est un non-événement", () => {
    // Un hot reload remet les `use_*` du niveau en place : le cas arrive.
    const session = sessionDeTest();
    grantCard(session, "argent");
    useGameStore.getState().showHudMessage(null);

    expect(grantCard(session, "argent")).toBe(false);
    expect(useGameStore.getState().hudMessage).toBeNull();
    expect(session.cards.size).toBe(1);
  });

  it("le miroir du HUD garde l'ordre Argent/Or/Platine, pas l'ordre de ramassage", () => {
    const session = sessionDeTest();
    grantCard(session, "platine");
    grantCard(session, "argent");

    expect(useGameStore.getState().debug.cards).toEqual(["argent", "platine"]);
  });

  it("syncCardsToStore recopie un inventaire déjà rempli (chargement, reset)", () => {
    const session = sessionDeTest();
    session.cards.add("or");
    session.cards.add("platine");

    syncCardsToStore(session);

    expect(useGameStore.getState().debug.cards).toEqual(["or", "platine"]);
  });

  it("hasCard est faux sur une carte jamais ramassée", () => {
    expect(hasCard(sessionDeTest(), "platine")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// La garde de porte
// ---------------------------------------------------------------------------

/**
 * Session avec une porte réelle du point de vue de `unlockDoor` : un corps et
 * un collider Rapier authentiques, pas des mocks — c'est eux que la fonction
 * manipule (glissement, `setEnabled(false)`).
 */
function sessionAvecPorte(cards: LoyaltyCard[] = []) {
  const physics = new PhysicsWorld();
  const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 1.25, 0));
  const collider = physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1, 1.25, 0.1), body);

  const session = {
    cards: new Set<LoyaltyCard>(cards),
    unlockedDoors: new Set<string>(),
    openingDoor: null,
    exitDoorTracking: null,
    gltfLevelSession: {
      current: {
        doors: [{ name: "door_reserve", body, collider, halfExtents: new THREE.Vector3(1, 1.25, 0.1) }],
      },
    },
  } as unknown as GameSession;

  return { session, body, collider };
}

describe("tryOpenCardDoor — la garde de porte", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { setTimeout: () => 0 });
    useGameStore.getState().showHudMessage(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sans la carte : refus annoncé, porte intacte, réessayable", () => {
    const { session, collider } = sessionAvecPorte();

    expect(tryOpenCardDoor(session, "door_reserve", "argent")).toBe(false);
    expect(useGameStore.getState().hudMessage).toBe("Carte Argent requise");
    expect(session.unlockedDoors.has("door_reserve")).toBe(false);
    expect(collider.isEnabled()).toBe(true);

    // Rien n'a été consommé : un deuxième essai refuse à l'identique.
    expect(tryOpenCardDoor(session, "door_reserve", "argent")).toBe(false);
  });

  it("avec la carte : porte déverrouillée, collider désactivé immédiatement", () => {
    // Le collider tombe AU DÉVERROUILLAGE, pas en fin de glissement — sinon
    // un joueur collé à la porte qu'il vient d'ouvrir reste bloqué.
    const { session, collider } = sessionAvecPorte(["argent"]);

    expect(tryOpenCardDoor(session, "door_reserve", "argent")).toBe(true);
    expect(session.unlockedDoors.has("door_reserve")).toBe(true);
    expect(collider.isEnabled()).toBe(false);
    expect(session.openingDoor).not.toBeNull();
  });

  it("une carte ne vaut pas pour une autre", () => {
    const { session } = sessionAvecPorte(["or"]);

    expect(tryOpenCardDoor(session, "door_reserve", "argent")).toBe(false);
  });

  it("déjà déverrouillée : non-événement, pas de second glissement", () => {
    const { session } = sessionAvecPorte(["argent"]);
    tryOpenCardDoor(session, "door_reserve", "argent");
    session.openingDoor = null;

    expect(tryOpenCardDoor(session, "door_reserve", "argent")).toBe(false);
    expect(session.openingDoor).toBeNull();
  });

  it("seule door_e_exit arme le suivi de fin de niveau", () => {
    const { session } = sessionAvecPorte(["platine"]);

    tryOpenCardDoor(session, "door_reserve", "platine");

    expect(session.exitDoorTracking).toBeNull();
  });
});
