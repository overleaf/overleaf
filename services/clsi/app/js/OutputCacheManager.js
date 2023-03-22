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
const { callbackify, promisify } = require('util')
const async = require('async')
const fs = require('fs')
const fse = require('fs-extra')
const Path = require('path')
const logger = require('@overleaf/logger')
const _ = require('lodash')
const Settings = require('@overleaf/settings')
const crypto = require('crypto')
const Metrics = require('./Metrics')

const OutputFileOptimiser = require('./OutputFileOptimiser')
const ContentCacheManager = require('./ContentCacheManager')
const {
  QueueLimitReachedError,
  TimedOutError,
  NoXrefTableError,
} = require('./Errors')

const OLDEST_BUILD_DIR = new Map()
const PENDING_PROJECT_ACTIONS = new Map()

function init() {
  doInit().catch(err => {
    logger.fatal({ err }, 'low level error setting up cleanup of output dir')
    // consider shutting down?
  })
}

async function doInit() {
  await fillCache()
  const oldestTimestamp = await runBulkCleanup()
  scheduleBulkCleanup(oldestTimestamp)
}

function scheduleBulkCleanup(oldestTimestamp) {
  const delay =
    Math.max(OutputCacheManager.CACHE_AGE + oldestTimestamp - Date.now(), 0) +
    60 * 1000
  setTimeout(async function () {
    const oldestTimestamp = await runBulkCleanup()
    scheduleBulkCleanup(oldestTimestamp)
  }, delay)
}

async function fillCache() {
  const handle = await fs.promises.opendir(Settings.path.outputDir)
  try {
    for await (const { name: projectIdAndUserId } of handle) {
      OLDEST_BUILD_DIR.set(
        Path.join(Settings.path.outputDir, projectIdAndUserId),
        // Queue them for cleanup in the next hour.
        Date.now() - Math.random() * OutputCacheManager.CACHE_AGE
      )
    }
  } finally {
    try {
      await handle.close()
    } catch (e) {}
  }
}

async function runBulkCleanup() {
  const cleanupThreshold = Date.now() - OutputCacheManager.CACHE_AGE
  let oldestTimestamp = Date.now()
  for (const [dir, timeStamp] of OLDEST_BUILD_DIR.entries()) {
    if (timeStamp < cleanupThreshold) {
      await cleanupDirectory(dir, { limit: OutputCacheManager.CACHE_LIMIT })
    } else if (timeStamp < oldestTimestamp) {
      oldestTimestamp = timeStamp
    }
  }
  return oldestTimestamp
}

async function cleanupDirectory(dir, options) {
  return queueDirOperation(dir, async () => {
    try {
      await OutputCacheManager.promises.expireOutputFiles(dir, options)
    } catch (err) {
      logger.err({ dir, err }, 'cleanup of output directory failed')
    }
  })
}

async function queueDirOperation(dir, fn) {
  const pending = PENDING_PROJECT_ACTIONS.get(dir) || Promise.resolve()
  const p = pending.then(fn, fn).finally(() => {
    if (PENDING_PROJECT_ACTIONS.get(dir) === p) {
      PENDING_PROJECT_ACTIONS.delete(dir)
    }
  })
  PENDING_PROJECT_ACTIONS.set(dir, p)
  return p
}

