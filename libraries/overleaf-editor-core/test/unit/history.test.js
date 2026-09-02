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
    it('finds blob and ranges hashes from snapshot and changes', function () {
      const history = new History(new Snapshot(), [])

      const blobHashes = new Set()
      history.findBlobHashes(blobHashes)
      expect(blobHashes.size).to.equal(0)

      // Add a file with a hash to the snapshot.
      history.getSnapshot().addFile('foo', File.fromHash(File.EMPTY_FILE_HASH))
      history.findBlobHashes(blobHashes)
      expect(Array.from(blobHashes)).to.have.members([File.EMPTY_FILE_HASH])

      // Add a file with a hash and ranges hash to the snapshot.
      const snapshotRangesHash = '0'.repeat(40)
      history
        .getSnapshot()
        .addFile(
          'foo-with-ranges',
          File.fromHash(File.EMPTY_FILE_HASH, snapshotRangesHash)
        )
      history.findBlobHashes(blobHashes)
      expect(Array.from(blobHashes)).to.have.members([
        File.EMPTY_FILE_HASH,
        snapshotRangesHash,
      ])

      // Add a file with a hash to the changes.
      const testHash = 'a'.repeat(40)
      const change1 = Change.fromRaw({
        operations: [],
        timestamp: '2015-03-05T12:03:53.035Z',
        authors: [null],
      })
      change1.pushOperation(Operation.addFile('bar', File.fromHash(testHash)))

      // Add a file with a hash and ranges hash to the changes.
      const fileHash = 'b'.repeat(40)
      const rangesHash = 'c'.repeat(40)
      const change2 = Change.fromRaw({
        operations: [],
        timestamp: '2015-03-05T12:04:53.035Z',
        authors: [null],
      })
      change2.pushOperation(
        Operation.addFile('bar', File.fromHash(fileHash, rangesHash))
      )

      history.pushChanges([change1, change2])
      history.findBlobHashes(blobHashes)
      expect(Array.from(blobHashes)).to.have.members([
        File.EMPTY_FILE_HASH,
        snapshotRangesHash,
        testHash,
        fileHash,
        rangesHash,
      ])
    })
  })
})
