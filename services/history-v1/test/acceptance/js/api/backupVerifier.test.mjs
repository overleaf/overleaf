// @ts-check
import cleanup from '../storage/support/cleanup.js'
import fetch from 'node-fetch'
import testServer from './support/test_backup_verifier_server.mjs'
import { expect } from 'chai'
import testProjects from './support/test_projects.js'
import {
  backupPersistor,
  chunksBucket,
  projectBlobsBucket,
} from '../../../../storage/lib/backupPersistor.mjs'
import {
  BlobStore,
  makeProjectKey,
} from '../../../../storage/lib/blob_store/index.js'
import Stream from 'node:stream'
import * as zlib from 'node:zlib'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { NotFoundError } from '@overleaf/object-persistor/src/Errors.js'
import { chunkStore } from '../../../../storage/index.js'
import {
  Change,
  File,
  Operation,
  Snapshot,
  History,
  Chunk,
} from 'overleaf-editor-core'
import Crypto from 'node:crypto'
import path from 'node:path'
import projectKey from '@overleaf/object-persistor/src/ProjectKey.js'
import { historyStore } from '../../../../storage/lib/history_store.js'

/**
 * @typedef {import("node-fetch").Response} Response
 * @typedef {import("overleaf-editor-core").Blob} Blob
 */

// Timeout for script execution, increased to avoid flaky tests
const SCRIPT_TIMEOUT = 15_000

async function verifyProjectScript(historyId, expectFail = true) {
  try {
    const result = await promisify(execFile)(
      process.argv0,
      ['storage/scripts/verify_project.mjs', `--historyId=${historyId}`],
      {
        encoding: 'utf-8',
        timeout: SCRIPT_TIMEOUT,
        env: {
          ...process.env,
          LOG_LEVEL: 'warn',
        },
      }
    )
    return { status: 0, stdout: result.stdout, stderr: result.stderr }
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'stdout' in err &&
      'code' in err &&
      'stderr' in err
    ) {
      if (!expectFail) {
        console.log(err)
      }
      return {
        stdout: typeof err.stdout === 'string' ? err.stdout : '',
        status: typeof err.code === 'number' ? err.code : -1,
        stderr: typeof err.stdout === 'string' ? err.stderr : '',
      }
    }
    throw err
  }
}

/**
 * @param {string} historyId
 * @param {string} hash
 * @return {Promise<{stdout: string, status:number }>}
 */
