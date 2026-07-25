'use strict'

const { promisify } = require('node:util')
const { execFile } = require('node:child_process')
const { expect } = require('chai')
const {
  Change,
  AddFileOperation,
  EditFileOperation,
  TextOperation,
  File,
} = require('overleaf-editor-core')
const cleanup = require('./support/cleanup')
const fixtures = require('./support/fixtures')
const { setupProjectState } = require('./support/redis')
const chunkStore = require('../../../../storage/lib/chunk_store')
const persistChanges = require('../../../../storage/lib/persist_changes')
const knex = require('../../../../storage/lib/knex')

const SCRIPT_PATH = 'storage/scripts/finalise_chunk.mjs'

async function runScript(args) {
  try {
    const result = await promisify(execFile)('node', [SCRIPT_PATH, ...args], {
      encoding: 'utf-8',
      timeout: 10000,
      env: { ...process.env, LOG_LEVEL: 'debug' },
    })
    return { ...result, status: 0 }
  } catch (err) {
    if (typeof err.code !== 'number') {
      throw err
    }
    return { stdout: err.stdout, stderr: err.stderr, status: err.code }
  }
}

async function getChunkRows(projectId) {
  return await knex('chunks')
    .select('id', 'start_version', 'end_version', 'closed')
    .where('doc_id', parseInt(projectId, 10))
    .orderBy('end_version')
}

describe('finalise_chunk script', function () {
  before(cleanup.everything)

  let limitsToPersistImmediately
  before(function () {
    const farFuture = new Date()
    farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
    limitsToPersistImmediately = {
      minChangeTimestamp: farFuture,
      maxChangeTimestamp: farFuture,
      maxChunkChanges: 100,
    }
  })

  beforeEach(async function () {
    await cleanup.everything()
    await fixtures.create()
  })

  describe('with a populated current chunk', function () {
    let projectId
    let initialContent
    let initialEndVersion
    let initialChunkId

    beforeEach(async function () {
      projectId = await chunkStore.initializeProject()
      initialContent = 'Hello world.'
      const change1 = new Change(
        [new AddFileOperation('main.tex', File.fromString(initialContent))],
        new Date(Date.now() - 30000),
        []
      )
      const change2 = new Change(
        [
          new EditFileOperation(
            'main.tex',
            new TextOperation().retain(initialContent.length).insert(' More.')
          ),
        ],
        new Date(Date.now() - 20000),
        []
      )
      await persistChanges(
        projectId,
        [change1, change2],
        limitsToPersistImmediately,
        0
      )
      const metadata = await chunkStore.getLatestChunkMetadata(projectId)
      initialEndVersion = metadata.endVersion
      initialChunkId = metadata.id
      expect(initialEndVersion).to.equal(2)
    })

    it('closes the current chunk and creates a new empty chunk', async function () {
      const result = await runScript(['--historyId', projectId])
      expect(result.status, result.stderr).to.equal(0)

      const rows = await getChunkRows(projectId)
      expect(rows).to.have.length(2)

      const oldRow = rows.find(r => r.id.toString() === initialChunkId)
      expect(oldRow, 'old chunk still in DB').to.exist
      expect(oldRow.closed).to.equal(true)
      expect(oldRow.end_version).to.equal(initialEndVersion)

      const newRow = rows.find(r => r.id.toString() !== initialChunkId)
      expect(newRow, 'new chunk inserted').to.exist
      expect(newRow.start_version).to.equal(initialEndVersion)
      expect(newRow.end_version).to.equal(initialEndVersion + 1)
      expect(newRow.closed).to.equal(false)

      const newChunk = await chunkStore.loadLatest(projectId, {
        persistedOnly: true,
      })
      expect(newChunk.getStartVersion()).to.equal(initialEndVersion)
      expect(newChunk.getEndVersion()).to.equal(initialEndVersion + 1)
      // The new chunk holds a single NoOperation change as a placeholder so
      // its end_version is distinct from the closed chunk's end_version.
      expect(newChunk.getChanges()).to.have.length(1)

      const newSnapshot = newChunk.getSnapshot()
      const file = newSnapshot.getFile('main.tex')
      expect(file, 'main.tex carried over to new chunk snapshot').to.exist
    })

    it('does not modify state on a dry-run', async function () {
      const result = await runScript(['--historyId', projectId, '--dry-run'])
      expect(result.status, result.stderr).to.equal(0)

      const rows = await getChunkRows(projectId)
      expect(rows).to.have.length(1)
      expect(rows[0].id.toString()).to.equal(initialChunkId)
      expect(rows[0].closed).to.equal(false)
    })
  })

  describe('safety checks', function () {
    it('refuses to act on an already-empty current chunk', async function () {
      const projectId = await chunkStore.initializeProject()

      const result = await runScript(['--historyId', projectId])
      expect(result.status).to.not.equal(0)
      expect(result.stdout + result.stderr).to.match(/already empty/)

      const rows = await getChunkRows(projectId)
      expect(rows).to.have.length(1)
      expect(rows[0].start_version).to.equal(0)
      expect(rows[0].end_version).to.equal(0)
      expect(rows[0].closed).to.equal(false)
    })

    it('refuses when there are non-persisted changes in redis', async function () {
      const projectId = await chunkStore.initializeProject()
      const initialContent = 'Initial.'
      const initialChange = new Change(
        [new AddFileOperation('main.tex', File.fromString(initialContent))],
        new Date(Date.now() - 30000),
        []
      )
      await persistChanges(
        projectId,
        [initialChange],
        limitsToPersistImmediately,
        0
      )
      const metadata = await chunkStore.getLatestChunkMetadata(projectId)
      const initialChunkId = metadata.id

      const bufferedChange = new Change(
        [
          new EditFileOperation(
            'main.tex',
            new TextOperation()
              .retain(initialContent.length)
              .insert(' Buffered.')
          ),
        ],
        new Date(Date.now() - 10000),
        []
      )
      await setupProjectState(projectId, {
        persistTime: Date.now() - 1000,
        headVersion: 2,
        persistedVersion: 1,
        changes: [bufferedChange],
        expireTimeFuture: true,
      })

      const result = await runScript(['--historyId', projectId])
      expect(result.status).to.not.equal(0)
      expect(result.stdout + result.stderr).to.match(/non-persisted/)

      const rows = await getChunkRows(projectId)
      expect(rows).to.have.length(1)
      expect(rows[0].id.toString()).to.equal(initialChunkId)
      expect(rows[0].closed).to.equal(false)
    })
  })
})
