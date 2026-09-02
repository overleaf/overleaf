// @ts-check
'use strict'

/**
 * Whether a file is an editable doc or a binary file, at a given pathname.
 *
 * The rules mirror web's Uploads/FileTypeManager and the type decision in web's
 * ThirdPartyDataStore/UpdateMerger, which together classify a file that travels
 * through web's update endpoints. Every integration that writes to history
 * directly has to reach the same verdict for the same bytes at the same
 * pathname, otherwise a project changes the type of a file just by crossing the
 * otMigrationStage boundary.
 *
 * This is a different question from the one lib/blob_utils.js answers.
 * That one says whether history *can* hold content as text: it caps at
 * TextOperation.MAX_STRING_LENGTH (3 MiB) and looks for high surrogates only.
 * This one says whether a file *should be* a doc: it caps at web's
 * max_doc_length (2 MiB) and rejects either half of a surrogate pair. That is
 * why the limit and the lists are injected rather than taken from editor-core's
 * own constants — they are web's rule, and editor-core has no
 * @overleaf/settings dependency and must not gain one.
 *
 * This module is Node-only: it reads files and validates UTF-8 with a native
 * addon. It must never be reachable from index.js, because overleaf-editor-core
 * is bundled for the browser. Consumers deep import it, which the package
 * exports allow:
 *
 *     require('overleaf-editor-core/lib/file_type_detector')
 */

const fs = require('node:fs')
const Path = require('node:path')
const isValidUtf8 = require('utf-8-validate')

/**
 * @typedef {{kind: 'text', content: string} | {kind: 'binary'}} DetectedType
 * @typedef {'doc'|'file'|null|undefined} ExistingType
 */

/**
 * @typedef {object} FileTypeConfig
 * @property {ReadonlyArray<string>} textExtensions extensions without a leading
 *   dot, as web's settings.textExtensions carries them
 * @property {ReadonlyArray<string>} editableFilenames whole file names, lower
 *   case
 * @property {number} maxDocLength web's max_doc_length, in characters
 */

/**
 * @param {FileTypeConfig} config
 */
function validateConfig(config) {
  if (
    !config ||
    !Array.isArray(config.textExtensions) ||
    !Array.isArray(config.editableFilenames) ||
    !Number.isFinite(config.maxDocLength)
  ) {
    // A missing maxDocLength would make every length comparison below false,
    // which reads as "no limit" rather than as a misconfiguration.
    throw new TypeError('fileTypeDetector: bad config')
  }
}

/**
 * @param {string} pathname
 * @param {FileTypeConfig} config
 * @return {boolean} whether the name alone allows the file to be a doc
 */
function isTextFilename(pathname, config) {
  const basename = Path.basename(pathname).toLowerCase()
  const extension = Path.extname(pathname).toLowerCase()
  const extensions = new Set(config.textExtensions.map(ext => `.${ext}`))
  return (
    extensions.has(extension) || config.editableFilenames.includes(basename)
  )
}

/**
 * Whether the content has to be read before the file can be classified.
 *
 * `false` is a verdict, not a maybe: every case that gets here is a binary file,
 * decided from the name and the size alone.
 *
 * @param {string} pathname target pathname, project-relative
 * @param {number|null} byteLength null when the size is not known yet, which
 *        skips the size gate
 * @param {ExistingType} existingType type of what is at the pathname now, if
 *        anything
 * @param {FileTypeConfig} config
 * @return {boolean}
 */
function needsContent(pathname, byteLength, existingType, config) {
  validateConfig(config)

  // A binary file stays a binary file whatever the update looks like: no update
  // to an existing file comes out of web's UpdateMerger._determineFileType as
  // anything but a file.
  if (existingType === 'file') {
    return false
  }

  // A file that is already a doc stays eligible to be one whatever its name
  // says, which is how web keeps a doc a doc after a rename to a name that is
  // not in the text-extension list.
  if (existingType !== 'doc' && !isTextFilename(pathname, config)) {
    return false
  }

  // A character takes at most three bytes in the only encoding that can yield an
  // editable doc, so anything above this cannot come in under the character
  // limit below.
  if (byteLength !== null && byteLength > 3 * config.maxDocLength) {
    return false
  }

  return true
}

/**
 * Whether a decoded string can be stored as a doc.
 *
 * @param {string} content
 * @param {FileTypeConfig} config
 * @return {boolean}
 */
function isEditableString(content, config) {
  if (content.length >= config.maxDocLength) {
    return false
  }
  if (content.includes('\x00')) {
    return false
  }
  // High and low surrogate code units, i.e. non-BMP characters. Only paired ones
  // can reach here from valid UTF-8: a lone surrogate is not valid UTF-8, so
  // those bytes have already been turned away. Kept whole because web applies
  // the same rule to content it decoded as UTF-16, where a lone one can occur.
  if (/[\uD800-\uDFFF]/.test(content)) {
    return false
  }
  return true
}

/**
 * Classify content already held in memory.
 *
 * A `kind: 'text'` verdict promises the bytes are valid UTF-8, so the content
 * can be handed back to where it came from as the bytes that arrived.
 *
 * @param {Buffer} buffer
 * @param {{pathname: string, existingType?: ExistingType}} target
 * @param {FileTypeConfig} config
 * @return {DetectedType}
 */
function detectBuffer(buffer, { pathname, existingType }, config) {
  if (!needsContent(pathname, buffer.byteLength, existingType, config)) {
    return { kind: 'binary' }
  }

  // Anything that is not UTF-8 cannot be kept in sync, so web treats it as
  // binary regardless of what it decodes to (UpdateMerger.mjs, isBinary). The
  // verdict is acted on here rather than returned alongside the decoded content:
  // carrying it for a caller to honour is what let a latin1 file become a doc
  // with its bytes re-serialised as UTF-8.
  if (!isValidUtf8(buffer)) {
    return { kind: 'binary' }
  }

  const content = buffer.toString('utf-8')
  if (!isEditableString(content, config)) {
    return { kind: 'binary' }
  }
  return { kind: 'text', content }
}

/**
 * Classify the file spooled at `localPath` as it would be classified at
 * `pathname`.
 *
 * @param {string} pathname target pathname, project-relative
 * @param {string} localPath spooled copy of the file's content
 * @param {ExistingType} existingType type of what is at the pathname now, if
 *        anything
 * @param {FileTypeConfig} config
 * @return {Promise<DetectedType>}
 */
async function detectFile(pathname, localPath, existingType, config) {
  // The name can decide on its own, before the file is even stat'ed.
  if (!needsContent(pathname, null, existingType, config)) {
    return { kind: 'binary' }
  }

  const stat = await fs.promises.stat(localPath)
  if (!needsContent(pathname, stat.size, existingType, config)) {
    return { kind: 'binary' }
  }

  return detectBuffer(
    await fs.promises.readFile(localPath),
    { pathname, existingType },
    config
  )
}

module.exports = { needsContent, detectBuffer, detectFile }
