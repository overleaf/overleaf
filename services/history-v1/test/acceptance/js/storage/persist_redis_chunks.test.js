'use strict'

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
const chunkStore = require('../../../../storage/lib/chunk_store')
const { getState } = require('../../../../storage/lib/chunk_store/redis')
const { setupProjectState } = require('./support/redis')
const { runScript } = require('./support/runscript')
const persistChanges = require('../../../../storage/lib/persist_changes')

const SCRIPT_PATH = 'storage/scripts/persist_redis_chunks.mjs'

describe('persist_redis_chunks script', function () {
  before(cleanup.everything)

  let now, past, future
  let projectIdsStore // To store the generated project IDs, keyed by scenario name
  let limitsToPersistImmediately

  before(async function () {
    const farFuture = new Date()
    farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
    limitsToPersistImmediately = {
      minChangeTimestamp: farFuture,
      maxChangeTimestamp: farFuture,
      maxChunkChanges: 100, // Allow enough changes for setup
    }

    await fixtures.create()

    now = Date.now()
    past = now - 10000 // 10 seconds ago
    future = now + 60000 // 1 minute in the future

    projectIdsStore = {}

    // Scenario 1: project_due_for_persistence
    // Goal: Has initial persisted content (v1), Redis has new changes (v1->v2) due for persistence.
    // Expected: Script persists Redis changes, persistedVersion becomes 2.
    {
      const dueProjectId = await chunkStore.initializeProject()
      projectIdsStore.project_due_for_persistence = dueProjectId
      const initialContent = 'Initial content for due project.'
      const initialChange = new Change(
        [new AddFileOperation('main.tex', File.fromString(initialContent))],
        new Date(now - 30000), // 30 seconds ago
        []
      )
      await persistChanges(
        dueProjectId,
        [initialChange],
        limitsToPersistImmediately,
        0
      )
      const secondChangeDue = new Change(
        [
          new EditFileOperation(
            'main.tex',
            new TextOperation()
              .retain(initialContent.length)
              .insert(' More content.')
          ),
        ],
        new Date(now - 20000), // 20 seconds ago
        []
      )
      await setupProjectState(dueProjectId, {
        persistTime: past,
        headVersion: 2, // After secondChangeDue
        persistedVersion: 1, // Initial content is at v1
        changes: [secondChangeDue], // New changes in Redis (v1->v2)
        expireTimeFuture: true,
      })
    }

    // Scenario 2: project_not_due_for_persistence
    // Goal: Has initial persisted content (v1), Redis has no new changes, not due.
    // Expected: Script does nothing, persistedVersion remains 1.
    {
      const notDueProjectId = await chunkStore.initializeProject()
      projectIdsStore.project_not_due_for_persistence = notDueProjectId
      const initialContent = 'Initial content for not_due project.'
      const initialChange = new Change(
        [new AddFileOperation('main.tex', File.fromString(initialContent))],
        new Date(now - 30000), // 30 seconds ago
        []
      )
      await persistChanges(
        notDueProjectId,
        [initialChange],
        limitsToPersistImmediately,
        0
      ) // Persisted: v0 -> v1
      await setupProjectState(notDueProjectId, {
        persistTime: future,
        headVersion: 1, // Matches persisted version
        persistedVersion: 1,
        changes: [], // No new changes in Redis
        expireTimeFuture: true,
      })
    }

    // Scenario 3: project_no_persist_time
    // Goal: Has initial persisted content (v1), Redis has no new changes, no persistTime.
    // Expected: Script does nothing, persistedVersion remains 1.
    {
      const noPersistTimeProjectId = await chunkStore.initializeProject()
      projectIdsStore.project_no_persist_time = noPersistTimeProjectId
      const initialContent = 'Initial content for no_persist_time project.'
      const initialChange = new Change(
        [new AddFileOperation('main.tex', File.fromString(initialContent))],
        new Date(now - 30000), // 30 seconds ago
        []
      )
      await persistChanges(
        noPersistTimeProjectId,
        [initialChange],
        limitsToPersistImmediately,
        0
      ) // Persisted: v0 -> v1
      await setupProjectState(noPersistTimeProjectId, {
        persistTime: null,
        headVersion: 1, // Matches persisted version
        persistedVersion: 1,
        changes: [], // No new changes in Redis
        expireTimeFuture: true,
      })
    }

    // Scenario 4: project_due_fully_persisted
    // Goal: Has content persisted up to v2, Redis reflects this (head=2, persisted=2), due for check.
    // Expected: Script clears persistTime, persistedVersion remains 2.
    {
      const dueFullyPersistedId = await chunkStore.initializeProject()
      projectIdsStore.project_due_fully_persisted = dueFullyPersistedId
      const initialContent = 'Content part 1 for fully persisted.'
      const change1 = new Change(
        [new AddFileOperation('main.tex', File.fromString(initialContent))],
        new Date(now - 40000), // 40 seconds ago
        []
      )
      const change2 = new Change(
        [
          new EditFileOperation(
            'main.tex',
            new TextOperation()
              .retain(initialContent.length)
              .insert(' Content part 2.')
          ),
        ],
        new Date(now - 30000), // 30 seconds ago
        []
      )
      await persistChanges(
        dueFullyPersistedId,
        [change1, change2],
        limitsToPersistImmediately,
        0
      )
      await setupProjectState(dueFullyPersistedId, {
        persistTime: past,
        headVersion: 2,
        persistedVersion: 2,
        changes: [], // No new unpersisted changes in Redis
        expireTimeFuture: true,
      })
    }

    // Scenario 5: project_fails_to_persist
    // Goal: Has initial persisted content (v1), Redis has new changes (v1->v2) due for persistence, but these changes will cause an error.
    // Expected: Script attempts to persist, fails, and persistTime is NOT cleared.
    {
      const failsToPersistProjectId = await chunkStore.initializeProject()
      projectIdsStore.project_fails_to_persist = failsToPersistProjectId
      const initialContent = 'Initial content for failure case.'
      const initialChange = new Change(
        [new AddFileOperation('main.tex', File.fromString(initialContent))],
        new Date(now - 30000), // 30 seconds ago
        []
      )
      await persistChanges(
        failsToPersistProjectId,
        [initialChange],
        limitsToPersistImmediately,
        0
      )
      // This change will fail because it tries to insert at a non-existent offset
      // assuming the initial content is shorter than 1000 characters.
      const conflictingChange = new Change(
        [
          new EditFileOperation(
            'main.tex',
            new TextOperation().retain(1000).insert('This will fail.')
          ),
        ],
        new Date(now - 20000), // 20 seconds ago
        []
      )
      await setupProjectState(failsToPersistProjectId, {
        persistTime: past, // Due for persistence
        headVersion: 2, // After conflictingChange
        persistedVersion: 1, // Initial content is at v1
        changes: [conflictingChange], // New changes in Redis (v1->v2)
        expireTimeFuture: true,
      })
    }

    await runScript(SCRIPT_PATH)
  })

  describe('when the buffer has new changes', function () {
    it('should update persisted-version when the persist-time is in the past', async function () {
      const projectId = projectIdsStore.project_due_for_persistence
      const state = await getState(projectId)
      // console.log('State after running script (project_due_for_persistence):', state)
      expect(state.persistTime).to.be.null
      expect(state.persistedVersion).to.equal(2)
    })

    it('should not perform any operations when the persist-time is in the future', async function () {
      const projectId = projectIdsStore.project_not_due_for_persistence
      const state = await getState(projectId)
      expect(state.persistTime).to.equal(future)
      expect(state.persistedVersion).to.equal(1)
    })
  })

  describe('when the changes in the buffer are already persisted', function () {
    it('should delete persist-time for a project when the persist-time is in the past', async function () {
      const projectId = projectIdsStore.project_due_fully_persisted
      const state = await getState(projectId)
      expect(state.persistTime).to.be.null
      expect(state.persistedVersion).to.equal(2)
    })
  })

  describe('when there is no persist-time set', function () {
    it('should not change redis when there is no persist-time set initially', async function () {
      const projectId = projectIdsStore.project_no_persist_time
      const state = await getState(projectId)
      expect(state.persistTime).to.be.null
      expect(state.persistedVersion).to.equal(1)
    })
  })

  describe('when persistence fails due to conflicting changes', function () {
    it('should not clear persist-time and not update persisted-version', async function () {
      const projectId = projectIdsStore.project_fails_to_persist
      const state = await getState(projectId)
      expect(state.persistTime).to.be.greaterThan(now) // persistTime should be pushed to the future by RETRY_DELAY_MS
      expect(state.persistedVersion).to.equal(1) // persistedVersion should not change
    })
  })
})
