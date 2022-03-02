const ResourceWriter = require('./ResourceWriter')
const LatexRunner = require('./LatexRunner')
const OutputFileFinder = require('./OutputFileFinder')
const OutputCacheManager = require('./OutputCacheManager')
const Settings = require('@overleaf/settings')
const Path = require('path')
const logger = require('@overleaf/logger')
const Metrics = require('./Metrics')
const childProcess = require('child_process')
const DraftModeManager = require('./DraftModeManager')
const TikzManager = require('./TikzManager')
const LockManager = require('./LockManager')
const fs = require('fs')
const fse = require('fs-extra')
const os = require('os')
const async = require('async')
const Errors = require('./Errors')
const CommandRunner = require('./CommandRunner')
const { emitPdfStats } = require('./ContentCacheMetrics')
const SynctexOutputParser = require('./SynctexOutputParser')

const COMPILE_TIME_BUCKETS = [
  // NOTE: These buckets are locked in per metric name.
  //       If you want to change them, you will need to rename metrics.
  0, 1, 2, 3, 4, 6, 8, 11, 15, 22, 31, 43, 61, 86, 121, 170, 240,
].map(seconds => seconds * 1000)

function getCompileName(projectId, userId) {
  if (userId != null) {
    return `${projectId}-${userId}`
  } else {
    return projectId
  }
}

function getCompileDir(projectId, userId) {
  return Path.join(Settings.path.compilesDir, getCompileName(projectId, userId))
}

function getOutputDir(projectId, userId) {
  return Path.join(Settings.path.outputDir, getCompileName(projectId, userId))
}

function doCompileWithLock(request, callback) {
  const compileDir = getCompileDir(request.project_id, request.user_id)
  const lockFile = Path.join(compileDir, '.project-lock')
  // use a .project-lock file in the compile directory to prevent
  // simultaneous compiles
  fse.ensureDir(compileDir, error => {
    if (error) {
      return callback(error)
    }
    LockManager.runWithLock(
      lockFile,
      releaseLock => doCompile(request, releaseLock),
      callback
    )
  })
}

