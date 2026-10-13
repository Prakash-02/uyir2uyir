export function formatMinutesAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins === 1) return '1 minute ago'
  return `${diffMins} minutes ago`
}

export function formatEta(minutes: number | null): string {
  if (minutes === null) return 'ETA unknown'
  if (minutes <= 0) return 'Arrived'
  return `${minutes} min away`
}
