'use strict'

const { expect } = require('chai')
const {
  Change,
  File,
  Operation,
  AddFileOperation,
  Snapshot,
  Origin,
  RestoreFileOrigin,
} = require('../..')

describe('Change', function () {
  describe('findBlobHashes', function () {
    it('finds blob hashes from operations', function () {
      const blobHashes = new Set()

      const change = Change.fromRaw({
        operations: [],
        timestamp: '2015-03-05T12:03:53.035Z',
        authors: [null],
      })

      change.findBlobHashes(blobHashes)
      expect(blobHashes.size).to.equal(0)

      // AddFile with content doesn't have a hash.
      change.pushOperation(Operation.addFile('a.txt', File.fromString('a')))
      change.findBlobHashes(blobHashes)
      expect(blobHashes.size).to.equal(0)

      // AddFile with hash should give us a hash.
      change.pushOperation(
        Operation.addFile('b.txt', File.fromHash(File.EMPTY_FILE_HASH))
      )
      change.findBlobHashes(blobHashes)
      expect(blobHashes.size).to.equal(1)
      expect(blobHashes.has(File.EMPTY_FILE_HASH)).to.be.true
    })
  })

  describe('RestoreFileOrigin', function () {
    it('should convert to and from raw', function () {
      const origin = new RestoreFileOrigin(1, 'path', new Date())
      const raw = origin.toRaw()
      const newOrigin = Origin.fromRaw(raw)
      expect(newOrigin).to.eql(origin)
    })

    it('change should have a correct origin class', function () {
      const change = Change.fromRaw({
        operations: [],
        timestamp: '2015-03-05T12:03:53.035Z',
        authors: [null],
        origin: {
          kind: 'file-restore',
          version: 1,
          path: 'path',
          timestamp: '2015-03-05T12:03:53.035Z',
        },
      })

      expect(change.getOrigin()).to.be.an.instanceof(RestoreFileOrigin)
    })
  })

  describe('applyTo', function () {
    it('sets the timestamp on the snapshot', function () {
      const snapshot = new Snapshot()
      snapshot.addFile('main.tex', File.fromString(''))
      const operation = new AddFileOperation('main.tex', File.fromString(''))
      const now = new Date()
      const change = new Change([operation], now)
      change.applyTo(snapshot)
      expect(snapshot.getTimestamp().toISOString()).to.equal(now.toISOString())
    })
  })
})
