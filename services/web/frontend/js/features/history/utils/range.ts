import { UpdateRange } from '../services/types/update'

export const computeUpdateRange = (
  updateRange: UpdateRange,
  fromV: number,
  toV: number,
  updateMetaEndTimestamp: number
) => {
  const fromVersion = Math.min(fromV, updateRange.fromV)
  const toVersion = Math.max(toV, updateRange.toV)
  const fromVTimestamp = Math.min(
    updateMetaEndTimestamp,
    updateRange.fromVTimestamp
  )
  const toVTimestamp = Math.max(
    updateMetaEndTimestamp,
    updateRange.toVTimestamp
  )

  return {
    fromV: fromVersion,
    toV: toVersion,
    fromVTimestamp,
    toVTimestamp,
  }
}
