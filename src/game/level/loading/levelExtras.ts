import type * as THREE from "three";
import { Effect } from "effect";
import { DEFAULT_PROP_MATERIAL, parsePropMaterial, type PropMaterial } from "../props/props";
import { DEFAULT_DOOR_MOVEMENT, parseDoorMovement } from "../doors/doorConfig";
import type { DoorMovement } from "../doors/doorTypes";
import { DEFAULT_SANITAIRE_KIND, parseSanitaireKind, type SanitaireKind } from "../sanitaires/sanitaires";
import { DEFAULT_ECRAN_CHAINE, parseEcranChaine, type EcranChaine } from "../interactions/ecrans";
import { parseLoyaltyCard, type LoyaltyCard } from "../../player/loyaltyCards";
import { parseFoodItem, type FoodItem } from "../interactions/food";
import {
  UnknownLoyaltyCardWarning,
  InvalidHealAmountWarning,
  UnknownFoodItemWarning,
  UnknownPropMaterialWarning,
  InvalidPropNumberWarning,
  InvalidPropContentWarning,
  UnknownDoorMovementWarning,
  InvalidVitrePvWarning,
  UnknownSanitaireKindWarning,
  InvalidSanitairePvWarning,
  UnknownEcranChaineWarning,
  InvalidEcranPvWarning,
  formatUnknownLoyaltyCard,
  formatInvalidHealAmount,
  formatUnknownFoodItem,
  formatUnknownPropMaterial,
  formatInvalidPropNumber,
  formatInvalidPropContent,
  formatUnknownDoorMovement,
  formatInvalidVitrePv,
  formatUnknownSanitaireKind,
  formatInvalidSanitairePv,
  formatUnknownEcranChaine,
  formatInvalidEcranPv,
} from "./levelDiagnostics";

// see: docs/archive/pipeline-niveau-blender.md#le-nom-tel-que-tapé-dans-blender
export function blenderName(obj: THREE.Object3D): string {
  const raw = (obj.userData as Record<string, unknown> | undefined)?.name;
  return typeof raw === "string" ? raw : obj.name;
}

/** Copie de `userData` pour `extras`, SANS la clé `name` que `GLTFLoader` y
 * injecte lui-même (voir `blenderName`) — ce n'est pas une custom property
 * Blender, l'exposer polluerait `extras.target`/`extras.hp`/etc. */
export function cleanExtras(obj: THREE.Object3D): Record<string, unknown> {
  const { name: _internalName, ...rest } = obj.userData as Record<string, unknown>;
  return rest;
}

/** Lit `groupe` d'un `spawn_suit_*` : une chaîne non vide, sinon `null` (ennemi présent dès le chargement). */
export function readSpawnGroup(obj: THREE.Object3D): string | null {
  const raw = (obj.userData as Record<string, unknown>).groupe;
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

/** Format attendu de `contenu` : `"nom:nombre"`, nombre entier strictement
 * positif — voir `PropInfo.contenu`. */
const PROP_CONTENT_PATTERN = /^([a-z_]+):(\d+)$/i;

export function readSanitaireKind(name: string, raw: unknown): Effect.Effect<SanitaireKind> {
  return Effect.gen(function* () {
    const sorte = parseSanitaireKind(raw);
    if (sorte) return sorte;
    const value = raw === undefined || raw === null || raw === "" ? "(absent)" : String(raw);
    yield* Effect.fail(new UnknownSanitaireKindWarning({ name, value })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownSanitaireKind(error)))),
    );
    return DEFAULT_SANITAIRE_KIND;
  });
}

/** Lit `pv` d'un `sanitaire_*` : absent -> `null` (incassable au tir du
 * joueur) sans bruit, présent mais pas un nombre strictement positif ->
 * `null` AVEC avertissement bruyant (même règle que `pv` sur un `vitre_*`). */
export function readSanitairePv(name: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
    yield* Effect.fail(new InvalidSanitairePvWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidSanitairePv(error)))),
    );
    return null;
  });
}

/** Lit `chaine` d'un `ecran_*` : OBLIGATOIRE (comme `sorte` sur un
 * `sanitaire_*`), absente ou inconnue -> avertissement bruyant, repli sur
 * `DEFAULT_ECRAN_CHAINE`. */
export function readEcranChaine(name: string, raw: unknown): Effect.Effect<EcranChaine> {
  return Effect.gen(function* () {
    const chaine = parseEcranChaine(raw);
    if (chaine) return chaine;
    const value = raw === undefined || raw === null || raw === "" ? "(absente)" : String(raw);
    yield* Effect.fail(new UnknownEcranChaineWarning({ name, value })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownEcranChaine(error)))),
    );
    return DEFAULT_ECRAN_CHAINE;
  });
}

