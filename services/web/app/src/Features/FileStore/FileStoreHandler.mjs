import logger from '@overleaf/logger'
import fs from 'node:fs'
import Async from 'async'
import FileHashManager from './FileHashManager.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import ProjectDetailsHandler from '../Project/ProjectDetailsHandler.mjs'
import { File } from '../../models/File.mjs'
import OError from '@overleaf/o-error'
import { promisifyAll } from '@overleaf/promise-utils'
import Modules from '../../infrastructure/Modules.mjs'

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
      const size = stat.size
      Modules.hooks.fire(
        'preUploadFile',
        { projectId, historyId, fileArgs, fsPath, size },
        preUploadErr => {
          if (preUploadErr) {
            return callback(preUploadErr)
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
                const fileRef = new File({ ...fileArgs, hash })
                Modules.hooks.fire(
                  'postUploadFile',
                  {
                    projectId,
                    fileRef,
                    size,
                  },
                  postUploadErr => {
                    if (postUploadErr) {
                      return callback(postUploadErr)
                    }
                    callback(err, fileRef, true, size)
                  }
                )
              }
            )
          })
        }
      )
    })
  },
}

FileStoreHandler.promises = promisifyAll(FileStoreHandler, {
  multiResult: {
    uploadFileFromDisk: ['fileRef', 'createdBlob', 'size'],
    uploadFileFromDiskWithHistoryId: ['fileRef', 'createdBlob', 'size'],
  },
})

export default FileStoreHandler
