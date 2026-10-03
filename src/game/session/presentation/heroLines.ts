// see: docs/6-reference/notes-code-gameplay.md#feedback-et-récap

/** Graine du tirage des répliques occasionnelles (`GameSession.heroLineRandom`) — famille
 * `SHOTGUN_SPREAD_SEED`/`BASE_SUIT_SEED`, jamais dérivée de `Math.random()`/`Date.now()`. */
export const HERO_LINE_SEED = 0x50111e77;

export interface HeroLineDef {
  readonly text: string;
  /** Passe outre le délai entre répliques et coupe celle en cours. */
  readonly priority?: boolean;
  /** Une seule fois par partie. */
  readonly once?: boolean;
  /** Probabilité de la dire quand le délai le permet. Défaut 1. */
  readonly chance?: number;
}

export const HERO_LINES = {
  // Départ et fin
  depart: { text: "Ce soir, on vérifie les rumeurs.", priority: true, once: true },
  nouvelle_tentative: { text: "Cette fois, je connais les pièges.", priority: true, once: true },
  mort_hero: { text: "J'étais pourtant si près.", priority: true, once: true },

  // Armes, munitions, soins, nourriture
  arme_pied_biche: { text: "Ça ouvre les portes. Et les discussions.", priority: true, once: true },
  arme_pistolet: { text: "Là, ils vont m'écouter.", priority: true, once: true },
  arme_pompe: { text: "Ça, c'est pour les gros dossiers.", priority: true, once: true },
  arme_double: { text: "J'ai déjà ce qu'il faut.", once: true },
  munitions_24: { text: "De quoi poursuivre la conversation.", chance: 0.5 },
  munitions_36: { text: "Voilà une réserve sérieuse.", chance: 0.5 },
  cache_gaine: { text: "Ils ravitaillent même les conduits.", once: true },
  soin_plein: { text: "Ça va. Pour l'instant.", once: true },
  manger_sandwich: { text: "Je préfère pas lire les ingrédients." },
  manger_pizza: { text: "Le vigile avait bon goût.", once: true },

  // Cartes et portes
  carte_argent: { text: "L'Argent ouvre la réserve. Intéressant.", priority: true, once: true },
  carte_or: { text: "L'Or. Ils aiment vraiment leurs privilèges.", priority: true, once: true },
  carte_platine: { text: "La Platine. Mon billet de sortie.", priority: true, once: true },
  photomaton_ouvre: { text: "Belle photo. Drôle de fond.", once: true },
  raccourci_coupe_feu: { text: "Voilà qui évitera le grand tour.", once: true },

  // Interactions
  micro_annonces: { text: "Chers clients, les reptiliens sont rappelés en caisse." },
  pointeuse: { text: "Je pointe. Vous payez les heures supplémentaires ?" },
  sonnette_sav: { text: "J'ai un problème avec votre personnel." },
  douche_ouvre: { text: "Cinq secondes pour enlever la poussière.", chance: 0.6 },
  douche_ferme: { text: "Ça suffit. On reprend.", chance: 0.6 },
  toilettes_soulagement: { text: "Ah. Voilà une bonne décision." },
  toilettes_delai: { text: "Rien. J'ai déjà tout donné." },
  boire_fuite: { text: "Je boirai vraiment n'importe quoi.", once: true },
  camera_quitte: { text: "Assez regardé. J'y vais.", chance: 0.5 },

  // Combat
  costard_alerte: { text: "Ils m'ont vu. Tant mieux.", chance: 0.4 },
  costard_tire: { text: "Ah. Voilà leur politique d'accueil.", once: true },
  premier_kill: { text: "Un de moins. Une preuve de plus.", once: true },
  kill_costard: { text: "Ton service est terminé.", chance: 0.35 },
  kill_pompe: { text: "Ça remet les idées en place.", chance: 0.5 },
  touche: { text: "Ça, tu vas le payer.", chance: 0.15 },
  pv_bas: { text: "Ça va. Continuez de regarder.", priority: true, once: true },
  objet_pousse: { text: "Pousse-toi de là.", once: true },

  // Casse
  casse_bois: { text: "Ça tenait pas à grand-chose.", chance: 0.5 },
  casse_farine: { text: "Ça, c'est de la poudre blanche.", chance: 0.5 },
  casse_vitre: { text: "Je préfère les passages ouverts.", chance: 0.5 },
  casse_ecran: { text: "Fin du programme.", chance: 0.5 },

  // Secrets
  secret_generique: { text: "Je savais qu'ils cachaient une pièce.", priority: true },
  secret_photomaton: { text: "Un labo derrière les photos d'identité. Évidemment.", priority: true, once: true },
  secret_aeration: { text: "Tout ce détour pour cacher cette pièce.", priority: true, once: true },
  secret_vigile: { text: "Le vigile s'était fait son petit royaume.", priority: true, once: true },

  // Directeur
  boss_attaque: { text: "Même le patron fait le sale boulot.", once: true },
  boss_revelation: { text: "Je le savais. Je le savais !", priority: true, once: true },
  boss_touche_hero: { text: "T'as de la force pour un bureaucrate.", chance: 0.3, once: true },
  boss_mort: { text: "Fin de mandat.", priority: true, once: true },
} as const satisfies Record<string, HeroLineDef>;

export type HeroLineId = keyof typeof HERO_LINES;

export const HERO_BARKS = {
  douleur_legere: "Aïe !",
  douleur_forte: "Argh !",
  effort_reception: "Ouf !",
} as const;

export type HeroBarkId = keyof typeof HERO_BARKS;

/** Clé de la prise dans le sprite `voix`. */
export function heroVoiceKey(id: HeroLineId | HeroBarkId): string {
  return `heros_${id}_a`;
}

/** La réplique propre à un volume `secret_*`, ou la réplique commune. */
export const SECRET_LINES: Readonly<Record<string, HeroLineId>> = {
  secret_1_photomaton: "secret_photomaton",
  secret_3_aeration: "secret_aeration",
  secret_4_planque: "secret_vigile",
};

/** Réplique d'ouverture par `use_*` de porte libre. */
export const DOOR_USE_LINES: Readonly<Record<string, HeroLineId>> = {
  use_photomaton: "photomaton_ouvre",
  use_coupe_feu: "raccourci_coupe_feu",
};

/** Réplique de casse par matière de `prop_*` (les matières absentes ne disent rien). */
export const PROP_BREAK_LINES: Readonly<Record<string, HeroLineId>> = {
  bois: "casse_bois",
  farine: "casse_farine",
};

/** Réplique de nourriture par aliment (les aliments absents ne disent rien). */
export const FOOD_LINES: Readonly<Record<string, HeroLineId>> = {
  sandwich: "manger_sandwich",
  pizza: "manger_pizza",
};
