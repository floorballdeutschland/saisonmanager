/**
 * Zeitpunkt für den Vermerk „bearbeitet am" (feedback#74), in deutscher
 * Schreibweise und Ortszeit. Ein unbrauchbarer Wert kommt unverändert zurück,
 * statt als „Invalid Date" im Bogen zu stehen.
 */
export function formatObservationTimestamp(
  iso: string | null | undefined
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
