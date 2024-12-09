// Helper function to compute the url for a file in history-v1 or filestore.
// This will be obsolete when the migration to history-v1 is complete.

export function fileUrl(projectId, id, hash) {
  if (hash) {
    return `/project/${projectId}/blob/${hash}?fallback=${id}`
  } else {
    return `/project/${projectId}/file/${id}`
  }
}
