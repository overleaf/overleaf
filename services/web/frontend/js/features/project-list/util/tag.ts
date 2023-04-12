import { Tag } from '../../../../../app/src/Features/Tags/types'
import ColorManager from '../../../ide/colors/ColorManager'

export const MAX_TAG_LENGTH = 50

export function getTagColor(tag?: Tag): string | undefined {
  if (!tag) {
    return undefined
  }
  return tag.color || `hsl(${ColorManager.getHueForTagId(tag._id)}, 70%, 45%)`
}
