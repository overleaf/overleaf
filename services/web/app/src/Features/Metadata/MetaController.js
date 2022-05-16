/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MetaController
const OError = require('@overleaf/o-error')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const MetaHandler = require('./MetaHandler')
const logger = require('@overleaf/logger')

module.exports = MetaController = {
  getMetadata(req, res, next) {
    const { project_id } = req.params
    logger.debug({ project_id }, 'getting all labels for project')
    return MetaHandler.getAllMetaForProject(
      project_id,
      function (err, projectMeta) {
        if (err != null) {
          OError.tag(
            err,
            '[MetaController] error getting all labels from project',
            {
              project_id,
            }
          )
          return next(err)
        }
        return res.json({ projectId: project_id, projectMeta })
      }
    )
  },

  broadcastMetadataForDoc(req, res, next) {
    const { project_id } = req.params
    const { doc_id } = req.params
    const { broadcast } = req.body
    logger.debug({ project_id, doc_id, broadcast }, 'getting labels for doc')
    return MetaHandler.getMetaForDoc(
      project_id,
      doc_id,
      function (err, docMeta) {
        if (err != null) {
          OError.tag(err, '[MetaController] error getting labels from doc', {
            project_id,
            doc_id,
          })
          return next(err)
        }
        // default to broadcasting, unless explicitly disabled (for backwards compatibility)
        if (broadcast !== false) {
          EditorRealTimeController.emitToRoom(project_id, 'broadcastDocMeta', {
            docId: doc_id,
            meta: docMeta,
          })
          return res.sendStatus(200)
        } else {
          return res.json({ docId: doc_id, meta: docMeta })
        }
      }
    )
  },
}
