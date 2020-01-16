const metrics = require('metrics-sharelatex')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const { callbackify } = require('util')
const { NotFoundError } = require('./Errors')

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
// }s

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
    return (
      Settings.filestore.fallback.buckets &&
      Settings.filestore.fallback.buckets[bucket]
    )
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

  async function _copyFileFromFallback(
    sourceBucket,
    destBucket,
    sourceKey,
    destKey
  ) {
    const sourceStream = await fallback.promises.getFileStream(
      sourceBucket,
      sourceKey,
      {}
    )

    await primary.promises.sendStream(destBucket, destKey, sourceStream)
    metrics.inc('fallback.copy')
  }

  return {
    primaryPersistor: primary,
    fallbackPersistor: fallback,
    sendFile: primary.sendFile,
    sendStream: primary.sendStream,
    getFileStream: callbackify(_wrapFallbackMethod('getFileStream')),
    deleteDirectory: callbackify(
      _wrapMethodOnBothPersistors('deleteDirectory')
    ),
    getFileSize: callbackify(_wrapFallbackMethod('getFileSize')),
    deleteFile: callbackify(_wrapMethodOnBothPersistors('deleteFile')),
    copyFile: callbackify(copyFileWithFallback),
    checkIfFileExists: callbackify(_wrapFallbackMethod('checkIfFileExists')),
    directorySize: callbackify(_wrapFallbackMethod('directorySize', false)),
    promises: {
      sendFile: primary.promises.sendFile,
      sendStream: primary.promises.sendStream,
      getFileStream: _wrapFallbackMethod('getFileStream'),
      deleteDirectory: _wrapMethodOnBothPersistors('deleteDirectory'),
      getFileSize: _wrapFallbackMethod('getFileSize'),
      deleteFile: _wrapMethodOnBothPersistors('deleteFile'),
      copyFile: copyFileWithFallback,
      checkIfFileExists: _wrapFallbackMethod('checkIfFileExists'),
      directorySize: _wrapFallbackMethod('directorySize', false)
    }
  }
}
