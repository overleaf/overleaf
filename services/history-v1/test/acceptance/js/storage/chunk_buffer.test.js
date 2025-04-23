'use strict'

const { expect } = require('chai')
const sinon = require('sinon')
const {
  Chunk,
  Snapshot,
  History,
  File,
  AddFileOperation,
  EditFileOperation,
  AddCommentOperation,
  TextOperation,
  Range,
  TrackingProps,
  Change,
} = require('overleaf-editor-core')
const cleanup = require('./support/cleanup')
const fixtures = require('./support/fixtures')
const chunkBuffer = require('../../../../storage/lib/chunk_buffer')
const chunkStore = require('../../../../storage/lib/chunk_store')
const redisBackend = require('../../../../storage/lib/chunk_store/redis')
const metrics = require('@overleaf/metrics')

describe('chunk buffer', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)
  beforeEach(function () {
    sinon.spy(metrics, 'inc')
  })
  afterEach(function () {
    metrics.inc.restore()
  })

  const projectId = '123456'

  describe('loadLatest', function () {
    // Initialize project and create a test chunk
    beforeEach(async function () {
      // Initialize project in chunk store
      await chunkStore.initializeProject(projectId)
    })

    describe('with an existing chunk', function () {
      beforeEach(async function () {
        // Create a sample chunk with some content
        const snapshot = new Snapshot()
        const changes = [
          new Change(
            [new AddFileOperation('test.tex', File.fromString('Hello World'))],
            new Date(),
            []
          ),
        ]
        const history = new History(snapshot, changes)
        const chunk = new Chunk(history, 1) // startVersion 1

        // Store the chunk directly in the chunk store using create method
        // which internally calls uploadChunk
        await chunkStore.create(projectId, chunk)

        // Clear any existing cache
        await redisBackend.clearCache(projectId)
      })

      it('should load from chunk store and update cache on first access (cache miss)', async function () {
        // Load the underlying chunk from the chunk store for verification
        const storedChunk = await chunkStore.loadLatest(projectId)

        // First access should load from chunk store and populate cache
        const firstResult = await chunkBuffer.loadLatest(projectId)

        // Verify the chunk is correct
        expect(firstResult).to.not.be.null
        expect(firstResult.getStartVersion()).to.equal(1)
        expect(firstResult.getEndVersion()).to.equal(2)

        // Verify the chunk is the same as the one in the store
        expect(firstResult).to.deep.equal(storedChunk)

        // Verify that we got a cache miss metric
        expect(
          metrics.inc.calledWith('chunk_buffer.loadLatest', 1, {
            status: 'cache-miss',
          })
        ).to.be.true

        // Reset the metrics spy
        metrics.inc.resetHistory()

        // Second access should hit the cache
        const secondResult = await chunkBuffer.loadLatest(projectId)

        // Verify we got the same chunk
        expect(secondResult).to.not.be.null
        expect(secondResult.getStartVersion()).to.equal(1)
        expect(secondResult.getEndVersion()).to.equal(2)

        // Verify the chunk is the same as the one in the store
        expect(secondResult).to.deep.equal(storedChunk)

        // Verify that we got a cache hit metric
        expect(
          metrics.inc.calledWith('chunk_buffer.loadLatest', 1, {
            status: 'cache-hit',
          })
        ).to.be.true

        // Verify both chunks are equivalent
        expect(secondResult.getStartVersion()).to.equal(
          firstResult.getStartVersion()
        )
        expect(secondResult.getEndVersion()).to.equal(
          firstResult.getEndVersion()
        )
        expect(secondResult).to.deep.equal(firstResult)
      })

      it('should refresh the cache when chunk changes in the store', async function () {
        // First access to load into cache
        const firstResult = await chunkBuffer.loadLatest(projectId)
        expect(firstResult.getStartVersion()).to.equal(1)

        // Reset metrics spy
        metrics.inc.resetHistory()

        // Create a new chunk with different content
        const newSnapshot = new Snapshot()
        const newChanges = [
          new Change(
            [
              new AddFileOperation(
                'updated.tex',
                File.fromString('Updated content')
              ),
            ],
            new Date(),
            []
          ),
        ]
        const newHistory = new History(newSnapshot, newChanges)
        const newChunk = new Chunk(newHistory, 2) // Different start version

        // Store the new chunk directly in the chunk store
        await chunkStore.create(projectId, newChunk)

        // Load the underlying chunk from the chunk store for verification
        const storedChunk = await chunkStore.loadLatest(projectId)

        // Access again - should detect the change and refresh cache
        const secondResult = await chunkBuffer.loadLatest(projectId)

        // Verify we got the updated chunk
        expect(secondResult.getStartVersion()).to.equal(2)
        expect(secondResult.getEndVersion()).to.equal(3)
        // Verify that the chunk content is the same
        expect(secondResult).to.deep.equal(storedChunk)

        // Verify that we got a cache miss metric (since the cached chunk was invalidated)
        expect(
          metrics.inc.calledWith('chunk_buffer.loadLatest', 1, {
            status: 'cache-miss',
          })
        ).to.be.true
      })

      it('should continue using cache when chunk in store has not changed', async function () {
        // Load the underlying chunk from the chunk store for verification
        const storedChunk = await chunkStore.loadLatest(projectId)

        // First access to load into cache
        await chunkBuffer.loadLatest(projectId)

        // Reset metrics spy
        metrics.inc.resetHistory()

        // Access again without changing the underlying chunk
        const result = await chunkBuffer.loadLatest(projectId)

        // Verify we got the same chunk
        expect(result.getStartVersion()).to.equal(1)
        expect(result.getEndVersion()).to.equal(2)
        expect(result).to.deep.equal(storedChunk)

        // Verify that we got a cache hit metric
        expect(
          metrics.inc.calledWith('chunk_buffer.loadLatest', 1, {
            status: 'cache-hit',
          })
        ).to.be.true
      })
    })

    it('should handle a chunk with metadata, comments and tracked changes', async function () {
      // Create a snapshot and initial file
      const snapshot = new Snapshot()
      const initialFileOp = new AddFileOperation(
        'test.tex',
        File.fromString('Initial line.\\nSecond line.', {
          meta1: 'abc',
          meta2: 'def',
        })
      )
      const initialChange = new Change([initialFileOp], new Date(), [])

      // Add a comment
      const commentOp = new AddCommentOperation(
        'comment1',
        [new Range(0, 7)] // Range for "Initial"
      )
      const commentChange = new Change(
        [new EditFileOperation('test.tex', commentOp)],
        new Date(),
        []
      )

      // Tracked insert
      const trackedInsertOp = new TextOperation()
        .retain(14)
        .insert('Hello', {
          commentIds: ['comment1'],
          tracking: TrackingProps.fromRaw({
            ts: '2024-01-01T00:00:00.000Z',
            type: 'insert',
            userId: 'user1',
          }),
        })
        .retain(12)
      const insertChange = new Change(
        [new EditFileOperation('test.tex', trackedInsertOp)],
        new Date(),
        []
      )

      // Tracked delete
      const trackedDeleteOp = new TextOperation().retain(14, {
        tracking: TrackingProps.fromRaw({
          ts: '2024-01-01T00:00:00.000Z',
          type: 'delete',
          userId: 'user1',
        }),
      })
      const deleteChange = new Change(
        [new EditFileOperation('test.tex', trackedDeleteOp)],
        new Date(),
        []
      )

      // Combine changes into history and create chunk
      const history = new History(snapshot, [
        initialChange,
        commentChange,
        insertChange,
        deleteChange,
      ])
      const chunk = new Chunk(history, 1) // Start version 0
      // Store the chunk
      await chunkStore.create(projectId, chunk)
      // Clear the cache
      await redisBackend.clearCache(projectId)
      metrics.inc.resetHistory()

      // Load the underlying chunk from the chunk store for verification
      const storedChunk = await chunkStore.loadLatest(projectId)

      // Load the chunk via buffer (cache miss)
      const firstResult = await chunkBuffer.loadLatest(projectId)

      // Verify chunk details
      expect(firstResult.getStartVersion()).to.equal(1)
      expect(firstResult.getEndVersion()).to.equal(5) // 4 changes
      expect(firstResult.history.changes.length).to.equal(4)
      expect(firstResult).to.deep.equal(storedChunk)

      // Verify cache miss metric
      expect(
        metrics.inc.calledWith('chunk_buffer.loadLatest', 1, {
          status: 'cache-miss',
        })
      ).to.be.true

      // Reset metrics
      metrics.inc.resetHistory()

      // Second access should hit the cache
      const secondResult = await chunkBuffer.loadLatest(projectId)

      // Verify we got the same chunk
      expect(secondResult.getStartVersion()).to.equal(1)
      expect(secondResult.getEndVersion()).to.equal(5)
      expect(secondResult.history.changes.length).to.equal(4)
      expect(secondResult).to.deep.equal(storedChunk)

      // Verify cache hit metric
      expect(
        metrics.inc.calledWith('chunk_buffer.loadLatest', 1, {
          status: 'cache-hit',
        })
      ).to.be.true
    })

    describe('with an empty project', function () {
      it('should handle a case with empty chunks (no changes)', async function () {
        // Clear the cache
        await redisBackend.clearCache(projectId)

        // Load the underlying chunk from the chunk store for verification
        const storedChunk = await chunkStore.loadLatest(projectId)

        // Load the initial empty chunk via buffer
        const result = await chunkBuffer.loadLatest(projectId)

        // Verify we got the empty chunk
        expect(result.getStartVersion()).to.equal(0)
        expect(result.getEndVersion()).to.equal(0) // Start equals end for empty chunks
        expect(result.history.changes.length).to.equal(0)

        // Verify that the chunk is the same as the one in the store
        expect(result).to.deep.equal(storedChunk)

        // Verify cache miss metric
        expect(
          metrics.inc.calledWith('chunk_buffer.loadLatest', 1, {
            status: 'cache-miss',
          })
        ).to.be.true

        // Reset metrics
        metrics.inc.resetHistory()

        // Second access should hit the cache
        const secondResult = await chunkBuffer.loadLatest(projectId)

        // Verify we got the same empty chunk
        expect(secondResult.getStartVersion()).to.equal(0)
        expect(secondResult.getEndVersion()).to.equal(0)
        expect(secondResult.history.changes.length).to.equal(0)

        // Verify that the chunk is the same as the one in the store
        expect(secondResult).to.deep.equal(storedChunk)

        // Verify cache hit metric
        expect(
          metrics.inc.calledWith('chunk_buffer.loadLatest', 1, {
            status: 'cache-hit',
          })
        ).to.be.true
      })
    })
  })
})
