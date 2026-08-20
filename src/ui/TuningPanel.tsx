import { useEffect, useRef, useState } from "react";

import { FEEL_VARIANTS, moveConfig, type MoveConfig } from "../game/player/moveConfig";
import {
  CROSSHAIR_VARIANTS,
  HITMARKER_VARIANTS,
  IMPACT_VARIANTS,
  weaponConfig,
  type WeaponConfig,
} from "../game/player/weaponConfig";
import {
  FLASH_VARIANTS,
  KNOCKBACK_VARIANTS,
  suitConfig,
  type SuitConfig,
} from "../game/entities/suitConfig";

/**
 * Sliders à chaud pour `moveConfig` — livrable #2 du harnais de tuning
 * (skill `game-feel-tuning`). Sans ça, tuner exige la console pendant qu'on
 * court ; ce panneau supprime ce frottement.
 *
 * INVARIANT #2 tenu strictement : ce composant ne touche JAMAIS le pas fixe.
 * Il MUTE `moveConfig` (objet simple, hors React) sur interaction humaine
 * uniquement — drag de slider, clic de bouton — jamais dans une boucle. Zéro
 * `setInterval`, zéro `requestAnimationFrame`, zéro lecture continue de
 * `moveConfig` : l'état React local n'est resynchronisé qu'à l'OUVERTURE du
 * panneau (pour refléter une éventuelle console `applyFeelVariant`/reset
 * fait pendant qu'il était fermé), jamais en tâche de fond. Un slider peut
 * donc se re-render à chaque frappe humaine, jamais à 60 fps.
 *
 * POINTER LOCK : le jeu tourne en pointer lock (`core/input.ts`). Un slider a
 * besoin d'événements pointeur classiques, incompatibles avec le lock. Donc :
 * le panneau reste DÉMONTÉ (aucun noeud interactif, donc aucune interception
 * de clic) tant qu'il n'est pas ouvert par la touche dédiée `` ` `` (Backquote,
 * coin haut-gauche du clavier) — libre de tout conflit avec ZQSD/WASD
 * (KeyW/A/S/D, des CODES physiques, indépendants du layout clavier), Shift,
 * Espace, F9, F10, KeyV (wireframe) et KeyB (gizmos balistiques).
 * L'ouverture appelle `document.exitPointerLock()`. La
 * fermeture ne fait volontairement RIEN de plus côté pointer lock : le canvas
 * a déjà un écouteur `click → requestPointerLock` dans `core/input.ts`, donc
 * reprendre la main est un simple clic dans la fenêtre de jeu — dupliquer
 * cette responsabilité ici casserait la source unique de vérité du pointer
 * lock.
 *
 * Le panneau de diagnostic permanent (`DebugPanel`) n'est ni modifié ni
 * concerné : il reste `pointerEvents: "none"`, visible en jeu, aux deux états
 * de ce panneau.
 */

// Touche dédiée : Backquote (`/~), jamais utilisée ailleurs dans le projet
// (WASD/ZQSD = KeyW/KeyA/KeyS/KeyD, sprint = ShiftLeft, saut = Space,
// recorder = F9/F10, wireframe = KeyV, gizmos balistiques = KeyB —
// cf. src/main.ts, src/core/input.ts).
const TOGGLE_KEY = "Backquote";

// Au-delà de ce délai entre deux appels, un nouvel `applyConfig()` est
// autorisé pendant un drag continu — évite de recréer la capsule Rapier et le
// KCC à la cadence du pointeur (potentiellement > 60 Hz sur trackpad).
// Toujours suivi d'un appel FORCÉ à la fin du drag (onPointerUp/onBlur) pour
// garantir que la dernière valeur est bien appliquée.
const APPLY_CONFIG_THROTTLE_MS = 100;

// Snapshot figé des valeurs par défaut, capturé à l'IMPORT du module — donc
// avant que `main()` (dernière ligne de `src/main.ts`) ait la moindre chance
// de muter `moveConfig` à chaud. Sert uniquement au bouton « Défauts ».
const DEFAULT_MOVE_CONFIG: MoveConfig = { ...moveConfig };

/** Clés numériques de `MoveConfig` — tout sauf `autostepIncludeDynamicBodies`, seule clé booléenne. */
type NumericKey = Exclude<keyof MoveConfig, "autostepIncludeDynamicBodies">;

