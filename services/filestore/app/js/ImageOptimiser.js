const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const { callbackify } = require('util')
const safeExec = require('./SafeExec').promises

module.exports = {
  compressPng: callbackify(compressPng),
  promises: {
    compressPng
  }
}

async function compressPng(localPath, callback) {
  const timer = new metrics.Timer('compressPng')
  logger.log({ localPath }, 'optimising png path')

  const args = ['optipng', localPath]
  const opts = {
    timeout: 30 * 1000,
    killSignal: 'SIGKILL'
  }

  try {
    await safeExec(args, opts)
    timer.done()
    logger.log({ localPath }, 'finished compressing png')
  } catch (err) {
    if (err.code === 'SIGKILL') {
      logger.warn(
        { err, stderr: err.stderr, localPath },
        'optimiser timeout reached'
      )
    } else {
      logger.err(
        { err, stderr: err.stderr, localPath },
        'something went wrong compressing png'
      )
      throw err
    }
  }
}
