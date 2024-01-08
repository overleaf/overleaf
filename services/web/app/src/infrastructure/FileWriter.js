/* eslint-disable
    n/handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fs = require('fs')
const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')
const crypto = require('crypto')
const _ = require('lodash')
const Settings = require('@overleaf/settings')
const request = require('request')
const { Transform, pipeline } = require('stream')
const { FileTooLargeError } = require('../Features/Errors/Errors')
const { promisifyAll } = require('@overleaf/promise-utils')

class SizeLimitedStream extends Transform {
  constructor(options) {
    options.autoDestroy = true
    super(options)

    this.bytes = 0
    this.maxSizeBytes = options.maxSizeBytes || Settings.maxUploadSize
    this.drain = false
    this.on('error', () => {
      this.drain = true
      this.resume()
    })
  }

  _transform(chunk, encoding, done) {
    if (this.drain) {
      // mechanism to drain the source stream on error, to avoid leaks
      // we consume the rest of the incoming stream and don't push it anywhere
      return done()
    }

    this.bytes += chunk.length
    if (this.maxSizeBytes && this.bytes > this.maxSizeBytes) {
      return done(
        new FileTooLargeError({
          message: 'stream size limit reached',
          info: { size: this.bytes },
        })
      )
    }
    this.push(chunk)
    done()
  }
}

const FileWriter = {
  ensureDumpFolderExists() {
    fs.mkdirSync(Settings.path.dumpFolder, { recursive: true })
  },

  writeLinesToDisk(identifier, lines, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return FileWriter.writeContentToDisk(identifier, lines.join('\n'), callback)
  },

  writeContentToDisk(identifier, content, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const fsPath = `${
      Settings.path.dumpFolder
    }/${identifier}_${crypto.randomUUID()}`
    return fs.writeFile(fsPath, content, function (error) {
      if (error != null) {
        return callback(error)
      }
      return callback(null, fsPath)
    })
  },

  writeStreamToDisk(identifier, stream, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    if (callback == null) {
      callback = function () {}
    }
    options = options || {}

    const fsPath = `${
      Settings.path.dumpFolder
    }/${identifier}_${crypto.randomUUID()}`

    const writeStream = fs.createWriteStream(fsPath)
    const passThrough = new SizeLimitedStream({
      maxSizeBytes: options.maxSizeBytes,
    })

    // if writing fails, we want to consume the bytes from the source, to avoid leaks
    for (const evt of ['error', 'close']) {
      writeStream.on(evt, function () {
        passThrough.unpipe(writeStream)
        passThrough.resume()
      })
    }

    pipeline(stream, passThrough, writeStream, function (err) {
      if (
        options.maxSizeBytes &&
        passThrough.bytes >= options.maxSizeBytes &&
        !(err instanceof FileTooLargeError)
      ) {
        err = new FileTooLargeError({
          message: 'stream size limit reached',
          info: { size: passThrough.bytes },
        }).withCause(err || {})
      }
      if (err) {
        OError.tag(
          err,
          '[writeStreamToDisk] something went wrong writing the stream to disk',
          {
            identifier,
            fsPath,
          }
        )
        return callback(err)
      }

      logger.debug(
        { identifier, fsPath },
        '[writeStreamToDisk] write stream finished'
      )
      callback(null, fsPath)
    })
  },

  writeUrlToDisk(identifier, url, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    if (callback == null) {
      callback = function () {}
    }
    options = options || {}
    callback = _.once(callback)

    const stream = request.get(url)
    stream.on('error', function (err) {
      logger.warn(
        { err, identifier, url },
        '[writeUrlToDisk] something went wrong with writing to disk'
      )
      callback(err)
    })
    stream.on('response', function (response) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        FileWriter.writeStreamToDisk(identifier, stream, options, callback)
      } else {
        const err = new Error(`bad response from url: ${response.statusCode}`)
        logger.warn({ err, identifier, url }, `[writeUrlToDisk] ${err.message}`)
        return callback(err)
      }
    })
  },
}

module.exports = FileWriter
module.exports.promises = promisifyAll(FileWriter, {
  without: ['ensureDumpFolderExists'],
})
module.exports.SizeLimitedStream = SizeLimitedStream
