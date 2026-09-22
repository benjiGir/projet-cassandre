import { useEffect, useState } from "react";

import {
  ACTION_LABELS,
  ALL_ACTIONS,
  DEFAULT_BINDINGS,
  formatKeyCode,
  input,
  type GameAction,
} from "../core/input";
import { isMusicEnabled, setMusicEnabled } from "../core/music";
import {
  RESOLUTION_PRESETS,
  getFactoryDefaults,
  getGraphicsSettings,
  resetGraphicsSettings,
  setGraphicsSettings,
  type GraphicsSettings,
} from "./graphicsSettings";

/**
 * Écran "Options" — deux onglets dans un seul écran : CONTRÔLES (rebinding
 * de touches + musique) et AFFICHAGE (réglages graphiques et visuels,
 * `graphicsSettings.ts`). Un seul écran plutôt que deux séparés : les deux
 * sont de la même famille ("Options" depuis le menu principal), et un seul
 * bouton RETOUR partagé évite de dupliquer la navigation.
 *
 * Consomme l'API de `core/input.ts`/`core/music.ts` sans les modifier.
 * Accessible uniquement depuis le menu principal (`MainMenu`, "Options"),
 * donc toujours avant `input.attach(canvas)`. Ni `input.getAllBindings()`
 * ni `isMusicEnabled()` ni `getGraphicsSettings()` ne sont réactifs (pas du
 * zustand) : les états locaux ci-dessous sont des copies, resynchronisées
 * explicitement après chaque changement. Le réglage musique reste aussi
 * accessible en jeu via la touche fixe M (`game/loop/updateFx.ts`) — cet
 * écran sert surtout à sa découvrabilité.
 *
 * **Limite connue de l'onglet Affichage, assumée** : il n'existe pas de menu
 * de pause (invariant #9) — les réglages ne se changent que depuis le menu
 * principal, avant de jouer. Le filtrage et la résolution interne se
 * persistent au clic mais ne s'appliquent réellement qu'au prochain boot
 * (`main.ts`, une fois `scene`/`camera`/`renderer` construits) ; le FOV et
 * le screenshake, eux, s'appliquent immédiatement (voir `graphicsSettings.ts`).
 *
 * see: docs/systems/hud.md#options-contrôles-et-affichage
 * see: docs/reference/controles.md
 */

export interface RebindScreenProps {
  onBack: () => void;
}

type OptionsTab = "controles" | "affichage";

export function RebindScreen(props: RebindScreenProps) {
  const { onBack } = props;
  const [tab, setTab] = useState<OptionsTab>("controles");

  return (
    <div className="rs-root">
      <style>{RS_CSS}</style>
      <div className="rs-scanlines" />
      <div className="rs-rec">
        <span className="rs-dot" /> CONFIGURATION DU SIGNAL
      </div>

      <div className="rs-panel">
        <div className="rs-corner rs-corner-tl" />
        <div className="rs-corner rs-corner-tr" />
        <div className="rs-corner rs-corner-bl" />
        <div className="rs-corner rs-corner-br" />

        <div className="rs-title">PARAMÈTRES</div>

        <div className="rs-tabs">
          <button className="rs-tab" data-active={tab === "controles"} onClick={() => setTab("controles")}>
            CONTRÔLES
          </button>
          <button className="rs-tab" data-active={tab === "affichage"} onClick={() => setTab("affichage")}>
            AFFICHAGE
          </button>
        </div>

        {tab === "controles" ? <ControlsTab /> : <DisplayTab />}

        <div className="rs-buttons">
          <button className="rs-btn rs-btn-primary" onClick={onBack}>
            ◀ RETOUR
          </button>
        </div>
      </div>
    </div>
  );
}

/* ————————————————————————————————————————————————————————————————————
 * Onglet CONTRÔLES — rebinding de touches + musique.
 * ———————————————————————————————————————————————————————————————————— */
