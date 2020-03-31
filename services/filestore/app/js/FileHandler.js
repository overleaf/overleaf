const Settings = require('settings-sharelatex')
const { callbackify } = require('util')
const fs = require('fs')
const PersistorManager = require('./PersistorManager')
const LocalFileWriter = require('./LocalFileWriter')
const FileConverter = require('./FileConverter')
const KeyBuilder = require('./KeyBuilder')
const ImageOptimiser = require('./ImageOptimiser')
const { ConversionError, InvalidParametersError } = require('./Errors')

module.exports = {
  insertFile: callbackify(insertFile),
  deleteFile: callbackify(deleteFile),
  deleteProject: callbackify(deleteProject),
  getFile: callbackify(getFile),
  getFileSize: callbackify(getFileSize),
  getDirectorySize: callbackify(getDirectorySize),
  promises: {
    getFile,
    insertFile,
    deleteFile,
    deleteProject,
    getFileSize,
    getDirectorySize
  }
}

async function insertFile(bucket, key, stream) {
  const convertedKey = KeyBuilder.getConvertedFolderKey(key)
  if (!convertedKey.match(/^[0-9a-f]{24}\/[0-9a-f]{24}/i)) {
    throw new InvalidParametersError({
      message: 'key does not match validation regex',
      info: { bucket, key, convertedKey }
    })
  }
  if (Settings.enableConversions) {
    await PersistorManager.promises.deleteDirectory(bucket, convertedKey)
  }
  await PersistorManager.promises.sendStream(bucket, key, stream)
}

async function deleteFile(bucket, key) {
  const convertedKey = KeyBuilder.getConvertedFolderKey(key)
  if (!convertedKey.match(/^[0-9a-f]{24}\/[0-9a-f]{24}/i)) {
    throw new InvalidParametersError({
      message: 'key does not match validation regex',
      info: { bucket, key, convertedKey }
    })
  }
  const jobs = [PersistorManager.promises.deleteFile(bucket, key)]
  if (Settings.enableConversions) {
    jobs.push(PersistorManager.promises.deleteDirectory(bucket, convertedKey))
  }
  await Promise.all(jobs)
}

async function deleteProject(bucket, key) {
  if (!key.match(/^[0-9a-f]{24}\//i)) {
    throw new InvalidParametersError({
      message: 'key does not match validation regex',
      info: { bucket, key }
    })
  }
  await PersistorManager.promises.deleteDirectory(bucket, key)
}

async function getFile(bucket, key, opts) {
  opts = opts || {}
  if (!opts.format && !opts.style) {
    return PersistorManager.promises.getFileStream(bucket, key, opts)
  } else {
    return _getConvertedFile(bucket, key, opts)
  }
}

async function getFileSize(bucket, key) {
  return PersistorManager.promises.getFileSize(bucket, key)
}

async function getDirectorySize(bucket, projectId) {
  return PersistorManager.promises.directorySize(bucket, projectId)
}

async function _getConvertedFile(bucket, key, opts) {
  const convertedKey = KeyBuilder.addCachingToKey(key, opts)
  const exists = await PersistorManager.promises.checkIfFileExists(
    bucket,
    convertedKey
  )
  if (exists) {
    return PersistorManager.promises.getFileStream(bucket, convertedKey, opts)
  } else {
    return _getConvertedFileAndCache(bucket, key, convertedKey, opts)
  }
}

async function _getConvertedFileAndCache(bucket, key, convertedKey, opts) {
  let convertedFsPath
  try {
    convertedFsPath = await _convertFile(bucket, key, opts)
    await ImageOptimiser.promises.compressPng(convertedFsPath)
    await PersistorManager.promises.sendFile(
      bucket,
      convertedKey,
      convertedFsPath
    )
  } catch (err) {
    LocalFileWriter.deleteFile(convertedFsPath, () => {})
    throw new ConversionError({
      message: 'failed to convert file',
      info: { opts, bucket, key, convertedKey }
    }).withCause(err)
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
  readStream.on('end', function() {
    LocalFileWriter.deleteFile(convertedFsPath, function() {})
  })
  return readStream
}

async function _convertFile(bucket, originalKey, opts) {
  let originalFsPath
  try {
    originalFsPath = await _writeFileToDisk(bucket, originalKey, opts)
  } catch (err) {
    throw new ConversionError({
      message: 'unable to write file to disk',
      info: { bucket, originalKey, opts }
    }).withCause(err)
  }

  let promise
  if (opts.format) {
    promise = FileConverter.promises.convert(originalFsPath, opts.format)
  } else if (opts.style === 'thumbnail') {
    promise = FileConverter.promises.thumbnail(originalFsPath)
  } else if (opts.style === 'preview') {
    promise = FileConverter.promises.preview(originalFsPath)
  } else {
    throw new ConversionError({
      message: 'invalid file conversion options',
      info: {
        bucket,
        originalKey,
        opts
      }
    })
  }
  let destPath
  try {
    destPath = await promise
  } catch (err) {
    throw new ConversionError({
      message: 'error converting file',
      info: { bucket, originalKey, opts }
    }).withCause(err)
  }
  LocalFileWriter.deleteFile(originalFsPath, function() {})
  return destPath
}

async function _writeFileToDisk(bucket, key, opts) {
  const fileStream = await PersistorManager.promises.getFileStream(
    bucket,
    key,
    opts
  )
  return LocalFileWriter.promises.writeStream(fileStream, key)
}
