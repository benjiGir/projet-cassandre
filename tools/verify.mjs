/**
 * Vérification en une commande, sortie réduite à l'essentiel — PROJET_CASSANDRE.
 *
 *   pnpm verify                  # typecheck + lint + tests
 *   pnpm verify -- --format      # + formatage (oxfmt --check)
 *   pnpm verify -- --level       # + contrat et audit du niveau v2 (Blender headless)
 *   pnpm verify -- --docs        # + liens de la documentation
 *
 * Une ligne par étape quand tout passe ; le détail (10 premiers échecs, 12
 * lignes chacun) seulement pour ce qui échoue. `pnpm check` reste la barrière
 * complète (il y ajoute `vite build`).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Mêmes cibles que les scripts `lint` et `format:check` de package.json.
const CIBLES_LINT = ["src", "test", "vite.config.ts", "vitest.config.ts"];
const args = new Set(process.argv.slice(2));
const BLENDER = process.env.BLENDER ?? "/Applications/Blender.app/Contents/MacOS/Blender";

function lancer(cmd, argv) {
  const t0 = Date.now();
  const r = spawnSync(cmd, argv, { cwd: RACINE, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return { ...r, secs: ((Date.now() - t0) / 1000).toFixed(1) };
}

// Les piles d'appel dans node_modules (vitest, runner) ne disent rien de l'échec.
const tronquer = (texte, n) =>
  texte.split("\n").filter((l) => !l.includes("node_modules")).slice(0, n).join("\n");
let echec = false;

function etape(nom, ok, secs, resume, detail) {
  console.log(`${ok ? "OK  " : "FAIL"} ${nom} — ${resume} (${secs} s)`);
  if (!ok && detail) console.log(detail.split("\n").map((l) => "     " + l).join("\n"));
  if (!ok) echec = true;
}

{
  const r = lancer("pnpm", ["exec", "tsc", "--noEmit"]);
  const sortie = (r.stdout + r.stderr).trim();
  const erreurs = (sortie.match(/error TS\d+/g) ?? []).length;
  etape("typecheck", r.status === 0, r.secs, r.status === 0 ? "aucune erreur" : `${erreurs} erreur(s)`, tronquer(sortie, 20));
}

{
  // Les erreurs cassent toujours ; les avertissements sont la dette plafonnée par `options.maxWarnings`.
  const r = lancer("pnpm", ["exec", "oxlint", "-f", "json", ...CIBLES_LINT]);
  let diagnostics = null;
  try {
    diagnostics = JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))).diagnostics;
  } catch {
    /* sortie illisible : traitée comme un échec plus bas */
  }
  if (!diagnostics) {
    etape("lint", false, r.secs, "sortie d'oxlint illisible", tronquer(r.stdout + r.stderr, 20));
  } else {
    const erreurs = diagnostics.filter((d) => d.severity === "error");
    const avertissements = diagnostics.length - erreurs.length;
    const plafond = Number(/"maxWarnings":\s*(\d+)/.exec(readFileSync(resolve(RACINE, ".oxlintrc.json"), "utf8"))?.[1] ?? Infinity);
    const regles = new Map();
    for (const d of diagnostics) regles.set(d.code, (regles.get(d.code) ?? 0) + 1);
    const plusFrequentes = [...regles].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([code, n]) => `${n} × ${code}`).join("\n");
    const detailErreurs = erreurs.slice(0, 10).map((d) => `${d.filename}:${d.labels?.[0]?.span?.line ?? "?"} ${d.code} — ${d.message}`).join("\n");
    etape("lint", erreurs.length === 0 && avertissements <= plafond, r.secs,
      `${erreurs.length} erreur(s), ${avertissements}/${plafond} avertissement(s)`,
      erreurs.length > 0 ? detailErreurs : `plafond dépassé — règles les plus fréquentes :\n${plusFrequentes}`);
  }
}

if (args.has("--format") || process.argv.includes("--format")) {
  const r = lancer("pnpm", ["exec", "oxfmt", "--list-different", ...CIBLES_LINT]);
  const fichiers = r.stdout.split("\n").filter(Boolean);
  etape("format", r.status === 0, r.secs, r.status === 0 ? "tout est formaté" : `${fichiers.length} fichier(s) à formater (pnpm format)`,
    fichiers.slice(0, 10).join("\n") + (fichiers.length > 10 ? `\n… ${fichiers.length - 10} autre(s)` : ""));
}

{
  const r = lancer("pnpm", ["exec", "vitest", "run", "--reporter=json"]);
  let json = null;
  try {
    json = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  } catch {
    /* sortie illisible : traitée comme un échec plus bas */
  }
  if (!json) {
    etape("tests", false, r.secs, "sortie de vitest illisible", tronquer(r.stdout + r.stderr, 20));
  } else {
    const ratés = json.testResults.flatMap((f) =>
      f.assertionResults
        .filter((a) => a.status === "failed")
        .map((a) => `${f.name.replace(RACINE + "/", "")} › ${a.fullName}\n${tronquer((a.failureMessages ?? []).join("\n"), 12)}`),
    );
    const erreursDeFichier = json.testResults.filter((f) => f.status === "failed" && f.assertionResults.length === 0)
      .map((f) => `${f.name.replace(RACINE + "/", "")} (fichier en erreur)\n${tronquer(f.message ?? "", 12)}`);
    const tous = [...ratés, ...erreursDeFichier];
    etape("tests", tous.length === 0 && json.success, r.secs,
      `${json.numPassedTests}/${json.numTotalTests} passés, ${json.numFailedTests} échec(s)` + (json.numPendingTests ? `, ${json.numPendingTests} ignorés` : ""),
      tous.slice(0, 10).join("\n\n") + (tous.length > 10 ? `\n… ${tous.length - 10} autre(s)` : ""));
  }
}

if (args.has("--docs") || process.argv.includes("--docs")) {
  const r = lancer("pnpm", ["run", "-s", "check:docs"]);
  etape("docs", r.status === 0, r.secs, r.status === 0 ? "liens valides" : "liens cassés", tronquer((r.stdout + r.stderr).trim(), 20));
}

if (args.has("--level") || process.argv.includes("--level")) {
  const r = lancer(BLENDER, ["-b", "assets_src/blender/niveau_v2.blend", "-P", "tools/blender/cassandre_cli.py", "--", "check"]);
  const ligne = (r.stdout.split("\n").find((l) => l.startsWith("[cassandre] ")) ?? "").slice("[cassandre] ".length);
  try {
    const res = JSON.parse(ligne);
    const verdict = res.validate.verdict.replace(/\s+/g, " ");
    const audit = Object.entries(res.audit?.counts ?? {}).filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`);
    const ok = /CONFORME/.test(verdict) && audit.length === 0;
    etape("niveau", ok, r.secs, `${verdict}${audit.length ? " | audit : " + audit.join(", ") : " | audit propre"}`,
      [...res.validate.errors, ...Object.values(res.audit?.details ?? {}).flat()].slice(0, 10).join("\n"));
  } catch {
    etape("niveau", false, r.secs, "sortie de cassandre_cli illisible", tronquer(r.stdout + r.stderr, 15));
  }
}

process.exitCode = echec ? 1 : 0;
