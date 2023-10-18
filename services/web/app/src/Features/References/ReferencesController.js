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
let ReferencesController
const logger = require('@overleaf/logger')
const ReferencesHandler = require('./ReferencesHandler')
const settings = require('@overleaf/settings')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const { OError } = require('../Errors/Errors')

module.exports = ReferencesController = {
  indexAll(req, res, next) {
    const projectId = req.params.Project_id
    const { shouldBroadcast } = req.body
    return ReferencesHandler.indexAll(projectId, function (error, data) {
      if (error) {
        OError.tag(error, 'failed to index references', { projectId })
        return next(error)
      }
      return ReferencesController._handleIndexResponse(
        req,
        res,
        projectId,
        shouldBroadcast,
        true,
        data
      )
    })
  },

  _handleIndexResponse(req, res, projectId, shouldBroadcast, isAllDocs, data) {
    if (data == null || data.keys == null) {
      return res.json({ projectId, keys: [] })
    }
    if (shouldBroadcast) {
      EditorRealTimeController.emitToRoom(
        projectId,
        'references:keys:updated',
        data.keys,
        isAllDocs
      )
    }
    return res.json(data)
  },
}
