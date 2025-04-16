const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const {
  Chunk,
  Snapshot,
  History,
  Change,
  AddFileOperation,
  File,
} = require('overleaf-editor-core')
const cleanup = require('./support/cleanup')
const backend = require('../../../../storage/lib/chunk_store/mongo')
const { ChunkVersionConflictError } = require('../../../../storage')

describe('chunk store Mongo backend', function () {
  beforeEach(cleanup.everything)

  describe('garbage collection', function () {
    it('deletes pending and deleted chunks', async function () {
      const projectId = new ObjectId().toString()

      // Create a pending chunk
      const pendingChunk = makeChunk([], 0)
      const pendingChunkId = await backend.insertPendingChunk(
        projectId,
        pendingChunk
      )

      // Create a deleted chunk
      const deletedChunk = makeChunk([], 0)
      const deletedChunkId = await backend.insertPendingChunk(
        projectId,
        deletedChunk
      )
      await backend.confirmCreate(projectId, deletedChunk, deletedChunkId)
      await backend.deleteChunk(projectId, deletedChunkId)

      // Check that both chunks are ready to be deleted
      let oldChunks = await backend.getOldChunksBatch(100, 0)
      expect(oldChunks).to.have.deep.members([
        { projectId, chunkId: pendingChunkId },
        { projectId, chunkId: deletedChunkId },
      ])

      // Delete old chunks
      await backend.deleteOldChunks(oldChunks.map(chunk => chunk.chunkId))

      // Check that there are no more chunks to be deleted
      oldChunks = await backend.getOldChunksBatch(100, 0)
      expect(oldChunks).to.deep.equal([])
    })
  })

  describe('concurrency handling', function () {
    it('prevents chunks from being created with the same start version', async function () {
      const projectId = new ObjectId().toString()
      const chunks = [makeChunk([], 10), makeChunk([], 10)]

      const chunkIds = []
      for (const chunk of chunks) {
        const chunkId = await backend.insertPendingChunk(projectId, chunk)
        chunkIds.push(chunkId)
      }

      await backend.confirmCreate(projectId, chunks[0], chunkIds[0])
      await expect(
        backend.confirmCreate(projectId, chunks[1], chunkIds[1])
      ).to.be.rejectedWith(ChunkVersionConflictError)
    })

    describe('conflicts between chunk extension and chunk creation', function () {
      let projectId,
        baseChunkId,
        updatedChunkId,
        newChunkId,
        updatedChunk,
        newChunk

      beforeEach(async function () {
        projectId = new ObjectId().toString()
        const baseChunk = makeChunk([], 0)
        baseChunkId = await backend.insertPendingChunk(projectId, baseChunk)
        await backend.confirmCreate(projectId, baseChunk, baseChunkId)

        const change = new Change(
          [new AddFileOperation('main.tex', File.fromString('hello'))],
          new Date()
        )

        updatedChunk = makeChunk([change], 0)
        updatedChunkId = await backend.insertPendingChunk(
          projectId,
          updatedChunk
        )
        newChunk = makeChunk([change], 1)
        newChunkId = await backend.insertPendingChunk(projectId, newChunk)
      })

      it('prevents creation after extension', async function () {
        await backend.confirmUpdate(
          projectId,
          baseChunkId,
          updatedChunk,
          updatedChunkId
        )
        await expect(
          backend.confirmCreate(projectId, newChunk, newChunkId, {
            oldChunkId: baseChunkId,
          })
        ).to.be.rejectedWith(ChunkVersionConflictError)
      })

      it('prevents extension after creation', async function () {
        await backend.confirmCreate(projectId, newChunk, newChunkId, {
          oldChunkId: baseChunkId,
        })
        await expect(
          backend.confirmUpdate(
            projectId,
            baseChunkId,
            updatedChunk,
            updatedChunkId
          )
        ).to.be.rejectedWith(ChunkVersionConflictError)
      })
    })
  })
})

function makeChunk(changes, versionNumber) {
  const snapshot = Snapshot.fromRaw({ files: {} })
  const history = new History(snapshot, changes)
  const chunk = new Chunk(history, versionNumber)
  return chunk
}
