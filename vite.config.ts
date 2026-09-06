import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relatif plutôt qu'un chemin absolu en dur : fonctionne aussi bien servi
  // à la racine d'un domaine que sous un sous-chemin (page de PROJET GitHub
  // Pages, https://<user>.github.io/<repo>/) sans connaître le nom du repo
  // à l'avance. Les assets de `public/` (audio, niveaux .glb) doivent passer
  // par `core/assetPath.ts::assetUrl` pour respecter ce même base au runtime.
  base: "./",
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@dimforge/rapier3d-compat"],
  },
});
