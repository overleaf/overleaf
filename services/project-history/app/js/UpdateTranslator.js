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
    const builder = new TextOperationsBuilder(update.doc, docLength, pathname)
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

  const rawChange = {
    operations,
    v2Authors: _.compact([update.meta.user_id]),
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
  // See https://github.com/overleaf/sharelatex/issues/900
  pathname = pathname.replace(/\*/g, '__ASTERISK__')
  // workaround for filenames beginning with spaces
  // See https://github.com/overleaf/sharelatex/issues/1404
  // note: we have already stripped any leading slash above
  pathname = pathname.replace(/^ /, '__SPACE__') // handle top-level
  pathname = pathname.replace(/\/ /g, '/__SPACE__') // handle folders
  return pathname
}

class TextOperationsBuilder {
  constructor(docId, docLength, pathname) {
    this.operations = []
    this.doc_id = docId
    this.doc_length = docLength
    this.pathname = pathname
  }

  addOp(op) {
    let retain
    if (op.c != null) {
      return // ignore comment op
    }
    if (op.i == null && op.d == null) {
      throw new Errors.UnexpectedOpTypeError('unexpected op type', { op })
    }

    // We sometimes receive operations that operate at positions outside the
    // doc_length. Document updater coerces the position to the end of the
    // document. We do the same here.
    const pos = Math.min(op.p, this.doc_length)

    const textOperation = []
    if (pos > 0) {
      textOperation.push(pos)
    }

    if (op.i != null) {
      textOperation.push(op.i)
      retain = this.doc_length - pos
      this.doc_length += op.i.length
    }

    if (op.d != null) {
      textOperation.push(-op.d.length)
      retain = this.doc_length - pos - op.d.length
      this.doc_length -= op.d.length
    }

    if (retain > 0) {
      textOperation.push(retain)
    }
    this.pushTextOperation(textOperation)
  }

  pushTextOperation(textOperation) {
    this.operations.push({
      pathname: this.pathname,
      textOperation,
    })
  }

  finish() {
    return this.operations
  }
}
