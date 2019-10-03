// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const childProcess = require('child_process')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const _ = require('underscore')
const OError = require('@overleaf/o-error')

const BATCH_SIZE = 100

class ASpellWorker {
  constructor(language) {
    this.language = language
    this.count = 0
    this.closeReason = ''
    this.pipe = childProcess.spawn('aspell', [
      'pipe',
      '-t',
      '--encoding=utf-8',
      '-d',
      language
    ])
    logger.info(
      { process: this.pipe.pid, lang: this.language },
      'starting new aspell worker'
    )
    metrics.inc('aspellWorker', 1, { status: 'start', method: this.language })
    this.pipe.on('exit', () => {
      this.state = 'killed'
      logger.info(
        { process: this.pipe.pid, lang: this.language },
        'aspell worker has exited'
      )
      metrics.inc('aspellWorker', 1, {
        status: 'exit',
        method: this.language
      })
    })
    this.pipe.on('close', () => {
      const previousWorkerState = this.state
      if (this.state !== 'killed') {
        this.state = 'closed'
      }
      if (this.callback != null) {
        const err = new OError({
          message: 'aspell worker closed output streams with uncalled callback',
          info: {
            process: this.pipe.pid,
            lang: this.language,
            stdout: output.slice(-1024),
            stderr: error.slice(-1024),
            workerState: this.state,
            previousWorkerState,
            closeReason: this.closeReason
          }
        })
        this.callback(err, [])
        this.callback = null
      }
    })
    this.pipe.on('error', err => {
      const previousWorkerState = this.state
      if (this.state !== 'killed') {
        this.state = 'error'
      }
      const errInfo = {
        process: this.pipe.pid,
        stdout: output.slice(-1024),
        stderr: error.slice(-1024),
        lang: this.language,
        workerState: this.state,
        previousWorkerState,
        closeReason: this.closeReason
      }

      if (this.callback != null) {
        this.callback(
          new OError({
            message: 'aspell worker error',
            info: errInfo
          }).withCause(err),
          []
        )
        this.callback = null
      } else {
        logger.warn({ error: err, ...errInfo }, 'aspell worker error')
      }
    })
    this.pipe.stdin.on('error', err => {
      const previousWorkerState = this.state
      if (this.state !== 'killed') {
        this.state = 'error'
      }
      const errInfo = {
        process: this.pipe.pid,
        stdout: output.slice(-1024),
        stderr: error.slice(-1024),
        lang: this.language,
        workerState: this.state,
        previousWorkerState,
        closeReason: this.closeReason
      }

      if (this.callback != null) {
        this.callback(
          new OError({
            message: 'aspell worker error on stdin',
            info: errInfo
          }).withCause(err),
          []
        )
        this.callback = null
      } else {
        logger.warn(
          {
            error: err,
            ...errInfo
          },
          'aspell worker error on stdin'
        )
      }
    })

    this.pipe.stdout.setEncoding('utf8') // ensure utf8 output is handled correctly
    var output = ''
    const endMarkerRegex = new RegExp('^[a-z][a-z]', 'gm')
    this.pipe.stdout.on('data', data => {
      // We receive the language code from Aspell as the end of data marker in
      // the data.  The input is a utf8 encoded string.
      let oldPos = output.length
      output = output + data
      // The end marker may cross the end of a chunk, so we optimise the search
      // using the regex lastIndex property.
      endMarkerRegex.lastIndex = oldPos > 2 ? oldPos - 2 : 0
      if (endMarkerRegex.test(output)) {
        if (this.callback != null) {
          this.callback(null, output.slice())
          this.callback = null // only allow one callback in use
        } else {
          logger.err(
            {
              process: this.pipe.pid,
              lang: this.language,
              workerState: this.state
            },
            'end of data marker received when callback already used'
          )
        }
        this.state = 'ready'
        output = ''
      }
    })

    var error = ''
    this.pipe.stderr.on('data', chunk => {
      return (error = error + chunk)
    })

    this.pipe.stdout.on('end', () => {
      // process has ended
      return (this.state = 'end')
    })
  }

  isReady() {
    return this.state === 'ready'
  }

  check(words, callback) {
    // we will now send data to aspell, and be ready again when we
    // receive the end of data marker
    this.state = 'busy'
    if (this.callback != null) {
      // only allow one callback in use
      return this.callback(
        new OError({
          message: 'Aspell callback already in use - SHOULD NOT HAPPEN',
          info: {
            process: this.pipe.pid,
            lang: this.language,
            workerState: this.state
          }
        })
      )
    }
    this.callback = _.once(callback) // extra defence against double callback
    this.setTerseMode()
    this.write(words)
    return this.flush()
  }

  write(words) {
    let i = 0
    return (() => {
      const result = []
      while (i < words.length) {
        // batch up the words to check for efficiency
        const batch = words.slice(i, i + BATCH_SIZE)
        this.sendWords(batch)
        result.push((i += BATCH_SIZE))
      }
      return result
    })()
  }

  flush() {
    // get aspell to send an end of data marker "*" when ready
    // @sendCommand("%")		# take the aspell pipe out of terse mode so we can look for a '*'
    // @sendCommand("^ENDOFSTREAMMARKER") # send our marker which will generate a '*'
    // @sendCommand("!")		# go back into terse mode
    return this.sendCommand('$$l')
  }

  shutdown(reason) {
    logger.info({ process: this.pipe.pid, reason }, 'shutting down')
    this.state = 'closing'
    this.closeReason = reason
    return this.pipe.stdin.end()
  }

  kill(reason) {
    logger.info({ process: this.pipe.pid, reason }, 'killing')
    this.closeReason = reason
    if (this.state === 'killed') {
      return
    }
    return this.pipe.kill('SIGKILL')
  }

  setTerseMode() {
    return this.sendCommand('!')
  }

  sendWord(word) {
    return this.sendCommand(`^${word}`)
  }

  sendWords(words) {
    // Aspell accepts multiple words to check on the same line
    // ^word1 word2 word3 ...
    // See aspell.info, writing programs to use Aspell Through A Pipe
    this.sendCommand(`^${words.join(' ')}`)
    return this.count++
  }

  sendCommand(command) {
    return this.pipe.stdin.write(command + '\n')
  }
}

module.exports = ASpellWorker
