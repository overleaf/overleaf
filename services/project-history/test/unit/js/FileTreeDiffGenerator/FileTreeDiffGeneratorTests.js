import crypto from 'node:crypto'
import { expect } from 'chai'
import * as FileTreeDiffGenerator from '../../../../app/js/FileTreeDiffGenerator.js'
import * as Errors from '../../../../app/js/Errors.js'

const sha = data => crypto.createHash('sha1').update(data).digest('hex')

/** An editable file: the string length is known. */
const textFile = (content = 'mock-content') => ({
  hash: sha(content),
  stringLength: 42,
})

/** A binary file: it has a byte length, but no string length. */
const binaryFile = (content = 'mock-binary') => ({
  hash: sha(content),
  byteLength: 42,
})

/** A file with an unknown editability: neither length is known. */
const hashOnlyFile = (content = 'mock-hash-only') => ({ hash: sha(content) })

const change = operations => ({
  operations,
  timestamp: '2017-12-04T10:29:17.786Z',
  authors: [31],
})

const add = (pathname, file = textFile()) => ({ pathname, file })
const edit = pathname => ({ pathname, textOperation: ['lorem ipsum'] })
const move = (pathname, newPathname) => ({ pathname, newPathname })
const remove = pathname => ({ pathname, newPathname: '' })
const setMetadata = (pathname, metadata) => ({ pathname, metadata })

/**
 * Build the raw chunk that buildDiff() expects, with one operation per change.
 */
function chunk(files, operations, startVersion = 0) {
  return {
    chunk: {
      history: {
        snapshot: { files },
        changes: operations.map(operation => change([operation])),
      },
      startVersion,
    },
  }
}

