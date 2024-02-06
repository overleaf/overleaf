import _ from 'lodash'
import Core from 'overleaf-editor-core'
import * as Errors from './Errors.js'
import * as OperationsCompressor from './OperationsCompressor.js'

export function convertToChanges(projectId, updatesWithBlobs, callback) {
  let changes
  try {
    // convert update to change
    changes = updatesWithBlobs.map(update =>
      _convertToChange(projectId, update)
    )
  } catch (error1) {
    const error = error1
    if (
      error instanceof Errors.UpdateWithUnknownFormatError ||
      error instanceof Errors.UnexpectedOpTypeError
    ) {
      return callback(error)
    } else {
      throw error
    }
  }

  callback(null, changes)
}

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
    const builder = new TextOperationsBuilder(docLength, pathname)
    // convert ops
    for (const op of update.op) {
      builder.addOp(op)
    } // if this throws an exception it will be caught in convertToChanges
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

  change.operations = OperationsCompressor.compressOperations(change.operations)

  return change
}

function _isRenameUpdate(update) {
  return update.new_pathname != null
}

function _isAddDocUpdate(update) {
  return update.doc != null && update.docLines != null
}

function _isAddFileUpdate(update) {
  return update.file != null && update.url != null
}

export function isTextUpdate(update) {
  return (
    update.doc != null &&
    update.op != null &&
    update.meta.pathname != null &&
    update.meta.doc_length != null
  )
}

export function isProjectStructureUpdate(update) {
  return isAddUpdate(update) || _isRenameUpdate(update)
}

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

class TextOperationsBuilder {
  constructor(docLength, pathname) {
    this.operations = []
    this.currentOperation = []
    this.cursor = 0
    this.docLength = docLength
    this.pathname = pathname
  }

  addOp(op) {
    if (op.c != null) {
      return // ignore comment op
    }
    if (op.i == null && op.d == null) {
      throw new Errors.UnexpectedOpTypeError('unexpected op type', { op })
    }

    // We sometimes receive operations that operate at positions outside the
    // docLength. Document updater coerces the position to the end of the
    // document. We do the same here.
    const pos = Math.min(op.p, this.docLength)

    if (pos < this.cursor) {
      this.pushCurrentOperation()
      // At this point, this.cursor === 0 and we can continue
    }

    if (pos > this.cursor) {
      this.retain(pos - this.cursor)
    }

    if (op.i != null) {
      this.insert(op.i)
    }

    if (op.d != null) {
      this.delete(op.d.length)
    }
  }

  retain(length) {
    this.currentOperation.push(length)
    this.cursor += length
  }

  insert(str) {
    this.currentOperation.push(str)
    this.cursor += str.length
    this.docLength += str.length
  }

  delete(length) {
    this.currentOperation.push(-length)
    this.docLength -= length
  }

  pushCurrentOperation() {
    if (this.cursor < this.docLength) {
      this.retain(this.docLength - this.cursor)
    }
    if (this.currentOperation.length > 0) {
      this.operations.push({
        pathname: this.pathname,
        textOperation: this.currentOperation,
      })
      this.currentOperation = []
    }
    this.cursor = 0
  }

  finish() {
    this.pushCurrentOperation()
    return this.operations
  }
}
