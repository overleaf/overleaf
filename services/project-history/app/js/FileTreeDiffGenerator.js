/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import Core from 'overleaf-editor-core'
import logger from '@overleaf/logger'
import * as Errors from './Errors.js'

const { MoveFileOperation, AddFileOperation, EditFileOperation } = Core

export function buildDiff(chunk, fromVersion, toVersion) {
  chunk = Core.Chunk.fromRaw(chunk.chunk)
  const chunkStartVersion = chunk.getStartVersion()

  const diff = _getInitialDiffSnapshot(chunk, fromVersion)

  const changes = chunk
    .getChanges()
    .slice(fromVersion - chunkStartVersion, toVersion - chunkStartVersion)
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    for (const operation of Array.from(change.getOperations())) {
      if (operation.pathname === null || operation.pathname === '') {
        // skip operations for missing files
        logger.warn({ diff, operation }, 'invalid pathname in operation')
      } else if (operation instanceof EditFileOperation) {
        _applyEditFileToDiff(diff, operation)
      } else if (operation instanceof AddFileOperation) {
        _applyAddFileToDiff(diff, operation)
      } else if (operation instanceof MoveFileOperation) {
        if (operation.isRemoveFile()) {
          const deletedAtV = fromVersion + i
          _applyDeleteFileToDiff(diff, operation, deletedAtV)
        } else {
          _applyMoveFileToDiff(diff, operation)
        }
      }
    }
  }

  return Object.values(diff)
}

function _getInitialDiffSnapshot(chunk, fromVersion) {
  // Start with a 'diff' which is snapshot of the filetree at the beginning,
  // with nothing in the diff marked as changed.
  // Use a bare object to protect against reserved names.
  const diff = Object.create(null)
  const files = _getInitialFiles(chunk, fromVersion)
  for (const [pathname, file] of Object.entries(files)) {
    diff[pathname] = { pathname, editable: file.isEditable() }
  }
  return diff
}

function _getInitialFiles(chunk, fromVersion) {
  const snapshot = chunk.getSnapshot()
  const changes = chunk
    .getChanges()
    .slice(0, fromVersion - chunk.getStartVersion())
  snapshot.applyAll(changes)
  return snapshot.fileMap.files
}

function _applyAddFileToDiff(diff, operation) {
  const change = diff[operation.pathname]
  if (change != null) {
    // already exists, likely a delete so just cancel that and put the file back to unchanged
    if (change.operation !== 'removed') {
      const err = new Errors.InconsistentChunkError(
        'trying to add file that already exists',
        { diff, operation }
      )
      throw err
    }
    delete diff[operation.pathname].operation
    return delete diff[operation.pathname].deletedAtV
  } else {
    return (diff[operation.pathname] = {
      pathname: operation.pathname,
      operation: 'added',
      editable: operation.file.isEditable(),
    })
  }
}

function _applyEditFileToDiff(diff, operation) {
  const change = diff[operation.pathname]
  if ((change != null ? change.operation : undefined) == null) {
    // avoid exception for non-existent change
    return (diff[operation.pathname] = {
      pathname: operation.pathname,
      operation: 'edited',
    })
  }
}

function _applyMoveFileToDiff(diff, operation) {
  if (
    diff[operation.newPathname] != null &&
    diff[operation.newPathname].operation !== 'removed'
  ) {
    const err = new Errors.InconsistentChunkError(
      'trying to move to file that already exists',
      { diff, operation }
    )
    throw err
  }
  const change = diff[operation.pathname]
  if (change == null) {
    logger.warn({ diff, operation }, 'tried to rename non-existent file')
    return
  }
  change.newPathname = operation.newPathname
  if (change.operation === 'added') {
    // If this file was added this time, just leave it as an add, but
    // at the new name.
    change.pathname = operation.newPathname
    delete change.newPathname
  } else {
    change.operation = 'renamed'
  }
  diff[operation.newPathname] = change
  return delete diff[operation.pathname]
}

function _applyDeleteFileToDiff(diff, operation, deletedAtV) {
  // avoid exception for non-existent change
  if (diff[operation.pathname] != null) {
    diff[operation.pathname].operation = 'removed'
  }
  return diff[operation.pathname] != null
    ? (diff[operation.pathname].deletedAtV = deletedAtV)
    : undefined
}
