import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // `.claude/worktrees/` porte des copies du dépôt pour les tâches lancées en
    // parallèle : sans cette exclusion, `pnpm test` exécute aussi LEURS tests,
    // qui ne se résolvent pas depuis la racine.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});
