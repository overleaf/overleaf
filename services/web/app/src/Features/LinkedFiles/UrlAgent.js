const request = require('request')
const _ = require('underscore')
const urlValidator = require('valid-url')
const { InvalidUrlError, UrlFetchFailedError } = require('./LinkedFilesErrors')
const LinkedFilesHandler = require('./LinkedFilesHandler')
const UrlHelper = require('../Helpers/UrlHelper')

function createLinkedFile(
  projectId,
  linkedFileData,
  name,
  parentFolderId,
  userId,
  callback
) {
  linkedFileData = _sanitizeData(linkedFileData)
  _getUrlStream(projectId, linkedFileData, userId, (err, readStream) => {
    if (err) {
      return callback(err)
    }
    readStream.on('error', callback)
    readStream.on('response', response => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        LinkedFilesHandler.importFromStream(
          projectId,
          readStream,
          linkedFileData,
          name,
          parentFolderId,
          userId,
          (err, file) => {
            if (err) {
              return callback(err)
            }
            callback(null, file._id)
          }
        ) // Created
      } else {
        const error = new UrlFetchFailedError(
          `url fetch failed: ${linkedFileData.url}`
        )
        error.statusCode = response.statusCode
        callback(error)
      }
    })
  })
}

function refreshLinkedFile(
  projectId,
  linkedFileData,
  name,
  parentFolderId,
  userId,
  callback
) {
  createLinkedFile(
    projectId,
    linkedFileData,
    name,
    parentFolderId,
    userId,
    callback
  )
}

function _sanitizeData(data) {
  return {
    provider: data.provider,
    url: UrlHelper.prependHttpIfNeeded(data.url),
  }
}

function _getUrlStream(projectId, data, currentUserId, callback) {
  callback = _.once(callback)
  let { url } = data
  if (!urlValidator.isWebUri(url)) {
    return callback(new InvalidUrlError(`invalid url: ${url}`))
  }
  url = UrlHelper.wrapUrlWithProxy(url)
  const readStream = request.get(url)
  readStream.pause()
  callback(null, readStream)
}

module.exports = { createLinkedFile, refreshLinkedFile }
