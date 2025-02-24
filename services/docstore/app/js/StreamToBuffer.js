const { LoggerStream, WritableBuffer } = require('@overleaf/stream-utils')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger/logging-manager')
const { pipeline } = require('node:stream/promises')
const { callbackify } = require('node:util')

module.exports = {
  streamToBuffer: callbackify(streamToBuffer),
  promises: {
    streamToBuffer,
  },
}

async function streamToBuffer(projectId, docId, stream) {
  const loggerTransform = new LoggerStream(
    Settings.max_doc_length,
    (size, isFlush) => {
      logger.warn(
        { projectId, docId, size, finishedReading: isFlush },
        'potentially large doc pulled down from gcs'
      )
    }
  )

  const buffer = new WritableBuffer()
  await pipeline(stream, loggerTransform, buffer)
  return buffer.contents()
}
