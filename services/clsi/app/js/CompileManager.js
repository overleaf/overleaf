/* eslint-disable
    camelcase,
    handle-callback-err,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let CompileManager
const ResourceWriter = require('./ResourceWriter')
const LatexRunner = require('./LatexRunner')
const OutputFileFinder = require('./OutputFileFinder')
const OutputCacheManager = require('./OutputCacheManager')
const Settings = require('settings-sharelatex')
const Path = require('path')
const logger = require('logger-sharelatex')
const Metrics = require('./Metrics')
const child_process = require('child_process')
const DraftModeManager = require('./DraftModeManager')
const TikzManager = require('./TikzManager')
const LockManager = require('./LockManager')
const fs = require('fs')
const fse = require('fs-extra')
const os = require('os')
const async = require('async')
const Errors = require('./Errors')
const CommandRunner = require('./CommandRunner')

const getCompileName = function (project_id, user_id) {
  if (user_id != null) {
    return `${project_id}-${user_id}`
  } else {
    return project_id
  }
}

const getCompileDir = (project_id, user_id) =>
  Path.join(Settings.path.compilesDir, getCompileName(project_id, user_id))

module.exports = CompileManager = {
  doCompileWithLock(request, callback) {
    if (callback == null) {
      callback = function (error, outputFiles) {}
    }
    const compileDir = getCompileDir(request.project_id, request.user_id)
    const lockFile = Path.join(compileDir, '.project-lock')
    // use a .project-lock file in the compile directory to prevent
    // simultaneous compiles
    return fse.ensureDir(compileDir, function (error) {
      if (error != null) {
        return callback(error)
      }
      return LockManager.runWithLock(
        lockFile,
        (releaseLock) => CompileManager.doCompile(request, releaseLock),
        callback
      )
    })
  },

  doCompile(request, callback) {
    if (callback == null) {
      callback = function (error, outputFiles) {}
    }
    const compileDir = getCompileDir(request.project_id, request.user_id)
    let timer = new Metrics.Timer('write-to-disk')
    logger.log(
      { project_id: request.project_id, user_id: request.user_id },
      'syncing resources to disk'
    )
    return ResourceWriter.syncResourcesToDisk(request, compileDir, function (
      error,
      resourceList
    ) {
      // NOTE: resourceList is insecure, it should only be used to exclude files from the output list
      if (error != null && error instanceof Errors.FilesOutOfSyncError) {
        logger.warn(
          { project_id: request.project_id, user_id: request.user_id },
          'files out of sync, please retry'
        )
        return callback(error)
      } else if (error != null) {
        logger.err(
          {
            err: error,
            project_id: request.project_id,
            user_id: request.user_id
          },
          'error writing resources to disk'
        )
        return callback(error)
      }
      logger.log(
        {
          project_id: request.project_id,
          user_id: request.user_id,
          time_taken: Date.now() - timer.start
        },
        'written files to disk'
      )
      timer.done()

      const injectDraftModeIfRequired = function (callback) {
        if (request.draft) {
          return DraftModeManager.injectDraftMode(
            Path.join(compileDir, request.rootResourcePath),
            callback
          )
        } else {
          return callback()
        }
      }

      const createTikzFileIfRequired = (callback) =>
        TikzManager.checkMainFile(
          compileDir,
          request.rootResourcePath,
          resourceList,
          function (error, needsMainFile) {
            if (error != null) {
              return callback(error)
            }
            if (needsMainFile) {
              return TikzManager.injectOutputFile(
                compileDir,
                request.rootResourcePath,
                callback
              )
            } else {
              return callback()
            }
          }
        )
      // set up environment variables for chktex
      const env = {}
      if (Settings.texliveOpenoutAny && Settings.texliveOpenoutAny !== '') {
        // override default texlive openout_any environment variable
        env.openout_any = Settings.texliveOpenoutAny
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
      return async.series(
        [injectDraftModeIfRequired, createTikzFileIfRequired],
        function (error) {
          if (error != null) {
            return callback(error)
          }
          timer = new Metrics.Timer('run-compile')
          // find the image tag to log it as a metric, e.g. 2015.1 (convert . to - for graphite)
          let tag =
            __guard__(
              __guard__(
                request.imageName != null
                  ? request.imageName.match(/:(.*)/)
                  : undefined,
                (x1) => x1[1]
              ),
              (x) => x.replace(/\./g, '-')
            ) || 'default'
          if (!request.project_id.match(/^[0-9a-f]{24}$/)) {
            tag = 'other'
          } // exclude smoke test
          Metrics.inc('compiles')
          Metrics.inc(`compiles-with-image.${tag}`)
          const compileName = getCompileName(
            request.project_id,
            request.user_id
          )
          return LatexRunner.runLatex(
            compileName,
            {
              directory: compileDir,
              mainFile: request.rootResourcePath,
              compiler: request.compiler,
              timeout: request.timeout,
              image: request.imageName,
              flags: request.flags,
              environment: env,
              compileGroup: request.compileGroup
            },
            function (error, output, stats, timings) {
              // request was for validation only
              let metric_key, metric_value
              if (request.check === 'validate') {
                const result = (error != null ? error.code : undefined)
                  ? 'fail'
                  : 'pass'
                error = new Error('validation')
                error.validate = result
              }
              // request was for compile, and failed on validation
              if (
                request.check === 'error' &&
                (error != null ? error.message : undefined) === 'exited'
              ) {
                error = new Error('compilation')
                error.validate = 'fail'
              }
              // compile was killed by user, was a validation, or a compile which failed validation
              if (
                (error != null ? error.terminated : undefined) ||
                (error != null ? error.validate : undefined) ||
                (error != null ? error.timedout : undefined)
              ) {
                OutputFileFinder.findOutputFiles(
                  resourceList,
                  compileDir,
                  function (err, outputFiles) {
                    if (err != null) {
                      return callback(err)
                    }
                    error.outputFiles = outputFiles // return output files so user can check logs
                    return callback(error)
                  }
                )
                return
              }
              // compile completed normally
              if (error != null) {
                return callback(error)
              }
              Metrics.inc('compiles-succeeded')
              const object = stats || {}
              for (metric_key in object) {
                metric_value = object[metric_key]
                Metrics.count(metric_key, metric_value)
              }
              const object1 = timings || {}
              for (metric_key in object1) {
                metric_value = object1[metric_key]
                Metrics.timing(metric_key, metric_value)
              }
              const loadavg =
                typeof os.loadavg === 'function' ? os.loadavg() : undefined
              if (loadavg != null) {
                Metrics.gauge('load-avg', loadavg[0])
              }
              const ts = timer.done()
              logger.log(
                {
                  project_id: request.project_id,
                  user_id: request.user_id,
                  time_taken: ts,
                  stats,
                  timings,
                  loadavg
                },
                'done compile'
              )
              if ((stats != null ? stats['latex-runs'] : undefined) > 0) {
                Metrics.timing('run-compile-per-pass', ts / stats['latex-runs'])
              }
              if (
                (stats != null ? stats['latex-runs'] : undefined) > 0 &&
                (timings != null ? timings['cpu-time'] : undefined) > 0
              ) {
                Metrics.timing(
                  'run-compile-cpu-time-per-pass',
                  timings['cpu-time'] / stats['latex-runs']
                )
              }

              return OutputFileFinder.findOutputFiles(
                resourceList,
                compileDir,
                function (error, outputFiles) {
                  if (error != null) {
                    return callback(error)
                  }
                  return OutputCacheManager.saveOutputFiles(
                    outputFiles,
                    compileDir,
                    (error, newOutputFiles) => callback(null, newOutputFiles)
                  )
                }
              )
            }
          )
        }
      )
    })
  },

  stopCompile(project_id, user_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const compileName = getCompileName(project_id, user_id)
    return LatexRunner.killLatex(compileName, callback)
  },

  clearProject(project_id, user_id, _callback) {
    if (_callback == null) {
      _callback = function (error) {}
    }
    const callback = function (error) {
      _callback(error)
      return (_callback = function () {})
    }

    const compileDir = getCompileDir(project_id, user_id)

    return CompileManager._checkDirectory(compileDir, function (err, exists) {
      if (err != null) {
        return callback(err)
      }
      if (!exists) {
        return callback()
      } // skip removal if no directory present

      const proc = child_process.spawn('rm', ['-r', compileDir])

      proc.on('error', callback)

      let stderr = ''
      proc.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk))

      return proc.on('close', function (code) {
        if (code === 0) {
          return callback(null)
        } else {
          return callback(new Error(`rm -r ${compileDir} failed: ${stderr}`))
        }
      })
    })
  },

  _findAllDirs(callback) {
    if (callback == null) {
      callback = function (error, allDirs) {}
    }
    const root = Settings.path.compilesDir
    return fs.readdir(root, function (err, files) {
      if (err != null) {
        return callback(err)
      }
      const allDirs = Array.from(files).map((file) => Path.join(root, file))
      return callback(null, allDirs)
    })
  },

  clearExpiredProjects(max_cache_age_ms, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const now = Date.now()
    // action for each directory
    const expireIfNeeded = (checkDir, cb) =>
      fs.stat(checkDir, function (err, stats) {
        if (err != null) {
          return cb()
        } // ignore errors checking directory
        const age = now - stats.mtime
        const hasExpired = age > max_cache_age_ms
        if (hasExpired) {
          return fse.remove(checkDir, cb)
        } else {
          return cb()
        }
      })
    // iterate over all project directories
    return CompileManager._findAllDirs(function (error, allDirs) {
      if (error != null) {
        return callback()
      }
      return async.eachSeries(allDirs, expireIfNeeded, callback)
    })
  },

  _checkDirectory(compileDir, callback) {
    if (callback == null) {
      callback = function (error, exists) {}
    }
    return fs.lstat(compileDir, function (err, stats) {
      if ((err != null ? err.code : undefined) === 'ENOENT') {
        return callback(null, false) //  directory does not exist
      } else if (err != null) {
        logger.err(
          { dir: compileDir, err },
          'error on stat of project directory for removal'
        )
        return callback(err)
      } else if (!(stats != null ? stats.isDirectory() : undefined)) {
        logger.err(
          { dir: compileDir, stats },
          'bad project directory for removal'
        )
        return callback(new Error('project directory is not directory'))
      } else {
        return callback(null, true)
      }
    })
  }, // directory exists

  syncFromCode(project_id, user_id, file_name, line, column, callback) {
    // If LaTeX was run in a virtual environment, the file path that synctex expects
    // might not match the file path on the host. The .synctex.gz file however, will be accessed
    // wherever it is on the host.
    if (callback == null) {
      callback = function (error, pdfPositions) {}
    }
    const compileName = getCompileName(project_id, user_id)
    const base_dir = Settings.path.synctexBaseDir(compileName)
    const file_path = base_dir + '/' + file_name
    const compileDir = getCompileDir(project_id, user_id)
    const synctex_path = `${base_dir}/output.pdf`
    const command = ['code', synctex_path, file_path, line, column]
    CompileManager._runSynctex(project_id, user_id, command, function (
      error,
      stdout
    ) {
      if (error != null) {
        return callback(error)
      }
      logger.log(
        { project_id, user_id, file_name, line, column, command, stdout },
        'synctex code output'
      )
      return callback(null, CompileManager._parseSynctexFromCodeOutput(stdout))
    })
  },

  syncFromPdf(project_id, user_id, page, h, v, callback) {
    if (callback == null) {
      callback = function (error, filePositions) {}
    }
    const compileName = getCompileName(project_id, user_id)
    const compileDir = getCompileDir(project_id, user_id)
    const base_dir = Settings.path.synctexBaseDir(compileName)
    const synctex_path = `${base_dir}/output.pdf`
    const command = ['pdf', synctex_path, page, h, v]
    CompileManager._runSynctex(project_id, user_id, command, function (
      error,
      stdout
    ) {
      if (error != null) {
        return callback(error)
      }
      logger.log(
        { project_id, user_id, page, h, v, stdout },
        'synctex pdf output'
      )
      return callback(
        null,
        CompileManager._parseSynctexFromPdfOutput(stdout, base_dir)
      )
    })
  },

  _checkFileExists(dir, filename, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const file = Path.join(dir, filename)
    return fs.stat(dir, function (error, stats) {
      if ((error != null ? error.code : undefined) === 'ENOENT') {
        return callback(new Errors.NotFoundError('no output directory'))
      }
      if (error != null) {
        return callback(error)
      }
      return fs.stat(file, function (error, stats) {
        if ((error != null ? error.code : undefined) === 'ENOENT') {
          return callback(new Errors.NotFoundError('no output file'))
        }
        if (error != null) {
          return callback(error)
        }
        if (!(stats != null ? stats.isFile() : undefined)) {
          return callback(new Error('not a file'))
        }
        return callback()
      })
    })
  },

  _runSynctex(project_id, user_id, command, callback) {
    if (callback == null) {
      callback = function (error, stdout) {}
    }
    const seconds = 1000

    command.unshift('/opt/synctex')

    const directory = getCompileDir(project_id, user_id)
    const timeout = 60 * 1000 // increased to allow for large projects
    const compileName = getCompileName(project_id, user_id)
    const compileGroup = 'synctex'
    CompileManager._checkFileExists(directory, 'output.synctex.gz', (error) => {
      if (error) {
        return callback(error)
      }
      return CommandRunner.run(
        compileName,
        command,
        directory,
        Settings.clsi && Settings.clsi.docker
          ? Settings.clsi.docker.image
          : undefined,
        timeout,
        {},
        compileGroup,
        function (error, output) {
          if (error != null) {
            logger.err(
              { err: error, command, project_id, user_id },
              'error running synctex'
            )
            return callback(error)
          }
          return callback(null, output.stdout)
        }
      )
    })
  },

  _parseSynctexFromCodeOutput(output) {
    const results = []
    for (const line of Array.from(output.split('\n'))) {
      const [node, page, h, v, width, height] = Array.from(line.split('\t'))
      if (node === 'NODE') {
        results.push({
          page: parseInt(page, 10),
          h: parseFloat(h),
          v: parseFloat(v),
          height: parseFloat(height),
          width: parseFloat(width)
        })
      }
    }
    return results
  },

  _parseSynctexFromPdfOutput(output, base_dir) {
    const results = []
    for (let line of Array.from(output.split('\n'))) {
      let column, file_path, node
      ;[node, file_path, line, column] = Array.from(line.split('\t'))
      if (node === 'NODE') {
        const file = file_path.slice(base_dir.length + 1)
        results.push({
          file,
          line: parseInt(line, 10),
          column: parseInt(column, 10)
        })
      }
    }
    return results
  },

  wordcount(project_id, user_id, file_name, image, callback) {
    if (callback == null) {
      callback = function (error, pdfPositions) {}
    }
    logger.log({ project_id, user_id, file_name, image }, 'running wordcount')
    const file_path = `$COMPILE_DIR/${file_name}`
    const command = [
      'texcount',
      '-nocol',
      '-inc',
      file_path,
      `-out=${file_path}.wc`
    ]
    const compileDir = getCompileDir(project_id, user_id)
    const timeout = 60 * 1000
    const compileName = getCompileName(project_id, user_id)
    const compileGroup = 'wordcount'
    return fse.ensureDir(compileDir, function (error) {
      if (error != null) {
        logger.err(
          { error, project_id, user_id, file_name },
          'error ensuring dir for sync from code'
        )
        return callback(error)
      }
      return CommandRunner.run(
        compileName,
        command,
        compileDir,
        image,
        timeout,
        {},
        compileGroup,
        function (error) {
          if (error != null) {
            return callback(error)
          }
          return fs.readFile(
            compileDir + '/' + file_name + '.wc',
            'utf-8',
            function (err, stdout) {
              if (err != null) {
                // call it node_err so sentry doesn't use random path error as unique id so it can't be ignored
                logger.err(
                  { node_err: err, command, compileDir, project_id, user_id },
                  'error reading word count output'
                )
                return callback(err)
              }
              const results = CompileManager._parseWordcountFromOutput(stdout)
              logger.log(
                { project_id, user_id, wordcount: results },
                'word count results'
              )
              return callback(null, results)
            }
          )
        }
      )
    })
  },

  _parseWordcountFromOutput(output) {
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
      messages: ''
    }
    for (const line of Array.from(output.split('\n'))) {
      const [data, info] = Array.from(line.split(':'))
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
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
