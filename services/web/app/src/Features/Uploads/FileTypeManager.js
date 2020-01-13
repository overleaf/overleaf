const fs = require('fs')
const Path = require('path')
const isUtf8 = require('utf-8-validate')

const FileTypeManager = {
  TEXT_EXTENSIONS: [
    '.tex',
    '.latex',
    '.sty',
    '.cls',
    '.bst',
    '.bib',
    '.bibtex',
    '.txt',
    '.tikz',
    '.rtex',
    '.md',
    '.asy',
    '.latexmkrc',
    '.lbx',
    '.bbx',
    '.cbx',
    '.m'
  ],

  IGNORE_EXTENSIONS: [
    '.dvi',
    '.aux',
    '.log',
    '.toc',
    '.out',
    '.pdfsync',
    // Index and glossary files
    '.nlo',
    '.ind',
    '.glo',
    '.gls',
    '.glg',
    // Bibtex
    '.bbl',
    '.blg',
    // Misc/bad
    '.doc',
    '.docx',
    '.gz'
  ],

  IGNORE_FILENAMES: ['__MACOSX', '.git', '.gitignore'],

  MAX_TEXT_FILE_SIZE: 1 * 1024 * 1024, // 1 MB

  isDirectory(path, callback) {
    fs.stat(path, (error, stats) => {
      if (error != null) {
        return callback(error)
      }
      callback(null, stats.isDirectory())
    })
  },

  // returns charset as understood by fs.readFile,
  getType(name, fsPath, callback) {
    if (!_isTextFilename(name)) {
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

  getStrictTypeFromContent(name, contents) {
    const isText = _isTextFilename(name)

    if (!isText) {
      return false
    }
    if (
      Buffer.byteLength(contents, 'utf8') > FileTypeManager.MAX_TEXT_FILE_SIZE
    ) {
      return false
    }
    if (contents.indexOf('\x00') !== -1) {
      return false
    }
    if (/[\uD800-\uDFFF]/.test(contents)) {
      // non-BMP characters (high and low surrogate characters)
      return false
    }
    return true
  },

  shouldIgnore(path, callback) {
    const name = Path.basename(path)
    let extension = Path.extname(name).toLowerCase()
    let ignore = false
    if (name.startsWith('.') && name !== '.latexmkrc') {
      ignore = true
    }
    if (FileTypeManager.IGNORE_EXTENSIONS.includes(extension)) {
      ignore = true
    }
    if (FileTypeManager.IGNORE_FILENAMES.includes(name)) {
      ignore = true
    }
    callback(null, ignore)
  }
}

function _isTextFilename(filename) {
  const extension = Path.extname(filename).toLowerCase()
  return (
    FileTypeManager.TEXT_EXTENSIONS.includes(extension) ||
    filename === 'latexmkrc'
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
