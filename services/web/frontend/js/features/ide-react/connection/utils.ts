export function secondsUntil(timestamp: number | null) {
  if (!timestamp) return 0
  const seconds = Math.ceil((timestamp - performance.now()) / 1000)
  if (seconds > 0) return seconds
  return 0
}
