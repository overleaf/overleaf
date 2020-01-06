const fs = require('fs')
const glob = require('glob')
const logger = require('logger-sharelatex')
const path = require('path')
const rimraf = require('rimraf')
const Stream = require('stream')
const { promisify, callbackify } = require('util')

const LocalFileWriter = require('./LocalFileWriter').promises
const { NotFoundError, ReadError, WriteError } = require('./Errors')

const pipeline = promisify(Stream.pipeline)
const fsUnlink = promisify(fs.unlink)
const fsOpen = promisify(fs.open)
const fsStat = promisify(fs.stat)
const fsGlob = promisify(glob)
const rmrf = promisify(rimraf)

const filterName = key => key.replace(/\//g, '_')

async function sendFile(location, target, source) {
  const filteredTarget = filterName(target)
  logger.log({ location, target: filteredTarget, source }, 'sending file')

  // actually copy the file (instead of moving it) to maintain consistent behaviour
  // between the different implementations
  try {
    const sourceStream = fs.createReadStream(source)
    const targetStream = fs.createWriteStream(`${location}/${filteredTarget}`)
    await pipeline(sourceStream, targetStream)
  } catch (err) {
    throw _wrapError(
      err,
      'failed to copy the specified file',
      { location, target, source },
      WriteError
    )
  }
}

async function sendStream(location, target, sourceStream) {
  logger.log({ location, target }, 'sending file stream')

  const fsPath = await LocalFileWriter.writeStream(sourceStream)

  try {
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

    throw _wrapError(
      err,
      'failed to open file for streaming',
      { location, filteredName, opts },
      ReadError
    )
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

    throw _wrapError(
      err,
      'failed to stat file',
      { location, filename },
      ReadError
    )
  }
}

async function copyFile(location, fromName, toName) {
  const filteredFromName = filterName(fromName)
  const filteredToName = filterName(toName)
  logger.log({ location, filteredFromName, filteredToName }, 'copying file')

  try {
    const sourceStream = fs.createReadStream(`${location}/${filteredFromName}`)
    const targetStream = fs.createWriteStream(`${location}/${filteredToName}`)
    await pipeline(sourceStream, targetStream)
  } catch (err) {
    throw _wrapError(
      err,
      'failed to copy file',
      { location, filteredFromName, filteredToName },
      WriteError
    )
  }
}

async function deleteFile(location, name) {
  const filteredName = filterName(name)
  logger.log({ location, filteredName }, 'delete file')
  try {
    await fsUnlink(`${location}/${filteredName}`)
  } catch (err) {
    throw _wrapError(
      err,
      'failed to delete file',
      { location, filteredName },
      WriteError
    )
  }
}

async function deleteDirectory(location, name) {
  const filteredName = filterName(name.replace(/\/$/, ''))

  logger.log({ location, filteredName }, 'deleting directory')

  try {
    await rmrf(`${location}/${filteredName}`)
  } catch (err) {
    throw _wrapError(
      err,
      'failed to delete directory',
      { location, filteredName },
      WriteError
    )
  }
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
    throw _wrapError(
      err,
      'failed to stat file',
      { location, filteredName },
      ReadError
    )
  }
}

// note, does not recurse into subdirectories, as we use a flattened directory structure
async function directorySize(location, name) {
  const filteredName = filterName(name.replace(/\/$/, ''))
  let size = 0

  try {
    const files = await fsGlob(`${location}/${filteredName}_*`)
    for (const file of files) {
      try {
        const stat = await fsStat(file)
        if (stat.isFile()) {
          size += stat.size
        }
      } catch (err) {
        // ignore files that may have just been deleted
        if (err.code !== 'ENOENT') {
          throw err
        }
      }
    }
  } catch (err) {
    throw _wrapError(
      err,
      'failed to get directory size',
      { location, name },
      ReadError
    )
  }

  return size
}

function _wrapError(error, message, params, ErrorType) {
  if (error.code === 'ENOENT') {
    return new NotFoundError({
      message: 'no such file or directory',
      info: params
    }).withCause(error)
  } else {
    return new ErrorType({
      message: message,
      info: params
    }).withCause(error)
  }
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
