/* eslint-disable
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
    const { project_id: projectId } = req.params
    logger.debug({ projectId }, 'getting all labels for project')
    return MetaHandler.getAllMetaForProject(
      projectId,
      function (err, projectMeta) {
        if (err != null) {
          OError.tag(
            err,
            '[MetaController] error getting all labels from project',
            {
              project_id: projectId,
            }
          )
          return next(err)
        }
        return res.json({ projectId, projectMeta })
      }
    )
  },

  broadcastMetadataForDoc(req, res, next) {
    const { project_id: projectId } = req.params
    const { doc_id: docId } = req.params
    const { broadcast } = req.body
    logger.debug({ projectId, docId, broadcast }, 'getting labels for doc')
    return MetaHandler.getMetaForDoc(projectId, docId, function (err, docMeta) {
      if (err != null) {
        OError.tag(err, '[MetaController] error getting labels from doc', {
          project_id: projectId,
          doc_id: docId,
        })
        return next(err)
      }
      // default to broadcasting, unless explicitly disabled (for backwards compatibility)
      if (broadcast !== false) {
        EditorRealTimeController.emitToRoom(projectId, 'broadcastDocMeta', {
          docId,
          meta: docMeta,
        })
        return res.sendStatus(200)
      } else {
        return res.json({ docId, meta: docMeta })
      }
    })
  },
}
