/**
 * Contrat Blender des trains : ce que `readTrainLevel` tire d'un export glTF,
 * et chaque refus. Un niveau mal marqué échoue au chargement avec un message
 * qui nomme l'objet — jamais une voie qui tue sans signal ni refuge.
 */
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { NavGraph } from "../../../../src/game/level/navigation/pathfindingTypes";
import { TRAIN_CAR_LENGTH, TRAIN_HEIGHT, TRAIN_WIDTH } from "../../../../src/game/level/trains/trainConfig";
import { readTrainLevel, TrainLevelError, type TrainBox } from "../../../../src/game/level/trains/trainLevelData";
import { excludeTrainRails } from "../../../../src/game/level/trains/trainNavigation";

type Extras = Record<string, unknown>;

function repere(name: string, position: [number, number, number], extras: Extras = {}): THREE.Object3D {
  const node = new THREE.Object3D();
  node.name = name;
  node.position.set(...position);
  Object.assign(node.userData, extras);
  return node;
}

function volume(name: string, position: [number, number, number], extras: Extras = {}): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4));
  mesh.name = name;
  mesh.position.set(...position);
  Object.assign(mesh.userData, extras);
  return mesh;
}

/** Une voiture au gabarit, sol à Y=0, centrée en X/Z. */
function voiture(size: [number, number, number] = [TRAIN_WIDTH, TRAIN_HEIGHT, TRAIN_CAR_LENGTH]): THREE.Object3D {
  const model = repere("train_modele_voiture", [40, 0, 0]);
  const caisse = new THREE.Mesh(new THREE.BoxGeometry(...size).translate(0, size[1] / 2, 0));
  caisse.name = "caisse";
  model.add(caisse);
  model.updateMatrixWorld(true);
  return model;
}

const VOIE_A = { voie: "A", trajet: "a_direct", points: "rail_a_0,rail_a_1", debut_visible: 10, fin_visible: 90 };

/** Le plus petit niveau valide : une voie, un trajet, un signal, une zone de navigation, un refuge, un modèle. */
function niveau(): Map<string, THREE.Object3D> {
  const nodes = [
    repere("rail_a_0", [0, 0, 0]),
    repere("rail_a_1", [0, 0, 100]),
    repere("voie_a_direct", [0, 0, 0], VOIE_A),
    repere("signal_train_a", [2, 2, 50], { voie: "A" }),
    volume("nav_voie_a", [0, 0, 50], { voie: "A" }),
    volume("refuge_train_a", [4, 0, 50], { voie: "A" }),
    voiture(),
  ];
  return new Map(nodes.map((node) => [node.name, node]));
}

function lire(nodes: Map<string, THREE.Object3D>) {
  return readTrainLevel([...nodes.values()]);
}

/** Lit le niveau de base après l'avoir abîmé, et rend le message du refus. */
function refus(abimer: (nodes: Map<string, THREE.Object3D>) => void): string {
  const nodes = niveau();
  abimer(nodes);
  let error: unknown = null;
  try {
    lire(nodes);
  } catch (cause) {
    error = cause;
  }
  expect(error).toBeInstanceOf(TrainLevelError);
  return (error as TrainLevelError).message;
}

