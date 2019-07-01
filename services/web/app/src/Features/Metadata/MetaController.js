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
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const MetaHandler = require('./MetaHandler')
const logger = require('logger-sharelatex')

module.exports = MetaController = {
  getMetadata(req, res, next) {
    const { project_id } = req.params
    logger.log({ project_id }, 'getting all labels for project')
    return MetaHandler.getAllMetaForProject(project_id, function(
      err,
      projectMeta
    ) {
      if (err != null) {
        logger.warn(
          { project_id, err },
          '[MetaController] error getting all labels from project'
        )
        return next(err)
      }
      return res.json({ projectId: project_id, projectMeta })
    })
  },

  broadcastMetadataForDoc(req, res, next) {
    const { project_id } = req.params
    const { doc_id } = req.params
    logger.log({ project_id, doc_id }, 'getting labels for doc')
    return MetaHandler.getMetaForDoc(project_id, doc_id, function(
      err,
      docMeta
    ) {
      if (err != null) {
        logger.warn(
          { project_id, doc_id, err },
          '[MetaController] error getting labels from doc'
        )
        return next(err)
      }
      EditorRealTimeController.emitToRoom(project_id, 'broadcastDocMeta', {
        docId: doc_id,
        meta: docMeta
      })
      return res.sendStatus(200)
    })
  }
}
