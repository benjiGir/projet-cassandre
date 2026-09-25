/** Compteur de vues façon overlay de stream : « 12 480 » plutôt que « 12480 ». */
export function formatViews(views: number): string {
  return views.toLocaleString("fr-FR");
}

/** Score du récap de fin de partie : « 1 500 » plutôt que « 1500 ». Même séparateur que `formatViews`, fonction séparée pour ne pas coupler les deux compteurs par accident. */
export function formatPoints(points: number): string {
  return points.toLocaleString("fr-FR");
}

/** Durée de gameplay en `m:ss` : « 6:07 », jamais de négatif (`Math.max(0, …)`). */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
