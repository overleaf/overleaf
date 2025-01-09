// Pass settings to enable consistent unit tests from .js and .mjs modules
function projectHistoryURLWithFilestoreFallback(
  Settings,
  projectId,
  historyId,
  fileRef,
  origin
) {
  const filestoreURL = `${Settings.apis.filestore.url}/project/${projectId}/file/${fileRef._id}?from=${origin}`
  // TODO: When this file is converted to ES modules we will be able to use Features.hasFeature('project-history-blobs'). Currently we can't stub the feature return value in tests.
  if (fileRef.hash && Settings.enableProjectHistoryBlobs) {
    return {
      url: `${Settings.apis.project_history.url}/project/${historyId}/blob/${fileRef.hash}`,
      fallbackURL: filestoreURL,
    }
  } else {
    return { url: filestoreURL }
  }
}

module.exports = { projectHistoryURLWithFilestoreFallback }
