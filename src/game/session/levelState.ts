import type { LightPool } from "../../render/environment/lightPool";
import type { CardPickupBillboard } from "../../render/pickups/cardPickups";
import type { WeaponPickupBillboard } from "../../render/pickups/pickups";
import type { DoorSystem } from "../level/doors/doors";
import type { CameraViewSystem } from "../level/interactions/cameras";
import type { EcranSystem } from "../level/interactions/ecrans";
import type { VitreSystem } from "../level/interactions/vitres";
import type { LevelSpaceData } from "../level/navigation/levelSpaces";
import type { NavGraph } from "../level/navigation/pathfindingTypes";
import type { PropSystem } from "../level/props/props";
import type { SanitaireSystem } from "../level/sanitaires/sanitaires";
import type { ScriptTrigger } from "../level/scripting/levelScript";
import type { HeroLineId } from "./presentation/heroLines";

/**
 * Ce que le niveau CHARGÉ apporte à la partie. Remplacé d'un bloc à chaque
 * chargement validé (premier chargement comme rechargement à chaud) : aucun
 * champ ne peut rester de l'ancien niveau. Vide tant qu'aucun niveau n'est
 * installé, et sur un niveau construit à la main, qui n'y pose que son graphe.
 * see: docs/3-architecture/cycle-de-vie.md#trois-durées-de-vie
 */
export interface LevelState {
  /** Graphe de praticabilité (Jalon M4), recuit à chaque préparation validée — voir `game/session/spawning.ts::loadGltfLevel`. */
  navGraph: NavGraph | null;
  /** Espaces (plan de masse et sous-zones `trig_*`), triés pour `levelSpaceAt` — `null` si le niveau n'en a aucun. */
  spaces: readonly LevelSpaceData[] | null;
  /** Réplique de première visite par espace. */
  placeLines: ReadonlyMap<string, HeroLineId>;
  /** `trig_*` qui lancent un scénario. */
  scriptTriggers: readonly ScriptTrigger[];
  /** Pool de lampes — `null` sans `light_*`. */
  lightPool: LightPool | null;
  // see: docs/archive/systems-physique.md#props-dynamiques
  propSystem: PropSystem | null;
  // see: docs/archive/reference-conventions-nommage.md#portes-animées
  doorSystem: DoorSystem | null;
  // see: docs/archive/reference-conventions-nommage.md#préfixe-vitre
  vitreSystem: VitreSystem | null;
  // see: docs/archive/reference-conventions-nommage.md#préfixe-sanitaire
  sanitaireSystem: SanitaireSystem | null;
  // see: docs/archive/reference-conventions-nommage.md#préfixe-ecran
  ecranSystem: EcranSystem | null;
  /** Vue par caméra (console `use_*`/`cam_*`) : console active, index courant. */
  cameraView: CameraViewSystem | null;
  // see: docs/archive/systems-rendu.md#armes-au-sol-2026-09-25
  weaponPickupBillboards: WeaponPickupBillboard[];
  /** Cartes du niveau, animées à l'affichage. */
  cardPickupBillboards: CardPickupBillboard[];
  secretsTotal: number;
}

export function createEmptyLevelState(): LevelState {
  return {
    navGraph: null,
    spaces: null,
    placeLines: new Map(),
    scriptTriggers: [],
    lightPool: null,
    propSystem: null,
    doorSystem: null,
    vitreSystem: null,
    sanitaireSystem: null,
    ecranSystem: null,
    cameraView: null,
    weaponPickupBillboards: [],
    cardPickupBillboards: [],
    secretsTotal: 0,
  };
}
