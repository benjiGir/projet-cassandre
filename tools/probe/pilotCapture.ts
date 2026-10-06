import type { Plugin } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Schema } from "effect";

const decodeView = Schema.decodeUnknownSync(Schema.Literals(["quai", "entree", "niche", "fond", "rame_droite", "rame_gauche", "trafic_quai", "trafic_niche", "trafic_tunnel", "trafic_bancs", "trafic_commandes", "trafic_aiguille", "trafic_panneaux", "trafic_refuge_arret"]));
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_CAPTURE_BYTES = 2 * 1024 * 1024;

// see: docs/4-technique/pilote-metro.md#captures-du-moteur
export function pilotCapturePlugin(): Plugin {
  return {
    name: "cassandre-pilot-capture",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__cassandre/pilot-capture", (request, response) => {
        if (request.method !== "POST") {
          response.writeHead(405).end();
          return;
        }
        let view: ReturnType<typeof decodeView>;
        try {
          view = decodeView(new URL(request.url ?? "/", "http://localhost").pathname.slice(1));
        } catch {
          response.writeHead(400).end();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        request.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_CAPTURE_BYTES) {
            response.writeHead(413).end();
            request.destroy();
            return;
          }
          chunks.push(chunk);
        });
        request.on("end", async () => {
          if (response.writableEnded) return;
          try {
            const png = Buffer.concat(chunks);
            if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) {
              response.writeHead(415).end();
              return;
            }
            const folder = resolve(server.config.root, view.startsWith("trafic_") ? "renders/metro_t2" : "renders/metro_n4");
            await mkdir(folder, { recursive: true });
            await writeFile(resolve(folder, `${view}.png`), png);
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ url: `/renders/${view.startsWith("trafic_") ? "metro_t2" : "metro_n4"}/${view}.png` }));
          } catch {
            response.writeHead(500).end();
          }
        });
      });
    },
  };
}
