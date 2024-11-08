const Path = require('node:path')
const { promisify } = require('node:util')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const CommandRunner = require('./CommandRunner')
const fs = require('node:fs')

const ProcessTable = {} // table of currently running jobs (pids or docker container names)

const TIME_V_METRICS = Object.entries({
  'cpu-percent': /Percent of CPU this job got: (\d+)/m,
  'cpu-time': /User time.*: (\d+.\d+)/m,
  'sys-time': /System time.*: (\d+.\d+)/m,
})

const COMPILER_FLAGS = {
  latex: '-pdfdvi',
  lualatex: '-lualatex',
  pdflatex: '-pdf',
  xelatex: '-xelatex',
}

function runLatex(projectId, options, callback) {
  const {
    directory,
    mainFile,
    image,
    environment,
    flags,
    compileGroup,
    stopOnFirstError,
    stats,
    timings,
  } = options
  const compiler = options.compiler || 'pdflatex'
  const timeout = options.timeout || 60000 // milliseconds

  logger.debug(
    {
      directory,
      compiler,
      timeout,
      mainFile,
      environment,
      flags,
      compileGroup,
      stopOnFirstError,
    },
    'starting compile'
  )

  let command
  try {
    command = _buildLatexCommand(mainFile, {
      compiler,
      stopOnFirstError,
      flags,
    })
  } catch (err) {
    return callback(err)
  }

  const id = `${projectId}` // record running project under this id

  ProcessTable[id] = CommandRunner.run(
    projectId,
    command,
    directory,
    image,
    timeout,
    environment,
    compileGroup,
    function (error, output) {
      delete ProcessTable[id]
      if (error) {
        return callback(error)
      }
      const runs =
        output?.stderr?.match(/^Run number \d+ of .*latex/gm)?.length || 0
      const failed = output?.stdout?.match(/^Latexmk: Errors/m) != null ? 1 : 0
      // counters from latexmk output
      stats['latexmk-errors'] = failed
      stats['latex-runs'] = runs
      stats['latex-runs-with-errors'] = failed ? runs : 0
      stats[`latex-runs-${runs}`] = 1
      stats[`latex-runs-with-errors-${runs}`] = failed ? 1 : 0
      // timing information from /usr/bin/time
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
      _writeLogOutput(projectId, directory, output, () => {
        callback(error, output)
      })
    }
  )
}

function _writeLogOutput(projectId, directory, output, callback) {
  if (!output) {
    return callback()
  }
  // internal method for writing non-empty log files
  function _writeFile(file, content, cb) {
    if (content && content.length > 0) {
      fs.unlink(file, () => {
        fs.writeFile(file, content, { flag: 'wx' }, err => {
          if (err) {
            // don't fail on error
            logger.error({ err, projectId, file }, 'error writing log file')
          }
          cb()
        })
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
}

function killLatex(projectId, callback) {
  const id = `${projectId}`
  logger.debug({ id }, 'killing running compile')
  if (ProcessTable[id] == null) {
    logger.warn({ id }, 'no such project to kill')
    callback(null)
  } else {
    CommandRunner.kill(ProcessTable[id], callback)
  }
}

function _buildLatexCommand(mainFile, opts = {}) {
  const command = []

  if (Settings.clsi?.strace) {
    command.push('strace', '-o', 'strace', '-ff')
  }

  if (Settings.clsi?.latexmkCommandPrefix) {
    command.push(...Settings.clsi.latexmkCommandPrefix)
  }

  // Basic command and flags
  command.push(
    'latexmk',
    '-cd',
    '-jobname=output',
    '-auxdir=$COMPILE_DIR',
    '-outdir=$COMPILE_DIR',
    '-synctex=1',
    '-interaction=batchmode'
  )

  // Stop on first error option
  if (opts.stopOnFirstError) {
    command.push('-halt-on-error')
  } else {
    // Run all passes despite errors
    command.push('-f')
  }

  // Extra flags
  if (opts.flags) {
    command.push(...opts.flags)
  }

  // TeX Engine selection
  const compilerFlag = COMPILER_FLAGS[opts.compiler]
  if (compilerFlag) {
    command.push(compilerFlag)
  } else {
    throw new Error(`unknown compiler: ${opts.compiler}`)
  }

  // We want to run latexmk on the tex file which we will automatically
  // generate from the Rtex/Rmd/md file.
  mainFile = mainFile.replace(/\.(Rtex|md|Rmd|Rnw)$/, '.tex')
  command.push(Path.join('$COMPILE_DIR', mainFile))

  return command
}

module.exports = {
  runLatex,
  killLatex,
  promises: {
    runLatex: promisify(runLatex),
    killLatex: promisify(killLatex),
  },
}