describe('FileTreeDiffGenerator', function () {
  describe('buildDiff', function () {
    it('reports files from the initial snapshot with their editability', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk(
          {
            'a.tex': textFile(),
            'img.png': binaryFile(),
            'unknown.tex': hashOnlyFile(),
          },
          []
        ),
        0,
        0
      )
      expect(diff).to.deep.equal([
        { pathname: 'a.tex', editable: true },
        { pathname: 'img.png', editable: false },
        { pathname: 'unknown.tex', editable: null },
      ])
    })

    it('reports an added file with the editability of the added file', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({}, [add('new.tex'), add('new.png', binaryFile())]),
        0,
        2
      )
      expect(diff).to.deep.equal([
        { pathname: 'new.tex', operation: 'added', editable: true },
        { pathname: 'new.png', operation: 'added', editable: false },
      ])
    })

    it('replaces an untouched file with an edit, dropping the editability', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({ 'a.tex': textFile() }, [edit('a.tex')]),
        0,
        1
      )
      expect(diff).to.deep.equal([{ pathname: 'a.tex', operation: 'edited' }])
    })

    it('reports an edit of a file that is not in the snapshot', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({}, [edit('missing.tex')]),
        0,
        1
      )
      expect(diff).to.deep.equal([
        { pathname: 'missing.tex', operation: 'edited' },
      ])
    })

    it('reports a rename with the old pathname first', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({ 'a.tex': textFile() }, [move('a.tex', 'b.tex')]),
        0,
        1
      )
      expect(diff).to.deep.equal([
        {
          pathname: 'a.tex',
          newPathname: 'b.tex',
          operation: 'renamed',
          editable: true,
        },
      ])
    })

    it('collapses a chain of renames into a single rename', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({ 'a.tex': textFile() }, [
          move('a.tex', 'b.tex'),
          move('b.tex', 'c.tex'),
        ]),
        0,
        2
      )
      expect(diff).to.deep.equal([
        {
          pathname: 'a.tex',
          newPathname: 'c.tex',
          operation: 'renamed',
          editable: true,
        },
      ])
    })

    it('reports a removal with the version it was deleted at', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({ 'a.tex': textFile(), 'b.tex': textFile() }, [
          edit('b.tex'),
          remove('a.tex'),
        ]),
        0,
        2
      )
      expect(diff).to.deep.equal([
        {
          pathname: 'a.tex',
          operation: 'removed',
          editable: true,
          deletedAtV: 1,
        },
        { pathname: 'b.tex', operation: 'edited' },
      ])
    })

    it('reports a rename followed by a removal', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({ 'a.tex': textFile() }, [
          move('a.tex', 'b.tex'),
          remove('b.tex'),
        ]),
        0,
        2
      )
      expect(diff).to.deep.equal([
        {
          pathname: 'a.tex',
          newPathname: 'b.tex',
          operation: 'removed',
          editable: true,
          deletedAtV: 1,
        },
      ])
    })

    it('keeps an added file as an add at its new pathname when it is renamed', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({}, [add('a.tex'), move('a.tex', 'b.tex')]),
        0,
        2
      )
      expect(diff).to.deep.equal([
        { pathname: 'b.tex', operation: 'added', editable: true },
      ])
    })

    it('reports an added file that is removed again as a removal', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({}, [add('a.tex'), remove('a.tex')]),
        0,
        2
      )
      expect(diff).to.deep.equal([
        {
          pathname: 'a.tex',
          operation: 'removed',
          editable: true,
          deletedAtV: 1,
        },
      ])
    })

    describe('edits of files that are already reported with an operation', function () {
      it('ignores an edit of an added file', function () {
        const diff = FileTreeDiffGenerator.buildDiff(
          chunk({}, [add('a.tex'), edit('a.tex')]),
          0,
          2
        )
        expect(diff).to.deep.equal([
          { pathname: 'a.tex', operation: 'added', editable: true },
        ])
      })

      it('ignores an edit of a renamed file', function () {
        const diff = FileTreeDiffGenerator.buildDiff(
          chunk({ 'a.tex': textFile() }, [
            move('a.tex', 'b.tex'),
            edit('b.tex'),
          ]),
          0,
          2
        )
        expect(diff).to.deep.equal([
          {
            pathname: 'a.tex',
            newPathname: 'b.tex',
            operation: 'renamed',
            editable: true,
          },
        ])
      })

      it('ignores an edit of a removed file', function () {
        const diff = FileTreeDiffGenerator.buildDiff(
          chunk({ 'a.tex': textFile() }, [remove('a.tex'), edit('a.tex')]),
          0,
          2
        )
        expect(diff).to.deep.equal([
          {
            pathname: 'a.tex',
            operation: 'removed',
            editable: true,
            deletedAtV: 0,
          },
        ])
      })
    })

    describe('edits before a rename or a removal', function () {
      it('drops the editability when an edited file is renamed', function () {
        const diff = FileTreeDiffGenerator.buildDiff(
          chunk({ 'a.tex': textFile() }, [
            edit('a.tex'),
            move('a.tex', 'b.tex'),
          ]),
          0,
          2
        )
        expect(diff).to.deep.equal([
          { pathname: 'a.tex', newPathname: 'b.tex', operation: 'renamed' },
        ])
      })

      it('drops the editability when an edited file is removed', function () {
        const diff = FileTreeDiffGenerator.buildDiff(
          chunk({ 'a.tex': textFile() }, [edit('a.tex'), remove('a.tex')]),
          0,
          2
        )
        expect(diff).to.deep.equal([
          { pathname: 'a.tex', operation: 'removed', deletedAtV: 1 },
        ])
      })
    })

    it('replaces a file that is added over an existing file', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({ 'a.tex': textFile() }, [add('a.tex', hashOnlyFile())]),
        0,
        1
      )
      expect(diff).to.deep.equal([
        { pathname: 'a.tex', operation: 'added', editable: null },
      ])
    })

    it('replaces a removed file that is added again', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({ 'a.tex': textFile() }, [remove('a.tex'), add('a.tex')]),
        0,
        2
      )
      expect(diff).to.deep.equal([
        { pathname: 'a.tex', operation: 'added', editable: true },
      ])
    })

    it('replaces a removed file that another file is renamed onto', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({ 'a.tex': textFile(), 'b.tex': textFile() }, [
          remove('a.tex'),
          move('b.tex', 'a.tex'),
        ]),
        0,
        2
      )
      expect(diff).to.deep.equal([
        {
          pathname: 'b.tex',
          newPathname: 'a.tex',
          operation: 'renamed',
          editable: true,
        },
      ])
    })

    it('throws when a file is renamed onto a file that still exists', function () {
      expect(() =>
        FileTreeDiffGenerator.buildDiff(
          chunk({ 'a.tex': textFile(), 'b.tex': textFile() }, [
            move('a.tex', 'b.tex'),
          ]),
          0,
          1
        )
      ).to.throw(Errors.InconsistentChunkError)
    })

    it('skips a rename of a file that does not exist', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({}, [move('missing.tex', 'renamed.tex')]),
        0,
        1
      )
      expect(diff).to.deep.equal([])
    })

    it('skips a removal of a file that does not exist', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({}, [remove('missing.tex')]),
        0,
        1
      )
      expect(diff).to.deep.equal([])
    })

    it('skips operations without a pathname', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({}, [
          edit(''),
          move('', 'renamed.tex'),
          remove(''),
          add('', textFile()),
        ]),
        0,
        4
      )
      expect(diff).to.deep.equal([])
    })

    it('ignores metadata operations', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({ 'a.tex': textFile() }, [setMetadata('a.tex', { main: true })]),
        0,
        1
      )
      expect(diff).to.deep.equal([{ pathname: 'a.tex', editable: true }])
    })

    it('reports the entries in the order of the pathnames they end up at', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk(
          {
            'a.tex': textFile(),
            'b.tex': textFile(),
            'c.tex': textFile(),
          },
          [
            move('b.tex', 'b2.tex'),
            remove('c.tex'),
            add('d.tex'),
            edit('a.tex'),
          ]
        ),
        0,
        4
      )
      expect(diff).to.deep.equal([
        { pathname: 'a.tex', operation: 'edited' },
        {
          pathname: 'c.tex',
          operation: 'removed',
          editable: true,
          deletedAtV: 1,
        },
        {
          pathname: 'b.tex',
          newPathname: 'b2.tex',
          operation: 'renamed',
          editable: true,
        },
        { pathname: 'd.tex', operation: 'added', editable: true },
      ])
    })

    it('applies the changes before fromVersion to the initial snapshot', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk(
          { 'a.tex': textFile() },
          [
            add('b.tex'),
            move('a.tex', 'a2.tex'),
            remove('b.tex'),
            edit('a2.tex'),
          ],
          3
        ),
        5,
        7
      )
      expect(diff).to.deep.equal([
        {
          pathname: 'b.tex',
          operation: 'removed',
          editable: true,
          deletedAtV: 5,
        },
        { pathname: 'a2.tex', operation: 'edited' },
      ])
    })

    it('ignores changes after toVersion', function () {
      const diff = FileTreeDiffGenerator.buildDiff(
        chunk({ 'a.tex': textFile() }, [edit('a.tex'), remove('a.tex')]),
        0,
        1
      )
      expect(diff).to.deep.equal([{ pathname: 'a.tex', operation: 'edited' }])
    })
  })
})
