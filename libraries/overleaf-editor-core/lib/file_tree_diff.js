// @ts-check
'use strict'

const AddFileOperation = require('./operation/add_file_operation')
const EditFileOperation = require('./operation/edit_file_operation')
const MoveFileOperation = require('./operation/move_file_operation')

/**
 * @import Change from './change'
 * @import File from './file'
 */

/**
 * A file as it is tracked through a window of changes.
 *
 * @typedef {Object} FileTreeDiffEntry
 * @property {string | null} origin the pathname the file had before the window,
 *           or null when the file was added inside the window
 * @property {string[]} chain every pathname the file has occupied, in order.
 *           The first element is `origin` when the file existed before the
 *           window, and the last element is the pathname the file ends up at
 *           (the pathname it was removed from, for removed files).
 * @property {boolean} edited whether an edit operation touched the file
 * @property {number | null} firstEditedAtChainIndex index into `chain` of the
 *           pathname the file was at when it was first edited; null when the
 *           file was never edited
 * @property {File | null} file the file added by the most recent add operation,
 *           null when the file was not added inside the window. Callers that
 *           need the pre-window file look it up in a snapshot by `origin`.
 * @property {number | null} deletedAtChangeIndex index into `changes` of the
 *           change that removed the file from the tree; null while the file is
 *           part of the tree
 */

/**
 * Collapse a window of changes into one entry per file, keyed by the pathname
 * the file ends up at.
 *
 * Chains of moves collapse into a single entry, so a file renamed from `a` to
 * `b` and then to `c` is reported once, at `c`, with `origin` `a`. Only the
 * file tree is folded: the content of edits is not inspected, edits are
 * recorded as a flag on the entry.
 *
 * The fold follows FileMap semantics: adding a file at, or moving a file onto,
 * a pathname that is occupied replaces the file that was there. A replaced file
 * is reported as removed.
 *
 * Files that exist before the window are only known through
 * `options.initialPathnames`. When it is given, the set of pathnames is
 * authoritative: moves and removals of pathnames that are neither seeded nor
 * added inside the window are skipped, because there is no file to move or
 * remove. When it is omitted, any pathname an operation refers to is assumed to
 * have existed before the window, and an entry is created for it on demand. An
 * edit is always recorded, on an entry created on demand if need be.
 *
 * @param {Change[]} changes in order
 * @param {object} [options]
 * @param {Iterable<string>} [options.initialPathnames] pathnames present before
 *        the window. Entries are reported in this order, followed by the
 *        pathnames that the window makes use of.
 * @param {(entry: FileTreeDiffEntry, operation: MoveFileOperation) => void}
 *        [options.onMoveCollision] called before a move replaces the file at
 *        its target pathname, so that callers that consider this inconsistent
 *        can throw
 * @return {{
 *   entries: Map<string, FileTreeDiffEntry>,
 *   removed: FileTreeDiffEntry[],
 * }} `entries` is the state of the file tree at the end of the window, keyed by
 *    pathname: an entry with a `deletedAtChangeIndex` is a file that was
 *    removed from that pathname and that nothing has taken the place of since.
 *    `removed` is every file that left the tree during the window, in the order
 *    they left it, including the files that another file has since taken the
 *    place of.
 */
function buildFileTreeDiff(
  changes,
  { initialPathnames, onMoveCollision } = {}
) {
  const seeded = initialPathnames != null
  /** @type {Map<string, FileTreeDiffEntry>} */
  const entries = new Map()
  /** @type {FileTreeDiffEntry[]} */
  const removed = []

  if (initialPathnames != null) {
    for (const pathname of initialPathnames) {
      entries.set(pathname, existingFileEntry(pathname))
    }
  }

  /**
   * The file at the given pathname, if the tree has one.
   *
   * @param {string} pathname
   * @return {FileTreeDiffEntry | undefined}
   */
  function getLiveEntry(pathname) {
    const entry = entries.get(pathname)
    if (entry != null && entry.deletedAtChangeIndex == null) return entry
  }

  /**
   * Record the file at the given pathname as removed, without freeing up the
   * pathname: callers that replace the file set the new entry themselves, which
   * keeps the position of the pathname in `entries`.
   *
   * @param {string} pathname
   * @param {number} changeIndex
   */
  function removeLiveEntry(pathname, changeIndex) {
    const entry = getLiveEntry(pathname)
    if (entry == null) return
    entry.deletedAtChangeIndex = changeIndex
    removed.push(entry)
  }

  for (const [changeIndex, change] of changes.entries()) {
    for (const operation of change.getOperations()) {
      if (operation instanceof AddFileOperation) {
        const pathname = operation.getPathname()
        if (!pathname) continue
        removeLiveEntry(pathname, changeIndex)
        entries.set(pathname, addedFileEntry(pathname, operation.getFile()))
      } else if (operation instanceof EditFileOperation) {
        const pathname = operation.getPathname()
        if (!pathname) continue
        let entry = entries.get(pathname)
        if (entry == null) {
          entry = existingFileEntry(pathname)
          entries.set(pathname, entry)
        } else if (entry.deletedAtChangeIndex != null) {
          // The file has been removed, there is nothing to edit.
          continue
        }
        if (!entry.edited) {
          entry.edited = true
          entry.firstEditedAtChainIndex = entry.chain.length - 1
        }
      } else if (operation instanceof MoveFileOperation) {
        const pathname = operation.getPathname()
        if (!pathname) continue
        const newPathname = operation.getNewPathname()
        if (operation.isRemoveFile()) {
          if (!seeded && !entries.has(pathname)) {
            entries.set(pathname, existingFileEntry(pathname))
          }
          removeLiveEntry(pathname, changeIndex)
        } else if (pathname !== newPathname) {
          const target = getLiveEntry(newPathname)
          if (target != null && onMoveCollision != null) {
            onMoveCollision(target, operation)
          }
          let entry = getLiveEntry(pathname)
          if (entry == null) {
            // Only a pathname that the window has not made use of can be
            // assumed to have held a file before the window.
            if (seeded || entries.has(pathname)) continue
            entry = existingFileEntry(pathname)
          }
          removeLiveEntry(newPathname, changeIndex)
          entry.chain.push(newPathname)
          entries.set(newPathname, entry)
          entries.delete(pathname)
        }
      }
    }
  }

  return { entries, removed }
}

/**
 * An entry for a file that was there before the window.
 *
 * @param {string} pathname
 * @return {FileTreeDiffEntry}
 */
function existingFileEntry(pathname) {
  return {
    origin: pathname,
    chain: [pathname],
    edited: false,
    firstEditedAtChainIndex: null,
    file: null,
    deletedAtChangeIndex: null,
  }
}

/**
 * An entry for a file that an add operation created inside the window.
 *
 * @param {string} pathname
 * @param {File} file
 * @return {FileTreeDiffEntry}
 */
function addedFileEntry(pathname, file) {
  return {
    origin: null,
    chain: [pathname],
    edited: false,
    firstEditedAtChainIndex: null,
    file,
    deletedAtChangeIndex: null,
  }
}

module.exports = { buildFileTreeDiff }
