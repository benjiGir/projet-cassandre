import * as THREE from "three";
import { Schema } from "effect";
import { blenderName } from "../loading/levelExtras";
import type { TrainCommand, TrainLaneDef, TrainRoute } from "./trainTypes";
import { TRAIN_CAR_LENGTH, TRAIN_HEIGHT, TRAIN_WIDTH } from "./trainConfig";

const Offset = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));
const RouteExtras = Schema.Struct({
  voie: Schema.NonEmptyString,
  trajet: Schema.NonEmptyString,
  points: Schema.NonEmptyString,
  debut_visible: Offset,
  fin_visible: Offset,
  premier: Schema.optionalKey(Offset),
  active: Schema.optionalKey(Schema.Boolean),
  marge_visuelle: Schema.optionalKey(Offset),
});
const SignalExtras = Schema.Struct({
  voie: Schema.NonEmptyString,
  cap: Schema.optionalKey(Schema.Finite),
  aspect: Schema.optionalKey(Schema.Literals(["feu", "ecran"])),
});
const ControlExtras = Schema.Struct({
  voie: Schema.NonEmptyString,
  train: Schema.Literals(["stop", "switch"]),
  trajet: Schema.optionalKey(Schema.NonEmptyString),
});

export class TrainLevelError extends Schema.TaggedError<TrainLevelError>()("TrainLevelError", {
  message: Schema.String,
}) {}

export interface TrainSignal {
  lane: string;
  position: THREE.Vector3;
  yaw: number;
  appearance: "feu" | "ecran";
}

export interface TrainBox {
  lane: string;
  box: THREE.Box3;
}

export interface TrainVisibleRoute {
  lane: string;
  route: TrainRoute;
  start: number;
  end: number;
}

export interface TrainLevelData {
  lanes: TrainLaneDef[];
  signals: TrainSignal[];
  commands: Map<string, TrainCommand>;
  navigationZones: TrainBox[];
  crossings: TrainBox[];
  refuges: TrainBox[];
  visibleRoutes: TrainVisibleRoute[];
  model: THREE.Object3D;
}

function invalid(message: string): never {
  throw new TrainLevelError({ message });
}

