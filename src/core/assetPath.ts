// see: docs/pipeline/assets.md#chemins-des-assets-au-déploiement
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
