/* eslint-disable
    handle-callback-err,
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
let FileWriter
const fs = require('fs')
const logger = require('logger-sharelatex')
const uuid = require('uuid')
const _ = require('underscore')
const Settings = require('settings-sharelatex')
const request = require('request')

module.exports = FileWriter = {
  ensureDumpFolderExists(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return fs.mkdir(Settings.path.dumpFolder, function(error) {
      if (error != null && error.code !== 'EEXIST') {
        // Ignore error about already existing
        return callback(error)
      }
      return callback(null)
    })
  },

  writeLinesToDisk(identifier, lines, callback) {
    if (callback == null) {
      callback = function(error, fsPath) {}
    }
    return FileWriter.writeContentToDisk(identifier, lines.join('\n'), callback)
  },

  writeContentToDisk(identifier, content, callback) {
    if (callback == null) {
      callback = function(error, fsPath) {}
    }
    callback = _.once(callback)
    const fsPath = `${Settings.path.dumpFolder}/${identifier}_${uuid.v4()}`
    return FileWriter.ensureDumpFolderExists(function(error) {
      if (error != null) {
        return callback(error)
      }
      return fs.writeFile(fsPath, content, function(error) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, fsPath)
      })
    })
  },

  writeStreamToDisk(identifier, stream, callback) {
    if (callback == null) {
      callback = function(error, fsPath) {}
    }
    callback = _.once(callback)
    const fsPath = `${Settings.path.dumpFolder}/${identifier}_${uuid.v4()}`

    stream.pause()
    return FileWriter.ensureDumpFolderExists(function(error) {
      if (error != null) {
        return callback(error)
      }
      stream.resume()

      const writeStream = fs.createWriteStream(fsPath)
      stream.pipe(writeStream)

      stream.on('error', function(err) {
        logger.warn(
          { err, identifier, fsPath },
          '[writeStreamToDisk] something went wrong with incoming stream'
        )
        return callback(err)
      })
      writeStream.on('error', function(err) {
        logger.warn(
          { err, identifier, fsPath },
          '[writeStreamToDisk] something went wrong with writing to disk'
        )
        return callback(err)
      })
      return writeStream.on('finish', function() {
        logger.log(
          { identifier, fsPath },
          '[writeStreamToDisk] write stream finished'
        )
        return callback(null, fsPath)
      })
    })
  },

  writeUrlToDisk(identifier, url, callback) {
    if (callback == null) {
      callback = function(error, fsPath) {}
    }
    callback = _.once(callback)
    const stream = request.get(url)
    stream.on('error', function(err) {
      logger.warn(
        { err, identifier, url },
        '[writeUrlToDisk] something went wrong with writing to disk'
      )
      callback(err)
    })
    stream.on('response', function(response) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return FileWriter.writeStreamToDisk(identifier, stream, callback)
      } else {
        const err = new Error(`bad response from url: ${response.statusCode}`)
        logger.warn({ err, identifier, url }, `[writeUrlToDisk] ${err.message}`)
        return callback(err)
      }
    })
  }
}
