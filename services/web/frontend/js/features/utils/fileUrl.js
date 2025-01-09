// Helper function to compute the url for a file in history-v1 or filestore.
// This will be obsolete when the migration to history-v1 is complete.

import getMeta from '@/utils/meta'

const projectHistoryBlobsEnabled = getMeta('ol-projectHistoryBlobsEnabled')

export function fileUrl(projectId, id, hash) {
  if (projectHistoryBlobsEnabled && hash) {
    return `/project/${projectId}/blob/${hash}?fallback=${id}`
  } else {
    return `/project/${projectId}/file/${id}`
  }
}
