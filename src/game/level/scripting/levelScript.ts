import type { EcranChaine } from "../interactions/ecrans";

// see: docs/decisions/0037-script-de-niveau.md

export type ScriptAction =
  /** Réplique du héros, par son identifiant (`heroLines.ts`). */
  | { readonly kind: "replique"; readonly id: string }
  /** Annonce des haut-parleurs ou de l'interphone, sur son propre canal texte ; `voix` est la clé de sa prise, si elle en a une. */
  | { readonly kind: "annonce"; readonly speaker: string; readonly text: string; readonly voix?: string }
  /** Fait apparaître les ennemis dont le point d'apparition porte ce `groupe`. */
  | { readonly kind: "reveiller"; readonly groupe: string }
  /** Passe sur `chaine` les `ecran_*` dont le nom commence par `ecrans`. */
  | { readonly kind: "chaine"; readonly ecrans: string; readonly chaine: EcranChaine }
  /** Ferme ces `door_*` et les tient fermées : une arène. */
  | { readonly kind: "verrouiller"; readonly portes: readonly string[] }
  /** Rend ces `door_*` à leur état d'avant le verrou. */
  | { readonly kind: "deverrouiller"; readonly portes: readonly string[] };

/** Attente d'une étape : un groupe réveillé doit être tombé. */
export interface ScriptGate {
  readonly groupe: string;
  /** Secondes de gameplay au bout desquelles l'étape part quand même : un ennemi coincé hors d'atteinte ne doit jamais enfermer le joueur. */
  readonly auPlusTard: number;
}

export interface ScriptStep {
  /** Secondes de gameplay à attendre après l'étape précédente — ou, avec `apres`, après la chute du groupe. */
  readonly delay: number;
  readonly apres?: ScriptGate;
  readonly action: ScriptAction;
}

export type Scenario = readonly ScriptStep[];

/** Volume déclencheur vu par le script : un `trig_*` qui porte `evenement`. */
export interface ScriptTrigger {
  readonly name: string;
  readonly event: string;
  readonly min: { readonly x: number; readonly y: number; readonly z: number };
  readonly max: { readonly x: number; readonly y: number; readonly z: number };
}

interface RunningScenario {
  readonly steps: Scenario;
  next: number;
  /** Temps de gameplay écoulé depuis l'étape précédente. */
  elapsed: number;
  /** Temps passé à attendre la chute du groupe de l'étape courante. */
  waited: number;
  /** Le groupe attendu par l'étape courante est tombé (ou son attente a expiré). */
  gateOpen: boolean;
}

/** Ce que le script retient d'un ennemi réveillé : seulement s'il vit encore. */
export interface WokenEnemy {
  readonly isAlive: boolean;
}

/** État de partie du script : il survit à un hot reload du niveau. */
export interface LevelScriptState {
  /** Noms des `trig_*` déjà franchis CETTE partie. */
  readonly fired: Set<string>;
  readonly running: RunningScenario[];
  /** Ennemis réveillés CETTE partie, par groupe — voir `ScriptGate`. */
  readonly woken: Map<string, WokenEnemy[]>;
}

export function createLevelScriptState(): LevelScriptState {
  return { fired: new Set(), running: [], woken: new Map() };
}

/** Un groupe est tombé quand tous ses ennemis réveillés sont morts. Un groupe jamais réveillé n'attend personne. */
export function isGroupDown(state: LevelScriptState, groupe: string): boolean {
  return (state.woken.get(groupe) ?? []).every((enemy) => !enemy.isAlive);
}

function contains(trigger: ScriptTrigger, p: { readonly x: number; readonly y: number; readonly z: number }): boolean {
  return (
    p.x >= trigger.min.x && p.x <= trigger.max.x &&
    p.y >= trigger.min.y && p.y <= trigger.max.y &&
    p.z >= trigger.min.z && p.z <= trigger.max.z
  );
}

/**
 * Un pas fixe du script. Un déclencheur franchi lance son scénario une seule
 * fois par partie ; les étapes s'exécutent dans l'ordre, chacune après son
 * délai, comptés en temps de gameplay. Une étape `apres` attend d'abord que
 * son groupe soit tombé.
 */
export function updateLevelScript(
  state: LevelScriptState,
  triggers: readonly ScriptTrigger[],
  scenarios: Readonly<Record<string, Scenario>>,
  dt: number,
  player: { readonly x: number; readonly y: number; readonly z: number },
  run: (action: ScriptAction) => void,
): void {
  for (const trigger of triggers) {
    if (state.fired.has(trigger.name) || !contains(trigger, player)) continue;
    state.fired.add(trigger.name);
    const steps = scenarios[trigger.event];
    if (steps) state.running.push({ steps, next: 0, elapsed: 0, waited: 0, gateOpen: false });
  }

  for (let i = state.running.length - 1; i >= 0; i--) {
    const scenario = state.running[i]!;
    scenario.elapsed += dt;
    while (scenario.next < scenario.steps.length) {
      const step = scenario.steps[scenario.next]!;
      if (step.apres && !scenario.gateOpen) {
        if (!isGroupDown(state, step.apres.groupe) && scenario.waited < step.apres.auPlusTard) {
          scenario.waited += dt;
          break;
        }
        // Le délai de l'étape court à partir de la chute du groupe.
        scenario.gateOpen = true;
        scenario.elapsed = 0;
      }
      if (scenario.elapsed < step.delay) break;
      scenario.elapsed -= step.delay;
      scenario.next++;
      scenario.waited = 0;
      scenario.gateOpen = false;
      run(step.action);
    }
    if (scenario.next >= scenario.steps.length) state.running.splice(i, 1);
  }
}
