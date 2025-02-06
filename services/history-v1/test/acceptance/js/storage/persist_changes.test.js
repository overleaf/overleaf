'use strict'

const { createHash } = require('node:crypto')
const { expect } = require('chai')

const cleanup = require('./support/cleanup')
const fixtures = require('./support/fixtures')

const storage = require('../../../../storage')
const chunkStore = storage.chunkStore
const persistChanges = storage.persistChanges

const core = require('overleaf-editor-core')
const AddFileOperation = core.AddFileOperation
const EditFileOperation = core.EditFileOperation
const TextOperation = core.TextOperation
const Change = core.Change
const Chunk = core.Chunk
const File = core.File
const History = core.History
const Snapshot = core.Snapshot

describe('persistChanges', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  let farFuture
  before(function () {
    // used to provide a limit which forces us to persist all of the changes.
    farFuture = new Date()
    farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
  })

  it('persists changes', async function () {
    const limitsToPersistImmediately = {
      minChangeTimestamp: farFuture,
      maxChangeTimestamp: farFuture,
    }
    const projectId = fixtures.docs.uninitializedProject.id
    const change = new Change(
      [new AddFileOperation('test.tex', File.fromString(''))],
      new Date(),
      []
    )
    const changes = [change]

    await chunkStore.initializeProject(projectId)
    const result = await persistChanges(
      projectId,
      changes,
      limitsToPersistImmediately,
      0
    )

    const history = new History(new Snapshot(), changes)
    const currentChunk = new Chunk(history, 0)
    expect(result).to.deep.equal({
      numberOfChangesPersisted: 1,
      originalEndVersion: 0,
      currentChunk,
    })

    const chunk = await chunkStore.loadLatest(projectId)
    expect(chunk.getStartVersion()).to.equal(0)
    expect(chunk.getEndVersion()).to.equal(1)
    expect(chunk.getChanges().length).to.equal(1)
  })

  it('persists changes in two chunks', async function () {
    const limitsToPersistImmediately = {
      maxChunkChanges: 1,
      minChangeTimestamp: farFuture,
      maxChangeTimestamp: farFuture,
    }
    const projectId = fixtures.docs.uninitializedProject.id
    const firstChange = new Change(
      [new AddFileOperation('a.tex', File.fromString(''))],
      new Date(),
      []
    )
    const secondChange = new Change(
      [new AddFileOperation('b.tex', File.fromString(''))],
      new Date(),
      []
    )
    const changes = [firstChange, secondChange]

    await chunkStore.initializeProject(projectId)
    const result = await persistChanges(
      projectId,
      changes,
      limitsToPersistImmediately,
      0
    )

    const snapshot = Snapshot.fromRaw({
      files: {
        'a.tex': {
          content: '',
        },
      },
    })
    const history = new History(snapshot, [secondChange])
    const currentChunk = new Chunk(history, 1)
    expect(result).to.deep.equal({
      numberOfChangesPersisted: 2,
      originalEndVersion: 0,
      currentChunk,
    })

    const chunk = await chunkStore.loadLatest(projectId)
    expect(chunk.getStartVersion()).to.equal(1)
    expect(chunk.getEndVersion()).to.equal(2)
    expect(chunk.getChanges().length).to.equal(1)
  })

  it('persists the snapshot at the start of the chunk', async function () {
    const limitsToPersistImmediately = {
      maxChunkChanges: 2,
      minChangeTimestamp: farFuture,
      maxChangeTimestamp: farFuture,
    }
    const projectId = fixtures.docs.uninitializedProject.id
    const firstChange = new Change(
      [new AddFileOperation('a.tex', File.fromString(''))],
      new Date(),
      []
    )
    const secondChange = new Change(
      [new AddFileOperation('b.tex', File.fromString(''))],
      new Date(),
      []
    )
    const changes = [firstChange, secondChange]

    await chunkStore.initializeProject(projectId)
    const result = await persistChanges(
      projectId,
      changes,
      limitsToPersistImmediately,
      0
    )

    const history = new History(new Snapshot(), changes)
    const currentChunk = new Chunk(history, 0)
    expect(result).to.deep.equal({
      numberOfChangesPersisted: 2,
      originalEndVersion: 0,
      currentChunk,
    })

    const chunk = await chunkStore.loadLatest(projectId)
    expect(chunk.getStartVersion()).to.equal(0)
    expect(chunk.getEndVersion()).to.equal(2)
    expect(chunk.getChanges().length).to.equal(2)
  })

  it("errors if the version doesn't match the latest chunk", async function () {
    const limitsToPersistImmediately = {
      minChangeTimestamp: farFuture,
      maxChangeTimestamp: farFuture,
    }
    const projectId = fixtures.docs.uninitializedProject.id
    const firstChange = new Change(
      [new AddFileOperation('a.tex', File.fromString(''))],
      new Date(),
      []
    )
    const secondChange = new Change(
      [new AddFileOperation('b.tex', File.fromString(''))],
      new Date(),
      []
    )
    const changes = [firstChange, secondChange]

    await chunkStore.initializeProject(projectId)
    await expect(
      persistChanges(projectId, changes, limitsToPersistImmediately, 1)
    ).to.be.rejectedWith(
      'client sent updates with end_version 1 but latest chunk has end_version 0'
    )
  })

  describe('content hash validation', function () {
    it('acccepts a change with a valid hash', async function () {
      const limitsToPersistImmediately = {
        minChangeTimestamp: farFuture,
        maxChangeTimestamp: farFuture,
      }

      const projectId = fixtures.docs.uninitializedProject.id
      await chunkStore.initializeProject(projectId)
      const textOperation = new TextOperation()
      textOperation.insert('hello ')
      textOperation.retain(5)
      textOperation.contentHash = hashString('hello world')
      const change = new Change(
        [
          new AddFileOperation('a.tex', File.fromString('world')),
          new EditFileOperation('a.tex', textOperation),
        ],
        new Date(),
        []
      )
      const changes = [change]

      const result = await persistChanges(
        projectId,
        changes,
        limitsToPersistImmediately,
        0
      )
      expect(result.numberOfChangesPersisted).to.equal(1)
    })

    it('acccepts a change with an invalid hash (only logs for now)', async function () {
      const limitsToPersistImmediately = {
        minChangeTimestamp: farFuture,
        maxChangeTimestamp: farFuture,
      }

      const projectId = fixtures.docs.uninitializedProject.id
      await chunkStore.initializeProject(projectId)
      const textOperation = new TextOperation()
      textOperation.insert('hello ')
      textOperation.retain(5)
      textOperation.contentHash = hashString('bad hash')
      const change = new Change(
        [
          new AddFileOperation('a.tex', File.fromString('world')),
          new EditFileOperation('a.tex', textOperation),
        ],
        new Date(),
        []
      )
      const changes = [change]

      const result = await persistChanges(
        projectId,
        changes,
        limitsToPersistImmediately,
        0
      )
      expect(result.numberOfChangesPersisted).to.equal(1)
    })
  })
})

function hashString(s) {
  const hash = createHash('sha-1')
  hash.update(s)
  return hash.digest('hex')
}
