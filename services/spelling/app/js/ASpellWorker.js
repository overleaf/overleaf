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

const BATCH_SIZE = 100

class ASpellWorker {
  constructor(language) {
    this.language = language
    this.count = 0
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
      return metrics.inc('aspellWorker', 1, {
        status: 'exit',
        method: this.language
      })
    })
    this.pipe.on('close', () => {
      if (this.state !== 'killed') {
        this.state = 'closed'
      }
      if (this.callback != null) {
        logger.err(
          { process: this.pipe.pid, lang: this.language },
          'aspell worker closed output streams with uncalled callback'
        )
        this.callback(
          new Error(
            'aspell worker closed output streams with uncalled callback'
          ),
          []
        )
        return (this.callback = null)
      }
    })
    this.pipe.on('error', err => {
      if (this.state !== 'killed') {
        this.state = 'error'
      }
      logger.log(
        {
          process: this.pipe.pid,
          error: err,
          stdout: output.slice(-1024),
          stderr: error.slice(-1024),
          lang: this.language
        },
        'aspell worker error'
      )
      if (this.callback != null) {
        this.callback(err, [])
        return (this.callback = null)
      }
    })
    this.pipe.stdin.on('error', err => {
      if (this.state !== 'killed') {
        this.state = 'error'
      }
      logger.info(
        {
          process: this.pipe.pid,
          error: err,
          stdout: output.slice(-1024),
          stderr: error.slice(-1024),
          lang: this.language
        },
        'aspell worker error on stdin'
      )
      if (this.callback != null) {
        this.callback(err, [])
        return (this.callback = null)
      }
    })

    var output = ''
    const endMarker = new RegExp('^[a-z][a-z]', 'm')
    this.pipe.stdout.on('data', chunk => {
      output = output + chunk
      // We receive the language code from Aspell as the end of data marker
      if (chunk.toString().match(endMarker)) {
        if (this.callback != null) {
          this.callback(null, output.slice())
          this.callback = null // only allow one callback in use
        } else {
          logger.err(
            { process: this.pipe.pid, lang: this.language },
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
      logger.err(
        { process: this.pipe.pid, lang: this.language },
        'CALLBACK ALREADY IN USE'
      )
      return this.callback(
        new Error('Aspell callback already in use - SHOULD NOT HAPPEN')
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
    return this.pipe.stdin.end()
  }

  kill(reason) {
    logger.info({ process: this.pipe.pid, reason }, 'killing')
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
