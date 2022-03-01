/* eslint-disable
    camelcase,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let LatexRunner
const Path = require('path')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const Metrics = require('./Metrics')
const CommandRunner = require('./CommandRunner')
const fs = require('fs')

const ProcessTable = {} // table of currently running jobs (pids or docker container names)

const TIME_V_METRICS = Object.entries({
  'cpu-percent': /Percent of CPU this job got: (\d+)/m,
  'cpu-time': /User time.*: (\d+.\d+)/m,
  'sys-time': /System time.*: (\d+.\d+)/m,
})

module.exports = LatexRunner = {
  runLatex(project_id, options, callback) {
    let command
    if (callback == null) {
      callback = function () {}
    }
    let {
      directory,
      mainFile,
      compiler,
      timeout,
      image,
      environment,
      flags,
      compileGroup,
    } = options
    if (!compiler) {
      compiler = 'pdflatex'
    }
    if (!timeout) {
      timeout = 60000
    } // milliseconds

    logger.log(
      {
        directory,
        compiler,
        timeout,
        mainFile,
        environment,
        flags,
        compileGroup,
      },
      'starting compile'
    )

    // We want to run latexmk on the tex file which we will automatically
    // generate from the Rtex/Rmd/md file.
    mainFile = mainFile.replace(/\.(Rtex|md|Rmd)$/, '.tex')

    if (compiler === 'pdflatex') {
      command = LatexRunner._pdflatexCommand(mainFile, flags)
    } else if (compiler === 'latex') {
      command = LatexRunner._latexCommand(mainFile, flags)
    } else if (compiler === 'xelatex') {
      command = LatexRunner._xelatexCommand(mainFile, flags)
    } else if (compiler === 'lualatex') {
      command = LatexRunner._lualatexCommand(mainFile, flags)
    } else {
      return callback(new Error(`unknown compiler: ${compiler}`))
    }

    if (Settings.clsi != null ? Settings.clsi.strace : undefined) {
      command = ['strace', '-o', 'strace', '-ff'].concat(command)
    }

    const id = `${project_id}` // record running project under this id

    return (ProcessTable[id] = CommandRunner.run(
      project_id,
      command,
      directory,
      image,
      timeout,
      environment,
      compileGroup,
      function (error, output) {
        delete ProcessTable[id]
        if (error != null) {
          return callback(error)
        }
        const runs =
          __guard__(
            __guard__(output != null ? output.stderr : undefined, x1 =>
              x1.match(/^Run number \d+ of .*latex/gm)
            ),
            x => x.length
          ) || 0
        const failed =
          __guard__(output != null ? output.stdout : undefined, x2 =>
            x2.match(/^Latexmk: Errors/m)
          ) != null
            ? 1
            : 0
        // counters from latexmk output
        const stats = {}
        stats['latexmk-errors'] = failed
        stats['latex-runs'] = runs
        stats['latex-runs-with-errors'] = failed ? runs : 0
        stats[`latex-runs-${runs}`] = 1
        stats[`latex-runs-with-errors-${runs}`] = failed ? 1 : 0
        // timing information from /usr/bin/time
        const timings = {}
        const stderr = (output && output.stderr) || ''
        if (stderr.includes('Command being timed:')) {
          // Add metrics for runs with `$ time -v ...`
          for (const [timing, matcher] of TIME_V_METRICS) {
            const match = stderr.match(matcher)
            if (match) {
              timings[timing] = parseFloat(match[1])
            }
          }
        }
        // record output files
        LatexRunner.writeLogOutput(project_id, directory, output, () => {
          return callback(error, output, stats, timings)
        })
      }
    ))
  },

  writeLogOutput(project_id, directory, output, callback) {
    if (!output) {
      return callback()
    }
    // internal method for writing non-empty log files
    function _writeFile(file, content, cb) {
      if (content && content.length > 0) {
        fs.writeFile(file, content, err => {
          if (err) {
            logger.error({ project_id, file }, 'error writing log file') // don't fail on error
          }
          cb()
        })
      } else {
        cb()
      }
    }
    // write stdout and stderr, ignoring errors
    _writeFile(Path.join(directory, 'output.stdout'), output.stdout, () => {
      _writeFile(Path.join(directory, 'output.stderr'), output.stderr, () => {
        callback()
      })
    })
  },

  killLatex(project_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const id = `${project_id}`
    logger.log({ id }, 'killing running compile')
    if (ProcessTable[id] == null) {
      logger.warn({ id }, 'no such project to kill')
      return callback(null)
    } else {
      return CommandRunner.kill(ProcessTable[id], callback)
    }
  },

  _latexmkBaseCommand(flags) {
    let args = [
      'latexmk',
      '-cd',
      '-f',
      '-jobname=output',
      '-auxdir=$COMPILE_DIR',
      '-outdir=$COMPILE_DIR',
      '-synctex=1',
      '-interaction=batchmode',
    ]
    if (flags) {
      args = args.concat(flags)
    }
    return (
      __guard__(
        Settings != null ? Settings.clsi : undefined,
        x => x.latexmkCommandPrefix
      ) || []
    ).concat(args)
  },

  _pdflatexCommand(mainFile, flags) {
    return LatexRunner._latexmkBaseCommand(flags).concat([
      '-pdf',
      Path.join('$COMPILE_DIR', mainFile),
    ])
  },

  _latexCommand(mainFile, flags) {
    return LatexRunner._latexmkBaseCommand(flags).concat([
      '-pdfdvi',
      Path.join('$COMPILE_DIR', mainFile),
    ])
  },

  _xelatexCommand(mainFile, flags) {
    return LatexRunner._latexmkBaseCommand(flags).concat([
      '-xelatex',
      Path.join('$COMPILE_DIR', mainFile),
    ])
  },

  _lualatexCommand(mainFile, flags) {
    return LatexRunner._latexmkBaseCommand(flags).concat([
      '-lualatex',
      Path.join('$COMPILE_DIR', mainFile),
    ])
  },
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
