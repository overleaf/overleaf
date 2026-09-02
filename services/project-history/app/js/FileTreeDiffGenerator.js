import Core from 'overleaf-editor-core'
import { buildFileTreeDiff } from 'overleaf-editor-core/lib/file_tree_diff.js'
import * as Errors from './Errors.js'

/**
 * @import { FileTreeDiffEntry } from 'overleaf-editor-core/lib/file_tree_diff'
 * @import { Snapshot } from 'overleaf-editor-core'
 */

/**
 * One file of the diff. Files without an operation are unchanged.
 *
 * @typedef {object} FileTreeDiffFile
 * @property {string} pathname the pathname of the file at fromVersion, or the
 *           pathname it was added at
 * @property {string} [newPathname] the pathname of a renamed file at toVersion
 * @property {'added' | 'edited' | 'renamed' | 'removed'} [operation]
 * @property {number} [deletedAtV] version a removed file was removed at
 * @property {boolean | null} [editable] null when it is not known
 */

/**
 * Describe how the file tree changed between two versions of a chunk.
 *
 * @param {object} rawChunk chunk covering fromVersion to toVersion
 * @param {number} fromVersion
 * @param {number} toVersion
 * @return {FileTreeDiffFile[]} one entry per file
 */
export function buildDiff(rawChunk, fromVersion, toVersion) {
  const chunk = Core.Chunk.fromRaw(rawChunk.chunk)
  const chunkStartVersion = chunk.getStartVersion()
  const changes = chunk.getChanges()

  // The chunk starts at chunkStartVersion, so bring its snapshot forward to the
  // file tree at fromVersion, which the diff is reported against.
  const initialSnapshot = chunk.getSnapshot()
  initialSnapshot.applyAll(changes.slice(0, fromVersion - chunkStartVersion))

  const { entries } = buildFileTreeDiff(
    changes.slice(
      fromVersion - chunkStartVersion,
      toVersion - chunkStartVersion
    ),
    {
      initialPathnames: initialSnapshot.getFilePathnames(),
      onMoveCollision: (entry, operation) => {
        throw new Errors.InconsistentChunkError(
          'trying to move to file that already exists',
          {
            pathname: operation.getPathname(),
            newPathname: operation.getNewPathname(),
          }
        )
      },
    }
  )

  return Array.from(entries.values(), entry =>
    _buildDiffEntry(entry, initialSnapshot, fromVersion)
  )
}

/**
 * @param {FileTreeDiffEntry} entry
 * @param {Snapshot} initialSnapshot file tree at fromVersion
 * @param {number} fromVersion
 * @return {FileTreeDiffFile}
 */
function _buildDiffEntry(entry, initialSnapshot, fromVersion) {
  const { origin } = entry
  const pathname = entry.chain[entry.chain.length - 1]
  const renamed = origin != null && pathname !== origin

  /** @type {FileTreeDiffFile} */
  const diffEntry = { pathname: origin ?? pathname }
  if (renamed) {
    diffEntry.newPathname = pathname
  }
  if (entry.deletedAtChangeIndex != null) {
    diffEntry.operation = 'removed'
    diffEntry.deletedAtV = fromVersion + entry.deletedAtChangeIndex
  } else if (origin == null) {
    diffEntry.operation = 'added'
  } else if (renamed) {
    diffEntry.operation = 'renamed'
  } else if (entry.edited) {
    diffEntry.operation = 'edited'
  }

  // Report the editability of the file, so that the frontend knows whether it
  // can display a diff for it. It is left out for files that were edited before
  // anything else happened to them: an edit implies that the file is editable.
  const editedFirst = entry.file == null && entry.firstEditedAtChainIndex === 0
  const file =
    entry.file ?? (origin != null ? initialSnapshot.getFile(origin) : null)
  if (file != null && !editedFirst) {
    diffEntry.editable = file.isEditable()
  }

  return diffEntry
}
