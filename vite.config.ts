import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

let buildOutputDir: string;

export default defineConfig({
  // Relatif plutôt qu'un chemin absolu en dur : fonctionne aussi bien servi
  // à la racine d'un domaine que sous un sous-chemin (page de PROJET GitHub
  // Pages, https://<user>.github.io/<repo>/) sans connaître le nom du repo
  // à l'avance. Les assets de `public/` (audio, niveaux .glb) doivent passer
  // par `core/loading/assetPath.ts::assetUrl` pour respecter ce même base au runtime.
  base: "./",
  plugins: [
    react(),
    {
      // DEV : `cassandre.pose()` dépose la pose du joueur ici, et Blender la
      // relit (`C.shot("joueur")`, tools/blender/cassandre.py).
      name: "cassandre-pose-blender",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use("/__cassandre/pose", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end();
            return;
          }
          let body = "";
          req.on("data", (chunk: Buffer) => (body += chunk.toString()));
          req.on("end", async () => {
            try {
              const pose = { ...JSON.parse(body), t: Date.now() / 1000 };
              const dir = resolve(server.config.root, "renders/_cassandre");
              await mkdir(dir, { recursive: true });
              await writeFile(resolve(dir, "pose.json"), JSON.stringify(pose));
              res.statusCode = 204;
            } catch {
              res.statusCode = 400;
            }
            res.end();
          });
        });
      },
    },
    {
      // Le bundle minifié perd les en-têtes de licence des dépendances, que
      // MIT et Apache-2.0 exigent de redistribuer avec le code : on les
      // regroupe dans un fichier livré à la racine du site.
      name: "third-party-licenses",
      apply: "build",
      async generateBundle(_options, bundle) {
        const packages = new Map<string, { name: string; version: string; license: string; text: string }>();
        for (const output of Object.values(bundle)) {
          if (output.type !== "chunk") continue;
          for (const id of output.moduleIds) {
            if (!id.includes("/node_modules/")) continue;
            const root = await findPackageRoot(id);
            if (!root || packages.has(root)) continue;
            const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
            const licenseFile = (await readdir(root)).find((f) => /^(licen[cs]e|copying)/i.test(f));
            packages.set(root, {
              name: pkg.name,
              version: pkg.version,
              license: pkg.license ?? "UNKNOWN",
              text: licenseFile ? (await readFile(join(root, licenseFile), "utf8")).trim() : "",
            });
          }
        }
        const entries = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
        const source = entries
          .map((p) => `${p.name}@${p.version} — ${p.license}\n\n${p.text || "(texte de licence absent du paquet)"}`)
          .join(`\n\n${"=".repeat(72)}\n\n`);
        this.emitFile({
          type: "asset",
          fileName: "THIRD_PARTY_LICENSES.txt",
          source: `PROJET_CASSANDRE — licences des dépendances incluses dans ce build\n\n${source}\n`,
        });
      },
    },
    {
      name: "exclude-audio-studio-artifacts",
      apply: "build",
      configResolved(config) {
        buildOutputDir = resolve(config.root, config.build.outDir);
      },
      async closeBundle() {
        // Le studio reste servi en développement depuis public/, jamais livré.
        await rm(resolve(buildOutputDir, "audition"), { recursive: true, force: true });
        await rm(resolve(buildOutputDir, "assets/audio/sfx/sfx.wav"), { force: true });
      },
    },
  ],
  optimizeDeps: {
    exclude: ["@dimforge/rapier3d-compat"],
  },
});

/** Remonte d'un module à la racine de son paquet npm : le premier
 * `package.json` qui porte un nom ET une version (les sous-dossiers `dist/`
 * ont parfois un `package.json` réduit à `"type"`). */
async function findPackageRoot(file: string): Promise<string | null> {
  let dir = dirname(file.replace(/^\0/, "").split("?")[0]);
  while (dir.includes("node_modules")) {
    try {
      const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
      if (pkg.name && pkg.version) return dir;
    } catch {
      // pas de package.json ici, on remonte
    }
    dir = dirname(dir);
  }
  return null;
}
