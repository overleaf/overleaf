/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let CommandRunner
const { spawn } = require('node:child_process')
const { promisify } = require('node:util')
const _ = require('lodash')
const logger = require('@overleaf/logger')

logger.debug('using standard command runner')

module.exports = CommandRunner = {
  run(
    projectId,
    command,
    directory,
    image,
    timeout,
    environment,
    compileGroup,
    callback
  ) {
    let key, value
    callback = _.once(callback)
    command = Array.from(command).map(arg =>
      arg.toString().replace('$COMPILE_DIR', directory)
    )
    logger.debug({ projectId, command, directory }, 'running command')
    logger.warn('timeouts and sandboxing are not enabled with CommandRunner')

    // merge environment settings
    const env = {}
    for (key in process.env) {
      value = process.env[key]
      env[key] = value
    }
    for (key in environment) {
      value = environment[key]
      env[key] = value
    }

    // run command as detached process so it has its own process group (which can be killed if needed)
    const proc = spawn(command[0], command.slice(1), {
      cwd: directory,
      env,
      stdio: ['pipe', 'pipe', 'ignore'],
    })

    let stdout = ''
    proc.stdout.setEncoding('utf8').on('data', data => (stdout += data))

    proc.on('error', function (err) {
      logger.err(
        { err, projectId, command, directory },
        'error running command'
      )
      return callback(err)
    })

    proc.on('close', function (code, signal) {
      let err
      logger.debug({ code, signal, projectId }, 'command exited')
      if (signal === 'SIGTERM') {
        // signal from kill method below
        err = new Error('terminated')
        err.terminated = true
        return callback(err)
      } else if (code === 1) {
        // exit status from chktex
        err = new Error('exited')
        err.code = code
        return callback(err)
      } else {
        return callback(null, { stdout })
      }
    })

    return proc.pid
  }, // return process id to allow job to be killed if necessary

  kill(pid, callback) {
    if (callback == null) {
      callback = function () {}
    }
    try {
      process.kill(-pid) // kill all processes in group
    } catch (err) {
      return callback(err)
    }
    return callback()
  },
}

module.exports.promises = {
  run: promisify(CommandRunner.run),
  kill: promisify(CommandRunner.kill),
}
