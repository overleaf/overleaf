'use strict'

import fs from 'node:fs'
import { expect } from 'chai'
import {
  Change,
  Snapshot,
  File,
  TextOperation,
  AddFileOperation,
  EditFileOperation, // Added EditFileOperation
} from 'overleaf-editor-core'
import { persistBuffer } from '../../../../storage/lib/persist_buffer.js'
import chunkStore from '../../../../storage/lib/chunk_store/index.js'
import redisBackend from '../../../../storage/lib/chunk_store/redis.js'
import persistChanges from '../../../../storage/lib/persist_changes.js'
import cleanup from './support/cleanup.js'
import fixtures from './support/fixtures.js'
import testFiles from './support/test_files.js'

describe('persistBuffer', function () {
  let projectId
  const initialVersion = 0
  let limitsToPersistImmediately

  before(function () {
    const farFuture = new Date()
    farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
    limitsToPersistImmediately = {
      minChangeTimestamp: farFuture,
      maxChangeTimestamp: farFuture,
      maxChunkChanges: 10,
    }
  })

  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  beforeEach(async function () {
    projectId = fixtures.docs.uninitializedProject.id
    await chunkStore.initializeProject(projectId)
  })

  describe('with an empty initial chunk (new project)', function () {
    it('should persist changes from Redis to a new chunk', async function () {
      // create an initial snapshot and add the empty file `main.tex`
      const HELLO_TXT = fs.readFileSync(testFiles.path('hello.txt')).toString()

      const createFile = new Change(
        [new AddFileOperation('main.tex', File.fromString(HELLO_TXT))],
        new Date(),
        []
      )

      await persistChanges(
        projectId,
        [createFile],
        limitsToPersistImmediately,
        0
      )
      // Now queue some changes in Redis
      const op1 = new TextOperation().insert('Hello').retain(HELLO_TXT.length)
      const change1 = new Change(
        [new EditFileOperation('main.tex', op1)],
        new Date()
      )

      const op2 = new TextOperation()
        .retain('Hello'.length)
        .insert(' World')
        .retain(HELLO_TXT.length)
      const change2 = new Change(
        [new EditFileOperation('main.tex', op2)],
        new Date()
      )

      const changesToQueue = [change1, change2]

      const finalHeadVersion = initialVersion + 1 + changesToQueue.length

      const now = Date.now()
      await redisBackend.queueChanges(
        projectId,
        new Snapshot(), // dummy snapshot
        1,
        changesToQueue,
        {
          persistTime: now + redisBackend.MAX_PERSIST_DELAY_MS,
          expireTime: now + redisBackend.PROJECT_TTL_MS,
        }
      )
      await redisBackend.setPersistedVersion(projectId, initialVersion)

      // Persist the changes from Redis to the chunk store
      await persistBuffer(projectId)

      const latestChunk = await chunkStore.loadLatest(projectId)
      expect(latestChunk).to.exist
      expect(latestChunk.getStartVersion()).to.equal(initialVersion)
      expect(latestChunk.getEndVersion()).to.equal(finalHeadVersion)
      expect(latestChunk.getChanges().length).to.equal(
        changesToQueue.length + 1
      )

      const chunkSnapshot = latestChunk.getSnapshot()
      expect(Object.keys(chunkSnapshot.getFileMap()).length).to.equal(1)

      const persistedVersionInRedis = (await redisBackend.getState(projectId))
        .persistedVersion
      expect(persistedVersionInRedis).to.equal(finalHeadVersion)

      const nonPersisted = await redisBackend.getNonPersistedChanges(
        projectId,
        finalHeadVersion
      )
      expect(nonPersisted).to.be.an('array').that.is.empty
    })
  })

  describe('with an existing chunk and new changes in Redis', function () {
    it('should persist new changes from Redis, appending to existing history', async function () {
      const initialContent = 'Initial document content.\n'

      const addInitialFileChange = new Change(
        [new AddFileOperation('main.tex', File.fromString(initialContent))],
        new Date(),
        []
      )

      await persistChanges(
        projectId,
        [addInitialFileChange],
        limitsToPersistImmediately,
        initialVersion
      )
      const versionAfterInitialSetup = initialVersion + 1 // Now version is 1

      const opForChunk1 = new TextOperation()
        .retain(initialContent.length)
        .insert(' First addition.')
      const changesForChunk1 = [
        new Change(
          [new EditFileOperation('main.tex', opForChunk1)],
          new Date(),
          []
        ),
      ]

      await persistChanges(
        projectId,
        changesForChunk1,
        limitsToPersistImmediately, // Original limits for this step
        versionAfterInitialSetup // Correct clientEndVersion
      )
      // Update persistedChunkEndVersion: 1 (from setup) + 1 (from changesForChunk1) = 2
      const persistedChunkEndVersion =
        versionAfterInitialSetup + changesForChunk1.length
      const contentAfterChunk1 = initialContent + ' First addition.'

      const opVersion2 = new TextOperation()
        .retain(contentAfterChunk1.length)
        .insert(' Second addition.')
      const changeVersion2 = new Change(
        [new EditFileOperation('main.tex', opVersion2)],
        new Date(),
        []
      )

      const contentAfterChange2 = contentAfterChunk1 + ' Second addition.'
      const opVersion3 = new TextOperation()
        .retain(contentAfterChange2.length)
        .insert(' Third addition.')
      const changeVersion3 = new Change(
        [new EditFileOperation('main.tex', opVersion3)],
        new Date(),
        []
      )

      const redisChangesToPush = [changeVersion2, changeVersion3]
      const finalHeadVersionAfterRedisPush =
        persistedChunkEndVersion + redisChangesToPush.length
      const now = Date.now()

      await redisBackend.queueChanges(
        projectId,
        new Snapshot(), // Use new Snapshot() like in the first test
        persistedChunkEndVersion,
        redisChangesToPush,
        {
          persistTime: now + redisBackend.MAX_PERSIST_DELAY_MS,
          expireTime: now + redisBackend.PROJECT_TTL_MS,
        }
      )
      await redisBackend.setPersistedVersion(
        projectId,
        persistedChunkEndVersion
      )

      await persistBuffer(projectId)

      const latestChunk = await chunkStore.loadLatest(projectId)
      expect(latestChunk).to.exist
      expect(latestChunk.getStartVersion()).to.equal(0)
      expect(latestChunk.getEndVersion()).to.equal(
        finalHeadVersionAfterRedisPush
      )
      expect(latestChunk.getChanges().length).to.equal(
        persistedChunkEndVersion + redisChangesToPush.length
      )

      const persistedVersionInRedisAfter = (
        await redisBackend.getState(projectId)
      ).persistedVersion
      expect(persistedVersionInRedisAfter).to.equal(
        finalHeadVersionAfterRedisPush
      )

      const nonPersisted = await redisBackend.getNonPersistedChanges(
        projectId,
        finalHeadVersionAfterRedisPush
      )
      expect(nonPersisted).to.be.an('array').that.is.empty
    })
  })

  describe('when Redis has no new changes', function () {
    let persistedChunkEndVersion
    let changesForChunk1

    beforeEach(async function () {
      const initialContent = 'Content.'

      const addInitialFileChange = new Change(
        [new AddFileOperation('main.tex', File.fromString(initialContent))],
        new Date(),
        []
      )

      // Replace chunkStore.create with persistChanges
      // clientEndVersion is initialVersion (0). This advances version to 1.
      await persistChanges(
        projectId,
        [addInitialFileChange],
        limitsToPersistImmediately,
        initialVersion
      )
      const versionAfterInitialSetup = initialVersion + 1 // Now version is 1

      const opForChunk1 = new TextOperation()
        .retain(initialContent.length)
        .insert(' More.')
      changesForChunk1 = [
        new Change(
          [new EditFileOperation('main.tex', opForChunk1)],
          new Date(),
          []
        ),
      ]
      // Corrected persistChanges call: clientEndVersion is versionAfterInitialSetup (1)
      await persistChanges(
        projectId,
        changesForChunk1,
        limitsToPersistImmediately, // Original limits for this step
        versionAfterInitialSetup // Correct clientEndVersion
      )
      // Update persistedChunkEndVersion: 1 (from setup) + 1 (from changesForChunk1) = 2
      persistedChunkEndVersion =
        versionAfterInitialSetup + changesForChunk1.length
    })

    it('should leave the persisted version and stored chunks unchanged', async function () {
      const now = Date.now()
      await redisBackend.queueChanges(
        projectId,
        new Snapshot(),
        persistedChunkEndVersion - 1,
        changesForChunk1,
        {
          persistTime: now + redisBackend.MAX_PERSIST_DELAY_MS,
          expireTime: now + redisBackend.PROJECT_TTL_MS,
        }
      )
      await redisBackend.setPersistedVersion(
        projectId,
        persistedChunkEndVersion
      )

      const chunksBefore = await chunkStore.getProjectChunks(projectId)

      await persistBuffer(projectId)

      const chunksAfter = await chunkStore.getProjectChunks(projectId)
      expect(chunksAfter.length).to.equal(chunksBefore.length)
      expect(chunksAfter).to.deep.equal(chunksBefore)

      const finalPersistedVersionInRedis = (
        await redisBackend.getState(projectId)
      ).persistedVersion
      expect(finalPersistedVersionInRedis).to.equal(persistedChunkEndVersion)
    })

    it('should update the persisted version if it is behind the chunk store end version', async function () {
      const now = Date.now()

      await redisBackend.queueChanges(
        projectId,
        new Snapshot(),
        persistedChunkEndVersion - 1,
        changesForChunk1,
        {
          persistTime: now + redisBackend.MAX_PERSIST_DELAY_MS,
          expireTime: now + redisBackend.PROJECT_TTL_MS,
        }
      )
      // Force the persisted version in Redis to lag behind the chunk store,
      // simulating the situation where a worker has persisted changes to the
      // chunk store but failed to update the version in redis.
      await redisBackend.setPersistedVersion(
        projectId,
        persistedChunkEndVersion - 1
      )

      const chunksBefore = await chunkStore.getProjectChunks(projectId)

      // Persist buffer (which should do nothing as there are no new changes)
      await persistBuffer(projectId, limitsToPersistImmediately)

      const chunksAfter = await chunkStore.getProjectChunks(projectId)
      expect(chunksAfter.length).to.equal(chunksBefore.length)
      expect(chunksAfter).to.deep.equal(chunksBefore)

      const finalPersistedVersionInRedis = (
        await redisBackend.getState(projectId)
      ).persistedVersion
      expect(finalPersistedVersionInRedis).to.equal(persistedChunkEndVersion)
    })
  })
})
