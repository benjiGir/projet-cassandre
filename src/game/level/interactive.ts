import * as THREE from "three";

import type { UseObject } from "./loader";

/**
 * Système d'interaction (`use_*`) — Phase 5, premier slice (Zone A
 * "Parking"). Voir le skill `gltf-level-conventions` pour le contrat de
 * nommage complet et `loader.ts` pour la construction de `UseObject`
 * (portée, position monde, `targetName`).
 *
 * DISCIPLINE DE DÉTERMINISME : `update()` doit être appelé UNE FOIS PAR PAS
 * FIXE, jamais au taux d'affichage — même contrat que `weapons.update`/
 * `suitManager.update` dans `main.ts`. La détection de proximité et le
 * déclenchement dépendent de `player.position` (avancée par `player.update`
 * ce pas-ci) et du front `use` consommé une seule fois par
 * `InputFrame.use` (voir `core/inputRecorder.ts`) : les rejouer au taux
 * d'affichage romprait le rejeu F9/F10 exactement comme pour les armes.
 *
 * DISPATCH PAR NOM, pas par `targetName` : `use_crowbar`/`use_shotgun` sont
 * des pickups autoportants (aucune cible dans leurs `extras`). `use_exit_door`
 * (Zone E, porte à badge) et `use_frozen_storage` (Zone B, secret 1, porte
 * SANS condition) référencent chacun un `door_*` via `targetName`, mais le
 * dispatch reste par nom exact d'objet Blender, pas par un système générique
 * indexé sur `targetName` — deux cas concrets, pas encore la douleur de
 * duplication qui justifierait une généralisation (invariant #8/#9).
 */

/** Un appelant `main.ts` fournit une callback par effet nommé reconnu. Étendre cette interface au fur et à mesure que de nouveaux `use_*` nommés gagnent un effet — jamais un système générique de callbacks indexé par nom. */
export interface InteractionHandlers {
  /** `use_crowbar` : ramasse le pied-de-biche. Appelle `weapons.pickUpMelee()` côté `main.ts`. */
  onCrowbarPickup(): void;
  /** `use_shotgun` : ramasse le pompe (niveau complet, Zone B). Appelle `weapons.pickUpShotgun()` côté `main.ts`. */
  onShotgunPickup(): void;
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
}

export class InteractionSystem {
  /**
   * Objets `use_*` déjà consommés, PAR RÉFÉRENCE DE MESH (`THREE.Object3D`),
   * pas par nom. Effet de bord SOUHAITÉ, documenté ici plutôt que résolu
   * (même discipline que le cas non résolu et documenté dans
   * `hotReload.ts` — joueur embarqué dans un mur fraîchement apparu) :
   * `hotReload.ts` REMPLACE tout `LevelHandle` (donc tout `UseObject`, donc
   * tout mesh) à chaque rechargement. Un `use_crowbar` déjà ramassé avant un
   * hot reload devient, après coup, un objet ENTIÈREMENT NOUVEAU — absent de
   * ce `WeakSet` — donc redevient visuellement présent et re-déclenchable.
   * Cas limite dev-only (itération Blender), pas un bug de la version jouée
   * (un niveau ne se recharge jamais à chaud en dehors du pipeline de dev).
   */
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
   */
  update(
    usePressed: boolean,
    useObjects: readonly UseObject[],
    playerPosition: THREE.Vector3,
    handlers: InteractionHandlers,
  ): void {
    let nearest: UseObject | null = null;
    let nearestDistanceSq = Infinity;

    for (const useObject of useObjects) {
      if (this.consumed.has(useObject.object)) continue;
      const rangeSq = useObject.range * useObject.range;
      const distanceSq = playerPosition.distanceToSquared(useObject.position);
      if (distanceSq > rangeSq) continue;
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearest = useObject;
      }
    }

    this.nearestName = nearest?.name ?? null;

    if (!usePressed || !nearest) return;

    this.dispatch(nearest, handlers);
  }

  /** Dispatch par NOM Blender exact — voir la doc de tête de fichier. */
  private dispatch(useObject: UseObject, handlers: InteractionHandlers): void {
    switch (useObject.name) {
      case "use_crowbar":
        handlers.onCrowbarPickup();
        useObject.object.visible = false;
        // Marque l'objet consommé pour ne pas re-déclencher indéfiniment
        // tant que le joueur reste à portée avec la touche maintenue (`use`
        // est un front consommé côté InputRecorder, mais rester APPUYÉ sur
        // plusieurs pas fixes distincts produit plusieurs fronts distincts).
        this.consumed.add(useObject.object);
        break;

      case "use_shotgun":
        // Même contrat exact que `use_crowbar` ci-dessus (pickup autoportant,
        // pas de `targetName`).
        handlers.onShotgunPickup();
        useObject.object.visible = false;
        this.consumed.add(useObject.object);
        break;

      case "use_exit_door":
        // PAS marqué consommé, contrairement aux pickups ci-dessus : un
        // essai refusé (pas de badge) doit rester réessayable tant que le
        // joueur reste à portée, et `main.ts` a sa propre garde pour ignorer
        // un ré-essai une fois la porte déjà déverrouillée.
        handlers.onExitDoorUse(useObject.targetName ?? useObject.name);
        break;

      case "use_frozen_storage":
        // Même non-consommation que `use_exit_door` : `main.ts` a sa propre
        // garde (`unlockedDoors`) pour ignorer un ré-essai une fois ouverte.
        handlers.onFrozenStorageUse(useObject.targetName ?? useObject.name);
        break;

      case "use_pa_mic":
        handlers.onPaMicUse();
        break;

      case "use_toilet":
        handlers.onToiletUse();
        break;

      default:
        // Nom sans handler reconnu : aucun effet, aucun warning. Un `use_*`
        // sans cible a déjà son propre avertissement bruyant émis par
        // `loader.ts` (voir sa doc) — ne pas le dupliquer ici.
        break;
    }
  }
}
