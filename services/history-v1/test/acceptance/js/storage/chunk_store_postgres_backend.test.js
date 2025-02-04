const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const { Chunk, Snapshot, History } = require('overleaf-editor-core')
const cleanup = require('./support/cleanup')
const backend = require('../../../../storage/lib/chunk_store/postgres')

describe('chunk store Postgres backend', function () {
  beforeEach(cleanup.everything)

  it('should reject ObjectId strings as project IDs', async function () {
    const invalidProjectId = new ObjectId().toString()

    await expect(backend.getLatestChunk(invalidProjectId)).to.be.rejectedWith(
      `bad projectId ${invalidProjectId}`
    )
    await expect(
      backend.getChunkForVersion(invalidProjectId, 1)
    ).to.be.rejectedWith(`bad projectId ${invalidProjectId}`)
    await expect(
      backend.getChunkForTimestamp(invalidProjectId, new Date())
    ).to.be.rejectedWith(`bad projectId ${invalidProjectId}`)
    await expect(
      backend.getProjectChunkIds(invalidProjectId)
    ).to.be.rejectedWith(`bad projectId ${invalidProjectId}`)
    await expect(
      backend.insertPendingChunk(invalidProjectId, makeChunk([], 0))
    ).to.be.rejectedWith(`bad projectId ${invalidProjectId}`)
    await expect(
      backend.confirmCreate(invalidProjectId, makeChunk([], 0), 1)
    ).to.be.rejectedWith(`bad projectId ${invalidProjectId}`)
    await expect(
      backend.confirmUpdate(invalidProjectId, 1, makeChunk([], 0), 2)
    ).to.be.rejectedWith(`bad projectId ${invalidProjectId}`)
    await expect(backend.deleteChunk(invalidProjectId, 1)).to.be.rejectedWith(
      `bad projectId ${invalidProjectId}`
    )
    await expect(
      backend.deleteProjectChunks(invalidProjectId)
    ).to.be.rejectedWith(`bad projectId ${invalidProjectId}`)
  })
})

function makeChunk(changes, versionNumber) {
  const snapshot = Snapshot.fromRaw({ files: {} })
  const history = new History(snapshot, [])
  const chunk = new Chunk(history, versionNumber)
  return chunk
}
