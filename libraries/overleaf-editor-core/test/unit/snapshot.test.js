'use strict'

const { expect } = require('chai')
const {
  File,
  Snapshot,
  TextOperation,
  Change,
  EditFileOperation,
} = require('../..')

describe('Snapshot', function () {
  describe('findBlobHashes', function () {
    it('finds blob hashes from files', function () {
      const snapshot = new Snapshot()

      const blobHashes = new Set()
      snapshot.findBlobHashes(blobHashes)
      expect(blobHashes.size).to.equal(0)

      // Add a file without a hash.
      snapshot.addFile('foo', File.fromString(''))
      snapshot.findBlobHashes(blobHashes)
      expect(blobHashes.size).to.equal(0)

      // Add a file with a hash.
      snapshot.addFile('bar', File.fromHash(File.EMPTY_FILE_HASH))
      snapshot.findBlobHashes(blobHashes)
      expect(Array.from(blobHashes)).to.have.members([File.EMPTY_FILE_HASH])
    })
  })

  describe('editFile', function () {
    let snapshot
    let operation

    beforeEach(function () {
      snapshot = new Snapshot()
      snapshot.addFile('hello.txt', File.fromString('hello'))
      operation = new TextOperation()
      operation.retain(5)
      operation.insert(' world!')
    })

    it('applies text operations to the file', function () {
      snapshot.editFile('hello.txt', operation)
      const file = snapshot.getFile('hello.txt')
      expect(file.getContent()).to.equal('hello world!')
    })

    it('rejects text operations for nonexistent file', function () {
      expect(() => {
        snapshot.editFile('does-not-exist.txt', operation)
      }).to.throw(Snapshot.EditMissingFileError)
    })
  })

  describe('applyAll', function () {
    let snapshot
    let change

    beforeEach(function () {
      snapshot = new Snapshot()
      snapshot.addFile('empty.txt', File.fromString(''))
      const badTextOp = new TextOperation()
      badTextOp.insert('FAIL!')
      const goodTextOp = new TextOperation()
      goodTextOp.insert('SUCCESS!')
      change = new Change(
        [
          new EditFileOperation('missing.txt', badTextOp),
          new EditFileOperation('empty.txt', goodTextOp),
        ],
        new Date()
      )
    })

    it('ignores recoverable errors', function () {
      snapshot.applyAll([change])
      const file = snapshot.getFile('empty.txt')
      expect(file.getContent()).to.equal('SUCCESS!')
    })

    it('stops on recoverable errors in strict mode', function () {
      expect(() => {
        snapshot.applyAll([change], { strict: true })
      }).to.throw(Snapshot.EditMissingFileError)
      const file = snapshot.getFile('empty.txt')
      expect(file.getContent()).to.equal('')
    })
  })
})
