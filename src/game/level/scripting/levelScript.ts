import type { EcranChaine } from "../interactions/ecrans";

// see: docs/decisions/0037-script-de-niveau.md

export type ScriptAction =
  /** Réplique du héros, par son identifiant (`heroLines.ts`). */
  | { readonly kind: "replique"; readonly id: string }
  /** Annonce des haut-parleurs ou de l'interphone, sur son propre canal texte. */
  | { readonly kind: "annonce"; readonly speaker: string; readonly text: string }
  /** Fait apparaître les ennemis dont le point d'apparition porte ce `groupe`. */
  | { readonly kind: "reveiller"; readonly groupe: string }
  /** Passe sur `chaine` les `ecran_*` dont le nom commence par `ecrans`. */
  | { readonly kind: "chaine"; readonly ecrans: string; readonly chaine: EcranChaine };

export interface ScriptStep {
  /** Secondes de gameplay à attendre après l'étape précédente. */
  readonly delay: number;
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
}

/** État de partie du script : il survit à un hot reload du niveau. */
export interface LevelScriptState {
  /** Noms des `trig_*` déjà franchis CETTE partie. */
  readonly fired: Set<string>;
  readonly running: RunningScenario[];
}

export function createLevelScriptState(): LevelScriptState {
  return { fired: new Set(), running: [] };
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
 * délai, comptés en temps de gameplay.
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
    if (steps) state.running.push({ steps, next: 0, elapsed: 0 });
  }

  for (let i = state.running.length - 1; i >= 0; i--) {
    const scenario = state.running[i]!;
    scenario.elapsed += dt;
    while (scenario.next < scenario.steps.length && scenario.elapsed >= scenario.steps[scenario.next]!.delay) {
      const step = scenario.steps[scenario.next]!;
      scenario.elapsed -= step.delay;
      scenario.next++;
      run(step.action);
    }
    if (scenario.next >= scenario.steps.length) state.running.splice(i, 1);
  }
}