function ControlsTab() {
  const [bindings, setBindings] = useState<Record<GameAction, string>>(() => input.getAllBindings());
  const [listeningFor, setListeningFor] = useState<GameAction | null>(null);
  const [musicEnabled, setMusicEnabledState] = useState(() => isMusicEnabled());

  function handleToggleMusic() {
    const next = !musicEnabled;
    setMusicEnabled(next);
    setMusicEnabledState(next);
  }

  // Capture LA PROCHAINE touche/bouton une fois qu'un rebind est demandé.
  // Attaché/détaché via `listeningFor` : rien n'écoute tant qu'aucun rebind
  // n'est en cours (pas de coût, pas de conflit avec d'éventuels autres
  // listeners `window`).
  useEffect(() => {
    if (!listeningFor) return;

    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === "Escape") {
        // Échap ANNULE la capture, ne rebind jamais vers "Escape" lui-même
        // (garderait le joueur sans moyen évident de sortir d'un rebind raté).
        setListeningFor(null);
        return;
      }
      // `e.code` vide : jamais produit par un vrai clavier physique, mais
      // certains événements synthétiques (outils d'accessibilité,
      // automatisation) peuvent en émettre un. Sans cette garde, un rebind
      // vers "" corromprait silencieusement l'action (plus aucune touche ne
      // la déclenche, `formatKeyCode("")` affiche un bouton vide) jusqu'à ce
      // que le joueur pense à "Réinitialiser".
      if (!e.code) return;
      input.rebind(listeningFor, e.code);
      setBindings(input.getAllBindings());
      setListeningFor(null);
    };

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      const code = e.button === 0 ? "Mouse0" : e.button === 2 ? "Mouse2" : null;
      if (!code) return; // clic milieu/latéral ignoré — pas de code stable dans `formatKeyCode`
      input.rebind(listeningFor, code);
      setBindings(input.getAllBindings());
      setListeningFor(null);
    };

    // `contextmenu` : un rebind vers le clic droit ne doit pas non plus
    // ouvrir le menu contextuel du navigateur pendant la capture.
    const onContextMenu = (e: Event) => e.preventDefault();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [listeningFor]);

  function handleReset() {
    input.resetBindings();
    setBindings(input.getAllBindings());
    setListeningFor(null);
  }

  return (
    <>
      <div className="rs-row">
        <div className="rs-label">Nappe / musique</div>
        <button className="rs-toggle" onClick={handleToggleMusic} data-on={musicEnabled}>
          {musicEnabled ? "ACTIVÉE" : "COUPÉE"}
        </button>
        <div className="rs-hint">(touche M en jeu)</div>
      </div>

      <div className="rs-section-title">CANAUX D'ENTRÉE</div>
      <div className="rs-hint" style={{ marginTop: -6, marginBottom: 4 }}>
        AZERTY (ZQSD) fonctionne déjà par défaut — ceci remappe au-delà. Échap annule une capture.
      </div>

      <div className="rs-grid">
        {ALL_ACTIONS.map((action) => {
          const isListening = listeningFor === action;
          const isDefault = bindings[action] === DEFAULT_BINDINGS[action];
          return (
            <div key={action} className="rs-grid-row">
              <div className="rs-action-label">{ACTION_LABELS[action]}</div>
              <button
                className="rs-key"
                data-listening={isListening}
                data-modified={!isDefault}
                onClick={() => setListeningFor(action)}
              >
                {isListening ? "◉ EN ATTENTE…" : formatKeyCode(bindings[action])}
              </button>
            </div>
          );
        })}
      </div>

      <div className="rs-tab-buttons">
        <button className="rs-btn" onClick={handleReset}>
          ↺ RÉINITIALISER LES TOUCHES
        </button>
      </div>
    </>
  );
}

/* ————————————————————————————————————————————————————————————————————
 * Onglet AFFICHAGE — réglages graphiques et visuels (`graphicsSettings.ts`).
 * Quatre réglages choisis par l'utilisateur, pas un panneau générique.
 * ———————————————————————————————————————————————————————————————————— */

const FILTRAGE_OPTIONS: { id: GraphicsSettings["filtrage"]; label: string; hint: string }[] = [
  {
    id: "nearest",
    label: "Gros pixel partout, y compris au loin",
    hint: "Réglage d'origine du jeu. Les surfaces lointaines scintillent un peu plus quand la caméra bouge.",
  },
  {
    id: "mipmap",
    label: "Gros pixel de près, lissé au loin",
    hint: "Moins de scintillement au loin. Les sols vus de biais restent flous.",
  },
  {
    id: "aniso",
    label: "Gros pixel de près, net même en rasant",
    hint: "Comme ci-dessus, en plus net sur les sols et couloirs vus de côté. Réglage actuel du jeu.",
  },
];