describe("readTrainLevel — niveau valide", () => {
  it("un niveau sans aucun marqueur de train n'a pas de trains", () => {
    expect(readTrainLevel([repere("spawn_player", [0, 0, 0]), volume("gondole", [3, 0, 0])])).toBeNull();
  });

  it("lit la voie, son trajet et sa portion visible", () => {
    const data = lire(niveau())!;

    expect(data.lanes).toHaveLength(1);
    expect(data.lanes[0]).toMatchObject({ id: "A", firstArrival: 10, enabled: true });
    const [route] = data.lanes[0].routes;
    expect(route).toMatchObject({ id: "a_direct", visibleStart: 10, visibleEnd: 90, visualPadding: 0 });
    expect(route.points.map((point) => point.toArray())).toEqual([
      [0, 0, 0],
      [0, 0, 100],
    ]);
    expect(data.visibleRoutes).toEqual([{ lane: "A", route, start: 10, end: 90 }]);
  });

  it("lit l'horaire et la marge visuelle écrits dans Blender", () => {
    const nodes = niveau();
    Object.assign(nodes.get("voie_a_direct")!.userData, { premier: 25, active: false, marge_visuelle: 6 });

    const data = lire(nodes)!;

    expect(data.lanes[0]).toMatchObject({ firstArrival: 25, enabled: false });
    expect(data.lanes[0].routes[0].visualPadding).toBe(6);
  });

  it("les points d'un trajet sont lus en coordonnées monde, parent compris", () => {
    const nodes = niveau();
    const parent = new THREE.Group();
    parent.position.set(10, -4, 0);
    parent.add(nodes.get("rail_a_1")!);

    const data = lire(nodes)!;

    expect(data.lanes[0].routes[0].points[1].toArray()).toEqual([10, -4, 100]);
  });

  it("regroupe sous une même voie ses trajets, dans l'ordre de lecture", () => {
    const nodes = niveau();
    nodes.set("rail_a_2", repere("rail_a_2", [30, 0, 100]));
    nodes.set(
      "voie_a_devie",
      repere("voie_a_devie", [0, 0, 0], { ...VOIE_A, trajet: "a_devie", points: "rail_a_0, rail_a_2" }),
    );

    const data = lire(nodes)!;

    expect(data.lanes).toHaveLength(1);
    expect(data.lanes[0].routes.map((route) => route.id)).toEqual(["a_direct", "a_devie"]);
    expect(data.visibleRoutes).toHaveLength(2);
  });

  it("lit le signal : position monde, cap en radians, écran par défaut", () => {
    const nodes = niveau();
    nodes.set("signal_train_a_feu", repere("signal_train_a_feu", [-2, 2, 20], { voie: "A", cap: 90, aspect: "feu" }));

    const data = lire(nodes)!;

    expect(data.signals).toHaveLength(2);
    expect(data.signals[0]).toMatchObject({ lane: "A", yaw: 0, appearance: "ecran" });
    expect(data.signals[0].position.toArray()).toEqual([2, 2, 50]);
    expect(data.signals[1]).toMatchObject({ lane: "A", appearance: "feu" });
    expect(data.signals[1].yaw).toBeCloseTo(Math.PI / 2);
  });

  it("cache les volumes de voie et rend leur boîte monde", () => {
    const nodes = niveau();
    nodes.set("traversee_train_a", volume("traversee_train_a", [0, 0, 80], { voie: "A" }));

    const data = lire(nodes)!;

    expect(nodes.get("nav_voie_a")!.visible).toBe(false);
    expect(nodes.get("refuge_train_a")!.visible).toBe(false);
    expect(nodes.get("traversee_train_a")!.visible).toBe(false);
    expect(data.navigationZones).toHaveLength(1);
    expect(data.crossings).toHaveLength(1);
    expect(data.refuges[0].lane).toBe("A");
    expect(data.refuges[0].box.min.toArray()).toEqual([2, -1.5, 48]);
    expect(data.refuges[0].box.max.toArray()).toEqual([6, 1.5, 52]);
  });

  it("un `use_*` qui porte `train` devient une commande ; un `use_*` ordinaire est ignoré", () => {
    const nodes = niveau();
    nodes.set("rail_a_2", repere("rail_a_2", [30, 0, 100]));
    nodes.set(
      "voie_a_devie",
      repere("voie_a_devie", [0, 0, 0], { ...VOIE_A, trajet: "a_devie", points: "rail_a_0,rail_a_2" }),
    );
    nodes.set("use_arret", repere("use_arret", [5, 1, 10], { voie: "A", train: "stop" }));
    nodes.set("use_aiguille", repere("use_aiguille", [5, 1, 12], { voie: "A", train: "switch", trajet: "a_devie" }));
    nodes.set("use_bascule", repere("use_bascule", [5, 1, 14], { voie: "A", train: "switch" }));
    nodes.set("use_trousse", repere("use_trousse", [5, 1, 16], { soin: 25 }));

    const data = lire(nodes)!;

    expect([...data.commands]).toEqual([
      ["use_arret", { type: "stop", lane: "A" }],
      ["use_aiguille", { type: "switch", lane: "A", route: "a_devie" }],
      ["use_bascule", { type: "switch", lane: "A", route: undefined }],
    ]);
  });

  it("rend le modèle de voiture tel quel", () => {
    const nodes = niveau();

    expect(lire(nodes)!.model).toBe(nodes.get("train_modele_voiture"));
  });

  it("le nom Blender prime sur le nom dédoublonné par le chargeur glTF", () => {
    const nodes = niveau();
    const rail = nodes.get("rail_a_1")!;
    rail.name = "rail_a_1_1";
    rail.userData.name = "rail_a_1";

    expect(lire(nodes)!.lanes[0].routes[0].points[1].z).toBe(100);
  });
});

