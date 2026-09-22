import { useEffect, useState, useSyncExternalStore } from "react";

import { loadingSnapshot, subscribeLoading, type LoadingState } from "../core/loadingProgress";

/**
 * Écran de chargement — barre de progression réelle et petites phrases.
 *
 * Il existe parce que le niveau v2 pèse 29 Mo et que la boucle démarrait sans
 * l'attendre : on voyait le menu figé, puis un HUD sur une scène vide, puis le
 * décor apparaître d'un coup. Purement présentationnel, comme `MainMenu` et
 * `LevelMenu` : aucun import `src/game/*`, aucun accès au store zustand.
 *
 * **Le reflet/l'éclat qui glisse sur la barre est une animation CSS de
 * `transform`.** Ce n'est pas de la décoration : construire les colliders et
 * cuire le graphe de navigation bloquent le fil principal, donc ni React ni
 * un `setInterval` ne peuvent rien redessiner pendant ce temps. Une
 * animation de `transform`, elle, tourne sur le compositeur et continue de
 * bouger — c'est la seule chose qui distingue « ça travaille » de « c'est
 * planté » au pire moment.
 *
 * see: docs/systems/hud.md#écran-de-chargement
 */

const DEFAULT_TITLE = "PROJET_CASSANDRE";

/** Durée d'affichage d'une phrase, ms. */
const QUIP_MS = 2400;

/**
 * Les petites phrases. Ton du jeu : un hypermarché qui se prend très au
 * sérieux pendant qu'on le pille. Elles ne décrivent JAMAIS ce que fait
 * vraiment le chargement — c'est le libellé au-dessus de la barre qui le dit,
 * et confondre les deux rendrait la vraie information invisible.
 */
const QUIPS = [
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

export interface LoadingScreenProps {
  title?: string;
}

/** Progression réelle + rotation des phrases. */
function useLoadingContent(): { label: string; pourcent: number; quip: string } {
  const state = useSyncExternalStore<LoadingState | null>(subscribeLoading, loadingSnapshot, loadingSnapshot);

  // Point de départ tiré de l'horloge plutôt que de `Math.random()` : le
  // projet n'utilise nulle part le hasard non déterministe, et une rotation
  // qui commence toujours par la même phrase se remarque au troisième boot.
  const [first] = useState(() => Math.floor(Date.now() / QUIP_MS) % QUIPS.length);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), QUIP_MS);
    return () => clearInterval(id);
  }, []);

  const quip = QUIPS[(first + tick) % QUIPS.length];
  const progress = state?.progress ?? 0;
  return { label: state?.label ?? "Initialisation…", pourcent: Math.round(progress * 100), quip };
}

export function LoadingScreen(props: LoadingScreenProps) {
  const title = props.title ?? DEFAULT_TITLE;
  const { label, pourcent, quip } = useLoadingContent();

  return (
    <div className="ls-root">
      <style>{LS_CSS}</style>
      <div className="ls-scanlines" />
      <div className="ls-rec">
        <span className="ls-dot" /> ACQUISITION DU SIGNAL
      </div>

      <div className="ls-title">{title}</div>

      <div className="ls-bar-wrap">
        <div className="ls-bar-head">
          <span>{label}</span>
          <span>{pourcent} %</span>
        </div>
        <div className="ls-bar-track">
          <div className="ls-bar-fill" style={{ width: `${pourcent}%` }} />
          <div className="ls-bar-sheen" />
        </div>
      </div>

      <div className="ls-quip">{quip}</div>
    </div>
  );
}

const LS_CSS = `
.ls-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
  pointer-events: auto;
  background: radial-gradient(ellipse at 50% 40%, #0c130c 0%, #050705 70%, #020302 100%);
  color: #bfe8bf;
  font-family: "Courier New", ui-monospace, monospace;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  overflow: hidden;
}
.ls-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(120,255,140,0.05) 0px, rgba(120,255,140,0.05) 1px, transparent 2px, transparent 4px);
  mix-blend-mode: screen;
}
.ls-rec { display: flex; align-items: center; gap: 8px; font-size: 11px; letter-spacing: 2px; color: #f66; }
.ls-dot { width: 8px; height: 8px; border-radius: 50%; background: #f33; box-shadow: 0 0 8px #f33; animation: ls-blink 1.1s steps(1) infinite; }
@keyframes ls-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.15; } }
.ls-title { font-size: 28px; font-weight: 700; letter-spacing: 3px; color: #6bffa0; text-shadow: 0 0 12px rgba(90,255,140,0.5); }
.ls-bar-wrap { width: 420px; max-width: 80vw; }
.ls-bar-head { display: flex; justify-content: space-between; font-size: 12px; color: #7fae7f; margin-bottom: 6px; letter-spacing: 1px; }
.ls-bar-track { position: relative; height: 10px; background: #0e170e; border: 1px solid rgba(140,255,150,0.3); overflow: hidden; }
.ls-bar-fill { height: 100%; background: #3fdc6e; box-shadow: 0 0 8px rgba(90,255,140,0.4); }
.ls-bar-sheen {
  position: absolute; inset: 0; width: 25%;
  background: linear-gradient(90deg, transparent, rgba(120,255,140,0.25), transparent);
  animation: ls-sheen 1.6s linear infinite;
}
@keyframes ls-sheen { from { transform: translateX(-100%); } to { transform: translateX(500%); } }
.ls-quip { font-size: 13px; color: #6f9c6f; min-height: 1.4em; text-align: center; }
`;