interface SliderField {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  unit?: string;
  /**
   * Champ lu par Rapier (capsule, KCC) : une mutation seule ne produit aucun
   * effet tant que `player.applyConfig()` n'a pas été rappelé. Les autres
   * champs (vitesses, saut, bob, FOV...) sont relus à chaque pas fixe ou
   * chaque frame et n'en ont pas besoin — cf. tête de `moveConfig.ts`.
   */
  requiresApplyConfig?: boolean;
}

// Bornes : celles données explicitement pour les champs de vue viennent de la
// consigne de tuning ; les autres sont dérivées des commentaires de
// `moveConfig.ts` (plage défendable autour de la valeur de départ, jamais la
// valeur elle-même — on expose, on ne décide pas).
const SLIDER_GROUPS: ReadonlyArray<{ title: string; fields: readonly SliderField[] }> = [
  {
    title: "Vitesses",
    fields: [
      { key: "walkSpeed", label: "Vitesse marche", min: 0, max: 20, step: 0.5, decimals: 1, unit: "m/s" },
      { key: "runSpeed", label: "Vitesse course", min: 0, max: 25, step: 0.5, decimals: 1, unit: "m/s" },
      {
        key: "timeToMaxSpeed",
        label: "Temps → vitesse max",
        min: 0,
        max: 0.5,
        step: 0.01,
        decimals: 2,
        unit: "s",
      },
      {
        key: "timeToStop",
        label: "Temps d'arrêt (depuis la course)",
        min: 0,
        max: 0.5,
        step: 0.01,
        decimals: 2,
        unit: "s",
      },
      { key: "airControl", label: "Contrôle aérien", min: 0, max: 1, step: 0.05, decimals: 2 },
    ],
  },
  {
    title: "Saut",
    fields: [
      { key: "jumpHeight", label: "Hauteur de saut", min: 0, max: 3, step: 0.05, decimals: 2, unit: "m" },
      { key: "coyoteTime", label: "Coyote time", min: 0, max: 0.3, step: 0.01, decimals: 2, unit: "s" },
      { key: "jumpBufferTime", label: "Jump buffer", min: 0, max: 0.3, step: 0.01, decimals: 2, unit: "s" },
      // Plage resserrée suite à mesure (cf. commentaire `groundStickSpeed`,
      // moveConfig.ts) : au-delà de ~0.5-1 m/s ce champ combiné à une grande
      // vitesse horizontale axée-axe fait dégénérer la résolution Rapier —
      // stutter mesuré jusqu'à 35% des pas fixes en ligne droite dans le hub.
      // 0.6 laisse 3× la valeur par défaut (0.2) sans franchir la falaise
      // mesurée entre 0.5 et 1.0.
      {
        key: "groundStickSpeed",
        label: "Collage au sol",
        min: 0,
        max: 0.6,
        step: 0.02,
        decimals: 2,
        unit: "m/s",
      },
      {
        key: "maxFallSpeed",
        label: "Vitesse de chute max",
        min: 10,
        max: 100,
        step: 1,
        decimals: 0,
        unit: "m/s",
      },
    ],
  },
  {
    title: "Capsule",
    fields: [
      {
        key: "capsuleRadius",
        label: "Rayon capsule ⚙",
        min: 0.2,
        max: 0.8,
        step: 0.01,
        decimals: 2,
        unit: "m",
        requiresApplyConfig: true,
      },
      {
        key: "capsuleHalfHeight",
        label: "Demi-hauteur capsule ⚙",
        min: 0.2,
        max: 1.2,
        step: 0.01,
        decimals: 2,
        unit: "m",
        requiresApplyConfig: true,
      },
      { key: "eyeHeight", label: "Hauteur des yeux", min: 1.0, max: 2.2, step: 0.01, decimals: 2, unit: "m" },
      {
        key: "characterMass",
        label: "Masse ⚙",
        min: 20,
        max: 150,
        step: 1,
        decimals: 0,
        unit: "kg",
        requiresApplyConfig: true,
      },
    ],
  },
  {
    title: "Character controller (Rapier KCC)",
    fields: [
      {
        key: "colliderOffset",
        label: "Marge collider ⚙",
        min: 0.001,
        max: 0.05,
        step: 0.001,
        decimals: 3,
        unit: "m",
        requiresApplyConfig: true,
      },
      {
        key: "autostepMaxHeight",
        label: "Autostep — hauteur max ⚙",
        min: 0,
        max: 0.6,
        step: 0.01,
        decimals: 2,
        unit: "m",
        requiresApplyConfig: true,
      },
      {
        key: "autostepMinWidth",
        label: "Autostep — largeur min ⚙",
        min: 0.05,
        max: 0.5,
        step: 0.01,
        decimals: 2,
        unit: "m",
        requiresApplyConfig: true,
      },
      {
        key: "snapToGroundDistance",
        label: "Snap au sol ⚙",
        min: 0,
        max: 0.6,
        step: 0.01,
        decimals: 2,
        unit: "m",
        requiresApplyConfig: true,
      },
      {
        key: "maxSlopeClimbAngleDeg",
        label: "Pente grimpable max ⚙",
        min: 0,
        max: 89,
        step: 1,
        decimals: 0,
        unit: "°",
        requiresApplyConfig: true,
      },
      {
        key: "minSlopeSlideAngleDeg",
        label: "Pente de glisse min ⚙",
        min: 0,
        max: 90,
        step: 1,
        decimals: 0,
        unit: "°",
        requiresApplyConfig: true,
      },
    ],
  },
  {
    title: "Visée",
    fields: [
      {
        key: "lookSensitivity",
        label: "Sensibilité souris",
        min: 0.0005,
        max: 0.01,
        step: 0.0001,
        decimals: 4,
        unit: "rad/px",
      },
      { key: "pitchLimitDeg", label: "Limite de pitch", min: 45, max: 89.9, step: 0.5, decimals: 1, unit: "°" },
    ],
  },
  {
    title: "Head bob",
    fields: [
      {
        key: "bobDistancePerCycle",
        label: "Distance par cycle",
        min: 3,
        max: 8,
        step: 0.1,
        decimals: 1,
        unit: "m",
      },
      {
        key: "bobVerticalAmplitude",
        label: "Amplitude verticale",
        min: 0,
        max: 0.1,
        step: 0.005,
        decimals: 3,
        unit: "m",
      },
      {
        key: "bobLateralAmplitude",
        label: "Amplitude latérale",
        min: 0,
        max: 0.06,
        step: 0.005,
        decimals: 3,
        unit: "m",
      },
      {
        key: "bobSpeedFloor",
        label: "Seuil de vitesse (zone morte)",
        min: 0,
        max: 3,
        step: 0.1,
        decimals: 1,
        unit: "m/s",
      },
      { key: "bobResponseTime", label: "Temps de réponse", min: 0, max: 0.3, step: 0.01, decimals: 2, unit: "s" },
    ],
  },
  {
    title: "FOV dynamique",
    fields: [
      { key: "fovBase", label: "FOV au repos", min: 60, max: 110, step: 1, decimals: 0, unit: "°" },
      { key: "fovRunBoost", label: "Élargissement max", min: 0, max: 20, step: 1, decimals: 0, unit: "°" },
      {
        key: "fovBoostStartFraction",
        label: "Début (fraction runSpeed)",
        min: 0,
        max: 1,
        step: 0.05,
        decimals: 2,
      },
      {
        key: "fovBoostFullFraction",
        label: "Plein (fraction runSpeed)",
        min: 0,
        max: 1,
        step: 0.05,
        decimals: 2,
      },
      { key: "fovResponseTime", label: "Temps de réponse", min: 0.05, max: 0.5, step: 0.01, decimals: 2, unit: "s" },
    ],
  },
  {
    title: "Réception de saut",
    fields: [
      { key: "landingDipMax", label: "Enfoncement max", min: 0, max: 0.25, step: 0.01, decimals: 2, unit: "m" },
      {
        key: "landingDipFullSpeed",
        label: "Vitesse d'impact — plein effet",
        min: 1,
        max: 30,
        step: 1,
        decimals: 0,
        unit: "m/s",
      },
      {
        key: "landingDipRecoverTime",
        label: "Temps de remontée",
        min: 0,
        max: 1,
        step: 0.05,
        decimals: 2,
        unit: "s",
      },
    ],
  },
];

