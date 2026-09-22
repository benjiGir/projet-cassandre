import { useGameStore } from "../game/state";
import { vpx } from "./hudScale";

/**
 * HUD de production — overlay de STREAM, pas un HUD de FPS classique.
 * Distinct de `DebugPanel` (outil de dev, toujours monté à côté).
 *
 * Webcam factice + compteur de spectateurs en haut-droite, PV en bas-gauche,
 * munitions en bas-droite : c'est le dispositif "salle de contrôle / signal
 * intercepté" qui donne aussi son habillage au menu principal et aux écrans
 * de mort/fin de niveau — une seule identité visuelle pour tout le jeu,
 * jamais un choix à faire. `pointerEvents: "none"` partout, sans exception —
 * c'est le calque au-dessus du jeu, un clic intercepté casse la visée.
 * see: docs/systems/hud.md#hud-de-production
 */

const HP_OK_COLOR = "#3f3";
const HP_WARN_COLOR = "#fa3";
const HP_CRITICAL_COLOR = "#f44";

function hpColor(ratio: number): string {
  if (ratio <= 0.25) return HP_CRITICAL_COLOR;
  if (ratio <= 0.5) return HP_WARN_COLOR;
  return HP_OK_COLOR;
}

/** Libellé de la ligne "munitions" — dépend de l'arme active, pas seulement du compte de cartouches (un pied-de-biche n'a pas de munitions, un joueur désarmé encore moins). */
function ammoLabel(
  activeWeapon: "none" | "melee" | "pistol" | "shotgun",
  shotgunAmmo: number,
  shotgunMaxAmmo: number,
  pistolAmmo: number,
  pistolMaxAmmo: number,
): string {
  if (activeWeapon === "shotgun") return `${shotgunAmmo} / ${shotgunMaxAmmo}`;
  if (activeWeapon === "pistol") return `${pistolAmmo} / ${pistolMaxAmmo}`;
  if (activeWeapon === "melee") return "PIED-DE-BICHE";
  return "À MAINS NUES";
}

/** Formate un compteur de vues avec séparateur de milliers façon compteur de stream ("12 480" plutôt que "12480") — lisible d'un coup d'œil, léger clin d'œil à l'esthétique overlay de live. */
function formatViews(n: number): string {
  return n.toLocaleString("fr-FR");
}

const CARD_COLORS: Record<"argent" | "or" | "platine", string> = {
  argent: "#c8ccd4",
  or: "#e8b53d",
  platine: "#9fe8e8",
};

const CARD_SHORT_LABELS: Record<"argent" | "or" | "platine", string> = {
  argent: "ARGENT",
  or: "OR",
  platine: "PLATINE",
};

interface HudData {
  playerHp: number;
  playerMaxHp: number;
  hpRatio: number;
  shotgunAmmo: number;
  shotgunMaxAmmo: number;
  pistolAmmo: number;
  pistolMaxAmmo: number;
  activeWeapon: "none" | "melee" | "pistol" | "shotgun";
  views: number;
  cards: readonly ("argent" | "or" | "platine")[];
}

