/* eslint-disable
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
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import Path from 'node:path'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import _ from 'lodash'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as HashManager from './HashManager.js'

export function createStub(fsPath, fileId, fileSize, fileHash, callback) {
  if (callback == null) {
    callback = function () {}
  }
  callback = _.once(callback)
  const newFsPath = Path.join(
    Settings.path.uploadFolder,
    randomUUID() + `-${fileId}-stub`
  )
  const writeStream = fs.createWriteStream(newFsPath)
  writeStream.on('error', function (error) {
    OError.tag(error, 'error writing stub file', { fsPath, newFsPath })
    return fs.unlink(newFsPath, () => callback(error))
  })
  writeStream.on('finish', function () {
    logger.debug(
      { fsPath, fileId, fileSize, fileHash },
      'replaced large file with stub'
    )
    return callback(null, newFsPath)
  }) // let the consumer unlink the file
  const stubLines = [
    'FileTooLargeError v1',
    'File too large to be stored in history service',
    `id ${fileId}`,
    `size ${fileSize} bytes`,
    `hash ${fileHash}`,
    '\0', // null byte to make this a binary file
  ]
  writeStream.write(stubLines.join('\n'))
  return writeStream.end()
}

export function replaceWithStubIfNeeded(fsPath, fileId, fileSize, callback) {
  if (callback == null) {
    callback = function () {}
  }
  if (
    Settings.maxFileSizeInBytes != null &&
    fileSize > Settings.maxFileSizeInBytes
  ) {
    logger.error(
      { fsPath, fileId, maxFileSizeInBytes: Settings.maxFileSizeInBytes },
      'file too large, will use stub'
    )
    return HashManager._getBlobHash(fsPath, function (error, fileHash) {
      if (error != null) {
        return callback(error)
      }
      return createStub(
        fsPath,
        fileId,
        fileSize,
        fileHash,
        function (error, newFsPath) {
          if (error != null) {
            return callback(error)
          }
          return callback(null, newFsPath)
        }
      )
    })
  } else {
    return callback(null, fsPath)
  }
}
