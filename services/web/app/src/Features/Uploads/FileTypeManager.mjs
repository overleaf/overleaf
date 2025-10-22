// @ts-check

import fs from 'node:fs/promises'

import Path from 'node:path'
import { callbackify } from 'node:util'
import isUtf8 from 'utf-8-validate'
import Settings from '@overleaf/settings'
import { Minimatch } from 'minimatch'

const FILE_IGNORE_MATCHER = new Minimatch(Settings.fileIgnorePattern, {
  // make the whole path matching case-insensitive (previously we were only
  // matching the extension case-insensitively but it seems safer to match the
  // whole path)
  nocase: true,
  // allows matching on paths containing a dot e.g. /.git/foo/bar.txt
  dot: true,
})

const TEXT_EXTENSIONS = new Set(Settings.textExtensions.map(ext => `.${ext}`))
const EDITABLE_FILENAMES = Settings.editableFilenames

// allow 3 bytes for every character
const MAX_TEXT_FILE_SIZE = 3 * Settings.max_doc_length

async function isDirectory(path) {
  const stats = await fs.stat(path)
  return stats.isDirectory()
}

/**
 * Determine whether a string can be stored as an editable doc
 *
 * @param {string} content
 * @param {object} [opts]
 * @param {string} [opts.filename] - if a filename is given, the algorithm also
 * checks whether the filename matches the list of editable filenames
 */
function isEditable(content, opts = {}) {
  if (opts.filename != null && !_isTextFilename(opts.filename)) {
    return false
  }

  if (content.length >= Settings.max_doc_length) {
    return false
  }

  // For compatibility with the history service, only accept valid utf8 with no
  // nulls or non-BMP characters as text, eveything else is binary.
  if (content.includes('\x00')) {
    return false
  }
  // non-BMP characters (high and low surrogate characters)
  if (/[\uD800-\uDFFF]/.test(content)) {
    return false
  }
  return true
}

/**
 * Determine whether a file can be stored as an editable doc
 *
 * @param {string} name - target filename
 * @param {string} fsPath - path of the file on the filesystem
 * @param {'file' | 'doc' | null} existingFileType - current type of the file at
 * the target location
 */
async function getType(name, fsPath, existingFileType) {
  if (existingFileType !== 'doc' && !_isTextFilename(name)) {
    return { binary: true }
  }

  const stat = await fs.stat(fsPath)
  if (stat.size > MAX_TEXT_FILE_SIZE) {
    return { binary: true }
  }

  const bytes = await fs.readFile(fsPath)
  const encoding = _detectEncoding(bytes)
  const text = bytes.toString(encoding)

  if (isEditable(text)) {
    return { binary: false, encoding }
  } else {
    return { binary: true }
  }
}

function shouldIgnore(path) {
  // use minimatch file matching to check if the path should be ignored
  return FILE_IGNORE_MATCHER.match(path)
}

function _isTextFilename(filename) {
  const basename = Path.basename(filename)
  const extension = Path.extname(filename).toLowerCase()
  return (
    TEXT_EXTENSIONS.has(extension) ||
    EDITABLE_FILENAMES.includes(basename.toLowerCase())
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

export default {
  shouldIgnore,
  isEditable,
  getType: callbackify(getType),
  isDirectory: callbackify(isDirectory),
  promises: {
    getType,
    isDirectory,
  },
}
