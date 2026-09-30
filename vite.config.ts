import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

let buildOutputDir: string;

export default defineConfig({
  // Relatif plutôt qu'un chemin absolu en dur : fonctionne aussi bien servi
  // à la racine d'un domaine que sous un sous-chemin (page de PROJET GitHub
  // Pages, https://<user>.github.io/<repo>/) sans connaître le nom du repo
  // à l'avance. Les assets de `public/` (audio, niveaux .glb) doivent passer
  // par `core/assetPath.ts::assetUrl` pour respecter ce même base au runtime.
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
