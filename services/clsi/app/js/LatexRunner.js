const Path = require('path')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const CommandRunner = require('./CommandRunner')
const fs = require('fs')

const ProcessTable = {} // table of currently running jobs (pids or docker container names)

const TIME_V_METRICS = Object.entries({
  'cpu-percent': /Percent of CPU this job got: (\d+)/m,
  'cpu-time': /User time.*: (\d+.\d+)/m,
  'sys-time': /System time.*: (\d+.\d+)/m,
})

function runLatex(projectId, options, callback) {
  let command
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

  logger.debug(
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
    command = _pdflatexCommand(mainFile, flags)
  } else if (compiler === 'latex') {
    command = _latexCommand(mainFile, flags)
  } else if (compiler === 'xelatex') {
    command = _xelatexCommand(mainFile, flags)
  } else if (compiler === 'lualatex') {
    command = _lualatexCommand(mainFile, flags)
  } else {
    return callback(new Error(`unknown compiler: ${compiler}`))
  }

  if (Settings.clsi?.strace) {
    command = ['strace', '-o', 'strace', '-ff'].concat(command)
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
      _writeLogOutput(projectId, directory, output, () => {
        callback(error, output, stats, timings)
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
      fs.writeFile(file, content, err => {
        if (err) {
          logger.error({ projectId, file }, 'error writing log file') // don't fail on error
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

function _latexmkBaseCommand(flags) {
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
  return (Settings.clsi?.latexmkCommandPrefix || []).concat(args)
}

function _pdflatexCommand(mainFile, flags) {
  return _latexmkBaseCommand(flags).concat([
    '-pdf',
    Path.join('$COMPILE_DIR', mainFile),
  ])
}

function _latexCommand(mainFile, flags) {
  return _latexmkBaseCommand(flags).concat([
    '-pdfdvi',
    Path.join('$COMPILE_DIR', mainFile),
  ])
}

function _xelatexCommand(mainFile, flags) {
  return _latexmkBaseCommand(flags).concat([
    '-xelatex',
    Path.join('$COMPILE_DIR', mainFile),
  ])
}

function _lualatexCommand(mainFile, flags) {
  return _latexmkBaseCommand(flags).concat([
    '-lualatex',
    Path.join('$COMPILE_DIR', mainFile),
  ])
}

module.exports = {
  runLatex,
  killLatex,
}
