const { promisify } = require('util')
const fs = require('fs')
const PersistorManager = require('./PersistorManager')
const LocalFileWriter = require('./LocalFileWriter')
const FileConverter = require('./FileConverter')
const KeyBuilder = require('./KeyBuilder')
const async = require('async')
const ImageOptimiser = require('./ImageOptimiser')
const { ConversionError } = require('./Errors')

module.exports = {
  insertFile,
  deleteFile,
  getFile,
  getFileSize,
  getDirectorySize,
  promises: {
    getFile: promisify(getFile),
    insertFile: promisify(insertFile),
    deleteFile: promisify(deleteFile),
    getFileSize: promisify(getFileSize),
    getDirectorySize: promisify(getDirectorySize)
  }
}

function insertFile(bucket, key, stream, callback) {
  const convertedKey = KeyBuilder.getConvertedFolderKey(key)
  PersistorManager.deleteDirectory(bucket, convertedKey, function(error) {
    if (error) {
      return callback(error)
    }
    PersistorManager.sendStream(bucket, key, stream, callback)
  })
}

function deleteFile(bucket, key, callback) {
  const convertedKey = KeyBuilder.getConvertedFolderKey(key)
  async.parallel(
    [
      done => PersistorManager.deleteFile(bucket, key, done),
      done => PersistorManager.deleteDirectory(bucket, convertedKey, done)
    ],
    callback
  )
}

function getFile(bucket, key, opts, callback) {
  opts = opts || {}
  if (!opts.format && !opts.style) {
    PersistorManager.getFileStream(bucket, key, opts, callback)
  } else {
    _getConvertedFile(bucket, key, opts, callback)
  }
}

function getFileSize(bucket, key, callback) {
  PersistorManager.getFileSize(bucket, key, callback)
}

function getDirectorySize(bucket, projectId, callback) {
  PersistorManager.directorySize(bucket, projectId, callback)
}

function _getConvertedFile(bucket, key, opts, callback) {
  const convertedKey = KeyBuilder.addCachingToKey(key, opts)
  PersistorManager.checkIfFileExists(bucket, convertedKey, (err, exists) => {
    if (err) {
      return callback(err)
    }

    if (exists) {
      PersistorManager.getFileStream(bucket, convertedKey, opts, callback)
    } else {
      _getConvertedFileAndCache(bucket, key, convertedKey, opts, callback)
    }
  })
}

function _getConvertedFileAndCache(bucket, key, convertedKey, opts, callback) {
  let convertedFsPath

  async.series(
    [
      cb => {
        _convertFile(bucket, key, opts, function(err, fileSystemPath) {
          convertedFsPath = fileSystemPath
          cb(err)
        })
      },
      cb => ImageOptimiser.compressPng(convertedFsPath, cb),
      cb => PersistorManager.sendFile(bucket, convertedKey, convertedFsPath, cb)
    ],
    function(err) {
      if (err) {
        LocalFileWriter.deleteFile(convertedFsPath, function() {})
        return callback(
          new ConversionError({
            message: 'failed to convert file',
            info: { opts, bucket, key, convertedKey }
          }).withCause(err)
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
      readStream.on('end', function() {
        LocalFileWriter.deleteFile(convertedFsPath, function() {})
      })
      callback(null, readStream)
    }
  )
}

function _convertFile(bucket, originalKey, opts, callback) {
  _writeFileToDisk(bucket, originalKey, opts, function(err, originalFsPath) {
    if (err) {
      return callback(
        new ConversionError({
          message: 'unable to write file to disk',
          info: { bucket, originalKey, opts }
        }).withCause(err)
      )
    }

    const done = function(err, destPath) {
      if (err) {
        return callback(
          new ConversionError({
            message: 'error converting file',
            info: { bucket, originalKey, opts }
          }).withCause(err)
        )
      }
      LocalFileWriter.deleteFile(originalFsPath, function() {})
      callback(err, destPath)
    }

    if (opts.format) {
      FileConverter.convert(originalFsPath, opts.format, done)
    } else if (opts.style === 'thumbnail') {
      FileConverter.thumbnail(originalFsPath, done)
    } else if (opts.style === 'preview') {
      FileConverter.preview(originalFsPath, done)
    } else {
      callback(
        new ConversionError({
          message: 'invalid file conversion options',
          info: {
            bucket,
            originalKey,
            opts
          }
        })
      )
    }
  })
}

function _writeFileToDisk(bucket, key, opts, callback) {
  PersistorManager.getFileStream(bucket, key, opts, function(err, fileStream) {
    if (err) {
      return callback(err)
    }
    LocalFileWriter.writeStream(fileStream, key, callback)
  })
}
