import * as THREE from "three";

/**
 * Pool de lampes — seules les N lampes les plus « proches » du joueur restent
 * allumées, les autres sont éteintes.
 *
 * Pourquoi ce n'est pas une optimisation opportuniste mais une nécessité :
 * three.js évalue TOUTES les lampes visibles par fragment, sous forme
 * d'uniformes. Au-delà d'un certain compte, le shader dépasse
 * `MAX_FRAGMENT_UNIFORM_VECTORS` et **ne compile plus du tout** — la géométrie
 * disparaît, sans autre signe qu'une ligne en console. Mesuré sur la machine
 * de développement : le mur tombe à 255 lampes ; sur une machine conforme au
 * minimum de la spécification WebGL 2, il peut tomber vers la cinquantaine.
 * Le niveau v2 en demanderait environ 1 140 à la densité de la salle d'essai.
 *
 * see: docs/decisions/0026-visibilite-par-espace-et-pool-de-lampes.md
 * see: docs/systems/cout-de-rendu.md
 */

/**
 * Lampes allumées simultanément. 48 : trois fois sous le mur mesuré ici, sous
 * le mur d'une machine minimale, et environ 1,5 ms d'éclairage.
 */
export const LIGHT_POOL_BUDGET = 48;

/**
 * Distance parcourue par la caméra avant de rejuger quelle lampe est proche.
 * Rejuger à chaque image serait un tri de plusieurs centaines d'éléments au
 * taux d'affichage pour un résultat quasi identique ; 2 m valent au pire un
 * tiers de seconde de retard en pleine course, sur la lampe la plus LOINTAINE
 * du lot — celle dont l'extinction ne se voit pas.
 */
const REEVALUATION_DISTANCE = 2.0;

export interface LightPoolStats {
  /** Lampes du niveau, allumées ou non. */
  readonly total: number;
  /** Lampes réellement allumées. */
  readonly actives: number;
  /** Budget appliqué, `null` si le pool est désactivé (tout est allumé). */
  readonly budget: number | null;
}

interface Entry {
  readonly light: THREE.PointLight;
  score: number;
}

/**
 * Le critère n'est pas la distance à la lampe mais la distance au bord de sa
 * sphère d'influence (`distance - light.distance`) : une grande lampe lointaine
 * éclaire peut-être ce que le joueur regarde, une petite lampe à la même
 * distance non. Une lampe de portée nulle est illimitée côté three.js — elle
 * n'est donc jamais éteinte.
 */
function score(light: THREE.PointLight, cameraPosition: THREE.Vector3): number {
  if (light.distance <= 0) return -Infinity;
  return light.position.distanceTo(cameraPosition) - light.distance;
}

function byScore(a: Entry, b: Entry): number {
  return a.score - b.score;
}

export class LightPool {
  /** Réutilisé à chaque réévaluation : trié en place, jamais réalloué. */
  private readonly entries: Entry[];
  private budget: number | null;
  private readonly lastEvaluatedAt = new THREE.Vector3();
  private evaluated = false;
  private actives: number;

  constructor(lights: readonly THREE.PointLight[], budget: number | null = LIGHT_POOL_BUDGET) {
    this.entries = lights.map((light) => ({ light, score: 0 }));
    this.budget = budget;
    this.actives = this.entries.length;
  }

  get stats(): LightPoolStats {
    return { total: this.entries.length, actives: this.actives, budget: this.budget };
  }

  /**
   * Change le budget (`null` = tout allumer). Force une réévaluation immédiate
   * au prochain `update` : sans ça, un changement de budget depuis la console
   * resterait sans effet tant que le joueur ne bouge pas.
   */
  setBudget(budget: number | null): void {
    this.budget = budget;
    this.evaluated = false;
  }

  /**
   * Appelé au taux d'affichage, pas au pas fixe : c'est la position de la
   * caméra qui décide, et elle est lue à l'affichage (invariant #3). Sort
   * immédiatement tant que rien n'a bougé assez pour changer le classement.
   */
  update(cameraPosition: THREE.Vector3): void {
    if (this.budget !== null && this.entries.length <= this.budget) {
      // Le pool ne sert à rien sur ce niveau : tout allumer une fois, puis ne
      // plus jamais rien faire.
      if (!this.evaluated) this.lightAll();
      return;
    }
    if (this.evaluated && this.lastEvaluatedAt.distanceTo(cameraPosition) < REEVALUATION_DISTANCE) return;

    this.evaluated = true;
    this.lastEvaluatedAt.copy(cameraPosition);

    if (this.budget === null) {
      this.lightAll();
      return;
    }

    for (const entry of this.entries) entry.score = score(entry.light, cameraPosition);
    this.entries.sort(byScore);
    for (let i = 0; i < this.entries.length; i++) this.entries[i]!.light.visible = i < this.budget;
    this.actives = Math.min(this.budget, this.entries.length);
  }

  private lightAll(): void {
    for (const entry of this.entries) entry.light.visible = true;
    this.actives = this.entries.length;
    this.evaluated = true;
  }
}
