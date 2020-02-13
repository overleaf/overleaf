const settings = require('settings-sharelatex')
const metrics = require('metrics-sharelatex')
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

async function sendFile(bucket, key, fsPath) {
  let readStream
  try {
    readStream = fs.createReadStream(fsPath)
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'error reading file from disk',
      { bucketName: bucket, key, fsPath },
      ReadError
    )
  }
  return sendStream(bucket, key, readStream)
}

async function sendStream(bucket, key, readStream, sourceMd5) {
  try {
    let hashPromise

    // if there is no supplied md5 hash, we calculate the hash as the data passes through
    if (!sourceMd5) {
      hashPromise = PersistorHelper.calculateStreamMd5(readStream)
    }

    const meteredStream = PersistorHelper.getMeteredStream(
      readStream,
      (_, byteCount) => {
        metrics.count('gcs.egress', byteCount)
      }
    )

    const writeOptions = {
      resumable: false // recommended by Google
    }

    if (sourceMd5) {
      writeOptions.validation = 'md5'
      writeOptions.metadata = {
        md5Hash: PersistorHelper.hexToBase64(sourceMd5)
      }
    }

    const uploadStream = storage
      .bucket(bucket)
      .file(key)
      .createWriteStream(writeOptions)

    await pipeline(meteredStream, uploadStream)

    // if we didn't have an md5 hash, we should compare our computed one with Google's
    // as we couldn't tell GCS about it beforehand
    if (hashPromise) {
      sourceMd5 = await hashPromise
      // throws on mismatch
      await PersistorHelper.verifyMd5(GcsPersistor, bucket, key, sourceMd5)
    }
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'upload to GCS failed',
      { bucket, key },
      WriteError
    )
  }
}

async function getFileStream(bucket, key, opts = {}) {
  if (opts.end) {
    // S3 (and http range headers) treat 'end' as inclusive, so increase this by 1
    opts.end++
  }
  const stream = storage
    .bucket(bucket)
    .file(key)
    .createReadStream(opts)

  const meteredStream = PersistorHelper.getMeteredStream(stream, (_, bytes) => {
    // ignore the error parameter and just log the byte count
    metrics.count('gcs.ingress', bytes)
  })

  try {
    await PersistorHelper.waitForStreamReady(stream)
    return meteredStream
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'error reading file from GCS',
      { bucket, key, opts },
      ReadError
    )
  }
}

async function getFileSize(bucket, key) {
  try {
    const metadata = await storage
      .bucket(bucket)
      .file(key)
      .getMetadata()
    return metadata[0].size
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'error getting size of GCS object',
      { bucket, key },
      ReadError
    )
  }
}

async function getFileMd5Hash(bucket, key) {
  try {
    const metadata = await storage
      .bucket(bucket)
      .file(key)
      .getMetadata()
    return PersistorHelper.base64ToHex(metadata[0].md5Hash)
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'error getting hash of GCS object',
      { bucket, key },
      ReadError
    )
  }
}

async function deleteFile(bucket, key) {
  try {
    await storage
      .bucket(bucket)
      .file(key)
      .delete()
  } catch (err) {
    const error = PersistorHelper.wrapError(
      err,
      'error deleting GCS object',
      { bucket, key },
      WriteError
    )
    if (!(error instanceof NotFoundError)) {
      throw error
    }
  }
}

async function deleteDirectory(bucket, key) {
  let files

  try {
    const response = await storage.bucket(bucket).getFiles({ directory: key })
    files = response[0]
  } catch (err) {
    const error = PersistorHelper.wrapError(
      err,
      'failed to list objects in GCS',
      { bucket, key },
      ReadError
    )
    if (error instanceof NotFoundError) {
      return
    }
    throw error
  }

  for (const index in files) {
    try {
      await files[index].delete()
    } catch (err) {
      const error = PersistorHelper.wrapError(
        err,
        'failed to delete object in GCS',
        { bucket, key },
        WriteError
      )
      if (!(error instanceof NotFoundError)) {
        throw error
      }
    }
  }
}

async function directorySize(bucket, key) {
  let files

  try {
    const response = await storage.bucket(bucket).getFiles({ directory: key })
    files = response[0]
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'failed to list objects in GCS',
      { bucket, key },
      ReadError
    )
  }

  return files.reduce((acc, file) => Number(file.metadata.size) + acc, 0)
}

async function checkIfFileExists(bucket, key) {
  try {
    const response = await storage
      .bucket(bucket)
      .file(key)
      .exists()
    return response[0]
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'error checking if file exists in GCS',
      { bucket, key },
      ReadError
    )
  }
}

async function copyFile(bucket, sourceKey, destKey) {
  try {
    const src = storage.bucket(bucket).file(sourceKey)
    const dest = storage.bucket(bucket).file(destKey)
    await src.copy(dest)
  } catch (err) {
    // fake-gcs-server has a bug that returns an invalid response when the file does not exist
    if (err.message === 'Cannot parse response as JSON: not found\n') {
      err.code = 404
    }
    throw PersistorHelper.wrapError(
      err,
      'failed to copy file in GCS',
      { bucket, sourceKey, destKey },
      WriteError
    )
  }
}