function doCompile(request, callback) {
  const compileDir = getCompileDir(request.project_id, request.user_id)
  const outputDir = getOutputDir(request.project_id, request.user_id)

  const timerE2E = new Metrics.Timer(
    'compile-e2e-v2',
    1,
    request.metricsOpts,
    COMPILE_TIME_BUCKETS
  )
  const timer = new Metrics.Timer('write-to-disk', 1, request.metricsOpts)
  logger.log(
    { projectId: request.project_id, userId: request.user_id },
    'syncing resources to disk'
  )
  ResourceWriter.syncResourcesToDisk(
    request,
    compileDir,
    (error, resourceList) => {
      // NOTE: resourceList is insecure, it should only be used to exclude files from the output list
      if (error && error instanceof Errors.FilesOutOfSyncError) {
        logger.warn(
          { projectId: request.project_id, userId: request.user_id },
          'files out of sync, please retry'
        )
        return callback(error)
      } else if (error) {
        logger.err(
          {
            err: error,
            projectId: request.project_id,
            userId: request.user_id,
          },
          'error writing resources to disk'
        )
        return callback(error)
      }
      logger.log(
        {
          projectId: request.project_id,
          userId: request.user_id,
          time_taken: Date.now() - timer.start,
        },
        'written files to disk'
      )
      const syncStage = timer.done()

      function injectDraftModeIfRequired(callback) {
        if (request.draft) {
          DraftModeManager.injectDraftMode(
            Path.join(compileDir, request.rootResourcePath),
            callback
          )
        } else {
          callback()
        }
      }

      const createTikzFileIfRequired = callback =>
        TikzManager.checkMainFile(
          compileDir,
          request.rootResourcePath,
          resourceList,
          (error, needsMainFile) => {
            if (error) {
              return callback(error)
            }
            if (needsMainFile) {
              TikzManager.injectOutputFile(
                compileDir,
                request.rootResourcePath,
                callback
              )
            } else {
              callback()
            }
          }
        )
      // set up environment variables for chktex
      const env = {}
      if (Settings.texliveOpenoutAny && Settings.texliveOpenoutAny !== '') {
        // override default texlive openout_any environment variable
        env.openout_any = Settings.texliveOpenoutAny
      }
      if (Settings.texliveMaxPrintLine && Settings.texliveMaxPrintLine !== '') {
        // override default texlive max_print_line environment variable
        env.max_print_line = Settings.texliveMaxPrintLine
      }
      // only run chktex on LaTeX files (not knitr .Rtex files or any others)
      const isLaTeXFile =
        request.rootResourcePath != null
          ? request.rootResourcePath.match(/\.tex$/i)
          : undefined
      if (request.check != null && isLaTeXFile) {
        env.CHKTEX_OPTIONS = '-nall -e9 -e10 -w15 -w16'
        env.CHKTEX_ULIMIT_OPTIONS = '-t 5 -v 64000'
        if (request.check === 'error') {
          env.CHKTEX_EXIT_ON_ERROR = 1
        }
        if (request.check === 'validate') {
          env.CHKTEX_VALIDATE = 1
        }
      }

      // apply a series of file modifications/creations for draft mode and tikz
      async.series(
        [injectDraftModeIfRequired, createTikzFileIfRequired],
        error => {
          if (error) {
            return callback(error)
          }
          const timer = new Metrics.Timer('run-compile', 1, request.metricsOpts)
          // find the image tag to log it as a metric, e.g. 2015.1 (convert . to - for graphite)
          let tag = 'default'
          if (request.imageName != null) {
            const match = request.imageName.match(/:(.*)/)
            if (match != null) {
              tag = match[1].replace(/\./g, '-')
            }
          }
          if (!request.project_id.match(/^[0-9a-f]{24}$/)) {
            tag = 'other'
          } // exclude smoke test
          Metrics.inc('compiles', 1, request.metricsOpts)
          Metrics.inc(`compiles-with-image.${tag}`, 1, request.metricsOpts)
          const compileName = getCompileName(
            request.project_id,
            request.user_id
          )
          LatexRunner.runLatex(
            compileName,
            {
              directory: compileDir,
              mainFile: request.rootResourcePath,
              compiler: request.compiler,
              timeout: request.timeout,
              image: request.imageName,
              flags: request.flags,
              environment: env,
              compileGroup: request.compileGroup,
            },
            (error, output, stats, timings) => {
              // request was for validation only
              if (request.check === 'validate') {
                const result = error && error.code ? 'fail' : 'pass'
                error = new Error('validation')
                error.validate = result
              }
              // request was for compile, and failed on validation
              if (
                request.check === 'error' &&
                error &&
                error.message === 'exited'
              ) {
                error = new Error('compilation')
                error.validate = 'fail'
              }
              // record timeout errors as a separate counter, success is recorded later
              if (error && error.timedout) {
                Metrics.inc('compiles-timeout', 1, request.metricsOpts)
              }
              // compile was killed by user, was a validation, or a compile which failed validation
              if (
                error &&
                (error.terminated || error.validate || error.timedout)
              ) {
                return OutputFileFinder.findOutputFiles(
                  resourceList,
                  compileDir,
                  (err, outputFiles) => {
                    if (err) {
                      return callback(err)
                    }
                    error.outputFiles = outputFiles // return output files so user can check logs
                    callback(error)
                  }
                )
              }
              // compile completed normally
              if (error) {
                return callback(error)
              }
              Metrics.inc('compiles-succeeded', 1, request.metricsOpts)
              stats = stats || {}
              for (const metricKey in stats) {
                const metricValue = stats[metricKey]
                Metrics.count(metricKey, metricValue, 1, request.metricsOpts)
              }
              timings = timings || {}
              for (const metricKey in timings) {
                const metricValue = timings[metricKey]
                Metrics.timing(metricKey, metricValue, 1, request.metricsOpts)
              }
              const loadavg =
                typeof os.loadavg === 'function' ? os.loadavg() : undefined
              if (loadavg != null) {
                Metrics.gauge('load-avg', loadavg[0])
              }
              const ts = timer.done()
              logger.log(
                {
                  projectId: request.project_id,
                  userId: request.user_id,
                  time_taken: ts,
                  stats,
                  timings,
                  loadavg,
                },
                'done compile'
              )
              if (stats['latex-runs'] > 0) {
                Metrics.histogram(
                  'avg-compile-per-pass-v2',
                  ts / stats['latex-runs'],
                  COMPILE_TIME_BUCKETS,
                  request.metricsOpts
                )
                Metrics.timing(
                  'avg-compile-per-pass-v2',
                  ts / stats['latex-runs'],
                  1,
                  request.metricsOpts
                )
              }
              if (stats['latex-runs'] > 0 && timings['cpu-time'] > 0) {
                Metrics.timing(
                  'run-compile-cpu-time-per-pass',
                  timings['cpu-time'] / stats['latex-runs'],
                  1,
                  request.metricsOpts
                )
              }
              // Emit compile time.
              timings.compile = ts

              const outputStageTimer = new Metrics.Timer(
                'process-output-files',
                1,
                request.metricsOpts
              )

              OutputFileFinder.findOutputFiles(
                resourceList,
                compileDir,
                (error, outputFiles) => {
                  if (error) {
                    return callback(error)
                  }
                  OutputCacheManager.saveOutputFiles(
                    { request, stats, timings },
                    outputFiles,
                    compileDir,
                    outputDir,
                    (err, newOutputFiles) => {
                      if (err) {
                        const { project_id: projectId, user_id: userId } =
                          request
                        logger.err(
                          { projectId, userId, err },
                          'failed to save output files'
                        )
                      }

                      const outputStage = outputStageTimer.done()
                      timings.sync = syncStage
                      timings.output = outputStage

                      // Emit e2e compile time.
                      timings.compileE2E = timerE2E.done()
                      Metrics.timing(
                        'compile-e2e-v2',
                        timings.compileE2E,
                        1,
                        request.metricsOpts
                      )

                      if (stats['pdf-size']) {
                        emitPdfStats(stats, timings, request)
                      }

                      callback(null, newOutputFiles, stats, timings)
                    }
                  )
                }
              )
            }
          )
        }
      )
    }
  )
}

