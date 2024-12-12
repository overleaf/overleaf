import { expect } from 'chai'
import { makeBlobForFile } from '../../../../storage/lib/blob_store/index.js'
import { backupBlob } from '../../../../storage/lib/backupBlob.mjs'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import fsExtra from 'fs-extra'
import { backedUpBlobs, projects } from '../../../../storage/lib/mongodb.js'
import { Binary, ObjectId } from 'mongodb'
import {
  backupPersistor,
  projectBlobsBucket,
} from '../../../../storage/lib/backupPersistor.mjs'

async function listS3Bucket(bucket, wantStorageClass) {
  const client = backupPersistor._getClientForBucket(bucket)
  const response = await client.listObjectsV2({ Bucket: bucket }).promise()

  for (const object of response.Contents || []) {
    if (wantStorageClass) {
      expect(object).to.have.property('StorageClass', wantStorageClass)
    }
  }

  return (response.Contents || []).map(item => item.Key || '')
}

describe('backupBlob', function () {
  let filePath
  let tmpDir

  before(async function () {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'temp-test-'))
    filePath = path.join(tmpDir, 'test.txt')
    await fs.promises.writeFile(filePath, 'test')
  })

  after(async function () {
    try {
      fsExtra.remove(tmpDir)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.log('failed to delete temporary file')
      }
    }
  })

  beforeEach(async function () {
    await backupPersistor.deleteDirectory(projectBlobsBucket, '')
    expect(await listS3Bucket(projectBlobsBucket)).to.have.length(0)
  })

  describe('when the blob is already backed up', function () {
    let blob
    let historyId

    beforeEach(async function () {
      blob = await makeBlobForFile(filePath)
      historyId = 'abc123def456abc789def123'
      await backedUpBlobs.updateOne(
        {
          _id: new ObjectId(historyId),
        },
        {
          $set: { blobs: [new Binary(Buffer.from(blob.getHash(), 'hex'))] },
        },
        { upsert: true }
      )
    })

    it('does not upload the blob', async function () {
      await backupBlob(historyId, blob, filePath)
      const bucketContents = await listS3Bucket(projectBlobsBucket)
      expect(bucketContents).to.have.lengthOf(0)
    })
    it('does not store the backup', function () {})
  })

  describe('when the historyId is for a postgres project', function () {
    let blob
    let historyId
    const projectId = new ObjectId()

    beforeEach(async function () {
      blob = await makeBlobForFile(filePath)
      historyId = '123'
      await projects.insertOne({
        _id: projectId,
        overleaf: { history: { id: 123 } },
      })
      await backedUpBlobs.deleteOne({ _id: projectId })
    })

    afterEach(async function () {
      await projects.deleteOne({
        _id: projectId,
      })
    })

    it('uploads the blob to the backup', async function () {
      await backupBlob(historyId, blob, filePath)
      const bucketContents = await listS3Bucket(projectBlobsBucket)
      expect(bucketContents).to.have.lengthOf(1)
    })
    it('stores the backup', function () {
      expect(
        backedUpBlobs.findOne({
          _id: projectId,
          blobs: {
            $elemMatch: { $eq: new Binary(Buffer.from(blob.getHash(), 'hex')) },
          },
        })
      ).to.exist
    })
  })

  describe('when the blob is not already backed up', function () {
    let blob
    let historyId
    beforeEach(async function () {
      blob = await makeBlobForFile(filePath)
      historyId = 'abc123def456abc789def123'
      await backedUpBlobs.deleteOne({ _id: new ObjectId(historyId) })
    })

    it('uploads the blob to the backup', async function () {
      await backupBlob(historyId, blob, filePath)
      const bucketContents = await listS3Bucket(projectBlobsBucket)
      expect(bucketContents).to.have.lengthOf(1)
    })
    it('stores the backup', function () {
      expect(
        backedUpBlobs.findOne({
          _id: new ObjectId(historyId),
          blobs: {
            $elemMatch: { $eq: new Binary(Buffer.from(blob.getHash(), 'hex')) },
          },
        })
      ).to.exist
    })
  })
})
