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
  /** Pas encore de prise de voix : la réplique n'existe qu'en sous-titre. */
  readonly textOnly?: boolean;
}

export const HERO_LINES = {
  // Départ et fin
  depart: { text: "Ce soir, on vérifie les rumeurs.", priority: true, once: true },
  nouvelle_tentative: { text: "Cette fois, je connais les pièges.", priority: true, once: true },
  mort_hero: { text: "J'étais pourtant si près.", priority: true, once: true },

  // Lieux — première visite, voir `PLACE_LINES`
  parking: { text: "Ils ont laissé les voitures. Où sont les clients ?", once: true, textOnly: true },
  portes_auto: { text: "Au moins, les portes sont accueillantes.", once: true, textOnly: true },
  galerie: { text: "Tout est fermé. Sauf les ennuis.", once: true, textOnly: true },
  passage_cafe: { text: "Un détour avant le carnage.", once: true, textOnly: true },
  cafeteria: { text: "Je vais éviter le plat du jour.", once: true, textOnly: true },
  toilettes: { text: "Enfin une pièce où je comprends le complot.", once: true, textOnly: true },
  entree_magasin: { text: "Derrière les caisses, ça devient sérieux.", once: true, textOnly: true },
  caisses: { text: "Je crois que les caissiers sont armés.", once: true, textOnly: true },
  hub: { text: "Tous les rayons. Aucun choix rassurant.", once: true, textOnly: true },
  entree_rayons: { text: "Voyons ce qu'ils ont en stock.", once: true, textOnly: true },
  rayons: { text: "Ils rangent même leurs pièges par catégorie.", once: true, textOnly: true },
  entree_electro: { text: "Ça clignote beaucoup trop pour être innocent.", once: true, textOnly: true },
  electro: { text: "Ils diffusent tous le même mensonge.", once: true, textOnly: true },
  sas_reserve: { text: "Voilà ce qu'ils cachent derrière la fidélité.", once: true, textOnly: true },
  reserve: { text: "Le vrai magasin commence derrière le magasin.", once: true, textOnly: true },
  rampe_quai: { text: "Plus on descend, moins ça sent les courses.", once: true, textOnly: true },
  souterrain: { text: "Trop de piliers. Pas assez de lumière.", once: true, textOnly: true },
  couloir_personnel: { text: "Accès interdit. Donc accès intéressant.", once: true, textOnly: true },
  couloir_service: { text: "Les coulisses sont plus grandes que la scène.", once: true, textOnly: true },
  couloir_coupe_feu: { text: "Long couloir. Mauvaise perspective.", once: true, textOnly: true },
  vestiaires: { text: "Voilà où ils rangent leur peau de rechange.", once: true, textOnly: true },
  fournil: { text: "Pour une fois, ça sent presque bon.", once: true, textOnly: true },
  gaine: { text: "La visite guidée passe par les conduits.", once: true, textOnly: true },
  pc_securite: { text: "Ils surveillent tout. Sauf leurs propres portes.", once: true, textOnly: true },
  boucherie: { text: "Je vais pas demander l'origine de la viande.", once: true, textOnly: true },
  chambre_froide: { text: "Même leurs secrets ont froid.", once: true, textOnly: true },
  sav: { text: "Voilà où les appareils viennent mourir.", once: true, textOnly: true },
  compacteur: { text: "Ils font disparaître les cartons. Et le reste ?", once: true, textOnly: true },
  escalier: { text: "Les décisions viennent toujours d'en haut.", once: true, textOnly: true },
  bureaux: { text: "Le complot a aussi ses horaires de bureau.", once: true, textOnly: true },
  direction: { text: "Beau bureau. Sale affaire.", once: true, textOnly: true },

  // Sous-zones — posées par un `trig_*` portant `replique`
  surgeles: { text: "Certains secrets se conservent au froid.", once: true, textOnly: true },
  mezzanine: { text: "Je préfère voir venir les ennuis.", once: true, textOnly: true },
  bureau_securite: { text: "Un autre écran pour éviter de regarder dehors.", once: true, textOnly: true },
  comptabilite: { text: "Les comptes doivent être aussi faux que leurs visages.", once: true, textOnly: true },
  ressources_humaines: { text: "Ressources humaines. J'ai comme un doute.", once: true, textOnly: true },
  salle_pause: { text: "Même les monstres prennent leur pause.", once: true, textOnly: true },

  // Moments scriptés — voir `progression/levelEvents.ts`
  quai: { text: "Qu'est-ce qu'ils livrent après la fermeture ?", priority: true, once: true, textOnly: true },
  ecrans_filment: { text: "Cette fois, la télé regarde les clients.", priority: true, once: true, textOnly: true },
  boss_rencontre: { text: "Souriez, patron. Vous êtes en direct.", priority: true, once: true, textOnly: true },

  // Le direct — voir `stream/streamFeed.ts`
  don_premier: { text: "Un don ! La vérité n'a pas de prix, mais merci.", once: true, textOnly: true },
  don_gros: { text: "Autant ? Quelqu'un prend enfin ça au sérieux.", priority: true, once: true, textOnly: true },

  // Bornes — voir `progression/perks.ts`. Une lecture de pub par perk acheté.
  borne_solde: { text: "Pas assez. Le chat, c'est le moment de donner.", textOnly: true },
  pub_boisson: { text: "Ce direct est propulsé par Zone 51 Energy. Ça réveille.", priority: true, once: true, textOnly: true },
  pub_vpn: { text: "Avec VPN Faraday, même eux ne savent plus où je suis.", priority: true, once: true, textOnly: true },
  pub_gilet: { text: "Gilet Alu-Tactique : arrête les balles et les ondes.", priority: true, once: true, textOnly: true },
  pub_premium: { text: "Vérité+ : plus de munitions, moins de censure.", priority: true, once: true, textOnly: true },
  pub_perche: { text: "Perche Titane : pour filmer la vérité. Et la défendre.", priority: true, once: true, textOnly: true },
  pub_aimant: { text: "Magnétips : l'argent vient à vous. Comme les ennuis.", priority: true, once: true, textOnly: true },

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
  rampant_alerte: { text: "Celui-là a oublié son costume.", priority: true, once: true, textOnly: true },
  rampant_griffe: { text: "Ils mordent, maintenant ?", once: true, textOnly: true },
  premier_kill: { text: "Un de moins. Une preuve de plus.", once: true },
  kill_costard: { text: "Ton service est terminé.", chance: 0.35 },
  kill_pompe: { text: "Ça remet les idées en place.", chance: 0.5 },
  touche: { text: "Ça, tu vas le payer.", chance: 0.15 },
  pv_bas: { text: "Ça va. Continuez de regarder.", priority: true, once: true },
  objet_pousse: { text: "Pousse-toi de là.", once: true },

  // Casse
  casse_bois: { text: "Ça tenait pas à grand-chose.", chance: 0.5 },
  casse_farine: { text: "Ça, c'est de la poudre blanche.", chance: 0.5 },
  casse_gaz: { text: "Ça, le chat va le clipper.", priority: true, once: true, textOnly: true },
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

/**
 * Réplique de première visite par espace du plan de masse (`<niveau>.espaces.json`).
 * Les espaces absents ne disent rien : les secrets ont leur propre réplique.
 */
export const PLACE_LINES: Readonly<Record<string, HeroLineId>> = {
  parking_ext: "parking",
  c_pk_ga: "portes_auto",
  galerie: "galerie",
  c_ga_cf: "passage_cafe",
  cafeteria: "cafeteria",
  toilettes: "toilettes",
  c_ga_cs: "entree_magasin",
  caisses: "caisses",
  hub: "hub",
  c_hb_ry: "entree_rayons",
  rayons: "rayons",
  c_hb_el: "entree_electro",
  electro: "electro",
  c_hb_rs: "sas_reserve",
  reserve: "reserve",
  c_so_bu: "rampe_quai",
  souterrain: "souterrain",
  c_bu: "couloir_personnel",
  c_short_ramp: "couloir_service",
  c_short_w: "couloir_coupe_feu",
  vestiaires: "vestiaires",
  fournil: "fournil",
  gaine: "gaine",
  pc_secu: "pc_securite",
  labo: "boucherie",
  chambre_froide: "chambre_froide",
  sav: "sav",
  compacteur: "compacteur",
  c_escalier: "escalier",
  bureaux: "bureaux",
  direction: "direction",
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
  gaz: "casse_gaz",
};

/** Réplique de nourriture par aliment (les aliments absents ne disent rien). */
export const FOOD_LINES: Readonly<Record<string, HeroLineId>> = {
  sandwich: "manger_sandwich",
  pizza: "manger_pizza",
};