function DisplayTab() {
  const [settings, setSettings] = useState<GraphicsSettings>(() => getGraphicsSettings());
  const defaults = getFactoryDefaults();

  function handleReset() {
    setSettings(resetGraphicsSettings());
  }

  return (
    <>
      <div className="rs-section-title">FILTRAGE DES TEXTURES LOINTAINES</div>
      <div className="rs-hint" style={{ marginTop: -6, marginBottom: 6 }}>
        Ne change rien à la netteté de près — le gros pixel franc reste la
        règle (invariant #4). Change seulement le rendu des surfaces vues de
        loin ou de biais.
      </div>
      <div className="rs-seg rs-seg-col">
        {FILTRAGE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            className="rs-seg-btn"
            data-active={settings.filtrage === opt.id}
            onClick={() => setSettings(setGraphicsSettings({ filtrage: opt.id }))}
          >
            <span className="rs-seg-btn-label">{opt.label}</span>
            <span className="rs-seg-btn-hint">{opt.hint}</span>
          </button>
        ))}
      </div>

      <div className="rs-section-title">RÉSOLUTION INTERNE</div>
      <div className="rs-hint" style={{ marginTop: -6, marginBottom: 6 }}>
        {`${RESOLUTION_PRESETS[0].width}×${RESOLUTION_PRESETS[0].height} est la résolution d'ORIGINE du jeu (invariant #4) — les valeurs au-delà sont une comparaison, pas une amélioration.`}
      </div>
      <div className="rs-seg">
        {RESOLUTION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className="rs-seg-btn rs-seg-btn-compact"
            data-active={settings.resolution === preset.id}
            onClick={() => setSettings(setGraphicsSettings({ resolution: preset.id }))}
          >
            {preset.width}×{preset.height}
          </button>
        ))}
      </div>

      <div className="rs-section-title">CHAMP DE VISION</div>
      <div className="rs-hint" style={{ marginTop: -6, marginBottom: 6 }}>
        Valeur au repos — s'élargit déjà automatiquement à la course, ce réglage ne touche que la base.
      </div>
      <div className="rs-slider-row">
        <input
          className="rs-slider"
          type="range"
          min={60}
          max={100}
          step={1}
          value={settings.fovBase}
          onChange={(e) => setSettings(setGraphicsSettings({ fovBase: Number(e.target.value) }))}
        />
        <div className="rs-slider-num">{`${Math.round(settings.fovBase)}°`}</div>
      </div>

      <div className="rs-section-title">INTENSITÉ DU SCREENSHAKE</div>
      <div className="rs-hint" style={{ marginTop: -6, marginBottom: 6 }}>
        Secousse de la caméra sur un impact (mur ou ennemi). 100 % = intensité d'origine, 0 % = désactivée.
      </div>
      <div className="rs-slider-row">
        <input
          className="rs-slider"
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(settings.shakeIntensity * 100)}
          onChange={(e) => setSettings(setGraphicsSettings({ shakeIntensity: Number(e.target.value) / 100 }))}
        />
        <div className="rs-slider-num">{`${Math.round(settings.shakeIntensity * 100)} %`}</div>
      </div>

      <div className="rs-tab-buttons">
        <button className="rs-btn" onClick={handleReset}>
          {`↺ RÉINITIALISER L'AFFICHAGE (${defaults.fovBase}°, ${Math.round(defaults.shakeIntensity * 100)} %)`}
        </button>
      </div>
    </>
  );
}

