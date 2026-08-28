// @ts-check
'use strict'

/**
 * @import { FileMetadata } from './types'
 */

/**
 * The metadata keys a doc can carry: `main` marks the project's root doc,
 * `mainBibliography` the bibliography references are added to. Everything else a
 * file's metadata holds records where it came from.
 */
const DOCUMENT_METADATA_KEYS = /** @type {const} */ ([
  'main',
  'mainBibliography',
])

/**
 * Whether metadata holds nothing but the keys a doc can carry, which is what
 * makes a file a doc rather than a file.
 *
 * @param {FileMetadata} [metadata]
 * @returns {boolean}
 */
function isDocumentMetadata(metadata) {
  return Object.keys(metadata ?? {}).every(key =>
    /** @type {readonly string[]} */ (DOCUMENT_METADATA_KEYS).includes(key)
  )
}

/**
 * Whether metadata carries a document flag.
 *
 * @param {FileMetadata | undefined} metadata
 * @param {typeof DOCUMENT_METADATA_KEYS[number]} key
 * @returns {boolean}
 */
function hasDocumentMetadataFlag(metadata, key) {
  return Boolean(/** @type {Record<string, unknown>} */ (metadata ?? {})[key])
}

/**
 * Metadata with one document flag set or cleared, keeping the others.
 *
 * Metadata is replaced wholesale by SetFileMetadataOperation, so changing one
 * flag means writing out the rest of them too. A cleared flag is left out rather
 * than set to false, so a file carrying none has empty metadata.
 *
 * @param {FileMetadata} metadata
 * @param {typeof DOCUMENT_METADATA_KEYS[number]} key
 * @param {boolean} value
 * @returns {FileMetadata}
 */
function withDocumentMetadataFlag(metadata, key, value) {
  /** @type {FileMetadata} */
  const next = {}
  for (const documentKey of DOCUMENT_METADATA_KEYS) {
    if (
      documentKey === key
        ? value
        : hasDocumentMetadataFlag(metadata, documentKey)
    ) {
      next[documentKey] = true
    }
  }
  return next
}

module.exports = {
  DOCUMENT_METADATA_KEYS,
  isDocumentMetadata,
  hasDocumentMetadataFlag,
  withDocumentMetadataFlag,
}
