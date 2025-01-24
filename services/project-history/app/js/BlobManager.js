import _ from 'lodash'
import async from 'async'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as UpdateTranslator from './UpdateTranslator.js'

// avoid creating too many blobs at the same time
const MAX_CONCURRENT_REQUESTS = 4
// number of retry attempts for blob creation
const RETRY_ATTEMPTS = 3
// delay between retries
const RETRY_INTERVAL = 100

export function createBlobsForUpdates(
  projectId,
  historyId,
  updates,
  extendLock,
  callback
) {
  // async.mapLimit runs jobs in parallel and returns on the first error. It
  // doesn't wait for concurrent jobs to finish. We want to make sure all jobs
  // are wrapped within our lock so we collect the first error enountered here
  // and wait for all jobs to finish before returning the error.
  let firstBlobCreationError = null

  function createBlobForUpdate(update, cb) {
    // For file additions we need to first create a blob in the history-store
    // with the contents of the file. Then we can create a change containing a
    // file addition operation which references the blob.
    //
    // To do this we decorate file creation updates with a blobHash
    if (!UpdateTranslator.isAddUpdate(update)) {
      return async.setImmediate(() => cb(null, { update }))
    }

    let attempts = 0
    // Since we may be creating O(1000) blobs in an update, allow for the
    // occasional failure to prevent the whole update failing.
    let lastErr
    async.retry(
      {
        times: RETRY_ATTEMPTS,
        interval: RETRY_INTERVAL,
      },
      _cb => {
        attempts++
        if (attempts > 1) {
          logger.error(
            {
              err: lastErr,
              projectId,
              historyId,
              update: _.pick(
                update,
                'doc',
                'file',
                'hash',
                'createdBlob',
                'url'
              ),
              attempts,
            },
            'previous createBlob attempt failed, retrying'
          )
        }
        // extend the lock for each file because large files may take a long time
        extendLock(err => {
          if (err) {
            lastErr = OError.tag(err)
            return _cb(lastErr)
          }
          HistoryStoreManager.createBlobForUpdate(
            projectId,
            historyId,
            update,
            (err, hashes) => {
              if (err) {
                lastErr = OError.tag(err, 'retry: error creating blob', {
                  projectId,
                  doc: update.doc,
                  file: update.file,
                })
                _cb(lastErr)
              } else {
                _cb(null, hashes)
              }
            }
          )
        })
      },
      (error, blobHashes) => {
        if (error) {
          if (!firstBlobCreationError) {
            firstBlobCreationError = error
          }
          return cb(null, { update, blobHashes })
        }

        extendLock(error => {
          if (error) {
            if (!firstBlobCreationError) {
              firstBlobCreationError = error
            }
          }
          cb(null, { update, blobHashes })
        })
      }
    )
  }

  async.mapLimit(
    updates,
    MAX_CONCURRENT_REQUESTS,
    createBlobForUpdate,
    (unusedError, updatesWithBlobs) => {
      // As indicated by the name this is unexpected, but changes in the future
      // could cause it to be set and ignoring it would be unexpected
      if (unusedError) {
        return callback(unusedError)
      }
      if (firstBlobCreationError) {
        return callback(firstBlobCreationError)
      }
      callback(null, updatesWithBlobs)
    }
  )
}
