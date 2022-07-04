/**
 * Handles malformed filetrees - when fields such as `folder.docs`,
 * `folder.folders` or `folder.fileRefs` are missing it returns an
 * empty array.
 */
function iterablePaths(folder, field) {
  if (!folder) {
    return []
  }
  return folder[field] || []
}

module.exports = {
  iterablePaths,
}