// see: docs/4-technique/trains-metro.md#contrat-blender
export function readTrainLevel(nodes: readonly THREE.Object3D[]): TrainLevelData | null {
  const byName = new Map(nodes.map((node) => [blenderName(node), node]));
  const definitions = nodes.filter((node) => blenderName(node).startsWith("voie_"));
  if (definitions.length === 0) {
    if (
      nodes.some(
        (node) =>
          /^(rail_|train_modele_|signal_train_|nav_voie_|traversee_train_|refuge_train_)/.test(blenderName(node)) ||
          node.userData.train !== undefined,
      )
    )
      invalid("Marqueurs de trains sans voie déclarée.");
    return null;
  }
  const lanes = new Map<string, TrainLaneDef>();
  const visibleRoutes: TrainVisibleRoute[] = [];
  for (const node of definitions) {
    let extra: typeof RouteExtras.Type;
    try {
      extra = Schema.decodeUnknownSync(RouteExtras)(node.userData);
    } catch (cause) {
      invalid(`${blenderName(node)} : ${String(cause)}`);
    }
    const pointNames = extra.points.split(",").map((name) => name.trim());
    if (pointNames.length < 2 || new Set(pointNames).size !== pointNames.length)
      invalid(`${blenderName(node)} : points incomplets ou répétés.`);
    const points = pointNames.map((name) => {
      const point = byName.get(name);
      if (!point || !name.startsWith("rail_")) invalid(`Point de voie absent : ${name}`);
      const position = point.getWorldPosition(new THREE.Vector3());
      if (![position.x, position.y, position.z].every(Number.isFinite)) invalid(`Point de voie non fini : ${name}`);
      return position;
    });
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const delta = points[i].clone().sub(points[i - 1]);
      if (Math.hypot(delta.x, delta.z) < 0.01) invalid(`Segment vertical ou nul : ${extra.trajet}`);
      if (Math.abs(delta.y) / Math.hypot(delta.x, delta.z) > 0.6) invalid(`Pente de voie excessive : ${extra.trajet}`);
      length += delta.length();
    }
    if (extra.fin_visible <= extra.debut_visible || extra.fin_visible > length)
      invalid(`Intervalle visible invalide : ${extra.trajet}`);
    const route = {
      id: extra.trajet,
      points,
      visibleStart: extra.debut_visible,
      visibleEnd: extra.fin_visible,
      visualPadding: extra.marge_visuelle ?? 0,
    };
    const previous = lanes.get(extra.voie);
    if (previous) {
      if (previous.routes.some((candidate) => candidate.id === route.id))
        invalid(`Trajet de voie répété : ${extra.voie}/${route.id}`);
      if (previous.firstArrival !== (extra.premier ?? 10) || previous.enabled !== (extra.active ?? true))
        invalid(`Horaire incohérent entre les trajets : ${extra.voie}`);
      lanes.set(extra.voie, { ...previous, routes: [...previous.routes, route] });
    } else
      lanes.set(extra.voie, {
        id: extra.voie,
        routes: [route],
        firstArrival: extra.premier ?? 10,
        enabled: extra.active ?? true,
      });
    visibleRoutes.push({ lane: extra.voie, route, start: extra.debut_visible, end: extra.fin_visible });
  }
  const requireLane = (lane: string): void => {
    if (!lanes.has(lane)) invalid(`Voie inconnue : ${lane}`);
  };
  const signals: TrainSignal[] = [];
  const commands = new Map<string, TrainCommand>();
  const navigationZones: TrainBox[] = [],
    crossings: TrainBox[] = [],
    refuges: TrainBox[] = [];
  for (const node of nodes) {
    const name = blenderName(node);
    if (name.startsWith("signal_train_")) {
      const extra = Schema.decodeUnknownSync(SignalExtras)(node.userData);
      requireLane(extra.voie);
      signals.push({
        lane: extra.voie,
        position: node.getWorldPosition(new THREE.Vector3()),
        yaw: ((extra.cap ?? 0) * Math.PI) / 180,
        appearance: extra.aspect ?? "ecran",
      });
    }
    if (name.startsWith("use_") && node.userData.train !== undefined) {
      const extra = Schema.decodeUnknownSync(ControlExtras)(node.userData);
      requireLane(extra.voie);
      if (extra.trajet && !lanes.get(extra.voie)!.routes.some((route) => route.id === extra.trajet))
        invalid(`Aiguillage vers un trajet absent : ${name}`);
      commands.set(
        name,
        extra.train === "switch"
          ? { type: "switch", lane: extra.voie, route: extra.trajet }
          : { type: "stop", lane: extra.voie },
      );
    }
    const target = name.startsWith("nav_voie_")
      ? navigationZones
      : name.startsWith("traversee_train_")
        ? crossings
        : name.startsWith("refuge_train_")
          ? refuges
          : null;
    if (target) {
      const extra = Schema.decodeUnknownSync(Schema.Struct({ voie: Schema.NonEmptyString }))(node.userData);
      requireLane(extra.voie);
      if (!(node instanceof THREE.Mesh)) invalid(`Volume de voie sans mesh : ${name}`);
      target.push({ lane: extra.voie, box: new THREE.Box3().setFromObject(node) });
      node.visible = false;
    }
  }
  for (const lane of lanes.keys()) {
    if (!signals.some((signal) => signal.lane === lane)) invalid(`Aucun signal pour la voie ${lane}`);
    if (!navigationZones.some((zone) => zone.lane === lane)) invalid(`Navigation non exclue pour la voie ${lane}`);
    if (!refuges.some((refuge) => refuge.lane === lane)) invalid(`Aucun refuge pour la voie ${lane}`);
  }
  const models = nodes.filter((node) => blenderName(node).startsWith("train_modele_"));
  if (models.length !== 1) invalid("Le niveau doit fournir un seul modèle de voiture de ligne.");
  const model = models[0];
  const inverse = model.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  model.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    if (blenderName(node).startsWith("col_")) invalid("Collider statique dans le modèle de rame.");
    node.geometry.computeBoundingBox();
    if (node.geometry.boundingBox)
      bounds.union(
        node.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld)),
      );
  });
  const size = bounds.getSize(new THREE.Vector3()),
    center = bounds.getCenter(new THREE.Vector3());
  if (
    bounds.isEmpty() ||
    Math.abs(size.x - TRAIN_WIDTH) > 0.25 ||
    Math.abs(size.y - TRAIN_HEIGHT) > 0.3 ||
    Math.abs(size.z - TRAIN_CAR_LENGTH) > 0.3 ||
    Math.abs(center.x) > 0.1 ||
    Math.abs(center.z) > 0.1 ||
    Math.abs(bounds.min.y) > 0.2
  )
    invalid("Gabarit du modèle incompatible : voiture de 15 × 2,8 × 3,2 m centrée en X/Z, sol à Y=0.");
  return {
    lanes: [...lanes.values()],
    signals,
    commands,
    navigationZones,
    crossings,
    refuges,
    visibleRoutes,
    model: models[0],
  };
}
