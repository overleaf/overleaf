/* eslint-disable
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let FileTypeManager
const fs = require('fs')
const Path = require('path')
const isUtf8 = require('is-utf8')

module.exports = FileTypeManager = {
  TEXT_EXTENSIONS: [
    'tex',
    'latex',
    'sty',
    'cls',
    'bst',
    'bib',
    'bibtex',
    'txt',
    'tikz',
    'rtex',
    'md',
    'asy',
    'latexmkrc',
    'lbx',
    'bbx',
    'cbx',
    'm'
  ],

  IGNORE_EXTENSIONS: [
    'dvi',
    'aux',
    'log',
    'toc',
    'out',
    'pdfsync',
    // Index and glossary files
    'nlo',
    'ind',
    'glo',
    'gls',
    'glg',
    // Bibtex
    'bbl',
    'blg',
    // Misc/bad
    'doc',
    'docx',
    'gz'
  ],

  IGNORE_FILENAMES: ['__MACOSX', '.git', '.gitignore'],

  MAX_TEXT_FILE_SIZE: 1 * 1024 * 1024, // 1 MB

  isDirectory(path, callback) {
    if (callback == null) {
      callback = function(error, result) {}
    }
    return fs.stat(path, function(error, stats) {
      if (error != null) {
        return callback(error)
      }
      return callback(null, stats != null ? stats.isDirectory() : undefined)
    })
  },

  // returns charset as understood by fs.readFile,
  getType(name, fsPath, callback) {
    if (callback == null) {
      callback = function(error, isBinary, charset, bytes) {}
    }
    const parts = name.split('.')
    const extension = parts.slice(-1)[0].toLowerCase()
    const isText =
      (FileTypeManager.TEXT_EXTENSIONS.indexOf(extension) > -1 &&
        parts.length > 1) ||
      parts[0] === 'latexmkrc'

    if (!isText) {
      return callback(null, true)
    }

    return fs.stat(fsPath, function(error, stat) {
      if (error != null) {
        return callback(error)
      }
      if (stat.size > FileTypeManager.MAX_TEXT_FILE_SIZE) {
        return callback(null, true) // Treat large text file as binary
      }

      return fs.readFile(fsPath, function(err, bytes) {
        if (err != null) {
          return callback(err)
        }

        if (isUtf8(bytes)) {
          return callback(null, false, 'utf-8', bytes)
        }
        // check for little-endian unicode bom (nodejs does not support big-endian)
        if (bytes[0] === 0xff && bytes[1] === 0xfe) {
          return callback(null, false, 'utf-16le')
        }

        return callback(null, false, 'latin1')
      })
    })
  },

  // For compatibility with the history service, only accept valid utf8 with no
  // nulls or non-BMP characters as text, eveything else is binary.
  getStrictType(name, fsPath, callback) {
    FileTypeManager.getType(name, fsPath, function(
      err,
      isBinary,
      charset,
      bytes
    ) {
      if (err) {
        return callback(err)
      }
      if (isBinary || charset !== 'utf-8' || !bytes) {
        return callback(null, true)
      }
      let data = bytes.toString()
      if (data.indexOf('\x00') !== -1) {
        return callback(null, true)
      }
      if (/[\uD800-\uDFFF]/.test(data)) {
        // non-BMP characters (high and low surrogate characters)
        return callback(null, true)
      }
      return callback(null, false)
    })
  },

  getExtension(fileName) {
    const nameSplit = fileName.split('.')
    if (nameSplit.length < 2) {
      return undefined
    }
    return nameSplit.pop()
  },

  shouldIgnore(path, callback) {
    if (callback == null) {
      callback = function(error, result) {}
    }
    const name = Path.basename(path)
    let extension = this.getExtension(name)
    if (extension != null) {
      extension = extension.toLowerCase()
    }
    let ignore = false
    if (name[0] === '.' && extension !== 'latexmkrc') {
      ignore = true
    }
    if (this.IGNORE_EXTENSIONS.indexOf(extension) !== -1) {
      ignore = true
    }
    if (this.IGNORE_FILENAMES.indexOf(name) !== -1) {
      ignore = true
    }
    return callback(null, ignore)
  }
}
