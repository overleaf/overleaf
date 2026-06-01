import { expect } from 'chai'
import config from 'config'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import { promisify } from 'node:util'
import { Change, Operation, File, TextOperation } from 'overleaf-editor-core'
// We depend on this via object-persistor.
// eslint-disable-next-line import/no-extraneous-dependencies
import { Storage } from '@google-cloud/storage'
import {
  loadGlobalBlobs,
  BlobStore,
} from '../../../../storage/lib/blob_store/index.js'
import ChunkStore from '../../../../storage/lib/chunk_store/index.js'
import persistChanges from '../../../../storage/lib/persist_changes.js'
import testFiles from '../storage/support/test_files.js'
import cleanup from './support/cleanup.js'
import { getZipEntries } from './support/unzip.js'

describe('recover_zip script', function () {
  let projectId
  let limitsToPersistImmediately

  before(async function () {
    const farFuture = new Date()
    farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
    limitsToPersistImmediately = {
      minChangeTimestamp: farFuture,
      maxChangeTimestamp: farFuture,
      maxChanges: 10,
      maxChunkChanges: 10,
    }

    const gcsEndpoint = config.get('persistor.gcs.endpoint')
    const storage = new Storage({
      apiEndpoint: gcsEndpoint.apiEndpoint,
      projectId: gcsEndpoint.projectId,
    })
    const bucketName = config.get('zipStore.bucket')
    try {
      const [exists] = await storage.bucket(bucketName).exists()
      if (!exists) {
        await storage.createBucket(bucketName)
      }
    } catch (err) {
      if (err.code !== 409) throw err
    }
  })

  beforeEach(cleanup.everything)

  beforeEach(async function () {
    await loadGlobalBlobs()
    projectId = '123'

    // Initialize the project in the chunk store
    await ChunkStore.initializeProject(projectId)

    const blobStore = new BlobStore(projectId)

    // Upload binary file blob
    await blobStore.putFile(testFiles.path('graph.png'))

    // Create initial snapshot with text and binary files
    const addMainTex = Operation.addFile(
      'main.tex',
      File.fromString('hello world')
    )
    const addGraphPng = Operation.addFile(
      'graph.png',
      File.fromHash(testFiles.GRAPH_PNG_HASH)
    )
    const change1 = new Change([addMainTex, addGraphPng], new Date(), [])
    await persistChanges(projectId, [change1], limitsToPersistImmediately, 0)

    // Add a text edit
    const textOp = TextOperation.fromJSON({
      textOperation: ['hello world'.length, ' more'],
    })
    const editOp = Operation.editFile('main.tex', textOp)
    const change2 = new Change([editOp], new Date(), [])
    await persistChanges(projectId, [change2], limitsToPersistImmediately, 1)
  })

  it('creates a valid zip from GCS data', async function () {
    this.timeout(30 * 1000)

    const zipPath = `/tmp/test-recover-zip-${projectId}.zip`
    try {
      const { stdout } = await runRecoverZipScript([projectId])

      // The script logs the signed URL to stdout
      const urlMatch = stdout.match(/(https?:\/\/[^\s]+)/)
      expect(urlMatch).to.not.be.null
      const signedUrl = urlMatch[1]

      // Download the zip via fetch
      const res = await fetch(signedUrl)
      expect(res.ok).to.be.true
      const buffer = await res.arrayBuffer()
      await fs.promises.writeFile(zipPath, Buffer.from(buffer))

      const zipEntries = await getZipEntries(zipPath)
      const fileNames = zipEntries.map(e => e.fileName).sort()

      expect(fileNames).to.deep.equal(['graph.png', 'main.tex'])

      // Verify text content size (after edit)
      const mainTexEntry = zipEntries.find(e => e.fileName === 'main.tex')
      expect(mainTexEntry.uncompressedSize).to.equal('hello world more'.length)

      // Verify binary content size
      const graphEntry = zipEntries.find(e => e.fileName === 'graph.png')
      expect(graphEntry.uncompressedSize).to.equal(
        testFiles.GRAPH_PNG_BYTE_LENGTH
      )
    } finally {
      await fs.promises.unlink(zipPath).catch(() => {})
    }
  })

  it('supports the --verbose flag', async function () {
    this.timeout(30 * 1000)

    const { stdout } = await runRecoverZipScript(['--verbose', projectId])

    // Verbose mode logs each file as it's added
    expect(stdout).to.include('main.tex added')
    expect(stdout).to.include('graph.png added')
  })
})

/**
 * Run the recover_zip.js script with given arguments
 * @param {string[]} args
 */
async function runRecoverZipScript(args) {
  const TIMEOUT = 30 * 1000
  let result
  try {
    result = await promisify(execFile)(
      'node',
      ['storage/scripts/recover_zip.js', ...args],
      {
        encoding: 'utf-8',
        timeout: TIMEOUT,
        env: {
          ...process.env,
          LOG_LEVEL: 'debug',
        },
      }
    )
    result.status = 0
  } catch (err) {
    const { stdout, stderr, code } = err
    if (typeof code !== 'number') {
      console.log(err)
    }
    result = { stdout, stderr, status: code }
  }
  if (result.status !== 0 || result.stderr) {
    throw new Error(
      `recover_zip failed (exit ${result.status}):\n` +
        `stdout: ${result.stdout}\n` +
        `stderr: ${result.stderr}`
    )
  }
  return result
}
