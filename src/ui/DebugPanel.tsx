import { useGameStore } from "../game/state";

/**
 * Décimales fixes + largeur fixe (padStart) : un nombre qui gagne ou perd un
 * chiffre ne doit pas faire trembler le panneau pendant qu'on court.
 */
function fmt(n: number, decimals = 2, width = 6): string {
  return n.toFixed(decimals).padStart(width, " ");
}

const GROUNDED_COLOR = "#3f3";
const AIRBORNE_COLOR = "#f44";
const OK_COLOR = "#0f0";
const WARN_COLOR = "#fa3";

// En dessous, la normale du sol indique une pente trop raide pour être un
// sol franc (utile pour repérer un faux `isGrounded` sur terrain incliné).
const FLAT_NORMAL_Y_THRESHOLD = 0.7;

// Nombre de pas fixes par frame au-delà duquel on considère une spirale de
// rattrapage (cf. skill `rapier-character-controller`).
const STEPS_WARNING_THRESHOLD = 2;

export function DebugPanel() {
  const debug = useGameStore((state) => state.debug);

  const groundedColor = debug.isGrounded ? GROUNDED_COLOR : AIRBORNE_COLOR;
  const groundedGlyph = debug.isGrounded ? "●" : "○";
  const groundedLabel = debug.isGrounded ? "SOL" : "AIR";

  const stepsWarning = debug.steps > STEPS_WARNING_THRESHOLD;
  const stepsColor = stepsWarning ? WARN_COLOR : OK_COLOR;

  const normalColor = debug.groundNormal.y >= FLAT_NORMAL_Y_THRESHOLD ? OK_COLOR : WARN_COLOR;

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        padding: "6px 10px",
        background: "rgba(0, 0, 0, 0.6)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 1.6,
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    >
      <div>{`FPS: ${debug.fps.toFixed(0).padStart(3, " ")}`}</div>
      <div>{`Pos: ${fmt(debug.position.x)}, ${fmt(debug.position.y)}, ${fmt(debug.position.z)}`}</div>
      <div>{`Entities: ${String(debug.entityCount).padStart(3, " ")}`}</div>
      <div>
        <span style={{ color: groundedColor, fontWeight: "bold" }}>
          {`${groundedGlyph} ${groundedLabel}`}
        </span>
        {`  H:${fmt(debug.horizontalSpeed)} m/s  V:${fmt(debug.verticalSpeed)} m/s`}
      </div>
      <div>
        {`Collisions: ${String(debug.numCollisions).padStart(2, " ")}   `}
        <span style={{ color: stepsColor, fontWeight: stepsWarning ? "bold" : "normal" }}>
          {`Steps: ${String(debug.steps).padStart(2, " ")}${stepsWarning ? " ⚠ rattrapage" : ""}`}
        </span>
      </div>
      <div>
        {"Normal Y: "}
        <span style={{ color: normalColor, fontWeight: "bold" }}>{fmt(debug.groundNormal.y, 3, 6)}</span>
        {`   (x ${fmt(debug.groundNormal.x)}, z ${fmt(debug.groundNormal.z)})`}
      </div>
    </div>
  );
}
