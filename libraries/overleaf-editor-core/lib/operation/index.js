'use strict'

const _ = require('lodash')
const assert = require('check-types').assert
const EditOperationTransformer = require('./edit_operation_transformer')

// Dependencies are loaded at the bottom of the file to mitigate circular
// dependency
let NoOperation = null
let AddFileOperation = null
let MoveFileOperation = null
let EditFileOperation = null
let SetFileMetadataOperation = null

/**
 * @import { ReadonlyBlobStore } from "../types"
 * @import Snapshot from "../snapshot"
 */

/**
 * An `Operation` changes a `Snapshot` when it is applied. See the
 * {@tutorial OT} tutorial for background.
 */
class Operation {
  /**
   * Deserialize an Operation.
   *
   * @param {Object} raw
   * @return {Operation} one of the subclasses
   */
  static fromRaw(raw) {
    if ('file' in raw) {
      return AddFileOperation.fromRaw(raw)
    }
    if (
      'textOperation' in raw ||
      'commentId' in raw ||
      'deleteComment' in raw
    ) {
      return EditFileOperation.fromRaw(raw)
    }
    if ('newPathname' in raw) {
      return new MoveFileOperation(raw.pathname, raw.newPathname)
    }
    if ('metadata' in raw) {
      return new SetFileMetadataOperation(raw.pathname, raw.metadata)
    }
    if (_.isEmpty(raw)) {
      return new NoOperation()
    }
    throw new Error('invalid raw operation ' + JSON.stringify(raw))
  }

  /**
   * Serialize an Operation.
   *
   * @return {Object}
   */
  toRaw() {
    return {}
  }

  /**
   * Whether this operation does nothing when applied.
   *
   * @return {Boolean}
   */
  isNoOp() {
    return false
  }

  /**
   * If this Operation references blob hashes, add them to the given Set.
   *
   * @param  {Set.<String>} blobHashes
   */
  findBlobHashes(blobHashes) {}

  /**
   * If this operation references any files, load the files.
   *
   * @param {string} kind see {File#load}
   * @param {ReadOnlyBlobStore} blobStore
   * @return {Promise<void>}
   */
  async loadFiles(kind, blobStore) {}

  /**
   * Return a version of this operation that is suitable for long term storage.
   * In most cases, we just need to convert the operation to raw form, but if
   * the operation involves File objects, we may need to store their content.
   *
   * @param {BlobStore} blobStore
   * @return {Promise.<Object>}
   */
  async store(blobStore) {
    return this.toRaw()
  }

  /**
   * Apply this Operation to a snapshot.
   *
   * The snapshot is modified in place.
   *
   * @param {Snapshot} snapshot
   */
  applyTo(snapshot) {
    assert.object(snapshot, 'bad snapshot')
  }

  /**
   * Whether this operation can be composed with another operation to produce a
   * single operation of the same type as this one, while keeping the composed
   * operation small and logical enough to be used in the undo stack.
   *
   * @param {Operation} other
   * @return {Boolean}
   */
  canBeComposedWithForUndo(other) {
    return false
  }

  /**
   * Whether this operation can be composed with another operation to produce a
   * single operation of the same type as this one.
   *
   * TODO Moves can be composed. For example, if you rename a to b and then decide
   * shortly after that actually you want to call it c, we could compose the two
   * to get a -> c). Edits can also be composed --- see rules in TextOperation.
   * We also need to consider the Change --- we will need to consider both time
   * and author(s) when composing changes. I guess that AddFile can also be
   * composed in some cases --- if you upload a file and then decide it was the
   * wrong one and upload a new one, we could drop the one in the middle, but
   * that seems like a pretty rare case.
   *
   * @param {Operation} other
   * @return {Boolean}
   */
  canBeComposedWith(other) {
    return false
  }

  /**
   * Compose this operation with another operation to produce a single operation
   * of the same type as this one.
   *
   * @param {Operation} other
   * @return {Operation}
   */
  compose(other) {
    throw new Error('not implemented')
  }

