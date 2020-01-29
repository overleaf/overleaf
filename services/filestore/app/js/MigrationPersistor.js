const metrics = require('metrics-sharelatex')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const Minipass = require('minipass')
const { callbackify } = require('util')
const { NotFoundError, WriteError } = require('./Errors')

// Persistor that wraps two other persistors. Talks to the 'primary' by default,
// but will fall back to an older persistor in the case of a not-found error.
// If `Settings.filestore.fallback.copyOnMiss` is set, this will copy files from the fallback
// to the primary, in the event that they are missing.
//
// It is unlikely that the bucket/location name will be the same on the fallback
// as the primary. The bucket names should be overridden in `Settings.filestore.fallback.buckets`
// e.g.
// Settings.filestore.fallback.buckets = {
//   myBucketOnS3: 'myBucketOnGCS'
// }

module.exports = function(primary, fallback) {
  function _wrapMethodOnBothPersistors(method) {
    return async function(bucket, key, ...moreArgs) {
      const fallbackBucket = _getFallbackBucket(bucket)

      await Promise.all([
        primary.promises[method](bucket, key, ...moreArgs),
        fallback.promises[method](fallbackBucket, key, ...moreArgs)
      ])
    }
  }

  async function copyFileWithFallback(bucket, sourceKey, destKey) {
    try {
      return await primary.promises.copyFile(bucket, sourceKey, destKey)
    } catch (err) {
      if (err instanceof NotFoundError) {
        const fallbackBucket = _getFallbackBucket(bucket)
        return _copyFileFromFallback(fallbackBucket, bucket, sourceKey, destKey)
      }
    }
  }

  function _getFallbackBucket(bucket) {
    return Settings.filestore.fallback.buckets[bucket]
  }

  function _wrapFallbackMethod(method, enableCopy = true) {
    return async function(bucket, key, ...moreArgs) {
      try {
        return await primary.promises[method](bucket, key, ...moreArgs)
      } catch (err) {
        if (err instanceof NotFoundError) {
          const fallbackBucket = _getFallbackBucket(bucket)
          if (Settings.filestore.fallback.copyOnMiss && enableCopy) {
            // run in background
            _copyFileFromFallback(fallbackBucket, bucket, key, key).catch(
              err => {
                logger.warn({ err }, 'failed to copy file from fallback')
              }
            )
          }
          return fallback.promises[method](fallbackBucket, key, ...moreArgs)
        }
        throw err
      }
    }
  }

  async function _getFileStreamAndCopyIfRequired(bucketName, key, opts) {
    const shouldCopy =
      Settings.filestore.fallback.copyOnMiss && !opts.start && !opts.end

    try {
      return await primary.promises.getFileStream(bucketName, key, opts)
    } catch (err) {
      if (err instanceof NotFoundError) {
        const fallbackBucket = _getFallbackBucket(bucketName)
        if (shouldCopy) {
          return _copyFileFromFallback(
            fallbackBucket,
            bucketName,
            key,
            key,
            true
          )
        } else {
          return fallback.promises.getFileStream(fallbackBucket, key, opts)
        }
      }
      throw err
    }
  }

  async function _copyFromFallbackStreamAndVerify(
    stream,
    sourceBucket,
    destBucket,
    sourceKey,
    destKey
  ) {
    try {
      let sourceMd5
      try {
        sourceMd5 = await fallback.promises.getFileMd5Hash(
          sourceBucket,
          sourceKey
        )
      } catch (err) {
        logger.warn(err, 'error getting md5 hash from fallback persistor')
      }

      await primary.promises.sendStream(destBucket, destKey, stream, sourceMd5)
    } catch (err) {
      const error = new WriteError({
        message: 'unable to copy file to destination persistor',
        info: {
          sourceBucket,
          destBucket,
          sourceKey,
          destKey
        }
      }).withCause(err)
      metrics.inc('fallback.copy.failure')

      try {
        await primary.promises.deleteFile(destBucket, destKey)
      } catch (err) {
        error.info.cleanupError = new WriteError({
          message: 'unable to clean up destination copy artifact',
          info: {
            destBucket,
            destKey
          }
        }).withCause(err)
      }

      logger.warn({ error }, 'failed to copy file from fallback')
      throw error
    }
  }

  async function _copyFileFromFallback(
    sourceBucket,
    destBucket,
    sourceKey,
    destKey,
    returnStream = false
  ) {
    metrics.inc('fallback.copy')
    const sourceStream = await fallback.promises.getFileStream(
      sourceBucket,
      sourceKey,
      {}
    )

    if (!returnStream) {
      return _copyFromFallbackStreamAndVerify(
        sourceStream,
        sourceBucket,
        destBucket,
        sourceKey,
        destKey
      )
    }

    const tee = new Minipass()
    const clientStream = new Minipass()
    const copyStream = new Minipass()

    tee.pipe(clientStream)
    tee.pipe(copyStream)

    // copy the file in the background
    _copyFromFallbackStreamAndVerify(
      copyStream,
      sourceBucket,
      destBucket,
      sourceKey,
      destKey
    ).catch(
      // the error handler in this method will log a metric and a warning, so
      // we don't need to do anything extra here, but catching it will prevent
      // unhandled promise rejection warnings
      () => {}
    )

    // start piping the source stream into the tee after everything is set up,
    // otherwise one stream may consume bytes that don't arrive at the other
    sourceStream.pipe(tee)
    return clientStream
  }

  return {
    primaryPersistor: primary,
    fallbackPersistor: fallback,
    sendFile: primary.sendFile,
    sendStream: primary.sendStream,
    getFileStream: callbackify(_getFileStreamAndCopyIfRequired),
    getFileMd5Hash: callbackify(_wrapFallbackMethod('getFileMd5Hash')),
    deleteDirectory: callbackify(
      _wrapMethodOnBothPersistors('deleteDirectory')
    ),
    getFileSize: callbackify(_wrapFallbackMethod('getFileSize')),
    deleteFile: callbackify(_wrapMethodOnBothPersistors('deleteFile')),
    copyFile: callbackify(copyFileWithFallback),
    checkIfFileExists: callbackify(_wrapFallbackMethod('checkIfFileExists')),
    directorySize: callbackify(_wrapFallbackMethod('directorySize')),
    promises: {
      sendFile: primary.promises.sendFile,
      sendStream: primary.promises.sendStream,
      getFileStream: _getFileStreamAndCopyIfRequired,
      getFileMd5Hash: _wrapFallbackMethod('getFileMd5Hash'),
      deleteDirectory: _wrapMethodOnBothPersistors('deleteDirectory'),
      getFileSize: _wrapFallbackMethod('getFileSize'),
      deleteFile: _wrapMethodOnBothPersistors('deleteFile'),
      copyFile: copyFileWithFallback,
      checkIfFileExists: _wrapFallbackMethod('checkIfFileExists'),
      directorySize: _wrapFallbackMethod('directorySize')
    }
  }
}
