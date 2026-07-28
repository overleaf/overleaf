'use strict'

const { expect } = require('chai')

const cleanup = require('./support/cleanup')
const fixtures = require('./support/fixtures')
const testFiles = require('./support/test_files.js')
const storage = require('../../../../storage')
const chunkStore = storage.chunkStore
const queueChanges = storage.queueChanges
const persistChanges = storage.persistChanges
const commitChanges = storage.commitChanges
const redisBackend = require('../../../../storage/lib/chunk_store/redis')
const { buildSetContentChange, ContentTooLargeError, BlobNotFoundError } =
  storage
const BlobStore = storage.BlobStore

const core = require('overleaf-editor-core')
const AddFileOperation = core.AddFileOperation
const Change = core.Change
const Chunk = core.Chunk
const File = core.File
const Origin = core.Origin
const TextOperation = core.TextOperation

describe('buildSetContentChange', function () {
  const userId = 'abcdef0123456789abcdef01'
  const source = 'test-source'

  let limitsToPersistImmediately
  before(function () {
    // Used to provide a limit which forces us to persist all of the changes
    const farFuture = new Date()
    farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
    limitsToPersistImmediately = {
      minChangeTimestamp: farFuture,
      maxChangeTimestamp: farFuture,
      maxChanges: 10,
      maxChunkChanges: 10,
    }
  })

  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  function makeOpts(opts = {}) {
    return {
      userId,
      timestamp: new Date(),
      origin: new Origin(source),
      ...opts,
    }
  }

  async function setupProjectWithDoc(pathname, content) {
    const projectId = fixtures.docs.uninitializedProject.id
    await chunkStore.initializeProject(projectId)
    const blobStore = new BlobStore(projectId)
    const blob = await blobStore.putString(content)
    await persistChanges(
      projectId,
      [
        new Change(
          [new AddFileOperation(pathname, File.createLazyFromBlobs(blob))],
          new Date(),
          []
        ),
      ],
      limitsToPersistImmediately,
      0
    )
    return { projectId, blobStore }
  }

  async function commit(projectId, { change, baseVersion }) {
    await commitChanges(
      projectId,
      [change],
      limitsToPersistImmediately,
      baseVersion,
      { historyBufferLevel: 4 }
    )
  }

  async function getFile(projectId, pathname) {
    const blobStore = new BlobStore(projectId)
    const chunk = await chunkStore.loadLatest(projectId)
    const snapshot = chunk.getSnapshot()
    snapshot.applyAll(chunk.getChanges())
    const file = snapshot.getFile(pathname)
    if (file) {
      await file.load('eager', blobStore)
    }
    return { file, version: chunk.getEndVersion() }
  }

  describe('with string content', function () {
    it('edits an existing doc with a minimal diff', async function () {
      const { projectId } = await setupProjectWithDoc(
        'main.tex',
        'one\ntwo\nthree\n'
      )

      const result = await buildSetContentChange(
        projectId,
        'main.tex',
        makeOpts({ content: 'one\ntwo and a half\nthree\n' })
      )
      expect(result.baseVersion).to.equal(1)

      // The change carries the given metadata
      const rawChange = result.change.toRaw()
      expect(rawChange.origin).to.deep.equal({ kind: source })
      expect(rawChange.v2Authors).to.deep.equal([userId])
      expect(rawChange.operations).to.have.length(1)
      expect(rawChange.operations[0].pathname).to.equal('main.tex')
      expect(rawChange.operations[0].textOperation).to.exist

      // Nothing was committed yet
      const redisState = await redisBackend.getState(projectId)
      expect(redisState.headVersion).to.be.null

      await commit(projectId, result)
      const { file, version } = await getFile(projectId, 'main.tex')
      expect(version).to.equal(2)
      expect(file.getContent()).to.equal('one\ntwo and a half\nthree\n')
    })

    it('reports identical content as a noop', async function () {
      const { projectId } = await setupProjectWithDoc('main.tex', 'same\n')

      const result = await buildSetContentChange(
        projectId,
        'main.tex',
        makeOpts({ content: 'same\n' })
      )
      expect(result).to.deep.equal({ change: null, baseVersion: 1 })
    })

    it('updates doc metadata when explicitly provided', async function () {
      const { projectId } = await setupProjectWithDoc('main.tex', 'same\n')

      const result = await buildSetContentChange(
        projectId,
        'main.tex',
        makeOpts({ content: 'same\n', metadata: { main: true } })
      )
      expect(result.baseVersion).to.equal(1)
      expect(result.change.toRaw().operations).to.deep.equal([
        {
          pathname: 'main.tex',
          metadata: { main: true },
        },
      ])

      await commit(projectId, result)
      const { file } = await getFile(projectId, 'main.tex')
      expect(file.getContent()).to.equal('same\n')
      expect(file.getMetadata()).to.deep.equal({ main: true })
    })

    it('diffs against content pending in the redis buffer', async function () {
      const { projectId } = await setupProjectWithDoc('main.tex', 'one\ntwo\n')

      // Queue an edit in the redis buffer without persisting it
      const editOperation = core.Operation.editFile(
        'main.tex',
        TextOperation.fromJSON({ textOperation: [8, 'three\n'] })
      )
      const editChange = new Change([editOperation], new Date(), [])
      await queueChanges(projectId, [editChange], 1)

      const result = await buildSetContentChange(
        projectId,
        'main.tex',
        makeOpts({ content: 'one\ntwo\nthree\nfour\n' })
      )
      expect(result.baseVersion).to.equal(2)

      await commit(projectId, result)
      const { file, version } = await getFile(projectId, 'main.tex')
      expect(version).to.equal(3)
      expect(file.getContent()).to.equal('one\ntwo\nthree\nfour\n')
    })

    it('replaces a binary file with an editable doc', async function () {
      const projectId = fixtures.docs.uninitializedProject.id
      await chunkStore.initializeProject(projectId)
      const blobStore = new BlobStore(projectId)
      await blobStore.putFile(testFiles.path('graph.png'))
      await persistChanges(
        projectId,
        [
          new Change(
            [
              new AddFileOperation(
                'figure.tex',
                File.fromHash(testFiles.GRAPH_PNG_HASH)
              ),
            ],
            new Date(),
            []
          ),
        ],
        limitsToPersistImmediately,
        0
      )

      const result = await buildSetContentChange(
        projectId,
        'figure.tex',
        makeOpts({ content: 'hello world', metadata: { main: true } })
      )
      expect(result.baseVersion).to.equal(1)
      const rawChange = result.change.toRaw()
      expect(rawChange.operations).to.have.length(2)
      expect(rawChange.operations[0]).to.deep.equal({
        pathname: 'figure.tex',
        newPathname: '',
      })
      expect(rawChange.operations[1].file.hash).to.exist

      await commit(projectId, result)
      const { file } = await getFile(projectId, 'figure.tex')
      expect(file.isEditable()).to.be.true
      expect(file.getContent()).to.equal('hello world')
      expect(file.getMetadata()).to.deep.equal({ main: true })
    })

    it('creates a new doc when there is no file at the pathname', async function () {
      const { projectId } = await setupProjectWithDoc('main.tex', 'main\n')

      const result = await buildSetContentChange(
        projectId,
        'chapters/one.tex',
        makeOpts({ content: 'chapter one\n' })
      )
      expect(result.baseVersion).to.equal(1)

      await commit(projectId, result)
      const { file } = await getFile(projectId, 'chapters/one.tex')
      expect(file.getContent()).to.equal('chapter one\n')
    })

    it('records the edit as tracked changes when requested', async function () {
      const timestamp = new Date()
      const { projectId } = await setupProjectWithDoc(
        'main.tex',
        'hello cruel world'
      )

      const result = await buildSetContentChange(
        projectId,
        'main.tex',
        makeOpts({
          content: 'hello brave world',
          trackChanges: true,
          timestamp,
        })
      )
      expect(result.baseVersion).to.equal(1)

      await commit(projectId, result)
      const { file } = await getFile(projectId, 'main.tex')
      // The removed content is retained as a tracked delete
      expect(file.getContent({ filterTrackedDeletes: true })).to.equal(
        'hello brave world'
      )
      expect(file.getContent()).to.contain('cruel')
      const trackedChanges = file.getTrackedChanges().asSorted()
      expect(trackedChanges).to.have.length(2)
      const trackedDelete = trackedChanges.find(
        tc => tc.tracking.type === 'delete'
      )
      const trackedInsert = trackedChanges.find(
        tc => tc.tracking.type === 'insert'
      )
      expect(trackedDelete).to.exist
      expect(trackedInsert).to.exist
      for (const trackedChange of trackedChanges) {
        expect(trackedChange.tracking.userId).to.equal(userId)
        expect(trackedChange.tracking.ts.toISOString()).to.equal(
          timestamp.toISOString()
        )
      }
    })

    it('records new doc content as a tracked insert when requested', async function () {
      const timestamp = new Date()
      const { projectId } = await setupProjectWithDoc('main.tex', 'main\n')

      const result = await buildSetContentChange(
        projectId,
        'new.tex',
        makeOpts({ content: 'new content', trackChanges: true, timestamp })
      )

      await commit(projectId, result)
      const { file } = await getFile(projectId, 'new.tex')
      expect(file.getContent()).to.equal('new content')
      expect(file.getTrackedChanges().toRaw()).to.deep.equal([
        {
          range: { pos: 0, length: 'new content'.length },
          tracking: {
            type: 'insert',
            userId,
            ts: timestamp.toISOString(),
          },
        },
      ])
    })

    it('rejects content that is too large', async function () {
      const { projectId } = await setupProjectWithDoc('main.tex', 'main\n')

      let error
      try {
        await buildSetContentChange(
          projectId,
          'main.tex',
          makeOpts({ content: 'x'.repeat(TextOperation.MAX_STRING_LENGTH + 1) })
        )
      } catch (err) {
        error = err
      }
      expect(error).to.be.an.instanceof(ContentTooLargeError)
    })

    it('throws when the project does not exist', async function () {
      let error
      try {
        await buildSetContentChange(
          fixtures.docs.uninitializedProject.id,
          'main.tex',
          makeOpts({ content: 'hello' })
        )
      } catch (err) {
        error = err
      }
      expect(error).to.be.an.instanceof(Chunk.NotFoundError)
    })
  })

  describe('with a blob', function () {
    it('replaces a doc with a binary file', async function () {
      const { projectId, blobStore } = await setupProjectWithDoc(
        'figure.png',
        'placeholder'
      )
      await blobStore.putFile(testFiles.path('graph.png'))

      const result = await buildSetContentChange(
        projectId,
        'figure.png',
        makeOpts({ blobHash: testFiles.GRAPH_PNG_HASH })
      )
      expect(result.baseVersion).to.equal(1)

      await commit(projectId, result)
      const { file } = await getFile(projectId, 'figure.png')
      expect(file.isEditable()).to.be.false
      expect(file.getHash()).to.equal(testFiles.GRAPH_PNG_HASH)
    })

    it('reports the same hash and metadata as a noop', async function () {
      const projectId = fixtures.docs.uninitializedProject.id
      await chunkStore.initializeProject(projectId)
      const blobStore = new BlobStore(projectId)
      const blob = await blobStore.putFile(testFiles.path('graph.png'))
      await persistChanges(
        projectId,
        [
          new Change(
            [
              new AddFileOperation(
                'figure.png',
                File.createLazyFromBlobs(blob)
              ),
            ],
            new Date(),
            []
          ),
        ],
        limitsToPersistImmediately,
        0
      )

      const result = await buildSetContentChange(
        projectId,
        'figure.png',
        makeOpts({ blobHash: testFiles.GRAPH_PNG_HASH })
      )
      expect(result).to.deep.equal({ change: null, baseVersion: 1 })
    })

    it('only sets metadata when the hash matches but metadata differs', async function () {
      const projectId = fixtures.docs.uninitializedProject.id
      await chunkStore.initializeProject(projectId)
      const blobStore = new BlobStore(projectId)
      const blob = await blobStore.putFile(testFiles.path('graph.png'))
      await persistChanges(
        projectId,
        [
          new Change(
            [
              new AddFileOperation(
                'figure.png',
                File.createLazyFromBlobs(blob)
              ),
            ],
            new Date(),
            []
          ),
        ],
        limitsToPersistImmediately,
        0
      )

      const result = await buildSetContentChange(
        projectId,
        'figure.png',
        makeOpts({
          blobHash: testFiles.GRAPH_PNG_HASH,
          metadata: { importer: 'github' },
        })
      )
      expect(result.baseVersion).to.equal(1)
      expect(result.change.toRaw().operations).to.deep.equal([
        {
          pathname: 'figure.png',
          metadata: { importer: 'github' },
        },
      ])

      await commit(projectId, result)
      const { file } = await getFile(projectId, 'figure.png')
      expect(file.getHash()).to.equal(testFiles.GRAPH_PNG_HASH)
      expect(file.getMetadata()).to.deep.equal({ importer: 'github' })
    })

    it('adds a new file when there is no file at the pathname', async function () {
      const { projectId, blobStore } = await setupProjectWithDoc(
        'main.tex',
        'main\n'
      )
      await blobStore.putFile(testFiles.path('graph.png'))

      const result = await buildSetContentChange(
        projectId,
        'images/graph.png',
        makeOpts({ blobHash: testFiles.GRAPH_PNG_HASH })
      )
      expect(result.baseVersion).to.equal(1)

      await commit(projectId, result)
      const { file } = await getFile(projectId, 'images/graph.png')
      expect(file.getHash()).to.equal(testFiles.GRAPH_PNG_HASH)
    })

    it('throws when the blob does not exist', async function () {
      const { projectId } = await setupProjectWithDoc('main.tex', 'main\n')

      let error
      try {
        await buildSetContentChange(
          projectId,
          'images/graph.png',
          makeOpts({ blobHash: testFiles.GRAPH_PNG_HASH })
        )
      } catch (err) {
        error = err
      }
      expect(error).to.be.an.instanceof(BlobNotFoundError)
    })

    it('ignores the trackChanges flag', async function () {
      const { projectId, blobStore } = await setupProjectWithDoc(
        'main.tex',
        'main\n'
      )
      await blobStore.putFile(testFiles.path('graph.png'))

      const result = await buildSetContentChange(
        projectId,
        'images/graph.png',
        makeOpts({ blobHash: testFiles.GRAPH_PNG_HASH, trackChanges: true })
      )
      expect(result.baseVersion).to.equal(1)

      await commit(projectId, result)
      const { file } = await getFile(projectId, 'images/graph.png')
      expect(file.getRangesHash()).to.not.exist
    })
  })

  it('requires exactly one of content and blobHash', async function () {
    const { projectId } = await setupProjectWithDoc('main.tex', 'main\n')

    for (const opts of [
      {},
      { content: 'a', blobHash: testFiles.GRAPH_PNG_HASH },
    ]) {
      let error
      try {
        await buildSetContentChange(projectId, 'main.tex', makeOpts(opts))
      } catch (err) {
        error = err
      }
      expect(error)
        .to.be.an('error')
        .with.property('message')
        .that.contains('exactly one of content and blobHash')
    }
  })
})
