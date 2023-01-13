'use strict'

const { expect } = require('chai')

const cleanup = require('./support/cleanup')
const fixtures = require('./support/fixtures')

const storage = require('../../../../storage')
const chunkStore = storage.chunkStore
const persistChanges = storage.persistChanges

const core = require('overleaf-editor-core')
const AddFileOperation = core.AddFileOperation
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

  it('persists changes', function () {
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

    return chunkStore
      .initializeProject(projectId)
      .then(() => {
        return persistChanges(projectId, changes, limitsToPersistImmediately, 0)
      })
      .then(result => {
        const history = new History(new Snapshot(), changes)
        const currentChunk = new Chunk(history, 0)
        expect(result).to.deep.equal({
          numberOfChangesPersisted: 1,
          originalEndVersion: 0,
          currentChunk,
        })
        return chunkStore.loadLatest(projectId)
      })
      .then(chunk => {
        expect(chunk.getStartVersion()).to.equal(0)
        expect(chunk.getEndVersion()).to.equal(1)
        expect(chunk.getChanges().length).to.equal(1)
      })
  })

  it('persists changes in two chunks', function () {
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

    return chunkStore
      .initializeProject(projectId)
      .then(() => {
        return persistChanges(projectId, changes, limitsToPersistImmediately, 0)
      })
      .then(result => {
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
        return chunkStore.loadLatest(projectId)
      })
      .then(chunk => {
        expect(chunk.getStartVersion()).to.equal(1)
        expect(chunk.getEndVersion()).to.equal(2)
        expect(chunk.getChanges().length).to.equal(1)
      })
  })

  it('persists the snapshot at the start of the chunk', function () {
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

    return chunkStore
      .initializeProject(projectId)
      .then(() => {
        return persistChanges(projectId, changes, limitsToPersistImmediately, 0)
      })
      .then(result => {
        const history = new History(new Snapshot(), changes)
        const currentChunk = new Chunk(history, 0)
        expect(result).to.deep.equal({
          numberOfChangesPersisted: 2,
          originalEndVersion: 0,
          currentChunk,
        })
        return chunkStore.loadLatest(projectId)
      })
      .then(chunk => {
        expect(chunk.getStartVersion()).to.equal(0)
        expect(chunk.getEndVersion()).to.equal(2)
        expect(chunk.getChanges().length).to.equal(2)
      })
  })

  it("errors if the version doesn't match the latest chunk", function () {
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
    return chunkStore
      .initializeProject(projectId)
      .then(() => {
        return persistChanges(projectId, changes, limitsToPersistImmediately, 1)
      })
      .then(() => {
        expect.fail()
      })
      .catch(err => {
        expect(err.message).to.equal(
          'client sent updates with end_version 1 but latest chunk has end_version 0'
        )
      })
  })
})
