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

/**
 * Callbacks du ramassage AUTOMATIQUE des armes au sol (`use_crowbar`,
 * `use_shotgun`, `use_pistol`), voir `InteractionSystem.collectWeapons` —
 * même mécanique « marcher dessus » que `collectHeals`/`collectAmmo`,
 * jamais la touche E (elle lui volerait l'appui, voir `update()`).
 *
 * Chaque callback tente le ramassage et retourne s'il faut faire disparaître
 * l'objet du monde : `true` consomme (comme `collectHeals` quand `tryHeal`
 * accepte), `false` le laisse au sol pour plus tard (comme une trousse sur un
 * joueur à PV pleins). La décision « déjà possédée » vit côté appelant, qui
 * seul connaît l'inventaire (`WeaponSystem`) — ce système-ci ne fait que de
 * la géométrie et de la consommation.
 */
export interface WeaponPickupHandlers {
  /** `use_crowbar`. Le pied-de-biche n'a pas de munitions : un joueur qui
   * l'a déjà n'a rien à en tirer, l'appelant renvoie alors `false` et
   * l'objet reste au sol indéfiniment (voir `docs/systems/armes.md`). */
  onCrowbarPickup(): boolean;
  /** `use_shotgun`. Même contrat que `onCrowbarPickup` — le pompe garde sa
   * dotation unique (aucun mécanisme de recharge n'existe pour lui), donc un
   * second ramassage n'a également rien à offrir : `false`, reste au sol. */
  onShotgunPickup(): boolean;
  /** `use_pistol`. Seule arme des trois qui PEUT rendre `true` alors
   * qu'elle était déjà possédée : l'appelant lui fait alors jouer le rôle
   * d'une boîte de munitions (même dotation que le premier ramassage),
   * `false` seulement si le joueur est déjà au plafond de munitions. */
  onPistolPickup(): boolean;
}

/** Distance entre le centre de capsule du joueur et le centre d'un ramassage
 * au sol (trousse, boîte de munitions, arme) sous laquelle il est pris,
 * mètres. Le centre de capsule est à ~0,9 m du sol et la boîte à ~0,25 m :
 * 1,2 m laisse environ 1 m à l'horizontale, soit « marcher dessus » sans
 * devoir viser la boîte au centimètre. Les armes au sol partagent cette même
 * géométrie de boîte (voir `gltf-level-conventions`) : aucune raison de leur
 * donner un rayon différent. */
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

  /**
   * Un pas fixe de ramassage des armes au sol (`use_crowbar`, `use_shotgun`,
   * `use_pistol`), SANS touche — même mécanique que `collectHeals`/
   * `collectAmmo`, mais par NOM Blender exact plutôt que par une quantité
   * déclarée dans le `.glb` : ces trois noms sont câblés en dur, comme dans
   * l'ancien `dispatch()` par touche E qu'ils remplacent ici.
   *
   * @param useObjects Même contrat de fraîcheur que pour `update`.
   * @param handlers Voir `WeaponPickupHandlers` — chaque callback décide
   *   lui-même (déjà possédée ou non) et retourne si l'objet doit disparaître.
   */
  collectWeapons(
    useObjects: readonly UseObject[],
    playerPosition: THREE.Vector3,
    handlers: WeaponPickupHandlers,
  ): void {
    const radiusSq = HEAL_PICKUP_RADIUS * HEAL_PICKUP_RADIUS;
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
      // `use_crowbar`/`use_shotgun`/`use_pistol` ne passent plus ici : ils se
      // ramassent en marchant dessus (`collectWeapons`), jamais à la touche E
      // — voir `isWeaponPickupName`, qui les retire de `nearest` dans
      // `update()` avant que `dispatch` ne soit jamais appelé pour eux.

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
