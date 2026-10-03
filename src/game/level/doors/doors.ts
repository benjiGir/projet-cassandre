import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type {
  DoorGroup,
  DoorMember,
  DoorInfo,
  DoorMovement,
  DoorMovementEvent,
  DoorActor,
  DoorRuntimeState,
} from "./doorTypes";
import { parseDoorConfig, PORTEE_ACTION_MANUELLE } from "./doorConfig";
import {
  buildDoorMember,
  resolveMemberOpenSign,
  isActorInAutoRange,
  advanceDoorProgress,
  isActorBlockingClosedDoor,
  hingePivotInRootSpace,
  composeBattantPose,
  composeCoulissePose,
  composeVerticalPose,
} from "./doorGeometry";

export class DoorSystem {
  private readonly groups: DoorGroup[] = [];
  private readonly groupByDoorName = new Map<string, DoorGroup>();
  private readonly _movementEvents: DoorMovementEvent[] = [];

  constructor(doors: readonly DoorInfo[]) {
    const byKey = new Map<string, DoorMember[]>();
    for (const info of doors) {
      const config = parseDoorConfig(info.movement, info.extras);
      const key = config.groupe ?? info.name;
      const member = buildDoorMember(info, config);
      const list = byKey.get(key);
      if (list) list.push(member);
      else byKey.set(key, [member]);
    }

    for (const [key, members] of byKey) {
      const center = new THREE.Vector3();
      for (const member of members) {
        const t = member.info.body.translation();
        center.add(new THREE.Vector3(t.x, t.y, t.z));
      }
      center.multiplyScalar(1 / members.length);

      const group: DoorGroup = {
        key,
        members,
        center,
        auto: members.some((m) => m.config.auto),
        autoQui: members.some((m) => m.config.autoQui === "tous")
          ? "tous"
          : members.some((m) => m.config.autoQui === "ennemis")
            ? "ennemis"
            : "non",
        manuelle: members.some((m) => m.config.manuelle === "les-deux")
          ? "les-deux"
          : members.some((m) => m.config.manuelle === "fermer")
            ? "fermer"
            : "non",
        portee: Math.max(...members.map((m) => m.config.portee)),
        delai: Math.max(...members.map((m) => m.config.delai)),
        referme: members.every((m) => m.config.referme),
        duree: Math.max(...members.map((m) => m.config.duree)),
        progress: 0,
        target: 0,
        permanent: false,
        idleTimer: 0,
      };
      this.groups.push(group);
      for (const member of members) this.groupByDoorName.set(member.info.name, group);
    }
  }

  get movementEvents(): ReadonlyArray<DoorMovementEvent> {
    return this._movementEvents;
  }

  /** À appeler UNE SEULE FOIS par frame d'affichage, après `updateFx` (même contrat que `PropSystem`). */
  clearFrameEvents(): void {
    this._movementEvents.length = 0;
  }

  /** Colliders des groupes `auto` — à désactiver le temps du bake du graphe de navigation (voir `session/spawning.ts`), sinon un bureau derrière une porte automatique ne reçoit jamais d'arête. */
  get autoGroupColliders(): RAPIER.Collider[] {
    const colliders: RAPIER.Collider[] = [];
    for (const group of this.groups) {
      if (!group.auto) continue;
      for (const member of group.members) colliders.push(member.info.collider);
    }
    return colliders;
  }

  /** État courant d'UN vantail par son nom — pour la console/les tests. `null` si le nom est inconnu. */
  stateOf(name: string): DoorRuntimeState | null {
    const group = this.groupByDoorName.get(name);
    if (!group) return null;
    return runtimeState(group);
  }

  open(name: string, openerPosition: THREE.Vector3, opts: { silent?: boolean } = {}): boolean {
    const group = this.groupByDoorName.get(name);
    if (!group) return false;
    group.permanent = true;
    this.beginOpening(group, openerPosition, opts.silent ?? false);
    return true;
  }

