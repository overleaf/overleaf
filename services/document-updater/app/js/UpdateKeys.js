// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
module.exports = {
  combineProjectIdAndDocId(projectId, docId) {
    return `${projectId}:${docId}`
  },
  splitProjectIdAndDocId(projectAndDocId) {
    return projectAndDocId.split(':')
  },
}
