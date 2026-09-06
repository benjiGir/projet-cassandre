import { useGameStore } from "../game/state";

/**
 * HUD de production — overlay de STREAM, pas un HUD de FPS classique.
 * Distinct de `DebugPanel` (outil de dev, toujours monté à côté).
 * see: docs/systems/hud.md#hud-de-production
 */

const HUD_TEXT_SHADOW = "1px 1px 2px #000";

const HP_OK_COLOR = "#3f3";
const HP_WARN_COLOR = "#fa3";
const HP_CRITICAL_COLOR = "#f44";

function hpColor(ratio: number): string {
  if (ratio <= 0.25) return HP_CRITICAL_COLOR;
  if (ratio <= 0.5) return HP_WARN_COLOR;
  return HP_OK_COLOR;
}

/** Libellé de la ligne "munitions" — dépend de l'arme active, pas seulement du compte de cartouches (un pied-de-biche n'a pas de munitions, un joueur désarmé encore moins). */
function ammoLabel(activeWeapon: "none" | "melee" | "shotgun", ammo: number, maxAmmo: number): string {
  if (activeWeapon === "shotgun") return `${ammo} / ${maxAmmo}`;
  if (activeWeapon === "melee") return "PIED-DE-BICHE";
  return "À MAINS NUES";
}

/** Formate un compteur de vues avec séparateur de milliers façon compteur de stream ("12 480" plutôt que "12480") — lisible d'un coup d'œil, léger clin d'œil à l'esthétique overlay de live. */
function formatViews(n: number): string {
  return n.toLocaleString("fr-FR");
}

export function Hud() {
  const playerHp = useGameStore((s) => s.debug.playerHp);
  const playerMaxHp = useGameStore((s) => s.debug.playerMaxHp);
  const shotgunAmmo = useGameStore((s) => s.debug.shotgunAmmo);
  const shotgunMaxAmmo = useGameStore((s) => s.debug.shotgunMaxAmmo);
  const activeWeapon = useGameStore((s) => s.debug.activeWeapon);
  const views = useGameStore((s) => s.debug.views);

  const hpRatio = playerMaxHp > 0 ? playerHp / playerMaxHp : 0;

  return (
    <>
      {/* Webcam factice + badge "EN DIRECT" — coin HAUT-DROITE (jamais
          haut-gauche, occupé par DebugPanel). Pur placeholder graphique
          (invariant #9).
          see: docs/systems/hud.md#hud-de-production */}
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          width: 128,
          pointerEvents: "none",
          userSelect: "none",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            width: 128,
            height: 96,
            background: "#111",
            border: "2px solid #333",
            borderRadius: 4,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Silhouette placeholder — cercle (tête) + trapèze (épaules), CSS pur, aucun asset. */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -6,
              transform: "translateX(-50%)",
              width: 70,
              height: 40,
              background: "#3a3a3a",
              borderRadius: "50% 50% 0 0 / 60% 60% 0 0",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 14,
              transform: "translateX(-50%)",
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#4a4a4a",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(0,0,0,0.55)",
              padding: "1px 4px",
              borderRadius: 2,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#f22",
                display: "inline-block",
              }}
            />
            <span style={{ color: "#fff", fontSize: 9, fontWeight: "bold", letterSpacing: 0.5 }}>EN DIRECT</span>
          </div>
        </div>
        <div
          style={{
            marginTop: 3,
            color: "#9c9",
            fontSize: 10,
            textShadow: HUD_TEXT_SHADOW,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          RÉVEIL_DU_PEUPLE — 200 abonnés
        </div>
      </div>

      {/* Compteur de "vues" — sous la webcam, façon compteur de spectateurs
          en direct d'une plateforme de stream. */}
      <div
        style={{
          position: "fixed",
          top: 146,
          right: 12,
          textAlign: "right",
          fontFamily: "monospace",
          pointerEvents: "none",
          userSelect: "none",
          textShadow: HUD_TEXT_SHADOW,
        }}
      >
        <div style={{ color: "#ccc", fontSize: 10, letterSpacing: 1 }}>SPECTATEURS EN DIRECT</div>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: "bold", lineHeight: 1.1 }}>{formatViews(views)}</div>
      </div>

      {/* PV — bas-gauche, barre + valeur. Couleur d'alerte identique au
          codage déjà établi par `DebugPanel` (vert/orange/rouge). */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: 16,
          fontFamily: "monospace",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <div style={{ color: "#ccc", fontSize: 10, textShadow: HUD_TEXT_SHADOW, marginBottom: 2 }}>PV</div>
        <div
          style={{
            width: 160,
            height: 14,
            background: "rgba(0,0,0,0.5)",
            border: "1px solid #444",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(1, hpRatio)) * 100}%`,
              height: "100%",
              background: hpColor(hpRatio),
              transition: "width 120ms linear",
            }}
          />
        </div>
        <div style={{ color: "#fff", fontSize: 13, textShadow: HUD_TEXT_SHADOW, marginTop: 2 }}>
          {`${Math.max(0, Math.round(playerHp))} / ${playerMaxHp}`}
        </div>
      </div>

      {/* Munitions — bas-droite, symétrique des PV. */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          fontFamily: "monospace",
          textAlign: "right",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <div style={{ color: "#ccc", fontSize: 10, textShadow: HUD_TEXT_SHADOW, marginBottom: 2 }}>MUNITIONS</div>
        <div style={{ color: "#fff", fontSize: 16, fontWeight: "bold", textShadow: HUD_TEXT_SHADOW }}>
          {ammoLabel(activeWeapon, shotgunAmmo, shotgunMaxAmmo)}
        </div>
      </div>
    </>
  );
}