const VARIANT_NAMES = Object.keys(FEEL_VARIANTS) as (keyof typeof FEEL_VARIANTS)[];

// ---------------------------------------------------------------------------
// Harnais de feedback de hit (retour playtest Phase 3 — « la sensation de tir
// et de touché n'est pas bonne »). Même discipline que `SLIDER_GROUPS`
// ci-dessus : ce panneau EXPOSE et VARIE, il ne tranche rien (skill
// `game-feel-tuning`). Bornes dérivées des commentaires de `weaponConfig.ts`/
// `suitConfig.ts` (plage défendable autour du point de départ), jamais la
// valeur elle-même.
// ---------------------------------------------------------------------------

const DEFAULT_WEAPON_CONFIG: WeaponConfig = { ...weaponConfig };
const DEFAULT_SUIT_CONFIG: SuitConfig = { ...suitConfig };

/** Champs numériques de `WeaponConfig` couverts par ce panneau — volontairement un SOUS-ENSEMBLE : cadence/dégâts/munitions/recul restent hors scope de ce harnais (leviers de gameplay ou déjà couverts par `RECOIL_VARIANTS`/la console). */
type WeaponSliderKey =
  | "hitstopDuration"
  | "hitstopScale"
  | "enemyHitstopDuration"
  | "enemyHitstopScale"
  | "shakeAmplitude"
  | "shakeDuration"
  | "enemyShakeAmplitude"
  | "enemyShakeDuration"
  | "hitmarkerDuration"
  | "hitmarkerSize"
  | "hitmarkerThickness"
  | "hitmarkerKillDuration"
  | "hitmarkerKillSize"
  | "hitmarkerKillThickness";

