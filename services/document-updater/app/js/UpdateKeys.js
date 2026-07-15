// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
module.exports = {
  /**
   * Build a legacy `project_id:doc_id` dispatch marker.
   *
   * @param {string} projectId
   * @param {string} docId
   * @return {string}
   */
  combineProjectIdAndDocId(projectId, docId) {
    return `${projectId}:${docId}`
  },

  /**
   * Split a dispatch marker into project id and doc id. A marker is either
   * the legacy `project_id:doc_id` or, after the queue migration, a bare
   * `project_id`. Project and doc ids never contain a colon, so splitting is
   * unambiguous; for the bare form docId is undefined.
   *
   * @param {string} projectAndDocId
   * @return {[string, string | undefined]}
   */
  splitProjectIdAndDocId(projectAndDocId) {
    const [projectId, docId] = projectAndDocId.split(':')
    return [projectId, docId]
  },
}
