import * as THREE from "three";

import type { UseObject } from "../loading/levelTypes";
import type { LoyaltyCard } from "../../player/loyaltyCards";
import type { PerkOffer } from "../../player/perks";
import { BLOCKOUT_CONTROLS } from "../blockout/blockoutConfig";

// see: docs/archive/pipeline-niveau-blender.md#objets-interactifs

// see: docs/6-reference/notes-code-gameplay-niveau.md#objets-cassables-et-interactions
export interface InteractionHandlers {
  onMetroBlockoutUse?(name: string): void;
  onExitDoorUse(targetName: string): void;
  /** `use_frozen_storage` (Zone B, secret 1) : ouvre `door_b_frozen` SANS
   * condition (pas de badge, contrairement à `onExitDoorUse`) — même
   * mécanique de porte/glissement côté `main.ts`, juste aucune garde. */
  onFrozenStorageUse(targetName: string): void;
  /** `use_pa_mic` (Zone C) : déclenche une réplique du héros (texte HUD
   * placeholder — pas de vraie VO cette passe). Répétable à
   * volonté, contrairement aux pickups ci-dessus. */
  onPaMicUse(): void;
  /** `use_pointeuse` (vestiaires) : déclenche la réplique sur les heures sup'.
   * Répétable, comme les autres interactions de décor. */
  onPunchClockUse(): void;
  /** `use_sav_sonnette` : sonne au guichet après-vente. */
  onSavBellUse(): void;
  /** `use_douche_1/2` : allume ou coupe l'eau du poste visé. */
  onShowerToggleUse(name: string): void;
  /** `use_toilet` (Zone D) : +1 PV. Répétable (plafonné au PV max côté
   * `main.ts`), pas un pickup à usage unique — la blague de la valeur
   * dérisoire (+1 PV) fonctionne mieux en libre-service. */
  onToiletUse(): void;
  /** `use_*` portant `extras.card` : le joueur ramasse cette carte de
   * fidélité. Consommé comme un pickup d'arme. */
  onCardPickup(card: LoyaltyCard, name: string): void;
  onCardDoorUse(targetName: string, required: LoyaltyCard): void;
  onDoorUse(targetName: string, message: string | null, useName: string): void;
  onCameraConsoleUse(cameraNames: readonly string[]): void;
  /** Borne (`use_*` portant `perk` et `prix`) : tentative d'achat. Jamais
   * consommée — un refus doit rester réessayable, et c'est l'appelant qui
   * sait si le perk est déjà acheté. */
  onPerkKioskUse(offer: PerkOffer): void;
  onTrainUse?(name: string): void;
}

export interface WeaponPickupHandlers {
  /** `use_crowbar`. Le pied-de-biche n'a pas de munitions : un joueur qui
   * l'a déjà n'a rien à en tirer, l'appelant renvoie alors `false` et
   * l'objet reste au sol indéfiniment (voir `docs/4-technique/armes.md`). */
  onCrowbarPickup(): boolean;
  /** `use_shotgun`. Même contrat que `onCrowbarPickup` — le pompe garde sa
   * dotation unique (aucun mécanisme de recharge n'existe pour lui), donc un
   * second ramassage n'a également rien à offrir : `false`, reste au sol. */
  onShotgunPickup(): boolean;
  onPistolPickup(): boolean;
}

/** Rayon des ramassages pris en marchant dessus, en mètres — celui d'une partie sans perk. */
export const HEAL_PICKUP_RADIUS = 1.2;

export class InteractionSystem {
  /** Objets `use_*` déjà consommés, PAR RÉFÉRENCE DE MESH, pas par nom — un
   * hot reload remplace tout mesh, donc redevient déclenchable (dev-only).
   * see: docs/archive/pipeline-niveau-blender.md#objets-interactifs */
  private readonly consumed = new WeakSet<THREE.Object3D>();

  private nearest: UseObject | null = null;

  get nearestInRangeName(): string | null {
    return this.nearest?.name ?? null;
  }

  /** L'objet que viserait un appui sur la touche d'usage, relevé au dernier `update`. */
  get nearestInRange(): UseObject | null {
    return this.nearest;
  }

