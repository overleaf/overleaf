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
const logger = require('logger-sharelatex')
const ReferencesHandler = require('./ReferencesHandler')
const settings = require('settings-sharelatex')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')

module.exports = ReferencesController = {
  index(req, res) {
    const projectId = req.params.Project_id
    const { shouldBroadcast } = req.body
    const { docIds } = req.body
    if (!docIds || !(docIds instanceof Array)) {
      logger.err(
        { projectId, docIds },
        "docIds is not valid, should be either Array or String 'ALL'"
      )
      return res.sendStatus(400)
    }
    return ReferencesHandler.index(projectId, docIds, function(err, data) {
      if (err != null) {
        logger.err({ err, projectId }, 'error indexing all references')
        return res.sendStatus(500)
      }
      return ReferencesController._handleIndexResponse(
        req,
        res,
        projectId,
        shouldBroadcast,
        data
      )
    })
  },

  indexAll(req, res) {
    const projectId = req.params.Project_id
    const { shouldBroadcast } = req.body
    return ReferencesHandler.indexAll(projectId, function(err, data) {
      if (err != null) {
        logger.err({ err, projectId }, 'error indexing all references')
        return res.sendStatus(500)
      }
      return ReferencesController._handleIndexResponse(
        req,
        res,
        projectId,
        shouldBroadcast,
        data
      )
    })
  },

  _handleIndexResponse(req, res, projectId, shouldBroadcast, data) {
    if (data == null || data.keys == null) {
      return res.json({ projectId, keys: [] })
    }
    if (shouldBroadcast) {
      EditorRealTimeController.emitToRoom(
        projectId,
        'references:keys:updated',
        data.keys
      )
    }
    return res.json(data)
  }
}
