// see: docs/6-reference/repliques-niveau-v2.md#annonces-du-magasin-voix-souriante-artificiellement-rassurante

/**
 * Annonces des haut-parleurs du magasin. Le texte est mot pour mot celui de la
 * prise enregistrée (`storeAnnouncements.test.ts` le vérifie).
 */
export const STORE_ANNOUNCEMENTS = {
  caisses: "Un client non identifié est attendu en caisse centrale.",
  securite: "Merci de ne pas gêner les opérations de sécurité.",
  inventaire: "La réserve est fermée pour inventaire exceptionnel.",
  renfort: "Renfort demandé en réserve. Le personnel non essentiel est prié de mordre.",
  inventaire_fin: "L'inventaire est terminé. Hyper Varan vous remercie de votre patience.",
} as const;

export type StoreAnnouncementId = keyof typeof STORE_ANNOUNCEMENTS;

/** Clé de la prise dans le sprite `voix`. */
export function announcementVoiceKey(id: StoreAnnouncementId): string {
  return `annonce_${id}_a`;
}
