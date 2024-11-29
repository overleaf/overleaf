const fs = require('fs')
const Path = require('path')
const isUtf8 = require('utf-8-validate')
const { promisifyAll } = require('@overleaf/promise-utils')
const Settings = require('@overleaf/settings')
const Minimatch = require('minimatch').Minimatch

const fileIgnoreMatcher = new Minimatch(Settings.fileIgnorePattern, {
  nocase: true, // make the whole path matching case-insensitive
  // (previously we were only matching the extension case-insensitively but it seems safer to match the whole path)
  dot: true, // allows matching on paths containing a dot e.g. /.git/foo/bar.txt
})

const FileTypeManager = {
  TEXT_EXTENSIONS: new Set(Settings.textExtensions.map(ext => `.${ext}`)),
  EDITABLE_FILENAMES: Settings.editableFilenames,

  MAX_TEXT_FILE_SIZE: 3 * Settings.max_doc_length, // allow 3 bytes for every character

  isDirectory(path, callback) {
    fs.stat(path, (error, stats) => {
      if (error != null) {
        return callback(error)
      }
      callback(null, stats.isDirectory())
    })
  },

  // returns charset as understood by fs.readFile,
  getType(name, fsPath, existingFileType, callback) {
    if (!name) {
      return callback(
        new Error(
          '[FileTypeManager] getType requires a non-null "name" parameter'
        )
      )
    }
    if (!fsPath) {
      return callback(
        new Error(
          '[FileTypeManager] getType requires a non-null "fsPath" parameter'
        )
      )
    }
    const basename = Path.basename(name)
    if (existingFileType !== 'doc' && !_isTextFilename(basename)) {
      return callback(null, { binary: true })
    }

    fs.stat(fsPath, (err, stat) => {
      if (err != null) {
        return callback(err)
      }
      if (stat.size > FileTypeManager.MAX_TEXT_FILE_SIZE) {
        return callback(null, { binary: true }) // Treat large text file as binary
      }

      fs.readFile(fsPath, (err, bytes) => {
        if (err != null) {
          return callback(err)
        }
        const encoding = _detectEncoding(bytes)
        const text = bytes.toString(encoding)
        if (text.length >= Settings.max_doc_length) {
          return callback(null, { binary: true }) // Treat large text file as binary
        }
        // For compatibility with the history service, only accept valid utf8 with no
        // nulls or non-BMP characters as text, eveything else is binary.
        if (text.includes('\x00')) {
          return callback(null, { binary: true })
        }
        if (/[\uD800-\uDFFF]/.test(text)) {
          // non-BMP characters (high and low surrogate characters)
          return callback(null, { binary: true })
        }
        callback(null, { binary: false, encoding })
      })
    })
  },

  // FIXME: we can convert this to a synchronous function if we want to
  shouldIgnore(path, callback) {
    // use minimatch file matching to check if the path should be ignored
    const ignore = fileIgnoreMatcher.match(path)
    callback(null, ignore)
  },
}

function _isTextFilename(filename) {
  const extension = Path.extname(filename).toLowerCase()
  return (
    FileTypeManager.TEXT_EXTENSIONS.has(extension) ||
    FileTypeManager.EDITABLE_FILENAMES.includes(filename.toLowerCase())
  )
}

function _detectEncoding(bytes) {
  if (isUtf8(bytes)) {
    return 'utf-8'
  }
  // check for little-endian unicode bom (nodejs does not support big-endian)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return 'utf-16le'
  }
  return 'latin1'
}

module.exports = FileTypeManager
module.exports.promises = promisifyAll(FileTypeManager, {
  without: ['getStrictTypeFromContent'],
})
