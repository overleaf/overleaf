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
const { ChunkVersionConflictError } = require('../../../../storage')
const backend = require('../../../../storage/lib/chunk_store/postgres')

describe('chunk store Postgres backend', function () {
  beforeEach(cleanup.everything)

  it('should reject ObjectId strings as project IDs', async function () {
    const invalidProjectId = new ObjectId().toString()

    await expect(backend.getLatestChunk(invalidProjectId)).to.be.rejectedWith(
      'bad projectId'
    )
    await expect(
      backend.getChunkForVersion(invalidProjectId, 1)
    ).to.be.rejectedWith('bad projectId')
    await expect(
      backend.getChunkForTimestamp(invalidProjectId, new Date())
    ).to.be.rejectedWith('bad projectId')
    await expect(
      backend.getProjectChunkIds(invalidProjectId)
    ).to.be.rejectedWith('bad projectId')
    await expect(
      backend.insertPendingChunk(invalidProjectId, makeChunk([], 0))
    ).to.be.rejectedWith('bad projectId')
    await expect(
      backend.confirmCreate(invalidProjectId, makeChunk([], 0), 1)
    ).to.be.rejectedWith('bad projectId')
    await expect(
      backend.confirmUpdate(invalidProjectId, 1, makeChunk([], 0), 2)
    ).to.be.rejectedWith('bad projectId')
    await expect(backend.deleteChunk(invalidProjectId, 1)).to.be.rejectedWith(
      'bad projectId'
    )
    await expect(
      backend.deleteProjectChunks(invalidProjectId)
    ).to.be.rejectedWith('bad projectId')
  })

  describe('conflicts between chunk extension and chunk creation', function () {
    let projectId,
      baseChunkId,
      updatedChunkId,
      newChunkId,
      updatedChunk,
      newChunk

    beforeEach(async function () {
      projectId = '1234'
      const baseChunk = makeChunk([], 0)
      baseChunkId = await backend.insertPendingChunk(projectId, baseChunk)
      await backend.confirmCreate(projectId, baseChunk, baseChunkId)

      const change = new Change(
        [new AddFileOperation('main.tex', File.fromString('hello'))],
        new Date()
      )

      updatedChunk = makeChunk([change], 0)
      updatedChunkId = await backend.insertPendingChunk(projectId, updatedChunk)
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

function makeChunk(changes, versionNumber) {
  const snapshot = Snapshot.fromRaw({ files: {} })
  const history = new History(snapshot, [])
  const chunk = new Chunk(history, versionNumber)
  return chunk
}
