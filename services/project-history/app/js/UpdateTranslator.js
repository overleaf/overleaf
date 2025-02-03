// @ts-check

import _ from 'lodash'
import Core from 'overleaf-editor-core'
import * as Errors from './Errors.js'
import * as OperationsCompressor from './OperationsCompressor.js'
import { isInsert, isRetain, isDelete, isComment } from './Utils.js'

/**
 * @import { AddDocUpdate, AddFileUpdate, DeleteCommentUpdate, Op, RawScanOp } from './types'
 * @import { RenameUpdate, TextUpdate, TrackingDirective, TrackingProps } from './types'
 * @import { SetCommentStateUpdate, SetFileMetadataOperation, Update, UpdateWithBlob } from './types'
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
    const op = {
      pathname: _convertPathname(update.pathname),
      file: {
        hash: updateWithBlob.blobHashes.file,
      },
    }
    if (_isAddDocUpdate(update)) {
      op.file.rangesHash = updateWithBlob.blobHashes.ranges
    }
    if (_isAddFileUpdate(update)) {
      op.file.metadata = update.metadata
    }
    operations = [op]
    projectVersion = update.version
  } else if (isTextUpdate(update)) {
    const docLength = update.meta.history_doc_length ?? update.meta.doc_length
    let pathname = update.meta.pathname

    pathname = _convertPathname(pathname)
    const builder = new OperationsBuilder(docLength, pathname)
    // convert ops
    for (const op of update.op) {
      builder.addOp(op, update)
    }
    // add doc hash if present
    if (update.meta.doc_hash != null) {
      // This will commit the text operation that the builder is currently
      // building and set the contentHash property.
      builder.commitTextOperation({ contentHash: update.meta.doc_hash })
    }
    operations = builder.finish()
    // add doc version information if present
    if (update.v != null) {
      v2DocVersions[update.doc] = { pathname, v: update.v }
    }
  } else if (isSetCommentStateUpdate(update)) {
    operations = [
      {
        pathname: _convertPathname(update.pathname),
        commentId: update.commentId,
        resolved: update.resolved,
      },
    ]
  } else if (isSetFileMetadataOperation(update)) {
    operations = [
      {
        pathname: _convertPathname(update.pathname),
        metadata: update.metadata,
      },
    ]
  } else if (isDeleteCommentUpdate(update)) {
    operations = [
      {
        pathname: _convertPathname(update.pathname),
        deleteComment: update.deleteComment,
      },
    ]
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
    (('createdBlob' in update && update.createdBlob) ||
      ('url' in update && update.url != null))
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

/**
 * @param {Update} update
 * @returns {update is SetCommentStateUpdate}
 */
export function isSetCommentStateUpdate(update) {
  return 'commentId' in update && 'resolved' in update
}

/**
 * @param {Update} update
 * @returns {update is DeleteCommentUpdate}
 */
export function isDeleteCommentUpdate(update) {
  return 'deleteComment' in update
}

/**
 * @param {Update} update
 * @returns {update is SetFileMetadataOperation}
 */
