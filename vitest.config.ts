import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Le signal de validation appartient au dépôt courant. Les worktrees et
    // caches d'agents peuvent contenir d'autres copies de `test/`.
    include: ["test/**/*.test.ts"],
    exclude: [...configDefaults.exclude, ".claude/**", ".codex/**"],
  },
});
