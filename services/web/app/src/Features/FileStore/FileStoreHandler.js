const _ = require('underscore')
const logger = require('@overleaf/logger')
const fs = require('fs')
const request = require('request')
const settings = require('@overleaf/settings')
const Async = require('async')
const FileHashManager = require('./FileHashManager')
const { File } = require('../../models/File')
const Errors = require('../Errors/Errors')
const OError = require('@overleaf/o-error')
const { promisifyAll } = require('../../util/promises')

const ONE_MIN_IN_MS = 60 * 1000
const FIVE_MINS_IN_MS = ONE_MIN_IN_MS * 5

const FileStoreHandler = {
  RETRY_ATTEMPTS: 3,

  uploadFileFromDisk(projectId, fileArgs, fsPath, callback) {
    fs.lstat(fsPath, function (err, stat) {
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
        logger.debug(
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
        function (err, result) {
          if (err) {
            OError.tag(err, 'Error uploading file, retries failed', {
              projectId,
              fileArgs,
            })
            return callback(err)
          }
          callback(err, result.url, result.fileRef)
        }
      )
    })
  },

  _doUploadFileFromDisk(projectId, fileArgs, fsPath, callback) {
    const callbackOnce = _.once(callback)

    FileHashManager.computeHash(fsPath, function (err, hashValue) {
      if (err) {
        return callbackOnce(err)
      }
      const fileRef = new File(Object.assign({}, fileArgs, { hash: hashValue }))
      const fileId = fileRef._id
      const readStream = fs.createReadStream(fsPath)
      readStream.on('error', function (err) {
        logger.warn(
          { err, projectId, fileId, fsPath },
          'something went wrong on the read stream of uploadFileFromDisk'
        )
        callbackOnce(err)
      })
      readStream.on('open', function () {
        const url = FileStoreHandler._buildUrl(projectId, fileId)
        const opts = {
          method: 'post',
          uri: url,
          timeout: FIVE_MINS_IN_MS,
          headers: {
            'X-File-Hash-From-Web': hashValue,
          }, // send the hash to the filestore as a custom header so it can be checked
        }
        const writeStream = request(opts)
        writeStream.on('error', function (err) {
          logger.warn(
            { err, projectId, fileId, fsPath },
            'something went wrong on the write stream of uploadFileFromDisk'
          )
          callbackOnce(err)
        })
        writeStream.on('response', function (response) {
          if (![200, 201].includes(response.statusCode)) {
            err = new OError(
              `non-ok response from filestore for upload: ${response.statusCode}`,
              { statusCode: response.statusCode }
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
    let queryString = ''
    if (query != null && query.format != null) {
      queryString = `?format=${query.format}`
    }
    const opts = {
      method: 'get',
      uri: `${this._buildUrl(projectId, fileId)}${queryString}`,
      timeout: FIVE_MINS_IN_MS,
      headers: {},
    }
    if (query != null && query.range != null) {
      const rangeText = query.range
      if (rangeText && rangeText.match != null && rangeText.match(/\d+-\d+/)) {
        opts.headers.range = `bytes=${query.range}`
      }
    }
    const readStream = request(opts)
    readStream.on('error', err =>
      logger.err(
        { err, projectId, fileId, query, opts },
        'error in file stream'
      )
    )
    callback(null, readStream)
  },

  getFileSize(projectId, fileId, callback) {
    const url = this._buildUrl(projectId, fileId)
    request.head(url, (err, res) => {
      if (err) {
        OError.tag(err, 'failed to get file size from filestore', {
          projectId,
          fileId,
        })
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
    logger.debug({ projectId, fileId }, 'telling file store to delete file')
    const opts = {
      method: 'delete',
      uri: this._buildUrl(projectId, fileId),
      timeout: FIVE_MINS_IN_MS,
    }
    request(opts, function (err, response) {
      if (err) {
        logger.warn(
          { err, projectId, fileId },
          'something went wrong deleting file from filestore'
        )
      }
      callback(err)
    })
  },

  deleteProject(projectId, callback) {
    request(
      {
        method: 'delete',
        uri: this._buildUrl(projectId),
        timeout: FIVE_MINS_IN_MS,
      },
      err => {
        if (err) {
          return callback(
            OError.tag(
              err,
              'something went wrong deleting a project in filestore',
              { projectId }
            )
          )
        }
        callback()
      }
    )
  },

  copyFile(oldProjectId, oldFileId, newProjectId, newFileId, callback) {
    logger.debug(
      { oldProjectId, oldFileId, newProjectId, newFileId },
      'telling filestore to copy a file'
    )
    const opts = {
      method: 'put',
      json: {
        source: {
          project_id: oldProjectId,
          file_id: oldFileId,
        },
      },
      uri: this._buildUrl(newProjectId, newFileId),
      timeout: FIVE_MINS_IN_MS,
    }
    request(opts, function (err, response) {
      if (err) {
        OError.tag(
          err,
          'something went wrong telling filestore api to copy file',
          {
            oldProjectId,
            oldFileId,
            newProjectId,
            newFileId,
          }
        )
        callback(err)
      } else if (response.statusCode >= 200 && response.statusCode < 300) {
        // successful response
        callback(null, opts.uri)
      } else {
        err = new OError(
          `non-ok response from filestore for copyFile: ${response.statusCode}`,
          {
            uri: opts.uri,
            statusCode: response.statusCode,
          }
        )
        callback(err)
      }
    })
  },

  _buildUrl(projectId, fileId) {
    return (
      `${settings.apis.filestore.url}/project/${projectId}` +
      (fileId ? `/file/${fileId}` : '')
    )
  },
}

module.exports = FileStoreHandler
module.exports.promises = promisifyAll(FileStoreHandler, {
  multiResult: {
    uploadFileFromDisk: ['url', 'fileRef'],
  },
})