  /**
   * Transform takes two operations A and B that happened concurrently and
   * produces two operations A' and B' (in an array) such that
   * `apply(apply(S, A), B') = apply(apply(S, B), A')`.
   *
   * That is, if one client applies A and then B', they get the same result as
   * another client who applies B and then A'.
   *
   * @param {Operation} a
   * @param {Operation} b
   * @return {Operation[]} operations `[a', b']`
   */
  static transform(a, b) {
    if (a.isNoOp() || b.isNoOp()) return [a, b]

    function transpose(transformer) {
      return transformer(b, a).reverse()
    }

    const bIsAddFile = b instanceof AddFileOperation
    const bIsEditFile = b instanceof EditFileOperation
    const bIsMoveFile = b instanceof MoveFileOperation
    const bIsSetFileMetadata = b instanceof SetFileMetadataOperation

    if (a instanceof AddFileOperation) {
      if (bIsAddFile) return transformAddFileAddFile(a, b)
      if (bIsMoveFile) return transformAddFileMoveFile(a, b)
      if (bIsEditFile) return transformAddFileEditFile(a, b)
      if (bIsSetFileMetadata) return transformAddFileSetFileMetadata(a, b)
      throw new Error('bad op b')
    }
    if (a instanceof MoveFileOperation) {
      if (bIsAddFile) return transpose(transformAddFileMoveFile)
      if (bIsMoveFile) return transformMoveFileMoveFile(a, b)
      if (bIsEditFile) return transformMoveFileEditFile(a, b)
      if (bIsSetFileMetadata) return transformMoveFileSetFileMetadata(a, b)
      throw new Error('bad op b')
    }
    if (a instanceof EditFileOperation) {
      if (bIsAddFile) return transpose(transformAddFileEditFile)
      if (bIsMoveFile) return transpose(transformMoveFileEditFile)
      if (bIsEditFile) return transformEditFileEditFile(a, b)
      if (bIsSetFileMetadata) return transformEditFileSetFileMetadata(a, b)
      throw new Error('bad op b')
    }
    if (a instanceof SetFileMetadataOperation) {
      if (bIsAddFile) return transpose(transformAddFileSetFileMetadata)
      if (bIsMoveFile) return transpose(transformMoveFileSetFileMetadata)
      if (bIsEditFile) return transpose(transformEditFileSetFileMetadata)
      if (bIsSetFileMetadata) return transformSetFileMetadatas(a, b)
      throw new Error('bad op b')
    }
    throw new Error('bad op a')
  }

  /**
   * Transform each operation in `a` by each operation in `b` and save the primed
   * operations in place.
   *
   * @param {Array.<Operation>} as - modified in place
   * @param {Array.<Operation>} bs - modified in place
   */
  static transformMultiple(as, bs) {
    for (let i = 0; i < as.length; ++i) {
      for (let j = 0; j < bs.length; ++j) {
        const primes = Operation.transform(as[i], bs[j])
        as[i] = primes[0]
        bs[j] = primes[1]
      }
    }
  }

  static addFile(pathname, file) {
    return new AddFileOperation(pathname, file)
  }

  static editFile(pathname, editOperation) {
    return new EditFileOperation(pathname, editOperation)
  }

  static moveFile(pathname, newPathname) {
    return new MoveFileOperation(pathname, newPathname)
  }

  static removeFile(pathname) {
    return new MoveFileOperation(pathname, '')
  }

  static setFileMetadata(pathname, metadata) {
    return new SetFileMetadataOperation(pathname, metadata)
  }
}

//
// Transform
//
// The way to read these transform functions is that
// 1. return_value[0] is the op to be applied after arguments[1], and
// 2. return_value[1] is the op to be applied after arguments[0],
// in order to arrive at the same project state.
//

function transformAddFileAddFile(add1, add2) {
  if (add1.getPathname() === add2.getPathname()) {
    return [Operation.NO_OP, add2] // add2 wins
  }

  return [add1, add2]
}

function transformAddFileMoveFile(add, move) {
  function relocateAddFile() {
    return new AddFileOperation(move.getNewPathname(), add.getFile().clone())
  }

  if (add.getPathname() === move.getPathname()) {
    if (move.isRemoveFile()) {
      return [add, Operation.NO_OP]
    }
    return [
      relocateAddFile(),
      new MoveFileOperation(add.getPathname(), move.getNewPathname()),
    ]
  }

  if (add.getPathname() === move.getNewPathname()) {
    return [relocateAddFile(), new MoveFileOperation(move.getPathname(), '')]
  }

  return [add, move]
}

function transformAddFileEditFile(add, edit) {
  if (add.getPathname() === edit.getPathname()) {
    return [add, Operation.NO_OP] // the add wins
  }

  return [add, edit]
}

function transformAddFileSetFileMetadata(add, set) {
  if (add.getPathname() === set.getPathname()) {
    const newFile = add.getFile().clone()
    newFile.setMetadata(set.getMetadata())
    return [new AddFileOperation(add.getPathname(), newFile), set]
  }

  return [add, set]
}

