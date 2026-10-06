import type { Scenario } from "../scripting/levelScript";

export const METRO_TRAIN_EVENTS: Readonly<Record<string, Scenario>> = {
  metro_tunnel: [
    { delay: 0, action: { kind: "annonce", speaker: "Régulation", text: "Voie de service active. Utilisez les refuges." } },
    { delay: 0, action: { kind: "train", voie: "B", commande: "pass" } },
  ],
};
