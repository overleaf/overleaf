'use strict'

const { expect } = require('chai')
const core = require('../..')
const Change = core.Change
const File = core.File
const History = core.History
const Operation = core.Operation
const Snapshot = core.Snapshot

describe('History', function () {
  describe('findBlobHashes', function () {
    it('finds blob hashes from snapshot and changes', function () {
      const history = new History(new Snapshot(), [])

      const blobHashes = new Set()
      history.findBlobHashes(blobHashes)
      expect(blobHashes.size).to.equal(0)

      // Add a file with a hash to the snapshot.
      history.getSnapshot().addFile('foo', File.fromHash(File.EMPTY_FILE_HASH))
      history.findBlobHashes(blobHashes)
      expect(Array.from(blobHashes)).to.have.members([File.EMPTY_FILE_HASH])

      // Add a file with a hash to the changes.
      const testHash = 'a'.repeat(40)
      const change = Change.fromRaw({
        operations: [],
        timestamp: '2015-03-05T12:03:53.035Z',
        authors: [null],
      })
      change.pushOperation(Operation.addFile('bar', File.fromHash(testHash)))

      history.pushChanges([change])
      history.findBlobHashes(blobHashes)
      expect(Array.from(blobHashes)).to.have.members([
        File.EMPTY_FILE_HASH,
        testHash,
      ])
    })
  })
})
