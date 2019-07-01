/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let TagsHandler
const settings = require('settings-sharelatex')
const request = require('request')
const logger = require('logger-sharelatex')

const TIMEOUT = 1000
module.exports = TagsHandler = {
  getAllTags(user_id, callback) {
    this._requestTags(user_id, (err, allTags) => {
      if (allTags == null) {
        allTags = []
      }
      callback(err, allTags)
    })
  },

  createTag(user_id, name, callback) {
    if (callback == null) {
      callback = function(error, tag) {}
    }
    const opts = {
      url: `${settings.apis.tags.url}/user/${user_id}/tag`,
      json: {
        name
      },
      timeout: TIMEOUT
    }
    return request.post(opts, (err, res, body) =>
      TagsHandler._handleResponse(err, res, { user_id }, function(error) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, body || {})
      })
    )
  },

  renameTag(user_id, tag_id, name, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const url = `${settings.apis.tags.url}/user/${user_id}/tag/${tag_id}/rename`
    return request.post(
      {
        url,
        json: {
          name
        },
        timeout: TIMEOUT
      },
      (err, res, body) =>
        TagsHandler._handleResponse(
          err,
          res,
          { url, user_id, tag_id, name },
          callback
        )
    )
  },

  deleteTag(user_id, tag_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const url = `${settings.apis.tags.url}/user/${user_id}/tag/${tag_id}`
    return request.del({ url, timeout: TIMEOUT }, (err, res, body) =>
      TagsHandler._handleResponse(err, res, { url, user_id, tag_id }, callback)
    )
  },

  updateTagUserIds(old_user_id, new_user_id, callback) {
    const opts = {
      url: `${settings.apis.tags.url}/user/${old_user_id}/tag`,
      json: {
        user_id: new_user_id
      },
      timeout: TIMEOUT
    }
    return request.put(opts, (err, res, body) =>
      TagsHandler._handleResponse(
        err,
        res,
        { old_user_id, new_user_id },
        callback
      )
    )
  },

  removeProjectFromTag(user_id, tag_id, project_id, callback) {
    const url = `${
      settings.apis.tags.url
    }/user/${user_id}/tag/${tag_id}/project/${project_id}`
    return request.del({ url, timeout: TIMEOUT }, (err, res, body) =>
      TagsHandler._handleResponse(
        err,
        res,
        { url, user_id, tag_id, project_id },
        callback
      )
    )
  },

  addProjectToTag(user_id, tag_id, project_id, callback) {
    const url = `${
      settings.apis.tags.url
    }/user/${user_id}/tag/${tag_id}/project/${project_id}`
    return request.post({ url, timeout: TIMEOUT }, (err, res, body) =>
      TagsHandler._handleResponse(
        err,
        res,
        { url, user_id, tag_id, project_id },
        callback
      )
    )
  },

  addProjectToTagName(user_id, name, project_id, callback) {
    const url = `${
      settings.apis.tags.url
    }/user/${user_id}/tag/project/${project_id}`
    const opts = {
      json: { name },
      timeout: TIMEOUT,
      url
    }
    return request.post(opts, (err, res, body) =>
      TagsHandler._handleResponse(
        err,
        res,
        { url, user_id, name, project_id },
        callback
      )
    )
  },

  removeProjectFromAllTags(user_id, project_id, callback) {
    const url = `${
      settings.apis.tags.url
    }/user/${user_id}/project/${project_id}`
    const opts = {
      url,
      timeout: TIMEOUT
    }
    return request.del(opts, (err, res, body) =>
      TagsHandler._handleResponse(
        err,
        res,
        { url, user_id, project_id },
        callback
      )
    )
  },

  _handleResponse(err, res, params, callback) {
    if (err != null) {
      params.err = err
      logger.warn(params, 'error in tag api')
      return callback(err)
    } else if (res != null && res.statusCode >= 200 && res.statusCode < 300) {
      return callback(null)
    } else {
      err = new Error(
        `tags api returned a failure status code: ${
          res != null ? res.statusCode : undefined
        }`
      )
      params.err = err
      logger.warn(
        params,
        `tags api returned failure status code: ${
          res != null ? res.statusCode : undefined
        }`
      )
      return callback(err)
    }
  },

  _requestTags(user_id, callback) {
    const opts = {
      url: `${settings.apis.tags.url}/user/${user_id}/tag`,
      json: true,
      timeout: TIMEOUT
    }
    return request.get(opts, (err, res, body) =>
      TagsHandler._handleResponse(err, res, { user_id }, function(error) {
        if (error != null) {
          return callback(error, [])
        }
        return callback(null, body || [])
      })
    )
  }
}
