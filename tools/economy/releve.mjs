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

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const sim = await server.ssrLoadModule("/src/game/devtools/economy/economySim.ts");
  const eco = await server.ssrLoadModule("/src/game/devtools/economy/economyVariants.ts");
  const noms = toutes ? ["avant", ...Object.keys(eco.ECONOMY_VARIANTS)] : [option("--variante") ?? eco.ECONOMY_DEFAULT];
  const difficultes = toutes ? ["client", "habitue", "lanceur"] : [option("--difficulte") ?? "habitue"];
  const graines = Number(option("--graines") ?? 200);

  for (const nom of noms) {
    const variante = nom === "avant" ? eco.ECONOMY_BEFORE : eco.ECONOMY_VARIANTS[nom];
    if (!variante) throw new Error(`variante inconnue : ${nom} (avant, ${Object.keys(eco.ECONOMY_VARIANTS).join(", ")})`);
    eco.applyDonations(variante);
    const total = Object.values(variante.prices).reduce((a, b) => a + b, 0);
    console.log(`\n=== Variante ${nom} — ${variante.label} ===`);
    console.log(`prix : ${Object.entries(variante.prices).map(([p, v]) => `${p} ${v} €`).join(", ")}  (les six : ${total} €)`);
    console.log(`donateur mystère : ${Object.values(variante.mystery).join(" + ")} = ${Object.values(variante.mystery).reduce((a, b) => a + b, 0)} €`);
    for (const difficulte of difficultes) {
      console.log(`\n-- ${difficulte} --`);
      console.log("profil        durée   dons  (mystère)  utiles   achetés min/méd/max   au mieux min/méd/max");
      const lignes = [];
      for (const profil of Object.keys(sim.PROFILES)) {
        const r = sim.summarize(profil, difficulte, variante.prices, graines);
        lignes.push(r);
        console.log(
          `${sim.PROFILES[profil].label.padEnd(12)} ${String(r.minutes).padStart(5)}'  ${String(r.donated).padStart(4)} €  (${String(r.mystery).padStart(3)} €)   ${String(r.spendable).padStart(4)} €        ${r.bought.join(" / ")}                 ${r.best.join(" / ")}`,
        );
      }
      for (const r of lignes) {
        console.log(`   ${sim.PROFILES[r.profile].label} — solde médian devant chaque borne :`);
        console.log("     " + r.wallets.map((w) => `${w.stop} ${w.wallet} €/${w.price} €`).join("  ·  "));
        console.log("     achat : " + Object.entries(r.perks).map(([p, part]) => `${p} ${Math.round(part * 100)} %`).join("  "));
      }
    }
  }
} finally {
  await server.close();
}