describe("readTrainLevel — refus du tracé", () => {
  it("des marqueurs de train sans aucune voie", () => {
    const orphelins = [repere("rail_a_0", [0, 0, 0]), voiture()];

    expect(() => readTrainLevel(orphelins)).toThrow("Marqueurs de trains sans voie déclarée.");
    expect(() => readTrainLevel([repere("use_arret", [0, 0, 0], { voie: "A", train: "stop" })])).toThrow(
      "Marqueurs de trains sans voie déclarée.",
    );
  });

  it("une voie aux métadonnées incomplètes est nommée dans le message", () => {
    const message = refus((nodes) => delete nodes.get("voie_a_direct")!.userData.trajet);

    expect(message).toMatch(/^voie_a_direct : /);
    expect(message).toContain("trajet");
  });

  it("un trajet d'un seul point, ou qui repasse par le même point", () => {
    expect(refus((nodes) => (nodes.get("voie_a_direct")!.userData.points = "rail_a_0"))).toBe(
      "voie_a_direct : points incomplets ou répétés.",
    );
    expect(refus((nodes) => (nodes.get("voie_a_direct")!.userData.points = "rail_a_0,rail_a_1,rail_a_0"))).toBe(
      "voie_a_direct : points incomplets ou répétés.",
    );
  });

  it("un point absent du niveau, ou qui n'est pas un `rail_*`", () => {
    expect(refus((nodes) => nodes.delete("rail_a_1"))).toBe("Point de voie absent : rail_a_1");
    expect(refus((nodes) => (nodes.get("voie_a_direct")!.userData.points = "rail_a_0,signal_train_a"))).toBe(
      "Point de voie absent : signal_train_a",
    );
  });

  it("un point à la position non finie", () => {
    expect(refus((nodes) => (nodes.get("rail_a_1")!.position.x = Number.NaN))).toBe(
      "Point de voie non fini : rail_a_1",
    );
  });

  it("un segment vertical ou de longueur nulle", () => {
    expect(refus((nodes) => nodes.get("rail_a_1")!.position.set(0, 8, 0))).toBe("Segment vertical ou nul : a_direct");
    expect(refus((nodes) => nodes.get("rail_a_1")!.position.set(0, 0, 0.005))).toBe(
      "Segment vertical ou nul : a_direct",
    );
  });

  it("une pente de plus de 60 %", () => {
    expect(refus((nodes) => nodes.get("rail_a_1")!.position.set(0, 61, 100))).toBe(
      "Pente de voie excessive : a_direct",
    );
    // Juste sous la limite, la voie est acceptée.
    const douce = niveau();
    douce.get("rail_a_1")!.position.set(0, 59, 100);
    douce.get("voie_a_direct")!.userData.fin_visible = 90;
    expect(lire(douce)).not.toBeNull();
  });

  it("une portion visible vide, inversée ou plus longue que le trajet", () => {
    const visible = (debut: number, fin: number) =>
      refus((nodes) => Object.assign(nodes.get("voie_a_direct")!.userData, { debut_visible: debut, fin_visible: fin }));

    expect(visible(40, 40)).toBe("Intervalle visible invalide : a_direct");
    expect(visible(60, 20)).toBe("Intervalle visible invalide : a_direct");
    expect(visible(10, 100.5)).toBe("Intervalle visible invalide : a_direct");
  });

  it("deux fois le même trajet sur une voie", () => {
    expect(refus((nodes) => nodes.set("voie_a_bis", repere("voie_a_bis", [0, 0, 0], VOIE_A)))).toBe(
      "Trajet de voie répété : A/a_direct",
    );
  });

  it("deux trajets d'une même voie qui ne s'accordent pas sur l'horaire", () => {
    const second = (extras: Extras) =>
      refus((nodes) =>
        nodes.set("voie_a_devie", repere("voie_a_devie", [0, 0, 0], { ...VOIE_A, trajet: "a_devie", ...extras })),
      );

    expect(second({ premier: 30 })).toBe("Horaire incohérent entre les trajets : A");
    expect(second({ active: false })).toBe("Horaire incohérent entre les trajets : A");
  });
});