/** Lit `pv` d'un `ecran_*` : absent -> `null` (incassable) sans bruit,
 * présent mais pas un nombre strictement positif -> `null` AVEC avertissement
 * bruyant, même règle que `pv` sur un `vitre_*`/`sanitaire_*`. */
export function readEcranPv(name: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
    yield* Effect.fail(new InvalidEcranPvWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidEcranPv(error)))),
    );
    return null;
  });
}

/** Lit `matiere` : absente -> défaut sans bruit, inconnue -> défaut AVEC
 * avertissement bruyant (même règle que `card` sur un `use_*`). */
export function readPropMaterial(name: string, raw: unknown): Effect.Effect<PropMaterial> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return DEFAULT_PROP_MATERIAL;
    const matiere = parsePropMaterial(raw);
    if (matiere) return matiere;
    yield* Effect.fail(new UnknownPropMaterialWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownPropMaterial(error)))),
    );
    return DEFAULT_PROP_MATERIAL;
  });
}

/** Lit `masse`/`pv` : absente -> `null` sans bruit, présente mais pas un
 * nombre > 0 -> `null` AVEC avertissement bruyant. */
export function readPropNumber(name: string, property: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
    yield* Effect.fail(new InvalidPropNumberWarning({ name, property, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidPropNumber(error)))),
    );
    return null;
  });
}

/** Lit `mouvement` d'un `door_*` : absent -> `DEFAULT_DOOR_MOVEMENT` sans
 * bruit, présent mais inconnu -> `DEFAULT_DOOR_MOVEMENT` AVEC avertissement
 * bruyant (même règle que `matiere` sur un `prop_*`). */
export function readDoorMovement(name: string, raw: unknown): Effect.Effect<DoorMovement> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return DEFAULT_DOOR_MOVEMENT;
    const mouvement = parseDoorMovement(raw);
    if (mouvement) return mouvement;
    yield* Effect.fail(new UnknownDoorMovementWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownDoorMovement(error)))),
    );
    return DEFAULT_DOOR_MOVEMENT;
  });
}

/** Lit `pv` d'un `vitre_*` : absent -> `null` (incassable) sans bruit,
 * présent mais pas un nombre strictement positif -> `null` AVEC
 * avertissement bruyant (même règle que `pv` sur un `prop_*`). */
export function readVitrePv(name: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const value = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
    yield* Effect.fail(new InvalidVitrePvWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidVitrePv(error)))),
    );
    return null;
  });
}

export function readPropContent(name: string, raw: unknown): Effect.Effect<{ item: string; count: number } | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const match = PROP_CONTENT_PATTERN.exec(String(raw).trim());
    const count = match ? Number(match[2]) : NaN;
    if (match && Number.isFinite(count) && count > 0) {
      return { item: match[1]!.toLowerCase(), count };
    }
    yield* Effect.fail(new InvalidPropContentWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidPropContent(error)))),
    );
    return null;
  });
}

// see: docs/archive/pipeline-niveau-blender.md#objets-interactifs
/** Lit une propriété de carte (`card`/`requires`) : absente -> `null` sans
 * bruit, présente mais inconnue -> `null` AVEC avertissement bruyant. */
export function readCardProperty(name: string, property: string, raw: unknown): Effect.Effect<LoyaltyCard | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const card = parseLoyaltyCard(raw);
    if (card) return card;
    yield* Effect.fail(new UnknownLoyaltyCardWarning({ name, property, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownLoyaltyCard(error)))),
    );
    return null;
  });
}

/** Lit une quantité (`soin`, `munitions`) : absente -> `null` sans bruit,
 * présente mais pas un nombre > 0 -> `null` AVEC avertissement bruyant (même
 * règle que les cartes). */
export function readAmountProperty(name: string, property: string, raw: unknown): Effect.Effect<number | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const amount = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(amount) && amount > 0) return amount;
    yield* Effect.fail(new InvalidHealAmountWarning({ name, value: String(raw), property })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatInvalidHealAmount(error)))),
    );
    return null;
  });
}

/** Lit `aliment` : absente -> `null` sans bruit, présente mais inconnue ->
 * `null` AVEC avertissement bruyant (même règle que `card`/`requires`). */
export function readFoodItem(name: string, raw: unknown): Effect.Effect<FoodItem | null> {
  return Effect.gen(function* () {
    if (raw === undefined || raw === null || raw === "") return null;
    const item = parseFoodItem(raw);
    if (item) return item;
    yield* Effect.fail(new UnknownFoodItemWarning({ name, value: String(raw) })).pipe(
      Effect.catch((error) => Effect.sync(() => console.error(formatUnknownFoodItem(error)))),
    );
    return null;
  });
}
