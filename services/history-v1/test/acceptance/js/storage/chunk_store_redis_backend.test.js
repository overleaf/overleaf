'use strict'

const { expect } = require('chai')
const {
  Chunk,
  Snapshot,
  History,
  File,
  AddFileOperation,
  Origin,
  Change,
  V2DocVersions,
} = require('overleaf-editor-core')
const cleanup = require('./support/cleanup')
const redisBackend = require('../../../../storage/lib/chunk_store/redis')

describe('chunk store Redis backend', function () {
  beforeEach(cleanup.everything)
  const projectId = '123456'

  describe('getCurrentChunk', function () {
    it('should return null on cache miss', async function () {
      const chunk = await redisBackend.getCurrentChunk(projectId)
      expect(chunk).to.be.null
    })

    it('should return the cached chunk', async function () {
      // Create a sample chunk
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date(),
          []
        ),
      ]
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 5) // startVersion 5

      // Cache the chunk
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Retrieve the cached chunk
      const cachedChunk = await redisBackend.getCurrentChunk(projectId)

      expect(cachedChunk).to.not.be.null
      expect(cachedChunk.getStartVersion()).to.equal(5)
      expect(cachedChunk.getEndVersion()).to.equal(6)
      expect(cachedChunk).to.deep.equal(chunk)
    })
  })

  describe('setCurrentChunk', function () {
    it('should successfully cache a chunk', async function () {
      // Create a sample chunk
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date(),
          []
        ),
      ]
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 5) // startVersion 5

      // Cache the chunk
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Verify the chunk was cached correctly by retrieving it
      const cachedChunk = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunk).to.not.be.null
      expect(cachedChunk.getStartVersion()).to.equal(5)
      expect(cachedChunk.getEndVersion()).to.equal(6)
      expect(cachedChunk).to.deep.equal(chunk)

      // Verify that the chunk was stored correctly using the chunk metadata
      const chunkMetadata =
        await redisBackend.getCurrentChunkMetadata(projectId)
      expect(chunkMetadata).to.not.be.null
      expect(chunkMetadata.startVersion).to.equal(5)
      expect(chunkMetadata.changesCount).to.equal(1)
    })

    it('should correctly handle a chunk with zero changes', async function () {
      // Create a sample chunk with no changes
      const snapshot = new Snapshot()
      const changes = []
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 10) // startVersion 10

      // Cache the chunk
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Retrieve the cached chunk
      const cachedChunk = await redisBackend.getCurrentChunk(projectId)

      expect(cachedChunk).to.not.be.null
      expect(cachedChunk.getStartVersion()).to.equal(10)
      expect(cachedChunk.getEndVersion()).to.equal(10) // End version should equal start version with no changes
      expect(cachedChunk.history.changes.length).to.equal(0)
      expect(cachedChunk).to.deep.equal(chunk)
    })
  })

  describe('updating already cached chunks', function () {
    it('should replace a chunk with a longer chunk', async function () {
      // Set initial chunk with one change
      const snapshotA = new Snapshot()
      const changesA = [
        new Change(
          [
            new AddFileOperation(
              'test.tex',
              File.fromString('Initial content')
            ),
          ],
          new Date(),
          []
        ),
      ]
      const historyA = new History(snapshotA, changesA)
      const chunkA = new Chunk(historyA, 10)

      await redisBackend.setCurrentChunk(projectId, chunkA)

      // Verify the initial chunk was cached
      const cachedChunkA = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkA.getStartVersion()).to.equal(10)
      expect(cachedChunkA.getEndVersion()).to.equal(11)
      expect(cachedChunkA.history.changes.length).to.equal(1)

      // Create a longer chunk (with more changes)
      const snapshotB = new Snapshot()
      const changesB = [
        new Change(
          [new AddFileOperation('test1.tex', File.fromString('Content 1'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('test2.tex', File.fromString('Content 2'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('test3.tex', File.fromString('Content 3'))],
          new Date(),
          []
        ),
      ]
      const historyB = new History(snapshotB, changesB)
      const chunkB = new Chunk(historyB, 15)

      // Replace the cached chunk
      await redisBackend.setCurrentChunk(projectId, chunkB)

      // Verify the new chunk replaced the old one
      const cachedChunkB = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkB).to.not.be.null
      expect(cachedChunkB.getStartVersion()).to.equal(15)
      expect(cachedChunkB.getEndVersion()).to.equal(18)
      expect(cachedChunkB.history.changes.length).to.equal(3)
      expect(cachedChunkB).to.deep.equal(chunkB)

      // Verify the metadata was updated
      const updatedMetadata =
        await redisBackend.getCurrentChunkMetadata(projectId)
      expect(updatedMetadata.startVersion).to.equal(15)
      expect(updatedMetadata.changesCount).to.equal(3)
    })

    it('should replace a chunk with a shorter chunk', async function () {
      // Set initial chunk with three changes
      const snapshotA = new Snapshot()
      const changesA = [
        new Change(
          [new AddFileOperation('file1.tex', File.fromString('Content 1'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('file2.tex', File.fromString('Content 2'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('file3.tex', File.fromString('Content 3'))],
          new Date(),
          []
        ),
      ]
      const historyA = new History(snapshotA, changesA)
      const chunkA = new Chunk(historyA, 20)

      await redisBackend.setCurrentChunk(projectId, chunkA)

      // Verify the initial chunk was cached
      const cachedChunkA = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkA.getStartVersion()).to.equal(20)
      expect(cachedChunkA.getEndVersion()).to.equal(23)
      expect(cachedChunkA.history.changes.length).to.equal(3)

      // Create a shorter chunk (with fewer changes)
      const snapshotB = new Snapshot()
      const changesB = [
        new Change(
          [new AddFileOperation('new.tex', File.fromString('New content'))],
          new Date(),
          []
        ),
      ]
      const historyB = new History(snapshotB, changesB)
      const chunkB = new Chunk(historyB, 30)

      // Replace the cached chunk
      await redisBackend.setCurrentChunk(projectId, chunkB)

      // Verify the new chunk replaced the old one
      const cachedChunkB = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkB).to.not.be.null
      expect(cachedChunkB.getStartVersion()).to.equal(30)
      expect(cachedChunkB.getEndVersion()).to.equal(31)
      expect(cachedChunkB.history.changes.length).to.equal(1)
      expect(cachedChunkB).to.deep.equal(chunkB)

      // Verify the metadata was updated
      const updatedMetadata =
        await redisBackend.getCurrentChunkMetadata(projectId)
      expect(updatedMetadata.startVersion).to.equal(30)
      expect(updatedMetadata.changesCount).to.equal(1)
    })

    it('should replace a chunk with a zero-length chunk', async function () {
      // Set initial chunk with changes
      const snapshotA = new Snapshot()
      const changesA = [
        new Change(
          [new AddFileOperation('file1.tex', File.fromString('Content 1'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('file2.tex', File.fromString('Content 2'))],
          new Date(),
          []
        ),
      ]
      const historyA = new History(snapshotA, changesA)
      const chunkA = new Chunk(historyA, 25)

      await redisBackend.setCurrentChunk(projectId, chunkA)

      // Verify the initial chunk was cached
      const cachedChunkA = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkA.getStartVersion()).to.equal(25)
      expect(cachedChunkA.getEndVersion()).to.equal(27)
      expect(cachedChunkA.history.changes.length).to.equal(2)

      // Create a zero-length chunk (with no changes)
      const snapshotB = new Snapshot()
      const changesB = []
      const historyB = new History(snapshotB, changesB)
      const chunkB = new Chunk(historyB, 40)

      // Replace the cached chunk
      await redisBackend.setCurrentChunk(projectId, chunkB)

      // Verify the new chunk replaced the old one
      const cachedChunkB = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkB).to.not.be.null
      expect(cachedChunkB.getStartVersion()).to.equal(40)
      expect(cachedChunkB.getEndVersion()).to.equal(40) // Start version equals end version with no changes
      expect(cachedChunkB.history.changes.length).to.equal(0)
      expect(cachedChunkB).to.deep.equal(chunkB)

      // Verify the metadata was updated
      const updatedMetadata =
        await redisBackend.getCurrentChunkMetadata(projectId)
      expect(updatedMetadata.startVersion).to.equal(40)
      expect(updatedMetadata.changesCount).to.equal(0)
    })

    it('should replace a zero-length chunk with a non-empty chunk', async function () {
      // Set initial empty chunk
      const snapshotA = new Snapshot()
      const changesA = []
      const historyA = new History(snapshotA, changesA)
      const chunkA = new Chunk(historyA, 50)

      await redisBackend.setCurrentChunk(projectId, chunkA)

      // Verify the initial chunk was cached
      const cachedChunkA = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkA.getStartVersion()).to.equal(50)
      expect(cachedChunkA.getEndVersion()).to.equal(50)
      expect(cachedChunkA.history.changes.length).to.equal(0)

      // Create a non-empty chunk
      const snapshotB = new Snapshot()
      const changesB = [
        new Change(
          [new AddFileOperation('newfile.tex', File.fromString('New content'))],
          new Date(),
          []
        ),
        new Change(
          [
            new AddFileOperation(
              'another.tex',
              File.fromString('Another file')
            ),
          ],
          new Date(),
          []
        ),
      ]
      const historyB = new History(snapshotB, changesB)
      const chunkB = new Chunk(historyB, 60)

      // Replace the cached chunk
      await redisBackend.setCurrentChunk(projectId, chunkB)

      // Verify the new chunk replaced the old one
      const cachedChunkB = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkB).to.not.be.null
      expect(cachedChunkB.getStartVersion()).to.equal(60)
      expect(cachedChunkB.getEndVersion()).to.equal(62)
      expect(cachedChunkB.history.changes.length).to.equal(2)
      expect(cachedChunkB).to.deep.equal(chunkB)

      // Verify the metadata was updated
      const updatedMetadata =
        await redisBackend.getCurrentChunkMetadata(projectId)
      expect(updatedMetadata.startVersion).to.equal(60)
      expect(updatedMetadata.changesCount).to.equal(2)
    })
  })

  describe('checkCacheValidity', function () {
    it('should return true when versions match', function () {
      const snapshotA = new Snapshot()
      const historyA = new History(snapshotA, [])
      const chunkA = new Chunk(historyA, 10)
      chunkA.pushChanges([
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello'))],
          new Date(),
          []
        ),
      ])

      const snapshotB = new Snapshot()
      const historyB = new History(snapshotB, [])
      const chunkB = new Chunk(historyB, 10)
      chunkB.pushChanges([
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello'))],
          new Date(),
          []
        ),
      ])

      const isValid = redisBackend.checkCacheValidity(chunkA, chunkB)
      expect(isValid).to.be.true
    })

    it('should return false when start versions differ', function () {
      const snapshotA = new Snapshot()
      const historyA = new History(snapshotA, [])
      const chunkA = new Chunk(historyA, 10)

      const snapshotB = new Snapshot()
      const historyB = new History(snapshotB, [])
      const chunkB = new Chunk(historyB, 11)

      const isValid = redisBackend.checkCacheValidity(chunkA, chunkB)
      expect(isValid).to.be.false
    })

    it('should return false when end versions differ', function () {
      const snapshotA = new Snapshot()
      const historyA = new History(snapshotA, [])
      const chunkA = new Chunk(historyA, 10)
      chunkA.pushChanges([
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello'))],
          new Date(),
          []
        ),
      ])

      const snapshotB = new Snapshot()
      const historyB = new History(snapshotB, [])
      const chunkB = new Chunk(historyB, 10)
      chunkB.pushChanges([
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('other.tex', File.fromString('World'))],
          new Date(),
          []
        ),
      ])

      const isValid = redisBackend.checkCacheValidity(chunkA, chunkB)
      expect(isValid).to.be.false
    })

    it('should return false when cached chunk is null', function () {
      const snapshotB = new Snapshot()
      const historyB = new History(snapshotB, [])
      const chunkB = new Chunk(historyB, 10)

      const isValid = redisBackend.checkCacheValidity(null, chunkB)
      expect(isValid).to.be.false
    })
  })

  describe('compareChunks', function () {
    it('should return true when chunks are identical', function () {
      // Create two identical chunks
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date('2025-04-10T12:00:00Z'), // Using fixed date for consistent comparison
          []
        ),
      ]
      const history1 = new History(snapshot, changes)
      const chunk1 = new Chunk(history1, 5)

      // Create a separate but identical chunk
      const snapshot2 = new Snapshot()
      const changes2 = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date('2025-04-10T12:00:00Z'), // Using same fixed date
          []
        ),
      ]
      const history2 = new History(snapshot2, changes2)
      const chunk2 = new Chunk(history2, 5)

      const result = redisBackend.compareChunks(projectId, chunk1, chunk2)
      expect(result).to.be.true
    })

    it('should return false when chunks differ', function () {
      // Create first chunk
      const snapshot1 = new Snapshot()
      const changes1 = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date('2025-04-10T12:00:00Z'),
          []
        ),
      ]
      const history1 = new History(snapshot1, changes1)
      const chunk1 = new Chunk(history1, 5)

      // Create a different chunk (different content)
      const snapshot2 = new Snapshot()
      const changes2 = [
        new Change(
          [
            new AddFileOperation(
              'test.tex',
              File.fromString('Different content')
            ),
          ],
          new Date('2025-04-10T12:00:00Z'),
          []
        ),
      ]
      const history2 = new History(snapshot2, changes2)
      const chunk2 = new Chunk(history2, 5)

      const result = redisBackend.compareChunks(projectId, chunk1, chunk2)
      expect(result).to.be.false
    })

    it('should return false when one chunk is null', function () {
      // Create a chunk
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date('2025-04-10T12:00:00Z'),
          []
        ),
      ]
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 5)

      const resultWithNullCached = redisBackend.compareChunks(
        projectId,
        null,
        chunk
      )
      expect(resultWithNullCached).to.be.false

      const resultWithNullCurrent = redisBackend.compareChunks(
        projectId,
        chunk,
        null
      )
      expect(resultWithNullCurrent).to.be.false
    })

    it('should return false when chunks have different start versions', function () {
      // Create first chunk with start version 5
      const snapshot1 = new Snapshot()
      const changes1 = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date('2025-04-10T12:00:00Z'),
          []
        ),
      ]
      const history1 = new History(snapshot1, changes1)
      const chunk1 = new Chunk(history1, 5)

      // Create second chunk with identical content but different start version (10)
      const snapshot2 = new Snapshot()
      const changes2 = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date('2025-04-10T12:00:00Z'),
          []
        ),
      ]
      const history2 = new History(snapshot2, changes2)
      const chunk2 = new Chunk(history2, 10)

      const result = redisBackend.compareChunks(projectId, chunk1, chunk2)
      expect(result).to.be.false
    })
  })

  describe('integration with redis', function () {
    it('should store and retrieve complex chunks correctly', async function () {
      // Create a more complex chunk
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('file1.tex', File.fromString('Content 1'))],
          new Date(),
          [1234]
        ),
        new Change(
          [new AddFileOperation('file2.tex', File.fromString('Content 2'))],
          new Date(),
          null,
          new Origin('test-origin'),
          ['5a296963ad5e82432674c839', null],
          '123.4',
          new V2DocVersions({
            'random-doc-id': { pathname: 'file2.tex', v: 123 },
          })
        ),
        new Change(
          [new AddFileOperation('file3.tex', File.fromString('Content 3'))],
          new Date(),
          []
        ),
      ]
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 20)

      // Cache the chunk
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Retrieve the cached chunk
      const cachedChunk = await redisBackend.getCurrentChunk(projectId)

      expect(cachedChunk.getStartVersion()).to.equal(20)
      expect(cachedChunk.getEndVersion()).to.equal(23)
      expect(cachedChunk).to.deep.equal(chunk)
      expect(cachedChunk.history.changes.length).to.equal(3)

      // Check that the operations were preserved correctly
      const retrievedChanges = cachedChunk.history.changes
      expect(retrievedChanges[0].getOperations()[0].getPathname()).to.equal(
        'file1.tex'
      )
      expect(retrievedChanges[1].getOperations()[0].getPathname()).to.equal(
        'file2.tex'
      )
      expect(retrievedChanges[2].getOperations()[0].getPathname()).to.equal(
        'file3.tex'
      )

      // Check that the chunk was stored correctly using the chunk metadata
      const chunkMetadata =
        await redisBackend.getCurrentChunkMetadata(projectId)
      expect(chunkMetadata).to.not.be.null
      expect(chunkMetadata.startVersion).to.equal(20)
      expect(chunkMetadata.changesCount).to.equal(3)
    })
  })
})
