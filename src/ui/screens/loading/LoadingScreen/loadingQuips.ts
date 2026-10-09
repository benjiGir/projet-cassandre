export const LOADING_QUIPS: readonly string[] = [
  "Décongélation du rayon surgelés…",
  "Repassage des costumes du personnel…",
  "Alignement des caddies…",
  "Vérification de votre carte de fidélité…",
  "Le directeur est en réunion. Il vous recevra.",
  "Cirage des sols. Attention à la marche.",
  "Mise à jour des prix. À la hausse.",
  "Rembobinage des cassettes de surveillance…",
  "Réapprovisionnement du rayon frais…",
  "Ouverture de la caisse numéro 3…",
  "Comptage des spectateurs en direct…",
  "Remplacement des néons défectueux…",
  "Un agent de sécurité va vous recevoir.",
  "Lissage des costumes. Rien à signaler.",
];

// see: docs/6-reference/repliques-metro.md#écran-de-chargement
export const METRO_LOADING_QUIPS: readonly string[] = [
  "Graissage des gonds de la grille…",
  "Contrôle de votre titre de transport…",
  "Trafic interrompu. Merci de patienter quand même.",
  "Rétablissement de votre chaîne…",
  "Prochaine rame dans 2 minutes. Ou pas.",
  "Mise à jour du plan de ligne. Un autocollant suffit.",
  "Rembobinage des caméras de quai…",
  "Purge des conduites. Attention, c'est tiède.",
  "Vérification des refuges. Ils sont étroits.",
  "Repassage des uniformes des agents…",
  "Éloignez-vous de la bordure du quai.",
  "Comptage des nouveaux spectateurs…",
  "Un agent va vous recevoir. Restez sur le quai.",
  "MUE. La ville fait peau neuve.",
];

/** Phrases d'attente selon ce qu'on charge (`beginLoading`) ; sans indication, celles du magasin. */
export function loadingQuips(destination: string | null): readonly string[] {
  return destination === "metro" ? METRO_LOADING_QUIPS : LOADING_QUIPS;
}
