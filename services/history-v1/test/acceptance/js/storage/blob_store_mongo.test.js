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
