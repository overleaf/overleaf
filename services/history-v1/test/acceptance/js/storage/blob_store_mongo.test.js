const { expect } = require('chai')
const { ObjectId, Binary } = require('mongodb')
const { Blob } = require('overleaf-editor-core')
const cleanup = require('./support/cleanup')
const mongoBackend = require('../../../../storage/lib/blob_store/mongo')
const mongodb = require('../../../../storage/lib/mongodb')

describe('BlobStore Mongo backend', function () {
  const projectId = new ObjectId().toString()
  const hashes = {
    abcd: [
      'abcd000000000000000000000000000000000000',
      'abcd111111111111111111111111111111111111',
      'abcd222222222222222222222222222222222222',
      'abcd333333333333333333333333333333333333',
      'abcd444444444444444444444444444444444444',
      'abcd555555555555555555555555555555555555',
      'abcd666666666666666666666666666666666666',
      'abcd777777777777777777777777777777777777',
      'abcd888888888888888888888888888888888888',
      'abcd999999999999999999999999999999999999',
      'abcdaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ],
    1234: ['1234000000000000000000000000000000000000'],
    1337: ['1337000000000000000000000000000000000000'],
  }

  beforeEach('clean up', cleanup.everything)

  beforeEach('initialize the project', async function () {
    await mongoBackend.initialize(projectId)
  })

  describe('insertBlob', function () {
    it('writes blobs to the projectHistoryBlobs collection', async function () {
      for (const hash of hashes.abcd
        .slice(0, 2)
        .concat(hashes[1234].slice(0, 1))) {
        const blob = new Blob(hash, 123, 99)
        await mongoBackend.insertBlob(projectId, blob)
      }
      const record = await mongodb.blobs.findOne(new ObjectId(projectId), {
        promoteBuffers: true,
      })
      expect(record.blobs).to.deep.equal({
        abc: hashes.abcd.slice(0, 2).map(hash => ({
          h: Buffer.from(hash, 'hex'),
          b: 123,
          s: 99,
        })),
        123: [{ h: Buffer.from(hashes[1234][0], 'hex'), b: 123, s: 99 }],
      })
    })

    it('writes excess blobs to the projectHistoryShardedBlobs collection', async function () {
      for (const hash of hashes.abcd.concat(hashes[1234])) {
        const blob = new Blob(hash, 123, 99)
        await mongoBackend.insertBlob(projectId, blob)
      }
      const record = await mongodb.blobs.findOne(new ObjectId(projectId), {
        promoteBuffers: true,
      })
      expect(record.blobs).to.deep.equal({
        abc: hashes.abcd
          .slice(0, 8)
          .map(hash => ({ h: Buffer.from(hash, 'hex'), b: 123, s: 99 })),
        123: [{ h: Buffer.from(hashes[1234][0], 'hex'), b: 123, s: 99 }],
      })
      const shardedRecord = await mongodb.shardedBlobs.findOne(
        { _id: new Binary(Buffer.from(`${projectId}0a`, 'hex')) },
        { promoteBuffers: true }
      )
      expect(shardedRecord.blobs).to.deep.equal({
        bcd: hashes.abcd
          .slice(8)
          .map(hash => ({ h: Buffer.from(hash, 'hex'), b: 123, s: 99 })),
      })
    })
  })

  describe('getProjectBlobsBatch', function () {
    it('finds all the blobs', async function () {
      const projectId0 = new ObjectId().toString()
      const hashesProject0 = hashes[1234].concat(hashes.abcd)
      const projectId1 = new ObjectId().toString()
      const hashesProject1 = hashes[1337].concat(hashes.abcd)
      const projectId2 = new ObjectId().toString()
      const hashesProject2 = [] // no hashes
      const projectId3 = new ObjectId().toString()
      const hashesProject3 = hashes[1337]
      const projectBlobs = {
        [projectId0]: hashesProject0,
        [projectId1]: hashesProject1,
        [projectId2]: hashesProject2,
        [projectId3]: hashesProject3,
      }
      for (const [projectId, hashes] of Object.entries(projectBlobs)) {
        for (const hash of hashes) {
          const blob = new Blob(hash, 123, 99)
          await mongoBackend.insertBlob(projectId, blob)
        }
      }
      const projects = [projectId0, projectId1, projectId2, projectId3]
      const { nBlobs, blobs } =
        await mongoBackend.getProjectBlobsBatch(projects)
      expect(nBlobs).to.equal(
        hashesProject0.length + hashesProject1.length + hashesProject3.length
      )
      expect(Object.fromEntries(blobs.entries())).to.deep.equal({
        [projectId0]: hashesProject0.map(hash => new Blob(hash, 123, 99)),
        [projectId1]: hashesProject1.map(hash => new Blob(hash, 123, 99)),
        [projectId3]: hashesProject3.map(hash => new Blob(hash, 123, 99)),
      })
    })
  })

  describe('with existing blobs', function () {
    beforeEach(async function () {
      for (const hash of hashes.abcd.concat(hashes[1234])) {
        const blob = new Blob(hash, 123, 99)
        await mongoBackend.insertBlob(projectId, blob)
      }
    })

    describe('findBlob', function () {
      it('finds blobs in the projectHistoryBlobs collection', async function () {
        const blob = await mongoBackend.findBlob(projectId, hashes.abcd[0])
        expect(blob.getHash()).to.equal(hashes.abcd[0])
      })

      it('finds blobs in the projectHistoryShardedBlobs collection', async function () {
        const blob = await mongoBackend.findBlob(projectId, hashes.abcd[9])
        expect(blob.getHash()).to.equal(hashes.abcd[9])
      })
    })

    describe('findBlobs', function () {
      it('finds blobs in the projectHistoryBlobs collection', async function () {
        const requestedHashes = hashes.abcd.slice(0, 3).concat(hashes[1234])
        const blobs = await mongoBackend.findBlobs(projectId, requestedHashes)
        const obtainedHashes = blobs.map(blob => blob.getHash())
        expect(obtainedHashes).to.have.members(requestedHashes)
      })

      it('finds blobs in the projectHistoryShardedBlobs collection', async function () {
        const requestedHashes = [1, 3, 5, 8, 9].map(idx => hashes.abcd[idx])
        const blobs = await mongoBackend.findBlobs(projectId, requestedHashes)
        const obtainedHashes = blobs.map(blob => blob.getHash())
        expect(obtainedHashes).to.have.members(requestedHashes)
      })
    })

    describe('getProjectBlobs', function () {
      it('returns all blobs for a given project', async function () {
        const blobs = await mongoBackend.getProjectBlobs(projectId)
        const obtainedHashes = blobs.map(blob => blob.getHash())
        const expectedHashes = hashes.abcd.concat(hashes[1234])
        expect(obtainedHashes).to.have.members(expectedHashes)
      })
    })

    describe('deleteBlobs', function () {
      it('deletes all blobs for a given project', async function () {
        await mongoBackend.deleteBlobs(projectId)
        const recordCount = await mongodb.blobs.count()
        const shardedRecordCount = await mongodb.shardedBlobs.count()
        expect(recordCount).to.equal(0)
        expect(shardedRecordCount).to.equal(0)
      })
    })
  })
})
