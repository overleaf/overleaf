const fs = require('fs')
const glob = require('glob')
const path = require('path')
const Stream = require('stream')
const { promisify, callbackify } = require('util')

const LocalFileWriter = require('./LocalFileWriter').promises
const { NotFoundError, ReadError, WriteError } = require('./Errors')
const PersistorHelper = require('./PersistorHelper')

const pipeline = promisify(Stream.pipeline)
const fsUnlink = promisify(fs.unlink)
const fsOpen = promisify(fs.open)
const fsStat = promisify(fs.stat)
const fsGlob = promisify(glob)

const filterName = key => key.replace(/\//g, '_')

async function sendFile(location, target, source) {
  const filteredTarget = filterName(target)

  // actually copy the file (instead of moving it) to maintain consistent behaviour
  // between the different implementations
  try {
    const sourceStream = fs.createReadStream(source)
    const targetStream = fs.createWriteStream(`${location}/${filteredTarget}`)
    await pipeline(sourceStream, targetStream)
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'failed to copy the specified file',
      { location, target, source },
      WriteError
    )
  }
}

async function sendStream(location, target, sourceStream, sourceMd5) {
  const fsPath = await LocalFileWriter.writeStream(sourceStream)
  if (!sourceMd5) {
    sourceMd5 = await _getFileMd5HashForPath(fsPath)
  }

  try {
    await sendFile(location, target, fsPath)
    const destMd5 = await getFileMd5Hash(location, target)
    if (sourceMd5 !== destMd5) {
      await LocalFileWriter.deleteFile(`${location}/${filterName(target)}`)
      throw new WriteError({
        message: 'md5 hash mismatch',
        info: { sourceMd5, destMd5, location, target }
      })
    }
  } finally {
    await LocalFileWriter.deleteFile(fsPath)
  }
}

// opts may be {start: Number, end: Number}
async function getFileStream(location, name, opts) {
  const filteredName = filterName(name)

  try {
    opts.fd = await fsOpen(`${location}/${filteredName}`, 'r')
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'failed to open file for streaming',
      { location, filteredName, opts },
      ReadError
    )
  }

  return fs.createReadStream(null, opts)
}

async function getRedirectUrl() {
  // not implemented
  return null
}

async function getFileSize(location, filename) {
  const fullPath = path.join(location, filterName(filename))

  try {
    const stat = await fsStat(fullPath)
    return stat.size
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'failed to stat file',
      { location, filename },
      ReadError
    )
  }
}

async function getFileMd5Hash(location, filename) {
  const fullPath = path.join(location, filterName(filename))
  try {
    return await _getFileMd5HashForPath(fullPath)
  } catch (err) {
    throw new ReadError({
      message: 'unable to get md5 hash from file',
      info: { location, filename }
    }).withCause(err)
  }
}

async function copyFile(location, fromName, toName) {
  const filteredFromName = filterName(fromName)
  const filteredToName = filterName(toName)

  try {
    const sourceStream = fs.createReadStream(`${location}/${filteredFromName}`)
    const targetStream = fs.createWriteStream(`${location}/${filteredToName}`)
    await pipeline(sourceStream, targetStream)
  } catch (err) {
    throw PersistorHelper.wrapError(
      err,
      'failed to copy file',
      { location, filteredFromName, filteredToName },
      WriteError
    )
  }
}

async function deleteFile(location, name) {
  const filteredName = filterName(name)
  try {
    await fsUnlink(`${location}/${filteredName}`)
  } catch (err) {
    const wrappedError = PersistorHelper.wrapError(
      err,
      'failed to delete file',
      { location, filteredName },
      WriteError
    )
    if (!(wrappedError instanceof NotFoundError)) {
      // S3 doesn't give us a 404 when a file wasn't there to be deleted, so we
      // should be consistent here as well
      throw wrappedError
    }
  }
}

// this is only called internally for clean-up by `FileHandler` and isn't part of the external API
async function deleteDirectory(location, name) {
  const filteredName = filterName(name.replace(/\/$/, ''))

  try {
    await Promise.all(
      (await fsGlob(`${location}/${filteredName}*`)).map(file => fsUnlink(file))
    )
  } catch (err) {
    throw PersistorHelper.wrapError(
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
    throw PersistorHelper.wrapError(
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
    throw PersistorHelper.wrapError(
      err,
      'failed to get directory size',
      { location, name },
      ReadError
    )
  }

  return size
}

module.exports = {
  sendFile: callbackify(sendFile),
  sendStream: callbackify(sendStream),
  getFileStream: callbackify(getFileStream),
  getRedirectUrl: callbackify(getRedirectUrl),
  getFileSize: callbackify(getFileSize),
  getFileMd5Hash: callbackify(getFileMd5Hash),
  copyFile: callbackify(copyFile),
  deleteFile: callbackify(deleteFile),
  deleteDirectory: callbackify(deleteDirectory),
  checkIfFileExists: callbackify(checkIfFileExists),
  directorySize: callbackify(directorySize),
  promises: {
    sendFile,
    sendStream,
    getFileStream,
    getRedirectUrl,
    getFileSize,
    getFileMd5Hash,
    copyFile,
    deleteFile,
    deleteDirectory,
    checkIfFileExists,
    directorySize
  }
}

async function _getFileMd5HashForPath(fullPath) {
  const stream = fs.createReadStream(fullPath)
  return PersistorHelper.calculateStreamMd5(stream)
}
