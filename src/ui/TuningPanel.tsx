import { useEffect, useRef, useState } from "react";

import { FEEL_VARIANTS, moveConfig, type MoveConfig } from "../game/player/moveConfig";

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
 * Espace, F9 et F10. L'ouverture appelle `document.exitPointerLock()`. La
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
// recorder = F9/F10 — cf. src/main.ts, src/core/input.ts).
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
      {
        key: "groundStickSpeed",
        label: "Collage au sol",
        min: 0,
        max: 5,
        step: 0.1,
        decimals: 1,
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

export function TuningPanel() {
  const [open, setOpen] = useState(false);
  // Miroir React de `moveConfig`, resynchronisé uniquement à l'ouverture, au
  // reset et à l'application d'une variante — jamais en continu (voir
  // commentaire de tête).
  const [values, setValues] = useState<MoveConfig>(() => ({ ...moveConfig }));
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

      <div style={{ color: "#666", marginTop: 6 }}>⚙ = recalcul physique (applyConfig) appliqué automatiquement.</div>
    </div>
  );
}
