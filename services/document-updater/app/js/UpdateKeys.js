// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
module.exports = {
  /**
   * Build the `project_id:doc_id` key ShareJS uses to identify a doc.
   *
   * @param {string} projectId
   * @param {string} docId
   * @return {string}
   */
  combineProjectIdAndDocId(projectId, docId) {
    return `${projectId}:${docId}`
  },

  /**
   * Split a `project_id:doc_id` ShareJS doc key into project id and doc id.
   * Project and doc ids never contain a colon, so splitting is unambiguous.
   *
   * @param {string} projectAndDocId
   * @return {[string, string]}
   */
  splitProjectIdAndDocId(projectAndDocId) {
    const [projectId, docId] = projectAndDocId.split(':')
    return [projectId, docId]
  },
}
