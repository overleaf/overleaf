import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import metrics from '@overleaf/metrics'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import Path from 'node:path'
import { pipeline } from 'node:stream'
import { callbackify } from 'node:util'
import yauzl from 'yauzl'
import Settings from '@overleaf/settings'
import {
  InvalidZipFileError,
  EmptyZipFileError,
  ZipContentsTooLargeError,
} from './ArchiveErrors.mjs'
import FileTypeManager from './FileTypeManager.mjs'

const MAX_UNCOMPRESSED_BYTES = 1024 * 1024 * 300 // 300MB

/**
 * Check if a zip entry's file path is safe and return the destination path.
 * Returns null for directory entries.
 * Throws for relative or unnormalized paths.
 */
function _checkFilePath(entry, destination) {
  // transform backslashes to forwardslashes to accommodate badly-behaved zip archives
  const transformedFilename = entry.fileName.replace(/\\/g, '/')
  // check if the entry is a directory
  if (/\/$/.test(transformedFilename)) {
    return null
  }
  // check that the file does not use a relative path
  for (const dir of transformedFilename.split('/')) {
    if (dir === '..') {
      throw new Error('relative path')
    }
  }
  // check that the destination file path is normalized
  const dest = `${destination}/${transformedFilename}`
  if (dest !== Path.normalize(dest)) {
    throw new Error('unnormalized path')
  }
  return dest
}

// Kept callback-based: called from event handler in _extractZipFiles
function _writeFileEntry(zipfile, entry, destFile, callback) {
  fs.mkdir(Path.dirname(destFile), { recursive: true }, err => {
    if (err) return callback(err)
    zipfile.openReadStream(entry, (err, readStream) => {
      if (err) return callback(err)
      const writeStream = fs.createWriteStream(destFile)
      pipeline(readStream, writeStream, callback)
    })
  })
}

function _isZipTooLarge(source) {
  return new Promise((resolve, reject) => {
    let settled = false
    const done = (err, result) => {
      if (settled) return
      settled = true
      if (err) reject(err)
      else resolve(result)
    }

    yauzl.open(source, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        return done(new InvalidZipFileError().withCause(err))
      }

      // Initial rejection of pathological zips without enumerating the central directory.
      // The per-entry check below applies the real limit after filtering out ignored files.
      if (
        Number.isFinite(Settings.maxEntitiesPerProject) &&
        zipfile.entryCount > Settings.maxEntitiesPerProject * 10
      ) {
        zipfile.close()
        return done(null, true)
      }

      let totalSizeInBytes = null
      let projectEntryCount = 0
      zipfile.on('error', err => done(err))

      // read all the entries
      zipfile.readEntry()
      zipfile.on('entry', entry => {
        if (!FileTypeManager.shouldIgnore(entry.fileName)) {
          totalSizeInBytes += entry.uncompressedSize

          if (totalSizeInBytes > MAX_UNCOMPRESSED_BYTES) {
            zipfile.close()
            return done(null, true) // total uncompressed size too large
          }

          projectEntryCount++

          if (
            Number.isFinite(Settings.maxEntitiesPerProject) &&
            projectEntryCount > Settings.maxEntitiesPerProject
          ) {
            zipfile.close()
            return done(null, true) // too many files in zip file
          }
        }

        zipfile.readEntry()
      })

      // no more entries to read
      zipfile.on('end', () => {
        if (!Number.isFinite(totalSizeInBytes)) {
          logger.warn(
            { source, totalSizeInBytes },
            'error getting bytes of zip'
          )
          return done(new InvalidZipFileError({ info: { totalSizeInBytes } }))
        }
        done(null, false)
      })
    })
  })
}

function _extractZipFiles(source, destination) {
  return new Promise((resolve, reject) => {
    let settled = false
    const done = err => {
      if (settled) return
      settled = true
      if (err) reject(err)
      else resolve()
    }

    yauzl.open(source, { lazyEntries: true }, (err, zipfile) => {
      if (err) return done(err)

      zipfile.on('error', err => done(err))
      // read all the entries
      zipfile.readEntry()

      let entryFileCount = 0
      zipfile.on('entry', entry => {
        if (FileTypeManager.shouldIgnore(entry.fileName)) {
          return zipfile.readEntry()
        }

        let destFile
        try {
          destFile = _checkFilePath(entry, destination)
        } catch (err) {
          logger.warn({ err, source, destination }, 'skipping bad file path')
          zipfile.readEntry() // bad path, just skip to the next file
          return
        }
        if (destFile) {
          // only write files
          _writeFileEntry(zipfile, entry, destFile, err => {
            if (err) {
              OError.tag(err, 'error unzipping file entry', {
                source,
                destFile,
              })
              zipfile.close() // bail out, stop reading file entries
              done(new InvalidZipFileError().withCause(err))
            } else {
              entryFileCount++
              zipfile.readEntry() // continue to the next file
            }
          })
        } else {
          // if it's a directory, continue
          zipfile.readEntry()
        }
      })

      // no more entries to read
      zipfile.on('end', () => {
        if (entryFileCount > 0) {
          done()
        } else {
          done(new EmptyZipFileError())
        }
      })
    })
  })
}

async function extractZipArchive(source, destination) {
  let isTooLarge
  try {
    isTooLarge = await ArchiveManager._isZipTooLarge(source)
  } catch (err) {
    OError.tag(err, 'error checking size of zip file')
    throw err
  }

  if (isTooLarge) {
    throw new ZipContentsTooLargeError()
  }

  const timer = new metrics.Timer('unzipDirectory')
  logger.debug({ source, destination }, 'unzipping file')
  try {
    await _extractZipFiles(source, destination)
  } catch (err) {
    OError.tag(err, 'unzip failed', { source, destination })
    throw err
  } finally {
    timer.done()
  }
}

async function findTopLevelDirectory(directory) {
  const files = await fsPromises.readdir(directory)
  if (files.length === 1) {
    const childPath = Path.join(directory, files[0])
    const stat = await fsPromises.stat(childPath)
    if (stat.isDirectory()) {
      return childPath
    }
  }
  return directory
}

const ArchiveManager = {
  _isZipTooLarge,
  extractZipArchive: callbackify(extractZipArchive),
  findTopLevelDirectory: callbackify(findTopLevelDirectory),
  promises: {
    extractZipArchive,
    findTopLevelDirectory,
  },
}

export default ArchiveManager
