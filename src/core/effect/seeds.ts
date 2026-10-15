// Toutes les graines du RNG déterministe (invariant #12). Elles sont fixes et
// arbitraires : jamais dérivées de `Math.random()` ni de `Date.now()`. Réunies
// ici pour qu'un doublon se voie — deux flux de même graine tirent la même suite.
// see: docs/4-technique/rejeu-et-determinisme.md

/** Dispersion du pompe et du pistolet — voir `docs/decisions/0007-rng-deterministe.md`. */
export const SHOTGUN_SPREAD_SEED = 0x9e3779b9;

/** Graine de base des apparitions de Costards : distincte de celle du Directeur, deux gestionnaires ne partagent jamais une suite. */
export const BASE_SUIT_SEED = 0x5eed_c057;
/** Graine de base des apparitions du Directeur. */
export const BASE_DIRECTOR_SEED = 0xd12ec704;
/** Pas IMPAIR entre deux graines d'apparition d'un même gestionnaire. */
export const SEED_STRIDE = 0x9e3779b1;

/** Position des aliments qu'un prop lâche à sa casse. */
export const FOOD_DROP_SEED = 0x8f00d;

/** Le direct : spectateurs, dons et chat, jamais les armes ni les ennemis. */
export const STREAM_SEED = 0x71e75;
/** Tirage des répliques occasionnelles du héros (`session.run.heroLineRandom`). */
export const HERO_LINE_SEED = 0x50111e77;

/** Effets visuels (`FxSystem`), remis à cette graine à chaque partie. */
export const FX_SEED = 0xf00d517;
/** Variations de lecture des sons (`core/audio/audio.ts`). */
export const AUDIO_SEED = 0xa0d105;
/** Évènements épars des ambiances de zone. */
export const ZONE_AMBIENCE_SEED = 0xa4b1a7;
