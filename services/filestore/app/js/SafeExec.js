const lodashOnce = require('lodash.once')
const childProcess = require('node:child_process')
const Settings = require('@overleaf/settings')
const { ConversionsDisabledError, FailedCommandError } = require('./Errors')

// execute a command in the same way as 'exec' but with a timeout that
// kills all child processes
//
// we spawn the command with 'detached:true' to make a new process
// group, then we can kill everything in that process group.

module.exports = safeExec
module.exports.promises = safeExecPromise

// options are {timeout:  number-of-milliseconds, killSignal: signal-name}
function safeExec(command, options, callback) {
  if (!Settings.enableConversions) {
    return callback(
      new ConversionsDisabledError('image conversions are disabled')
    )
  }

  const [cmd, ...args] = command

  const child = childProcess.spawn(cmd, args, { detached: true })
  let stdout = ''
  let stderr = ''

  let killTimer

  const cleanup = lodashOnce(function (err) {
    if (killTimer) {
      clearTimeout(killTimer)
    }
    callback(err, stdout, stderr)
  })

  if (options.timeout) {
    killTimer = setTimeout(function () {
      try {
        // use negative process id to kill process group
        process.kill(-child.pid, options.killSignal || 'SIGTERM')
      } catch (error) {
        cleanup(
          new FailedCommandError('failed to kill process after timeout', {
            command,
            options,
            pid: child.pid,
          })
        )
      }
    }, options.timeout)
  }

  child.on('close', function (code, signal) {
    if (code || signal) {
      return cleanup(
        new FailedCommandError(command, code || signal, stdout, stderr)
      )
    }

    cleanup()
  })

  child.on('error', err => {
    cleanup(err)
  })
  child.stdout.on('data', chunk => {
    stdout += chunk
  })
  child.stderr.on('data', chunk => {
    stderr += chunk
  })
}

function safeExecPromise(command, options) {
  return new Promise((resolve, reject) => {
    safeExec(command, options, (err, stdout, stderr) => {
      if (err) {
        reject(err)
      }
      resolve({ stdout, stderr })
    })
  })
}