export function Hud() {
  const playerHp = useGameStore((s) => s.debug.playerHp);
  const playerMaxHp = useGameStore((s) => s.debug.playerMaxHp);
  const shotgunAmmo = useGameStore((s) => s.debug.shotgunAmmo);
  const shotgunMaxAmmo = useGameStore((s) => s.debug.shotgunMaxAmmo);
  const pistolAmmo = useGameStore((s) => s.debug.pistolAmmo);
  const pistolMaxAmmo = useGameStore((s) => s.debug.pistolMaxAmmo);
  const activeWeapon = useGameStore((s) => s.debug.activeWeapon);
  const views = useGameStore((s) => s.debug.views);
  const cards = useGameStore((s) => s.debug.cards);

  const hpRatio = playerMaxHp > 0 ? playerHp / playerMaxHp : 0;
  const d: HudData = {
    playerHp,
    playerMaxHp,
    hpRatio,
    shotgunAmmo,
    shotgunMaxAmmo,
    pistolAmmo,
    pistolMaxAmmo,
    activeWeapon,
    views,
    cards,
  };
  const ammoText = ammoLabel(d.activeWeapon, d.shotgunAmmo, d.shotgunMaxAmmo, d.pistolAmmo, d.pistolMaxAmmo);

  return (
    <>
      <style>{HUD_CSS}</style>
      {/* Caméra + compteur EMPILÉS DANS LE FLUX d'un même conteneur fixe —
          jamais deux `position: fixed` indépendants avec des `top` devinés.
          La hauteur réelle du bloc caméra dépend de la police et de la
          longueur de la légende ; un `top` en dur pour le bloc suivant
          suppose cette hauteur au lieu de la lire. Voir le même commentaire
          sur `.hud-topright` ci-dessous et `HeroLine.tsx`, positionné juste
          en dessous. */}
      <div className="hud-topright">
        <div className="hud-cam">
          <div className="hud-cam-box">
            <div className="hud-cam-corner hud-cam-corner-tl" />
            <div className="hud-cam-corner hud-cam-corner-tr" />
            <div className="hud-cam-corner hud-cam-corner-bl" />
            <div className="hud-cam-corner hud-cam-corner-br" />
            <div className="hud-cam-silhouette-body" />
            <div className="hud-cam-silhouette-head" />
            <div className="hud-cam-rec">
              <span className="hud-cam-dot" /> EN DIRECT
            </div>
          </div>
          <div className="hud-cam-caption">RÉVEIL_DU_PEUPLE — 200 abonnés</div>
        </div>

        <div className="hud-views">
          <div className="hud-views-label">SPECTATEURS EN DIRECT</div>
          <div className="hud-views-num">{formatViews(d.views)}</div>
        </div>
      </div>

      <div className="hud-bl">
        {d.cards.length > 0 && (
          <div className="hud-cards">
            {d.cards.map((c) => (
              <div key={c} className="hud-card" style={{ borderColor: CARD_COLORS[c], color: CARD_COLORS[c] }}>
                {CARD_SHORT_LABELS[c]}
              </div>
            ))}
          </div>
        )}
        <div className="hud-label">PV</div>
        <div className="hud-hp-track">
          <div
            className="hud-hp-fill"
            style={{ width: `${Math.max(0, Math.min(1, d.hpRatio)) * 100}%`, background: hpColor(d.hpRatio) }}
          />
        </div>
        <div className="hud-hp-num">{`${Math.max(0, Math.round(d.playerHp))} / ${d.playerMaxHp}`}</div>
      </div>

      <div className="hud-br">
        <div className="hud-label">MUNITIONS</div>
        <div className="hud-ammo">{ammoText}</div>
      </div>
    </>
  );
}

/**
 * Toutes les tailles ci-dessous sont en pixels virtuels (`vpx`, `hudScale.ts`).
 *
 * Passe de réduction du 2026-09-22 : la première passe avait les chiffres
 * vitaux à 6,67 % de la hauteur d'écran et le bloc webcam+compteur à 33,4 %
 * (mesuré en DOM, pas à l'œil) — direction juste, valeur excessive. Cibles
 * de cette passe : chiffres vitaux ~5 % (`vpx(16)`, contre `vpx(24)`),
 * libellés ~3,1 % (`vpx(10)`, contre `vpx(13)`), bloc webcam sous 20 %
 * (webcam ramenée à 50×22, marges resserrées). Mesuré en DOM
 * (`getBoundingClientRect`, pas à l'œil) aux trois résolutions 16:9
 * habituelles (1280×720, 1920×1080, 2560×1440 — le rapport ne bouge pas,
 * c'est tout le principe de `vpx`) : chiffres vitaux 5,0-5,05 %, bloc
 * webcam+compteur 17,9-17,94 %. Revérifier ces deux nombres en DOM après
 * tout futur changement de ce fichier — l'œil ne les juge pas fiablement à
 * cette échelle.
 */
