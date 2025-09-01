const logger = require('@overleaf/logger')
const fs = require('fs')
const Async = require('async')
const FileHashManager = require('./FileHashManager')
const HistoryManager = require('../History/HistoryManager')
const ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
const { File } = require('../../models/File')
const OError = require('@overleaf/o-error')
const { promisifyAll } = require('@overleaf/promise-utils')

const FileStoreHandler = {
  RETRY_ATTEMPTS: 3,

  uploadFileFromDisk(projectId, fileArgs, fsPath, callback) {
    // Look up the history id for the project if we don't have it already
    ProjectDetailsHandler.getDetails(projectId, function (err, project) {
      if (err) {
        return callback(err)
      }
      const historyId = project.overleaf?.history?.id
      if (!historyId) {
        return callback(new OError('missing history id'))
      }
      FileStoreHandler.uploadFileFromDiskWithHistoryId(
        projectId,
        historyId,
        fileArgs,
        fsPath,
        callback
      )
    })
  },

  _uploadToHistory(historyId, hash, size, fsPath, callback) {
    Async.retry(
      FileStoreHandler.RETRY_ATTEMPTS,
      cb =>
        HistoryManager.uploadBlobFromDisk(historyId, hash, size, fsPath, cb),
      error => {
        if (error) return callback(error, false)
        callback(null, true)
      }
    )
  },

  uploadFileFromDiskWithHistoryId(
    projectId,
    historyId,
    fileArgs,
    fsPath,
    callback
  ) {
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
      FileHashManager.computeHash(fsPath, function (err, hash) {
        if (err) {
          return callback(err)
        }
        FileStoreHandler._uploadToHistory(
          historyId,
          hash,
          stat.size,
          fsPath,
          function (err) {
            if (err) {
              return callback(err)
            }
            fileArgs = { ...fileArgs, hash }
            callback(err, new File(fileArgs), true)
          }
        )
      })
    })
  },
}

module.exports = FileStoreHandler
module.exports.promises = promisifyAll(FileStoreHandler, {
  multiResult: {
    uploadFileFromDisk: ['fileRef', 'createdBlob'],
    uploadFileFromDiskWithHistoryId: ['fileRef', 'createdBlob'],
  },
})
