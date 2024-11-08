const fs = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path')
const Stream = require('node:stream')
const { callbackify, promisify } = require('node:util')
const metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const { WriteError } = require('./Errors')

module.exports = {
  promises: {
    writeStream,
    deleteFile,
  },
  writeStream: callbackify(writeStream),
  deleteFile: callbackify(deleteFile),
}

const pipeline = promisify(Stream.pipeline)

async function writeStream(stream, key) {
  const timer = new metrics.Timer('writingFile')
  const fsPath = _getPath(key)

  const writeStream = fs.createWriteStream(fsPath)
  try {
    await pipeline(stream, writeStream)
    timer.done()
    return fsPath
  } catch (err) {
    await deleteFile(fsPath)

    throw new WriteError('problem writing file locally', { fsPath }, err)
  }
}

async function deleteFile(fsPath) {
  if (!fsPath) {
    return
  }
  try {
    await promisify(fs.unlink)(fsPath)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new WriteError('failed to delete file', { fsPath }, err)
    }
  }
}

function _getPath(key) {
  if (key == null) {
    key = crypto.randomUUID()
  }
  key = key.replace(/\//g, '-')
  return path.join(Settings.path.uploadFolder, key)
}
