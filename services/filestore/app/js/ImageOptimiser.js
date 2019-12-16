/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { exec } = require('child_process')
const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')

module.exports = {
  compressPng(localPath, callback) {
    const startTime = new Date()
    logger.log({ localPath }, 'optimising png path')
    const args = `optipng ${localPath}`
    const opts = {
      timeout: 30 * 1000,
      killSignal: 'SIGKILL'
    }
    if (!Settings.enableConversions) {
      const error = new Error('Image conversions are disabled')
      return callback(error)
    }
    return exec(args, opts, function(err, stdout, stderr) {
      if (err != null && err.signal === 'SIGKILL') {
        logger.warn({ err, stderr, localPath }, 'optimiser timeout reached')
        err = null
      } else if (err != null) {
        logger.err(
          { err, stderr, localPath },
          'something went wrong converting compressPng'
        )
      } else {
        logger.log({ localPath }, 'finished compressPng file')
      }
      return callback(err)
    })
  }
}
