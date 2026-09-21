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
 * **Le reflet qui glisse sur la barre est une animation CSS de `transform`.**
 * Ce n'est pas de la décoration : construire les colliders et cuire le graphe
 * de navigation bloquent le fil principal, donc ni React ni un `setInterval`
 * ne peuvent rien redessiner pendant ce temps. Une animation de `transform`,
 * elle, tourne sur le compositeur et continue de bouger — c'est la seule chose
 * qui distingue « ça travaille » de « c'est planté » au pire moment.
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

const KEYFRAMES = `
@keyframes cassandre-reflet {
  from { transform: translateX(-100%); }
  to   { transform: translateX(400%); }
}`;

export interface LoadingScreenProps {
  title?: string;
}

export function LoadingScreen(props: LoadingScreenProps) {
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
  const pourcent = Math.round(progress * 100);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        background: "#0a0a0a",
        color: "#ddd",
        fontFamily: "monospace",
        pointerEvents: "auto",
        zIndex: 1000,
      }}
    >
      <style>{KEYFRAMES}</style>

      <div style={{ fontSize: 28, fontWeight: "bold", color: "#0f0", letterSpacing: 2 }}>
        {props.title ?? DEFAULT_TITLE}
      </div>

      <div style={{ width: 420, maxWidth: "80vw" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#8a8a8a",
            marginBottom: 6,
            letterSpacing: 1,
          }}
        >
          <span>{state?.label ?? "Initialisation…"}</span>
          <span>{pourcent} %</span>
        </div>

        <div
          style={{
            position: "relative",
            height: 10,
            background: "#1a1a1a",
            border: "1px solid #2e2e2e",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pourcent}%`,
              background: "#0f0",
              // Pas de transition sur la largeur : la progression réelle
              // arrive déjà par petits pas pendant le téléchargement, et une
              // transition la ferait traîner derrière la vérité.
              boxShadow: "0 0 8px rgba(0,255,0,0.35)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: "25%",
              background: "linear-gradient(90deg, transparent, rgba(0,255,0,0.18), transparent)",
              animation: "cassandre-reflet 1.6s linear infinite",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#7a7a7a", minHeight: "1.4em", textAlign: "center" }}>{quip}</div>
    </div>
  );
}
