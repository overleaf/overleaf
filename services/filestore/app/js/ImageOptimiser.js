import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'
import { callbackify } from 'node:util'
import SafeExec from './SafeExec.js'

export default {
  compressPng: callbackify(compressPng),
  promises: {
    compressPng,
  },
}

async function compressPng(localPath, callback) {
  const timer = new metrics.Timer('compressPng')
  const args = ['optipng', localPath]
  const opts = {
    timeout: 30 * 1000,
    killSignal: 'SIGKILL',
  }

  try {
    await SafeExec.promises(args, opts)
    timer.done()
  } catch (err) {
    if (err.code === 'SIGKILL') {
      logger.warn(
        { err, stderr: err.stderr, localPath },
        'optimiser timeout reached'
      )
    } else {
      throw err
    }
  }
}
