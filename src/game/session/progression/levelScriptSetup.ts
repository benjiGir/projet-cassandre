import type { NamedSpawn, TriggerVolume } from "../../level/loading/levelTypes";
import type { LevelSpaceData } from "../../level/navigation/levelSpaces";
import type { Scenario, ScriptTrigger } from "../../level/scripting/levelScript";
import type { TrainLaneDef } from "../../level/trains/trainTypes";
import { HERO_LINES, PLACE_LINES, type HeroLineId } from "../presentation/heroLines";

// see: docs/decisions/0037-script-de-niveau.md

export interface LevelScriptSetup {
  /** `trig_*` portant `evenement` : ils lancent un scénario. */
  readonly triggers: ScriptTrigger[];
  /** `trig_*` portant `replique` : des sous-zones, traitées comme les espaces du plan de masse. */
  readonly placeSpaces: LevelSpaceData[];
  /** Réplique de première visite par espace : plan de masse, puis sous-zones. */
  readonly placeLines: Map<string, HeroLineId>;
  /** Incohérences entre le niveau et le script, à signaler bruyamment. */
  readonly problems: string[];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function isHeroLine(id: string): id is HeroLineId {
  return Object.hasOwn(HERO_LINES, id);
}

/**
 * Lit les `trig_*` d'un niveau contre les scénarios connus. Ne modifie rien :
 * un déclencheur invalide est écarté et signalé, jamais bloquant.
 */
export function readLevelScript(
  triggers: readonly TriggerVolume[],
  spawns: readonly NamedSpawn[],
  ecranNames: readonly string[],
  scenarios: Readonly<Record<string, Scenario>>,
  doorNames: readonly string[] = [],
  trainLanes: readonly TrainLaneDef[] = [],
): LevelScriptSetup {
  const setup: LevelScriptSetup = {
    triggers: [],
    placeSpaces: [],
    placeLines: new Map(Object.entries(PLACE_LINES)),
    problems: [],
  };

  for (const trigger of triggers) {
    const event = text(trigger.extras.evenement);
    const line = text(trigger.extras.replique);
    if (event === null && line === null) {
      setup.problems.push(`"${trigger.name}" (trig_*) ne porte ni "evenement" ni "replique" : il ne fait rien.`);
    }
    if (event !== null) {
      if (Object.hasOwn(scenarios, event)) {
        setup.triggers.push({ name: trigger.name, event, min: trigger.min, max: trigger.max });
      } else {
        setup.problems.push(
          `"${trigger.name}" (trig_*) : "evenement" = "${event}" n'est pas un scénario connu (${Object.keys(scenarios).join(", ")}).`,
        );
      }
    }
    if (line !== null) {
      if (isHeroLine(line)) {
        setup.placeSpaces.push({
          id: trigger.name,
          x: [trigger.min.x, trigger.max.x],
          y: [trigger.min.y, trigger.max.y],
          z: [trigger.min.z, trigger.max.z],
        });
        setup.placeLines.set(trigger.name, line);
      } else {
        setup.problems.push(`"${trigger.name}" (trig_*) : "replique" = "${line}" n'est pas une réplique du héros.`);
      }
    }
  }

  const groups = new Set(spawns.flatMap((spawn) => (spawn.group === null ? [] : [spawn.group])));
  const woken = new Set<string>();
  for (const [event, steps] of Object.entries(scenarios) as [string, Scenario][]) {
    for (const { action } of steps) {
      if (action.kind === "train") {
        const lane = trainLanes.find((candidate) => candidate.id === action.voie);
        if (!lane) setup.problems.push("Scénario " + event + " : voie de train absente " + action.voie + ".");
        else if (action.trajet && !lane.routes.some((route) => route.id === action.trajet))
          setup.problems.push("Scénario " + event + " : trajet absent " + action.trajet + ".");
      }
      if (action.kind === "reveiller") {
        woken.add(action.groupe);
        if (!groups.has(action.groupe)) {
          setup.problems.push(`Scénario "${event}" : aucun spawn_suit_* ne porte le groupe "${action.groupe}".`);
        }
      }
      if (action.kind === "chaine" && !ecranNames.some((name) => name.startsWith(action.ecrans))) {
        setup.problems.push(`Scénario "${event}" : aucun ecran_* ne commence par "${action.ecrans}".`);
      }
      if (action.kind === "verrouiller" || action.kind === "deverrouiller") {
        for (const porte of action.portes) {
          if (!doorNames.includes(porte)) {
            setup.problems.push(`Scénario "${event}" : la porte "${porte}" n'existe pas dans le niveau.`);
          }
        }
      }
    }
    for (const step of steps) {
      if (step.apres && !groups.has(step.apres.groupe)) {
        setup.problems.push(`Scénario "${event}" : attend le groupe "${step.apres.groupe}", qu'aucun spawn ne porte.`);
      }
    }
  }
  for (const group of groups) {
    if (!woken.has(group)) {
      setup.problems.push(`Groupe "${group}" : aucun scénario ne le réveille, ses ennemis n'apparaîtront jamais.`);
    }
  }
  return setup;
}