//
// This is one of the trickier ones. There are 15 possible equivalence
// relationships between our four variables:
//
// path1, newPath1, path2, newPath2    --- "same move" (all equal)
//
// path1, newPath1, path2 | newPath2   --- "no-ops" (1)
// path1, newPath1, newPath2 | path2   --- "no-ops" (1)
// path1, path2, newPath2 | newPath1   --- "no-ops" (2)
// newPath1, path2, newPath2 | path1   --- "no-ops" (2)
//
// path1, newPath1 | path2, newPath2   --- "no-ops" (1 and 2)
// path1, path2 | newPath1, newPath2   --- "same move"
// path1, newPath2 | newPath1, path2   --- "opposite moves"
//
// path1, newPath1 | path2 | newPath2  --- "no-ops" (1)
// path1, path2 | newPath1 | newPath2  --- "divergent moves"
// path1, newPath2 | newPath1 | path2  --- "transitive move"
// newPath1, path2 | path1 | newPath2  --- "transitive move"
// newPath1, newPath2 | path1 | path2  --- "convergent move"
// path2, newPath2 | path1 | newPath1  --- "no-ops" (2)
//
// path1 | newPath1 | path2 | newPath2 --- "no conflict"
//
function transformMoveFileMoveFile(move1, move2) {
  const path1 = move1.getPathname()
  const path2 = move2.getPathname()
  const newPath1 = move1.getNewPathname()
  const newPath2 = move2.getNewPathname()

  // the same move
  if (path1 === path2 && newPath1 === newPath2) {
    return [Operation.NO_OP, Operation.NO_OP]
  }

  // no-ops
  if (path1 === newPath1 && path2 === newPath2) {
    return [Operation.NO_OP, Operation.NO_OP]
  }
  if (path1 === newPath1) {
    return [Operation.NO_OP, move2]
  }
  if (path2 === newPath2) {
    return [move1, Operation.NO_OP]
  }

  // opposite moves (foo -> bar, bar -> foo)
  if (path1 === newPath2 && path2 === newPath1) {
    // We can't handle this very well: if we wanted move2 (say) to win, move2'
    // would have to be addFile(foo) with the content of bar, but we don't have
    // the content of bar available here. So, we just destroy both files.
    return [Operation.removeFile(path1), Operation.removeFile(path2)]
  }

  // divergent moves (foo -> bar, foo -> baz); convention: move2 wins
  if (path1 === path2 && newPath1 !== newPath2) {
    return [Operation.NO_OP, Operation.moveFile(newPath1, newPath2)]
  }

  // convergent move (foo -> baz, bar -> baz); convention: move2 wins
  if (newPath1 === newPath2 && path1 !== path2) {
    return [Operation.removeFile(path1), move2]
  }

  // transitive move:
  //   1: foo -> baz, 2: bar -> foo (result: bar -> baz) or
  //   1: foo -> bar, 2: bar -> baz (result: foo -> baz)
  if (path1 === newPath2 && newPath1 !== path2) {
    return [
      Operation.moveFile(newPath2, newPath1),
      Operation.moveFile(path2, newPath1),
    ]
  }
  if (newPath1 === path2 && path1 !== newPath2) {
    return [
      Operation.moveFile(path1, newPath2),
      Operation.moveFile(newPath1, newPath2),
    ]
  }

  // no conflict
  return [move1, move2]
}

function transformMoveFileEditFile(move, edit) {
  if (move.getPathname() === edit.getPathname()) {
    if (move.isRemoveFile()) {
      // let the remove win
      return [move, Operation.NO_OP]
    }
    return [
      move,
      Operation.editFile(move.getNewPathname(), edit.getOperation()),
    ]
  }

  if (move.getNewPathname() === edit.getPathname()) {
    // let the move win
    return [move, Operation.NO_OP]
  }

  return [move, edit]
}

function transformMoveFileSetFileMetadata(move, set) {
  if (move.getPathname() === set.getPathname()) {
    return [
      move,
      Operation.setFileMetadata(move.getNewPathname(), set.getMetadata()),
    ]
  }
  // A: mv foo -> bar
  // B: set bar.x
  //
  // A': mv foo -> bar
  // B': nothing
  if (move.getNewPathname() === set.getPathname()) {
    return [move, Operation.NO_OP] // let the move win
  }
  return [move, set]
}

function transformEditFileEditFile(edit1, edit2) {
  if (edit1.getPathname() === edit2.getPathname()) {
    const primeOps = EditOperationTransformer.transform(
      edit1.getOperation(),
      edit2.getOperation()
    )
    return [
      Operation.editFile(edit1.getPathname(), primeOps[0]),
      Operation.editFile(edit2.getPathname(), primeOps[1]),
    ]
  }

  return [edit1, edit2]
}

function transformEditFileSetFileMetadata(edit, set) {
  // There is no conflict.
  return [edit, set]
}

function transformSetFileMetadatas(set1, set2) {
  if (set1.getPathname() === set2.getPathname()) {
    return [Operation.NO_OP, set2] // set2 wins
  }
  return [set1, set2]
}

module.exports = Operation

// Work around circular import
NoOperation = require('./no_operation')
AddFileOperation = require('./add_file_operation')
MoveFileOperation = require('./move_file_operation')
EditFileOperation = require('./edit_file_operation')
SetFileMetadataOperation = require('./set_file_metadata_operation')

Operation.NO_OP = new NoOperation()
