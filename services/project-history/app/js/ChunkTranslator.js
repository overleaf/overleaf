import _ from 'lodash'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as WebApiManager from './WebApiManager.js'
import * as Errors from './Errors.js'
import {
  TextOperation,
  InsertOp,
  RemoveOp,
  RetainOp,
  Range,
  TrackedChangeList,
} from 'overleaf-editor-core'

/**
 * @import { RawEditOperation, TrackedChangeRawData } from 'overleaf-editor-core/lib/types'
 */

export function convertToSummarizedUpdates(chunk, callback) {
  const version = chunk.chunk.startVersion
  const { files } = chunk.chunk.history.snapshot
  const builder = new UpdateSetBuilder(version, files)

  for (const change of chunk.chunk.history.changes) {
    try {
      builder.applyChange(change)
    } catch (error1) {
      const error = error1
      return callback(error)
    }
  }
  callback(null, builder.summarizedUpdates)
}

export function convertToDiffUpdates(
  projectId,
  chunk,
  pathname,
  fromVersion,
  toVersion,
  callback
) {
  let error
  let version = chunk.chunk.startVersion
  const { files } = chunk.chunk.history.snapshot
  const builder = new UpdateSetBuilder(version, files)

  let file = null
  for (const change of chunk.chunk.history.changes) {
    // Because we're referencing by pathname, which can change, we
    // want to get the last file in the range fromVersion:toVersion
    // that has the pathname we want. Note that this might not exist yet
    // at fromVersion, so we'll just settle for the last existing one we find
    // after that.
    if (fromVersion <= version && version <= toVersion) {
      const currentFile = builder.getFile(pathname)
      if (currentFile) {
        file = currentFile
      }
    }

    try {
      builder.applyChange(change)
    } catch (error1) {
      error = error1
      return callback(error)
    }
    version += 1
  }
  // Versions act as fence posts, with updates taking us from one to another,
  // so we also need to check after the final update, when we're at the last version.
  if (fromVersion <= version && version <= toVersion) {
    const currentFile = builder.getFile(pathname)
    if (currentFile) {
      file = currentFile
    }
  }

  // return an empty diff if the file was flagged as missing with an explicit null
  if (builder.getFile(pathname) === null) {
    return callback(null, { initialContent: '', updates: [] })
  }

  if (file == null) {
    error = new Errors.NotFoundError(
      `pathname '${pathname}' not found in range`
    )
    return callback(error)
  }

  WebApiManager.getHistoryId(projectId, (err, historyId) => {
    if (err) {
      return callback(err)
    }
    file.getDiffUpdates(historyId, fromVersion, toVersion, callback)
  })
}

class UpdateSetBuilder {
  constructor(startVersion, files) {
    this.version = startVersion
    this.summarizedUpdates = []

    this.files = Object.create(null)
    for (const pathname in files) {
      // initialize file from snapshot
      const data = files[pathname]
      this.files[pathname] = new File(pathname, data, startVersion)
    }
  }

  getFile(pathname) {
    return this.files[pathname]
  }

  applyChange(change) {
    const timestamp = new Date(change.timestamp)
    let authors = _.map(change.authors, id => {
      if (id == null) {
        return null
      }
      return id
    })
    authors = authors.concat(change.v2Authors || [])
    this.currentUpdate = {
      meta: {
        users: authors,
        start_ts: timestamp.getTime(),
        end_ts: timestamp.getTime(),
      },
      v: this.version,
      pathnames: new Set([]),
      project_ops: [],
    }
    if (change.origin) {
      this.currentUpdate.meta.origin = change.origin
    }

    for (const op of change.operations) {
      this.applyOperation(op, timestamp, authors, change.origin)
    }

    this.currentUpdate.pathnames = Array.from(this.currentUpdate.pathnames)
    this.summarizedUpdates.push(this.currentUpdate)

    this.version += 1
  }

  applyOperation(op, timestamp, authors, origin) {
    if (UpdateSetBuilder._isTextOperation(op)) {
      this.applyTextOperation(op, timestamp, authors, origin)
    } else if (UpdateSetBuilder._isRenameOperation(op)) {
      this.applyRenameOperation(op, timestamp, authors)
    } else if (UpdateSetBuilder._isRemoveFileOperation(op)) {
      this.applyRemoveFileOperation(op, timestamp, authors)
    } else if (UpdateSetBuilder._isAddFileOperation(op)) {
      this.applyAddFileOperation(op, timestamp, authors)
    }
  }

