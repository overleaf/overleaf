import { Ranges } from '@/features/review-panel-new/context/ranges-context'
import { Threads } from '@/features/review-panel-new/context/threads-context'

export const hasActiveRange = (
  ranges: Ranges | undefined,
  threads: Threads | undefined
): boolean | undefined => {
  if (!ranges || !threads) {
    // data isn't loaded yet
    return undefined
  }

  if (ranges.changes.length > 0) {
    // at least one tracked change
    return true
  }

  for (const thread of Object.values(threads)) {
    if (!thread.resolved) {
      return true
    }
  }

  return false
}
