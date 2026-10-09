// Relevé du portefeuille (lot B7 de PLAN_SUITE.md).
//
//   pnpm economy                      # les trois parties types, variante du jeu, difficulté « Habitué »
//   pnpm economy -- --variante A      # une variante d'équilibrage (A, B, C, ou « avant » le lot B7)
//   pnpm economy -- --difficulte client
//   pnpm economy -- --toutes          # toutes les variantes et les trois difficultés
//
// Le simulateur vit dans `src/game/devtools/economy/economySim.ts` : il rejoue
// une partie type à travers la vraie simulation du direct. Vite le charge tel
// quel, sans rien compiler sur le disque.
import { createServer } from "vite";

const args = process.argv.slice(2);
const option = (nom) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
const toutes = args.includes("--toutes");
const campagne = args.includes("--campagne");

const server = await createServer({ cacheDir: "node_modules/.vite-economy", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom", logLevel: "error" });
try {
  const sim = await server.ssrLoadModule("/src/game/devtools/economy/economySim.ts");
  const { PROFILES } = await server.ssrLoadModule("/src/game/devtools/economy/economyProfiles.ts");
  const eco = await server.ssrLoadModule("/src/game/devtools/economy/economyVariants.ts");
  const noms = toutes ? ["avant", ...Object.keys(eco.ECONOMY_VARIANTS)] : [option("--variante") ?? eco.ECONOMY_DEFAULT];
  const difficultes = toutes ? ["client", "habitue", "lanceur"] : [option("--difficulte") ?? "habitue"];
  const graines = Number(option("--graines") ?? 200);
  if (!Number.isSafeInteger(graines) || graines < 1) throw new Error("--graines exige un entier positif");

  for (const nom of noms) {
    const variante = nom === "avant" ? eco.ECONOMY_BEFORE : eco.ECONOMY_VARIANTS[nom];
    if (!variante) throw new Error(`variante inconnue : ${nom} (avant, ${Object.keys(eco.ECONOMY_VARIANTS).join(", ")})`);
    eco.applyDonations(variante);
    const total = Object.values(variante.prices).reduce((a, b) => a + b, 0);
    console.log(`\n=== Variante ${nom} — ${variante.label} ===`);
    console.log(`prix : ${Object.entries(variante.prices).map(([p, v]) => `${p} ${v} €`).join(", ")}  (les six : ${total} €)`);
    console.log(`donateur mystère : ${Object.values(variante.mystery).join(" + ")} = ${Object.values(variante.mystery).reduce((a, b) => a + b, 0)} €`);
    for (const difficulte of difficultes) {
      if (!["client", "habitue", "lanceur"].includes(difficulte)) throw new Error(`difficulté inconnue : ${difficulte}`);
      if (campagne) {
        console.log(`\n-- Campagne / ${difficulte} : métro HYPOTHÉTIQUE avant N5, consommables supposés utiles --`);
        const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
        for (const [id, profil] of Object.entries(PROFILES)) {
          const runs = Array.from({ length: graines }, (_, seed) => sim.simulateCampaign(profil, difficulte, variante.prices, seed + 1));
          console.log(`${profil.label} : arrivée métro ${median(runs.map((r) => r.metro.entryWallet))} € / ${median(runs.map((r) => r.metro.entryPerks.length))} perks ; sortie ${median(runs.map((r) => r.metro.wallet))} € / ${median(runs.map((r) => r.metro.perks.length))} perks ; ${median(runs.map((r) => r.metro.consumables))} consommables`);
          console.log("  possession à la sortie : " + Object.keys(variante.prices).map((perk) => `${perk} ${Math.round(100 * runs.filter((r) => r.metro.perks.includes(perk)).length / runs.length)} %`).join(" · "));
        }
        continue;
      }
      console.log(`\n-- ${difficulte} --`);
      console.log("profil        durée   dons  (mystère)  utiles   achetés min/méd/max   au mieux min/méd/max");
      const lignes = [];
      for (const profil of Object.keys(PROFILES)) {
        const r = sim.summarize(profil, difficulte, variante.prices, graines);
        lignes.push(r);
        console.log(
          `${PROFILES[profil].label.padEnd(12)} ${String(r.minutes).padStart(5)}'  ${String(r.donated).padStart(4)} €  (${String(r.mystery).padStart(3)} €)   ${String(r.spendable).padStart(4)} €        ${r.bought.join(" / ")}                 ${r.best.join(" / ")}`,
        );
      }
      for (const r of lignes) {
        console.log(`   ${PROFILES[r.profile].label} — solde médian devant chaque borne :`);
        console.log("     " + r.wallets.map((w) => `${w.stop} ${w.wallet} €/${w.price} €`).join("  ·  "));
        console.log("     achat : " + Object.entries(r.perks).map(([p, part]) => `${p} ${Math.round(part * 100)} %`).join("  "));
      }
    }
  }
} finally {
  await server.close();
}
