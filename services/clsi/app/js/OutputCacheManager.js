let OutputCacheManager
const { callbackify, promisify } = require('node:util')
const async = require('async')
const fs = require('node:fs')
const Path = require('node:path')
const logger = require('@overleaf/logger')
const _ = require('lodash')
const Settings = require('@overleaf/settings')
const crypto = require('node:crypto')
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
  return await queueDirOperation(dir, async () => {
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
    crypto.randomBytes(8, function (err, buf) {
      if (err) {
        return callback(err)
      }
      const random = buf.toString('hex')
      const date = Date.now().toString(16)
      callback(err, `${date}-${random}`)
    })
  },

  saveOutputFiles(
    { request, stats, timings },
    outputFiles,
    compileDir,
    outputDir,
    callback
  ) {
    OutputCacheManager.generateBuildId(function (err, buildId) {
      if (err) {
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
          if (err) {
            return callback(err)
          }
          OutputCacheManager.collectOutputPdfSize(
            result,
            outputDir,
            stats,
            (err, outputFiles) => {
              if (err) return callback(err, { outputFiles, buildId })

              const enablePdfCaching = request.enablePdfCaching
              const enablePdfCachingDark =
                Settings.enablePdfCachingDark && !request.enablePdfCaching
              if (
                !Settings.enablePdfCaching ||
                (!enablePdfCaching && !enablePdfCachingDark)
              ) {
                return callback(null, { outputFiles, buildId })
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
                    return callback(null, { outputFiles, buildId })
                  }
                  callback(err, { outputFiles, buildId })
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
    if (Settings.clsi?.archive_logs || Settings.clsi?.strace) {
      OutputCacheManager.archiveLogs(
        outputFiles,
        compileDir,
        outputDir,
        buildId,
        function (err) {
          if (err) {
            return logger.warn({ err }, 'erroring archiving log files')
          }
        }
      )
    }

    // make the new cache directory
    fs.mkdir(cacheDir, { recursive: true }, function (err) {
      if (err) {
        logger.error(
          { err, directory: cacheDir },
          'error creating cache directory'
        )
        callback(err, outputFiles)
      } else {
        // copy all the output files into the new cache directory
        const results = []
        const dirCache = new Set()
        dirCache.add(cacheDir)
        async.mapSeries(
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
            const src = Path.join(compileDir, file.path)
            const dst = Path.join(cacheDir, file.path)
            OutputCacheManager._checkIfShouldCopy(
              src,
              function (err, shouldCopy) {
                if (err) {
                  return cb(err)
                }
                if (!shouldCopy) {
                  return cb()
                }
                OutputCacheManager._copyFile(src, dst, dirCache, err => {
                  if (err) {
                    return cb(err)
                  }
                  newFile.build = buildId // attach a build id if we cached the file
                  results.push(newFile)
                  cb()
                })
              }
            )
          },
          function (err) {
            if (err) {
              // pass back the original files if we encountered *any* error
              callback(err, outputFiles)
              // clean up the directory we just created
              fs.rm(cacheDir, { force: true, recursive: true }, function (err) {
                if (err) {
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
    fs.mkdir(contentRoot, { recursive: true }, function (err) {
      if (err) {
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
            fs.mkdir(contentDir, { recursive: true }, function (err) {
              if (err) {
                return callback(err)
              }
              callback(null, contentDir)
            })
          })
        }
      })
    })
  },

  archiveLogs(outputFiles, compileDir, outputDir, buildId, callback) {
    const archiveDir = Path.join(
      outputDir,
      OutputCacheManager.ARCHIVE_SUBDIR,
      buildId
    )
    logger.debug({ dir: archiveDir }, 'archiving log files for project')
    fs.mkdir(archiveDir, { recursive: true }, function (err) {
      if (err) {
        return callback(err)
      }
      const dirCache = new Set()
      dirCache.add(archiveDir)
      async.mapSeries(
        outputFiles,
        function (file, cb) {
          const src = Path.join(compileDir, file.path)
          const dst = Path.join(archiveDir, file.path)
          OutputCacheManager._checkIfShouldArchive(
            src,
            function (err, shouldArchive) {
              if (err) {
                return cb(err)
              }
              if (!shouldArchive) {
                return cb()
              }
              OutputCacheManager._copyFile(src, dst, dirCache, cb)
            }
          )
        },
        callback
      )
    })
  },

  expireOutputFiles(outputDir, options, callback) {
    // look in compileDir for build dirs and delete if > N or age of mod time > T
    const cleanupAll = cb => {
      fs.rm(outputDir, { force: true, recursive: true }, err => {
        if (err) {
          return cb(err)
        }
        // Drop reference after successful cleanup of the output dir.
        OLDEST_BUILD_DIR.delete(outputDir)
        cb(null)
      })
    }

    const cacheRoot = Path.join(outputDir, OutputCacheManager.CACHE_SUBDIR)
    fs.readdir(cacheRoot, function (err, results) {
      if (err) {
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
        if (options?.keep === dir) {
          // This is the directory we just created for the compile request.
          oldestDirTimeToKeep = currentTime
          return false
        }
        // remove any directories over the requested (non-null) limit
        if (options?.limit != null && index > options.limit) {
          return true
        }
        // remove any directories over the hard limit
        if (index > OutputCacheManager.CACHE_LIMIT) {
          return true
        }
        // we can get the build time from the first part of the directory name DDDD-RRRR
        // DDDD is date and RRRR is random bytes
        const dirTime = parseInt(dir.split('-')[0], 16)
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
        fs.rm(
          Path.join(cacheRoot, dir),
          { force: true, recursive: true },
          function (err, result) {
            logger.debug({ cache: cacheRoot, dir }, 'removed expired cache dir')
            if (err) {
              logger.error({ err, dir }, 'cache remove error')
            }
            cb(err, result)
          }
        )
      async.eachSeries(
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
    return path?.match(/^\.|\/\./) != null
  },

  _ensureParentExists(dst, dirCache, callback) {
    let parent = Path.dirname(dst)
    if (dirCache.has(parent)) {
      callback()
    } else {
      fs.mkdir(parent, { recursive: true }, err => {
        if (err) return callback(err)
        while (!dirCache.has(parent)) {
          dirCache.add(parent)
          parent = Path.dirname(parent)
        }
        callback()
      })
    }
  },

  _copyFile(src, dst, dirCache, callback) {
    OutputCacheManager._ensureParentExists(dst, dirCache, err => {
      if (err) {
        logger.warn(
          { err, dst },
          'creating parent directory in output cache failed'
        )
        return callback(err, false)
      }
      // copy output file into the cache
      fs.copyFile(src, dst, function (err) {
        if (err?.code === 'ENOENT') {
          logger.warn(
            { err, file: src },
            'file has disappeared when copying to build cache'
          )
          callback(err, false)
        } else if (err) {
          logger.error({ err, src, dst }, 'copy error for file in cache')
          callback(err)
        } else {
          if (Settings.clsi?.optimiseInDocker) {
            // don't run any optimisations on the pdf when they are done
            // in the docker container
            callback()
          } else {
            // call the optimiser for the file too
            OutputFileOptimiser.optimiseFile(src, dst, callback)
          }
        }
      })
    })
  },

  _checkIfShouldCopy(src, callback) {
    callback(null, !Path.basename(src).match(/^strace/))
  },

  _checkIfShouldArchive(src, callback) {
    if (Path.basename(src).match(/^strace/)) {
      return callback(null, true)
    }
    const basename = Path.basename(src)
    if (
      Settings.clsi?.archive_logs &&
      ['output.log', 'output.blg'].includes(basename)
    ) {
      return callback(null, true)
    }
    callback(null, false)
  },
}

OutputCacheManager.promises = {
  expireOutputFiles: promisify(OutputCacheManager.expireOutputFiles),
  saveOutputFiles: promisify(OutputCacheManager.saveOutputFiles),
  saveOutputFilesInBuildDir: promisify(
    OutputCacheManager.saveOutputFilesInBuildDir
  ),
}
