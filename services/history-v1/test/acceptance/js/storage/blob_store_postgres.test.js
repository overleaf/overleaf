const postgresBackend = require('../../../../storage/lib/blob_store/postgres')
const { ObjectId } = require('mongodb')
const { expect } = require('chai')

describe('BlobStore postgres backend', function () {
  describe('projectId validation', function () {
    it('insertBlob rejects when called with bad projectId', async function () {
      const projectId = new ObjectId().toString()
      await expect(
        postgresBackend.insertBlob(projectId, 'hash', 123, 99)
      ).to.be.rejectedWith(`bad projectId ${projectId}`)
    })

    it('deleteBlobs rejects when called with bad projectId', async function () {
      const projectId = new ObjectId().toString()
      await expect(postgresBackend.deleteBlobs(projectId)).to.be.rejectedWith(
        `bad projectId ${projectId}`
      )
    })

    it('findBlobs rejects when called with bad projectId', async function () {
      const projectId = new ObjectId().toString()
      await expect(postgresBackend.findBlobs(projectId)).to.be.rejectedWith(
        `bad projectId ${projectId}`
      )
    })

    it('findBlob rejects when called with bad projectId', async function () {
      const projectId = new ObjectId().toString()
      await expect(
        postgresBackend.findBlob(projectId, 'hash')
      ).to.be.rejectedWith(`bad projectId ${projectId}`)
    })

    it('getProjectBlobs rejects when called with bad projectId', async function () {
      const projectId = new ObjectId().toString()
      await expect(
        postgresBackend.getProjectBlobs(projectId)
      ).to.be.rejectedWith(`bad projectId ${projectId}`)
    })
  })
})
