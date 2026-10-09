import { Effect, Schema } from "effect";
import { PROP_MATERIALS, DEFAULT_PROP_MATERIAL } from "../props/props";
import { DOOR_MOVEMENTS } from "../doors/doorTypes";
import { DEFAULT_DOOR_MOVEMENT } from "../doors/doorConfig";
import { DEFAULT_PROP_MASS_KG } from "../props/propConfig";
import { LOYALTY_CARDS } from "../../player/loyaltyCards";
import { PERKS } from "../../player/perks";
import { FOOD_ITEMS } from "../interactions/food";
import { SANITAIRE_KINDS, DEFAULT_SANITAIRE_KIND } from "../sanitaires/sanitaires";
import { ECRAN_CHAINES, DEFAULT_ECRAN_CHAINE } from "../interactions/ecrans";

/** Signe d'un mesh `col_*` oublié en high-poly — voir
 * reference/conventions-nommage.md. */
export const MAX_COLLIDER_TRIANGLES = 50_000;

// Erreurs typées (jalon M2) — une par cas de dégradation. Patron uniforme
// "fail immédiatement rattrapé au point de détection" pour les 7 cas.
// see: docs/archive/pipeline-niveau-blender.md#cycle-de-vie-du-levelhandle

export class MissingColliderGeometryError extends Schema.TaggedError<MissingColliderGeometryError>()(
  "MissingColliderGeometryError",
  {
    name: Schema.String,
    prefixLabel: Schema.Literals(["col_*", "col_hull_*"]),
    reason: Schema.Literals(["missing-geometry", "zero-triangles"]),
  },
) {}

/** `col_*` dépassant `MAX_COLLIDER_TRIANGLES` — jamais bloquant, le collider
 * est créé quand même (diagnostic de mesh oublié en high-poly). */
export class OversizedColliderWarning extends Schema.TaggedError<OversizedColliderWarning>()(
  "OversizedColliderWarning",
  {
    name: Schema.String,
    triangleCount: Schema.Number,
  },
) {}

/** `spawn_player` absent du niveau. */
export class MissingSpawnPlayerError extends Schema.TaggedError<MissingSpawnPlayerError>()(
  "MissingSpawnPlayerError",
  {},
) {}

/** `spawn_player` présent plus d'une fois — seul le premier rencontré compte. */
export class DuplicateSpawnPlayerError extends Schema.TaggedError<DuplicateSpawnPlayerError>()(
  "DuplicateSpawnPlayerError",
  { count: Schema.Number },
) {}

/** `trig_*` dont la géométrie n'est pas une box axis-aligned (locale). */
export class NonBoxTriggerError extends Schema.TaggedError<NonBoxTriggerError>()("NonBoxTriggerError", {
  name: Schema.String,
}) {}

/** `use_*` sans `extras.target` — jamais bloquant, l'objet est quand même
 * retourné avec `targetName: null`. */
export class UntargetedUseObjectWarning extends Schema.TaggedError<UntargetedUseObjectWarning>()(
  "UntargetedUseObjectWarning",
  { name: Schema.String },
) {}

export class UnknownLoyaltyCardWarning extends Schema.TaggedError<UnknownLoyaltyCardWarning>()(
  "UnknownLoyaltyCardWarning",
  { name: Schema.String, property: Schema.String, value: Schema.String },
) {}

/** `use_*` dont `extras.soin` n'est pas un nombre strictement positif — une
 * trousse qui ne soignerait rien, ou une faute de frappe. Jamais bloquant :
 * l'objet est retourné avec `heals: null`. */
export class InvalidHealAmountWarning extends Schema.TaggedError<InvalidHealAmountWarning>()(
  "InvalidHealAmountWarning",
  { name: Schema.String, value: Schema.String, property: Schema.String },
) {}

export class UnknownFoodItemWarning extends Schema.TaggedError<UnknownFoodItemWarning>()("UnknownFoodItemWarning", {
  name: Schema.String,
  value: Schema.String,
}) {}

/** `use_*` dont la paire `perk`/`prix` ne fait pas une borne : perk inconnu,
 * prix qui n'est pas un nombre strictement positif, ou l'un sans l'autre.
 * Jamais bloquant : l'objet est retourné avec `sells: null`, il ne vend rien. */
export class InvalidPerkOfferWarning extends Schema.TaggedError<InvalidPerkOfferWarning>()("InvalidPerkOfferWarning", {
  name: Schema.String,
  perk: Schema.String,
  prix: Schema.String,
}) {}

/** `prop_*` dont `extras.matiere` n'est pas une matière connue — jamais
 * bloquant : le prop est construit avec `DEFAULT_PROP_MATERIAL`. */
