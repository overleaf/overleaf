import { expect } from 'chai'
import Crypto from 'node:crypto'
import Stream from 'node:stream'
import {
  makeBlobForFile,
  getStringLengthOfFile,
  makeProjectKey,
  BlobStore,
} from '../../../../storage/lib/blob_store/index.js'
import { Blob } from 'overleaf-editor-core'
import { insertBlob } from '../../../../storage/lib/blob_store/mongo.js'
import {
  backupBlob,
  downloadBlobToDir,
} from '../../../../storage/lib/backupBlob.mjs'
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
import { WritableBuffer } from '@overleaf/stream-utils'
import cleanup from './support/cleanup.js'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'

async function listS3BucketRaw(bucket) {
  const client = backupPersistor._getClientForBucket(bucket)
  return await client.send(new ListObjectsV2Command({ Bucket: bucket }))
}

async function listS3Bucket(bucket, wantStorageClass) {
  const response = await listS3BucketRaw(bucket)
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

  beforeEach(cleanup.everything)

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
      await backupBlob(historyId, blob, filePath)
    })

    it('does not upload the blob', async function () {
      const bucketContents = await listS3Bucket(projectBlobsBucket)
      expect(bucketContents).to.have.lengthOf(0)
    })
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
      await backupBlob(historyId, blob, filePath)
    })

    afterEach(async function () {
      await projects.deleteOne({
        _id: projectId,
      })
    })

    it('uploads the blob to the backup', async function () {
      const bucketContents = await listS3Bucket(projectBlobsBucket)
      expect(bucketContents).to.have.lengthOf(1)
    })
    it('stores the backup', async function () {
      expect(
        await backedUpBlobs.findOne({
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
      await backupBlob(historyId, blob, filePath)
    })

    it('uploads the blob to the backup', async function () {
      const bucketContents = await listS3Bucket(projectBlobsBucket)
      expect(bucketContents).to.have.lengthOf(1)
    })
    it('stores the backup', async function () {
      expect(
        await backedUpBlobs.findOne({
          _id: new ObjectId(historyId),
          blobs: {
            $elemMatch: { $eq: new Binary(Buffer.from(blob.getHash(), 'hex')) },
          },
        })
      ).to.exist
    })
  })

  describe('when uploadBlobToBackup fails', function () {
    let blob
    let historyId
    let mockPersistor
    let uploadError

    beforeEach(async function () {
      blob = await makeBlobForFile(filePath)
      historyId = 'abc123def456abc789def123'
      uploadError = new Error('Upload failed')

      // Create a mock persistor that rejects on sendStream
      mockPersistor = {
        sendStream: async () => {
          throw uploadError
        },
      }
    })

    it('rethrows the error and does not record the blob as backed up', async function () {
      await expect(
        backupBlob(historyId, blob, filePath, mockPersistor)
      ).to.be.rejectedWith('Upload failed')

      const record = await backedUpBlobs.findOne({
        _id: new ObjectId(historyId),
        blobs: {
          $elemMatch: { $eq: new Binary(Buffer.from(blob.getHash(), 'hex')) },
        },
      })
      expect(record).to.not.exist
    })
  })

  const cases = [
    {
      name: 'text file',
      content: Buffer.from('x'.repeat(1000)),
      storedSize: 29, // zlib.gzipSync(content).byteLength
    },
    {
      name: 'large text file',
      // 'ä' is a 2-byte utf-8 character -> 4MB.
      content: Buffer.from('ü'.repeat(2 * 1024 * 1024)),
      storedSize: 4101, // zlib.gzipSync(content).byteLength
    },
    {
      name: 'binary file',
      content: Buffer.from([0, 1, 2, 3]),
      storedSize: 4,
    },
    {
      name: 'large binary file',
      content: Crypto.randomBytes(10 * 1024 * 1024),
      storedSize: 10 * 1024 * 1024,
    },
  ]
  for (const { name, content, storedSize } of cases) {
    describe(name, function () {
      let blob
      let key
      let historyId
      beforeEach(async function () {
        historyId = 'abc123def456abc789def123'
        await fs.promises.writeFile(filePath, content)
        blob = await makeBlobForFile(filePath)
        blob.setStringLength(
          await getStringLengthOfFile(blob.getByteLength(), filePath)
        )
        key = makeProjectKey(historyId, blob.getHash())
        await backupBlob(historyId, blob, filePath)
      })
      it('should upload the blob', async function () {
        const response = await listS3BucketRaw(projectBlobsBucket)
        expect(response.Contents).to.have.length(1)
        expect(response.Contents[0].Key).to.equal(key)
        expect(response.Contents[0].Size).to.equal(storedSize)
      })
      it('should read back the same content', async function () {
        const buf = new WritableBuffer()
        await Stream.promises.pipeline(
          await backupPersistor.getObjectStream(projectBlobsBucket, key, {
            autoGunzip: true,
          }),
          buf
        )
        expect(buf.getContents()).to.deep.equal(content)
      })
    })
  }
})

describe('downloadBlobToDir', function () {
  let tmpDirDownload
  const historyId = 'abc123def456abc789def123'

  before(async function () {
    tmpDirDownload = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'downloadBlobTest-')
    )
  })

  after(async function () {
    await fs.promises.rm(tmpDirDownload, { recursive: true, force: true })
  })

  it('should download the blob successfully', async function () {
    const data = 'hello world'
    // Use putString instead of writing a source file and using makeBlobForFile
    const blobStore = new BlobStore(historyId)
    const blob = await blobStore.putString(data)

    // Now call downloadBlobToDir which will use blobStore.getStream internally
    const downloadedFilePath = await downloadBlobToDir(
      historyId,
      blob,
      tmpDirDownload
    )
    const contents = await fs.promises.readFile(downloadedFilePath, 'utf8')
    expect(contents).to.equal(data)
  })

  it('should delete the file on error (if file already exists)', async function () {
    const data = 'data that will not be written'
    const blobStore = new BlobStore(historyId)
    const blob = await blobStore.putString(data)
    const hash = blob.getHash()
    const fileName = `${historyId}-${hash}`

    // Pre-create the destination file to trigger a failure due to an existing file
    const downloadedFilePath = path.join(tmpDirDownload, fileName)
    await fs.promises.writeFile(downloadedFilePath, 'preexisting content')

    try {
      await downloadBlobToDir(historyId, blob, tmpDirDownload)
      expect.fail('should not reach here')
    } catch (error) {
      // Check that the file was deleted
      await expect(fs.promises.access(downloadedFilePath)).to.be.rejected
    }
  })

  it('should not leave an empty file if download fails', async function () {
    // Create a blob with a hash that does not exist in the blob store
    const hash = '0000000000000000000000000000000000000000'
    const blob = new Blob(hash, 12, 12)
    await insertBlob(historyId, blob)
    const fileName = `${historyId}-${hash}`
    try {
      await downloadBlobToDir(historyId, blob, tmpDirDownload)
      expect.fail('should not reach here')
    } catch (error) {
      expect(error).to.be.instanceOf(Blob.NotFoundError)
      const downloadedFilePath = path.join(tmpDirDownload, fileName)
      // Check that the file was deleted
      await expect(fs.promises.access(downloadedFilePath)).to.be.rejected
    }
  })
})