module.exports = OutputCacheManager = {
  CONTENT_SUBDIR: 'content',
  CACHE_SUBDIR: 'generated-files',
  ARCHIVE_SUBDIR: 'archived-logs',
  // build id is HEXDATE-HEXRANDOM from Date.now()and RandomBytes
  // for backwards compatibility, make the randombytes part optional
  BUILD_REGEX: /^[0-9a-f]+(-[0-9a-f]+)?$/,
  CONTENT_REGEX: /^[0-9a-f]+(-[0-9a-f]+)?$/,
  CACHE_LIMIT: 2, // maximum number of cache directories
  CACHE_AGE: 60 * 60 * 1000, // up to one hour old

  init,
  queueDirOperation: callbackify(queueDirOperation),

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
      callback = function () {}
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

  saveOutputFiles(
    { request, stats, timings },
    outputFiles,
    compileDir,
    outputDir,
    callback
  ) {
    if (callback == null) {
      callback = function () {}
    }
    return OutputCacheManager.generateBuildId(function (err, buildId) {
      if (err != null) {
        return callback(err)
      }
      if (!OLDEST_BUILD_DIR.has(outputDir)) {
        // Register for cleanup
        OLDEST_BUILD_DIR.set(outputDir, Date.now())
      }

      OutputCacheManager.queueDirOperation(
        outputDir,
        () =>
          OutputCacheManager.promises.saveOutputFilesInBuildDir(
            outputFiles,
            compileDir,
            outputDir,
            buildId
          ),
        function (err, result) {
          if (err != null) {
            return callback(err)
          }
          OutputCacheManager.collectOutputPdfSize(
            result,
            outputDir,
            stats,
            (err, outputFiles) => {
              if (err) return callback(err, outputFiles)

              const enablePdfCaching = request.enablePdfCaching
              const enablePdfCachingDark =
                Settings.enablePdfCachingDark && !request.enablePdfCaching
              if (
                !Settings.enablePdfCaching ||
                (!enablePdfCaching && !enablePdfCachingDark)
              ) {
                return callback(null, outputFiles)
              }

              OutputCacheManager.saveStreamsInContentDir(
                { request, stats, timings, enablePdfCachingDark },
                outputFiles,
                compileDir,
                outputDir,
                (err, status) => {
                  Metrics.inc('pdf-caching-status', 1, {
                    status,
                    ...request.metricsOpts,
                  })
                  if (err) {
                    logger.warn(
                      { err, outputDir, stats, timings },
                      'pdf caching failed'
                    )
                    return callback(null, outputFiles)
                  }
                  callback(err, outputFiles)
                }
              )
            }
          )
        }
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
      callback = function () {}
    }
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
              Path.join(cacheDir, file.path),
            ])
            return OutputCacheManager._checkFileIsSafe(
              src,
              function (err, isSafe) {
                if (err != null) {
                  return cb(err)
                }
                if (!isSafe) {
                  return cb()
                }
                return OutputCacheManager._checkIfShouldCopy(
                  src,
                  function (err, shouldCopy) {
                    if (err != null) {
                      return cb(err)
                    }
                    if (!shouldCopy) {
                      return cb()
                    }
                    return OutputCacheManager._copyFile(
                      src,
                      dst,
                      function (err) {
                        if (err != null) {
                          return cb(err)
                        }
                        newFile.build = buildId // attach a build id if we cached the file
                        results.push(newFile)
                        return cb()
                      }
                    )
                  }
                )
              }
            )
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
              cleanupDirectory(outputDir, {
                keep: buildId,
                limit: perUser ? 1 : null,
              }).catch(() => {})
            }
          }
        )
      }
    })
  },

  collectOutputPdfSize(outputFiles, outputDir, stats, callback) {
    const outputFile = outputFiles.find(x => x.path === 'output.pdf')
    if (!outputFile) return callback(null, outputFiles)
    const outputFilePath = Path.join(
      outputDir,
      OutputCacheManager.path(outputFile.build, outputFile.path)
    )
    fs.stat(outputFilePath, (err, stat) => {
      if (err) return callback(err, outputFiles)

      outputFile.size = stat.size
      stats['pdf-size'] = outputFile.size
      callback(null, outputFiles)
    })
  },

  saveStreamsInContentDir(
    { request, stats, timings, enablePdfCachingDark },
    outputFiles,
    compileDir,
    outputDir,
    callback
  ) {
    const cacheRoot = Path.join(outputDir, OutputCacheManager.CONTENT_SUBDIR)
    // check if content dir exists
    OutputCacheManager.ensureContentDir(cacheRoot, function (err, contentDir) {
      if (err) return callback(err, 'content-dir-unavailable')

      const outputFile = outputFiles.find(x => x.path === 'output.pdf')
      if (outputFile) {
        // possibly we should copy the file from the build dir here
        const outputFilePath = Path.join(
          outputDir,
          OutputCacheManager.path(outputFile.build, outputFile.path)
        )
        const pdfSize = outputFile.size
        const timer = new Metrics.Timer(
          'compute-pdf-ranges',
          1,
          request.metricsOpts
        )
        ContentCacheManager.update(
          {
            contentDir,
            filePath: outputFilePath,
            pdfSize,
            pdfCachingMinChunkSize: request.pdfCachingMinChunkSize,
            compileTime: timings.compile,
          },
          function (err, result) {
            if (err && err instanceof NoXrefTableError) {
              return callback(null, err.message)
            }
            if (err && err instanceof QueueLimitReachedError) {
              logger.warn({ err, outputDir }, 'pdf caching queue limit reached')
              stats['pdf-caching-queue-limit-reached'] = 1
              return callback(null, 'queue-limit')
            }
            if (err && err instanceof TimedOutError) {
              logger.warn(
                { err, outputDir, stats, timings },
                'pdf caching timed out'
              )
              stats['pdf-caching-timed-out'] = 1
              return callback(null, 'timed-out')
            }
            if (err) return callback(err, 'failed')
            const {
              contentRanges,
              newContentRanges,
              reclaimedSpace,
              overheadDeleteStaleHashes,
              timedOutErr,
              startXRefTable,
            } = result

            let status = 'success'
            if (timedOutErr) {
              // Soft failure: let the frontend use partial set of ranges.
              logger.warn(
                {
                  err: timedOutErr,
                  overheadDeleteStaleHashes,
                  outputDir,
                  stats,
                  timings,
                },
                'pdf caching timed out - soft failure'
              )
              stats['pdf-caching-timed-out'] = 1
              status = 'timed-out-soft-failure'
            }

            if (enablePdfCachingDark) {
              // In dark mode we are doing the computation only and do not emit
              //  any ranges to the frontend.
            } else {
              outputFile.contentId = Path.basename(contentDir)
              outputFile.ranges = contentRanges
              outputFile.startXRefTable = startXRefTable
            }

            timings['compute-pdf-caching'] = timer.done()
            stats['pdf-caching-n-ranges'] = contentRanges.length
            stats['pdf-caching-total-ranges-size'] = contentRanges.reduce(
              (sum, next) => sum + (next.end - next.start),
              0
            )
            stats['pdf-caching-n-new-ranges'] = newContentRanges.length
            stats['pdf-caching-new-ranges-size'] = newContentRanges.reduce(
              (sum, next) => sum + (next.end - next.start),
              0
            )
            stats['pdf-caching-reclaimed-space'] = reclaimedSpace
            timings['pdf-caching-overhead-delete-stale-hashes'] =
              overheadDeleteStaleHashes
            callback(null, status)
          }
        )
      } else {
        callback(null, 'missing-pdf')
      }
    })
  },

  ensureContentDir(contentRoot, callback) {
    fse.ensureDir(contentRoot, function (err) {
      if (err != null) {
        return callback(err)
      }
      fs.readdir(contentRoot, function (err, results) {
        if (err) return callback(err)
        const dirs = results.sort()
        const contentId = dirs.find(dir =>
          OutputCacheManager.BUILD_REGEX.test(dir)
        )
        if (contentId) {
          callback(null, Path.join(contentRoot, contentId))
        } else {
          // make a content directory
          OutputCacheManager.generateBuildId(function (err, contentId) {
            if (err) {
              return callback(err)
            }
            const contentDir = Path.join(contentRoot, contentId)
            fse.ensureDir(contentDir, function (err) {
              if (err) {
                return callback(err)
              }
              return callback(null, contentDir)
            })
          })
        }
      })
    })
  },

  archiveLogs(outputFiles, compileDir, outputDir, buildId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const archiveDir = Path.join(
      outputDir,
      OutputCacheManager.ARCHIVE_SUBDIR,
      buildId
    )
    logger.debug({ dir: archiveDir }, 'archiving log files for project')
    return fse.ensureDir(archiveDir, function (err) {
      if (err != null) {
        return callback(err)
      }
      return async.mapSeries(
        outputFiles,
        function (file, cb) {
          const [src, dst] = Array.from([
            Path.join(compileDir, file.path),
            Path.join(archiveDir, file.path),
          ])
          return OutputCacheManager._checkFileIsSafe(
            src,
            function (err, isSafe) {
              if (err != null) {
                return cb(err)
              }
              if (!isSafe) {
                return cb()
              }
              return OutputCacheManager._checkIfShouldArchive(
                src,
                function (err, shouldArchive) {
                  if (err != null) {
                    return cb(err)
                  }
                  if (!shouldArchive) {
                    return cb()
                  }
                  return OutputCacheManager._copyFile(src, dst, cb)
                }
              )
            }
          )
        },
        callback
      )
    })
  },

  expireOutputFiles(outputDir, options, callback) {
    // look in compileDir for build dirs and delete if > N or age of mod time > T
    if (callback == null) {
      callback = function () {}
    }
    const cleanupAll = cb => {
      fse.remove(outputDir, err => {
        if (err) {
          return cb(err)
        }
        // Drop reference after successful cleanup of the output dir.
        OLDEST_BUILD_DIR.delete(outputDir)
        cb(null)
      })
    }

    const cacheRoot = Path.join(outputDir, OutputCacheManager.CACHE_SUBDIR)
    return fs.readdir(cacheRoot, function (err, results) {
      if (err != null) {
        if (err.code === 'ENOENT') {
          // cache directory is empty
          return cleanupAll(callback)
        }
        logger.error({ err, projectId: cacheRoot }, 'error clearing cache')
        return callback(err)
      }

      const dirs = results.sort().reverse()
      const currentTime = Date.now()

      let oldestDirTimeToKeep = 0

      const isExpired = function (dir, index) {
        if ((options != null ? options.keep : undefined) === dir) {
          // This is the directory we just created for the compile request.
          oldestDirTimeToKeep = currentTime
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
          __guard__(dir.split('-'), x => x[0]),
          16
        )
        const age = currentTime - dirTime
        const expired = age > OutputCacheManager.CACHE_AGE
        if (expired) {
          return true
        }
        oldestDirTimeToKeep = dirTime
        return false
      }

      const toRemove = _.filter(dirs, isExpired)
      if (toRemove.length === dirs.length) {
        // No builds left after cleanup.
        return cleanupAll(callback)
      }

      const removeDir = (dir, cb) =>
        fse.remove(Path.join(cacheRoot, dir), function (err, result) {
          logger.debug({ cache: cacheRoot, dir }, 'removed expired cache dir')
          if (err != null) {
            logger.error({ err, dir }, 'cache remove error')
          }
          return cb(err, result)
        })
      return async.eachSeries(
        toRemove,
        (dir, cb) => removeDir(dir, cb),
        err => {
          if (err) {
            // On error: keep the timestamp in the past.
            // The next iteration of the cleanup loop will retry the deletion.
            return callback(err)
          }
          // On success: push the timestamp into the future.
          OLDEST_BUILD_DIR.set(outputDir, oldestDirTimeToKeep)
          callback(null)
        }
      )
    })
  },

  _fileIsHidden(path) {
    return (path != null ? path.match(/^\.|\/\./) : undefined) != null
  },

  _checkFileIsSafe(src, callback) {
    // check if we have a valid file to copy into the cache
    if (callback == null) {
      callback = function () {}
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
      callback = function () {}
    }
    return callback(null, !Path.basename(src).match(/^strace/))
  },

  _checkIfShouldArchive(src, callback) {
    let needle
    if (callback == null) {
      callback = function () {}
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
  },
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}

OutputCacheManager.promises = {
  expireOutputFiles: promisify(OutputCacheManager.expireOutputFiles),
  saveOutputFiles: promisify(OutputCacheManager.saveOutputFiles),
  saveOutputFilesInBuildDir: promisify(
    OutputCacheManager.saveOutputFilesInBuildDir
  ),
}
