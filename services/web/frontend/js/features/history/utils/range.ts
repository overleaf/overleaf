import { UpdateRange } from '../services/types/update'

export const updateRangeUnion = (
  updateRange1: UpdateRange,
  updateRange2: UpdateRange
) => {
  return {
    fromV: Math.min(updateRange1.fromV, updateRange2.fromV),
    toV: Math.max(updateRange1.toV, updateRange2.toV),
    fromVTimestamp: Math.min(
      updateRange1.fromVTimestamp,
      updateRange2.fromVTimestamp
    ),
    toVTimestamp: Math.max(
      updateRange1.toVTimestamp,
      updateRange2.toVTimestamp
    ),
  }
}
