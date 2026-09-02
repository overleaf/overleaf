// @ts-check
'use strict'

const { expect } = require('chai')
const sinon = require('sinon')

const { buildFileTreeDiff } = require('../../lib/file_tree_diff')
const Change = require('../../lib/change')
const File = require('../../lib/file')
const Operation = require('../../lib/operation')
const TextOperation = require('../../lib/operation/text_operation')

/**
 * @import { FileTreeDiffEntry } from '../../lib/file_tree_diff'
 */

const TS = new Date('2026-07-10T00:00:00.000Z')

/** @param {Operation[]} operations */
const change = (...operations) => new Change(operations, TS)

const addFile = (pathname, content = 'content') =>
  Operation.addFile(pathname, File.fromString(content))
const editFile = pathname =>
  Operation.editFile(pathname, new TextOperation().insert('x'))
const moveFile = (pathname, newPathname) =>
  Operation.moveFile(pathname, newPathname)
const removeFile = pathname => Operation.removeFile(pathname)

/**
 * The shape the test cases below are written in.
 *
 * @param {string} pathname
 * @param {Object} [overrides]
 */
function summary(pathname, overrides = {}) {
  return {
    pathname,
    origin: pathname,
    chain: [pathname],
    edited: false,
    firstEditedAtChainIndex: null,
    hasFile: false,
    deletedAtChangeIndex: null,
    ...overrides,
  }
}

/**
 * @param {FileTreeDiffEntry} entry
 */
function summarize(entry) {
  return {
    pathname: entry.chain[entry.chain.length - 1],
    origin: entry.origin,
    chain: entry.chain,
    edited: entry.edited,
    firstEditedAtChainIndex: entry.firstEditedAtChainIndex,
    hasFile: entry.file != null,
    deletedAtChangeIndex: entry.deletedAtChangeIndex,
  }
}

/**
 * @param {Map<string, FileTreeDiffEntry>} entries
 */
function summarizeEntries(entries) {
  return Array.from(entries, ([pathname, entry]) => {
    expect(pathname).to.equal(entry.chain[entry.chain.length - 1])
    return summarize(entry)
  })
}

