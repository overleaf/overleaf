// @ts-check

import _ from 'lodash'
import Core from 'overleaf-editor-core'
import * as Errors from './Errors.js'
import * as OperationsCompressor from './OperationsCompressor.js'

/**
 * @typedef {import('./types.ts').AddDocUpdate} AddDocUpdate
 * @typedef {import('./types.ts').AddFileUpdate} AddFileUpdate
 * @typedef {import('./types.ts').CommentOp} CommentOp
 * @typedef {import('./types.ts').DeleteOp} DeleteOp
 * @typedef {import('./types.ts').InsertOp} InsertOp
 * @typedef {import('./types.ts').Op} Op
 * @typedef {import('./types.ts').RenameUpdate} RenameUpdate
 * @typedef {import('./types.ts').TextUpdate} TextUpdate
 * @typedef {import('./types.ts').Update} Update
 * @typedef {import('./types.ts').UpdateWithBlob} UpdateWithBlob
 */

/**
 * Convert updates into history changes
 *
 * @param {string} projectId
 * @param {UpdateWithBlob[]} updatesWithBlobs
 * @returns {Array<Core.Change | null>}
 */
export function convertToChanges(projectId, updatesWithBlobs) {
  return updatesWithBlobs.map(update => _convertToChange(projectId, update))
}

/**
 * Convert an update into a history change
 *
 * @param {string} projectId
 * @param {UpdateWithBlob} updateWithBlob
 * @returns {Core.Change | null}
 */
function _convertToChange(projectId, updateWithBlob) {
  let operations
  const { update } = updateWithBlob

  let projectVersion = null
  const v2DocVersions = {}

  if (_isRenameUpdate(update)) {
    operations = [
      {
        pathname: _convertPathname(update.pathname),
        newPathname: _convertPathname(update.new_pathname),
      },
    ]
    projectVersion = update.version
  } else if (isAddUpdate(update)) {
    operations = [
      {
        pathname: _convertPathname(update.pathname),
        file: {
          hash: updateWithBlob.blobHash,
        },
      },
    ]
    projectVersion = update.version
  } else if (isTextUpdate(update)) {
    const docLength = update.meta.doc_length
    let pathname = update.meta.pathname

    pathname = _convertPathname(pathname)
    const builder = new OperationsBuilder(docLength, pathname)
    // convert ops
    for (const op of update.op) {
      // if this throws an exception it will be caught in convertToChanges
      builder.addOp(op)
    }
    operations = builder.finish()
    // add doc version information if present
    if (update.v != null) {
      v2DocVersions[update.doc] = { pathname, v: update.v }
    }
  } else {
    const error = new Errors.UpdateWithUnknownFormatError(
      'update with unknown format',
      { projectId, update }
    )
    throw error
  }

  let v2Authors
  if (update.meta.user_id === 'anonymous-user') {
    // history-v1 uses null to represent an anonymous author
    v2Authors = [null]
  } else {
    // user_id is missing on resync operations that update the contents of a doc
    v2Authors = _.compact([update.meta.user_id])
  }

  const rawChange = {
    operations,
    v2Authors,
    timestamp: new Date(update.meta.ts).toISOString(),
    projectVersion,
    v2DocVersions: Object.keys(v2DocVersions).length ? v2DocVersions : null,
  }
  if (update.meta.origin) {
    rawChange.origin = update.meta.origin
  } else if (update.meta.type === 'external' && update.meta.source) {
    rawChange.origin = { kind: update.meta.source }
  }
  const change = Core.Change.fromRaw(rawChange)

  if (change != null) {
    change.operations = OperationsCompressor.compressOperations(
      change.operations
    )
  }

  return change
}

/**
 * @param {Update} update
 * @returns {update is RenameUpdate}
 */
function _isRenameUpdate(update) {
  return 'new_pathname' in update && update.new_pathname != null
}

/**
 * @param {Update} update
 * @returns {update is AddDocUpdate}
 */
function _isAddDocUpdate(update) {
  return (
    'doc' in update &&
    update.doc != null &&
    'docLines' in update &&
    update.docLines != null
  )
}

/**
 * @param {Update} update
 * @returns {update is AddFileUpdate}
 */
function _isAddFileUpdate(update) {
  return (
    'file' in update &&
    update.file != null &&
    'url' in update &&
    update.url != null
  )
}

/**
 * @param {Update} update
 * @returns {update is TextUpdate}
 */
