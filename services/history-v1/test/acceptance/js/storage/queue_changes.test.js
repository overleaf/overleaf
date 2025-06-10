'use strict'

const { expect } = require('chai')
const sinon = require('sinon')

const cleanup = require('./support/cleanup')
const fixtures = require('./support/fixtures')
const testFiles = require('./support/test_files.js')
const storage = require('../../../../storage')
const chunkStore = storage.chunkStore
const queueChanges = storage.queueChanges
const redisBackend = require('../../../../storage/lib/chunk_store/redis')

const core = require('overleaf-editor-core')
const AddFileOperation = core.AddFileOperation
const EditFileOperation = core.EditFileOperation
const TextOperation = core.TextOperation
const Change = core.Change
const Chunk = core.Chunk
const File = core.File
const Snapshot = core.Snapshot
const BlobStore = storage.BlobStore
const persistChanges = storage.persistChanges

describe('queueChanges', function () {
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
  afterEach(function () {
    sinon.restore()
  })

  it('queues changes when redis has no snapshot (falls back to chunkStore with an empty chunk)', async function () {
    // Start with an empty chunk store for the project
    const projectId = fixtures.docs.uninitializedProject.id
    await chunkStore.initializeProject(projectId)

    // Ensure that the initial state in redis is empty
    const initialRedisState = await redisBackend.getState(projectId)
    expect(initialRedisState.headVersion).to.be.null
    expect(initialRedisState.headSnapshot).to.be.null
    expect(initialRedisState.changes).to.be.an('array').that.is.empty

    // Add a test file to the blob store
    const blobStore = new BlobStore(projectId)
    await blobStore.putFile(testFiles.path('hello.txt'))

    // Prepare an initial change to add a single file to an empty project
    const change = new Change(
      [
        new AddFileOperation(
          'test.tex',
          File.fromHash(testFiles.HELLO_TXT_HASH)
        ),
      ],
      new Date(),
      []
    )
    const changesToQueue = [change]
    const endVersion = 0

    // Queue the changes to add the test file
    const status = await queueChanges(projectId, changesToQueue, endVersion)
    expect(status).to.equal('ok')

    // Verify that we now have some state in redis
    const redisState = await redisBackend.getState(projectId)
    expect(redisState).to.not.be.null

    // Compute the expected snapshot after applying the changes
    const expectedSnapshot = new Snapshot()
    await expectedSnapshot.loadFiles('hollow', blobStore)
    for (const change of changesToQueue) {
      const hollowChange = change.clone()
      await hollowChange.loadFiles('hollow', blobStore)
      hollowChange.applyTo(expectedSnapshot, { strict: true })
    }

    // Confirm that state in redis matches the expected snapshot and changes queue
    const expectedVersionInRedis = endVersion + changesToQueue.length
    expect(redisState.headVersion).to.equal(expectedVersionInRedis)
    expect(redisState.headSnapshot).to.deep.equal(expectedSnapshot.toRaw())
    expect(redisState.changes).to.deep.equal(changesToQueue.map(c => c.toRaw()))
  })

  it('queues changes when redis has no snapshot (falls back to chunkStore with an existing chunk)', async function () {
    const projectId = fixtures.docs.uninitializedProject.id

    // Initialise the project in the chunk store using the "Hello World" test file
    await chunkStore.initializeProject(projectId)
    const blobStore = new BlobStore(projectId)
    await blobStore.putFile(testFiles.path('hello.txt'))
    const change = new Change(
      [
        new AddFileOperation(
          'hello.tex',
          File.fromHash(testFiles.HELLO_TXT_HASH)
        ),
      ],
      new Date(),
      []
    )
    const initialChanges = [change]
    const initialVersion = 0

    const result = await persistChanges(
      projectId,
      initialChanges,
      limitsToPersistImmediately,
      initialVersion
    )
    // Compute the state after the initial changes are persisted for later comparison
    const endVersion = initialVersion + initialChanges.length
    const { currentChunk } = result
    const originalSnapshot = result.currentChunk.getSnapshot()
    await originalSnapshot.loadFiles('hollow', blobStore)
    originalSnapshot.applyAll(currentChunk.getChanges())

    // Ensure that the initial state in redis is empty
    const initialRedisState = await redisBackend.getState(projectId)
    expect(initialRedisState.headVersion).to.be.null
    expect(initialRedisState.headSnapshot).to.be.null
    expect(initialRedisState.changes).to.be.an('array').that.is.empty

    // Prepare a change to edit the existing file
    const editFileOp = new EditFileOperation(
      'hello.tex',
      new TextOperation()
        .insert('Hello')
        .retain(testFiles.HELLO_TXT_UTF8_LENGTH)
    )
    const editFileChange = new Change([editFileOp], new Date(), [])
    const changesToQueue = [editFileChange]

    // Queue the changes to edit the existing file
    const status = await queueChanges(projectId, changesToQueue, endVersion)
    expect(status).to.equal('ok')

    // Verify that we now have some state in redis
    const redisState = await redisBackend.getState(projectId)
    expect(redisState).to.not.be.null

    // Compute the expected snapshot after applying the changes
    const expectedSnapshot = originalSnapshot.clone()
    await expectedSnapshot.loadFiles('hollow', blobStore)
    expectedSnapshot.applyAll(changesToQueue)

    // Confirm that state in redis matches the expected snapshot and changes queue
    const expectedVersionInRedis = endVersion + changesToQueue.length
    expect(redisState.headVersion).to.equal(expectedVersionInRedis)
    expect(redisState.headSnapshot).to.deep.equal(expectedSnapshot.toRaw())
    expect(redisState.changes).to.deep.equal(changesToQueue.map(c => c.toRaw()))
  })

  it('queues changes when redis has a snapshot with existing changes', async function () {
    const projectId = fixtures.docs.uninitializedProject.id

    // Initialise the project in redis using the "Hello World" test file
    await chunkStore.initializeProject(projectId)
    const blobStore = new BlobStore(projectId)
    await blobStore.putFile(testFiles.path('hello.txt'))
    const initialChangeOp = new AddFileOperation(
      'existing.tex',
      File.fromHash(testFiles.HELLO_TXT_HASH)
    )
    const initialChange = new Change([initialChangeOp], new Date(), [])
    const initialChangesToQueue = [initialChange]
    const versionBeforeInitialQueue = 0

    // Queue the initial changes
    const status = await queueChanges(
      projectId,
      initialChangesToQueue,
      versionBeforeInitialQueue
    )
    // Confirm that the initial changes were queued successfully
    expect(status).to.equal('ok')
    const versionAfterInitialQueue =
      versionBeforeInitialQueue + initialChangesToQueue.length

    // Compute the snapshot after the initial changes for later use
    const initialSnapshot = new Snapshot()
    await initialSnapshot.loadFiles('hollow', blobStore)
    for (const change of initialChangesToQueue) {
      const hollowChange = change.clone()
      await hollowChange.loadFiles('hollow', blobStore)
      hollowChange.applyTo(initialSnapshot, { strict: true })
    }

    // Now prepare some subsequent changes for the queue
    await blobStore.putFile(testFiles.path('graph.png'))
    const addFileOp = new AddFileOperation(
      'graph.png',
      File.fromHash(testFiles.GRAPH_PNG_HASH)
    )
    const addFileChange = new Change([addFileOp], new Date(), [])
    const editFileOp = new EditFileOperation(
      'existing.tex',
      new TextOperation()
        .insert('Hello')
        .retain(testFiles.HELLO_TXT_UTF8_LENGTH)
    )
    const editFileChange = new Change([editFileOp], new Date(), [])

    const subsequentChangesToQueue = [addFileChange, editFileChange]
    const versionBeforeSubsequentQueue = versionAfterInitialQueue

    // Queue the subsequent changes
    const subsequentStatus = await queueChanges(
      projectId,
      subsequentChangesToQueue,
      versionBeforeSubsequentQueue
    )
    expect(subsequentStatus).to.equal('ok')

    // Compute the expected snapshot after applying all changes
    const expectedSnapshot = initialSnapshot.clone()
    await expectedSnapshot.loadFiles('hollow', blobStore)
    for (const change of subsequentChangesToQueue) {
      const hollowChange = change.clone()
      await hollowChange.loadFiles('hollow', blobStore)
      hollowChange.applyTo(expectedSnapshot, { strict: true })
    }

    // Confirm that state in redis matches the expected snapshot and changes queue
    const finalRedisState = await redisBackend.getState(projectId)
    expect(finalRedisState).to.not.be.null
    const expectedFinalVersion =
      versionBeforeSubsequentQueue + subsequentChangesToQueue.length
    expect(finalRedisState.headVersion).to.equal(expectedFinalVersion)
    expect(finalRedisState.headSnapshot).to.deep.equal(expectedSnapshot.toRaw())
    const allQueuedChangesRaw = initialChangesToQueue
      .concat(subsequentChangesToQueue)
      .map(c => c.toRaw())
    expect(finalRedisState.changes).to.deep.equal(allQueuedChangesRaw)
  })

  it('skips queuing changes when there is no snapshot and the onlyIfExists flag is set', async function () {
    // Start with an empty chunk store for the project
    const projectId = fixtures.docs.uninitializedProject.id
    await chunkStore.initializeProject(projectId)

    // Ensure that the initial state in redis is empty
    const initialRedisState = await redisBackend.getState(projectId)
    expect(initialRedisState.headVersion).to.be.null
    expect(initialRedisState.headSnapshot).to.be.null
    expect(initialRedisState.changes).to.be.an('array').that.is.empty

    // Add a test file to the blob store
    const blobStore = new BlobStore(projectId)
    await blobStore.putFile(testFiles.path('hello.txt'))

    // Prepare an initial change to add a single file to an empty project
    const change = new Change(
      [
        new AddFileOperation(
          'test.tex',
          File.fromHash(testFiles.HELLO_TXT_HASH)
        ),
      ],
      new Date(),
      []
    )
    const changesToQueue = [change]
    const endVersion = 0

    // Queue the changes to add the test file
    const status = await queueChanges(projectId, changesToQueue, endVersion, {
      onlyIfExists: true,
    })
    expect(status).to.equal('ignore')

    // Verify that the state in redis has not changed
    const redisState = await redisBackend.getState(projectId)
    expect(redisState).to.deep.equal(initialRedisState)
  })

  it('creates an initial hollow snapshot when redis has no snapshot (falls back to chunkStore with an empty chunk)', async function () {
    // Start with an empty chunk store for the project
    const projectId = fixtures.docs.uninitializedProject.id
    await chunkStore.initializeProject(projectId)
    const blobStore = new BlobStore(projectId)
    await blobStore.putFile(testFiles.path('hello.txt'))

    // Prepare an initial change to add a single file to an empty project
    const change = new Change(
      [
        new AddFileOperation(
          'test.tex',
          File.fromHash(testFiles.HELLO_TXT_HASH)
        ),
      ],
      new Date(),
      []
    )
    const changesToQueue = [change]
    const endVersion = 0

    // Queue the changes to add the test file
    const status = await queueChanges(projectId, changesToQueue, endVersion)
    expect(status).to.equal('ok')

    // Verify that we now have some state in redis
    const redisState = await redisBackend.getState(projectId)
    expect(redisState).to.not.be.null
    expect(redisState.headSnapshot.files['test.tex']).to.deep.equal({
      stringLength: testFiles.HELLO_TXT_UTF8_LENGTH,
    })
  })

  it('throws ConflictingEndVersion if endVersion does not match current version (from chunkStore)', async function () {
    const projectId = fixtures.docs.uninitializedProject.id
    // Initialise an empty project in the chunk store
    await chunkStore.initializeProject(projectId)

    // Ensure that the initial state in redis is empty
    const initialRedisState = await redisBackend.getState(projectId)
    expect(initialRedisState.headVersion).to.be.null

    // Prepare a change to add a file
    const change = new Change(
      [new AddFileOperation('test.tex', File.fromString(''))],
      new Date(),
      []
    )
    const changesToQueue = [change]
    const incorrectEndVersion = 1

    // Attempt to queue the changes with an incorrect endVersion (1 instead of 0)
    await expect(queueChanges(projectId, changesToQueue, incorrectEndVersion))
      .to.be.rejectedWith(Chunk.ConflictingEndVersion)
      .and.eventually.satisfies(err => {
        expect(err.info).to.have.property(
          'clientEndVersion',
          incorrectEndVersion
        )
        expect(err.info).to.have.property('latestEndVersion', 0)
        return true
      })

    // Verify that the state in redis has not changed
    const redisStateAfterError = await redisBackend.getState(projectId)
    expect(redisStateAfterError).to.deep.equal(initialRedisState)
  })

  it('throws ConflictingEndVersion if endVersion does not match current version (from redis snapshot)', async function () {
    const projectId = fixtures.docs.uninitializedProject.id

    // Initialise the project in the redis with a test file
    await chunkStore.initializeProject(projectId)
    const initialChange = new Change(
      [new AddFileOperation('initial.tex', File.fromString('content'))],
      new Date(),
      []
    )
    const initialChangesToQueue = [initialChange]
    const versionBeforeInitialQueue = 0

    // Queue the initial changes
    await queueChanges(
      projectId,
      initialChangesToQueue,
      versionBeforeInitialQueue
    )
    const versionInRedisAfterSetup =
      versionBeforeInitialQueue + initialChangesToQueue.length

    // Confirm that the initial changes were queued successfully
    const initialRedisState = await redisBackend.getState(projectId)
    expect(initialRedisState).to.not.be.null
    expect(initialRedisState.headVersion).to.equal(versionInRedisAfterSetup)

    // Now prepare a subsequent change for the queue
    const subsequentChange = new Change(
      [new AddFileOperation('another.tex', File.fromString(''))],
      new Date(),
      []
    )
    const subsequentChangesToQueue = [subsequentChange]
    const incorrectEndVersion = 0

    //  Attempt to queue the changes with an incorrect endVersion (0 instead of 1)
    await expect(
      queueChanges(projectId, subsequentChangesToQueue, incorrectEndVersion)
    )
      .to.be.rejectedWith(Chunk.ConflictingEndVersion)
      .and.eventually.satisfies(err => {
        expect(err.info).to.have.property(
          'clientEndVersion',
          incorrectEndVersion
        )
        expect(err.info).to.have.property(
          'latestEndVersion',
          versionInRedisAfterSetup
        )
        return true
      })

    // Verify that the state in redis has not changed
    const redisStateAfterError = await redisBackend.getState(projectId)
    expect(redisStateAfterError).to.not.be.null
    expect(redisStateAfterError).to.deep.equal(initialRedisState)
  })
})
