const settings = require('settings-sharelatex')
const request = require('request')
const logger = require('logger-sharelatex')
const { promisifyAll } = require('../../util/promises')

const TIMEOUT = 10000

function getAllTags(userId, callback) {
  const opts = {
    url: `${settings.apis.tags.url}/user/${userId}/tag`,
    json: true,
    timeout: TIMEOUT
  }
  request.get(opts, (err, res, body) =>
    _handleResponse(err, res, { userId }, function(error) {
      if (error != null) {
        return callback(error, [])
      }
      callback(null, body || [])
    })
  )
}

function createTag(userId, name, callback) {
  const opts = {
    url: `${settings.apis.tags.url}/user/${userId}/tag`,
    json: {
      name
    },
    timeout: TIMEOUT
  }
  request.post(opts, (err, res, body) =>
    _handleResponse(err, res, { userId }, function(error) {
      if (error != null) {
        return callback(error)
      }
      callback(null, body || {})
    })
  )
}

function renameTag(userId, tagId, name, callback) {
  const url = `${settings.apis.tags.url}/user/${userId}/tag/${tagId}/rename`
  request.post(
    {
      url,
      json: {
        name
      },
      timeout: TIMEOUT
    },
    (err, res, body) =>
      _handleResponse(err, res, { url, userId, tagId, name }, callback)
  )
}

function deleteTag(userId, tagId, callback) {
  const url = `${settings.apis.tags.url}/user/${userId}/tag/${tagId}`
  request.del({ url, timeout: TIMEOUT }, (err, res, body) =>
    _handleResponse(err, res, { url, userId, tagId }, callback)
  )
}

function updateTagUserIds(oldUserId, newUserId, callback) {
  const opts = {
    url: `${settings.apis.tags.url}/user/${oldUserId}/tag`,
    json: {
      user_id: newUserId
    },
    timeout: TIMEOUT
  }
  request.put(opts, (err, res, body) =>
    _handleResponse(err, res, { oldUserId, newUserId }, callback)
  )
}

function removeProjectFromTag(userId, tagId, projectId, callback) {
  const url = `${
    settings.apis.tags.url
  }/user/${userId}/tag/${tagId}/project/${projectId}`
  request.del({ url, timeout: TIMEOUT }, (err, res, body) =>
    _handleResponse(err, res, { url, userId, tagId, projectId }, callback)
  )
}

function addProjectToTag(userId, tagId, projectId, callback) {
  const url = `${
    settings.apis.tags.url
  }/user/${userId}/tag/${tagId}/project/${projectId}`
  request.post({ url, timeout: TIMEOUT }, (err, res, body) =>
    _handleResponse(err, res, { url, userId, tagId, projectId }, callback)
  )
}

function addProjectToTagName(userId, name, projectId, callback) {
  const url = `${
    settings.apis.tags.url
  }/user/${userId}/tag/project/${projectId}`
  const opts = {
    json: { name },
    timeout: TIMEOUT,
    url
  }
  request.post(opts, (err, res, body) =>
    _handleResponse(err, res, { url, userId, name, projectId }, callback)
  )
}

function removeProjectFromAllTags(userId, projectId, callback) {
  const url = `${settings.apis.tags.url}/user/${userId}/project/${projectId}`
  const opts = {
    url,
    timeout: TIMEOUT
  }
  request.del(opts, (err, res, body) =>
    _handleResponse(err, res, { url, userId, projectId }, callback)
  )
}

function _handleResponse(err, res, params, callback) {
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
    callback(err)
  }
}

const TagsHandler = {
  getAllTags,
  createTag,
  renameTag,
  deleteTag,
  updateTagUserIds,
  removeProjectFromTag,
  addProjectToTag,
  addProjectToTagName,
  removeProjectFromAllTags
}
TagsHandler.promises = promisifyAll(TagsHandler)
module.exports = TagsHandler
