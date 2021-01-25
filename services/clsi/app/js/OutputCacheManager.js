/* eslint-disable
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let OutputCacheManager
const async = require('async')
const fs = require('fs')
const fse = require('fs-extra')
const Path = require('path')
const logger = require('logger-sharelatex')
const _ = require('lodash')
const Settings = require('settings-sharelatex')
const crypto = require('crypto')

const OutputFileOptimiser = require('./OutputFileOptimiser')

module.exports = OutputCacheManager = {
  CACHE_SUBDIR: 'generated-files',
  ARCHIVE_SUBDIR: 'archived-logs',
  // build id is HEXDATE-HEXRANDOM from Date.now()and RandomBytes
  // for backwards compatibility, make the randombytes part optional
  BUILD_REGEX: /^[0-9a-f]+(-[0-9a-f]+)?$/,
  CACHE_LIMIT: 2, // maximum number of cache directories
  CACHE_AGE: 60 * 60 * 1000, // up to one hour old

  path(buildId, file) {
    // used by static server, given build id return '.cache/clsi/buildId'
    if (buildId.match(OutputCacheManager.BUILD_REGEX)) {
      return Path.join(OutputCacheManager.CACHE_SUBDIR, buildId, file)
    } else {
      // for invalid build id, return top level
      return file
    }
  },

  generateBuildId(callback) {
    // generate a secure build id from Date.now() and 8 random bytes in hex
    if (callback == null) {
      callback = function (error, buildId) {}
    }
    return crypto.randomBytes(8, function (err, buf) {
      if (err != null) {
        return callback(err)
      }
      const random = buf.toString('hex')
      const date = Date.now().toString(16)
      return callback(err, `${date}-${random}`)
    })
  },

  saveOutputFiles(outputFiles, compileDir, outputDir, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return OutputCacheManager.generateBuildId(function (err, buildId) {
      if (err != null) {
        return callback(err)
      }
      return OutputCacheManager.saveOutputFilesInBuildDir(
        outputFiles,
        compileDir,
        outputDir,
        buildId,
        callback
      )
    })
  },

  saveOutputFilesInBuildDir(
    outputFiles,
    compileDir,
    outputDir,
    buildId,
    callback
  ) {
    // make a compileDir/CACHE_SUBDIR/build_id directory and
    // copy all the output files into it
    if (callback == null) {
      callback = function (error) {}
    }
    const cacheRoot = Path.join(outputDir, OutputCacheManager.CACHE_SUBDIR)
    // Put the files into a new cache subdirectory
    const cacheDir = Path.join(
      outputDir,
      OutputCacheManager.CACHE_SUBDIR,
      buildId
    )
    // Is it a per-user compile? check if compile directory is PROJECTID-USERID
    const perUser = Path.basename(compileDir).match(
      /^[0-9a-f]{24}-[0-9a-f]{24}$/
    )

    // Archive logs in background
    if (
      (Settings.clsi != null ? Settings.clsi.archive_logs : undefined) ||
      (Settings.clsi != null ? Settings.clsi.strace : undefined)
    ) {
      OutputCacheManager.archiveLogs(
        outputFiles,
        compileDir,
        outputDir,
        buildId,
        function (err) {
          if (err != null) {
            return logger.warn({ err }, 'erroring archiving log files')
          }
        }
      )
    }

    // make the new cache directory
    return fse.ensureDir(cacheDir, function (err) {
      if (err != null) {
        logger.error(
          { err, directory: cacheDir },
          'error creating cache directory'
        )
        return callback(err, outputFiles)
      } else {
        // copy all the output files into the new cache directory
        const results = []
        return async.mapSeries(
          outputFiles,
          function (file, cb) {
            // don't send dot files as output, express doesn't serve them
            if (OutputCacheManager._fileIsHidden(file.path)) {
              logger.debug(
                { compileDir, path: file.path },
                'ignoring dotfile in output'
              )
              return cb()
            }
            // copy other files into cache directory if valid
            const newFile = _.clone(file)
            const [src, dst] = Array.from([
              Path.join(compileDir, file.path),
              Path.join(cacheDir, file.path)
            ])
            return OutputCacheManager._checkFileIsSafe(src, function (
              err,
              isSafe
            ) {
              if (err != null) {
                return cb(err)
              }
              if (!isSafe) {
                return cb()
              }
              return OutputCacheManager._checkIfShouldCopy(src, function (
                err,
                shouldCopy
              ) {
                if (err != null) {
                  return cb(err)
                }
                if (!shouldCopy) {
                  return cb()
                }
                return OutputCacheManager._copyFile(src, dst, function (err) {
                  if (err != null) {
                    return cb(err)
                  }
                  newFile.build = buildId // attach a build id if we cached the file
                  results.push(newFile)
                  return cb()
                })
              })
            })
          },
          function (err) {
            if (err != null) {
              // pass back the original files if we encountered *any* error
              callback(err, outputFiles)
              // clean up the directory we just created
              return fse.remove(cacheDir, function (err) {
                if (err != null) {
                  return logger.error(
                    { err, dir: cacheDir },
                    'error removing cache dir after failure'
                  )
                }
              })
            } else {
              // pass back the list of new files in the cache
              callback(err, results)
              // let file expiry run in the background, expire all previous files if per-user
              return OutputCacheManager.expireOutputFiles(cacheRoot, {
                keep: buildId,
                limit: perUser ? 1 : null
              })
            }
          }
        )
      }
    })
  },

  archiveLogs(outputFiles, compileDir, outputDir, buildId, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const archiveDir = Path.join(
      outputDir,
      OutputCacheManager.ARCHIVE_SUBDIR,
      buildId
    )
    logger.log({ dir: archiveDir }, 'archiving log files for project')
    return fse.ensureDir(archiveDir, function (err) {
      if (err != null) {
        return callback(err)
      }
      return async.mapSeries(
        outputFiles,
        function (file, cb) {
          const [src, dst] = Array.from([
            Path.join(compileDir, file.path),
            Path.join(archiveDir, file.path)
          ])
          return OutputCacheManager._checkFileIsSafe(src, function (
            err,
            isSafe
          ) {
            if (err != null) {
              return cb(err)
            }
            if (!isSafe) {
              return cb()
            }
            return OutputCacheManager._checkIfShouldArchive(src, function (
              err,
              shouldArchive
            ) {
              if (err != null) {
                return cb(err)
              }
              if (!shouldArchive) {
                return cb()
              }
              return OutputCacheManager._copyFile(src, dst, cb)
            })
          })
        },
        callback
      )
    })
  },

  expireOutputFiles(cacheRoot, options, callback) {
    // look in compileDir for build dirs and delete if > N or age of mod time > T
    if (callback == null) {
      callback = function (error) {}
    }
    return fs.readdir(cacheRoot, function (err, results) {
      if (err != null) {
        if (err.code === 'ENOENT') {
          return callback(null)
        } // cache directory is empty
        logger.error({ err, project_id: cacheRoot }, 'error clearing cache')
        return callback(err)
      }

      const dirs = results.sort().reverse()
      const currentTime = Date.now()

      const isExpired = function (dir, index) {
        if ((options != null ? options.keep : undefined) === dir) {
          return false
        }
        // remove any directories over the requested (non-null) limit
        if (
          (options != null ? options.limit : undefined) != null &&
          index > options.limit
        ) {
          return true
        }
        // remove any directories over the hard limit
        if (index > OutputCacheManager.CACHE_LIMIT) {
          return true
        }
        // we can get the build time from the first part of the directory name DDDD-RRRR
        // DDDD is date and RRRR is random bytes
        const dirTime = parseInt(
          __guard__(dir.split('-'), (x) => x[0]),
          16
        )
        const age = currentTime - dirTime
        return age > OutputCacheManager.CACHE_AGE
      }

      const toRemove = _.filter(dirs, isExpired)

      const removeDir = (dir, cb) =>
        fse.remove(Path.join(cacheRoot, dir), function (err, result) {
          logger.log({ cache: cacheRoot, dir }, 'removed expired cache dir')
          if (err != null) {
            logger.error({ err, dir }, 'cache remove error')
          }
          return cb(err, result)
        })
      return async.eachSeries(
        toRemove,
        (dir, cb) => removeDir(dir, cb),
        callback
      )
    })
  },

  _fileIsHidden(path) {
    return (path != null ? path.match(/^\.|\/\./) : undefined) != null
  },

  _checkFileIsSafe(src, callback) {
    // check if we have a valid file to copy into the cache
    if (callback == null) {
      callback = function (error, isSafe) {}
    }
    return fs.stat(src, function (err, stats) {
      if ((err != null ? err.code : undefined) === 'ENOENT') {
        logger.warn(
          { err, file: src },
          'file has disappeared before copying to build cache'
        )
        return callback(err, false)
      } else if (err != null) {
        // some other problem reading the file
        logger.error({ err, file: src }, 'stat error for file in cache')
        return callback(err, false)
      } else if (!stats.isFile()) {
        // other filetype - reject it
        logger.warn(
          { src, stat: stats },
          'nonfile output - refusing to copy to cache'
        )
        return callback(null, false)
      } else {
        // it's a plain file, ok to copy
        return callback(null, true)
      }
    })
  },

  _copyFile(src, dst, callback) {
    // copy output file into the cache
    return fse.copy(src, dst, function (err) {
      if ((err != null ? err.code : undefined) === 'ENOENT') {
        logger.warn(
          { err, file: src },
          'file has disappeared when copying to build cache'
        )
        return callback(err, false)
      } else if (err != null) {
        logger.error({ err, src, dst }, 'copy error for file in cache')
        return callback(err)
      } else {
        if (
          Settings.clsi != null ? Settings.clsi.optimiseInDocker : undefined
        ) {
          // don't run any optimisations on the pdf when they are done
          // in the docker container
          return callback()
        } else {
          // call the optimiser for the file too
          return OutputFileOptimiser.optimiseFile(src, dst, callback)
        }
      }
    })
  },

  _checkIfShouldCopy(src, callback) {
    if (callback == null) {
      callback = function (err, shouldCopy) {}
    }
    return callback(null, !Path.basename(src).match(/^strace/))
  },

  _checkIfShouldArchive(src, callback) {
    let needle
    if (callback == null) {
      callback = function (err, shouldCopy) {}
    }
    if (Path.basename(src).match(/^strace/)) {
      return callback(null, true)
    }
    if (
      (Settings.clsi != null ? Settings.clsi.archive_logs : undefined) &&
      ((needle = Path.basename(src)),
      ['output.log', 'output.blg'].includes(needle))
    ) {
      return callback(null, true)
    }
    return callback(null, false)
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
