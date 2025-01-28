import { Tag } from '../../../../../app/src/Features/Tags/types'
import { getHueForId } from '@/shared/utils/colors'

export const MAX_TAG_LENGTH = 50

export function getTagColor(tag?: Tag): string | undefined {
  if (!tag) {
    return undefined
  }
  return tag.color || `hsl(${getHueForId(tag._id)}, 70%, 45%)`
}
