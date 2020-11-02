/* eslint-disable
    camelcase,
    handle-callback-err,
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
const { Project } = require('../../models/Project')
const logger = require('logger-sharelatex')

module.exports = {
  markAsUpdated(projectId, lastUpdatedAt, lastUpdatedBy, callback) {
    if (callback == null) {
      callback = function() {}
    }
    if (lastUpdatedAt == null) {
      lastUpdatedAt = new Date()
    }

    const conditions = {
      _id: projectId,
      lastUpdated: { $lt: lastUpdatedAt }
    }

    const update = {
      lastUpdated: lastUpdatedAt || new Date().getTime(),
      lastUpdatedBy
    }
    return Project.update(conditions, update, {}, callback)
  },

  markAsOpened(project_id, callback) {
    const conditions = { _id: project_id }
    const update = { lastOpened: Date.now() }
    return Project.update(conditions, update, {}, function(err) {
      if (callback != null) {
        return callback()
      }
    })
  },

  markAsInactive(project_id, callback) {
    const conditions = { _id: project_id }
    const update = { active: false }
    return Project.update(conditions, update, {}, function(err) {
      if (callback != null) {
        return callback()
      }
    })
  },

  markAsActive(project_id, callback) {
    const conditions = { _id: project_id }
    const update = { active: true }
    return Project.update(conditions, update, {}, function(err) {
      if (callback != null) {
        return callback()
      }
    })
  }
}
