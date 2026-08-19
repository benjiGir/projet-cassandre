import * as THREE from "three";

/**
 * Bascule wireframe à chaud sur TOUTE la géométrie de la scène rendue — outil
 * de debug pour repérer à l'œil le pavage des boîtes et les jonctions d'un
 * niveau construit à la main (`game/level/gym.ts`), pas une feature de jeu.
 *
 * MÉTHODE, contrainte par le skill `build-engine-look` : on bascule
 * `material.wireframe` sur les matériaux DÉJÀ présents dans la scène, rien
 * d'autre. Pas de matériau de remplacement, pas de couche de post-processing
 * séparée, pas de shader dédié — le wireframe s'obtient sur le pipeline
 * existant ou pas du tout.
 *
 * `scene.traverse` couvre tout le graphe, y compris les enfants de la caméra
 * (le viewmodel, voir `render/viewmodel.ts`) puisque la caméra elle-même est
 * ajoutée à `scene` dans `main.ts` — donc "toute la géométrie rendue" au sens
 * strict, sans avoir à faire passer un flag zone par zone dans `gym.ts`.
 *
 * Limite ASSUMÉE : seuls les matériaux présents dans la scène AU MOMENT du
 * toggle sont couverts. Un objet ajouté après coup (particule d'impact,
 * douille — voir `render/fx.ts`) démarre non wireframe. Sans conséquence pour
 * l'usage visé (géométrie statique du niveau + balle témoin), et évite
 * d'accrocher ce module à la création de matériaux ailleurs dans le moteur.
 *
 * Restreint volontairement à `MeshLambertMaterial` (invariant #5) : ce n'est
 * pas qu'une contrainte de style, c'est un garde-fou passif — un `Mesh` dont
 * le matériau n'est PAS Lambert est ignoré et signalé une fois en console,
 * ce qui ne devrait jamais arriver dans ce projet.
 */
export function createWireframeToggle(scene: THREE.Scene) {
  let enabled = false;
  let warnedNonLambert = false;

  function apply(value: boolean) {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshLambertMaterial) {
          material.wireframe = value;
        } else if (!warnedNonLambert) {
          warnedNonLambert = true;
          console.warn(
            `[debugView] mesh "${obj.name || obj.uuid}" a un matériau non-Lambert ` +
              `(${material.type}) — invariant #5 potentiellement violé, wireframe non appliqué dessus.`,
          );
        }
      }
    });
  }

  return {
    get enabled() {
      return enabled;
    },
    /** Bascule l'état et l'applique immédiatement à tout ce qui est actuellement dans la scène. */
    toggle(): boolean {
      enabled = !enabled;
      apply(enabled);
      return enabled;
    },
  };
}