const RS_CSS = `
.rs-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: auto;
  background: radial-gradient(ellipse at 50% 35%, #0c130c 0%, #050705 70%, #020302 100%);
  color: #bfe8bf;
  font-family: "Courier New", ui-monospace, monospace;
  display: flex;
  /* "safe center" et pas "center" : l'onglet Affichage (4 réglages) dépasse
     720px de haut sur un écran 720p — mesuré à 852px pour 720 de viewport.
     Un "center" nu dans un conteneur scrollable écrête le HAUT du panneau
     (le titre, les onglets) sans qu'aucun scroll ne puisse jamais
     l'atteindre (scrollTop reste bloqué à 0, bug de centrage flex +
     overflow bien connu, constaté ici en DOM avant ce correctif). "safe"
     bascule vers un alignement en haut dès que le contenu déborde, pour que
     le scroll fonctionne réellement. */
  align-items: safe center;
  justify-content: center;
  overflow: auto;
  padding: 24px 0;
}
.rs-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(120,255,140,0.05) 0px, rgba(120,255,140,0.05) 1px, transparent 2px, transparent 4px);
  mix-blend-mode: screen;
}
.rs-rec {
  position: absolute;
  top: 18px;
  left: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  letter-spacing: 2px;
  color: #f66;
}
.rs-dot { width: 8px; height: 8px; border-radius: 50%; background: #f33; box-shadow: 0 0 8px #f33; animation: rs-blink 1.1s steps(1) infinite; }
@keyframes rs-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.15; } }
.rs-panel {
  position: relative;
  width: 520px;
  max-width: 92vw;
  padding: 40px 46px 30px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(10, 18, 10, 0.55);
  border: 1px solid rgba(140, 255, 150, 0.25);
}
.rs-corner { position: absolute; width: 20px; height: 20px; border: 2px solid #6f6; opacity: 0.85; }
.rs-corner-tl { top: -2px; left: -2px; border-right: none; border-bottom: none; }
.rs-corner-tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
.rs-corner-bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }
.rs-corner-br { bottom: -2px; right: -2px; border-left: none; border-top: none; }
.rs-title { font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #6bffa0; text-shadow: 0 0 12px rgba(90,255,140,0.5); text-align: center; margin-bottom: 4px; }
.rs-tabs { display: flex; gap: 8px; justify-content: center; margin-bottom: 8px; }
.rs-tab {
  padding: 7px 20px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #7fae7f;
  background: rgba(120,255,140,0.04);
  border: 1px solid rgba(140,255,150,0.25);
  cursor: pointer;
}
.rs-tab[data-active="true"] { color: #eafff0; background: rgba(120,255,140,0.14); border-color: #7fff9e; }
.rs-row { display: flex; align-items: center; gap: 12px; justify-content: center; }
.rs-label { font-size: 12px; letter-spacing: 1px; min-width: 130px; }
.rs-hint { font-size: 10.5px; color: #5a8a5a; text-align: center; line-height: 1.5; }
.rs-toggle {
  padding: 5px 14px;
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 1px;
  color: #9c9;
  background: rgba(120,255,140,0.05);
  border: 1px solid rgba(140,255,150,0.3);
  cursor: pointer;
}
.rs-toggle[data-on="true"] { color: #eafff0; border-color: #7fff9e; box-shadow: 0 0 10px rgba(90,255,140,0.25) inset; }
.rs-section-title { margin-top: 10px; font-size: 13px; letter-spacing: 2px; color: #7fae7f; text-align: center; border-top: 1px solid rgba(140,255,150,0.2); padding-top: 12px; }
.rs-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 20px; row-gap: 6px; }
.rs-grid-row { display: contents; }
.rs-action-label { font-size: 11.5px; align-self: center; color: #a8d0a8; }
.rs-key {
  padding: 5px 10px;
  font-family: inherit;
  font-size: 11.5px;
  letter-spacing: 0.5px;
  color: #bfe8bf;
  background: rgba(120,255,140,0.04);
  border: 1px solid rgba(140,255,150,0.25);
  cursor: pointer;
  text-align: left;
}
.rs-key[data-listening="true"] { background: #163a1c; color: #eafff0; border-color: #7fff9e; }
.rs-key[data-modified="true"] { color: #ffe27a; border-color: rgba(255,226,122,0.4); }
.rs-seg { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.rs-seg-col { flex-direction: column; align-items: stretch; }
.rs-seg-btn {
  padding: 8px 12px;
  font-family: inherit;
  font-size: 11.5px;
  color: #bfe8bf;
  background: rgba(120,255,140,0.04);
  border: 1px solid rgba(140,255,150,0.25);
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rs-seg-btn-compact { text-align: center; align-items: center; padding: 7px 14px; }
.rs-seg-btn[data-active="true"] { background: #163a1c; border-color: #7fff9e; color: #eafff0; }
.rs-seg-btn-label { font-weight: 700; letter-spacing: 0.5px; }
.rs-seg-btn-hint { font-size: 10px; color: #7fae7f; line-height: 1.4; }
.rs-seg-btn[data-active="true"] .rs-seg-btn-hint { color: #a8d0a8; }
.rs-slider-row { display: flex; align-items: center; gap: 12px; justify-content: center; }
.rs-slider { flex: 1; max-width: 300px; accent-color: #6bffa0; }
.rs-slider-num { min-width: 48px; text-align: right; font-size: 13px; font-weight: 700; color: #eafff0; }
.rs-tab-buttons { display: flex; justify-content: center; margin-top: 14px; }
.rs-buttons { display: flex; justify-content: center; gap: 12px; margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(140,255,150,0.15); }
.rs-btn {
  padding: 9px 18px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #bfe8bf;
  background: rgba(120,255,140,0.05);
  border: 1px solid rgba(140,255,150,0.35);
  cursor: pointer;
}
.rs-btn:hover { background: rgba(120,255,140,0.14); }
.rs-btn-primary { border-color: #7fff9e; color: #eafff0; }
`;
