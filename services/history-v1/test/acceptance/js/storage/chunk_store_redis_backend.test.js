'use strict'

const { expect } = require('chai')
const {
  Snapshot,
  Change,
  AddFileOperation,
  File,
} = require('overleaf-editor-core')
const cleanup = require('./support/cleanup')
const redisBackend = require('../../../../storage/lib/chunk_store/redis')
const {
  JobNotReadyError,
  JobNotFoundError,
  VersionOutOfBoundsError,
} = require('../../../../storage/lib/chunk_store/errors')
const redis = require('../../../../storage/lib/redis')
const rclient = redis.rclientHistory
const keySchema = redisBackend.keySchema

describe('chunk buffer Redis backend', function () {
  beforeEach(cleanup.everything)
  const projectId = 'project123'

  describe('getHeadSnapshot', function () {
    it('should return null on cache miss', async function () {
      const result = await redisBackend.getHeadSnapshot(projectId)
      expect(result).to.be.null
    })

    it('should return the cached head snapshot and version', async function () {
      // Create a sample snapshot and version
      const snapshot = new Snapshot()
      const version = 42
      const rawSnapshot = JSON.stringify(snapshot.toRaw())

      // Manually set the data in Redis
      await rclient.set(keySchema.head({ projectId }), rawSnapshot)
      await rclient.set(
        keySchema.headVersion({ projectId }),
        version.toString()
      )

      // Retrieve the cached snapshot
      const result = await redisBackend.getHeadSnapshot(projectId)

      expect(result).to.not.be.null
      expect(result.version).to.equal(version)
      expect(result.snapshot).to.deep.equal(snapshot) // Use deep equal for object comparison
    })

    it('should return null if the version is missing', async function () {
      // Create a sample snapshot
      const snapshot = new Snapshot()
      const rawSnapshot = JSON.stringify(snapshot.toRaw())

      // Manually set only the snapshot data in Redis
      await rclient.set(keySchema.head({ projectId }), rawSnapshot)

      // Attempt to retrieve the snapshot
      const result = await redisBackend.getHeadSnapshot(projectId)

      expect(result).to.be.null
    })
  })

  describe('queueChanges', function () {
    it('should queue changes when the base version matches head version', async function () {
      // Create base version
      const baseVersion = 0

      // Create a new head snapshot that will be set after changes
      const headSnapshot = new Snapshot()

      // Create changes
      const timestamp = new Date()
      const change = new Change([], timestamp, [])

      // Set times
      const now = Date.now()
      const persistTime = now + 30 * 1000 // 30 seconds from now
      const expireTime = now + 60 * 60 * 1000 // 1 hour from now

      // Queue the changes
      await redisBackend.queueChanges(
        projectId,
        headSnapshot,
        baseVersion,
        [change],
        { persistTime, expireTime }
      )

      // Get the state to verify the changes
      const state = await redisBackend.getState(projectId)

      // Verify the result
      expect(state).to.exist
      expect(state.headVersion).to.equal(baseVersion + 1)
      expect(state.headSnapshot).to.deep.equal(headSnapshot.toRaw())
      expect(state.persistTime).to.equal(persistTime)
      expect(state.expireTime).to.equal(expireTime)
    })

    it('should throw BaseVersionConflictError when base version does not match head version', async function () {
      // Create a mismatch scenario
      const headSnapshot = new Snapshot()
      const baseVersion = 0

      // Manually set a different head version in Redis
      await rclient.set(keySchema.headVersion({ projectId }), '5')

      // Create changes
      const timestamp = new Date()
      const change = new Change([], timestamp, [])

      // Set times
      const now = Date.now()
      const persistTime = now + 30 * 1000
      const expireTime = now + 60 * 60 * 1000

      // Attempt to queue the changes with a mismatched base version
      // This should throw a BaseVersionConflictError
      try {
        await redisBackend.queueChanges(
          projectId,
          headSnapshot,
          baseVersion,
          [change],
          { persistTime, expireTime }
        )
        // If we get here, the test should fail
        expect.fail('Expected BaseVersionConflictError but no error was thrown')
      } catch (err) {
        expect(err.name).to.equal('BaseVersionConflictError')
        expect(err.info).to.deep.include({
          projectId,
          baseVersion,
        })
      }
    })

    it('should throw error when given an empty changes array', async function () {
      // Create a valid scenario but with empty changes
      const headSnapshot = new Snapshot()
      const baseVersion = 0

      // Set times
      const now = Date.now()
      const persistTime = now + 30 * 1000
      const expireTime = now + 60 * 60 * 1000

      // Attempt to queue with empty changes array
      try {
        await redisBackend.queueChanges(
          projectId,
          headSnapshot,
          baseVersion,
          [], // Empty changes array
          { persistTime, expireTime }
        )
        // If we get here, the test should fail
        expect.fail('Expected Error but no error was thrown')
      } catch (err) {
        expect(err.message).to.equal('Cannot queue empty changes array')
      }
    })

    it('should queue multiple changes and increment version correctly', async function () {
      // Create base version
      const baseVersion = 0

      // Create a new head snapshot
      const headSnapshot = new Snapshot()

      // Create multiple changes
      const timestamp = new Date()
      const change1 = new Change([], timestamp)
      const change2 = new Change([], timestamp)
      const change3 = new Change([], timestamp)

      // Set times
      const now = Date.now()
      const persistTime = now + 30 * 1000
      const expireTime = now + 60 * 60 * 1000

      // Queue the changes
      await redisBackend.queueChanges(
        projectId,
        headSnapshot,
        baseVersion,
        [change1, change2, change3], // Multiple changes
        { persistTime, expireTime }
      )

      // Get the state to verify the changes
      const state = await redisBackend.getState(projectId)

      // Verify that version was incremented by the number of changes
      expect(state.headVersion).to.equal(baseVersion + 3)
      expect(state.headSnapshot).to.deep.equal(headSnapshot.toRaw())
    })

    it('should use the provided persistTime only if it is sooner than existing time', async function () {
      // Create base version
      const baseVersion = 0

      // Create a new head snapshot
      const headSnapshot = new Snapshot()

      // Create changes
      const timestamp = new Date()
      const change = new Change([], timestamp)

      // Set times
      const now = Date.now()
      const earlierPersistTime = now + 15 * 1000 // 15 seconds from now
      const laterPersistTime = now + 30 * 1000 // 30 seconds from now
      const expireTime = now + 60 * 60 * 1000 // 1 hour from now

      // First queue changes with the later persist time
      await redisBackend.queueChanges(
        projectId,
        headSnapshot,
        baseVersion,
        [change],
        { persistTime: laterPersistTime, expireTime }
      )

      // Get the state to verify the first persist time was set
      let state = await redisBackend.getState(projectId)
      expect(state.persistTime).to.equal(laterPersistTime)

      // Queue more changes with an earlier persist time
      const newerHeadSnapshot = new Snapshot()
      await redisBackend.queueChanges(
        projectId,
        newerHeadSnapshot,
        baseVersion + 1, // Updated base version
        [change],
        {
          persistTime: earlierPersistTime, // Earlier time should replace the later one
          expireTime,
        }
      )

      // Get the state to verify the persist time was updated to the earlier time
      state = await redisBackend.getState(projectId)
      expect(state.persistTime).to.equal(earlierPersistTime)

      // Queue more changes with another later persist time
      const evenNewerHeadSnapshot = new Snapshot()
      await redisBackend.queueChanges(
        projectId,
        evenNewerHeadSnapshot,
        baseVersion + 2, // Updated base version
        [change],
        {
          persistTime: laterPersistTime, // Later time should not replace the earlier one
          expireTime,
        }
      )

      // Get the state to verify the persist time remains at the earlier time
      state = await redisBackend.getState(projectId)
      expect(state.persistTime).to.equal(earlierPersistTime) // Should still be the earlier time
    })

    it('should ignore changes when onlyIfExists is true and project does not exist', async function () {
      // Create base version
      const baseVersion = 10

      // Create a new head snapshot
      const headSnapshot = new Snapshot()

      // Create changes
      const timestamp = new Date()
      const change = new Change([], timestamp)

      // Set times
      const now = Date.now()
      const persistTime = now + 30 * 1000
      const expireTime = now + 60 * 60 * 1000

      // Queue changes with onlyIfExists set to true
      const result = await redisBackend.queueChanges(
        projectId,
        headSnapshot,
        baseVersion,
        [change],
        { persistTime, expireTime, onlyIfExists: true }
      )

      // Should return 'ignore' status
      expect(result).to.equal('ignore')

      // Get the state - should be empty/null
      const state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.be.null
      expect(state.headSnapshot).to.be.null
    })

    it('should queue changes when onlyIfExists is true and project exists', async function () {
      // First create the project
      const headSnapshot = new Snapshot()
      const baseVersion = 10
      const timestamp = new Date()
      const change1 = new Change([], timestamp)

      // Set times
      const now = Date.now()
      const persistTime = now + 30 * 1000
      const expireTime = now + 60 * 60 * 1000

      // Create the project first
      await redisBackend.queueChanges(
        projectId,
        headSnapshot,
        baseVersion,
        [change1],
        { persistTime, expireTime }
      )

      // Now create another change with onlyIfExists set to true
      const newerSnapshot = new Snapshot()
      const change2 = new Change([], timestamp)

      // Queue changes with onlyIfExists set to true
      const result = await redisBackend.queueChanges(
        projectId,
        newerSnapshot,
        baseVersion + 1, // Version should be 1 after the first change
        [change2],
        { persistTime, expireTime, onlyIfExists: true }
      )

      // Should return 'ok' status
      expect(result).to.equal('ok')

      // Get the state to verify the changes were applied
      const state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.equal(baseVersion + 2) // Should be 2 after both changes
      expect(state.headSnapshot).to.deep.equal(newerSnapshot.toRaw())
    })

    it('should queue changes when onlyIfExists is false and project does not exist', async function () {
      // Create base version
      const baseVersion = 10

      // Create a new head snapshot
      const headSnapshot = new Snapshot()

      // Create changes
      const timestamp = new Date()
      const change = new Change([], timestamp)

      // Set times
      const now = Date.now()
      const persistTime = now + 30 * 1000
      const expireTime = now + 60 * 60 * 1000

      // Queue changes with onlyIfExists explicitly set to false
      const result = await redisBackend.queueChanges(
        projectId,
        headSnapshot,
        baseVersion,
        [change],
        { persistTime, expireTime, onlyIfExists: false }
      )

      // Should return 'ok' status
      expect(result).to.equal('ok')

      // Get the state to verify the project was created
      const state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.equal(baseVersion + 1)
      expect(state.headSnapshot).to.deep.equal(headSnapshot.toRaw())
    })
  })

  describe('getChangesSinceVersion', function () {
    it('should return not_found when project does not exist', async function () {
      const result = await redisBackend.getChangesSinceVersion(projectId, 1)
      expect(result.status).to.equal('not_found')
    })

    it('should return empty array when requested version equals head version', async function () {
      // Set head version
      const headVersion = 5
      await rclient.set(
        keySchema.headVersion({ projectId }),
        headVersion.toString()
      )

      // Request changes since the current head version
      const result = await redisBackend.getChangesSinceVersion(
        projectId,
        headVersion
      )

      expect(result.status).to.equal('ok')
      expect(result.changes).to.be.an('array').that.is.empty
    })

    it('should return out_of_bounds when requested version is greater than head version', async function () {
      // Set head version
      const headVersion = 5
      await rclient.set(
        keySchema.headVersion({ projectId }),
        headVersion.toString()
      )

      // Request changes with version larger than head
      const result = await redisBackend.getChangesSinceVersion(
        projectId,
        headVersion + 1
      )

      expect(result.status).to.equal('out_of_bounds')
    })

    it('should return out_of_bounds when requested version is too old', async function () {
      // Set head version
      const headVersion = 10
      await rclient.set(
        keySchema.headVersion({ projectId }),
        headVersion.toString()
      )

      // Create a few changes but less than what we'd need to reach requested version
      const timestamp = new Date()
      const change1 = new Change([], timestamp)
      const change2 = new Change([], timestamp)
      await rclient.rpush(
        keySchema.changes({ projectId }),
        JSON.stringify(change1.toRaw()),
        JSON.stringify(change2.toRaw())
      )

      // Request changes from version 5, which is too old (headVersion - changesCount = 10 - 2 = 8)
      const result = await redisBackend.getChangesSinceVersion(projectId, 5)

      expect(result.status).to.equal('out_of_bounds')
    })

    it('should return changes since requested version', async function () {
      // Set head version
      const headVersion = 5
      await rclient.set(
        keySchema.headVersion({ projectId }),
        headVersion.toString()
      )

      // Create changes
      const timestamp = new Date()
      const change1 = new Change([], timestamp)
      const change2 = new Change([], timestamp)
      const change3 = new Change([], timestamp)

      // Push changes to Redis (representing versions 3, 4, and 5)
      await rclient.rpush(
        keySchema.changes({ projectId }),
        JSON.stringify(change1.toRaw()),
        JSON.stringify(change2.toRaw()),
        JSON.stringify(change3.toRaw())
      )

      // Request changes since version 3 (should return changes for versions 4 and 5)
      const result = await redisBackend.getChangesSinceVersion(projectId, 3)

      expect(result.status).to.equal('ok')
      expect(result.changes).to.be.an('array').with.lengthOf(2)

      expect(result.changes[0]).to.deep.equal(change2)
      expect(result.changes[1]).to.deep.equal(change3)
    })

    it('should return all changes when requested version is earliest available', async function () {
      // Set head version to 5
      const headVersion = 5
      await rclient.set(
        keySchema.headVersion({ projectId }),
        headVersion.toString()
      )

      // Create changes
      const timestamp = new Date()
      const change1 = new Change([], timestamp)
      const change2 = new Change([], timestamp)
      const change3 = new Change([], timestamp)

      // Push changes to Redis (representing versions 3, 4, and 5)
      await rclient.rpush(
        keySchema.changes({ projectId }),
        JSON.stringify(change1.toRaw()),
        JSON.stringify(change2.toRaw()),
        JSON.stringify(change3.toRaw())
      )

      // Request changes since version 2 (should return all 3 changes)
      const result = await redisBackend.getChangesSinceVersion(projectId, 2)

      expect(result.status).to.equal('ok')
      expect(result.changes).to.be.an('array').with.lengthOf(3)
      expect(result.changes[0]).to.deep.equal(change1)
      expect(result.changes[1]).to.deep.equal(change2)
      expect(result.changes[2]).to.deep.equal(change3)
    })
  })

  describe('getNonPersistedChanges', function () {
    describe('project not loaded', function () {
      it('should return empty array', async function () {
        const changes = await redisBackend.getNonPersistedChanges(projectId, 0)
        expect(changes).to.be.an('array').that.is.empty
      })

      it('should handle any base version', async function () {
        const changes = await redisBackend.getNonPersistedChanges(projectId, 2)
        expect(changes).to.be.an('array').that.is.empty
      })
    })

    describe('project never persisted', function () {
      let changes

      beforeEach(async function () {
        changes = await setupState(projectId, {
          headVersion: 5,
          persistedVersion: null,
          changes: 3,
        })
      })

      it('should return all changes if requested', async function () {
        const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
          projectId,
          2
        )
        expect(nonPersistedChanges).to.deep.equal(changes)
      })

      it('should return part of the changes following a given base version if requested', async function () {
        const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
          projectId,
          3
        )
        expect(nonPersistedChanges).to.deep.equal(changes.slice(1))
      })

      it('should limit the number of changes returned if requested', async function () {
        const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
          projectId,
          2,
          { maxChanges: 2 }
        )
        expect(nonPersistedChanges).to.deep.equal(changes.slice(0, 2))
      })

      it('should return all changes if limit is not reached', async function () {
        const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
          projectId,
          3,
          { maxChanges: 10 }
        )
        expect(nonPersistedChanges).to.deep.equal(changes.slice(1))
      })

      it('should error if the base version requested is too low', async function () {
        await expect(
          redisBackend.getNonPersistedChanges(projectId, 0)
        ).to.be.rejectedWith(VersionOutOfBoundsError)
      })

      it('should return an empty array if the base version is the head version', async function () {
        const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
          projectId,
          5
        )
        expect(nonPersistedChanges).to.deep.equal([])
      })

      it('should error if the base version requested is too high', async function () {
        await expect(
          redisBackend.getNonPersistedChanges(projectId, 6)
        ).to.be.rejectedWith(VersionOutOfBoundsError)
      })
    })

    describe('fully persisted changes', function () {
      beforeEach(async function () {
        await setupState(projectId, {
          headVersion: 5,
          persistedVersion: 5,
          changes: 3,
        })
      })

      it('should return an empty array when asked for the head version', async function () {
        const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
          projectId,
          5
        )
        expect(nonPersistedChanges).to.deep.equal([])
      })

      it('should throw an error when asked for an older version', async function () {
        await expect(
          redisBackend.getNonPersistedChanges(projectId, 4)
        ).to.be.rejectedWith(VersionOutOfBoundsError)
      })

      it('should throw an error when asked for a newer version', async function () {
        await expect(
          redisBackend.getNonPersistedChanges(projectId, 6)
        ).to.be.rejectedWith(VersionOutOfBoundsError)
      })
    })

    describe('partially persisted project', async function () {
      let changes

      beforeEach(async function () {
        changes = await setupState(projectId, {
          headVersion: 10,
          persistedVersion: 7,
          changes: 6,
        })
      })

      it('should return all non-persisted changes if requested', async function () {
        const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
          projectId,
          7
        )
        expect(nonPersistedChanges).to.deep.equal(changes.slice(3))
      })

      it('should return part of the changes if requested', async function () {
        const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
          projectId,
          8
        )
        expect(nonPersistedChanges).to.deep.equal(changes.slice(4))
      })

      it('should error if the base version requested is too low', async function () {
        await expect(
          redisBackend.getNonPersistedChanges(projectId, 5)
        ).to.be.rejectedWith(VersionOutOfBoundsError)
      })

      it('should return an empty array if the base version is the head version', async function () {
        const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
          projectId,
          10
        )
        expect(nonPersistedChanges).to.deep.equal([])
      })

      it('should error if the base version requested is too high', async function () {
        await expect(
          redisBackend.getNonPersistedChanges(projectId, 12)
        ).to.be.rejectedWith(VersionOutOfBoundsError)
      })
    })

    // This case should never happen, but we'll handle it anyway
    describe('persisted version before start of changes list', async function () {
      let changes

      beforeEach(async function () {
        changes = await setupState(projectId, {
          headVersion: 5,
          persistedVersion: 1,
          changes: 3,
        })
      })

      it('should return all non-persisted changes if requested', async function () {
        const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
          projectId,
          2
        )
        expect(nonPersistedChanges).to.deep.equal(changes)
      })

      it('should return part of the changes if requested', async function () {
        const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
          projectId,
          3
        )
        expect(nonPersistedChanges).to.deep.equal(changes.slice(1))
      })

      it('should error if the base version requested is too low', async function () {
        await expect(
          redisBackend.getNonPersistedChanges(projectId, 1)
        ).to.be.rejectedWith(VersionOutOfBoundsError)
      })

      it('should return an empty array if the base version is the head version', async function () {
        const nonPersistedChanges = await redisBackend.getNonPersistedChanges(
          projectId,
          5
        )
        expect(nonPersistedChanges).to.deep.equal([])
      })

      it('should error if the base version requested is too high', async function () {
        await expect(
          redisBackend.getNonPersistedChanges(projectId, 6)
        ).to.be.rejectedWith(VersionOutOfBoundsError)
      })
    })
  })

  describe('setPersistedVersion', function () {
    const persistTime = Date.now() + 60 * 1000 // 1 minute from now

    it('should return not_found when project does not exist', async function () {
      const result = await redisBackend.setPersistedVersion(projectId, 5)
      expect(result).to.equal('not_found')
    })

    describe('when the persisted version is not set', function () {
      beforeEach(async function () {
        await setupState(projectId, {
          headVersion: 5,
          persistedVersion: null,
          persistTime,
          changes: 5,
        })
      })

      it('should set the persisted version', async function () {
        const status = await redisBackend.setPersistedVersion(projectId, 3)
        expect(status).to.equal('ok')
        const state = await redisBackend.getState(projectId)
        expect(state.persistedVersion).to.equal(3)
      })

      it('should leave the persist time if the persisted version is not current', async function () {
        const status = await redisBackend.setPersistedVersion(projectId, 3)
        expect(status).to.equal('ok')
        const state = await redisBackend.getState(projectId)
        expect(state.persistTime).to.deep.equal(persistTime) // Persist time should remain unchanged
      })

      it('should refuse to set a persisted version greater than the head version', async function () {
        await expect(
          redisBackend.setPersistedVersion(projectId, 10)
        ).to.be.rejectedWith(VersionOutOfBoundsError)
        // Ensure persisted version remains unchanged
        const state = await redisBackend.getState(projectId)
        expect(state.persistedVersion).to.be.null
      })

      it('should clear the persist time when the persisted version is current', async function () {
        const status = await redisBackend.setPersistedVersion(projectId, 5)
        expect(status).to.equal('ok')
        const state = await redisBackend.getState(projectId)
        expect(state.persistedVersion).to.equal(5)
        expect(state.persistTime).to.be.null // Persist time should be cleared
      })
    })

    describe('when the persisted version is set', function () {
      beforeEach(async function () {
        await setupState(projectId, {
          headVersion: 5,
          persistedVersion: 3,
          persistTime,
          changes: 5,
        })
      })

      it('should set the persisted version', async function () {
        const status = await redisBackend.setPersistedVersion(projectId, 5)
        expect(status).to.equal('ok')
        const state = await redisBackend.getState(projectId)
        expect(state.persistedVersion).to.equal(5)
      })

      it('should clear the persist time when the persisted version is current', async function () {
        const status = await redisBackend.setPersistedVersion(projectId, 5)
        expect(status).to.equal('ok')
        const state = await redisBackend.getState(projectId)
        expect(state.persistedVersion).to.equal(5)
        expect(state.persistTime).to.be.null // Persist time should be cleared
      })

      it('should leave the persist time if the persisted version is not current', async function () {
        const status = await redisBackend.setPersistedVersion(projectId, 4)
        expect(status).to.equal('ok')
        const state = await redisBackend.getState(projectId)
        expect(state.persistedVersion).to.equal(4)
        expect(state.persistTime).to.deep.equal(persistTime) // Persist time should remain unchanged
      })

      it('should not decrease the persisted version', async function () {
        const status = await redisBackend.setPersistedVersion(projectId, 2)
        expect(status).to.equal('too_low')
        const state = await redisBackend.getState(projectId)
        expect(state.persistedVersion).to.equal(3)
      })

      it('should refuse to set a persisted version greater than the head version', async function () {
        await expect(
          redisBackend.setPersistedVersion(projectId, 10)
        ).to.be.rejectedWith(VersionOutOfBoundsError)
        // Ensure persisted version remains unchanged
        const state = await redisBackend.getState(projectId)
        expect(state.persistedVersion).to.equal(3)
      })
    })

    it('should trim the changes list to keep only MAX_PERSISTED_CHANGES beyond persisted version', async function () {
      // Get MAX_PERSISTED_CHANGES to ensure our test data is larger
      const maxPersistedChanges = redisBackend.MAX_PERSISTED_CHANGES

      // Create a larger number of changes for the test
      // Using MAX_PERSISTED_CHANGES + 10 to ensure we have enough changes to trigger trimming
      const totalChanges = maxPersistedChanges + 10

      // Set head version to match total number of changes
      const headVersion = totalChanges
      await rclient.set(
        keySchema.headVersion({ projectId }),
        headVersion.toString()
      )

      // Create changes for versions 1 through totalChanges
      const timestamp = new Date()
      const changes = Array.from(
        { length: totalChanges },
        (_, idx) =>
          new Change(
            [new AddFileOperation(`file${idx}.tex`, File.fromString('hello'))],
            timestamp
          )
      )

      // Push changes to Redis
      await rclient.rpush(
        keySchema.changes({ projectId }),
        ...changes.map(change => JSON.stringify(change.toRaw()))
      )

      // Set persisted version to somewhere near the head version
      const persistedVersion = headVersion - 5

      // Set the persisted version
      const result = await redisBackend.setPersistedVersion(
        projectId,
        persistedVersion
      )
      expect(result).to.equal('ok')

      // Get all changes that remain in Redis
      const remainingChanges = await rclient.lrange(
        keySchema.changes({ projectId }),
        0,
        -1
      )

      // Calculate the expected number of changes to remain
      expect(remainingChanges).to.have.lengthOf(
        maxPersistedChanges + (headVersion - persistedVersion)
      )

      // Check that remaining changes are the expected ones
      const expectedChanges = changes.slice(
        persistedVersion - maxPersistedChanges,
        totalChanges
      )
      expect(remainingChanges).to.deep.equal(
        expectedChanges.map(change => JSON.stringify(change.toRaw()))
      )
    })

    it('should keep all changes when there are fewer than MAX_PERSISTED_CHANGES', async function () {
      // Set head version to 5
      const headVersion = 5
      await rclient.set(
        keySchema.headVersion({ projectId }),
        headVersion.toString()
      )

      // Create changes for versions 1 through 5
      const timestamp = new Date()
      const changes = Array.from({ length: 5 }, () => new Change([], timestamp))

      // Push changes to Redis
      await rclient.rpush(
        keySchema.changes({ projectId }),
        ...changes.map(change => JSON.stringify(change.toRaw()))
      )

      // Set persisted version to 3
      // All changes should remain since total count is small
      const persistedVersion = 3

      // Ensure MAX_PERSISTED_CHANGES is larger than our test dataset
      expect(redisBackend.MAX_PERSISTED_CHANGES).to.be.greaterThan(
        5,
        'MAX_PERSISTED_CHANGES should be greater than 5 for this test'
      )

      // Set the persisted version
      const result = await redisBackend.setPersistedVersion(
        projectId,
        persistedVersion
      )
      expect(result).to.equal('ok')

      // Get all changes that remain in Redis
      const remainingChanges = await rclient.lrange(
        keySchema.changes({ projectId }),
        0,
        -1
      )

      // All changes should remain
      expect(remainingChanges).to.have.lengthOf(5)
    })
  })

  describe('getState', function () {
    it('should return complete project state from Redis', async function () {
      // Set up the test data in Redis
      const snapshot = new Snapshot()
      const rawSnapshot = JSON.stringify(snapshot.toRaw())
      const headVersion = 42
      const persistedVersion = 40
      const now = Date.now()
      const expireTime = now + 60 * 60 * 1000 // 1 hour from now
      const persistTime = now + 30 * 1000 // 30 seconds from now

      // Create a change
      const timestamp = new Date()
      const change = new Change([], timestamp)
      const serializedChange = JSON.stringify(change.toRaw())

      // Set everything in Redis
      await rclient.set(keySchema.head({ projectId }), rawSnapshot)
      await rclient.set(
        keySchema.headVersion({ projectId }),
        headVersion.toString()
      )
      await rclient.set(
        keySchema.persistedVersion({ projectId }),
        persistedVersion.toString()
      )
      await rclient.set(
        keySchema.expireTime({ projectId }),
        expireTime.toString()
      )
      await rclient.set(
        keySchema.persistTime({ projectId }),
        persistTime.toString()
      )
      await rclient.rpush(keySchema.changes({ projectId }), serializedChange)

      // Get the state
      const state = await redisBackend.getState(projectId)

      // Verify everything matches
      expect(state).to.exist
      expect(state.headSnapshot).to.deep.equal(snapshot.toRaw())
      expect(state.headVersion).to.equal(headVersion)
      expect(state.persistedVersion).to.equal(persistedVersion)
      expect(state.expireTime).to.equal(expireTime)
      expect(state.persistTime).to.equal(persistTime)
    })

    it('should return proper defaults for missing fields', async function () {
      // Only set the head snapshot and version, leave others unset
      const snapshot = new Snapshot()
      const rawSnapshot = JSON.stringify(snapshot.toRaw())
      const headVersion = 42

      await rclient.set(keySchema.head({ projectId }), rawSnapshot)
      await rclient.set(
        keySchema.headVersion({ projectId }),
        headVersion.toString()
      )

      // Get the state
      const state = await redisBackend.getState(projectId)

      // Verify only what we set exists, and other fields have correct defaults
      expect(state).to.exist
      expect(state.headSnapshot).to.deep.equal(snapshot.toRaw())
      expect(state.headVersion).to.equal(headVersion)
      expect(state.persistedVersion).to.be.null
      expect(state.expireTime).to.be.null
      expect(state.persistTime).to.be.null
    })
  })

  describe('setExpireTime', function () {
    it('should set the expire time on an active project', async function () {
      // Load a fake project in Redis
      const change = makeChange()
      await queueChanges(projectId, [change], { expireTime: 123 })

      // Check that the right expire time was recorded
      let state = await redisBackend.getState(projectId)
      expect(state.expireTime).to.equal(123)

      // Set the expire time to something else
      await redisBackend.setExpireTime(projectId, 456)
      state = await redisBackend.getState(projectId)
      expect(state.expireTime).to.equal(456)
    })

    it('should not set an expire time on an inactive project', async function () {
      let state = await redisBackend.getState(projectId)
      expect(state.expireTime).to.be.null

      await redisBackend.setExpireTime(projectId, 456)
      state = await redisBackend.getState(projectId)
      expect(state.expireTime).to.be.null
    })
  })

  describe('expireProject', function () {
    it('should expire a persisted project', async function () {
      // Load and persist a project in Redis
      const change = makeChange()
      await queueChanges(projectId, [change])
      await redisBackend.setPersistedVersion(projectId, 1)

      // Check that the project is loaded
      let state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.equal(1)
      expect(state.persistedVersion).to.equal(1)

      // Expire the project
      await redisBackend.expireProject(projectId)
      state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.be.null
    })

    it('should not expire a non-persisted project', async function () {
      // Load a project in Redis
      const change = makeChange()
      await queueChanges(projectId, [change])

      // Check that the project is loaded
      let state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.equal(1)
      expect(state.persistedVersion).to.equal(null)

      // Expire the project
      await redisBackend.expireProject(projectId)
      state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.equal(1)
    })

    it('should not expire a partially persisted project', async function () {
      // Load a fake project in Redis
      const change1 = makeChange()
      const change2 = makeChange()
      await queueChanges(projectId, [change1, change2])

      // Persist the first change
      await redisBackend.setPersistedVersion(projectId, 1)

      // Check that the project is loaded
      let state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.equal(2)
      expect(state.persistedVersion).to.equal(1)

      // Expire the project
      await redisBackend.expireProject(projectId)
      state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.equal(2)
    })

    it('should handle a project that is not loaded', async function () {
      // Check that the project is not loaded
      let state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.be.null

      // Expire the project
      await redisBackend.expireProject(projectId)
      state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.be.null
    })
  })

  describe('claimExpireJob', function () {
    it("should claim the expire job when it's ready", async function () {
      // Load a project in Redis
      const change = makeChange()
      const now = Date.now()
      const expireTime = now - 1000
      await queueChanges(projectId, [change], { expireTime })

      // Check that the expire time has been set correctly
      let state = await redisBackend.getState(projectId)
      expect(state.expireTime).to.equal(expireTime)

      // Claim the job
      await redisBackend.claimExpireJob(projectId)

      // Check the job expires in the future
      state = await redisBackend.getState(projectId)
      expect(state.expireTime).to.satisfy(time => time > now)
    })

    it('should throw an error when the job is not ready', async function () {
      // Load a project in Redis
      const change = makeChange()
      const now = Date.now()
      const expireTime = now + 100_000
      await queueChanges(projectId, [change], { expireTime })

      // Claim the job
      await expect(redisBackend.claimExpireJob(projectId)).to.be.rejectedWith(
        JobNotReadyError
      )
    })

    it('should throw an error when the job is not found', async function () {
      // Claim a job on a project that is not loaded
      await expect(redisBackend.claimExpireJob(projectId)).to.be.rejectedWith(
        JobNotFoundError
      )
    })
  })

  describe('claimPersistJob', function () {
    it("should claim the persist job when it's ready", async function () {
      // Load a project in Redis
      const change = makeChange()
      const now = Date.now()
      const persistTime = now - 1000
      await queueChanges(projectId, [change], { persistTime })

      // Check that the persist time has been set correctly
      let state = await redisBackend.getState(projectId)
      expect(state.persistTime).to.equal(persistTime)

      // Claim the job
      await redisBackend.claimPersistJob(projectId)

      // Check the job is not ready
      state = await redisBackend.getState(projectId)
      expect(state.persistTime).to.satisfy(time => time > now)
    })

    it('should throw an error when the job is not ready', async function () {
      // Load a project in Redis
      const change = makeChange()
      const now = Date.now()
      const persistTime = now + 100_000
      await queueChanges(projectId, [change], { persistTime })

      // Claim the job
      await expect(redisBackend.claimPersistJob(projectId)).to.be.rejectedWith(
        JobNotReadyError
      )
    })

    it('should throw an error when the job is not found', async function () {
      // Claim a job on a project that is not loaded
      await expect(redisBackend.claimExpireJob(projectId)).to.be.rejectedWith(
        JobNotFoundError
      )
    })
  })

  describe('closing a job', function () {
    let job

    beforeEach(async function () {
      // Load a project in Redis
      const change = makeChange()
      const now = Date.now()
      const expireTime = now - 1000
      await queueChanges(projectId, [change], { expireTime })

      // Check that the expire time has been set correctly
      const state = await redisBackend.getState(projectId)
      expect(state.expireTime).to.equal(expireTime)

      // Claim the job
      job = await redisBackend.claimExpireJob(projectId)
    })

    it("should delete the key if it hasn't changed", async function () {
      await job.close()
      const state = await redisBackend.getState(projectId)
      expect(state.expireTime).to.be.null
    })

    it('should keep the key if it has changed', async function () {
      const newTimestamp = job.claimTimestamp + 1000
      await redisBackend.setExpireTime(projectId, newTimestamp)
      await job.close()
      const state = await redisBackend.getState(projectId)
      expect(state.expireTime).to.equal(newTimestamp)
    })
  })

  describe('hardDeleteProject', function () {
    it('should delete all keys associated with the project', async function () {
      // Setup project state
      await setupState(projectId, {
        headVersion: 5,
        headSnapshot: new Snapshot(),
        persistedVersion: 3,
        persistTime: Date.now(),
        expireTime: Date.now() + 3600 * 1000, // 1 hour from now
        changes: 5,
      })

      // Verify that state exists before deletion
      let state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.equal(5)

      // Call hardDeleteProject
      const result = await redisBackend.hardDeleteProject(projectId)
      expect(result).to.equal('ok')

      // Verify that all keys are deleted
      state = await redisBackend.getState(projectId)
      expect(state.headVersion).to.be.null
      expect(state.headSnapshot).to.be.null
      expect(state.persistedVersion).to.be.null
      expect(state.persistTime).to.be.null
      expect(state.expireTime).to.be.null
      expect(state.changes).to.be.an('array').that.is.empty
    })

    it('should not throw an error if the project does not exist', async function () {
      // Call hardDeleteProject on a non-existent project
      const result = await redisBackend.hardDeleteProject(projectId)
      expect(result).to.equal('ok')
    })
  })
})

