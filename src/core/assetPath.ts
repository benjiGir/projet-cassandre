/**
 * Préfixe un chemin d'asset servi depuis `public/` avec le `base` de build
 * (`vite.config.ts`, `import.meta.env.BASE_URL` — toujours "/" ou
 * "/sous-chemin/", garanti par Vite). Nécessaire pour un déploiement sous un
 * sous-chemin (page de projet GitHub Pages, servie depuis `/<repo>/` et non
 * la racine du domaine) : un chemin en dur commençant par `/` resterait
 * ancré à la racine du domaine quel que soit le sous-chemin réel de
 * déploiement.
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
