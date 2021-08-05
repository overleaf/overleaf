/* eslint-disable
    camelcase,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
module.exports = {
  combineProjectIdAndDocId(project_id, doc_id) {
    return `${project_id}:${doc_id}`
  },
  splitProjectIdAndDocId(project_and_doc_id) {
    return project_and_doc_id.split(':')
  },
}
