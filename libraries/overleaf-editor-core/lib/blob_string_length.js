// @ts-check
'use strict'

/**
 * The rule that decides whether the content of a blob counts as editable text,
 * and if so what string length to record on the {@link Blob}.
 *
 * This module is Node-only: it reads files and validates UTF-8 with a native
 * addon. It must never be reachable from index.js, because overleaf-editor-core
 * is bundled for the browser. Consumers deep import it, which the package
 * exports allow:
 *
 *     require('overleaf-editor-core/lib/blob_string_length')
 */

const fs = require('node:fs')
const isValidUtf8 = require('utf-8-validate')

const Blob = require('./blob')
const TextOperation = require('./operation/text_operation')
const { containsNonBmpChars } = require('./util')

/**
 * @param {Buffer} buffer
 * @return {number | null} the string length, or null when the content is not
 *         editable text
 */
function getStringLengthOfBuffer(buffer) {
  if (!isValidUtf8(buffer)) return null
  const data = buffer.toString()
  if (data.length > TextOperation.MAX_STRING_LENGTH) return null
  // We cannot edit files containing non-BMP or null characters.
  if (containsNonBmpChars(data)) return null
  if (data.indexOf('\x00') !== -1) return null
  return data.length
}

/**
 * @param {number} byteLength
 * @param {string} pathname
 * @return {Promise<number | null>} the string length, or null when the content
 *         is not editable text
 */
async function getStringLengthOfFile(byteLength, pathname) {
  // We have to read the file into memory to get its UTF-8 length, so don't
  // bother for files that are too large for us to edit anyway.
  if (byteLength > Blob.MAX_EDITABLE_BYTE_LENGTH_BOUND) {
    return null
  }

  return getStringLengthOfBuffer(await fs.promises.readFile(pathname))
}

module.exports = { getStringLengthOfBuffer, getStringLengthOfFile }