export function isTextUpdate(update) {
  return (
    'doc' in update &&
    update.doc != null &&
    'op' in update &&
    update.op != null &&
    'pathname' in update.meta &&
    update.meta.pathname != null &&
    'doc_length' in update.meta &&
    update.meta.doc_length != null
  )
}

export function isProjectStructureUpdate(update) {
  return isAddUpdate(update) || _isRenameUpdate(update)
}

/**
 * @param {Update} update
 * @returns {update is AddDocUpdate | AddFileUpdate}
 */
export function isAddUpdate(update) {
  return _isAddDocUpdate(update) || _isAddFileUpdate(update)
}

export function _convertPathname(pathname) {
  // Strip leading /
  pathname = pathname.replace(/^\//, '')
  // Replace \\ with _. Backslashes are no longer allowed
  // in projects in web, but we have some which have gone through
  // into history before this restriction was added. This makes
  // them valid for the history store.
  // See https://github.com/overleaf/write_latex/issues/4471
  pathname = pathname.replace(/\\/g, '_')
  // workaround for filenames containing asterisks, this will
  // fail if a corresponding replacement file already exists but it
  // would fail anyway without this attempt to fix the pathname.
  // See https://github.com/overleaf/internal/issues/900
  pathname = pathname.replace(/\*/g, '__ASTERISK__')
  // workaround for filenames beginning with spaces
  // See https://github.com/overleaf/internal/issues/1404
  // note: we have already stripped any leading slash above
  pathname = pathname.replace(/^ /, '__SPACE__') // handle top-level
  pathname = pathname.replace(/\/ /g, '/__SPACE__') // handle folders
  return pathname
}

class OperationsBuilder {
  /**
   * @param {number} docLength
   * @param {string} pathname
   */
  constructor(docLength, pathname) {
    /**
     * List of operations being built
     */
    this.operations = []

    /**
     * Currently built text operation
     *
     * @type {(number | string)[]}
     */
    this.textOperation = []

    /**
     * Cursor inside the current text operation
     */
    this.cursor = 0

    this.docLength = docLength
    this.pathname = pathname
  }

  /**
   * @param {Op} op
   * @returns {void}
   */
  addOp(op) {
    if (isComment(op)) {
      // Close the current text operation
      this.pushTextOperation()

      // Add a comment operation
      this.operations.push({
        pathname: this.pathname,
        commentId: op.t,
        ranges: [
          {
            pos: op.p,
            length: op.c.length,
          },
        ],
      })
      return
    }

    if (!isInsert(op) && !isDelete(op)) {
      throw new Errors.UnexpectedOpTypeError('unexpected op type', { op })
    }

    // We sometimes receive operations that operate at positions outside the
    // docLength. Document updater coerces the position to the end of the
    // document. We do the same here.
    const pos = Math.min(op.p, this.docLength)

    if (pos < this.cursor) {
      this.pushTextOperation()
      // At this point, this.cursor === 0 and we can continue
    }

    if (pos > this.cursor) {
      this.retain(pos - this.cursor)
    }

    if (isInsert(op)) {
      this.insert(op.i)
    }

    if (isDelete(op)) {
      this.delete(op.d.length)
    }
  }

  retain(length) {
    this.textOperation.push(length)
    this.cursor += length
  }

  insert(str) {
    this.textOperation.push(str)
    this.cursor += str.length
    this.docLength += str.length
  }

  delete(length) {
    this.textOperation.push(-length)
    this.docLength -= length
  }

  pushTextOperation() {
    if (this.textOperation.length > 0)
      if (this.cursor < this.docLength) {
        this.retain(this.docLength - this.cursor)
      }
    if (this.textOperation.length > 0) {
      this.operations.push({
        pathname: this.pathname,
        textOperation: this.textOperation,
      })
      this.textOperation = []
    }
    this.cursor = 0
  }

  finish() {
    this.pushTextOperation()
    return this.operations
  }
}

/**
 * @param {Op} op
 * @returns {op is InsertOp}
 */
function isInsert(op) {
  return 'i' in op && op.i != null
}

/**
 * @param {Op} op
 * @returns {op is DeleteOp}
 */
function isDelete(op) {
  return 'd' in op && op.d != null
}

/**
 * @param {Op} op
 * @returns {op is CommentOp}
 */
function isComment(op) {
  return 'c' in op && op.c != null && 't' in op && op.t != null
}
