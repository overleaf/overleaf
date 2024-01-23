import {
  isSmallDevice,
  sendMBOncePerPageLoad,
} from '@/infrastructure/event-tracking'
import getMeta from '@/utils/meta'

export function recordDocumentFirstChangeEvent() {
  const projectId = getMeta('ol-project_id')
  sendMBOncePerPageLoad('document-first-change', { projectId, isSmallDevice })
}
