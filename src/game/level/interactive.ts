import * as THREE from "three";

import type { UseObject } from "./loader";
import type { LoyaltyCard } from "../player/loyaltyCards";

/**
 * Système d'interaction (`use_*`) — voir `loader.ts` pour la construction de
 * `UseObject` (portée, position monde, `targetName`).
 * see: docs/pipeline/niveau-blender.md#objets-interactifs
 */

/** Un appelant `main.ts` fournit une callback par effet nommé reconnu. Étendre cette interface au fur et à mesure que de nouveaux `use_*` nommés gagnent un effet — jamais un système générique de callbacks indexé par nom.
 *
 * Deux exceptions, et elles sont volontaires : `onCardPickup` et
 * `onCardDoorUse` ne sont PAS indexés par nom mais par ce que le `.glb`
 * DÉCLARE (propriétés `card`/`requires`, voir `loader.ts::UseObject`). Le
 * niveau v2 pose trois cartes et trois portes ; les câbler par nom aurait
 * demandé six entrées ici, et une septième à chaque niveau suivant. */
export interface InteractionHandlers {
  /** `use_crowbar` : ramasse le pied-de-biche. Appelle `weapons.pickUpMelee()` côté `main.ts`. */
  onCrowbarPickup(): void;
  /** `use_shotgun` : ramasse le pompe (niveau complet, Zone B). Appelle `weapons.pickUpShotgun()` côté `main.ts`. */
  onShotgunPickup(): void;
  /** `use_pistol` : ramasse le pistolet, avec sa dotation de munitions. */
  onPistolPickup(): void;
  /** `use_exit_door` (Zone E) : tentative d'ouverture de la porte de sortie.
   * `targetName` = nom du `door_*` visé (lu dans `extras.target`, voir
   * `loader.ts::buildUseObject`) — `main.ts` décide seul si le badge est en
   * poche (déverrouille) ou non (juste un refus, feedback côté `main.ts`). */
  onExitDoorUse(targetName: string): void;
  /** `use_frozen_storage` (Zone B, secret 1) : ouvre `door_b_frozen` SANS
   * condition (pas de badge, contrairement à `onExitDoorUse`) — même
   * mécanique de porte/glissement côté `main.ts`, juste aucune garde. */
  onFrozenStorageUse(targetName: string): void;
  /** `use_pa_mic` (Zone C) : déclenche une réplique du héros (texte HUD
   * placeholder — invariant #9, pas de vraie VO cette passe). Répétable à
   * volonté, contrairement aux pickups ci-dessus. */
  onPaMicUse(): void;
  /** `use_toilet` (Zone D) : +1 PV. Répétable (plafonné au PV max côté
   * `main.ts`), pas un pickup à usage unique — la blague de la valeur
   * dérisoire (+1 PV) fonctionne mieux en libre-service. */
  onToiletUse(): void;
  /** `use_*` portant `extras.card` : le joueur ramasse cette carte de
   * fidélité. Consommé comme un pickup d'arme. */
  onCardPickup(card: LoyaltyCard, name: string): void;
  /** `use_*` portant `extras.requires` ET `extras.target` : tentative
   * d'ouverture d'une porte à carte. L'appelant décide seul si la carte est
   * en poche (déverrouille) ou non (refus) — même partage des rôles que
   * `onExitDoorUse`. */
  onCardDoorUse(targetName: string, required: LoyaltyCard): void;
  /** `use_*` portant `extras.target` SANS `extras.requires`, et qu'aucun nom
   * ci-dessous ne réclame : une porte LIBRE — le pan de mur du photomaton, la
   * porte coupe-feu des rayons. Troisième exception déclarative, même raison
   * que les cartes : c'est le `.glb` qui dit « ceci ouvre cela ».
   * `message` est lu dans `extras.message`, `null` s'il est absent. Le sens
   * unique d'une porte ne se code pas ici : il tient à l'endroit où le `.glb`
   * pose son `use_*`, hors de portée depuis l'autre côté. */
  onDoorUse(targetName: string, message: string | null): void;
}

/** Distance entre le centre de capsule du joueur et le centre d'une trousse
 * sous laquelle on la ramasse, mètres. Le centre de capsule est à ~0,9 m du
 * sol et la boîte à ~0,25 m : 1,2 m laisse environ 1 m à l'horizontale, soit
 * « marcher dessus » sans devoir viser la boîte au centimètre. */
export const HEAL_PICKUP_RADIUS = 1.2;

export class InteractionSystem {
  /** Objets `use_*` déjà consommés, PAR RÉFÉRENCE DE MESH, pas par nom — un
   * hot reload remplace tout mesh, donc redevient déclenchable (dev-only).
   * see: docs/pipeline/niveau-blender.md#objets-interactifs */
  private readonly consumed = new WeakSet<THREE.Object3D>();

  private nearestName: string | null = null;

  /**
   * Nom Blender du `use_*` le plus proche actuellement à portée, `null` sinon.
   * Recalculé à chaque `update()`. Exposé pour un futur prompt HUD ("Appuyez
   * sur E") qui n'a PAS besoin de dupliquer cette recherche de proximité —
   * ce slice ne construit pas ce prompt (voir la tâche).
   */
  get nearestInRangeName(): string | null {
    return this.nearestName;
  }