const HUD_CSS = `
.hud-topright { position: fixed; top: ${vpx(3)}; right: ${vpx(5)}; display: flex; flex-direction: column; align-items: flex-end; pointer-events: none; user-select: none; font-family: "Courier New", ui-monospace, monospace; }
.hud-cam { width: ${vpx(50)}; }
.hud-cam-box { position: relative; width: ${vpx(50)}; height: ${vpx(22)}; background: rgba(6,12,6,0.65); border: ${vpx(1)} solid rgba(140,255,150,0.4); overflow: hidden; }
.hud-cam-corner { position: absolute; width: ${vpx(6)}; height: ${vpx(6)}; border: ${vpx(1)} solid #7fff9e; opacity: 0.9; }
.hud-cam-corner-tl { top: ${vpx(1)}; left: ${vpx(1)}; border-right: none; border-bottom: none; }
.hud-cam-corner-tr { top: ${vpx(1)}; right: ${vpx(1)}; border-left: none; border-bottom: none; }
.hud-cam-corner-bl { bottom: ${vpx(1)}; left: ${vpx(1)}; border-right: none; border-top: none; }
.hud-cam-corner-br { bottom: ${vpx(1)}; right: ${vpx(1)}; border-left: none; border-top: none; }
.hud-cam-silhouette-body { position: absolute; left: 50%; bottom: ${vpx(-3)}; transform: translateX(-50%); width: ${vpx(27)}; height: ${vpx(10)}; background: #163a1c; border-radius: 50% 50% 0 0 / 60% 60% 0 0; }
.hud-cam-silhouette-head { position: absolute; left: 50%; top: ${vpx(3)}; transform: translateX(-50%); width: ${vpx(9)}; height: ${vpx(9)}; border-radius: 50%; background: #1e4a26; }
.hud-cam-rec { position: absolute; top: ${vpx(1.2)}; left: ${vpx(1.2)}; display: flex; align-items: center; gap: ${vpx(1.2)}; background: rgba(0,0,0,0.6); padding: ${vpx(0.6)} ${vpx(1.4)}; color: #dff; font-size: ${vpx(6.5)}; font-weight: bold; letter-spacing: 0.5px; white-space: nowrap; }
.hud-cam-dot { width: ${vpx(2.4)}; height: ${vpx(2.4)}; border-radius: 50%; background: #f33; box-shadow: 0 0 ${vpx(2)} #f33; animation: hud-blink 1.1s steps(1) infinite; }
@keyframes hud-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.2; } }
.hud-cam-caption { margin-top: ${vpx(1)}; color: #7fae7f; font-size: ${vpx(8)}; text-shadow: 1px 1px 2px #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hud-views { margin-top: ${vpx(1.5)}; text-align: right; text-shadow: 1px 1px 2px #000; }
.hud-views-label { color: #7fae7f; font-size: ${vpx(10)}; letter-spacing: 1px; }
.hud-views-num { color: #bfe8bf; font-size: ${vpx(16)}; font-weight: bold; line-height: 1.1; text-shadow: 0 0 ${vpx(3)} rgba(90,255,140,0.4); }
.hud-bl { position: fixed; bottom: ${vpx(6)}; left: ${vpx(6)}; font-family: "Courier New", ui-monospace, monospace; pointer-events: none; user-select: none; }
.hud-br { position: fixed; bottom: ${vpx(6)}; right: ${vpx(6)}; text-align: right; font-family: "Courier New", ui-monospace, monospace; pointer-events: none; user-select: none; }
.hud-label { color: #7fae7f; font-size: ${vpx(10)}; letter-spacing: 1px; text-shadow: 1px 1px 2px #000; margin-bottom: ${vpx(2)}; }
.hud-cards { display: flex; gap: ${vpx(2)}; margin-bottom: ${vpx(3)}; }
.hud-card { padding: ${vpx(1.5)} ${vpx(4)}; font-size: ${vpx(9)}; font-weight: bold; letter-spacing: 1px; background: rgba(0,0,0,0.5); border: ${vpx(1)} solid; }
.hud-hp-track { width: ${vpx(60)}; height: ${vpx(7)}; background: rgba(0,0,0,0.5); border: ${vpx(1)} solid rgba(140,255,150,0.35); overflow: hidden; }
.hud-hp-fill { height: 100%; transition: width 120ms linear; }
.hud-hp-num { color: #bfe8bf; font-size: ${vpx(16)}; font-weight: bold; text-shadow: 1px 1px 2px #000; margin-top: ${vpx(1.5)}; }
.hud-ammo { color: #bfe8bf; font-size: ${vpx(16)}; font-weight: bold; text-shadow: 1px 1px 2px #000; }
`;
