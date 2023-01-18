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
import fs from 'fs'
import { randomUUID } from 'crypto'
import path from 'path'
import Url from 'url'
import _ from 'lodash'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import OError from '@overleaf/o-error'
import * as LargeFileManager from './LargeFileManager.js'

//
// This method takes a stream and provides you a new stream which is now
// reading from disk.
//
// This is useful if we're piping one network stream to another. If the stream
// we're piping to can't consume data as quickly as the one we're consuming
// from then large quantities of data may be held in memory. Instead the read
// stream can be passed to this method, the data will then be held on disk
// rather than in memory and will be cleaned up once it has been consumed.
//
export function bufferOnDisk(inStream, fileId, consumeOutStream, callback) {
  if (consumeOutStream == null) {
    consumeOutStream = function (fsPath, done) {}
  }
  if (callback == null) {
    callback = function () {}
  }
  const timer = new metrics.Timer('LocalFileWriter.writeStream')

  // capture the stream url for logging
  const url = inStream.uri && Url.format(inStream.uri)

  const fsPath = path.join(
    Settings.path.uploadFolder,
    randomUUID() + `-${fileId}`
  )

  let cleaningUp = false
  const cleanup = _.once((streamError, res) => {
    cleaningUp = true
    return deleteFile(fsPath, function (cleanupError) {
      if (streamError) {
        OError.tag(streamError, 'error deleting temporary file', {
          fsPath,
          url,
        })
      }
      if (cleanupError) {
        OError.tag(cleanupError)
      }
      if (streamError && cleanupError) {
        // logging the cleanup error in case only the stream error is sent to the callback
        logger.error(cleanupError)
      }
      return callback(streamError || cleanupError, res)
    })
  })

  logger.debug({ fsPath, url }, 'writing file locally')

  inStream.on('error', function (err) {
    OError.tag(err, 'problem writing file locally, with read stream', {
      fsPath,
      url,
    })
    return cleanup(err)
  })

  const writeStream = fs.createWriteStream(fsPath)
  writeStream.on('error', function (err) {
    OError.tag(err, 'problem writing file locally, with write stream', {
      fsPath,
      url,
    })
    return cleanup(err)
  })
  writeStream.on('finish', function () {
    timer.done()
    // in future check inStream.response.headers for hash value here
    logger.debug({ fsPath, url }, 'stream closed after writing file locally')
    if (!cleaningUp) {
      const fileSize = writeStream.bytesWritten
      return LargeFileManager.replaceWithStubIfNeeded(
        fsPath,
        fileId,
        fileSize,
        function (err, newFsPath) {
          if (err != null) {
            OError.tag(err, 'problem in large file manager', {
              newFsPath,
              fsPath,
              fileId,
              fileSize,
            })
            return cleanup(err)
          }
          return consumeOutStream(newFsPath, cleanup)
        }
      )
    }
  })
  return inStream.pipe(writeStream)
}

export function deleteFile(fsPath, callback) {
  if (fsPath == null || fsPath === '') {
    return callback()
  }
  logger.debug({ fsPath }, 'removing local temp file')
  return fs.unlink(fsPath, function (err) {
    if (err != null && err.code !== 'ENOENT') {
      // ignore errors deleting the file when it was never created
      return callback(OError.tag(err))
    } else {
      return callback()
    }
  })
}
