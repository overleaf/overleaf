import Settings from '@overleaf/settings'
import { callbackify } from 'node:util'
import fs from 'node:fs'
import _PersistorManager from './PersistorManager.js'
import LocalFileWriter from './LocalFileWriter.js'
import FileConverter from './FileConverter.js'
import KeyBuilder from './KeyBuilder.js'
import ImageOptimiser from './ImageOptimiser.js'
import Errors from './Errors.js'
import metrics from '@overleaf/metrics'

const { ConversionError, InvalidParametersError } = Errors

const FileHandler = {
  insertFile: callbackify(insertFile),
  getFile: callbackify(getFile),
  getRedirectUrl: callbackify(getRedirectUrl),
  getFileSize: callbackify(getFileSize),
  promises: {
    getFile,
    getRedirectUrl,
    insertFile,
    getFileSize,
  },
}

let PersistorManager = _PersistorManager

if (process.env.NODE_ENV === 'test') {
  FileHandler._TESTONLYSwapPersistorManager = _PersistorManager => {
    PersistorManager = _PersistorManager
  }
}

async function insertFile(bucket, key, stream) {
  const convertedKey = KeyBuilder.getConvertedFolderKey(key)
  if (
    !convertedKey.match(/^[0-9a-f]{24}\/([0-9a-f]{24}|v\/[0-9]+\/[a-z0-9]+)/i)
  ) {
    throw new InvalidParametersError('key does not match validation regex', {
      bucket,
      key,
      convertedKey,
    })
  }
  await PersistorManager.sendStream(bucket, key, stream)
}

async function getFile(bucket, key, opts) {
  opts = opts || {}
  if (!opts.format && !opts.style) {
    return await PersistorManager.getObjectStream(bucket, key, opts)
  } else {
    return await _getConvertedFile(bucket, key, opts)
  }
}

let ACTIVE_SIGNED_URL_CALLS = 0

async function getRedirectUrl(bucket, key, opts) {
  // if we're doing anything unusual with options, or the request isn't for
  // one of the default buckets, return null so that we proxy the file
  opts = opts || {}
  if (
    !opts.start &&
    !opts.end &&
    !opts.format &&
    !opts.style &&
    Object.values(Settings.filestore.stores).includes(bucket) &&
    Settings.filestore.allowRedirects
  ) {
    // record the number of in-flight calls to generate signed URLs
    metrics.gauge('active_signed_url_calls', ++ACTIVE_SIGNED_URL_CALLS, {
      path: bucket,
    })
    try {
      const timer = new metrics.Timer('signed_url_call_time', {
        path: bucket,
      })
      const redirectUrl = await PersistorManager.getRedirectUrl(bucket, key)
      timer.done()
      return redirectUrl
    } finally {
      metrics.gauge('active_signed_url_calls', --ACTIVE_SIGNED_URL_CALLS, {
        path: bucket,
      })
    }
  }

  return null
}

async function getFileSize(bucket, key) {
  return await PersistorManager.getObjectSize(bucket, key)
}

async function _getConvertedFile(bucket, key, opts) {
  const convertedKey = KeyBuilder.addCachingToKey(key, opts)
  const exists = await PersistorManager.checkIfObjectExists(
    bucket,
    convertedKey
  )
  if (exists) {
    return await PersistorManager.getObjectStream(bucket, convertedKey, opts)
  } else {
    return await _getConvertedFileAndCache(bucket, key, convertedKey, opts)
  }
}

async function _getConvertedFileAndCache(bucket, key, convertedKey, opts) {
  let convertedFsPath
  try {
    convertedFsPath = await _convertFile(bucket, key, opts)
    await ImageOptimiser.promises.compressPng(convertedFsPath)
    await PersistorManager.sendFile(bucket, convertedKey, convertedFsPath)
  } catch (err) {
    LocalFileWriter.deleteFile(convertedFsPath, () => {})
    throw new ConversionError(
      'failed to convert file',
      { opts, bucket, key, convertedKey },
      err
    )
  }
  // Send back the converted file from the local copy to avoid problems
  // with the file not being present in S3 yet.  As described in the
  // documentation below, we have already made a 'HEAD' request in
  // checkIfFileExists so we only have "eventual consistency" if we try
  // to stream it from S3 here.  This was a cause of many 403 errors.
  //
  // "Amazon S3 provides read-after-write consistency for PUTS of new
  // objects in your S3 bucket in all regions with one caveat. The
  // caveat is that if you make a HEAD or GET request to the key name
  // (to find if the object exists) before creating the object, Amazon
  // S3 provides eventual consistency for read-after-write.""
  // https://docs.aws.amazon.com/AmazonS3/latest/dev/Introduction.html#ConsistencyModel
  const readStream = fs.createReadStream(convertedFsPath)
  readStream.on('error', function () {
    LocalFileWriter.deleteFile(convertedFsPath, function () {})
  })
  readStream.on('end', function () {
    LocalFileWriter.deleteFile(convertedFsPath, function () {})
  })
  return readStream
}

async function _convertFile(bucket, originalKey, opts) {
  let originalFsPath
  try {
    originalFsPath = await _writeFileToDisk(bucket, originalKey, opts)
  } catch (err) {
    throw new ConversionError(
      'unable to write file to disk',
      { bucket, originalKey, opts },
      err
    )
  }

  let promise
  if (opts.format) {
    promise = FileConverter.promises.convert(originalFsPath, opts.format)
  } else if (opts.style === 'thumbnail') {
    promise = FileConverter.promises.thumbnail(originalFsPath)
  } else if (opts.style === 'preview') {
    promise = FileConverter.promises.preview(originalFsPath)
  } else {
    throw new ConversionError('invalid file conversion options', {
      bucket,
      originalKey,
      opts,
    })
  }
  let destPath
  try {
    destPath = await promise
  } catch (err) {
    throw new ConversionError(
      'error converting file',
      { bucket, originalKey, opts },
      err
    )
  }
  LocalFileWriter.deleteFile(originalFsPath, function () {})
  return destPath
}

async function _writeFileToDisk(bucket, key, opts) {
  const fileStream = await PersistorManager.getObjectStream(bucket, key, opts)
  return await LocalFileWriter.promises.writeStream(fileStream, key)
}

export default FileHandler
