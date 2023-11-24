import { isSmallDevice, sendMB } from '@/infrastructure/event-tracking'
import getMeta from '@/utils/meta'

// record once per page load
let recorded = false

export function recordDocumentFirstChangeEvent() {
  if (recorded) return
  recorded = true
  const projectId = getMeta('ol-project_id')
  sendMB('document-first-change', { projectId, isSmallDevice })
}