function stopCompile(projectId, userId, callback) {
  const compileName = getCompileName(projectId, userId)
  LatexRunner.killLatex(compileName, callback)
}

function clearProject(projectId, userId, _callback) {
  function callback(error) {
    _callback(error)
    _callback = function () {}
  }

  const compileDir = getCompileDir(projectId, userId)

  _checkDirectory(compileDir, (err, exists) => {
    if (err) {
      return callback(err)
    }
    if (!exists) {
      return callback()
    } // skip removal if no directory present

    const proc = childProcess.spawn('rm', ['-r', '-f', '--', compileDir])

    proc.on('error', callback)

    let stderr = ''
    proc.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk))

    proc.on('close', code => {
      if (code === 0) {
        callback(null)
      } else {
        callback(new Error(`rm -r ${compileDir} failed: ${stderr}`))
      }
    })
  })
}

function _findAllDirs(callback) {
  const root = Settings.path.compilesDir
  fs.readdir(root, (err, files) => {
    if (err) {
      return callback(err)
    }
    const allDirs = files.map(file => Path.join(root, file))
    callback(null, allDirs)
  })
}

function clearExpiredProjects(maxCacheAgeMs, callback) {
  const now = Date.now()
  // action for each directory
  const expireIfNeeded = (checkDir, cb) =>
    fs.stat(checkDir, (err, stats) => {
      if (err) {
        return cb()
      } // ignore errors checking directory
      const age = now - stats.mtime
      const hasExpired = age > maxCacheAgeMs
      if (hasExpired) {
        fse.remove(checkDir, cb)
      } else {
        cb()
      }
    })
  // iterate over all project directories
  _findAllDirs((error, allDirs) => {
    if (error) {
      return callback()
    }
    async.eachSeries(allDirs, expireIfNeeded, callback)
  })
}

function _checkDirectory(compileDir, callback) {
  fs.lstat(compileDir, (err, stats) => {
    if (err && err.code === 'ENOENT') {
      callback(null, false) //  directory does not exist
    } else if (err) {
      logger.err(
        { dir: compileDir, err },
        'error on stat of project directory for removal'
      )
      callback(err)
    } else if (!stats.isDirectory()) {
      logger.err(
        { dir: compileDir, stats },
        'bad project directory for removal'
      )
      callback(new Error('project directory is not directory'))
    } else {
      // directory exists
      callback(null, true)
    }
  })
}

function syncFromCode(
  projectId,
  userId,
  filename,
  line,
  column,
  imageName,
  callback
) {
  // If LaTeX was run in a virtual environment, the file path that synctex expects
  // might not match the file path on the host. The .synctex.gz file however, will be accessed
  // wherever it is on the host.
  const compileName = getCompileName(projectId, userId)
  const baseDir = Settings.path.synctexBaseDir(compileName)
  const inputFilePath = Path.join(baseDir, filename)
  const outputFilePath = Path.join(baseDir, 'output.pdf')
  const command = [
    'synctex',
    'view',
    '-i',
    `${line}:${column}:${inputFilePath}`,
    '-o',
    outputFilePath,
  ]
  _runSynctex(projectId, userId, command, imageName, (error, stdout) => {
    if (error) {
      return callback(error)
    }
    logger.debug(
      { projectId, userId, filename, line, column, command, stdout },
      'synctex code output'
    )
    callback(null, SynctexOutputParser.parseViewOutput(stdout))
  })
}

function syncFromPdf(projectId, userId, page, h, v, imageName, callback) {
  const compileName = getCompileName(projectId, userId)
  const baseDir = Settings.path.synctexBaseDir(compileName)
  const outputFilePath = `${baseDir}/output.pdf`
  const command = [
    'synctex',
    'edit',
    '-o',
    `${page}:${h}:${v}:${outputFilePath}`,
  ]
  _runSynctex(projectId, userId, command, imageName, (error, stdout) => {
    if (error != null) {
      return callback(error)
    }
    logger.log({ projectId, userId, page, h, v, stdout }, 'synctex pdf output')
    callback(null, SynctexOutputParser.parseEditOutput(stdout, baseDir))
  })
}