interface WeaponSliderField {
  key: WeaponSliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  unit?: string;
}

const WEAPON_IMPACT_FIELDS: readonly WeaponSliderField[] = [
  { key: "hitstopDuration", label: "Hitstop — durée (mur/générique)", min: 0, max: 0.15, step: 0.005, decimals: 3, unit: "s" },
  { key: "hitstopScale", label: "Hitstop — échelle dt (mur/générique)", min: 0, max: 1, step: 0.01, decimals: 2 },
  { key: "enemyHitstopDuration", label: "Hitstop — durée (ennemi)", min: 0, max: 0.2, step: 0.005, decimals: 3, unit: "s" },
  { key: "enemyHitstopScale", label: "Hitstop — échelle dt (ennemi)", min: 0, max: 1, step: 0.01, decimals: 2 },
  { key: "shakeAmplitude", label: "Shake — amplitude (mur/générique)", min: 0, max: 0.4, step: 0.01, decimals: 2, unit: "m" },
  { key: "shakeDuration", label: "Shake — durée (mur/générique)", min: 0, max: 0.4, step: 0.01, decimals: 2, unit: "s" },
  { key: "enemyShakeAmplitude", label: "Shake — amplitude (ennemi)", min: 0, max: 0.4, step: 0.01, decimals: 2, unit: "m" },
  { key: "enemyShakeDuration", label: "Shake — durée (ennemi)", min: 0, max: 0.4, step: 0.01, decimals: 2, unit: "s" },
];

const WEAPON_HITMARKER_FIELDS: readonly WeaponSliderField[] = [
  { key: "hitmarkerDuration", label: "Durée (hit)", min: 0.02, max: 0.4, step: 0.01, decimals: 2, unit: "s" },
  { key: "hitmarkerSize", label: "Taille (hit)", min: 2, max: 20, step: 1, decimals: 0, unit: "px" },
  { key: "hitmarkerThickness", label: "Épaisseur (hit)", min: 1, max: 6, step: 1, decimals: 0, unit: "px" },
  { key: "hitmarkerKillDuration", label: "Durée (kill)", min: 0.02, max: 0.6, step: 0.01, decimals: 2, unit: "s" },
  { key: "hitmarkerKillSize", label: "Taille (kill)", min: 2, max: 30, step: 1, decimals: 0, unit: "px" },
  { key: "hitmarkerKillThickness", label: "Épaisseur (kill)", min: 1, max: 8, step: 1, decimals: 0, unit: "px" },
];

/**
 * Champs numériques de `WeaponConfig` couverts par le harnais de réticule
 * (retour playtest son — « le tir est hasardeux, pas de crosshair », voir
 * `CROSSHAIR_VARIANTS`). `crosshairEnabled`/`crosshairStyle` sont hors de
 * cette liste : gérés par une checkbox et une paire de boutons dédiées
 * (valeurs non numériques), pas des sliders.
 */
type CrosshairSliderKey =
  | "crosshairSize"
  | "crosshairGap"
  | "crosshairThickness"
  | "crosshairDotRadius"
  | "crosshairPulseScale"
  | "crosshairPulseDuration";

