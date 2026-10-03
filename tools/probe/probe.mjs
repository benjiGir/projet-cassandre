/**
 * Sonde de jeu headless — PROJET_CASSANDRE.
 *
 *   pnpm probe                          # les poses de tools/probe/poses.json
 *   pnpm probe -- --pose 0,60,0,180     # une pose : x,y,z,cap (repère Blender)
 *   pnpm probe -- --url http://localhost:5173   # réutilise un serveur de dev
 *
 * Lance le jeu, démarre une partie, puis pour chaque pose : `cassandre.tp`,
 * quelques images, `cassandre.renderBench`. Rend UN JSON sur stdout, sans
 * capture ni log — ce que coûtait une série d'appels navigateur à la main.
 *
 * `drawCalls` : tout ce que le jeu dessine ; `niveau` : sans les sprites
 * d'ennemis (49 quads, un lot chacun) — la part que la construction du niveau
 * commande. Ce sont des indicateurs : aucun plafond ne s'y applique (ADR 0039).
 *
 * Utilise le Chrome installé (`channel: "chrome"`) : rien à télécharger.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";
import { createServer } from "vite";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "../..");

function lireArgs(argv) {
  const args = { poses: [], url: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") args.url = argv[++i];
    else if (argv[i] === "--pose") {
      const [x, y, z, cap] = argv[++i].split(",").map(Number);
      args.poses.push([`${x},${y},${z},${cap}`, [x, y, z, cap]]);
    }
  }
  return args;
}

const args = lireArgs(process.argv.slice(2).filter((a) => a !== "--"));
if (args.poses.length === 0) {
  const nommees = JSON.parse(await readFile(resolve(ICI, "poses.json"), "utf8"));
  args.poses = Object.entries(nommees);
}

let serveur = null;
let url = args.url;
if (!url) {
  serveur = await createServer({ root: RACINE, logLevel: "silent", server: { port: 5199, strictPort: false } });
  await serveur.listen();
  url = serveur.resolvedUrls.local[0];
}

const navigateur = await chromium.launch({ channel: "chrome", headless: true });
const erreurs = [];
try {
  const page = await navigateur.newPage({ viewport: { width: 960, height: 540 } });
  page.on("pageerror", (e) => erreurs.push(String(e).slice(0, 200)));
  await page.goto(url);
  await page.getByRole("button", { name: /rejoindre le direct/i }).click();
  await page.waitForFunction(() => window.cassandre?.level.stats() != null, null, { timeout: 120_000 });

  const mesures = await page.evaluate(async (poses) => {
    const c = window.cassandre;
    c.notarget(true);
    const images = (n) => new Promise((ok) => {
      const pas = () => (n-- > 0 ? requestAnimationFrame(pas) : ok());
      pas();
    });
    // Les sprites d'ennemis : quads 2,5 × 2 à la racine de la scène.
    let racine = c.doors()[0].object;
    while (racine.parent) racine = racine.parent;
    const sprites = racine.children.filter((o) => o.isMesh && o.geometry?.parameters?.width === 2.5 && o.geometry?.parameters?.height === 2);

    const sortie = [];
    for (const [nom, [x, y, z, cap]] of poses) {
      c.tp(x, y, z, cap);
      await images(20); // la caméra suit le joueur à l'affichage, pas au tp
      const total = c.renderBench(2);
      const vus = sprites.map((o) => o.visible);
      sprites.forEach((o) => (o.visible = false));
      const niveau = c.renderBench(2).drawCalls;
      sprites.forEach((o, i) => (o.visible = vus[i]));
      sortie.push({ pose: nom, drawCalls: total.drawCalls, niveau, triangles: total.triangles });
    }
    return sortie;
  }, args.poses);

  const pire = mesures.reduce((a, b) => (b.drawCalls > a.drawCalls ? b : a));
  console.log(JSON.stringify({ pire: pire.pose, mesures, erreurs }));
} finally {
  await navigateur.close();
  await serveur?.close();
}
