/** Compteur de vues façon overlay de stream : « 12 480 » plutôt que « 12480 ». */
export function formatViews(views: number): string {
  return views.toLocaleString("fr-FR");
}
