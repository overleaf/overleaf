// @ts-check
import cleanup from '../storage/support/cleanup.js'
import fetch from 'node-fetch'
import testServer from './support/test_backup_verifier_server.mjs'
import { expect } from 'chai'
import testProjects from './support/test_projects.js'
import {
  backupPersistor,
  projectBlobsBucket,
} from '../../../../storage/lib/backupPersistor.mjs'
import {
  BlobStore,
  makeProjectKey,
} from '../../../../storage/lib/blob_store/index.js'
import Stream from 'stream'
import * as zlib from 'node:zlib'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { NotFoundError } from '@overleaf/object-persistor/src/Errors.js'

/**
 * @typedef {import("node-fetch").Response} Response
 * @typedef {import("overleaf-editor-core").Blob} Blob
 */

/**
 * @param {string} historyId
 * @param {string} hash
 * @return {Promise<{stdout: string, status:number }>}
 */
async function verifyBlobScript(historyId, hash) {
  try {
    const result = await promisify(execFile)(
      process.argv0,
      [
        'storage/scripts/verify_backup_blob.mjs',
        `--historyId=${historyId}`,
        hash,
      ],
      {
        encoding: 'utf-8',
        timeout: 5_000,
        env: {
          ...process.env,
          LOG_LEVEL: 'warn',
        },
      }
    )
    return { status: 0, stdout: result.stdout }
  } catch (err) {
    if (err && typeof err === 'object' && 'stdout' in err && 'code' in err) {
      return {
        stdout: typeof err.stdout === 'string' ? err.stdout : '',
        status: typeof err.code === 'number' ? err.code : -1,
      }
    }
    throw err
  }
}
/**
 * @param {string} historyId
 * @param {string} hash
 * @return {Promise<Response>}
 */
async function verifyBlobHTTP(historyId, hash) {
  return await fetch(
    testServer.testUrl(`/history/${historyId}/blob/${hash}/verify`),
    { method: 'GET' }
  )
}

/**
 * @param {string} historyId
 * @return {Promise<string>}
 */
async function prepareProjectAndBlob(historyId) {
  await testProjects.createEmptyProject(historyId)
  const blobStore = new BlobStore(historyId)
  const blob = await blobStore.putString(historyId)
  const gzipped = zlib.gzipSync(Buffer.from(historyId))
  await backupPersistor.sendStream(
    projectBlobsBucket,
    makeProjectKey(historyId, blob.getHash()),
    Stream.Readable.from([gzipped]),
    { contentLength: gzipped.byteLength, contentEncoding: 'gzip' }
  )
  await checkDEKExists(historyId)
  return blob.getHash()
}

/**
 * @param {string} historyId
 * @return {Promise<void>}
 */
async function checkDEKExists(historyId) {
  await backupPersistor.forProjectRO(
    projectBlobsBucket,
    makeProjectKey(historyId, '')
  )
}

describe('backupVerifier', function () {
  const historyIdPostgres = '42'
  const historyIdMongo = '000000000000000000000042'
  let blobHashPG, blobHashMongo, blobPathPG

  beforeEach(cleanup.everything)
  beforeEach('create health check projects', async function () {
    ;[blobHashPG, blobHashMongo] = await Promise.all([
      prepareProjectAndBlob('42'),
      prepareProjectAndBlob('000000000000000000000042'),
    ])
    blobPathPG = makeProjectKey(historyIdPostgres, blobHashPG)
  })
  beforeEach(testServer.listenOnRandomPort)

  it('renders 200 on /status', async function () {
    const response = await fetch(testServer.testUrl('/status'))
    expect(response.status).to.equal(200)
  })

  it('renders 200 on /health_check', async function () {
    const response = await fetch(testServer.testUrl('/health_check'))
    expect(response.status).to.equal(200)
  })
  describe('storage/scripts/verify_backup_blob.mjs', function () {
    it('throws and does not create DEK if missing', async function () {
      const historyId = '404'
      const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      const response = await verifyBlobScript(historyId, hash)
      expect(response.status).to.equal(1)
      expect(response.stdout).to.include('dek does not exist')
      await expect(checkDEKExists(historyId)).to.be.rejectedWith(NotFoundError)
    })
    it('throws when deleted in db', async function () {
      const blobStore = new BlobStore(historyIdPostgres)
      await blobStore.deleteBlobs()
      const response = await verifyBlobScript(historyIdPostgres, blobHashPG)
      expect(response.status).to.equal(1)
      expect(response.stdout).to.include(`blob ${blobHashPG} not found`)
    })
    it('throws when not existing', async function () {
      await backupPersistor.deleteObject(projectBlobsBucket, blobPathPG)
      const result = await verifyBlobScript(historyIdPostgres, blobHashPG)
      expect(result.status).to.equal(1)
      expect(result.stdout).to.include('missing blob')
    })
    it('throws when corrupted', async function () {
      await backupPersistor.sendStream(
        projectBlobsBucket,
        blobPathPG,
        Stream.Readable.from(['something else']),
        { contentLength: 14 }
      )
      const result = await verifyBlobScript(historyIdPostgres, blobHashPG)
      expect(result.status).to.equal(1)
      expect(result.stdout).to.include('hash mismatch for backed up blob')
    })
    it('should successfully verify from postgres', async function () {
      const result = await verifyBlobScript(historyIdPostgres, blobHashPG)
      expect(result.status).to.equal(0)
      expect(result.stdout.split('\n')).to.include('OK')
    })
    it('should successfully verify from mongo', async function () {
      const result = await verifyBlobScript(historyIdMongo, blobHashMongo)
      expect(result.status).to.equal(0)
      expect(result.stdout.split('\n')).to.include('OK')
    })
  })
  describe('GET /history/:historyId/blob/:hash/verify', function () {
    it('returns 404 when deleted in db', async function () {
      const blobStore = new BlobStore(historyIdPostgres)
      await blobStore.deleteBlobs()
      const response = await verifyBlobHTTP(historyIdPostgres, blobHashPG)
      expect(response.status).to.equal(404)
      expect(await response.text()).to.equal(`blob ${blobHashPG} not found`)
    })
    it('returns 422 and does not create DEK if missing', async function () {
      const historyId = '404'
      const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      const response = await verifyBlobHTTP(historyId, hash)
      expect(response.status).to.equal(422)
      expect(await response.text()).to.equal('dek does not exist')
      await expect(checkDEKExists(historyId)).to.be.rejectedWith(NotFoundError)
    })
    it('returns 422 when not existing', async function () {
      await backupPersistor.deleteObject(projectBlobsBucket, blobPathPG)
      const response = await verifyBlobHTTP(historyIdPostgres, blobHashPG)
      expect(response.status).to.equal(422)
      expect(await response.text()).to.equal('missing blob')
    })
    it('returns 422 when corrupted', async function () {
      await backupPersistor.sendStream(
        projectBlobsBucket,
        blobPathPG,
        Stream.Readable.from(['something else']),
        { contentLength: 14 }
      )
      const response = await verifyBlobHTTP(historyIdPostgres, blobHashPG)
      expect(response.status).to.equal(422)
      expect(await response.text()).to.equal('hash mismatch for backed up blob')
    })
    it('should successfully verify from postgres', async function () {
      const response = await verifyBlobHTTP(historyIdPostgres, blobHashPG)
      expect(response.status).to.equal(200)
    })
    it('should successfully verify from mongo', async function () {
      const response = await verifyBlobHTTP(historyIdMongo, blobHashMongo)
      expect(response.status).to.equal(200)
    })
  })
})
