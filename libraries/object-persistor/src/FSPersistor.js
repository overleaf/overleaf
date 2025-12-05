const crypto = require('node:crypto')
const fs = require('node:fs')
const fsPromises = require('node:fs/promises')
const { glob } = require('glob')
const Path = require('node:path')
const { PassThrough } = require('node:stream')
const { pipeline } = require('node:stream/promises')

const AbstractPersistor = require('./AbstractPersistor')
const { ReadError, WriteError, NotImplementedError } = require('./Errors')
const PersistorHelper = require('./PersistorHelper')

module.exports = class FSPersistor extends AbstractPersistor {
  constructor(settings = {}) {
    if (settings.storageClass) {
      throw new NotImplementedError(
        'FS backend does not support storage classes'
      )
    }

    super()
    this.useSubdirectories = Boolean(settings.useSubdirectories)
  }

  async sendFile(location, target, source) {
    // actually copy the file (instead of moving it) to maintain consistent behaviour
    // between the different implementations
    try {
      const sourceStream = fs.createReadStream(source)
      await this.sendStream(location, target, sourceStream)
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
    if (opts.ifNoneMatch === '*') {
      // The standard library only has fs.rename(), which does not support exclusive flags.
      // Refuse to act on this write operation.
      throw new NotImplementedError(
        'Overwrite protection required by caller, but it is not available is FS backend. Configure GCS or S3 backend instead, get in touch with support for further information.'
      )
    }

    const targetPath = this._getFsPath(location, target)

    try {
      await this._ensureDirectoryExists(targetPath)
      const tempFilePath = await this._writeStreamToTempFile(
        location,
        sourceStream,
        opts
      )

      try {
        await fsPromises.rename(tempFilePath, targetPath)
      } finally {
        await this._cleanupTempFile(tempFilePath)
      }
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'failed to write stream',
        { location, target, ifNoneMatch: opts.ifNoneMatch },
        WriteError
      )
    }
  }

  // opts may be {start: Number, end: Number}
  async getObjectStream(location, name, opts = {}) {
    if (opts.autoGunzip) {
      throw new NotImplementedError(
        'opts.autoGunzip is not supported by FS backend. Configure GCS or S3 backend instead, get in touch with support for further information.'
      )
    }
    const observer = new PersistorHelper.ObserverStream({
      metric: 'fs.ingress', // ingress to us from disk
      bucket: location,
    })
    const fsPath = this._getFsPath(location, name, opts.useSubdirectories)

    try {
      opts.fd = await fsPromises.open(fsPath, 'r')
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'failed to open file for streaming',
        { location, name, fsPath, opts },
        ReadError
      )
    }

    const stream = fs.createReadStream(null, opts)
    // Return a PassThrough stream with a minimal interface. It will buffer until the caller starts reading. It will emit errors from the source stream (Stream.pipeline passes errors along).
    const pass = new PassThrough()
    pipeline(stream, observer, pass).catch(() => {})
    return pass
  }

  async getRedirectUrl() {
    // not implemented
    return null
  }

  async getObjectSize(location, filename) {
    const fsPath = this._getFsPath(location, filename)

    try {
      const stat = await fsPromises.stat(fsPath)
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
    const fsPath = this._getFsPath(location, filename)
    try {
      const stream = fs.createReadStream(fsPath)
      const hash = await PersistorHelper.calculateStreamMd5(stream)
      return hash
    } catch (err) {
      throw new ReadError(
        'unable to get md5 hash from file',
        { location, filename },
        err
      )
    }
  }

  async copyObject(location, source, target) {
    const sourceFsPath = this._getFsPath(location, source)
    const targetFsPath = this._getFsPath(location, target)

    try {
      await this._ensureDirectoryExists(targetFsPath)
      await fsPromises.copyFile(sourceFsPath, targetFsPath)
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'failed to copy file',
        { location, source, target, sourceFsPath, targetFsPath },
        WriteError
      )
    }
  }

  async deleteObject(location, name) {
    const fsPath = this._getFsPath(location, name)
    try {
      // S3 doesn't give us a 404 when a file wasn't there to be deleted, so we
      // should be consistent here as well
      await fsPromises.rm(fsPath, { force: true })
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'failed to delete file',
        { location, name, fsPath },
        WriteError
      )
    }
  }

  async deleteDirectory(location, name) {
    const fsPath = this._getFsPath(location, name)

    try {
      if (this.useSubdirectories) {
        await fsPromises.rm(fsPath, { recursive: true, force: true })
      } else {
        const files = await this._listDirectory(fsPath)
        for (const file of files) {
          await fsPromises.rm(file, { force: true })
        }
      }
    } catch (err) {
      throw PersistorHelper.wrapError(
        err,
        'failed to delete directory',
        { location, name, fsPath },
        WriteError
      )
    }
  }

  async listDirectoryKeys(location, name) {
    const fsPath = this._getFsPath(location, name)
    const paths = await this._listDirectory(fsPath)

    // Filter to only return files, not directories
    const files = []
    for (const path of paths) {
      try {
        const stat = await fsPromises.stat(path)
        if (stat.isFile()) {
          files.push(path)
        }
      } catch (err) {
        // ignore files that may have just been deleted
        if (err.code !== 'ENOENT') {
          throw err
        }
      }
    }
    return files
  }

  async listDirectoryStats(location, name) {
    const fsPath = this._getFsPath(location, name)
    const paths = await this._listDirectory(fsPath)

    // Filter to only return files, not directories, with their sizes
    const stats = []
    for (const path of paths) {
      try {
        const stat = await fsPromises.stat(path)
        if (stat.isFile()) {
          stats.push({ key: path, size: stat.size })
        }
      } catch (err) {
        // ignore files that may have just been deleted
        if (err.code !== 'ENOENT') {
          throw err
        }
      }
    }
    return stats
  }

  async checkIfObjectExists(location, name) {
    const fsPath = this._getFsPath(location, name)
    try {
      const stat = await fsPromises.stat(fsPath)
      return !!stat
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false
      }
      throw PersistorHelper.wrapError(
        err,
        'failed to stat file',
        { location, name, fsPath },
        ReadError
      )
    }
  }

  // note, does not recurse into subdirectories, as we use a flattened directory structure
  async directorySize(location, name) {
    const fsPath = this._getFsPath(location, name)
    let size = 0

    try {
      const files = await this._listDirectory(fsPath)
      for (const file of files) {
        try {
          const stat = await fsPromises.stat(file)
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

  async _writeStreamToTempFile(location, stream, opts = {}) {
    const observerOptions = {
      metric: 'fs.egress', // egress from us to disk
      bucket: location,
    }
    const observer = new PersistorHelper.ObserverStream(observerOptions)

    const tempDirPath = await fsPromises.mkdtemp(Path.join(location, 'tmp-'))
    const tempFilePath = Path.join(tempDirPath, 'uploaded-file')

    const transforms = [observer]
    let md5Observer
    if (opts.sourceMd5) {
      md5Observer = createMd5Observer()
      transforms.push(md5Observer.transform)
    }

    try {
      const writeStream = fs.createWriteStream(tempFilePath)
      await pipeline(stream, ...transforms, writeStream)
    } catch (err) {
      await this._cleanupTempFile(tempFilePath)
      throw new WriteError(
        'problem writing temp file locally',
        { tempFilePath },
        err
      )
    }

    if (opts.sourceMd5) {
      const actualMd5 = md5Observer.hash.digest('hex')
      if (actualMd5 !== opts.sourceMd5) {
        await this._cleanupTempFile(tempFilePath)
        throw new WriteError('md5 hash mismatch', {
          expectedMd5: opts.sourceMd5,
          actualMd5,
        })
      }
    }

    return tempFilePath
  }

  async _cleanupTempFile(tempFilePath) {
    const dirPath = Path.dirname(tempFilePath)
    await fsPromises.rm(dirPath, { force: true, recursive: true })
  }

  _getFsPath(location, key, useSubdirectories = false) {
    key = key.replace(/\/$/, '')
    if (!this.useSubdirectories && !useSubdirectories) {
      key = key.replace(/\//g, '_')
    }
    return Path.join(location, key)
  }

  async _listDirectory(path) {
    if (this.useSubdirectories) {
      return await glob(Path.join(path, '**'))
    } else {
      return await glob(`${path}_*`)
    }
  }

  async _ensureDirectoryExists(path) {
    await fsPromises.mkdir(Path.dirname(path), { recursive: true })
  }
}

function createMd5Observer() {
  const hash = crypto.createHash('md5')

  async function* transform(chunks) {
    for await (const chunk of chunks) {
      hash.update(chunk)
      yield chunk
    }
  }

  return { hash, transform }
}
