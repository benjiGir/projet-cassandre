import * as THREE from "three";

/**
 * Élagage par distance des objets interactifs (`use_*`) — trousses, boîtes de
 * munitions, cartes, armes au sol, lecteurs de carte, boutons.
 *
 * Pourquoi : un `use_*` ne rejoint jamais le décor fusionné (il doit pouvoir
 * disparaître seul quand on le ramasse), et three.js n'élimine que par le cône
 * de vue. Les vingt-et-un ramassages du niveau v2 étaient donc dessinés
 * ensemble depuis n'importe quel point dégagé — mesuré depuis les caisses le
 * 2026-09-19, dont une trousse à 150 m, large de deux pixels à 640×360. Même
 * constat et même remède que pour les `prop_*` ([ADR 0030](../../docs/decisions/0030-props-dynamiques.md)) :
 * ce qui compte n'est pas le nombre d'objets mais leur densité locale.
 *
 * Ne RALLUME que ce qu'il a lui-même éteint : un ramassage consommé reste
 * invisible pour toujours (`interactive.ts` le cache et le marque consommé),
 * et ce n'est pas à cet élagage d'en décider.
 */

/**
 * Portée de rendu, mètres. Plus généreuse que les 36 m des props : une trousse
 * ou une caisse de munitions est un SIGNAL de jeu, qu'on repère de loin dans
 * un couloir, alors qu'un carton n'est qu'un décor qui bouge.
 * see: docs/systems/cout-de-rendu.md
 */
export const USE_RENDER_DISTANCE = 48;
const USE_RENDER_DISTANCE_SQ = USE_RENDER_DISTANCE * USE_RENDER_DISTANCE;

/** Ce que l'élagage a besoin de connaître d'un `use_*` — sous-ensemble de `UseObject` (`game/level/loader.ts`). */
export interface CullableUseObject {
  object: THREE.Object3D;
  /** Position MONDE, figée au chargement (un `use_*` ne bouge pas). */
  position: THREE.Vector3;
}

export class UseObjectCulling {
  /** Ceux que CET élagage a éteints — jamais ceux qu'un ramassage a consommés. */
  private readonly eteints = new WeakSet<THREE.Object3D>();

  /** Taux d'affichage, après le bloc caméra (il lui faut la position de CETTE frame). */
  update(useObjects: readonly CullableUseObject[], cameraPosition: THREE.Vector3): void {
    for (const useObject of useObjects) {
      const loin = cameraPosition.distanceToSquared(useObject.position) > USE_RENDER_DISTANCE_SQ;
      if (loin) {
        if (!useObject.object.visible) continue;
        useObject.object.visible = false;
        this.eteints.add(useObject.object);
        continue;
      }
      if (!this.eteints.has(useObject.object)) continue;
      useObject.object.visible = true;
      this.eteints.delete(useObject.object);
    }
  }
}