  applyTextOperation(operation, timestamp, authors, origin) {
    const { pathname } = operation
    if (pathname === '') {
      // this shouldn't happen, but we continue to allow the user to see the history
      logger.warn(
        { operation, timestamp, authors },
        'pathname is empty for text operation'
      )
      return
    }

    const file = this.files[pathname]
    if (file == null) {
      // this shouldn't happen, but we continue to allow the user to see the history
      logger.warn(
        { operation, timestamp, authors },
        'file is missing for text operation'
      )
      this.files[pathname] = null // marker for a missing file
      return
    }

    file.applyTextOperation(authors, timestamp, this.version, operation, origin)
    this.currentUpdate.pathnames.add(pathname)
  }

  applyRenameOperation(operation, timestamp, authors) {
    const { pathname, newPathname } = operation
    const file = this.files[pathname]
    if (file == null) {
      // this shouldn't happen, but we continue to allow the user to see the history
      logger.warn(
        { operation, timestamp, authors },
        'file is missing for rename operation'
      )
      this.files[pathname] = null // marker for a missing file
      return
    }

    file.rename(newPathname)
    delete this.files[pathname]
    this.files[newPathname] = file

    this.currentUpdate.project_ops.push({
      rename: { pathname, newPathname },
    })
  }

  applyAddFileOperation(operation, timestamp, authors) {
    const { pathname } = operation
    // add file
    this.files[pathname] = new File(pathname, operation.file, this.version)

    this.currentUpdate.project_ops.push({ add: { pathname } })
  }

  applyRemoveFileOperation(operation, timestamp, authors) {
    const { pathname } = operation
    const file = this.files[pathname]
    if (file == null) {
      // this shouldn't happen, but we continue to allow the user to see the history
      logger.warn(
        { operation, timestamp, authors },
        'pathname not found when removing file'
      )
      this.files[pathname] = null // marker for a missing file
      return
    }

    delete this.files[pathname]

    this.currentUpdate.project_ops.push({ remove: { pathname } })
  }

  static _isTextOperation(op) {
    return Object.prototype.hasOwnProperty.call(op, 'textOperation')
  }

  static _isRenameOperation(op) {
    return (
      Object.prototype.hasOwnProperty.call(op, 'newPathname') &&
      op.newPathname !== ''
    )
  }

  static _isRemoveFileOperation(op) {
    return (
      Object.prototype.hasOwnProperty.call(op, 'newPathname') &&
      op.newPathname === ''
    )
  }

  static _isAddFileOperation(op) {
    return Object.prototype.hasOwnProperty.call(op, 'file')
  }
}

/**
 * @param {string} content
 * @param {TrackedChangeList} trackedChanges
 * @returns {string}
 */
function removeTrackedDeletesFromString(content, trackedChanges) {
  let result = ''
  let cursor = 0
  const trackedDeletes = trackedChanges
    .asSorted()
    .filter(tc => tc.tracking.type === 'delete')
  for (const trackedChange of trackedDeletes) {
    if (cursor < trackedChange.range.start) {
      result += content.slice(cursor, trackedChange.range.start)
    }
    // skip the tracked change itself
    cursor = trackedChange.range.end
  }
  result += content.slice(cursor)
  return result
}

class File {
  constructor(pathname, snapshot, initialVersion) {
    this.pathname = pathname
    this.snapshot = snapshot
    this.initialVersion = initialVersion
    this.operations = []
  }

  applyTextOperation(authors, timestamp, version, operation, origin) {
    this.operations.push({ authors, timestamp, version, operation, origin })
  }

  rename(pathname) {
    this.pathname = pathname
  }

