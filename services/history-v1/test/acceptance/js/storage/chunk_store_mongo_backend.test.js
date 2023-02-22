const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const { Chunk, Snapshot, History } = require('overleaf-editor-core')
const cleanup = require('./support/cleanup')
const backend = require('../../../../storage/lib/chunk_store/mongo')

describe('chunk store Mongo backend', function () {
  beforeEach(cleanup.everything)

  describe('garbage collection', function () {
    it('deletes pending and deleted chunks', async function () {
      const projectId = ObjectId().toString()

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
})

function makeChunk(changes, versionNumber) {
  const snapshot = Snapshot.fromRaw({ files: {} })
  const history = new History(snapshot, [])
  const chunk = new Chunk(history, versionNumber)
  return chunk
}
