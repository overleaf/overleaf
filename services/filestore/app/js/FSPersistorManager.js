/* eslint-disable
    handle-callback-err,
    no-unreachable,
    node/no-deprecated-api,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const logger = require('logger-sharelatex')
const fs = require('fs')
const path = require('path')
const LocalFileWriter = require('./LocalFileWriter')
const Errors = require('./Errors')
const rimraf = require('rimraf')
const _ = require('underscore')

const filterName = key => key.replace(/\//g, '_')

module.exports = {
  sendFile(location, target, source, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    const filteredTarget = filterName(target)
    logger.log({ location, target: filteredTarget, source }, 'sending file')
    const done = _.once(function(err) {
      if (err != null) {
        logger.err(
          { err, location, target: filteredTarget, source },
          'Error on put of file'
        )
      }
      return callback(err)
    })
    // actually copy the file (instead of moving it) to maintain consistent behaviour
    // between the different implementations
    const sourceStream = fs.createReadStream(source)
    sourceStream.on('error', done)
    const targetStream = fs.createWriteStream(`${location}/${filteredTarget}`)
    targetStream.on('error', done)
    targetStream.on('finish', () => done())
    return sourceStream.pipe(targetStream)
  },

  sendStream(location, target, sourceStream, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    logger.log({ location, target }, 'sending file stream')
    sourceStream.on('error', err =>
      logger.err({ location, target, err: err('error on stream to send') })
    )
    return LocalFileWriter.writeStream(sourceStream, null, (err, fsPath) => {
      if (err != null) {
        logger.err(
          { location, target, fsPath, err },
          'something went wrong writing stream to disk'
        )
        return callback(err)
      }
      return this.sendFile(location, target, fsPath, (
        err // delete the temporary file created above and return the original error
      ) => LocalFileWriter.deleteFile(fsPath, () => callback(err)))
    })
  },

  // opts may be {start: Number, end: Number}
  getFileStream(location, name, opts, callback) {
    if (callback == null) {
      callback = function(err, res) {}
    }
    const filteredName = filterName(name)
    logger.log({ location, filteredName }, 'getting file')
    return fs.open(`${location}/${filteredName}`, 'r', function(err, fd) {
      if (err != null) {
        logger.err(
          { err, location, filteredName: name },
          'Error reading from file'
        )
      }
      if (err.code === 'ENOENT') {
        return callback(new Errors.NotFoundError(err.message), null)
      } else {
        return callback(err, null)
      }
      opts.fd = fd
      const sourceStream = fs.createReadStream(null, opts)
      return callback(null, sourceStream)
    })
  },

  getFileSize(location, filename, callback) {
    const fullPath = path.join(location, filterName(filename))
    return fs.stat(fullPath, function(err, stats) {
      if (err != null) {
        if (err.code === 'ENOENT') {
          logger.log({ location, filename }, 'file not found')
          callback(new Errors.NotFoundError(err.message))
        } else {
          logger.err({ err, location, filename }, 'failed to stat file')
          callback(err)
        }
        return
      }
      return callback(null, stats.size)
    })
  },

  copyFile(location, fromName, toName, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    const filteredFromName = filterName(fromName)
    const filteredToName = filterName(toName)
    logger.log(
      { location, fromName: filteredFromName, toName: filteredToName },
      'copying file'
    )
    const sourceStream = fs.createReadStream(`${location}/${filteredFromName}`)
    sourceStream.on('error', function(err) {
      logger.err(
        { err, location, key: filteredFromName },
        'Error reading from file'
      )
      return callback(err)
    })
    const targetStream = fs.createWriteStream(`${location}/${filteredToName}`)
    targetStream.on('error', function(err) {
      logger.err(
        { err, location, key: filteredToName },
        'Error writing to file'
      )
      return callback(err)
    })
    targetStream.on('finish', () => callback(null))
    return sourceStream.pipe(targetStream)
  },

  deleteFile(location, name, callback) {
    const filteredName = filterName(name)
    logger.log({ location, filteredName }, 'delete file')
    return fs.unlink(`${location}/${filteredName}`, function(err) {
      if (err != null) {
        logger.err({ err, location, filteredName }, 'Error on delete.')
        return callback(err)
      } else {
        return callback()
      }
    })
  },

  deleteDirectory(location, name, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    const filteredName = filterName(name.replace(/\/$/, ''))
    return rimraf(`${location}/${filteredName}`, function(err) {
      if (err != null) {
        logger.err({ err, location, filteredName }, 'Error on rimraf rmdir.')
        return callback(err)
      } else {
        return callback()
      }
    })
  },

  checkIfFileExists(location, name, callback) {
    if (callback == null) {
      callback = function(err, exists) {}
    }
    const filteredName = filterName(name)
    logger.log({ location, filteredName }, 'checking if file exists')
    return fs.exists(`${location}/${filteredName}`, function(exists) {
      logger.log({ location, filteredName, exists }, 'checked if file exists')
      return callback(null, exists)
    })
  },

  directorySize(location, name, callback) {
    const filteredName = filterName(name.replace(/\/$/, ''))
    logger.log({ location, filteredName }, 'get project size in file system')
    return fs.readdir(`${location}/${filteredName}`, function(err, files) {
      if (err != null) {
        logger.err(
          { err, location, filteredName },
          'something went wrong listing prefix in aws'
        )
        return callback(err)
      }
      let totalSize = 0
      _.each(files, function(entry) {
        const fd = fs.openSync(`${location}/${filteredName}/${entry}`, 'r')
        const fileStats = fs.fstatSync(fd)
        totalSize += fileStats.size
        return fs.closeSync(fd)
      })
      logger.log({ totalSize }, 'total size', { files })
      return callback(null, totalSize)
    })
  }
}
