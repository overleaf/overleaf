/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const fs = require('fs')
const { promisify } = require('util')
const Path = require('path')
const fse = require('fs-extra')
const yauzl = require('yauzl')
const Settings = require('settings-sharelatex')
const Errors = require('../Errors/Errors')
const _ = require('underscore')

const ONE_MEG = 1024 * 1024

const ArchiveManager = {
  _isZipTooLarge(source, callback) {
    if (callback == null) {
      callback = function(err, isTooLarge) {}
    }
    callback = _.once(callback)

    let totalSizeInBytes = null
    return yauzl.open(source, { lazyEntries: true }, function(err, zipfile) {
      if (err != null) {
        return callback(new Errors.InvalidError('invalid_zip_file'))
      }

      if (
        Settings.maxEntitiesPerProject != null &&
        zipfile.entryCount > Settings.maxEntitiesPerProject
      ) {
        return callback(null, true) // too many files in zip file
      }

      zipfile.on('error', callback)

      // read all the entries
      zipfile.readEntry()
      zipfile.on('entry', function(entry) {
        totalSizeInBytes += entry.uncompressedSize
        return zipfile.readEntry()
      }) // get the next entry

      // no more entries to read
      return zipfile.on('end', function() {
        if (totalSizeInBytes == null || isNaN(totalSizeInBytes)) {
          logger.warn(
            { source, totalSizeInBytes },
            'error getting bytes of zip'
          )
          return callback(new Errors.InvalidError('invalid_zip_file'))
        }
        const isTooLarge = totalSizeInBytes > ONE_MEG * 300
        return callback(null, isTooLarge)
      })
    })
  },

  _checkFilePath(entry, destination, callback) {
    // transform backslashes to forwardslashes to accommodate badly-behaved zip archives
    if (callback == null) {
      callback = function(err, destFile) {}
    }
    const transformedFilename = entry.fileName.replace(/\\/g, '/')
    // check if the entry is a directory
    const endsWithSlash = /\/$/
    if (endsWithSlash.test(transformedFilename)) {
      return callback() // don't give a destfile for directory
    }
    // check that the file does not use a relative path
    for (let dir of Array.from(transformedFilename.split('/'))) {
      if (dir === '..') {
        return callback(new Error('relative path'))
      }
    }
    // check that the destination file path is normalized
    const dest = `${destination}/${transformedFilename}`
    if (dest !== Path.normalize(dest)) {
      return callback(new Error('unnormalized path'))
    } else {
      return callback(null, dest)
    }
  },

  _writeFileEntry(zipfile, entry, destFile, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    callback = _.once(callback)

    return zipfile.openReadStream(entry, function(err, readStream) {
      if (err != null) {
        return callback(err)
      }
      readStream.on('error', callback)
      readStream.on('end', callback)

      const errorHandler = function(err) {
        // clean up before calling callback
        readStream.unpipe()
        readStream.destroy()
        return callback(err)
      }

      return fse.ensureDir(Path.dirname(destFile), function(err) {
        if (err != null) {
          return errorHandler(err)
        }
        const writeStream = fs.createWriteStream(destFile)
        writeStream.on('error', errorHandler)
        return readStream.pipe(writeStream)
      })
    })
  },

  _extractZipFiles(source, destination, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    callback = _.once(callback)

    return yauzl.open(source, { lazyEntries: true }, function(err, zipfile) {
      if (err != null) {
        return callback(err)
      }
      zipfile.on('error', callback)
      // read all the entries
      zipfile.readEntry()

      let entryFileCount = 0
      zipfile.on('entry', function(entry) {
        logger.log(
          { source, fileName: entry.fileName },
          'processing zip file entry'
        )
        return ArchiveManager._checkFilePath(entry, destination, function(
          err,
          destFile
        ) {
          if (err != null) {
            logger.warn({ err, source, destination }, 'skipping bad file path')
            zipfile.readEntry() // bad path, just skip to the next file
            return
          }
          if (destFile != null) {
            // only write files
            return ArchiveManager._writeFileEntry(
              zipfile,
              entry,
              destFile,
              function(err) {
                if (err != null) {
                  logger.warn(
                    { err, source, destFile },
                    'error unzipping file entry'
                  )
                  zipfile.close() // bail out, stop reading file entries
                  return callback(err)
                } else {
                  entryFileCount++
                  return zipfile.readEntry()
                }
              }
            ) // continue to the next file
          } else {
            // if it's a directory, continue
            return zipfile.readEntry()
          }
        })
      })
      // no more entries to read
      return zipfile.on('end', () => {
        if (entryFileCount > 0) {
          callback()
        } else {
          callback(new Errors.InvalidError('empty_zip_file'))
        }
      })
    })
  },

  extractZipArchive(source, destination, _callback) {
    if (_callback == null) {
      _callback = function(err) {}
    }
    const callback = function(...args) {
      _callback(...Array.from(args || []))
      return (_callback = function() {})
    }

    return ArchiveManager._isZipTooLarge(source, function(err, isTooLarge) {
      if (err != null) {
        logger.warn({ err }, 'error checking size of zip file')
        return callback(err)
      }

      if (isTooLarge) {
        return callback(new Errors.InvalidError('zip_contents_too_large'))
      }

      const timer = new metrics.Timer('unzipDirectory')
      logger.log({ source, destination }, 'unzipping file')

      return ArchiveManager._extractZipFiles(source, destination, function(
        err
      ) {
        timer.done()
        if (err != null) {
          logger.warn({ err, source, destination }, 'unzip failed')
          return callback(err)
        } else {
          return callback()
        }
      })
    })
  },

  findTopLevelDirectory(directory, callback) {
    if (callback == null) {
      callback = function(error, topLevelDir) {}
    }
    return fs.readdir(directory, function(error, files) {
      if (error != null) {
        return callback(error)
      }
      if (files.length === 1) {
        const childPath = Path.join(directory, files[0])
        return fs.stat(childPath, function(error, stat) {
          if (error != null) {
            return callback(error)
          }
          if (stat.isDirectory()) {
            return callback(null, childPath)
          } else {
            return callback(null, directory)
          }
        })
      } else {
        return callback(null, directory)
      }
    })
  }
}

const promises = {
  extractZipArchive: promisify(ArchiveManager.extractZipArchive)
}

ArchiveManager.promises = promises

module.exports = ArchiveManager
