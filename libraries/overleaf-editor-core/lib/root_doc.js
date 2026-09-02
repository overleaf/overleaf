// @ts-check
'use strict'

const OError = require('@overleaf/o-error')
const {
  hasDocumentMetadataFlag,
  isDocumentMetadata,
  withDocumentMetadataFlag,
} = require('./file_metadata')
const Operation = require('./operation')
const { DEFAULT_ROOT_DOC_EXTENSIONS } = require('./text_file_defaults')

/**
 * @import Snapshot from './snapshot'
 * @import { FileMetadata } from './types'
 */

/**
 * Which doc a project opens on, and how history records that it is the one.
 *
 * History holds it as `main: true` on the file's metadata, and nothing derives it:
 * every writer that creates a project has to record it, or the project opens on no
 * doc at all. So the rule for choosing one, and the operations that write it, live
 * here rather than with any one of them.
 */

/** How much of a doc is read looking for its document class. */
const MAX_CONTENT_TO_SCAN = 30 * 1000

const ROOT_DOC_EXTENSION = new RegExp(
  `\\.(${DEFAULT_ROOT_DOC_EXTENSIONS.join('|')})$`,
  'i'
)

/**
 * Whether this doc could be the one a project compiles from: carrying an extension a
 * root doc may have, and declaring a document class.
 *
 * Content rather than a store to read it from: a writer creating a project has every
 * doc's content in its hands as it stores it, and reading them back to answer this
 * would be a second read of each.
 *
 * Only the start of a doc is read, and each line only from its beginning: a data file
 * is a doc as far as history is concerned, and one 500KB line of it scanned for a
 * pattern that can only match at a line start is what used to lock up a CPU.
 *
 * @param {string} pathname
 * @param {string} content
 * @return {boolean}
 */
function isRootDocCandidate(pathname, content) {
  if (!ROOT_DOC_EXTENSION.test(pathname)) return false
  return content
    .substring(0, MAX_CONTENT_TO_SCAN)
    .split('\n')
    .some(line => /^\s*\\documentclass/.test(line))
}

/**
 * @param {Snapshot} snapshot
 * @param {string} pathname
 * @return {FileMetadata}
 */
function metadataOf(snapshot, pathname) {
  return snapshot.getFile(pathname)?.getMetadata() ?? {}
}

/**
 * Make the file at `pathname` the project's root doc.
 *
 * The change unsets `main` wherever it is now and sets it on the chosen file. Both are
 * needed: metadata is replaced wholesale rather than merged, and nothing stops two
 * files claiming it.
 *
 * A file carrying metadata that is not a doc flag came from outside the editor, and
 * cannot also be the root doc: history's metadata shapes do not combine, so the change
 * would have to throw that away to fit the doc one. Refused here rather than written.
 *
 * @param {Snapshot} snapshot
 * @param {string} pathname
 * @return {Operation[]} empty where history already records this file
 */
function setMainPathnameOperations(snapshot, pathname) {
  if (!isDocumentMetadata(metadataOf(snapshot, pathname))) {
    throw new OError('only a doc can be the root doc', { pathname })
  }

  const operations = []
  for (const candidate of snapshot.getFilePathnames().sort()) {
    const metadata = metadataOf(snapshot, candidate)
    const main = candidate === pathname
    if (hasDocumentMetadataFlag(metadata, 'main') === main) continue
    operations.push(
      Operation.setFileMetadata(
        candidate,
        withDocumentMetadataFlag(metadata, 'main', main)
      )
    )
  }
  return operations
}

/**
 * The doc a project should open on, and the operations that record it as such.
 *
 * Of the docs that could be it, the one nearest the project root, alphabetically among
 * equals: a main file that only includes the others sits beside the project rather
 * than under it, and the rest is so that the same files always give the same answer.
 *
 * A project whose root doc history already records keeps it -- that is a user's choice
 * and not something to re-derive.
 *
 * @param {Snapshot} snapshot
 * @param {Iterable<string>} candidates pathnames of the docs that could be it, as
 *        `isRootDocCandidate` decides
 * @return {{pathname: string, operations: Operation[]} | null} null where there is no
 *         candidate, and where one is already recorded
 */
function chooseRootDoc(snapshot, candidates) {
  if (snapshot.getPathnameWithDocFlag('main') !== undefined) return null

  // Only what the snapshot holds: a doc the caller could not write is not one the
  // project has, and recording it would leave `main` on a pathname with no file.
  const pathname = [...candidates]
    .filter(candidate => snapshot.getFile(candidate) != null)
    .sort(byDepthThenName)[0]
  if (pathname === undefined) return null
  return { pathname, operations: setMainPathnameOperations(snapshot, pathname) }
}

/**
 * @param {string} a
 * @param {string} b
 * @return {number}
 */
function byDepthThenName(a, b) {
  const depth = countSlashes(a) - countSlashes(b)
  return depth !== 0 ? depth : a < b ? -1 : a > b ? 1 : 0
}

/**
 * @param {string} pathname
 * @return {number}
 */
function countSlashes(pathname) {
  let count = 0
  for (const character of pathname) {
    if (character === '/') count++
  }
  return count
}

module.exports = {
  chooseRootDoc,
  isRootDocCandidate,
  setMainPathnameOperations,
}