  actionner(position: THREE.Vector3): { name: string; action: "ouverte" | "fermee" } | null {
    const porteeSq = PORTEE_ACTION_MANUELLE * PORTEE_ACTION_MANUELLE;
    let cible: DoorGroup | null = null;
    let meilleure = Infinity;
    for (const group of this.groups) {
      if (group.manuelle === "non") continue;
      for (const member of group.members) {
        const t = member.info.body.translation();
        const dx = position.x - t.x;
        const dy = position.y - t.y;
        const dz = position.z - t.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < meilleure && d <= porteeSq) {
          meilleure = d;
          cible = group;
        }
      }
    }
    if (!cible) return null;

    const nom = cible.members[0]!.info.name;
    if (cible.target === 1) {
      this.beginClosing(cible);
      return { name: nom, action: "fermee" };
    }
    if (cible.manuelle !== "les-deux") return null; // « fermer » seulement : rien à faire sur une porte déjà fermée
    this.beginOpening(cible, position, false);
    return { name: nom, action: "ouverte" };
  }

  private beginClosing(group: DoorGroup): void {
    group.permanent = false;
    group.idleTimer = 0;
    group.target = 0;
    const representative = group.members[0]!;
    this._movementEvents.push({ name: representative.info.name, movement: representative.info.movement });
  }

  private beginOpening(group: DoorGroup, openerPosition: THREE.Vector3, silent: boolean): void {
    const wasFullyClosed = group.progress === 0 && group.target === 0;
    if (wasFullyClosed && !silent) {
      const representative = group.members[0]!;
      this._movementEvents.push({ name: representative.info.name, movement: representative.info.movement });
    }
    if (wasFullyClosed) {
      for (const member of group.members) member.openSign = resolveMemberOpenSign(member, openerPosition);
    }
    group.target = 1;
    for (const member of group.members) member.info.collider.setEnabled(false);
  }

  /** Pas fixe, AVANT `updateGameplay` (mêmes conventions que `PropSystem.snapshotPrevious`). */
  snapshotPrevious(): void {
    for (const group of this.groups) {
      for (const member of group.members) {
        member.prevPosition.copy(member.currPosition);
        member.prevQuaternion.copy(member.currQuaternion);
      }
    }
  }

  update(dt: number, actors: readonly DoorActor[]): void {
    for (const group of this.groups) {
      this.updateAutoTrigger(group, actors, dt);
      this.advanceGroup(group, dt, actors);
      for (const member of group.members) this.composeMemberPose(member, group.progress);
    }
  }

  private updateAutoTrigger(group: DoorGroup, actors: readonly DoorActor[], dt: number): void {
    if (!group.auto || group.permanent) return;

    let opener: THREE.Vector3 | null = null;
    for (const actor of actors) {
      if (group.autoQui === "ennemis" && actor.joueur) continue; // à lui d'ouvrir à la main
      if (isActorInAutoRange(group.center, actor, group.portee)) {
        opener = actor.position;
        break;
      }
    }

    if (opener) {
      group.idleTimer = 0;
      if (group.target === 0) this.beginOpening(group, opener, false);
      return;
    }

    if (group.target !== 1) return; // déjà en train de se refermer/fermée : rien à armer
    if (!group.referme) return; // `referme:false` (bureau) : reste ouverte pour toujours une fois ouverte
    group.idleTimer += dt;
    if (group.idleTimer >= group.delai) group.target = 0;
  }

  private advanceGroup(group: DoorGroup, dt: number, actors: readonly DoorActor[]): void {
    if (group.target === group.progress) return; // déjà à sa cible, rien à faire

    if (group.target === 0) {
      const next = advanceDoorProgress(group.progress, 0, dt, group.duree);
      if (next <= 0) {
        // Sur le point de finir sa fermeture : refuse si quelqu'un chevauche encore le vantail.
        const blocked = group.members.some((member) =>
          actors.some((actor) => {
            const t = member.info.body.translation();
            const r = member.info.body.rotation();
            return isActorBlockingClosedDoor(
              new THREE.Vector3(t.x, t.y, t.z),
              new THREE.Quaternion(r.x, r.y, r.z, r.w),
              member.info.halfExtents,
              actor,
            );
          }),
        );
        if (blocked) {
          group.target = 1; // rouvre plutôt que de refermer dessus — aucun son (ce n'est pas une NOUVELLE ouverture).
          return;
        }
        group.progress = 0;
        for (const member of group.members) member.info.collider.setEnabled(true);
        return;
      }
      group.progress = next;
      return;
    }

    group.progress = advanceDoorProgress(group.progress, 1, dt, group.duree);
  }

  private composeMemberPose(member: DoorMember, progress: number): void {
    const info = member.info;
    switch (info.movement) {
      case "battant": {
        const pivotWorld = hingePivotInRootSpace(
          info.closedPosition,
          info.closedQuaternion,
          member.hinge!.pivotLocal,
          info.scale,
          pivotScratch,
        );
        const theta = member.openSign * member.config.angleRad * progress;
        composeBattantPose(info.closedPosition, info.closedQuaternion, pivotWorld, theta, member.currPosition, member.currQuaternion);
        break;
      }
      case "coulisse":
        member.currQuaternion.copy(info.closedQuaternion);
        composeCoulissePose(
          info.closedPosition,
          info.closedQuaternion,
          member.axis!,
          member.openSign,
          member.courseWorld * progress,
          member.currPosition,
        );
        break;
      case "monte":
        member.currQuaternion.copy(info.closedQuaternion);
        composeVerticalPose(info.closedPosition, 1, member.courseWorld * progress, member.currPosition);
        break;
      case "descend":
        member.currQuaternion.copy(info.closedQuaternion);
        composeVerticalPose(info.closedPosition, -1, member.courseWorld * progress, member.currPosition);
        break;
    }
  }

  /** Taux d'affichage — SEUL endroit qui écrit dans un mesh de porte, même séparation que `PropSystem.interpolate`. */
  interpolate(alpha: number): void {
    for (const group of this.groups) {
      for (const member of group.members) {
        // Au repos, on n'écrit rien — mais UNE dernière fois après l'arrivée :
        // la pose écrite juste avant est une interpolation (alpha < 1), et le
        // vantail resterait arrêté quelques degrés avant sa butée.
        const repos = member.prevPosition.equals(member.currPosition) && member.prevQuaternion.equals(member.currQuaternion);
        if (repos && member.settled) continue;
        member.settled = repos;
        const object = member.info.object;
        object.position.lerpVectors(member.prevPosition, member.currPosition, alpha);
        object.quaternion.slerpQuaternions(member.prevQuaternion, member.currQuaternion, alpha);
        const slot = member.info.batchSlot;
        if (slot) {
          object.updateMatrix();
          slot.batch.setMatrixAt(slot.instanceId, object.matrix);
          this.movedBatches.add(slot.batch);
        }
      }
    }
    // La sphère englobante d'un lot sert à l'éliminer en entier : un vantail
    // qui pivote peut en sortir, et le lot disparaîtrait alors qu'il est vu.
    for (const batch of this.movedBatches) batch.computeBoundingSphere();
    this.movedBatches.clear();
  }

  private readonly movedBatches = new Set<THREE.BatchedMesh>();

  /** Résumé lisible pour la console de dev (`cassandre.doors2()`/tests). */
  describe(): Array<{ name: string; movement: DoorMovement; state: DoorRuntimeState; groupe: string }> {
    const out: Array<{ name: string; movement: DoorMovement; state: DoorRuntimeState; groupe: string }> = [];
    for (const group of this.groups) {
      const state = runtimeState(group);
      for (const member of group.members) {
        out.push({ name: member.info.name, movement: member.info.movement, state, groupe: group.key });
      }
    }
    return out;
  }
}

const pivotScratch = new THREE.Vector3();

function runtimeState(group: DoorGroup): DoorRuntimeState {
  if (group.progress === 0) return group.target === 1 ? "opening" : "closed";
  if (group.progress === 1) return group.target === 0 ? "closing" : "open";
  return group.target === 1 ? "opening" : "closing";
}