describe('buildFileTreeDiff', function () {
  const testCases = [
    {
      name: 'reports the files that the window leaves untouched',
      initialPathnames: ['a.tex', 'b.tex'],
      changes: [],
      entries: [summary('a.tex'), summary('b.tex')],
      removed: [],
    },
    {
      name: 'collapses a chain of moves into a single entry',
      initialPathnames: ['a.tex'],
      changes: [
        change(moveFile('a.tex', 'b.tex')),
        change(moveFile('b.tex', 'c.tex')),
      ],
      entries: [
        summary('c.tex', {
          origin: 'a.tex',
          chain: ['a.tex', 'b.tex', 'c.tex'],
        }),
      ],
      removed: [],
    },
    {
      name: 'records the pathnames of a file that is moved and then removed',
      initialPathnames: ['a.tex'],
      changes: [
        change(moveFile('a.tex', 'b.tex')),
        change(removeFile('b.tex')),
      ],
      entries: [
        summary('b.tex', {
          origin: 'a.tex',
          chain: ['a.tex', 'b.tex'],
          deletedAtChangeIndex: 1,
        }),
      ],
      removed: [
        summary('b.tex', {
          origin: 'a.tex',
          chain: ['a.tex', 'b.tex'],
          deletedAtChangeIndex: 1,
        }),
      ],
    },
    {
      name: 'reports a file that is added and then moved at its new pathname',
      initialPathnames: [],
      changes: [change(addFile('a.tex')), change(moveFile('a.tex', 'b.tex'))],
      entries: [
        summary('b.tex', {
          origin: null,
          chain: ['a.tex', 'b.tex'],
          hasFile: true,
        }),
      ],
      removed: [],
    },
    {
      name: 'reports a file that is added and then removed as removed',
      initialPathnames: [],
      changes: [change(addFile('a.tex')), change(removeFile('a.tex'))],
      entries: [
        summary('a.tex', {
          origin: null,
          hasFile: true,
          deletedAtChangeIndex: 1,
        }),
      ],
      removed: [
        summary('a.tex', {
          origin: null,
          hasFile: true,
          deletedAtChangeIndex: 1,
        }),
      ],
    },
    {
      name: 'reports a file that is removed and then added again as added',
      initialPathnames: ['a.tex'],
      changes: [change(removeFile('a.tex')), change(addFile('a.tex'))],
      entries: [summary('a.tex', { origin: null, hasFile: true })],
      removed: [summary('a.tex', { deletedAtChangeIndex: 0 })],
    },
    {
      name: 'reports a file that another file is moved onto as removed',
      initialPathnames: ['a.tex', 'b.tex'],
      changes: [change(moveFile('a.tex', 'b.tex'))],
      entries: [
        summary('b.tex', { origin: 'a.tex', chain: ['a.tex', 'b.tex'] }),
      ],
      removed: [summary('b.tex', { deletedAtChangeIndex: 0 })],
    },
    {
      name: 'reports a file that another file is added over as removed',
      initialPathnames: ['a.tex'],
      changes: [change(addFile('a.tex'))],
      entries: [summary('a.tex', { origin: null, hasFile: true })],
      removed: [summary('a.tex', { deletedAtChangeIndex: 0 })],
    },
    {
      name: 'reports a file that is moved onto a pathname removed earlier in the window',
      initialPathnames: ['a.tex', 'b.tex'],
      changes: [
        change(removeFile('a.tex')),
        change(moveFile('b.tex', 'a.tex')),
      ],
      entries: [
        summary('a.tex', { origin: 'b.tex', chain: ['b.tex', 'a.tex'] }),
      ],
      removed: [summary('a.tex', { deletedAtChangeIndex: 0 })],
    },
    {
      name: 'records an edit of a file that is moved afterwards',
      initialPathnames: ['a.tex'],
      changes: [change(editFile('a.tex')), change(moveFile('a.tex', 'b.tex'))],
      entries: [
        summary('b.tex', {
          origin: 'a.tex',
          chain: ['a.tex', 'b.tex'],
          edited: true,
          firstEditedAtChainIndex: 0,
        }),
      ],
      removed: [],
    },
    {
      name: 'records an edit of a file that was moved before',
      initialPathnames: ['a.tex'],
      changes: [change(moveFile('a.tex', 'b.tex')), change(editFile('b.tex'))],
      entries: [
        summary('b.tex', {
          origin: 'a.tex',
          chain: ['a.tex', 'b.tex'],
          edited: true,
          firstEditedAtChainIndex: 1,
        }),
      ],
      removed: [],
    },
    {
      name: 'records the first of several edits',
      initialPathnames: ['a.tex'],
      changes: [
        change(editFile('a.tex')),
        change(moveFile('a.tex', 'b.tex')),
        change(editFile('b.tex')),
      ],
      entries: [
        summary('b.tex', {
          origin: 'a.tex',
          chain: ['a.tex', 'b.tex'],
          edited: true,
          firstEditedAtChainIndex: 0,
        }),
      ],
      removed: [],
    },
    {
      name: 'creates an entry for an edit of a pathname it has not seen',
      initialPathnames: [],
      changes: [change(editFile('a.tex'))],
      entries: [summary('a.tex', { edited: true, firstEditedAtChainIndex: 0 })],
      removed: [],
    },
    {
      name: 'ignores an edit of a removed file',
      initialPathnames: ['a.tex'],
      changes: [change(removeFile('a.tex')), change(editFile('a.tex'))],
      entries: [summary('a.tex', { deletedAtChangeIndex: 0 })],
      removed: [summary('a.tex', { deletedAtChangeIndex: 0 })],
    },
    {
      name: 'resolves a swap of two files by their pathnames',
      initialPathnames: ['a.tex', 'b.tex'],
      changes: [
        change(moveFile('a.tex', 'tmp.tex')),
        change(moveFile('b.tex', 'a.tex')),
        change(moveFile('tmp.tex', 'b.tex')),
      ],
      entries: [
        summary('a.tex', { origin: 'b.tex', chain: ['b.tex', 'a.tex'] }),
        summary('b.tex', {
          origin: 'a.tex',
          chain: ['a.tex', 'tmp.tex', 'b.tex'],
        }),
      ],
      removed: [],
    },
    {
      name: 'skips a move of a pathname that holds no file',
      initialPathnames: ['a.tex'],
      changes: [change(moveFile('missing.tex', 'b.tex'))],
      entries: [summary('a.tex')],
      removed: [],
    },
    {
      name: 'skips a removal of a pathname that holds no file',
      initialPathnames: ['a.tex'],
      changes: [change(removeFile('missing.tex'))],
      entries: [summary('a.tex')],
      removed: [],
    },
    {
      name: 'skips operations without a pathname',
      initialPathnames: [],
      changes: [
        change(
          editFile(''),
          moveFile('', 'a.tex'),
          removeFile(''),
          addFile('')
        ),
      ],
      entries: [],
      removed: [],
    },
    {
      name: 'ignores operations that leave the file tree unchanged',
      initialPathnames: ['a.tex'],
      changes: [
        change(
          Operation.setFileMetadata('a.tex', { main: true }),
          moveFile('a.tex', 'a.tex'),
          Operation.NO_OP
        ),
      ],
      entries: [summary('a.tex')],
      removed: [],
    },
    {
      name: 'folds the operations of a single change in order',
      initialPathnames: ['a.tex'],
      changes: [
        change(moveFile('a.tex', 'b.tex'), addFile('a.tex'), editFile('b.tex')),
      ],
      entries: [
        summary('b.tex', {
          origin: 'a.tex',
          chain: ['a.tex', 'b.tex'],
          edited: true,
          firstEditedAtChainIndex: 1,
        }),
        summary('a.tex', { origin: null, hasFile: true }),
      ],
      removed: [],
    },
    {
      name: 'reports the index of the change that removed a file',
      initialPathnames: ['a.tex', 'b.tex'],
      changes: [
        change(editFile('a.tex')),
        change(removeFile('b.tex')),
        change(removeFile('a.tex')),
      ],
      entries: [
        summary('a.tex', {
          edited: true,
          firstEditedAtChainIndex: 0,
          deletedAtChangeIndex: 2,
        }),
        summary('b.tex', { deletedAtChangeIndex: 1 }),
      ],
      removed: [
        summary('b.tex', { deletedAtChangeIndex: 1 }),
        summary('a.tex', {
          edited: true,
          firstEditedAtChainIndex: 0,
          deletedAtChangeIndex: 2,
        }),
      ],
    },
  ]

  for (const testCase of testCases) {
    it(testCase.name, function () {
      const { entries, removed } = buildFileTreeDiff(testCase.changes, {
        initialPathnames: testCase.initialPathnames,
      })
      expect(summarizeEntries(entries)).to.deep.equal(testCase.entries)
      expect(removed.map(summarize)).to.deep.equal(testCase.removed)
    })
  }

  it('keeps the file of the most recent add', function () {
    const file = File.fromString('final')
    const { entries } = buildFileTreeDiff(
      [
        change(addFile('a.tex', 'first')),
        change(Operation.addFile('a.tex', file)),
        change(moveFile('a.tex', 'b.tex')),
      ],
      { initialPathnames: [] }
    )
    expect(entries.get('b.tex')?.file).to.equal(file)
  })

  describe('without initialPathnames', function () {
    it('assumes that a moved file existed before the window', function () {
      const { entries, removed } = buildFileTreeDiff([
        change(moveFile('a.tex', 'b.tex')),
        change(moveFile('b.tex', 'c.tex')),
      ])
      expect(summarizeEntries(entries)).to.deep.equal([
        summary('c.tex', {
          origin: 'a.tex',
          chain: ['a.tex', 'b.tex', 'c.tex'],
        }),
      ])
      expect(removed).to.deep.equal([])
    })

    it('assumes that a removed file existed before the window', function () {
      const { entries, removed } = buildFileTreeDiff([
        change(removeFile('a.tex')),
      ])
      expect(summarizeEntries(entries)).to.deep.equal([
        summary('a.tex', { deletedAtChangeIndex: 0 }),
      ])
      expect(removed.map(summarize)).to.deep.equal([
        summary('a.tex', { deletedAtChangeIndex: 0 }),
      ])
    })

    it('has no file to report as removed at the target of a move', function () {
      const { entries, removed } = buildFileTreeDiff([
        change(moveFile('a.tex', 'b.tex')),
      ])
      expect(summarizeEntries(entries)).to.deep.equal([
        summary('b.tex', { origin: 'a.tex', chain: ['a.tex', 'b.tex'] }),
      ])
      expect(removed.map(summarize)).to.deep.equal([])
    })
  })

  describe('onMoveCollision', function () {
    it('is called with the file at the target pathname before it is replaced', function () {
      const calls = []
      const operation = moveFile('a.tex', 'b.tex')
      const { entries } = buildFileTreeDiff([change(operation)], {
        initialPathnames: ['a.tex', 'b.tex'],
        onMoveCollision: (entry, movedBy) => {
          calls.push({ entry: summarize(entry), movedBy })
        },
      })
      expect(calls).to.deep.equal([
        { entry: summary('b.tex'), movedBy: operation },
      ])
      expect(Array.from(entries.keys())).to.deep.equal(['b.tex'])
    })

    it('is not called when the target pathname holds no file', function () {
      const onMoveCollision = sinon.stub()
      buildFileTreeDiff([change(moveFile('a.tex', 'b.tex'))], {
        initialPathnames: ['a.tex'],
        onMoveCollision,
      })
      expect(onMoveCollision.called).to.be.false
    })

    it('is not called when the file at the target pathname was removed', function () {
      const onMoveCollision = sinon.stub()
      buildFileTreeDiff(
        [change(removeFile('b.tex')), change(moveFile('a.tex', 'b.tex'))],
        { initialPathnames: ['a.tex', 'b.tex'], onMoveCollision }
      )
      expect(onMoveCollision.called).to.be.false
    })

    it('can throw before the move is folded in', function () {
      const err = new Error('collision')
      expect(() =>
        buildFileTreeDiff([change(moveFile('a.tex', 'b.tex'))], {
          initialPathnames: ['a.tex', 'b.tex'],
          onMoveCollision: () => {
            throw err
          },
        })
      ).to.throw(err)
    })
  })
})
