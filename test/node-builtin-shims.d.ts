/**
 * Tranche MINIMALE des modules Node utilisés par les tests qui relisent un
 * fichier du disque (aujourd'hui `lineOfSight.test.ts`, qui rejoue les vrais
 * `.glb` de `public/assets/levels/`).
 *
 * Pourquoi pas `@types/node` : le projet cible le navigateur
 * (`lib: ES2022 + DOM`), et charger les types Node globalement redéfinit des
 * globales partagées avec le DOM — `setTimeout` en tête, qui renvoie alors un
 * `NodeJS.Timeout` et non un `number`. Un fichier de déclaration limité au
 * dossier `test/` n'a aucun effet sur le typage de `src/`.
 */
declare module "node:fs" {
  export function readFileSync(path: string): Uint8Array;
}

declare module "node:path" {
  export function resolve(...segments: string[]): string;
}
