import type { Scenario } from "../scripting/levelScript";

export const METRO_ENCOUNTER_EVENTS = {
  metro_quartier: [{ delay: 0, action: { kind: "reveiller", groupe: "metro_quartier" } }],
  metro_billets: [
    {
      delay: 0,
      action: {
        kind: "annonce",
        speaker: "MUE · SÉCURITÉ",
        text: "Titre de transport et caméra éteinte, s’il vous plaît.",
      },
    },
    { delay: 1.2, action: { kind: "reveiller", groupe: "metro_billets_tireurs" } },
    { delay: 0, action: { kind: "reveiller", groupe: "metro_billets_garde" } },
  ],
  metro_quais_sud: [{ delay: 0, action: { kind: "reveiller", groupe: "metro_quais_sud" } }],
  metro_quais_nord: [
    { delay: 0, action: { kind: "reveiller", groupe: "metro_quais_nord" } },
    { delay: 0, action: { kind: "reveiller", groupe: "metro_quais_garde" } },
  ],
  metro_galerie_entree: [{ delay: 0.5, action: { kind: "reveiller", groupe: "metro_galerie_entree" } }],
  metro_galerie_coude: [{ delay: 0.5, action: { kind: "reveiller", groupe: "metro_galerie_coude" } }],
  metro_galerie_retour: [{ delay: 0.5, action: { kind: "reveiller", groupe: "metro_galerie_retour" } }],
  metro_depot: [
    { delay: 0, action: { kind: "reveiller", groupe: "metro_depot_tireurs" } },
    { delay: 0, action: { kind: "reveiller", groupe: "metro_depot_garde" } },
  ],
  metro_acces_poste: [{ delay: 0, action: { kind: "reveiller", groupe: "metro_acces_poste" } }],
  metro_machinerie: [
    { delay: 0, action: { kind: "reveiller", groupe: "metro_machinerie_tireurs" } },
    { delay: 1, action: { kind: "reveiller", groupe: "metro_machinerie_meute" } },
  ],
  metro_rame_1_nord: [
    {
      delay: 0,
      action: { kind: "annonce", speaker: "À BORD", text: "Quelque chose gratte à l’autre bout de la rame." },
    },
    { delay: 0.25, action: { kind: "reveiller", groupe: "metro_rame_1_nord", alerte: true } },
  ],
  metro_rame_1_sud: [
    {
      delay: 0,
      action: { kind: "annonce", speaker: "À BORD", text: "Quelque chose gratte à l’autre bout de la rame." },
    },
    { delay: 0.25, action: { kind: "reveiller", groupe: "metro_rame_1_sud", alerte: true } },
  ],
  metro_rame_2_nord: [
    { delay: 0, action: { kind: "annonce", speaker: "À BORD", text: "Ça recommence. La rame n’est pas vide." } },
    { delay: 0.25, action: { kind: "reveiller", groupe: "metro_rame_2_nord", alerte: true } },
  ],
  metro_rame_2_sud: [
    { delay: 0, action: { kind: "annonce", speaker: "À BORD", text: "Ça recommence. La rame n’est pas vide." } },
    { delay: 0.25, action: { kind: "reveiller", groupe: "metro_rame_2_sud", alerte: true } },
  ],
  metro_arrivee: [{ delay: 0, action: { kind: "reveiller", groupe: "metro_arrivee" } }],
  metro_parvis: [
    { delay: 0, action: { kind: "reveiller", groupe: "metro_parvis_tireurs" } },
    { delay: 0, action: { kind: "reveiller", groupe: "metro_parvis_garde" } },
  ],
} as const satisfies Record<string, Scenario>;

export type MetroEncounterEvent = keyof typeof METRO_ENCOUNTER_EVENTS;
