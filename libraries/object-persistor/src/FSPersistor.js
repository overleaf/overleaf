const fs = require('fs')
const glob = require('glob')
const uuid = require('node-uuid')
const path = require('path')
const Stream = require('stream')
const { promisify } = require('util')

const AbstractPersistor = require('./AbstractPersistor')
const { NotFoundError, ReadError, WriteError } = require('./Errors')
const PersistorHelper = require('./PersistorHelper')

const pipeline = promisify(Stream.pipeline)
const fsUnlink = promisify(fs.unlink)
const fsOpen = promisify(fs.open)
const fsStat = promisify(fs.stat)
const fsGlob = promisify(glob)

const filterName = (key) => key.replace(/\//g, '_')

module.exports = class FSPersistor extends AbstractPersistor {
  constructor(settings) {
    super()

    this.settings = settings
  }

  async sendFile(location, target, source) {
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

  async sendStream(location, target, sourceStream, opts = {}) {
    const fsPath = await this._writeStream(sourceStream)
    let sourceMd5 = opts.sourceMd5
    if (!sourceMd5) {
      sourceMd5 = await FSPersistor._getFileMd5HashForPath(fsPath)
    }

    try {
      await this.sendFile(location, target, fsPath)
      const destMd5 = await this.getObjectMd5Hash(location, target)
      if (sourceMd5 !== destMd5) {
        await this._deleteFile(`${location}/${filterName(target)}`)
        throw new WriteError('md5 hash mismatch', {
          sourceMd5,
          destMd5,
          location,
          target
        })
      }
    } finally {
      await this._deleteFile(fsPath)
    }
  }

  // opts may be {start: Number, end: Number}
  async getObjectStream(location, name, opts) {
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

  async getRedirectUrl() {
    // not implemented
    return null
  }

  async getObjectSize(location, filename) {
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

  async getObjectMd5Hash(location, filename) {
    const fullPath = path.join(location, filterName(filename))
    try {
      return await FSPersistor._getFileMd5HashForPath(fullPath)
    } catch (err) {
      throw new ReadError(
        'unable to get md5 hash from file',
        { location, filename },
        err
      )
    }
  }

  async copyObject(location, fromName, toName) {
    const filteredFromName = filterName(fromName)
    const filteredToName = filterName(toName)

    try {
      const sourceStream = fs.createReadStream(
        `${location}/${filteredFromName}`
      )
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

  async deleteObject(location, name) {
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

  async deleteDirectory(location, name) {
    const filteredName = filterName(name.replace(/\/$/, ''))

    try {
      await Promise.all(
        (
          await fsGlob(`${location}/${filteredName}_*`)
        ).map((file) => fsUnlink(file))
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

  async checkIfObjectExists(location, name) {
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
  async directorySize(location, name) {
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

  _getPath(key) {
    if (key == null) {
      key = uuid.v1()
    }
    key = key.replace(/\//g, '-')
    return path.join(this.settings.paths.uploadFolder, key)
  }

  async _writeStream(stream, key) {
    let timer
    if (this.settings.Metrics) {
      timer = new this.settings.Metrics.Timer('writingFile')
    }
    const fsPath = this._getPath(key)

    const writeStream = fs.createWriteStream(fsPath)
    try {
      await pipeline(stream, writeStream)
      if (timer) {
        timer.done()
      }
      return fsPath
    } catch (err) {
      await this._deleteFile(fsPath)

      throw new WriteError('problem writing file locally', { err, fsPath }, err)
    }
  }

  async _deleteFile(fsPath) {
    if (!fsPath) {
      return
    }
    try {
      await fsUnlink(fsPath)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw new WriteError('failed to delete file', { fsPath }, err)
      }
    }
  }

  static async _getFileMd5HashForPath(fullPath) {
    const stream = fs.createReadStream(fullPath)
    return PersistorHelper.calculateStreamMd5(stream)
  }
}
