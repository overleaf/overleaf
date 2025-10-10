'use strict'

const _ = require('lodash')
const { expect } = require('chai')

const ot = require('../..')
const StringFileData = require('../../lib/file_data/string_file_data')
const File = ot.File
const AddFileOperation = ot.AddFileOperation
const MoveFileOperation = ot.MoveFileOperation
const EditFileOperation = ot.EditFileOperation
const NoOperation = ot.NoOperation
const Operation = ot.Operation
const TextOperation = ot.TextOperation
const AddCommentOperation = ot.AddCommentOperation
const DeleteCommentOperation = ot.DeleteCommentOperation
const SetCommentStateOperation = ot.SetCommentStateOperation
const Snapshot = ot.Snapshot

describe('Operation', function () {
  function makeEmptySnapshot() {
    return new Snapshot()
  }

  function makeOneFileSnapshot() {
    const snapshot = makeEmptySnapshot()
    snapshot.addFile('foo', File.fromString(''))
    return snapshot
  }

  function makeTwoFileSnapshot() {
    const snapshot = makeOneFileSnapshot()
    snapshot.addFile('bar', File.fromString('a'))
    return snapshot
  }

  function addFile(pathname, content) {
    return new AddFileOperation(pathname, File.fromString(content))
  }

  function roundTripOperation(operation) {
    return Operation.fromRaw(operation.toRaw())
  }

  function deepCopySnapshot(snapshot) {
    return Snapshot.fromRaw(snapshot.toRaw())
  }

  function runConcurrently(operation0, operation1, snapshot) {
    const operations = [
      // make sure they survive serialization
      roundTripOperation(operation0),
      roundTripOperation(operation1),
    ]
    const primeOperations = Operation.transform(operation0, operation1)
    const originalSnapshot = snapshot || makeEmptySnapshot()
    const snapshotA = deepCopySnapshot(originalSnapshot)
    const snapshotB = deepCopySnapshot(originalSnapshot)

    operations[0].applyTo(snapshotA)
    operations[1].applyTo(snapshotB)

    primeOperations[0].applyTo(snapshotB)
    primeOperations[1].applyTo(snapshotA)
    expect(snapshotA).to.eql(snapshotB)

    return {
      snapshot: snapshotA,
      operations,
      primeOperations,

      log() {
        console.log(this)
        return this
      },

      expectNoTransform() {
        expect(this.operations).to.deep.eql(this.primeOperations)
        return this
      },

      expectTransform() {
        expect(this.operations).to.not.deep.eql(this.primeOperations)
        return this
      },

      swap() {
        return runConcurrently(operation1, operation0, originalSnapshot)
      },

      expectFiles(files) {
        this.expectedFiles = files
        expect(this.snapshot.countFiles()).to.equal(_.size(files))
        _.forOwn(files, (expectedFile, pathname) => {
          if (_.isString(expectedFile)) {
            expectedFile = { content: expectedFile, metadata: {}, comments: [] }
          }
          const file = this.snapshot.getFile(pathname)
          expect(file.getContent()).to.equal(expectedFile.content)
          expect(file.getMetadata()).to.eql(expectedFile.metadata)
          expect(file.getComments().toRaw()).to.deep.equal(
            expectedFile.comments
          )
        })
        return this
      },

      expectSymmetry() {
        if (!this.expectedFiles) {
          throw new Error('must call expectFiles before expectSymmetry')
        }
        this.swap().expectFiles(this.expectedFiles)
        return this
      },

      expectPrime(index, klass) {
        expect(this.primeOperations[index]).to.be.an.instanceof(klass)
        return this
      },

      tap(fn) {
        fn.call(this)
        return this
      },
    }
  }

  // shorthand for creating an edit operation
  function edit(pathname, textOperationOps) {
    return Operation.editFile(
      pathname,
      TextOperation.fromJSON({ textOperation: textOperationOps })
    )
  }

  it('transforms AddFile-AddFile with different names', function () {
    runConcurrently(addFile('foo', ''), addFile('bar', 'a'))
      .expectNoTransform()
      .expectFiles({ bar: 'a', foo: '' })
      .expectSymmetry()
  })

  it('transforms AddFile-AddFile with same name', function () {
    // the second file 'wins'
    runConcurrently(addFile('foo', ''), addFile('foo', 'a'))
      .expectFiles({ foo: 'a' })
      // if the first add was committed first, the second add overwrites it
      .expectPrime(1, AddFileOperation)
      // if the second add was committed first, the first add becomes a no-op
      .expectPrime(0, NoOperation)
      .swap()
      .expectFiles({ foo: '' })
  })

  it('transforms AddFile-MoveFile with no conflict', function () {
    runConcurrently(
      Operation.moveFile('foo', 'baz'),
      addFile('bar', 'a'),
      makeOneFileSnapshot()
    )
      .expectNoTransform()
      .expectFiles({ bar: 'a', baz: '' })
      .expectSymmetry()
  })

  it('transforms AddFile-MoveFile with move from new file', function () {
    runConcurrently(
      Operation.moveFile('foo', 'baz'),
      addFile('foo', 'a'),
      makeOneFileSnapshot()
    )
      .expectFiles({ baz: 'a' })
      // if the move was committed first, the add overwrites it
      .expectPrime(1, AddFileOperation)
      // if the add was committed first, the move appears in the history
      .expectPrime(0, MoveFileOperation)
      .expectSymmetry()
  })

  it('transforms AddFile-MoveFile with move to new file', function () {
    runConcurrently(
      Operation.moveFile('foo', 'baz'),
      addFile('baz', 'a'),
      makeOneFileSnapshot()
    )
      .expectFiles({ baz: 'a' })
      // if the move was committed first, the add overwrites it
      .expectPrime(1, AddFileOperation)
      // if the add was committed first, the move becomes a delete
      .expectPrime(0, MoveFileOperation)
      .tap(function () {
        expect(this.primeOperations[0].isRemoveFile()).to.be.true
      })
      .expectSymmetry()
  })

  it('transforms AddFile-RemoveFile with no conflict', function () {
    runConcurrently(
      Operation.removeFile('foo'),
      addFile('bar', 'a'),
      makeOneFileSnapshot()
    )
      .expectNoTransform()
      .expectFiles({ bar: 'a' })
      .expectSymmetry()
  })

  it('transforms AddFile-RemoveFile that removes added file', function () {
    runConcurrently(
      Operation.removeFile('foo'),
      addFile('foo', 'a'),
      makeOneFileSnapshot()
    )
      .expectFiles({ foo: 'a' })
      // if the move was committed first, the add overwrites it
      .expectPrime(1, AddFileOperation)
      // if the add was committed first, the move gets dropped
      .expectPrime(0, NoOperation)
      .expectSymmetry()
  })

  it('transforms AddFile-EditFile with no conflict', function () {
    runConcurrently(
      edit('foo', ['x']),
      addFile('bar', 'a'),
      makeOneFileSnapshot()
    )
      .expectNoTransform()
      .expectFiles({ bar: 'a', foo: 'x' })
      .expectSymmetry()
  })

  it('transforms AddFile-EditFile when new file is edited', function () {
    runConcurrently(
      edit('foo', ['x']),
      addFile('foo', 'a'),
      makeOneFileSnapshot()
    )
      .expectFiles({ foo: 'a' })
      // if the edit was committed first, the add overwrites it
      .expectPrime(1, AddFileOperation)
      // if the add was committed first, the edit gets dropped
      .expectPrime(0, NoOperation)
      .expectSymmetry()
  })

  it('transforms AddFile-SetFileMetadata with no conflict', function () {
    const testMetadata = { baz: 1 }
    runConcurrently(
      addFile('bar', 'a'),
      Operation.setFileMetadata('foo', testMetadata),
      makeOneFileSnapshot()
    )
      .expectNoTransform()
      .expectFiles({
        foo: { content: '', metadata: testMetadata, comments: [] },
        bar: 'a',
      })
      .expectSymmetry()
  })

  it('transforms AddFile-SetFileMetadata with same name', function () {
    const testMetadata = { baz: 1 }
    runConcurrently(
      addFile('foo', 'x'),
      Operation.setFileMetadata('foo', testMetadata),
      makeEmptySnapshot()
    )
      .expectFiles({
        foo: { content: 'x', metadata: testMetadata, comments: [] },
      })
      .expectSymmetry()
  })

  it('transforms MoveFile-MoveFile with no conflict', function () {
    runConcurrently(
      Operation.moveFile('foo', 'baz'),
      Operation.moveFile('bar', 'bat'),
      makeTwoFileSnapshot()
    )
      .expectFiles({ bat: 'a', baz: '' })
      .expectNoTransform()
      .expectSymmetry()
  })

  it('transforms MoveFile-MoveFile same move foo->foo, foo->foo', function () {
    runConcurrently(
      Operation.moveFile('foo', 'foo'),
      Operation.moveFile('foo', 'foo'),
      makeOneFileSnapshot()
    )
      .expectFiles({ foo: '' })
      .expectPrime(1, NoOperation)
      .expectPrime(0, NoOperation)
      .expectSymmetry()
  })

  it('transforms MoveFile-MoveFile no-op foo->foo, foo->bar', function () {
    runConcurrently(
      Operation.moveFile('foo', 'foo'),
      Operation.moveFile('foo', 'bar'),
      makeOneFileSnapshot()
    )
      .expectFiles({ bar: '' })
      .expectPrime(1, MoveFileOperation)
      .expectPrime(0, NoOperation)
      .expectSymmetry()
  })

  it('transforms MoveFile-MoveFile no-op foo->foo, bar->foo', function () {
    runConcurrently(
      Operation.moveFile('foo', 'foo'),
      Operation.moveFile('foo', 'bar'),
      makeTwoFileSnapshot()
    )
      .expectFiles({ bar: '' })
      .expectPrime(1, MoveFileOperation)
      .expectPrime(0, NoOperation)
      .expectSymmetry()
  })

  it('transforms MoveFile-MoveFile no-op foo->foo, bar->bar', function () {
    runConcurrently(
      Operation.moveFile('foo', 'foo'),
      Operation.moveFile('bar', 'bar'),
      makeTwoFileSnapshot()
    )
      .expectFiles({ bar: 'a', foo: '' })
      .expectPrime(1, NoOperation)
      .expectPrime(0, NoOperation)
      .expectSymmetry()
  })

  it('transforms MoveFile-MoveFile same move foo->bar, foo->bar', function () {
    runConcurrently(
      Operation.moveFile('foo', 'bar'),
      Operation.moveFile('foo', 'bar'),
      makeOneFileSnapshot()
    )
      .expectFiles({ bar: '' })
      .expectPrime(1, NoOperation)
      .expectPrime(0, NoOperation)
      .expectSymmetry()
  })

  it('transforms MoveFile-MoveFile opposite foo->bar, bar->foo', function () {
    runConcurrently(
      Operation.moveFile('foo', 'bar'),
      Operation.moveFile('bar', 'foo'),
      makeTwoFileSnapshot()
    )
      .expectFiles([])
      .expectPrime(1, MoveFileOperation)
      .expectPrime(0, MoveFileOperation)
      .tap(function () {
        expect(this.primeOperations[1].isRemoveFile()).to.be.true
        expect(this.primeOperations[1].getPathname()).to.equal('bar')

        expect(this.primeOperations[0].isRemoveFile()).to.be.true
        expect(this.primeOperations[0].getPathname()).to.equal('foo')
      })
      .expectSymmetry()
  })

  it('transforms MoveFile-MoveFile no-op foo->foo, bar->baz', function () {
    runConcurrently(
      Operation.moveFile('foo', 'foo'),
      Operation.moveFile('bar', 'baz'),
      makeTwoFileSnapshot()
    )
      .expectFiles({ baz: 'a', foo: '' })
      .expectPrime(1, MoveFileOperation)
      .expectPrime(0, NoOperation)
      .expectSymmetry()
  })

  it('transforms MoveFile-MoveFile diverge foo->bar, foo->baz', function () {
    runConcurrently(
      Operation.moveFile('foo', 'bar'),
      Operation.moveFile('foo', 'baz'),
      makeOneFileSnapshot()
    )
      .expectFiles({ baz: '' })
      // if foo->bar was committed first, the second move becomes bar->baz
      .expectPrime(1, MoveFileOperation)
      // if foo->baz was committed first, the second move becomes a no-op
      .expectPrime(0, NoOperation)
      .tap(function () {
        expect(this.primeOperations[1].getPathname()).to.equal('bar')
        expect(this.primeOperations[1].getNewPathname()).to.equal('baz')
      })
      .swap()
      .expectFiles({ bar: '' })
  })

  it('transforms MoveFile-MoveFile transitive foo->baz, bar->foo', function () {
    runConcurrently(
      Operation.moveFile('foo', 'baz'),
      Operation.moveFile('bar', 'foo'),
      makeTwoFileSnapshot()
    )
      .expectFiles({ baz: 'a' })
      .expectPrime(1, MoveFileOperation)
      .expectPrime(0, MoveFileOperation)
      .expectSymmetry()
  })

  it('transforms MoveFile-MoveFile transitive foo->bar, bar->baz', function () {
    runConcurrently(
      Operation.moveFile('foo', 'bar'),
      Operation.moveFile('bar', 'baz'),
      makeTwoFileSnapshot()
    )
      .expectFiles({ baz: '' })
      .expectPrime(1, MoveFileOperation)
      .expectPrime(0, MoveFileOperation)
      .expectSymmetry()
  })

  it('transforms MoveFile-MoveFile converge foo->baz, bar->baz', function () {
    runConcurrently(
      Operation.moveFile('foo', 'baz'),
      Operation.moveFile('bar', 'baz'),
      makeTwoFileSnapshot()
    )
      .expectFiles({ baz: 'a' })
      .expectPrime(1, MoveFileOperation)
      .expectPrime(0, MoveFileOperation)
      .tap(function () {
        // if foo->baz was committed first, we just apply the move
        expect(this.primeOperations[1]).to.eql(this.operations[1])

        // if bar->baz was committed first, the other move becomes a remove
        expect(this.primeOperations[0].isRemoveFile()).to.be.true
        expect(this.primeOperations[0].getPathname()).to.equal('foo')
      })
      .swap()
      .expectFiles({ baz: '' })
  })

  it('transforms MoveFile-RemoveFile no-op foo->foo, foo->', function () {
    runConcurrently(
      Operation.moveFile('foo', 'foo'),
      Operation.removeFile('foo'),
      makeOneFileSnapshot()
    )
      .expectFiles([])
      .expectPrime(1, MoveFileOperation)
      .expectPrime(0, NoOperation)
      .tap(function () {
        expect(this.primeOperations[1].isRemoveFile()).to.be.true
      })
      .expectSymmetry()
  })

  it('transforms MoveFile-RemoveFile same move foo->, foo->', function () {
    runConcurrently(
      Operation.removeFile('foo'),
      Operation.removeFile('foo'),
      makeOneFileSnapshot()
    )
      .expectFiles([])
      .expectPrime(1, NoOperation)
      .expectPrime(0, NoOperation)
      .expectSymmetry()
  })

  it('transforms MoveFile-RemoveFile no conflict foo->, bar->', function () {
    runConcurrently(
      Operation.removeFile('foo'),
      Operation.removeFile('bar'),
      makeTwoFileSnapshot()
    )
      .expectFiles([])
      .expectNoTransform()
      .expectSymmetry()
  })

  it('transforms MoveFile-RemoveFile no conflict foo->foo, bar->', function () {
    runConcurrently(
      Operation.moveFile('foo', 'foo'),
      Operation.removeFile('bar'),
      makeTwoFileSnapshot()
    )
      .expectFiles({ foo: '' })
      .expectPrime(1, MoveFileOperation)
      .expectPrime(0, NoOperation)
      .tap(function () {
        expect(this.primeOperations[1].isRemoveFile()).to.be.true
      })
      .expectSymmetry()
  })

  it('transforms MoveFile-RemoveFile transitive foo->, bar->foo', function () {
    runConcurrently(
      Operation.removeFile('foo'),
      Operation.moveFile('bar', 'foo'),
      makeTwoFileSnapshot()
    )
      .expectFiles([])
      .expectPrime(1, MoveFileOperation)
      .expectPrime(0, MoveFileOperation)
      .tap(function () {
        expect(this.primeOperations[1].isRemoveFile()).to.be.true
        expect(this.primeOperations[1].getPathname()).to.equal('bar')

        expect(this.primeOperations[0].isRemoveFile()).to.be.true
        expect(this.primeOperations[0].getPathname()).to.equal('foo')
      })
      .expectSymmetry()
  })

  it('transforms MoveFile-RemoveFile transitive foo->bar, bar->', function () {
    runConcurrently(
      Operation.moveFile('foo', 'bar'),
      Operation.removeFile('bar'),
      makeTwoFileSnapshot()
    )
      .expectFiles({})
      .expectPrime(1, MoveFileOperation)
      .expectPrime(0, MoveFileOperation)
      .tap(function () {
        expect(this.primeOperations[1].isRemoveFile()).to.be.true
        expect(this.primeOperations[1].getPathname()).to.equal('bar')

        expect(this.primeOperations[0].isRemoveFile()).to.be.true
        expect(this.primeOperations[0].getPathname()).to.equal('foo')
      })
      .expectSymmetry()
  })

  it('transforms MoveFile-EditFile with no conflict', function () {
    runConcurrently(
      Operation.moveFile('bar', 'baz'),
      edit('foo', ['x']),
      makeTwoFileSnapshot()
    )
      .expectFiles({ baz: 'a', foo: 'x' })
      .expectNoTransform()
      .expectSymmetry()
  })

  it('transforms MoveFile-EditFile with edit on pathname', function () {
    runConcurrently(
      Operation.moveFile('foo', 'bar'),
      edit('foo', ['x']),
      makeOneFileSnapshot()
    )
      .expectFiles({ bar: 'x' })
      .expectPrime(1, EditFileOperation)
      .expectPrime(0, MoveFileOperation)
      .tap(function () {
        expect(this.primeOperations[1].getPathname()).to.equal('bar')

        expect(this.primeOperations[0].getPathname()).to.equal('foo')
        expect(this.primeOperations[0].getNewPathname()).to.equal('bar')
      })
      .expectSymmetry()
  })

  it('transforms MoveFile-EditFile with edit on new pathname', function () {
    runConcurrently(
      Operation.moveFile('bar', 'foo'),
      edit('foo', ['x']),
      makeTwoFileSnapshot()
    )
      .expectFiles({ foo: 'a' })
      .expectPrime(1, NoOperation)
      .tap(function () {
        expect(this.primeOperations[0]).to.eql(this.operations[0])
      })
      .expectSymmetry()
  })

  it('transforms MoveFile-EditFile with no-op move', function () {
    runConcurrently(
      Operation.moveFile('foo', 'foo'),
      edit('foo', ['x']),
      makeOneFileSnapshot()
    )
      .expectFiles({ foo: 'x' })
      .expectNoTransform()
      .expectSymmetry()
  })

  it('transforms MoveFile-SetFileMetadata with no conflict', function () {
    const testMetadata = { baz: 1 }
    runConcurrently(
      Operation.moveFile('foo', 'baz'),
      Operation.setFileMetadata('bar', testMetadata),
      makeTwoFileSnapshot()
    )
      .expectNoTransform()
      .expectFiles({
        bar: { content: 'a', metadata: testMetadata, comments: [] },
        baz: '',
      })
      .expectSymmetry()
  })

  it('transforms MoveFile-SetFileMetadata with set on pathname', function () {
    const testMetadata = { baz: 1 }
    runConcurrently(
      Operation.moveFile('foo', 'bar'),
      Operation.setFileMetadata('foo', testMetadata),
      makeOneFileSnapshot()
    )
      .expectFiles({
        bar: { content: '', metadata: testMetadata, comments: [] },
      })
      .expectSymmetry()
  })

  it('transforms MoveFile-SetFileMetadata w/ set on new pathname', function () {
    const testMetadata = { baz: 1 }
    runConcurrently(
      Operation.moveFile('foo', 'bar'),
      Operation.setFileMetadata('bar', testMetadata),
      makeTwoFileSnapshot()
    )
      // move wins
      .expectFiles({ bar: { content: '', metadata: {}, comments: [] } })
      .expectSymmetry()
  })

  it('transforms MoveFile-SetFileMetadata with no-op move', function () {
    const testMetadata = { baz: 1 }
    runConcurrently(
      Operation.moveFile('foo', 'foo'),
      Operation.setFileMetadata('foo', testMetadata),
      makeOneFileSnapshot()
    )
      .expectFiles({
        foo: { content: '', metadata: testMetadata, comments: [] },
      })
      .expectSymmetry()
  })

  it('transforms EditFile-EditFile with no conflict', function () {
    runConcurrently(
      edit('foo', ['x']),
      edit('bar', [1, 'x']),
      makeTwoFileSnapshot()
    )
      .expectFiles({ bar: 'ax', foo: 'x' })
      .expectNoTransform()
      .expectSymmetry()
  })

  it('transforms EditFile-EditFile on same file', function () {
    runConcurrently(
      edit('foo', ['x']),
      edit('foo', ['y']),
      makeOneFileSnapshot()
    )
      .expectFiles({ foo: 'xy' })
      .expectPrime(1, EditFileOperation)
      .expectPrime(0, EditFileOperation)
      .tap(function () {
        expect(this.primeOperations[1].getOperation().toJSON()).to.eql({
          textOperation: [1, 'y'],
        })
        expect(this.primeOperations[0].getOperation().toJSON()).to.eql({
          textOperation: ['x', 1],
        })
      })
      .swap()
      .expectFiles({ foo: 'yx' })
  })

  it('transforms EditFile-RemoveFile with no conflict', function () {
    runConcurrently(
      edit('foo', ['x']),
      Operation.removeFile('bar'),
      makeTwoFileSnapshot()
    )
      .expectFiles({ foo: 'x' })
      .expectNoTransform()
      .expectSymmetry()
  })

  it('transforms EditFile-RemoveFile on same file', function () {
    runConcurrently(
      edit('foo', ['x']),
      Operation.removeFile('foo'),
      makeOneFileSnapshot()
    )
      .expectFiles({})
      .expectSymmetry()
  })

  it('transforms EditFile-SetFileMetadata with no conflict', function () {
    const testMetadata = { baz: 1 }
    runConcurrently(
      edit('foo', ['x']),
      Operation.setFileMetadata('bar', testMetadata),
      makeTwoFileSnapshot()
    )
      .expectNoTransform()
      .expectFiles({
        foo: { content: 'x', metadata: {}, comments: [] },
        bar: { content: 'a', metadata: testMetadata, comments: [] },
      })
      .expectSymmetry()
  })

  it('transforms EditFile-SetFileMetadata on same file', function () {
    const testMetadata = { baz: 1 }
    runConcurrently(
      edit('foo', ['x']),
      Operation.setFileMetadata('foo', testMetadata),
      makeOneFileSnapshot()
    )
      .expectNoTransform()
      .expectFiles({
        foo: { content: 'x', metadata: testMetadata, comments: [] },
      })
      .expectSymmetry()
  })

  it('transforms SetFileMetadata-SetFileMetadata w/ no conflict', function () {
    runConcurrently(
      Operation.setFileMetadata('foo', { baz: 1 }),
      Operation.setFileMetadata('bar', { baz: 2 }),
      makeTwoFileSnapshot()
    )
      .expectNoTransform()
      .expectFiles({
        foo: { content: '', metadata: { baz: 1 }, comments: [] },
        bar: { content: 'a', metadata: { baz: 2 }, comments: [] },
      })
      .expectSymmetry()
  })

  it('transforms SetFileMetadata-SetFileMetadata on same file', function () {
    runConcurrently(
      Operation.setFileMetadata('foo', { baz: 1 }),
      Operation.setFileMetadata('foo', { baz: 2 }),
      makeOneFileSnapshot()
    )
      // second op wins
      .expectFiles({ foo: { content: '', metadata: { baz: 2 }, comments: [] } })
      .swap()
      // first op wins
      .expectFiles({ foo: { content: '', metadata: { baz: 1 }, comments: [] } })
  })

  it('transforms SetFileMetadata-RemoveFile with no conflict', function () {
    const testMetadata = { baz: 1 }
    runConcurrently(
      Operation.setFileMetadata('foo', testMetadata),
      Operation.removeFile('bar'),
      makeTwoFileSnapshot()
    )
      .expectNoTransform()
      .expectFiles({
        foo: { content: '', metadata: testMetadata, comments: [] },
      })
      .expectSymmetry()
  })

  it('transforms SetFileMetadata-RemoveFile on same file', function () {
    const testMetadata = { baz: 1 }
    runConcurrently(
      Operation.setFileMetadata('foo', testMetadata),
      Operation.removeFile('foo'),
      makeOneFileSnapshot()
    )
      .expectFiles({})
      .expectSymmetry()
  })

  it('transforms no-op with other operation', function () {
    runConcurrently(Operation.NO_OP, addFile('foo', 'test')).expectFiles({
      foo: 'test',
    })
  })

  describe('EditFile sub operations', function () {
    it('transforms AddCommentOperation-AddCommentOperation', function () {
      runConcurrently(
        Operation.editFile(
          'foo',
          AddCommentOperation.fromJSON({
            commentId: '1',
            ranges: [
              {
                pos: 10,
                length: 2,
              },
            ],
          })
        ),
        Operation.editFile(
          'foo',
          AddCommentOperation.fromJSON({
            commentId: '1',
            ranges: [
              {
                pos: 0,
                length: 1,
              },
            ],
          })
        ),
        makeOneFileSnapshot()
      )
        .expectTransform()
        .expectFiles({
          foo: {
            content: '',
            metadata: {},
            comments: [
              {
                id: '1',
                ranges: [
                  {
                    pos: 0,
                    length: 1,
                  },
                ],
              },
            ],
          },
        })
    })

    it('transforms TextOperation-AddCommentOperation', function () {
      runConcurrently(
        Operation.editFile(
          'foo',
          TextOperation.fromJSON({ textOperation: ['xyz'] })
        ),
        Operation.editFile(
          'foo',
          AddCommentOperation.fromJSON({
            commentId: '1',
            ranges: [
              {
                pos: 0,
                length: 1,
              },
            ],
          })
        ),
        makeOneFileSnapshot()
      )
        .expectTransform()
        .expectFiles({
          foo: {
            content: 'xyz',
            metadata: {},
            comments: [{ id: '1', ranges: [{ pos: 3, length: 1 }] }],
          },
        })
        .expectSymmetry()
    })

    it('transforms TextOperation-AddCommentOperation (insert with commentId)', function () {
      runConcurrently(
        Operation.editFile(
          'foo',
          TextOperation.fromJSON({
            textOperation: [{ i: 'xyz', commentIds: ['1'] }],
          })
        ),
        Operation.editFile(
          'foo',
          AddCommentOperation.fromJSON({
            commentId: '1',
            ranges: [
              {
                pos: 0,
                length: 1,
              },
            ],
          })
        ),
        makeOneFileSnapshot()
      )
        .expectTransform()
        .expectFiles({
          foo: {
            content: 'xyz',
            metadata: {},
            comments: [{ id: '1', ranges: [{ pos: 0, length: 4 }] }],
          },
        })
        .expectSymmetry()
    })

    it('transforms AddCommentOperation-SetCommentStateOperation', function () {
      runConcurrently(
        Operation.editFile(
          'foo',
          AddCommentOperation.fromJSON({
            commentId: '1',
            ranges: [{ pos: 1, length: 2 }],
          })
        ),
        Operation.editFile(
          'foo',
          SetCommentStateOperation.fromJSON({
            commentId: '1',
            resolved: true,
          })
        ),
        makeOneFileSnapshot()
      )
        .expectTransform()
        .expectFiles({
          foo: {
            content: '',
            metadata: {},
            comments: [
              { id: '1', ranges: [{ pos: 1, length: 2 }], resolved: true },
            ],
          },
        })
        .expectSymmetry()
    })

    it('transforms AddCommentOperation-DeleteCommentOperation ', function () {
      runConcurrently(
        Operation.editFile(
          'foo',
          AddCommentOperation.fromJSON({
            commentId: '1',
            ranges: [{ pos: 1, length: 2 }],
          })
        ),
        Operation.editFile(
          'foo',
          DeleteCommentOperation.fromJSON({ deleteComment: '1' })
        ),
        makeOneFileSnapshot()
      )
        .expectTransform()
        .expectFiles({
          foo: {
            content: '',
            metadata: {},
            comments: [],
          },
        })
        .expectSymmetry()
    })

    it('transforms DeleteCommentOperation-SetCommentStateOperation ', function () {
      runConcurrently(
        Operation.editFile(
          'foo',
          DeleteCommentOperation.fromJSON({ deleteComment: '1' })
        ),
        Operation.editFile(
          'foo',
          SetCommentStateOperation.fromJSON({
            commentId: '1',
            resolved: true,
          })
        ),
        makeOneFileSnapshot()
      )
        .expectTransform()
        .expectFiles({
          foo: {
            content: '',
            metadata: {},
            comments: [],
          },
        })
        .expectSymmetry()
    })

    it('transforms DeleteCommentOperation-DeleteCommentOperation ', function () {
      runConcurrently(
        Operation.editFile(
          'foo',
          DeleteCommentOperation.fromJSON({ deleteComment: '1' })
        ),
        Operation.editFile(
          'foo',
          DeleteCommentOperation.fromJSON({ deleteComment: '1' })
        ),
        makeOneFileSnapshot()
      )
        .expectTransform()
        .expectFiles({
          foo: {
            content: '',
            metadata: {},
            comments: [],
          },
        })
        .expectSymmetry()
    })

    it('transforms SetCommentStateOperation-SetCommentStateOperation to resolved comment', function () {
      const snapshot = makeEmptySnapshot()
      const file = new File(
        new StringFileData('xyz', [
          { id: '1', ranges: [{ pos: 0, length: 3 }] },
        ])
      )
      snapshot.addFile('foo', file)

      runConcurrently(
        Operation.editFile(
          'foo',
          SetCommentStateOperation.fromJSON({
            commentId: '1',
            resolved: true,
          })
        ),
        Operation.editFile(
          'foo',
          SetCommentStateOperation.fromJSON({
            commentId: '1',
            resolved: true,
          })
        ),
        snapshot
      )
        .expectTransform()
        .expectFiles({
          foo: {
            content: 'xyz',
            metadata: {},
            comments: [
              { id: '1', ranges: [{ pos: 0, length: 3 }], resolved: true },
            ],
          },
        })
        .expectSymmetry()
    })

    it('transforms SetCommentStateOperation-SetCommentStateOperation to unresolved comment', function () {
      const snapshot = makeEmptySnapshot()
      const file = new File(
        new StringFileData('xyz', [
          { id: '1', ranges: [{ pos: 0, length: 3 }] },
        ])
      )
      snapshot.addFile('foo', file)

      runConcurrently(
        Operation.editFile(
          'foo',
          SetCommentStateOperation.fromJSON({
            commentId: '1',
            resolved: true,
          })
        ),
        Operation.editFile(
          'foo',
          SetCommentStateOperation.fromJSON({
            commentId: '1',
            resolved: false,
          })
        ),
        snapshot
      )
        .expectTransform()
        .expectFiles({
          foo: {
            content: 'xyz',
            metadata: {},
            comments: [{ id: '1', ranges: [{ pos: 0, length: 3 }] }],
          },
        })
        .expectSymmetry()
    })
  })
})