function _checkFileExists(dir, filename, callback) {
  const file = Path.join(dir, filename)
  fs.stat(dir, (error, stats) => {
    if (error && error.code === 'ENOENT') {
      return callback(new Errors.NotFoundError('no output directory'))
    }
    if (error) {
      return callback(error)
    }
    fs.stat(file, (error, stats) => {
      if (error && error.code === 'ENOENT') {
        return callback(new Errors.NotFoundError('no output file'))
      }
      if (error) {
        return callback(error)
      }
      if (!stats.isFile()) {
        return callback(new Error('not a file'))
      }
      callback()
    })
  })
}

function _runSynctex(projectId, userId, command, imageName, callback) {
  const directory = getCompileDir(projectId, userId)
  const timeout = 60 * 1000 // increased to allow for large projects
  const compileName = getCompileName(projectId, userId)
  const compileGroup = 'synctex'
  const defaultImageName =
    Settings.clsi && Settings.clsi.docker && Settings.clsi.docker.image
  _checkFileExists(directory, 'output.synctex.gz', error => {
    if (error) {
      return callback(error)
    }
    CommandRunner.run(
      compileName,
      command,
      directory,
      imageName || defaultImageName,
      timeout,
      {},
      compileGroup,
      (error, output) => {
        if (error) {
          logger.err(
            { err: error, command, projectId, userId },
            'error running synctex'
          )
          return callback(error)
        }
        callback(null, output.stdout)
      }
    )
  })
}

function wordcount(projectId, userId, filename, image, callback) {
  logger.log({ projectId, userId, filename, image }, 'running wordcount')
  const filePath = `$COMPILE_DIR/${filename}`
  const command = [
    'texcount',
    '-nocol',
    '-inc',
    filePath,
    `-out=${filePath}.wc`,
  ]
  const compileDir = getCompileDir(projectId, userId)
  const timeout = 60 * 1000
  const compileName = getCompileName(projectId, userId)
  const compileGroup = 'wordcount'
  fse.ensureDir(compileDir, error => {
    if (error) {
      logger.err(
        { error, projectId, userId, filename },
        'error ensuring dir for sync from code'
      )
      return callback(error)
    }
    CommandRunner.run(
      compileName,
      command,
      compileDir,
      image,
      timeout,
      {},
      compileGroup,
      error => {
        if (error) {
          return callback(error)
        }
        fs.readFile(
          compileDir + '/' + filename + '.wc',
          'utf-8',
          (err, stdout) => {
            if (err) {
              // call it node_err so sentry doesn't use random path error as unique id so it can't be ignored
              logger.err(
                { node_err: err, command, compileDir, projectId, userId },
                'error reading word count output'
              )
              return callback(err)
            }
            const results = _parseWordcountFromOutput(stdout)
            logger.log(
              { projectId, userId, wordcount: results },
              'word count results'
            )
            callback(null, results)
          }
        )
      }
    )
  })
}

function _parseWordcountFromOutput(output) {
  const results = {
    encode: '',
    textWords: 0,
    headWords: 0,
    outside: 0,
    headers: 0,
    elements: 0,
    mathInline: 0,
    mathDisplay: 0,
    errors: 0,
    messages: '',
  }
  for (const line of output.split('\n')) {
    const [data, info] = line.split(':')
    if (data.indexOf('Encoding') > -1) {
      results.encode = info.trim()
    }
    if (data.indexOf('in text') > -1) {
      results.textWords = parseInt(info, 10)
    }
    if (data.indexOf('in head') > -1) {
      results.headWords = parseInt(info, 10)
    }
    if (data.indexOf('outside') > -1) {
      results.outside = parseInt(info, 10)
    }
    if (data.indexOf('of head') > -1) {
      results.headers = parseInt(info, 10)
    }
    if (data.indexOf('Number of floats/tables/figures') > -1) {
      results.elements = parseInt(info, 10)
    }
    if (data.indexOf('Number of math inlines') > -1) {
      results.mathInline = parseInt(info, 10)
    }
    if (data.indexOf('Number of math displayed') > -1) {
      results.mathDisplay = parseInt(info, 10)
    }
    if (data === '(errors') {
      // errors reported as (errors:123)
      results.errors = parseInt(info, 10)
    }
    if (line.indexOf('!!! ') > -1) {
      // errors logged as !!! message !!!
      results.messages += line + '\n'
    }
  }
  return results
}

module.exports = {
  doCompileWithLock,
  stopCompile,
  clearProject,
  clearExpiredProjects,
  syncFromCode,
  syncFromPdf,
  wordcount,
}
