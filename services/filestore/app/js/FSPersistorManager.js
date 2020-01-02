const fs = require('fs')
const logger = require('logger-sharelatex')
const path = require('path')
const rimraf = require('rimraf')
const Stream = require('stream')
const { promisify, callbackify } = require('util')

const LocalFileWriter = require('./LocalFileWriter').promises
const { NotFoundError, ReadError } = require('./Errors')

const pipeline = promisify(Stream.pipeline)
const fsUnlink = promisify(fs.unlink)
const fsOpen = promisify(fs.open)
const fsStat = promisify(fs.stat)
const fsReaddir = promisify(fs.readdir)
const rmrf = promisify(rimraf)

const filterName = key => key.replace(/\//g, '_')

async function sendFile(location, target, source) {
  const filteredTarget = filterName(target)
  logger.log({ location, target: filteredTarget, source }, 'sending file')

  // actually copy the file (instead of moving it) to maintain consistent behaviour
  // between the different implementations
  const sourceStream = fs.createReadStream(source)
  const targetStream = fs.createWriteStream(`${location}/${filteredTarget}`)
  await pipeline(sourceStream, targetStream)
}

async function sendStream(location, target, sourceStream) {
  logger.log({ location, target }, 'sending file stream')

  let fsPath
  try {
    fsPath = await LocalFileWriter.writeStream(sourceStream)
    await sendFile(location, target, fsPath)
  } finally {
    await LocalFileWriter.deleteFile(fsPath)
  }
}

// opts may be {start: Number, end: Number}
async function getFileStream(location, name, opts) {
  const filteredName = filterName(name)
  logger.log({ location, filteredName }, 'getting file')

  try {
    opts.fd = await fsOpen(`${location}/${filteredName}`, 'r')
  } catch (err) {
    logger.err({ err, location, filteredName: name }, 'Error reading from file')

    if (err.code === 'ENOENT') {
      throw new NotFoundError({
        message: 'file not found',
        info: {
          location,
          filteredName
        }
      }).withCause(err)
    }
    throw new ReadError('failed to open file for streaming').withCause(err)
  }

  return fs.createReadStream(null, opts)
}

async function getFileSize(location, filename) {
  const fullPath = path.join(location, filterName(filename))

  try {
    const stat = await fsStat(fullPath)
    return stat.size
  } catch (err) {
    logger.err({ err, location, filename }, 'failed to stat file')

    if (err.code === 'ENOENT') {
      throw new NotFoundError({
        message: 'file not found',
        info: {
          location,
          fullPath
        }
      }).withCause(err)
    }
    throw new ReadError('failed to stat file').withCause(err)
  }
}

async function copyFile(location, fromName, toName) {
  const filteredFromName = filterName(fromName)
  const filteredToName = filterName(toName)
  logger.log({ location, filteredFromName, filteredToName }, 'copying file')

  const sourceStream = fs.createReadStream(`${location}/${filteredFromName}`)
  const targetStream = fs.createWriteStream(`${location}/${filteredToName}`)
  await pipeline(sourceStream, targetStream)
}

async function deleteFile(location, name) {
  const filteredName = filterName(name)
  logger.log({ location, filteredName }, 'delete file')
  await fsUnlink(`${location}/${filteredName}`)
}

async function deleteDirectory(location, name) {
  const filteredName = filterName(name.replace(/\/$/, ''))

  logger.log({ location, filteredName }, 'deleting directory')

  await rmrf(`${location}/${filteredName}`)
}

async function checkIfFileExists(location, name) {
  const filteredName = filterName(name)
  try {
    const stat = await fsStat(`${location}/${filteredName}`)
    return !!stat
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false
    }
    throw new ReadError('failed to stat file').withCause(err)
  }
}

// note, does not recurse into subdirectories
async function directorySize(location, name) {
  const filteredName = filterName(name.replace(/\/$/, ''))
  let size = 0

  try {
    const files = await fsReaddir(`${location}/${filteredName}`)
    for (const file of files) {
      const stat = await fsStat(`${location}/${filteredName}/${file}`)
      size += stat.size
    }
  } catch (err) {
    throw new ReadError({
      message: 'failed to get directory size',
      info: { location, name }
    }).withCause(err)
  }

  return size
}

module.exports = {
  sendFile: callbackify(sendFile),
  sendStream: callbackify(sendStream),
  getFileStream: callbackify(getFileStream),
  getFileSize: callbackify(getFileSize),
  copyFile: callbackify(copyFile),
  deleteFile: callbackify(deleteFile),
  deleteDirectory: callbackify(deleteDirectory),
  checkIfFileExists: callbackify(checkIfFileExists),
  directorySize: callbackify(directorySize),
  promises: {
    sendFile,
    sendStream,
    getFileStream,
    getFileSize,
    copyFile,
    deleteFile,
    deleteDirectory,
    checkIfFileExists,
    directorySize
  }
}