export class UnknownPropMaterialWarning extends Schema.TaggedError<UnknownPropMaterialWarning>()(
  "UnknownPropMaterialWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `prop_*` dont `extras.masse`/`extras.pv` n'est pas un nombre strictement
 * positif — jamais bloquant : la propriété est ignorée et le prop prend le
 * défaut du préfixe (masse de repli, ou indestructible pour `pv`). */
export class InvalidPropNumberWarning extends Schema.TaggedError<InvalidPropNumberWarning>()(
  "InvalidPropNumberWarning",
  { name: Schema.String, property: Schema.String, value: Schema.String },
) {}

/** `prop_*` dont `extras.contenu` n'est pas au format `"nom:nombre"` (nombre
 * entier strictement positif) — jamais bloquant : le prop est construit sans
 * contenu, il ne lâche rien à sa casse. */
export class InvalidPropContentWarning extends Schema.TaggedError<InvalidPropContentWarning>()(
  "InvalidPropContentWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `door_*` dont `extras.mouvement` n'est pas une valeur connue — jamais
 * bloquant : la porte est construite avec `DEFAULT_DOOR_MOVEMENT` (même
 * règle que `matiere` sur un `prop_*`). */
export class UnknownDoorMovementWarning extends Schema.TaggedError<UnknownDoorMovementWarning>()(
  "UnknownDoorMovementWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `vitre_*` dont `extras.pv` n'est pas un nombre strictement positif —
 * jamais bloquant : la vitre est construite INCASSABLE (même règle que `pv`
 * sur un `prop_*`). */
export class InvalidVitrePvWarning extends Schema.TaggedError<InvalidVitrePvWarning>()("InvalidVitrePvWarning", {
  name: Schema.String,
  value: Schema.String,
}) {}

export class UnknownSanitaireKindWarning extends Schema.TaggedError<UnknownSanitaireKindWarning>()(
  "UnknownSanitaireKindWarning",
  { name: Schema.String, value: Schema.String },
) {}

export class InvalidSanitairePvWarning extends Schema.TaggedError<InvalidSanitairePvWarning>()(
  "InvalidSanitairePvWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `ecran_*` dont `extras.chaine` n'est pas une chaîne connue — repli sur
 * `DEFAULT_ECRAN_CHAINE`, même règle que `sorte` sur un `sanitaire_*`. */
export class UnknownEcranChaineWarning extends Schema.TaggedError<UnknownEcranChaineWarning>()(
  "UnknownEcranChaineWarning",
  { name: Schema.String, value: Schema.String },
) {}

/** `ecran_*` dont `extras.pv` n'est pas un nombre strictement positif — jamais
 * bloquant, même règle que `pv` sur un `vitre_*`/`sanitaire_*`. */
export class InvalidEcranPvWarning extends Schema.TaggedError<InvalidEcranPvWarning>()("InvalidEcranPvWarning", {
  name: Schema.String,
  value: Schema.String,
}) {}

/** `col_hull_*` dont `RAPIER.ColliderDesc.convexHull` retourne `null`
 * (sommets dégénérés) — toujours suivi d'un repli sur un collider trimesh
 * pour ce même mesh, jamais d'absence totale de collider. */
export class DegenerateConvexHullError extends Schema.TaggedError<DegenerateConvexHullError>()(
  "DegenerateConvexHullError",
  { name: Schema.String },
) {}

export class LevelFetchError extends Schema.TaggedError<LevelFetchError>()("LevelFetchError", {
  url: Schema.String,
  cause: Schema.Defect(),
}) {}

export function formatMissingColliderGeometry(error: MissingColliderGeometryError): string {
  const detail = error.reason === "missing-geometry" ? "sans géométrie valide" : "a 0 triangle";
  return `[level] "${error.name}" (${error.prefixLabel}) ${detail} — aucun collider créé.`;
}

export function formatOversizedCollider(error: OversizedColliderWarning): string {
  return (
    `[level] "${error.name}" (col_*) : ${error.triangleCount} triangles, au-delà du seuil de ` +
    `${MAX_COLLIDER_TRIANGLES} — signe probable d'un mesh oublié en high-poly. ` +
    `Collider créé quand même.`
  );
}

export function formatMissingSpawnPlayer(): string {
  return "[level] spawn_player absent du niveau — le joueur ne peut pas être positionné au chargement.";
}

export function formatDuplicateSpawnPlayer(error: DuplicateSpawnPlayerError): string {
  return `[level] spawn_player en double (${error.count} occurrences) — seule la première rencontrée est utilisée.`;
}

export function formatNonBoxTrigger(error: NonBoxTriggerError): string {
  return `[level] "${error.name}" (trig_*) n'est pas une géométrie box — trigger ignoré.`;
}

export function formatUntargetedUseObject(error: UntargetedUseObjectWarning): string {
  return (
    `[level] "${error.name}" (use_*) n'a pas de cible référencée dans ses extras ` +
    `(custom property Blender "target" attendue) — objet interactif sans effet exploitable.`
  );
}

export function formatUnknownLoyaltyCard(error: UnknownLoyaltyCardWarning): string {
  return (
    `[level] "${error.name}" (use_*) : propriété "${error.property}" = "${error.value}", ` +
    `qui n'est pas une carte de fidélité connue (${LOYALTY_CARDS.join(", ")}) — propriété ignorée.`
  );
}

export function formatInvalidHealAmount(error: InvalidHealAmountWarning): string {
  const unite = error.property === "soin" ? "PV" : "munitions";
  return (
    `[level] "${error.name}" (use_*) : propriété "${error.property}" = "${error.value}", ` +
    `qui n'est pas un nombre de ${unite} strictement positif — propriété ignorée.`
  );
}

export function formatUnknownFoodItem(error: UnknownFoodItemWarning): string {
  return (
    `[level] "${error.name}" (use_*) : propriété "aliment" = "${error.value}", ` +
    `qui n'est pas un aliment connu (${FOOD_ITEMS.join(", ")}) — propriété ignorée.`
  );
}

export function formatInvalidPerkOffer(error: InvalidPerkOfferWarning): string {
  return (
    `[level] "${error.name}" (use_*) : borne "perk" = "${error.perk}", "prix" = "${error.prix}" — ` +
    `il faut un perk connu (${PERKS.join(", ")}) ET un prix strictement positif. La borne ne vend rien.`
  );
}

export function formatUnknownPropMaterial(error: UnknownPropMaterialWarning): string {
  return (
    `[level] "${error.name}" (prop_*) : propriété "matiere" = "${error.value}", ` +
    `qui n'est pas une matière connue (${PROP_MATERIALS.join(", ")}) — ` +
    `repli sur "${DEFAULT_PROP_MATERIAL}".`
  );
}

export function formatInvalidPropNumber(error: InvalidPropNumberWarning): string {
  const repli = error.property === "masse" ? `repli sur ${DEFAULT_PROP_MASS_KG} kg` : "prop laissé indestructible";
  return (
    `[level] "${error.name}" (prop_*) : propriété "${error.property}" = "${error.value}", ` +
    `qui n'est pas un nombre strictement positif — ${repli}.`
  );
}

export function formatInvalidPropContent(error: InvalidPropContentWarning): string {
  return (
    `[level] "${error.name}" (prop_*) : propriété "contenu" = "${error.value}", ` +
    `qui n'est pas au format "nom:nombre" (nombre entier > 0) — prop laissé sans contenu.`
  );
}

export function formatUnknownDoorMovement(error: UnknownDoorMovementWarning): string {
  return (
    `[level] "${error.name}" (door_*) : propriété "mouvement" = "${error.value}", ` +
    `qui n'est pas un mouvement connu (${DOOR_MOVEMENTS.join(", ")}) — repli sur "${DEFAULT_DOOR_MOVEMENT}".`
  );
}

export function formatInvalidVitrePv(error: InvalidVitrePvWarning): string {
  return (
    `[level] "${error.name}" (vitre_*) : propriété "pv" = "${error.value}", ` +
    `qui n'est pas un nombre strictement positif — vitre laissée incassable.`
  );
}

export function formatUnknownSanitaireKind(error: UnknownSanitaireKindWarning): string {
  return (
    `[level] "${error.name}" (sanitaire_*) : propriété "sorte" = "${error.value}", ` +
    `qui n'est pas une sorte connue (${SANITAIRE_KINDS.join(", ")}), et OBLIGATOIRE — ` +
    `repli sur "${DEFAULT_SANITAIRE_KIND}".`
  );
}

export function formatInvalidSanitairePv(error: InvalidSanitairePvWarning): string {
  return (
    `[level] "${error.name}" (sanitaire_*) : propriété "pv" = "${error.value}", ` +
    `qui n'est pas un nombre strictement positif — sanitaire laissé incassable (au tir du joueur).`
  );
}

export function formatUnknownEcranChaine(error: UnknownEcranChaineWarning): string {
  return (
    `[level] "${error.name}" (ecran_*) : propriété "chaine" = "${error.value}", ` +
    `qui n'est pas une chaîne connue (${ECRAN_CHAINES.join(", ")}) — repli sur "${DEFAULT_ECRAN_CHAINE}".`
  );
}

export function formatInvalidEcranPv(error: InvalidEcranPvWarning): string {
  return (
    `[level] "${error.name}" (ecran_*) : propriété "pv" = "${error.value}", ` +
    `qui n'est pas un nombre strictement positif — écran laissé incassable.`
  );
}

export function formatDegenerateConvexHull(error: DegenerateConvexHullError): string {
  return (
    `[level] "${error.name}" (col_hull_*) : hull convexe dégénéré ` +
    `(RAPIER.ColliderDesc.convexHull a retourné null, sommets probablement coplanaires) ` +
    `— repli sur un collider trimesh pour ce mesh.`
  );
}

/** Validation post-traversal du nombre de `spawn_player` rencontrés — même
 * patron "fail immédiatement rattrapé" que les cas par-mesh ci-dessus, juste
 * exécuté une fois après la boucle plutôt que par nœud. */
export function validateSpawnPlayerCountEffect(count: number): Effect.Effect<void> {
  if (count === 0) {
    return Effect.fail(new MissingSpawnPlayerError({})).pipe(
      Effect.catch(() => Effect.sync(() => console.error(formatMissingSpawnPlayer()))),
    );
  }
  if (count > 1) {
    return Effect.fail(new DuplicateSpawnPlayerError({ count })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatDuplicateSpawnPlayer(error)))),
    );
  }
  return Effect.void;
}
