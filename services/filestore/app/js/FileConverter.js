/* eslint-disable
    camelcase,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore')
const metrics = require('metrics-sharelatex')
const logger = require('logger-sharelatex')
const safe_exec = require('./SafeExec')
const approvedFormats = ['png']
const Settings = require('settings-sharelatex')

const fourtySeconds = 40 * 1000

const childProcessOpts = {
  killSignal: 'SIGTERM',
  timeout: fourtySeconds
}

module.exports = {
  convert(sourcePath, requestedFormat, callback) {
    logger.log({ sourcePath, requestedFormat }, 'converting file format')
    const timer = new metrics.Timer('imageConvert')
    const destPath = `${sourcePath}.${requestedFormat}`
    sourcePath = `${sourcePath}[0]`
    if (!_.include(approvedFormats, requestedFormat)) {
      const err = new Error('invalid format requested')
      return callback(err)
    }
    const width = '600x'
    let command = [
      'convert',
      '-define',
      `pdf:fit-page=${width}`,
      '-flatten',
      '-density',
      '300',
      sourcePath,
      destPath
    ]
    command = Settings.commands.convertCommandPrefix.concat(command)
    return safe_exec(command, childProcessOpts, function(err, stdout, stderr) {
      timer.done()
      if (err != null) {
        logger.err(
          { err, stderr, sourcePath, requestedFormat, destPath },
          'something went wrong converting file'
        )
      } else {
        logger.log(
          { sourcePath, requestedFormat, destPath },
          'finished converting file'
        )
      }
      return callback(err, destPath)
    })
  },

  thumbnail(sourcePath, callback) {
    const destPath = `${sourcePath}.png`
    sourcePath = `${sourcePath}[0]`
    const width = '260x'
    let command = [
      'convert',
      '-flatten',
      '-background',
      'white',
      '-density',
      '300',
      '-define',
      `pdf:fit-page=${width}`,
      sourcePath,
      '-resize',
      width,
      destPath
    ]
    logger.log({ sourcePath, destPath, command }, 'thumbnail convert file')
    command = Settings.commands.convertCommandPrefix.concat(command)
    return safe_exec(command, childProcessOpts, function(err, stdout, stderr) {
      if (err != null) {
        logger.err(
          { err, stderr, sourcePath },
          'something went wrong converting file to thumbnail'
        )
      } else {
        logger.log({ sourcePath, destPath }, 'finished thumbnailing file')
      }
      return callback(err, destPath)
    })
  },

  preview(sourcePath, callback) {
    logger.log({ sourcePath }, 'preview convert file')
    const destPath = `${sourcePath}.png`
    sourcePath = `${sourcePath}[0]`
    const width = '548x'
    let command = [
      'convert',
      '-flatten',
      '-background',
      'white',
      '-density',
      '300',
      '-define',
      `pdf:fit-page=${width}`,
      sourcePath,
      '-resize',
      width,
      destPath
    ]
    command = Settings.commands.convertCommandPrefix.concat(command)
    return safe_exec(command, childProcessOpts, function(err, stdout, stderr) {
      if (err != null) {
        logger.err(
          { err, stderr, sourcePath, destPath },
          'something went wrong converting file to preview'
        )
      } else {
        logger.log(
          { sourcePath, destPath },
          'finished converting file to preview'
        )
      }
      return callback(err, destPath)
    })
  }
}
