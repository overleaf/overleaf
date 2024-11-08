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
import { pipeline } from 'node:stream'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
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
export function bufferOnDisk(
  inStream,
  url,
  fileId,
  consumeOutStream,
  callback
) {
  const timer = new metrics.Timer('LocalFileWriter.writeStream')

  const fsPath = path.join(
    Settings.path.uploadFolder,
    randomUUID() + `-${fileId}`
  )

  const cleanup = _.once((streamError, res) => {
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

  const writeStream = fs.createWriteStream(fsPath)
  pipeline(inStream, writeStream, err => {
    if (err) {
      OError.tag(err, 'problem writing file locally', {
        fsPath,
        url,
      })
      return cleanup(err)
    }
    timer.done()
    // in future check inStream.response.headers for hash value here
    logger.debug({ fsPath, url }, 'stream closed after writing file locally')
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
  })
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