  getDiffUpdates(historyId, fromVersion, toVersion, callback) {
    if (this.snapshot.stringLength == null) {
      // Binary file
      return callback(null, { binary: true })
    }
    this._loadContentAndRanges(historyId, (error, content, ranges) => {
      if (error != null) {
        return callback(OError.tag(error))
      }
      const trackedChanges = TrackedChangeList.fromRaw(
        ranges?.trackedChanges || []
      )
      /** @type {string | undefined} */
      let initialContent
      const updates = []

      for (const operationInfo of this.operations) {
        if (!('textOperation' in operationInfo.operation)) {
          // We only care about text operations
          continue
        }
        const { authors, timestamp, version, operation } = operationInfo
        // Set the initialContent to the latest version we have before the diff
        // begins. 'version' here refers to the document version as we are
        // applying the updates. So we store the content *before* applying the
        // updates.
        if (version >= fromVersion && initialContent === undefined) {
          initialContent = removeTrackedDeletesFromString(
            content,
            trackedChanges
          )
        }

        let ops
        ;({ content, ops } = this._convertTextOperation(
          content,
          operation,
          trackedChanges
        ))

        // We only need to return the updates between fromVersion and toVersion
        if (fromVersion <= version && version < toVersion) {
          const update = {
            meta: {
              users: authors,
              start_ts: timestamp.getTime(),
              end_ts: timestamp.getTime(),
            },
            v: version,
            op: ops,
          }
          if (operationInfo.origin) {
            update.meta.origin = operationInfo.origin
          }
          updates.push(update)
        }
      }

      if (initialContent === undefined) {
        initialContent = removeTrackedDeletesFromString(content, trackedChanges)
      }
      callback(null, { initialContent, updates })
    })
  }

  /**
   *
   * @param {string} initialContent
   * @param {RawEditOperation} operation
   * @param {TrackedChangeList} trackedChanges
   */
  _convertTextOperation(initialContent, operation, trackedChanges) {
    const textOp = TextOperation.fromJSON(operation)
    const textUpdateBuilder = new TextUpdateBuilder(
      initialContent,
      trackedChanges
    )
    for (const op of textOp.ops) {
      textUpdateBuilder.applyOp(op)
    }
    textUpdateBuilder.finish()
    return {
      content: textUpdateBuilder.result,
      ops: textUpdateBuilder.changes,
    }
  }

  _loadContentAndRanges(historyId, callback) {
    HistoryStoreManager.getProjectBlob(
      historyId,
      this.snapshot.hash,
      (err, content) => {
        if (err) {
          return callback(err)
        }
        if (this.snapshot.rangesHash) {
          HistoryStoreManager.getProjectBlob(
            historyId,
            this.snapshot.rangesHash,
            (err, ranges) => {
              if (err) {
                return callback(err)
              }
              return callback(null, content, JSON.parse(ranges))
            }
          )
        } else {
          return callback(null, content, undefined)
        }
      }
    )
  }
}

class TextUpdateBuilder {
  /**
   *
   * @param {string} source
   * @param {TrackedChangeList} ranges
   */
  constructor(source, ranges) {
    this.trackedChanges = ranges
    this.source = source
    this.sourceCursor = 0
    this.result = ''
    /** @type {({i: string, p: number} | {d: string, p: number})[]} */
    this.changes = []
  }

  applyOp(op) {
    if (op instanceof RetainOp) {
      const length = this.result.length
      this.applyRetain(op)
      this.trackedChanges.applyRetain(length, op.length, {
        tracking: op.tracking,
      })
    }

    if (op instanceof InsertOp) {
      const length = this.result.length
      this.applyInsert(op)
      this.trackedChanges.applyInsert(length, op.insertion, {
        tracking: op.tracking,
      })
    }

    if (op instanceof RemoveOp) {
      const length = this.result.length
      this.applyDelete(op)
      this.trackedChanges.applyDelete(length, op.length)
    }
  }