interface CrosshairSliderField {
  key: CrosshairSliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  unit?: string;
}

const CROSSHAIR_FIELDS: readonly CrosshairSliderField[] = [
  { key: "crosshairSize", label: "Taille (croix)", min: 1, max: 16, step: 1, decimals: 0, unit: "px" },
  { key: "crosshairGap", label: "Espace central (croix)", min: 0, max: 8, step: 1, decimals: 0, unit: "px" },
  { key: "crosshairThickness", label: "Épaisseur", min: 1, max: 4, step: 1, decimals: 0, unit: "px" },
  { key: "crosshairDotRadius", label: "Rayon (point)", min: 1, max: 6, step: 1, decimals: 0, unit: "px" },
  { key: "crosshairPulseScale", label: "Pulsation — échelle au pic", min: 1, max: 2, step: 0.05, decimals: 2 },
  {
    key: "crosshairPulseDuration",
    label: "Pulsation — retour à 0",
    min: 0.02,
    max: 0.3,
    step: 0.01,
    decimals: 2,
    unit: "s",
  },
];

/** Champs numériques de `SuitConfig` couverts par ce panneau (knockback + flash de dégât uniquement — le reste de la machine à états est hors scope). */
type SuitSliderKey = "knockbackSpeed" | "knockbackDecayTime" | "knockbackUpBoost" | "hitFlashDuration";

interface SuitSliderField {
  key: SuitSliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  unit?: string;
}

const SUIT_FEEDBACK_FIELDS: readonly SuitSliderField[] = [
  { key: "knockbackSpeed", label: "Knockback — vitesse", min: 0, max: 12, step: 0.5, decimals: 1, unit: "m/s" },
  { key: "knockbackDecayTime", label: "Knockback — retour à 0", min: 0.05, max: 0.8, step: 0.01, decimals: 2, unit: "s" },
  { key: "knockbackUpBoost", label: "Knockback — pop vertical", min: 0, max: 5, step: 0.1, decimals: 1, unit: "m/s" },
  { key: "hitFlashDuration", label: "Flash de dégât — durée", min: 0.05, max: 0.6, step: 0.01, decimals: 2, unit: "s" },
];

const IMPACT_VARIANT_NAMES = Object.keys(IMPACT_VARIANTS) as (keyof typeof IMPACT_VARIANTS)[];
const HITMARKER_VARIANT_NAMES = Object.keys(HITMARKER_VARIANTS) as (keyof typeof HITMARKER_VARIANTS)[];
const CROSSHAIR_VARIANT_NAMES = Object.keys(CROSSHAIR_VARIANTS) as (keyof typeof CROSSHAIR_VARIANTS)[];
const KNOCKBACK_VARIANT_NAMES = Object.keys(KNOCKBACK_VARIANTS) as (keyof typeof KNOCKBACK_VARIANTS)[];
const FLASH_VARIANT_NAMES = Object.keys(FLASH_VARIANTS) as (keyof typeof FLASH_VARIANTS)[];

/** Une ligne slider générique (label + valeur + `<input type="range">`), réutilisée pour `moveConfig`/`weaponConfig`/`suitConfig` sans dupliquer le balisage trois fois. */
function renderSliderRow(
  key: string,
  label: string,
  unit: string | undefined,
  decimals: number,
  min: number,
  max: number,
  step: number,
  value: number,
  onChange: (raw: string) => void,
) {
  return (
    <div key={key} style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color: "#0f0" }}>
          {value.toFixed(decimals)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%" }}
      />
    </div>
  );
}