async function verifyBlobScript(historyId, hash, expectFail = true) {
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
        timeout: SCRIPT_TIMEOUT,
        env: {
          ...process.env,
          LOG_LEVEL: 'warn',
        },
      }
    )
    return { status: 0, stdout: result.stdout }
  } catch (err) {
    if (err && typeof err === 'object' && 'stdout' in err && 'code' in err) {
      if (!expectFail) {
        console.log(err)
      }
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

async function backupChunk(historyId) {
  const newChunkMetadata = await chunkStore.getLatestChunkMetadata(historyId)
  const { buffer: chunkBuffer } = await historyStore.loadRawWithBuffer(
    historyId,
    newChunkMetadata.id
  )
  await backupPersistor.sendStream(
    chunksBucket,
    path.join(
      projectKey.format(historyId),
      projectKey.pad(newChunkMetadata.startVersion)
    ),
    Stream.Readable.from([chunkBuffer]),
    {
      contentType: 'application/json',
      contentEncoding: 'gzip',
      contentLength: chunkBuffer.byteLength,
    }
  )
}

const FIFTEEN_MINUTES_IN_MS = 900_000

async function addFileInNewChunk(
  fileContents,
  filePath,
  historyId,
  { creationDate = new Date() }
) {
  const chunk = await chunkStore.loadLatest(historyId, { persistedOnly: true })
  const operation = Operation.addFile(filePath, File.fromString(fileContents))
  const changes = [new Change([operation], creationDate, [])]
  chunk.pushChanges(changes)
  await chunkStore.update(historyId, chunk)
}

/**
 * @param {string} historyId
 * @param {Object} [backup]
 * @return {Promise<string>}
 */
async function prepareProjectAndBlob(
  historyId,
  {
    shouldBackupBlob = true,
    shouldBackupChunk = true,
    shouldCreateChunk = true,
    extraChunks = 0, // number of additional chunks to create after the first one
    skipBackupForLastChunk = false, // when true, do not back up the last created chunk (simulates missing last chunk backup)
  } = {}
) {
  await testProjects.createEmptyProject(historyId)
  const blobStore = new BlobStore(historyId)
  const fileContents = historyId
  const initialBlob = await blobStore.putString(fileContents)
  const now = Date.now()
  const creationTime = now - FIFTEEN_MINUTES_IN_MS

  // Create first (updated) chunk if requested
  if (shouldCreateChunk) {
    await addFileInNewChunk(fileContents, `${historyId}.txt`, historyId, {
      creationDate: new Date(creationTime),
    })
  }

  // Backup the initial blob if requested
  if (shouldBackupBlob) {
    const gzipped = zlib.gzipSync(Buffer.from(fileContents))
    await backupPersistor.sendStream(
      projectBlobsBucket,
      makeProjectKey(historyId, initialBlob.getHash()),
      Stream.Readable.from([gzipped]),
      { contentLength: gzipped.byteLength, contentEncoding: 'gzip' }
    )
    await checkDEKExists(historyId)
  }
  // Backup first chunk if requested
  if (shouldCreateChunk && shouldBackupChunk) {
    await backupChunk(historyId)
  }

  for (let index = 0; index < extraChunks; index++) {
    // Create an additional chunk starting at current endVersion
    const latestMeta = await chunkStore.getLatestChunkMetadata(historyId)
    const startVersion = latestMeta.endVersion
    const snapshot = Snapshot.fromRaw({ files: {} })
    const history = new History(snapshot, [])
    const newChunk = new Chunk(history, startVersion)
    const extraContent = `${fileContents}-extra-${index + 1}`
    const extraBlob = await blobStore.putString(extraContent)
    // ensure strictly increasing timestamps
    const changeTimestamp = new Date(creationTime + (index + 1) * 60_000)
    const change = new Change(
      [
        Operation.addFile(
          `${historyId}-extra-${index + 1}.txt`,
          File.createLazyFromBlobs(extraBlob)
        ),
      ],
      changeTimestamp,
      []
    )
    newChunk.pushChanges([change])
    await chunkStore.create(historyId, newChunk)

    // Backup blob for this chunk if requested
    if (shouldBackupBlob) {
      const gzipped = zlib.gzipSync(Buffer.from(extraContent))
      await backupPersistor.sendStream(
        projectBlobsBucket,
        makeProjectKey(historyId, extraBlob.getHash()),
        Stream.Readable.from([gzipped]),
        { contentLength: gzipped.byteLength, contentEncoding: 'gzip' }
      )
    }
    // Backup the chunk unless we're intentionally skipping the last one
    const isLast = index === extraChunks - 1
    if (shouldBackupChunk && (!isLast || !skipBackupForLastChunk)) {
      await backupChunk(historyId)
    }
  }

  return initialBlob.getHash()
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
  this.timeout(5_000 + SCRIPT_TIMEOUT) // allow time for external scripts to run
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
  describe('storage/scripts/verify_project.mjs', function () {
    describe('when the project is appropriately backed up', function () {
      it('should return 0', async function () {
        const response = await verifyProjectScript(historyIdPostgres, false)
        expect(response.status).to.equal(0)
      })
    })
    describe('when the project chunk is not backed up', function () {
      let response
      beforeEach(async function () {
        await prepareProjectAndBlob('000000000000000000000043', {
          shouldBackupChunk: false,
          shouldBackupBlob: true,
          shouldCreateChunk: true,
        })
        response = await verifyProjectScript('000000000000000000000043')
      })
      it('should return 1', async function () {
        expect(response.status).to.equal(1)
      })
      it('should emit an error message referring to a missing chunk', async function () {
        const stderr = response.stderr
        expect(stderr).to.include('BackupRPOViolationChunkNotBackedUpError')
      })
    })
    describe('when a project blob is not backed up', function () {
      let response
      beforeEach(async function () {
        await prepareProjectAndBlob('43', {
          shouldBackupChunk: true,
          shouldBackupBlob: false,
          shouldCreateChunk: true,
        })
        response = await verifyProjectScript('43')
      })

      it('should return 1', function () {
        expect(response.status).to.equal(1)
      })

      it('includes a BackupCorruptedError in stderr', function () {
        expect(response.stderr).to.include(
          'BackupCorruptedMissingBlobError: missing blob'
        )
      })
    })
    describe('for a project with multiple chunks', function () {
      const multiHistoryIdOk = '100'
      const multiHistoryIdMissingLast = '101'
      let okResponse
      let missingLastResponse

      describe('when multiple chunks are fully backed up', function () {
        beforeEach(async function () {
          await prepareProjectAndBlob(multiHistoryIdOk, {
            shouldBackupBlob: true,
            shouldBackupChunk: true,
            shouldCreateChunk: true,
            extraChunks: 2, // total 3 chunks including first
          })
          okResponse = await verifyProjectScript(multiHistoryIdOk, false)
        })
        it('returns 0', function () {
          expect(okResponse.status).to.equal(0)
        })
      })

      describe('when the last chunk backup is missing', function () {
        beforeEach(async function () {
          await prepareProjectAndBlob(multiHistoryIdMissingLast, {
            shouldBackupBlob: true,
            shouldBackupChunk: true,
            shouldCreateChunk: true,
            extraChunks: 2,
            skipBackupForLastChunk: true, // simulate missing backup for last chunk
          })
          missingLastResponse = await verifyProjectScript(
            multiHistoryIdMissingLast
          )
        })
        it('returns 1', function () {
          expect(missingLastResponse.status).to.equal(1)
        })
        it('emits a BackupRPOViolationChunkNotBackedUpError', function () {
          expect(missingLastResponse.stderr).to.include(
            'BackupRPOViolationChunkNotBackedUpError'
          )
        })
      })
    })
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
      const result = await verifyBlobScript(
        historyIdPostgres,
        blobHashPG,
        false
      )
      expect(result.status).to.equal(0)
      expect(result.stdout.split('\n')).to.include('OK')
    })
    it('should successfully verify from mongo', async function () {
      const result = await verifyBlobScript(
        historyIdMongo,
        blobHashMongo,
        false
      )
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
