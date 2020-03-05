const settings = require('settings-sharelatex')
const fs = require('fs')
const { promisify } = require('util')
const Stream = require('stream')
const { Storage } = require('@google-cloud/storage')
const { callbackify } = require('util')
const { WriteError, ReadError, NotFoundError } = require('./Errors')
const PersistorHelper = require('./PersistorHelper')

const pipeline = promisify(Stream.pipeline)

// both of these settings will be null by default except for tests
// that's OK - GCS uses the locally-configured service account by default
const storage = new Storage(settings.filestore.gcs)
// workaround for broken uploads with custom endpoints:
// https://github.com/googleapis/nodejs-storage/issues/898
if (settings.filestore.gcs && settings.filestore.gcs.apiEndpoint) {
  storage.interceptors.push({
    request: function(reqOpts) {
      const url = new URL(reqOpts.uri)
      url.host = settings.filestore.gcs.apiEndpoint
      if (settings.filestore.gcs.apiScheme) {
        url.protocol = settings.filestore.gcs.apiScheme
      }
      reqOpts.uri = url.toString()
      return reqOpts
    }
  })
}

const GcsPersistor = {
  sendFile: callbackify(sendFile),
  sendStream: callbackify(sendStream),
  getFileStream: callbackify(getFileStream),
  getFileMd5Hash: callbackify(getFileMd5Hash),
  deleteDirectory: callbackify(deleteDirectory),
  getFileSize: callbackify(getFileSize),
  deleteFile: callbackify(deleteFile),
  copyFile: callbackify(copyFile),
  checkIfFileExists: callbackify(checkIfFileExists),
  directorySize: callbackify(directorySize),
  promises: {
    sendFile,
    sendStream,
    getFileStream,
    getFileMd5Hash,
    deleteDirectory,
    getFileSize,
    deleteFile,
    copyFile,
    checkIfFileExists,
    directorySize
  }
}

module.exports = GcsPersistor

async function sendFile(bucketName, key, fsPath) {
  return sendStream(bucketName, key, fs.createReadStream(fsPath))
}

async function sendStream(bucketName, key, readStream, sourceMd5) {
  try {
    let hashPromise

    // if there is no supplied md5 hash, we calculate the hash as the data passes through
    if (!sourceMd5) {
      hashPromise = PersistorHelper.calculateStreamMd5(readStream)
    }

    const meteredStream = PersistorHelper.getMeteredStream(
      readStream,
      'gcs.egress' // egress from us to gcs
    )

    const writeOptions = {
      // disabling of resumable uploads is recommended by Google:
      resumable: false
    }

    if (sourceMd5) {
      writeOptions.validation = 'md5'
      writeOptions.metadata = {
        md5Hash: PersistorHelper.hexToBase64(sourceMd5)
      }
    }

    const uploadStream = storage
      .bucket(bucketName)
      .file(key)
      .createWriteStream(writeOptions)

    await pipeline(meteredStream, uploadStream)

    // if we didn't have an md5 hash, we should compare our computed one with Google's
    // as we couldn't tell GCS about it beforehand
    if (hashPromise) {
      sourceMd5 = await hashPromise
      // throws on mismatch
      await PersistorHelper.verifyMd5(GcsPersistor, bucketName, key, sourceMd5)
    }
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'upload to GCS failed',
      { bucketName, key },
      WriteError
    )
  }
}

async function getFileStream(bucketName, key, opts = {}) {
  if (opts.end) {
    // S3 (and http range headers) treat 'end' as inclusive, so increase this by 1
    opts.end++
  }
  const stream = storage
    .bucket(bucketName)
    .file(key)
    .createReadStream(opts)

  const meteredStream = PersistorHelper.getMeteredStream(
    stream,
    'gcs.ingress' // ingress to us from gcs
  )

  try {
    await PersistorHelper.waitForStreamReady(stream)
    return meteredStream
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'error reading file from GCS',
      { bucketName, key, opts },
      ReadError
    )
  }
}

async function getFileSize(bucketName, key) {
  try {
    const [metadata] = await storage
      .bucket(bucketName)
      .file(key)
      .getMetadata()
    return metadata.size
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'error getting size of GCS object',
      { bucketName, key },
      ReadError
    )
  }
}

async function getFileMd5Hash(bucketName, key) {
  try {
    const [metadata] = await storage
      .bucket(bucketName)
      .file(key)
      .getMetadata()
    return PersistorHelper.base64ToHex(metadata.md5Hash)
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'error getting hash of GCS object',
      { bucketName, key },
      ReadError
    )
  }
}

async function deleteFile(bucketName, key) {
  try {
    await storage
      .bucket(bucketName)
      .file(key)
      .delete()
  } catch (err) {
    const error = PersistorHelper.wrapError(
      err,
      'error deleting GCS object',
      { bucketName, key },
      WriteError
    )
    if (!(error instanceof NotFoundError)) {
      throw error
    }
  }
}

async function deleteDirectory(bucketName, key) {
  if (!key.match(/^[a-z0-9_-]+/i)) {
    throw new NotFoundError({
      message: 'deleteDirectoryKey is invalid or missing',
      info: { bucketName, key }
    })
  }

  try {
    await storage
      .bucket(bucketName)
      .deleteFiles({ directory: key, force: true })
  } catch (err) {
    const error = PersistorHelper.wrapError(
      err,
      'failed to delete directory in GCS',
      { bucketName, key },
      WriteError
    )
    if (error instanceof NotFoundError) {
      return
    }
    throw error
  }
}

async function directorySize(bucketName, key) {
  let files

  try {
    const [response] = await storage
      .bucket(bucketName)
      .getFiles({ directory: key })
    files = response
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'failed to list objects in GCS',
      { bucketName, key },
      ReadError
    )
  }

  return files.reduce((acc, file) => Number(file.metadata.size) + acc, 0)
}

async function checkIfFileExists(bucketName, key) {
  try {
    const [response] = await storage
      .bucket(bucketName)
      .file(key)
      .exists()
    return response
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'error checking if file exists in GCS',
      { bucketName, key },
      ReadError
    )
  }
}

async function copyFile(bucketName, sourceKey, destKey) {
  try {
    const src = storage.bucket(bucketName).file(sourceKey)
    const dest = storage.bucket(bucketName).file(destKey)
    await src.copy(dest)
  } catch (err) {
    // fake-gcs-server has a bug that returns an invalid response when the file does not exist
    if (err.message === 'Cannot parse response as JSON: not found\n') {
      err.code = 404
    }
    throw PersistorHelper.wrapError(
      err,
      'failed to copy file in GCS',
      { bucketName, sourceKey, destKey },
      WriteError
    )
  }
}
