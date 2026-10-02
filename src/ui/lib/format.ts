export function formatViews(views: number): string {
  return views.toLocaleString("fr-FR");
}

export function formatPoints(points: number): string {
  return points.toLocaleString("fr-FR");
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
