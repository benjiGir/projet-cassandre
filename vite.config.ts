import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { rm } from "node:fs/promises";
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