describe("readTrainLevel — refus de la sécurité et des commandes", () => {
  it("un signal, un volume ou une commande qui vise une voie inconnue", () => {
    expect(refus((nodes) => (nodes.get("signal_train_a")!.userData.voie = "Z"))).toBe("Voie inconnue : Z");
    expect(refus((nodes) => (nodes.get("refuge_train_a")!.userData.voie = "Z"))).toBe("Voie inconnue : Z");
    expect(refus((nodes) => nodes.set("use_arret", repere("use_arret", [0, 0, 0], { voie: "Z", train: "stop" })))).toBe(
      "Voie inconnue : Z",
    );
  });

  it("un aiguillage vers un trajet que la voie n'a pas", () => {
    expect(
      refus((nodes) =>
        nodes.set("use_aiguille", repere("use_aiguille", [0, 0, 0], { voie: "A", train: "switch", trajet: "fantome" })),
      ),
    ).toBe("Aiguillage vers un trajet absent : use_aiguille");
  });

  it("un volume de voie qui n'est pas un mesh", () => {
    expect(refus((nodes) => nodes.set("refuge_train_a", repere("refuge_train_a", [4, 0, 50], { voie: "A" })))).toBe(
      "Volume de voie sans mesh : refuge_train_a",
    );
  });

  it("une voie sans signal, sans zone de navigation ou sans refuge", () => {
    expect(refus((nodes) => nodes.delete("signal_train_a"))).toBe("Aucun signal pour la voie A");
    expect(refus((nodes) => nodes.delete("nav_voie_a"))).toBe("Navigation non exclue pour la voie A");
    expect(refus((nodes) => nodes.delete("refuge_train_a"))).toBe("Aucun refuge pour la voie A");
  });
});

describe("readTrainLevel — refus du modèle de voiture", () => {
  const UN_SEUL = "Le niveau doit fournir un seul modèle de voiture de ligne.";
  const GABARIT = "Gabarit du modèle incompatible : voiture de 15 × 2,8 × 3,2 m centrée en X/Z, sol à Y=0.";

  it("aucun modèle, ou deux", () => {
    expect(refus((nodes) => nodes.delete("train_modele_voiture"))).toBe(UN_SEUL);
    expect(
      refus((nodes) => {
        const second = voiture();
        second.name = "train_modele_bis";
        nodes.set(second.name, second);
      }),
    ).toBe(UN_SEUL);
  });

  it("un collider statique rangé dans le modèle", () => {
    expect(
      refus((nodes) => {
        const collider = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
        collider.name = "col_caisse";
        nodes.get("train_modele_voiture")!.add(collider);
      }),
    ).toBe("Collider statique dans le modèle de rame.");
  });

  it("un modèle sans aucun mesh", () => {
    expect(refus((nodes) => nodes.set("train_modele_voiture", repere("train_modele_voiture", [0, 0, 0])))).toBe(
      GABARIT,
    );
  });

  it("une voiture trop large, trop haute ou trop longue", () => {
    const taille = (size: [number, number, number]) =>
      refus((nodes) => nodes.set("train_modele_voiture", voiture(size)));

    expect(taille([TRAIN_WIDTH + 0.6, TRAIN_HEIGHT, TRAIN_CAR_LENGTH])).toBe(GABARIT);
    expect(taille([TRAIN_WIDTH, TRAIN_HEIGHT + 0.7, TRAIN_CAR_LENGTH])).toBe(GABARIT);
    expect(taille([TRAIN_WIDTH, TRAIN_HEIGHT, TRAIN_CAR_LENGTH - 1])).toBe(GABARIT);
  });

  it("une voiture décentrée ou qui ne repose pas sur Y=0", () => {
    const decaler = (x: number, y: number, z: number) =>
      refus((nodes) => {
        const model = nodes.get("train_modele_voiture")!;
        model.children[0].position.set(x, y, z);
        model.updateMatrixWorld(true);
      });

    expect(decaler(0.5, 0, 0)).toBe(GABARIT);
    expect(decaler(0, 0, 0.5)).toBe(GABARIT);
    expect(decaler(0, 0.5, 0)).toBe(GABARIT);
  });

  it("le gabarit se mesure dans le repère du modèle : sa place dans le niveau ne compte pas", () => {
    const nodes = niveau();
    const model = nodes.get("train_modele_voiture")!;
    model.position.set(-300, 12, 80);
    model.rotation.y = Math.PI / 3;
    model.updateMatrixWorld(true);

    expect(lire(nodes)).not.toBeNull();
  });
});