export function TuningPanel() {
  const [open, setOpen] = useState(false);
  // Miroir React de `moveConfig`, resynchronisé uniquement à l'ouverture, au
  // reset et à l'application d'une variante — jamais en continu (voir
  // commentaire de tête).
  const [values, setValues] = useState<MoveConfig>(() => ({ ...moveConfig }));
  // Miroirs React du harnais de feedback de hit — même règle de
  // resynchronisation que `values` ci-dessus (ouverture / reset / variante
  // uniquement, jamais en continu).
  const [weaponValues, setWeaponValues] = useState<WeaponConfig>(() => ({ ...weaponConfig }));
  const [suitValues, setSuitValues] = useState<SuitConfig>(() => ({ ...suitConfig }));
  const lastApplyConfigAt = useRef(0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== TOGGLE_KEY || e.repeat) return;
      setOpen((wasOpen) => !wasOpen);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Resynchronisation ponctuelle à l'ouverture : reflète toute mutation
    // faite pendant que le panneau était fermé (console, `applyFeelVariant`).
    setValues({ ...moveConfig });
    setWeaponValues({ ...weaponConfig });
    setSuitValues({ ...suitConfig });
    // Un slider a besoin du pointeur ; le rendre au canvas casserait le lock
    // de toute façon dès le premier clic. On le relâche explicitement pour
    // que la souris soit immédiatement utilisable sur les sliders.
    document.exitPointerLock();
  }, [open]);

  function applyConfigThrottled(force: boolean) {
    const player = window.cassandre?.player;
    if (!player) return;
    const now = performance.now();
    if (!force && now - lastApplyConfigAt.current < APPLY_CONFIG_THROTTLE_MS) return;
    lastApplyConfigAt.current = now;
    player.applyConfig();
  }

  function handleSliderChange(field: SliderField, raw: string) {
    const value = Number(raw);
    moveConfig[field.key] = value;
    setValues((prev) => ({ ...prev, [field.key]: value }));
    if (field.requiresApplyConfig) applyConfigThrottled(false);
  }

  function handleSliderCommit(field: SliderField) {
    if (field.requiresApplyConfig) applyConfigThrottled(true);
  }

  function handleAutostepDynamicToggle(checked: boolean) {
    moveConfig.autostepIncludeDynamicBodies = checked;
    setValues((prev) => ({ ...prev, autostepIncludeDynamicBodies: checked }));
    applyConfigThrottled(true);
  }

  function handleReset() {
    Object.assign(moveConfig, DEFAULT_MOVE_CONFIG);
    setValues({ ...moveConfig });
    // Reset touche potentiellement capsule/KCC : un seul appel couvre tout,
    // inoffensif si rien de physique n'a changé.
    applyConfigThrottled(true);
  }

  function handleVariant(name: keyof typeof FEEL_VARIANTS) {
    // Réutilise exactement la fonction déjà exposée à la console
    // (`cassandre.applyFeelVariant`) : même comportement, un seul chemin de
    // vérité. Les variantes ne touchent que la vue, jamais capsule/KCC — pas
    // d'`applyConfig()` nécessaire ici (cf. commentaire de `applyFeelVariant`
    // dans `src/main.ts`).
    window.cassandre?.applyFeelVariant(name);
    setValues({ ...moveConfig });
  }

  // --- Harnais de feedback de hit --------------------------------------------

  function handleWeaponSliderChange(field: WeaponSliderField, raw: string) {
    const value = Number(raw);
    weaponConfig[field.key] = value;
    setWeaponValues((prev) => ({ ...prev, [field.key]: value }));
  }

  function handleSuitSliderChange(field: SuitSliderField, raw: string) {
    const value = Number(raw);
    suitConfig[field.key] = value;
    setSuitValues((prev) => ({ ...prev, [field.key]: value }));
  }

  function handleHitmarkerToggle(checked: boolean) {
    weaponConfig.hitmarkerEnabled = checked;
    setWeaponValues((prev) => ({ ...prev, hitmarkerEnabled: checked }));
  }

  function handleWeaponReset() {
    Object.assign(weaponConfig, DEFAULT_WEAPON_CONFIG);
    setWeaponValues({ ...weaponConfig });
  }

  function handleSuitReset() {
    Object.assign(suitConfig, DEFAULT_SUIT_CONFIG);
    setSuitValues({ ...suitConfig });
  }

  function handleImpactVariant(name: keyof typeof IMPACT_VARIANTS) {
    // Même chemin unique de vérité que `handleVariant` : réutilise la
    // fonction déjà exposée à la console (`cassandre.applyImpactVariant`).
    window.cassandre?.applyImpactVariant(name);
    setWeaponValues({ ...weaponConfig });
  }

  function handleHitmarkerVariant(name: keyof typeof HITMARKER_VARIANTS) {
    window.cassandre?.applyHitmarkerVariant(name);
    setWeaponValues({ ...weaponConfig });
  }

  function handleCrosshairToggle(checked: boolean) {
    weaponConfig.crosshairEnabled = checked;
    setWeaponValues((prev) => ({ ...prev, crosshairEnabled: checked }));
  }

  function handleCrosshairStyle(style: "cross" | "dot") {
    weaponConfig.crosshairStyle = style;
    setWeaponValues((prev) => ({ ...prev, crosshairStyle: style }));
  }

  function handleCrosshairPulseToggle(checked: boolean) {
    weaponConfig.crosshairPulseEnabled = checked;
    setWeaponValues((prev) => ({ ...prev, crosshairPulseEnabled: checked }));
  }

  function handleCrosshairSliderChange(field: CrosshairSliderField, raw: string) {
    const value = Number(raw);
    weaponConfig[field.key] = value;
    setWeaponValues((prev) => ({ ...prev, [field.key]: value }));
  }

  function handleCrosshairVariant(name: keyof typeof CROSSHAIR_VARIANTS) {
    window.cassandre?.applyCrosshairVariant(name);
    setWeaponValues({ ...weaponConfig });
  }

  function handleKnockbackVariant(name: keyof typeof KNOCKBACK_VARIANTS) {
    window.cassandre?.applyKnockbackVariant(name);
    setSuitValues({ ...suitConfig });
  }

  function handleFlashVariant(name: keyof typeof FLASH_VARIANTS) {
    window.cassandre?.applyFlashVariant(name);
    setSuitValues({ ...suitConfig });
  }

  if (!open) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 8,
          left: 8,
          padding: "4px 8px",
          background: "rgba(0, 0, 0, 0.5)",
          color: "#888",
          fontFamily: "monospace",
          fontSize: 11,
          pointerEvents: "none",
        }}
      >
        {"` : tuning"}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        width: 360,
        maxHeight: "94vh",
        overflowY: "auto",
        padding: "10px 12px",
        background: "rgba(10, 10, 10, 0.88)",
        color: "#ddd",
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 1.5,
        pointerEvents: "auto",
        border: "1px solid #444",
      }}
    >
      <div style={{ color: "#0f0", fontWeight: "bold", marginBottom: 4 }}>Tuning — moveConfig</div>
      <div style={{ color: "#888", marginBottom: 8 }}>
        {"` pour fermer, puis clique dans le jeu pour reprendre la souris."}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={handleReset}>Défauts</button>
        {VARIANT_NAMES.map((name) => (
          <button key={name} onClick={() => handleVariant(name)}>
            {`Variante ${name}`}
          </button>
        ))}
      </div>

      {SLIDER_GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 10 }}>
          <div style={{ color: "#6cf", fontWeight: "bold", marginBottom: 2 }}>{group.title}</div>
          {group.fields.map((field) => (
            <div key={field.key} style={{ marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{field.label}</span>
                <span style={{ color: "#0f0" }}>
                  {values[field.key].toFixed(field.decimals)}
                  {field.unit ? ` ${field.unit}` : ""}
                </span>
              </div>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={values[field.key]}
                onChange={(e) => handleSliderChange(field, e.target.value)}
                onPointerUp={() => handleSliderCommit(field)}
                onBlur={() => handleSliderCommit(field)}
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </div>
      ))}

      <div style={{ marginBottom: 4 }}>
        <label>
          <input
            type="checkbox"
            checked={values.autostepIncludeDynamicBodies}
            onChange={(e) => handleAutostepDynamicToggle(e.target.checked)}
          />
          {" Autostep sur corps dynamiques ⚙"}
        </label>
      </div>

      <div style={{ color: "#666", marginTop: 6, marginBottom: 10 }}>
        ⚙ = recalcul physique (applyConfig) appliqué automatiquement.
      </div>

      <div style={{ borderTop: "1px solid #444", paddingTop: 8, marginBottom: 4 }}>
        <div style={{ color: "#0f0", fontWeight: "bold", marginBottom: 2 }}>
          Tuning — feedback de hit (Phase 3)
        </div>
        <div style={{ color: "#888", marginBottom: 8 }}>
          {'Retour playtest : "le feedback est mauvais sur un hit". Harnais A/B — aucune valeur ici n\'est un choix tranché.'}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ color: "#6cf", fontWeight: "bold", marginBottom: 2 }}>
          Impact — hitstop / shake (mur vs ennemi)
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <button onClick={handleWeaponReset}>Défauts</button>
          {IMPACT_VARIANT_NAMES.map((name) => (
            <button key={`impact-${name}`} onClick={() => handleImpactVariant(name)}>
              {`Variante ${name}`}
            </button>
          ))}
        </div>
        {WEAPON_IMPACT_FIELDS.map((field) =>
          renderSliderRow(
            field.key,
            field.label,
            field.unit,
            field.decimals,
            field.min,
            field.max,
            field.step,
            weaponValues[field.key],
            (raw) => handleWeaponSliderChange(field, raw),
          ),
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ color: "#6cf", fontWeight: "bold", marginBottom: 2 }}>
          Hitmarker (canal absent avant cette intervention)
        </div>
        <div style={{ marginBottom: 4 }}>
          <label>
            <input
              type="checkbox"
              checked={weaponValues.hitmarkerEnabled}
              onChange={(e) => handleHitmarkerToggle(e.target.checked)}
            />
            {" Activé"}
          </label>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {HITMARKER_VARIANT_NAMES.map((name) => (
            <button key={`hitmarker-${name}`} onClick={() => handleHitmarkerVariant(name)}>
              {`Variante ${name}`}
            </button>
          ))}
        </div>
        {WEAPON_HITMARKER_FIELDS.map((field) =>
          renderSliderRow(
            field.key,
            field.label,
            field.unit,
            field.decimals,
            field.min,
            field.max,
            field.step,
            weaponValues[field.key],
            (raw) => handleWeaponSliderChange(field, raw),
          ),
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ color: "#6cf", fontWeight: "bold", marginBottom: 2 }}>
          Réticule (retour playtest — tir hasardeux, pas de repère de visée)
        </div>
        <div style={{ marginBottom: 4 }}>
          <label>
            <input
              type="checkbox"
              checked={weaponValues.crosshairEnabled}
              onChange={(e) => handleCrosshairToggle(e.target.checked)}
            />
            {" Activé (position = correctitude, jamais une variante)"}
          </label>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <button
            onClick={() => handleCrosshairStyle("cross")}
            style={{ fontWeight: weaponValues.crosshairStyle === "cross" ? "bold" : "normal" }}
          >
            Croix
          </button>
          <button
            onClick={() => handleCrosshairStyle("dot")}
            style={{ fontWeight: weaponValues.crosshairStyle === "dot" ? "bold" : "normal" }}
          >
            Point
          </button>
        </div>
        <div style={{ marginBottom: 4 }}>
          <label>
            <input
              type="checkbox"
              checked={weaponValues.crosshairPulseEnabled}
              onChange={(e) => handleCrosshairPulseToggle(e.target.checked)}
            />
            {" Pulsation au tir"}
          </label>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {CROSSHAIR_VARIANT_NAMES.map((name) => (
            <button key={`crosshair-${name}`} onClick={() => handleCrosshairVariant(name)}>
              {`Variante ${name}`}
            </button>
          ))}
        </div>
        {CROSSHAIR_FIELDS.map((field) =>
          renderSliderRow(
            field.key,
            field.label,
            field.unit,
            field.decimals,
            field.min,
            field.max,
            field.step,
            weaponValues[field.key],
            (raw) => handleCrosshairSliderChange(field, raw),
          ),
        )}
      </div>

      <div style={{ marginBottom: 4 }}>
        <div style={{ color: "#6cf", fontWeight: "bold", marginBottom: 2 }}>
          Costard — knockback &amp; flash de dégât
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <button onClick={handleSuitReset}>Défauts</button>
          {KNOCKBACK_VARIANT_NAMES.map((name) => (
            <button key={`knockback-${name}`} onClick={() => handleKnockbackVariant(name)}>
              {`Knockback ${name}`}
            </button>
          ))}
          {FLASH_VARIANT_NAMES.map((name) => (
            <button key={`flash-${name}`} onClick={() => handleFlashVariant(name)}>
              {`Flash ${name}`}
            </button>
          ))}
        </div>
        {SUIT_FEEDBACK_FIELDS.map((field) =>
          renderSliderRow(
            field.key,
            field.label,
            field.unit,
            field.decimals,
            field.min,
            field.max,
            field.step,
            suitValues[field.key],
            (raw) => handleSuitSliderChange(field, raw),
          ),
        )}
      </div>

      <div style={{ color: "#666", marginTop: 6 }}>
        F9/F10 : le recorder ne restaure QUE l'état du joueur, pas les PV/positions des Costards
        — voir la doc de `IMPACT_VARIANTS`/`KNOCKBACK_VARIANTS`.
      </div>
    </div>
  );
}
