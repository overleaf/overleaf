const _ = require('underscore')
const logger = require('logger-sharelatex')
const fs = require('fs')
const request = require('request')
const settings = require('settings-sharelatex')
const Async = require('async')
const FileHashManager = require('./FileHashManager')
const { File } = require('../../models/File')
const Errors = require('../Errors/Errors')

const ONE_MIN_IN_MS = 60 * 1000
const FIVE_MINS_IN_MS = ONE_MIN_IN_MS * 5

const FileStoreHandler = {
  RETRY_ATTEMPTS: 3,

  uploadFileFromDisk(projectId, fileArgs, fsPath, callback) {
    fs.lstat(fsPath, function(err, stat) {
      if (err) {
        logger.warn({ err, projectId, fileArgs, fsPath }, 'error stating file')
        callback(err)
      }
      if (!stat) {
        logger.warn(
          { projectId, fileArgs, fsPath },
          'stat is not available, can not check file from disk'
        )
        return callback(new Error('error getting stat, not available'))
      }
      if (!stat.isFile()) {
        logger.log(
          { projectId, fileArgs, fsPath },
          'tried to upload symlink, not continuing'
        )
        return callback(new Error('can not upload symlink'))
      }
      Async.retry(
        FileStoreHandler.RETRY_ATTEMPTS,
        (cb, results) =>
          FileStoreHandler._doUploadFileFromDisk(
            projectId,
            fileArgs,
            fsPath,
            cb
          ),
        function(err, result) {
          if (err) {
            logger.warn(
              { err, projectId, fileArgs },
              'Error uploading file, retries failed'
            )
            return callback(err)
          }
          callback(err, result.url, result.fileRef)
        }
      )
    })
  },

  _doUploadFileFromDisk(projectId, fileArgs, fsPath, callback) {
    const callbackOnce = _.once(callback)

    FileHashManager.computeHash(fsPath, function(err, hashValue) {
      if (err) {
        return callbackOnce(err)
      }
      const fileRef = new File(Object.assign({}, fileArgs, { hash: hashValue }))
      const fileId = fileRef._id
      logger.log(
        { projectId, fileId, fsPath, hash: hashValue, fileRef },
        'uploading file from disk'
      )
      const readStream = fs.createReadStream(fsPath)
      readStream.on('error', function(err) {
        logger.warn(
          { err, projectId, fileId, fsPath },
          'something went wrong on the read stream of uploadFileFromDisk'
        )
        callbackOnce(err)
      })
      readStream.on('open', function() {
        const url = FileStoreHandler._buildUrl(projectId, fileId)
        const opts = {
          method: 'post',
          uri: url,
          timeout: FIVE_MINS_IN_MS,
          headers: {
            'X-File-Hash-From-Web': hashValue
          } // send the hash to the filestore as a custom header so it can be checked
        }
        const writeStream = request(opts)
        writeStream.on('error', function(err) {
          logger.warn(
            { err, projectId, fileId, fsPath },
            'something went wrong on the write stream of uploadFileFromDisk'
          )
          callbackOnce(err)
        })
        writeStream.on('response', function(response) {
          if (![200, 201].includes(response.statusCode)) {
            err = new Error(
              `non-ok response from filestore for upload: ${
                response.statusCode
              }`
            )
            logger.warn(
              { err, statusCode: response.statusCode },
              'error uploading to filestore'
            )
            return callbackOnce(err)
          }
          callbackOnce(null, { url, fileRef })
        }) // have to pass back an object because async.retry only accepts a single result argument
        readStream.pipe(writeStream)
      })
    })
  },

  getFileStream(projectId, fileId, query, callback) {
    logger.log(
      { projectId, fileId, query },
      'getting file stream from file store'
    )
    let queryString = ''
    if (query != null && query['format'] != null) {
      queryString = `?format=${query['format']}`
    }
    const opts = {
      method: 'get',
      uri: `${this._buildUrl(projectId, fileId)}${queryString}`,
      timeout: FIVE_MINS_IN_MS,
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
        { err, projectId, fileId, query, opts },
        'error in file stream'
      )
    )
    return callback(null, readStream)
  },

  getFileSize(projectId, fileId, callback) {
    const url = this._buildUrl(projectId, fileId)
    request.head(url, (err, res) => {
      if (err) {
        logger.warn(
          { err, projectId, fileId },
          'failed to get file size from filestore'
        )
        return callback(err)
      }
      if (res.statusCode === 404) {
        return callback(new Errors.NotFoundError('file not found in filestore'))
      }
      if (res.statusCode !== 200) {
        logger.warn(
          { projectId, fileId, statusCode: res.statusCode },
          'filestore returned non-200 response'
        )
        return callback(new Error('filestore returned non-200 response'))
      }
      const fileSize = res.headers['content-length']
      callback(null, fileSize)
    })
  },

  deleteFile(projectId, fileId, callback) {
    logger.log({ projectId, fileId }, 'telling file store to delete file')
    const opts = {
      method: 'delete',
      uri: this._buildUrl(projectId, fileId),
      timeout: FIVE_MINS_IN_MS
    }
    return request(opts, function(err, response) {
      if (err) {
        logger.warn(
          { err, projectId, fileId },
          'something went wrong deleting file from filestore'
        )
      }
      return callback(err)
    })
  },

  copyFile(oldProjectId, oldFileId, newProjectId, newFileId, callback) {
    logger.log(
      { oldProjectId, oldFileId, newProjectId, newFileId },
      'telling filestore to copy a file'
    )
    const opts = {
      method: 'put',
      json: {
        source: {
          project_id: oldProjectId,
          file_id: oldFileId
        }
      },
      uri: this._buildUrl(newProjectId, newFileId),
      timeout: FIVE_MINS_IN_MS
    }
    return request(opts, function(err, response) {
      if (err) {
        logger.warn(
          { err, oldProjectId, oldFileId, newProjectId, newFileId },
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
        logger.warn(
          { uri: opts.uri, statusCode: response.statusCode },
          'error uploading to filestore'
        )
        return callback(err)
      }
    })
  },

  _buildUrl(projectId, fileId) {
    return `${settings.apis.filestore.url}/project/${projectId}/file/${fileId}`
  }
}

module.exports = FileStoreHandler
