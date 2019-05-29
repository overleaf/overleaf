/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let FileStoreHandler
const logger = require('logger-sharelatex')
const fs = require('fs')
const request = require('request')
const settings = require('settings-sharelatex')
const Async = require('async')
const FileHashManager = require('./FileHashManager')
const { File } = require('../../models/File')

const oneMinInMs = 60 * 1000
const fiveMinsInMs = oneMinInMs * 5

module.exports = FileStoreHandler = {
  RETRY_ATTEMPTS: 3,

  uploadFileFromDisk(project_id, file_args, fsPath, callback) {
    if (callback == null) {
      callback = function(error, url, fileRef) {}
    }
    return fs.lstat(fsPath, function(err, stat) {
      if (err != null) {
        logger.err({ err, project_id, file_args, fsPath }, 'error stating file')
        callback(err)
      }
      if (stat == null) {
        logger.err(
          { project_id, file_args, fsPath },
          'stat is not available, can not check file from disk'
        )
        return callback(new Error('error getting stat, not available'))
      }
      if (!stat.isFile()) {
        logger.log(
          { project_id, file_args, fsPath },
          'tried to upload symlink, not contining'
        )
        return callback(new Error('can not upload symlink'))
      }
      return Async.retry(
        FileStoreHandler.RETRY_ATTEMPTS,
        (cb, results) =>
          FileStoreHandler._doUploadFileFromDisk(
            project_id,
            file_args,
            fsPath,
            cb
          ),
        function(err, result) {
          if (err != null) {
            logger.err(
              { err, project_id, file_args },
              'Error uploading file, retries failed'
            )
            return callback(err)
          }
          return callback(err, result.url, result.fileRef)
        }
      )
    })
  },

  _doUploadFileFromDisk(project_id, file_args, fsPath, callback) {
    if (callback == null) {
      callback = function(err, result) {}
    }
    const _cb = callback
    callback = function(err, ...result) {
      callback = function() {} // avoid double callbacks
      return _cb(err, ...Array.from(result))
    }

    return FileHashManager.computeHash(fsPath, function(err, hashValue) {
      if (err != null) {
        return callback(err)
      }
      const fileRef = new File(
        Object.assign({}, file_args, { hash: hashValue })
      )
      const file_id = fileRef._id
      logger.log(
        { project_id, file_id, fsPath, hash: hashValue, fileRef },
        'uploading file from disk'
      )
      const readStream = fs.createReadStream(fsPath)
      readStream.on('error', function(err) {
        logger.err(
          { err, project_id, file_id, fsPath },
          'something went wrong on the read stream of uploadFileFromDisk'
        )
        return callback(err)
      })
      return readStream.on('open', function() {
        const url = FileStoreHandler._buildUrl(project_id, file_id)
        const opts = {
          method: 'post',
          uri: url,
          timeout: fiveMinsInMs,
          headers: {
            'X-File-Hash-From-Web': hashValue
          } // send the hash to the filestore as a custom header so it can be checked
        }
        const writeStream = request(opts)
        writeStream.on('error', function(err) {
          logger.err(
            { err, project_id, file_id, fsPath },
            'something went wrong on the write stream of uploadFileFromDisk'
          )
          return callback(err)
        })
        writeStream.on('response', function(response) {
          if (![200, 201].includes(response.statusCode)) {
            err = new Error(
              `non-ok response from filestore for upload: ${
                response.statusCode
              }`
            )
            logger.err(
              { err, statusCode: response.statusCode },
              'error uploading to filestore'
            )
            return callback(err)
          } else {
            return callback(null, { url, fileRef })
          }
        }) // have to pass back an object because async.retry only accepts a single result argument
        return readStream.pipe(writeStream)
      })
    })
  },

  getFileStream(project_id, file_id, query, callback) {
    logger.log(
      { project_id, file_id, query },
      'getting file stream from file store'
    )
    let queryString = ''
    if (query != null && query['format'] != null) {
      queryString = `?format=${query['format']}`
    }
    const opts = {
      method: 'get',
      uri: `${this._buildUrl(project_id, file_id)}${queryString}`,
      timeout: fiveMinsInMs,
      headers: {}
    }
    if (query != null && query['range'] != null) {
      const rangeText = query['range']
      if (rangeText && rangeText.match != null && rangeText.match(/\d+-\d+/)) {
        opts.headers['range'] = `bytes=${query['range']}`
      }
    }
    const readStream = request(opts)
    readStream.on('error', err =>
      logger.err(
        { err, project_id, file_id, query, opts },
        'error in file stream'
      )
    )
    return callback(null, readStream)
  },

  deleteFile(project_id, file_id, callback) {
    logger.log({ project_id, file_id }, 'telling file store to delete file')
    const opts = {
      method: 'delete',
      uri: this._buildUrl(project_id, file_id),
      timeout: fiveMinsInMs
    }
    return request(opts, function(err, response) {
      if (err != null) {
        logger.err(
          { err, project_id, file_id },
          'something went wrong deleting file from filestore'
        )
      }
      return callback(err)
    })
  },

  copyFile(oldProject_id, oldFile_id, newProject_id, newFile_id, callback) {
    logger.log(
      { oldProject_id, oldFile_id, newProject_id, newFile_id },
      'telling filestore to copy a file'
    )
    const opts = {
      method: 'put',
      json: {
        source: {
          project_id: oldProject_id,
          file_id: oldFile_id
        }
      },
      uri: this._buildUrl(newProject_id, newFile_id),
      timeout: fiveMinsInMs
    }
    return request(opts, function(err, response) {
      if (err != null) {
        logger.err(
          { err, oldProject_id, oldFile_id, newProject_id, newFile_id },
          'something went wrong telling filestore api to copy file'
        )
        return callback(err)
      } else if (response.statusCode >= 200 && response.statusCode < 300) {
        // successful response
        return callback(null, opts.uri)
      } else {
        err = new Error(
          `non-ok response from filestore for copyFile: ${response.statusCode}`
        )
        logger.err(
          { uri: opts.uri, statusCode: response.statusCode },
          'error uploading to filestore'
        )
        return callback(err)
      }
    })
  },

  _buildUrl(project_id, file_id) {
    return `${
      settings.apis.filestore.url
    }/project/${project_id}/file/${file_id}`
  }
}
