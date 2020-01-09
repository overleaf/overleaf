const fs = require('fs')
const uuid = require('node-uuid')
const path = require('path')
const Stream = require('stream')
const { callbackify, promisify } = require('util')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const Settings = require('settings-sharelatex')
const { WriteError } = require('./Errors')

module.exports = {
  promises: {
    writeStream,
    deleteFile
  },
  writeStream: callbackify(writeStream),
  deleteFile: callbackify(deleteFile)
}

const pipeline = promisify(Stream.pipeline)

async function writeStream(stream, key) {
  const timer = new metrics.Timer('writingFile')
  const fsPath = _getPath(key)

  logger.log({ fsPath }, 'writing file locally')

  const writeStream = fs.createWriteStream(fsPath)
  try {
    await pipeline(stream, writeStream)
    timer.done()
    logger.log({ fsPath }, 'finished writing file locally')
    return fsPath
  } catch (err) {
    await deleteFile(fsPath)

    logger.err({ err, fsPath }, 'problem writing file locally')
    throw new WriteError({
      message: 'problem writing file locally',
      info: { err, fsPath }
    }).withCause(err)
  }
}

async function deleteFile(fsPath) {
  if (!fsPath) {
    return
  }
  logger.log({ fsPath }, 'removing local temp file')
  try {
    await promisify(fs.unlink)(fsPath)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new WriteError({
        message: 'failed to delete file',
        info: { fsPath }
      }).withCause(err)
    }
  }
}

function _getPath(key) {
  if (key == null) {
    key = uuid.v1()
  }
  key = key.replace(/\//g, '-')
  return path.join(Settings.path.uploadFolder, key)
}
