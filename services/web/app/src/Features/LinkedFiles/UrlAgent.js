/* eslint-disable
    camelcase,
    handle-callback-err,
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
let UrlAgent
const request = require('request')
const _ = require('underscore')
const urlValidator = require('valid-url')
const { InvalidUrlError, UrlFetchFailedError } = require('./LinkedFilesErrors')
const LinkedFilesHandler = require('./LinkedFilesHandler')
const UrlHelper = require('../Helpers/UrlHelper')

module.exports = UrlAgent = {
  createLinkedFile(
    project_id,
    linkedFileData,
    name,
    parent_folder_id,
    user_id,
    callback
  ) {
    linkedFileData = this._sanitizeData(linkedFileData)
    return this._getUrlStream(project_id, linkedFileData, user_id, function(
      err,
      readStream
    ) {
      if (err != null) {
        return callback(err)
      }
      readStream.on('error', callback)
      return readStream.on('response', function(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          readStream.resume()
          return LinkedFilesHandler.importFromStream(
            project_id,
            readStream,
            linkedFileData,
            name,
            parent_folder_id,
            user_id,
            function(err, file) {
              if (err != null) {
                return callback(err)
              }
              return callback(null, file._id)
            }
          ) // Created
        } else {
          const error = new UrlFetchFailedError(
            `url fetch failed: ${linkedFileData.url}`
          )
          error.statusCode = response.statusCode
          return callback(error)
        }
      })
    })
  },

  refreshLinkedFile(
    project_id,
    linkedFileData,
    name,
    parent_folder_id,
    user_id,
    callback
  ) {
    return this.createLinkedFile(
      project_id,
      linkedFileData,
      name,
      parent_folder_id,
      user_id,
      callback
    )
  },

  _sanitizeData(data) {
    return {
      provider: data.provider,
      url: UrlHelper.prependHttpIfNeeded(data.url)
    }
  },

  _getUrlStream(project_id, data, current_user_id, callback) {
    if (callback == null) {
      callback = function(error, fsPath) {}
    }
    callback = _.once(callback)
    let { url } = data
    if (!urlValidator.isWebUri(url)) {
      return callback(new InvalidUrlError(`invalid url: ${url}`))
    }
    url = UrlHelper.wrapUrlWithProxy(url)
    const readStream = request.get(url)
    readStream.pause()
    return callback(null, readStream)
  }
}