export function isSetFileMetadataOperation(update) {
  return 'metadata' in update
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
     * @type {RawScanOp[]}
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
   * @param {TextUpdate} update
   * @returns {void}
   */
  addOp(op, update) {
    // We sometimes receive operations that operate at positions outside the
    // docLength. Document updater coerces the position to the end of the
    // document. We do the same here.
    const pos = Math.min(op.hpos ?? op.p, this.docLength)

    if (isComment(op)) {
      // Commit the current text operation
      this.commitTextOperation()

      // Add a comment operation
      const commentLength = op.hlen ?? op.c.length
      const commentOp = {
        pathname: this.pathname,
        commentId: op.t,
        ranges: commentLength > 0 ? [{ pos, length: commentLength }] : [],
      }
      if ('resolved' in op) {
        commentOp.resolved = op.resolved
      }
      this.operations.push(commentOp)
      return
    }

    if (!isInsert(op) && !isDelete(op) && !isRetain(op)) {
      throw new Errors.UnexpectedOpTypeError('unexpected op type', { op })
    }

    if (pos < this.cursor) {
      this.commitTextOperation()
      // At this point, this.cursor === 0 and we can continue
    }

    if (pos > this.cursor) {
      this.retain(pos - this.cursor)
    }

    if (isInsert(op)) {
      if (op.trackedDeleteRejection) {
        this.retain(op.i.length, {
          tracking: { type: 'none' },
        })
      } else {
        const opts = {}
        if (update.meta.tc != null) {
          opts.tracking = {
            type: 'insert',
            userId: update.meta.user_id,
            ts: new Date(update.meta.ts).toISOString(),
          }
        }
        if (op.commentIds != null) {
          opts.commentIds = op.commentIds
        }
        this.insert(op.i, opts)
      }
    }

    if (isRetain(op)) {
      if (op.tracking) {
        this.retain(op.r.length, { tracking: op.tracking })
      } else {
        this.retain(op.r.length)
      }
    }

    if (isDelete(op)) {
      const changes = op.trackedChanges ?? []

      // Tracked changes should already be ordered by offset, but let's make
      // sure they are.
      changes.sort((a, b) => {
        const posOrder = a.offset - b.offset
        if (posOrder !== 0) {
          return posOrder
        } else if (a.type === 'insert' && b.type === 'delete') {
          return 1
        } else if (a.type === 'delete' && b.type === 'insert') {
          return -1
        } else {
          return 0
        }
      })

      let offset = 0
      for (const change of changes) {
        if (change.offset > offset) {
          // Handle the portion before the tracked change
          if (update.meta.tc != null) {
            // This is a tracked delete
            this.retain(change.offset - offset, {
              tracking: {
                type: 'delete',
                userId: update.meta.user_id,
                ts: new Date(update.meta.ts).toISOString(),
              },
            })
          } else {
            // This is a regular delete
            this.delete(change.offset - offset)
          }
          offset = change.offset
        }

        // Now, handle the portion inside the tracked change
        if (change.type === 'delete') {
          // Tracked deletes are skipped over when deleting
          this.retain(change.length)
        } else if (change.type === 'insert') {
          // Deletes inside tracked inserts are always regular deletes
          this.delete(change.length)
          offset += change.length
        }
      }
      if (offset < op.d.length) {
        // Handle the portion after the last tracked change
        if (update.meta.tc != null) {
          // This is a tracked delete
          this.retain(op.d.length - offset, {
            tracking: {
              type: 'delete',
              userId: update.meta.user_id,
              ts: new Date(update.meta.ts).toISOString(),
            },
          })
        } else {
          // This is a regular delete
          this.delete(op.d.length - offset)
        }
      }
    }
  }

  /**
   * @param {number} length
   * @param {object} opts
   * @param {TrackingDirective} [opts.tracking]
   */
  retain(length, opts = {}) {
    if (opts.tracking) {
      this.textOperation.push({ r: length, ...opts })
    } else {
      this.textOperation.push(length)
    }
    this.cursor += length
  }

  /**
   * @param {string} str
   * @param {object} opts
   * @param {TrackingProps} [opts.tracking]
   * @param {string[]} [opts.commentIds]
   */
  insert(str, opts = {}) {
    if (opts.tracking || opts.commentIds) {
      this.textOperation.push({ i: str, ...opts })
    } else {
      this.textOperation.push(str)
    }
    this.cursor += str.length
    this.docLength += str.length
  }

  /**
   * @param {number} length
   * @param {object} opts
   */
  delete(length, opts = {}) {
    this.textOperation.push(-length)
    this.docLength -= length
  }

  /**
   * Finalize the current text operation and push it to the queue
   *
   * @param {object} [opts]
   * @param {string} [opts.contentHash]
   */
  commitTextOperation(opts = {}) {
    if (this.textOperation.length > 0 && this.cursor < this.docLength) {
      this.retain(this.docLength - this.cursor)
    }
    if (this.textOperation.length > 0) {
      const operation = {
        pathname: this.pathname,
        textOperation: this.textOperation,
      }
      if (opts.contentHash != null) {
        operation.contentHash = opts.contentHash
      }
      this.operations.push(operation)
      this.textOperation = []
    }
    this.cursor = 0
  }

  finish() {
    this.commitTextOperation()
    return this.operations
  }
}