async function queueChanges(projectId, changes, opts = {}) {
  const baseVersion = 0
  const headSnapshot = new Snapshot()

  await redisBackend.queueChanges(
    projectId,
    headSnapshot,
    baseVersion,
    changes,
    {
      persistTime: opts.persistTime,
      expireTime: opts.expireTime,
    }
  )
}

function makeChange() {
  const timestamp = new Date()
  return new Change([], timestamp)
}

/**
 * Setup Redis buffer state for tests
 *
 * @param {string} projectId
 * @param {object} params
 * @param {number} params.headVersion
 * @param {Snapshot} [params.headSnapshot]
 * @param {number | null} params.persistedVersion
 * @param {number | null} params.persistTime - time when the project should be persisted
 * @param {number | null} params.expireTime - time when the project should expire
 * @param {number} params.changes - number of changes to create
 * @return {Promise<Change[]>} dummy changes that have been created
 */
async function setupState(projectId, params) {
  await rclient.set(keySchema.headVersion({ projectId }), params.headVersion)
  if (params.headSnapshot) {
    await rclient.set(
      keySchema.head({ projectId }),
      JSON.stringify(params.headSnapshot.toRaw())
    )
  }
  if (params.persistedVersion) {
    await rclient.set(
      keySchema.persistedVersion({ projectId }),
      params.persistedVersion
    )
  }
  if (params.persistTime) {
    await rclient.set(keySchema.persistTime({ projectId }), params.persistTime)
  }
  if (params.expireTime) {
    await rclient.set(keySchema.expireTime({ projectId }), params.expireTime)
  }
  const changes = []
  for (let i = 1; i <= params.changes; i++) {
    const change = new Change(
      [new AddFileOperation(`file${i}.tex`, File.createHollow(i, i))],
      new Date()
    )
    changes.push(change)
  }
  await rclient.rpush(
    keySchema.changes({ projectId }),
    changes.map(change => JSON.stringify(change.toRaw()))
  )
  return changes
}