describe("excludeTrainRails — les ennemis ne marchent pas sur les voies", () => {
  /** Grille 5 × 5 entièrement praticable, cellules de 1 m, tous voisins reliés. */
  function grille(): NavGraph {
    const cols = 5;
    const rows = 5;
    return {
      cellSize: 1,
      cols,
      rows,
      originX: 0,
      originZ: 0,
      groundY: new Float32Array(cols * rows),
      walkable: new Uint8Array(cols * rows).fill(1),
      neighborMask: new Uint8Array(cols * rows).fill(0xff),
    };
  }

  function boite(lane: string, min: [number, number, number], max: [number, number, number]): TrainBox {
    return { lane, box: new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)) };
  }

  /** La colonne x = 2 sur toute la hauteur de la grille. */
  const voie = boite("A", [1.5, -1, -1], [2.5, 1, 5]);
  const cellule = (x: number, z: number) => z * 5 + x;

  it("retire du graphe les cellules d'une voie, et elles seules", () => {
    const graph = grille();

    excludeTrainRails(graph, [voie], []);

    for (let z = 0; z < 5; z++) {
      expect(graph.walkable[cellule(2, z)]).toBe(0);
      expect(graph.neighborMask[cellule(2, z)]).toBe(0);
      expect(graph.walkable[cellule(1, z)]).toBe(1);
      expect(graph.walkable[cellule(3, z)]).toBe(1);
    }
  });

  it("coupe les liens des cellules voisines vers la voie, diagonales comprises", () => {
    const graph = grille();

    excludeTrainRails(graph, [voie], []);

    // Directions de `DIRS` : 1, 2 et 3 pointent vers +X.
    const versLaVoie = (1 << 1) | (1 << 2) | (1 << 3);
    expect(graph.neighborMask[cellule(1, 2)] & versLaVoie).toBe(0);
    // Vers -X et le long de la voie, rien ne change.
    expect(graph.neighborMask[cellule(1, 2)] & ((1 << 0) | (1 << 4) | (1 << 6))).toBe((1 << 0) | (1 << 4) | (1 << 6));
  });

  it("une traversée de la même voie reste praticable et relie les deux quais", () => {
    const graph = grille();
    const traversee = boite("A", [1.5, -1, 1.5], [2.5, 1, 2.5]);

    excludeTrainRails(graph, [voie], [traversee]);

    expect(graph.walkable[cellule(2, 2)]).toBe(1);
    expect(graph.walkable[cellule(2, 1)]).toBe(0);
    expect(graph.walkable[cellule(2, 3)]).toBe(0);
    // De la traversée : vers +X et -X oui, le long de la voie non.
    const mask = graph.neighborMask[cellule(2, 2)];
    expect(mask & (1 << 2)).not.toBe(0);
    expect(mask & (1 << 6)).not.toBe(0);
    expect(mask & (1 << 0)).toBe(0);
    expect(mask & (1 << 4)).toBe(0);
  });

  it("la traversée d'une AUTRE voie n'ouvre rien", () => {
    const graph = grille();

    excludeTrainRails(graph, [voie], [boite("B", [1.5, -1, 1.5], [2.5, 1, 2.5])]);

    expect(graph.walkable[cellule(2, 2)]).toBe(0);
  });

  it("une zone à une autre hauteur que le sol ne retire rien", () => {
    const graph = grille();

    excludeTrainRails(graph, [boite("A", [1.5, 4, -1], [2.5, 6, 5])], []);

    expect([...graph.walkable]).toEqual(Array.from({ length: 25 }, () => 1));
  });
});
