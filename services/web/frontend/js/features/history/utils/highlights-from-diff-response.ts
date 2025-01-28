import moment from 'moment/moment'
import { DocDiffChunk, Highlight } from '../services/types/doc'
import { TFunction } from 'i18next'
import displayNameForUser from './display-name-for-user'
import { getHueForUserId } from '@/shared/utils/colors'

export function highlightsFromDiffResponse(
  chunks: DocDiffChunk[],
  t: TFunction<'translation'> // Must be called `t` for i18next-scanner to find calls to it
) {
  let pos = 0
  const highlights: Highlight[] = []
  let doc = ''

  for (const entry of chunks) {
    const content = entry.u || entry.i || entry.d || ''
    doc += content
    const from = pos
    const to = doc.length
    pos = to
    const range = { from, to }

    const isInsertion = typeof entry.i === 'string'
    const isDeletion = typeof entry.d === 'string'

    if (isInsertion || isDeletion) {
      const meta = entry.meta
      if (!meta) {
        throw new Error('No meta found')
      }
      const user = meta.users?.[0]
      const name = displayNameForUser(user)
      const date = moment(meta.end_ts).format('Do MMM YYYY, h:mm a')
      if (isInsertion) {
        highlights.push({
          type: 'addition',
          // There doesn't seem to be a convenient way to make this translatable
          label: t('added_by_on', { name, date }),
          range,
          hue: getHueForUserId(user?.id),
        })
      } else if (isDeletion) {
        highlights.push({
          type: 'deletion',
          // There doesn't seem to be a convenient way to make this translatable
          label: t('deleted_by_on', { name, date }),
          range,
          hue: getHueForUserId(user?.id),
        })
      }
    }
  }

  return { doc, highlights }
}
