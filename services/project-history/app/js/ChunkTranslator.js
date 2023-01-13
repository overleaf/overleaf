import _ from 'lodash'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as WebApiManager from './WebApiManager.js'
import * as Errors from './Errors.js'

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
    // want to get the first file in the range fromVersion:toVersion
    // that has the pathname we want. Note that this might not exist yet
    // at fromVersion, so we'll just settle for the first one we find
    // after that.
    if (fromVersion <= version && version <= toVersion) {
      if (file == null) {
        file = builder.getFile(pathname)
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
    if (file == null) {
      file = builder.getFile(pathname)
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
      this.applyOperation(op, timestamp, authors)
    }

    this.currentUpdate.pathnames = Array.from(this.currentUpdate.pathnames)
    this.summarizedUpdates.push(this.currentUpdate)

    this.version += 1
  }

  applyOperation(op, timestamp, authors) {
    if (UpdateSetBuilder._isTextOperation(op)) {
      this.applyTextOperation(op, timestamp, authors)
    } else if (UpdateSetBuilder._isRenameOperation(op)) {
      this.applyRenameOperation(op, timestamp, authors)
    } else if (UpdateSetBuilder._isRemoveFileOperation(op)) {
      this.applyRemoveFileOperation(op, timestamp, authors)
    } else if (UpdateSetBuilder._isAddFileOperation(op)) {
      this.applyAddFileOperation(op, timestamp, authors)
    }
  }

  applyTextOperation(operation, timestamp, authors) {
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

    file.applyTextOperation(authors, timestamp, this.version, operation)
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

class File {
  constructor(pathname, snapshot, initialVersion) {
    this.pathname = pathname
    this.snapshot = snapshot
    this.initialVersion = initialVersion
    this.operations = []
  }

  applyTextOperation(authors, timestamp, version, operation) {
    this.operations.push({ authors, timestamp, version, operation })
  }

  rename(pathname) {
    this.pathname = pathname
  }

  getDiffUpdates(historyId, fromVersion, toVersion, callback) {
    if (this.snapshot.stringLength == null) {
      // Binary file
      return callback(null, { binary: true })
    }
    HistoryStoreManager.getProjectBlob(
      historyId,
      this.snapshot.hash,
      (error, content) => {
        if (error != null) {
          return callback(OError.tag(error))
        }
        let initialContent = content
        const updates = []
        for (let operation of this.operations) {
          let authors, ops, timestamp, version
          ;({ authors, timestamp, version, operation } = operation)
          ;({ content, ops } = this._convertTextOperation(content, operation))

          // Keep updating our initialContent, until we're actually in the version
          // we want to diff, at which point initialContent is the content just before
          // the diff updates we will return
          if (version < fromVersion) {
            initialContent = content
          }

          // We only need to return the updates between fromVersion and toVersion
          if (fromVersion <= version && version < toVersion) {
            updates.push({
              meta: {
                users: authors,
                start_ts: timestamp.getTime(),
                end_ts: timestamp.getTime(),
              },
              v: version,
              op: ops,
            })
          }
        }

        callback(null, { initialContent, updates })
      }
    )
  }

  _convertTextOperation(content, operation) {
    const textUpdateBuilder = new TextUpdateBuilder(content)
    for (const op of operation.textOperation || []) {
      textUpdateBuilder.applyOp(op)
    }
    textUpdateBuilder.finish()
    return {
      content: textUpdateBuilder.result,
      ops: textUpdateBuilder.changes,
    }
  }
}

class TextUpdateBuilder {
  constructor(source) {
    this.source = source
    this.sourceCursor = 0
    this.result = ''
    this.changes = []
  }

  applyOp(op) {
    if (TextUpdateBuilder._isRetainOperation(op)) {
      this.applyRetain(op)
    }

    if (TextUpdateBuilder._isInsertOperation(op)) {
      this.applyInsert(op)
    }

    if (TextUpdateBuilder._isDeleteOperation(op)) {
      this.applyDelete(-op)
    }
  }

  applyRetain(offset) {
    this.result += this.source.slice(
      this.sourceCursor,
      this.sourceCursor + offset
    )
    this.sourceCursor += offset
  }

  applyInsert(content) {
    this.changes.push({
      i: content,
      p: this.result.length,
    })
    this.result += content
    // The source cursor doesn't advance
  }

  applyDelete(offset) {
    const deletedContent = this.source.slice(
      this.sourceCursor,
      this.sourceCursor + offset
    )

    this.changes.push({
      d: deletedContent,
      p: this.result.length,
    })

    this.sourceCursor += offset
  }

  finish() {
    if (this.sourceCursor < this.source.length) {
      this.result += this.source.slice(this.sourceCursor)
    }
  }

  static _isRetainOperation(op) {
    return typeof op === 'number' && op > 0
  }

  static _isInsertOperation(op) {
    return typeof op === 'string'
  }

  static _isDeleteOperation(op) {
    return typeof op === 'number' && op < 0
  }
}