  /**
   * Un pas fixe d'interaction.
   *
   * @param usePressed Front montant déjà consommé (`InputFrame.use`), jamais
   *   `isDown` — un appui = une tentative d'interaction, même contrat que
   *   `jump`/`fire`.
   * @param useObjects Liste COURANTE des `use_*` du niveau chargé. À passer
   *   FRAÎCHEMENT relue par l'appelant à chaque appel (typiquement
   *   `gltfLevelSession?.current?.useObjects ?? []`) — ne JAMAIS la mettre en
   *   cache ici : un hot reload remplace tout le tableau par de nouveaux
   *   objets (nouveau `LevelHandle`, voir `hotReload.ts`), une copie mise en
   *   cache pointerait sur des meshes disposés.
   * @param playerPosition Centre de capsule du joueur (`player.position`),
   *   pas la position des pieds ni la position oculaire — la portée de 2 m
   *   rend l'écart avec les pieds (~0.85 m) négligeable.
   * @param handlers Callbacks par effet nommé reconnu, voir `InteractionHandlers`.
   * @returns `true` si l'appui a été CONSOMMÉ par un `use_*`. L'appelant s'en
   *   sert pour savoir s'il reste quelque chose à faire de cet appui —
   *   manœuvrer une porte à la main, par exemple (`DoorSystem.actionner`) —
   *   sans qu'un bouton et la porte qu'il commande réagissent tous les deux
   *   au même appui.
   */
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
      // Trousse et boîte de munitions : ramassées en marchant dessus, voir
      // `collectHeals`/`collectAmmo` — jamais proposées à la touche E.
      if (useObject.heals !== null || useObject.ammo !== null) continue;
      const rangeSq = useObject.range * useObject.range;
      const distanceSq = playerPosition.distanceToSquared(useObject.position);
      if (distanceSq > rangeSq) continue;
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearest = useObject;
      }
    }

    this.nearestName = nearest?.name ?? null;

    if (!usePressed || !nearest) return false;

    this.dispatch(nearest, handlers);
    return true;
  }

  /**
   * Un pas fixe de ramassage des trousses de soin (`use_*` portant `soin`),
   * SANS touche : à portée de `HEAL_PICKUP_RADIUS`, la trousse est offerte à
   * `tryHeal`. Elle n'est consommée que si `tryHeal` renvoie `true` — un
   * joueur en pleine forme la laisse au sol pour plus tard, comme dans Doom.
   *
   * @param useObjects Même contrat de fraîcheur que pour `update`.
   */
  collectHeals(
    useObjects: readonly UseObject[],
    playerPosition: THREE.Vector3,
    tryHeal: (amount: number) => boolean,
  ): void {
    this.collectWalkOver(useObjects, playerPosition, (u) => u.heals, tryHeal);
  }

  /** Même contrat que `collectHeals`, pour les boîtes de munitions (`munitions`). */
  collectAmmo(
    useObjects: readonly UseObject[],
    playerPosition: THREE.Vector3,
    tryTake: (amount: number) => boolean,
  ): void {
    this.collectWalkOver(useObjects, playerPosition, (u) => u.ammo, tryTake);
  }

  private collectWalkOver(
    useObjects: readonly UseObject[],
    playerPosition: THREE.Vector3,
    quantite: (useObject: UseObject) => number | null,
    prendre: (amount: number) => boolean,
  ): void {
    const radiusSq = HEAL_PICKUP_RADIUS * HEAL_PICKUP_RADIUS;
    for (const useObject of useObjects) {
      const amount = quantite(useObject);
      if (amount === null || this.consumed.has(useObject.object)) continue;
      if (playerPosition.distanceToSquared(useObject.position) > radiusSq) continue;
      if (!prendre(amount)) continue;
      useObject.object.visible = false;
      this.consumed.add(useObject.object);
    }
  }

  /** Dispatch : d'abord ce que le `.glb` DÉCLARE (cartes de fidélité),
   * ensuite par NOM Blender exact — voir la doc de tête de fichier. */
  private dispatch(useObject: UseObject, handlers: InteractionHandlers): void {
    // Ramassage de carte : autoportant, consommé, comme `use_crowbar`.
    if (useObject.grantsCard) {
      handlers.onCardPickup(useObject.grantsCard, useObject.name);
      useObject.object.visible = false;
      this.consumed.add(useObject.object);
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
      case "use_crowbar":
        handlers.onCrowbarPickup();
        useObject.object.visible = false;
        // Marque consommé : un appui maintenu sur plusieurs pas fixes
        // produit plusieurs fronts `use` distincts, sinon re-déclencherait.
        this.consumed.add(useObject.object);
        break;

      case "use_pistol":
        // Même contrat que `use_crowbar`/`use_shotgun` : autoportant, consommé.
        handlers.onPistolPickup();
        useObject.object.visible = false;
        this.consumed.add(useObject.object);
        break;

      case "use_shotgun":
        // Même contrat que `use_crowbar` (pickup autoportant, pas de `targetName`).
        handlers.onShotgunPickup();
        useObject.object.visible = false;
        this.consumed.add(useObject.object);
        break;

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

      case "use_toilet":
        handlers.onToiletUse();
        break;

      default:
        // Porte libre : jamais consommée, comme une porte à carte — l'appelant
        // ignore un second appui sur une porte déjà ouverte.
        if (useObject.targetName) {
          const message = typeof useObject.extras.message === "string" ? useObject.extras.message : null;
          handlers.onDoorUse(useObject.targetName, message);
        }
        // Nom sans handler reconnu et sans cible : aucun effet, aucun warning.
        // Un `use_*` sans cible a déjà son propre avertissement bruyant émis par
        // `loader.ts` (voir sa doc) — ne pas le dupliquer ici.
        break;
    }
  }
}