  update(
    usePressed: boolean,
    useObjects: readonly UseObject[],
    playerPosition: THREE.Vector3,
    handlers: InteractionHandlers,
  ): boolean {
    let nearest: UseObject | null = null;
    let nearestDistanceSq = Infinity;

    for (const useObject of useObjects) {
      if (this.consumed.has(useObject.object)) continue;
      // Une carte déjà acquise reste cachée après un hot reload.
      if (useObject.grantsCard && !useObject.object.visible) continue;
      // Trousse et boîte de munitions : ramassées en marchant dessus, voir
      // `collectHeals`/`collectAmmo` — jamais proposées à la touche E.
      if (useObject.heals !== null || useObject.ammo !== null) continue;
      // Armes au sol : même règle, voir `collectWeapons` — sinon elles
      // voleraient l'appui E à un sanitaire ou une porte à portée.
      if (isWeaponPickupName(useObject.name)) continue;
      const rangeSq = useObject.range * useObject.range;
      const distanceSq = playerPosition.distanceToSquared(useObject.position);
      if (distanceSq > rangeSq) continue;
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearest = useObject;
      }
    }

    this.nearest = nearest;

    if (!usePressed || !nearest) return false;

    this.dispatch(nearest, handlers);
    return true;
  }

  collectHeals(
    useObjects: readonly UseObject[],
    playerPosition: THREE.Vector3,
    tryHeal: (amount: number, useObject: UseObject) => boolean,
    radius = HEAL_PICKUP_RADIUS,
  ): void {
    this.collectWalkOver(useObjects, playerPosition, (u) => u.heals, tryHeal, radius);
  }

  /** Même contrat que `collectHeals`, pour les boîtes de munitions (`munitions`). */
  collectAmmo(
    useObjects: readonly UseObject[],
    playerPosition: THREE.Vector3,
    tryTake: (amount: number, useObject: UseObject) => boolean,
    radius = HEAL_PICKUP_RADIUS,
  ): void {
    this.collectWalkOver(useObjects, playerPosition, (u) => u.ammo, tryTake, radius);
  }

  private collectWalkOver(
    useObjects: readonly UseObject[],
    playerPosition: THREE.Vector3,
    quantite: (useObject: UseObject) => number | null,
    prendre: (amount: number, useObject: UseObject) => boolean,
    radius: number,
  ): void {
    const radiusSq = radius * radius;
    for (const useObject of useObjects) {
      const amount = quantite(useObject);
      if (amount === null || this.consumed.has(useObject.object)) continue;
      if (playerPosition.distanceToSquared(useObject.position) > radiusSq) continue;
      if (!prendre(amount, useObject)) continue;
      useObject.object.visible = false;
      this.consumed.add(useObject.object);
    }
  }

  collectWeapons(
    useObjects: readonly UseObject[],
    playerPosition: THREE.Vector3,
    handlers: WeaponPickupHandlers,
    radius = HEAL_PICKUP_RADIUS,
  ): void {
    const radiusSq = radius * radius;
    for (const useObject of useObjects) {
      if (this.consumed.has(useObject.object)) continue;
      const handler = weaponPickupHandlerFor(useObject.name, handlers);
      if (!handler) continue;
      if (playerPosition.distanceToSquared(useObject.position) > radiusSq) continue;
      if (!handler()) continue; // déjà possédée sans rien à offrir : reste au sol
      useObject.object.visible = false;
      this.consumed.add(useObject.object);
    }
  }

  /** Dispatch : d'abord ce que le `.glb` DÉCLARE (cartes de fidélité),
   * ensuite par NOM Blender exact — voir la doc de tête de fichier. */
  private dispatch(useObject: UseObject, handlers: InteractionHandlers): void {
    if ((BLOCKOUT_CONTROLS as readonly string[]).includes(useObject.name)) {
      handlers.onMetroBlockoutUse?.(useObject.name);
      return;
    }
    // Console de caméras : déclarative comme une carte, mais JAMAIS
    // consommée — une console se réutilise pour cycler (voir
    // `CameraViewSystem.activate`).
    if (useObject.cameras) {
      handlers.onCameraConsoleUse(useObject.cameras);
      return;
    }

    // Ramassage de carte : autoportant, consommé, comme `use_crowbar`.
    if (useObject.grantsCard) {
      handlers.onCardPickup(useObject.grantsCard, useObject.name);
      useObject.object.visible = false;
      this.consumed.add(useObject.object);
      return;
    }

    if (useObject.sells) {
      handlers.onPerkKioskUse(useObject.sells);
      return;
    }
    if (useObject.extras.train !== undefined) {
      handlers.onTrainUse?.(useObject.name);
      return;
    }

    // Porte à carte : JAMAIS consommée, un refus doit rester réessayable —
    // même contrat que `use_exit_door`. Sans cible, il n'y a rien à ouvrir :
    // `loader.ts` a déjà averti bruyamment, on ne le redit pas ici.
    if (useObject.requiresCard && useObject.targetName) {
      handlers.onCardDoorUse(useObject.targetName, useObject.requiresCard);
      return;
    }

    switch (useObject.name) {

      case "use_exit_door":
        // PAS marqué consommé : un essai refusé doit rester réessayable —
        // `main.ts` a sa propre garde contre un ré-essai une fois déverrouillée.
        handlers.onExitDoorUse(useObject.targetName ?? useObject.name);
        break;

      case "use_frozen_storage":
        // Même non-consommation que `use_exit_door`.
        handlers.onFrozenStorageUse(useObject.targetName ?? useObject.name);
        break;

      case "use_pa_mic":
        handlers.onPaMicUse();
        break;

      case "use_pointeuse":
        handlers.onPunchClockUse();
        break;

      case "use_sav_sonnette":
        handlers.onSavBellUse();
        break;

      case "use_douche_1":
      case "use_douche_2":
        handlers.onShowerToggleUse(useObject.name);
        break;

      case "use_toilet":
        handlers.onToiletUse();
        break;

      default:
        // Porte libre : jamais consommée, comme une porte à carte — l'appelant
        // ignore un second appui sur une porte déjà ouverte.
        if (useObject.targetName) {
          const message = typeof useObject.extras.message === "string" ? useObject.extras.message : null;
          handlers.onDoorUse(useObject.targetName, message, useObject.name);
        }
        // Nom sans handler reconnu et sans cible : aucun effet, aucun warning.
        // Un `use_*` sans cible a déjà son propre avertissement bruyant émis par
        // `loader.ts` (voir sa doc) — ne pas le dupliquer ici.
        break;
    }
  }
}

