const fs = require('fs')
const uuid = require('node-uuid')
const path = require('path')
const Stream = require('stream')
const { callbackify, promisify } = require('util')
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

  const writeStream = fs.createWriteStream(fsPath)
  try {
    await pipeline(stream, writeStream)
    timer.done()
    return fsPath
  } catch (err) {
    await deleteFile(fsPath)

    throw new WriteError('problem writing file locally', {
      err,
      fsPath
    }).withCause(err)
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
      throw new WriteError('failed to delete file', { fsPath }).withCause(err)
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
