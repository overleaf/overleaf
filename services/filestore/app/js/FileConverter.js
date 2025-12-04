import metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import { callbackify } from 'node:util'
import SafeExec from './SafeExec.js'
import Errors from './Errors.js'

const { ConversionError } = Errors

const APPROVED_FORMATS = ['png']
const FOURTY_SECONDS = 40 * 1000
const KILL_SIGNAL = 'SIGTERM'

export default {
  convert: callbackify(convert),
  thumbnail: callbackify(thumbnail),
  preview: callbackify(preview),
  promises: {
    convert,
    thumbnail,
    preview,
  },
}

async function convert(sourcePath, requestedFormat) {
  const width = '600x'
  return await _convert(sourcePath, requestedFormat, [
    'convert',
    '-define',
    `pdf:fit-page=${width}`,
    '-flatten',
    '-density',
    '300',
    `${sourcePath}[0]`,
  ])
}

async function thumbnail(sourcePath) {
  const width = '260x'
  return await convert(sourcePath, 'png', [
    'convert',
    '-flatten',
    '-background',
    'white',
    '-density',
    '300',
    '-define',
    `pdf:fit-page=${width}`,
    `${sourcePath}[0]`,
    '-resize',
    width,
  ])
}

async function preview(sourcePath) {
  const width = '548x'
  return await convert(sourcePath, 'png', [
    'convert',
    '-flatten',
    '-background',
    'white',
    '-density',
    '300',
    '-define',
    `pdf:fit-page=${width}`,
    `${sourcePath}[0]`,
    '-resize',
    width,
  ])
}

async function _convert(sourcePath, requestedFormat, command) {
  if (!APPROVED_FORMATS.includes(requestedFormat)) {
    throw new ConversionError('invalid format requested', {
      format: requestedFormat,
    })
  }

  const timer = new metrics.Timer('imageConvert')
  const destPath = `${sourcePath}.${requestedFormat}`

  command.push(destPath)
  command = Settings.commands.convertCommandPrefix.concat(command)

  try {
    await SafeExec.promises(command, {
      killSignal: KILL_SIGNAL,
      timeout: FOURTY_SECONDS,
    })
  } catch (err) {
    throw new ConversionError(
      'something went wrong converting file',
      { stderr: err.stderr, sourcePath, requestedFormat, destPath },
      err
    )
  }

  timer.done()
  return destPath
}
