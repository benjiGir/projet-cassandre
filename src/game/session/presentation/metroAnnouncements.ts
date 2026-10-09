// see: docs/6-reference/repliques-metro.md#annonces

/** Qui parle dans les haut-parleurs du métro, tel que le HUD l'affiche. */
export const METRO_SPEAKERS = {
  station: "MUE · LIGNE S",
  regulation: "MUE · RÉGULATION",
  rame: "RAME DE SERVICE",
} as const;

export type MetroSpeakerId = keyof typeof METRO_SPEAKERS;

/**
 * Annonces du réseau MUE : une voix calme, qui ne menace jamais. Le motif est
 * celui du « voyageur sans titre de transport ». Elles n'ont pas encore de
 * prise de voix : le jour où elles en ont, elles suivent la règle de
 * `storeAnnouncements.ts` (texte mot pour mot celui de la prise).
 */
export const METRO_ANNOUNCEMENTS = {
  sans_titre: "Un voyageur sans titre de transport est signalé en salle des billets.",
  camera: "Merci d'éteindre votre caméra. MUE vous souhaite une agréable soirée.",
  trafic: "En raison de travaux, aucune rame ne circule sur la ligne S.",
  depot: "Le dépôt est fermé au public. Le voyageur sans titre y est attendu.",
  voie_service: "Voie de service rétablie. Les refuges restent à la disposition des agents.",
  depart: "Cette rame ne prend pas de voyageurs. Départ immédiat.",
  controle: "Un contrôle des titres de transport va avoir lieu dans cette rame.",
  controle_suite: "Le contrôle se poursuit. Merci de votre coopération.",
  terminus: "Terminus. Merci de ne rien oublier à bord. Ni personne.",
} as const;

export type MetroAnnouncementId = keyof typeof METRO_ANNOUNCEMENTS;