/** `use_*` dont l'effet est câblé par NOM (armes au sol, `switch` de
 * `InteractionSystem`) : aucune `target` attendue dans le `.glb`, donc pas
 * d'avertissement « sans cible » au chargement (`loader.ts`). */
export const NAME_WIRED_USE_OBJECTS: ReadonlySet<string> = new Set([
  ...BLOCKOUT_CONTROLS,
  "use_crowbar",
  "use_shotgun",
  "use_pistol",
  "use_exit_door",
  "use_frozen_storage",
  "use_pa_mic",
  "use_pointeuse",
  "use_sav_sonnette",
  "use_douche_1",
  "use_douche_2",
  "use_toilet",
]);

/** Les trois noms d'armes au sol câblés en dur — voir `WeaponPickupHandlers`. */
function isWeaponPickupName(name: string): boolean {
  return name === "use_crowbar" || name === "use_shotgun" || name === "use_pistol";
}

/** Résout le callback de `WeaponPickupHandlers` pour un nom donné, `null` si
 * ce n'est pas une arme au sol — factorisé pour que `isWeaponPickupName` et
 * `collectWeapons` ne puissent pas diverger sur la liste des trois noms. */
function weaponPickupHandlerFor(name: string, handlers: WeaponPickupHandlers): (() => boolean) | null {
  switch (name) {
    case "use_crowbar":
      return handlers.onCrowbarPickup;
    case "use_shotgun":
      return handlers.onShotgunPickup;
    case "use_pistol":
      return handlers.onPistolPickup;
    default:
      return null;
  }
}