  /**
   *
   * @param {RetainOp} retain
   */
  applyRetain(retain) {
    const resultRetentionRange = new Range(this.result.length, retain.length)
    const sourceRetentionRange = new Range(this.sourceCursor, retain.length)

    let scanCursor = this.result.length
    if (retain.tracking) {
      // We are modifying existing tracked deletes. We need to treat removal
      // (type insert/none) of a tracked delete as an insertion. Similarly, any
      // range we introduce as a tracked deletion must be reported as a deletion.
      const trackedDeletes = this.trackedChanges
        .asSorted()
        .filter(
          tc =>
            tc.tracking.type === 'delete' &&
            tc.range.overlaps(resultRetentionRange)
        )

      const sourceOffset = this.sourceCursor - this.result.length
      for (const trackedDelete of trackedDeletes) {
        const resultTrackedDelete = trackedDelete.range
        const sourceTrackedDelete = trackedDelete.range.moveBy(sourceOffset)

        if (scanCursor < resultTrackedDelete.start) {
          if (retain.tracking.type === 'delete') {
            this.changes.push({
              d: this.source.slice(
                this.sourceCursor,
                sourceTrackedDelete.start
              ),
              p: this.result.length,
            })
          }
          this.result += this.source.slice(
            this.sourceCursor,
            sourceTrackedDelete.start
          )
          scanCursor = resultTrackedDelete.start
          this.sourceCursor = sourceTrackedDelete.start
        }
        const endOfInsertionResult = Math.min(
          resultTrackedDelete.end,
          resultRetentionRange.end
        )
        const endOfInsertionSource = Math.min(
          sourceTrackedDelete.end,
          sourceRetentionRange.end
        )
        const text = this.source.slice(this.sourceCursor, endOfInsertionSource)
        if (
          retain.tracking.type === 'none' ||
          retain.tracking.type === 'insert'
        ) {
          this.changes.push({
            i: text,
            p: this.result.length,
          })
        }
        this.result += text
        // skip the tracked delete itself
        scanCursor = endOfInsertionResult
        this.sourceCursor = endOfInsertionSource

        if (scanCursor >= resultRetentionRange.end) {
          break
        }
      }
    }
    if (scanCursor < resultRetentionRange.end) {
      // The last region is not a tracked delete. But we should still handle
      // a new tracked delete as a deletion.
      const text = this.source.slice(
        this.sourceCursor,
        sourceRetentionRange.end
      )
      if (retain.tracking?.type === 'delete') {
        this.changes.push({
          d: text,
          p: this.result.length,
        })
      }
      this.result += text
    }
    this.sourceCursor = sourceRetentionRange.end
  }

  /**
   *
   * @param {InsertOp} insert
   */
  applyInsert(insert) {
    if (insert.tracking?.type !== 'delete') {
      // Skip tracked deletions
      this.changes.push({
        i: insert.insertion,
        p: this.result.length,
      })
    }
    this.result += insert.insertion
    // The source cursor doesn't advance
  }

  /**
   *
   * @param {RemoveOp} deletion
   */
  applyDelete(deletion) {
    const sourceDeletionRange = new Range(this.sourceCursor, deletion.length)
    const resultDeletionRange = new Range(this.result.length, deletion.length)

    const trackedDeletes = this.trackedChanges
      .asSorted()
      .filter(
        tc =>
          tc.tracking.type === 'delete' &&
          tc.range.overlaps(resultDeletionRange)
      )
      .sort((a, b) => a.range.start - b.range.start)

    let scanCursor = this.result.length
    const sourceOffset = this.sourceCursor - this.result.length

    for (const trackedDelete of trackedDeletes) {
      const resultTrackDeleteRange = trackedDelete.range
      const sourceTrackDeleteRange = trackedDelete.range.moveBy(sourceOffset)

      if (scanCursor < resultTrackDeleteRange.start) {
        this.changes.push({
          d: this.source.slice(this.sourceCursor, sourceTrackDeleteRange.start),
          p: this.result.length,
        })
      }
      // skip the tracked delete itself
      scanCursor = Math.min(resultTrackDeleteRange.end, resultDeletionRange.end)
      this.sourceCursor = Math.min(
        sourceTrackDeleteRange.end,
        sourceDeletionRange.end
      )

      if (scanCursor >= resultDeletionRange.end) {
        break
      }
    }
    if (scanCursor < resultDeletionRange.end) {
      this.changes.push({
        d: this.source.slice(this.sourceCursor, sourceDeletionRange.end),
        p: this.result.length,
      })
    }
    this.sourceCursor = sourceDeletionRange.end
  }

  finish() {
    if (this.sourceCursor < this.source.length) {
      this.result += this.source.slice(this.sourceCursor)
    }
    for (const op of this.changes) {
      if ('p' in op && typeof op.p === 'number') {
        // Maybe we have to move the position of the deletion to account for
        // tracked changes that we're hiding in the UI.
        op.p -= this.trackedChanges
          .asSorted()
          .filter(tc => tc.tracking.type === 'delete' && tc.range.start < op.p)
          .map(tc => {
            if (tc.range.end < op.p) {
              return tc.range.length
            }
            return op.p - tc.range.start
          })
          .reduce((a, b) => a + b, 0)
      }
    }
  }
}
