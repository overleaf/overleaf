// @ts-check

const metrics = require('@overleaf/metrics')
const OError = require('@overleaf/o-error')
const { Change, Snapshot } = require('overleaf-editor-core')
const redis = require('../redis')
const rclient = redis.rclientHistory
const {
  BaseVersionConflictError,
  JobNotFoundError,
  JobNotReadyError,
  VersionOutOfBoundsError,
} = require('./errors')

const MAX_PERSISTED_CHANGES = 100 // Maximum number of persisted changes to keep in the buffer for clients that need to catch up.
const PROJECT_TTL_MS = 3600 * 1000 // Amount of time a project can stay inactive before it gets expired
const MAX_PERSIST_DELAY_MS = 300 * 1000 // Maximum amount of time before a change is persisted
const RETRY_DELAY_MS = 120 * 1000 // Time before a claimed job is considered stale and a worker can retry it.

const keySchema = {
  head({ projectId }) {
    return `head:{${projectId}}`
  },
  headVersion({ projectId }) {
    return `head-version:{${projectId}}`
  },
  persistedVersion({ projectId }) {
    return `persisted-version:{${projectId}}`
  },
  expireTime({ projectId }) {
    return `expire-time:{${projectId}}`
  },
  persistTime({ projectId }) {
    return `persist-time:{${projectId}}`
  },
  changes({ projectId }) {
    return `changes:{${projectId}}`
  },
}

rclient.defineCommand('get_head_snapshot', {
  numberOfKeys: 2,
  lua: `
      local headSnapshotKey = KEYS[1]
      local headVersionKey = KEYS[2]

      -- Check if the head version exists. If not, consider it a cache miss.
      local version = redis.call('GET', headVersionKey)
      if not version then
        return nil
      end

      -- Retrieve the snapshot value
      local snapshot = redis.call('GET', headSnapshotKey)
      return {snapshot, version}
    `,
})

/**
 * Retrieves the head snapshot from Redis storage
 * @param {string} projectId - The unique identifier of the project
 * @returns {Promise<{version: number, snapshot: Snapshot}|null>} A Promise that resolves to an object containing the version and Snapshot,
 *                               or null if retrieval fails or cache miss
 * @throws {Error} If Redis operations fail
 */
async function getHeadSnapshot(projectId) {
  try {
    const result = await rclient.get_head_snapshot(
      keySchema.head({ projectId }),
      keySchema.headVersion({ projectId })
    )
    if (!result) {
      metrics.inc('chunk_store.redis.get_head_snapshot', 1, {
        status: 'cache-miss',
      })
      return null // cache-miss
    }
    const snapshot = Snapshot.fromRaw(JSON.parse(result[0]))
    const version = parseInt(result[1], 10)
    metrics.inc('chunk_store.redis.get_head_snapshot', 1, {
      status: 'success',
    })
    return { version, snapshot }
  } catch (err) {
    metrics.inc('chunk_store.redis.get_head_snapshot', 1, { status: 'error' })
    throw err
  }
}

rclient.defineCommand('queue_changes', {
  numberOfKeys: 5,
  lua: `
  local headSnapshotKey = KEYS[1]
  local headVersionKey = KEYS[2]
  local changesKey = KEYS[3]
  local expireTimeKey = KEYS[4]
  local persistTimeKey = KEYS[5]

  local baseVersion = tonumber(ARGV[1])
  local head = ARGV[2]
  local persistTime = tonumber(ARGV[3])
  local expireTime = tonumber(ARGV[4])
  local onlyIfExists = ARGV[5]
  local changesIndex = 6 -- Changes start here

  local headVersion = tonumber(redis.call('GET', headVersionKey))

  -- Check if updates should only be queued if the project already exists (used for gradual rollouts)
  if not headVersion and onlyIfExists == 'true' then
    return 'ignore'
  end

  -- Check that the supplied baseVersion matches the head version
  -- If headVersion is nil, it means the project does not exist yet and will be created.
  if headVersion and headVersion ~= baseVersion then
    return 'conflict'
  end

  -- Check if there are any changes to queue
  if #ARGV < changesIndex then
    return 'no_changes_provided'
  end

  -- Store the changes
  -- RPUSH changesKey change1 change2 ...
  redis.call('RPUSH', changesKey, unpack(ARGV, changesIndex, #ARGV))

  -- Update head snapshot only if changes were successfully pushed
  redis.call('SET', headSnapshotKey, head)

  -- Update the head version
  local numChanges = #ARGV - changesIndex + 1
  local newHeadVersion = baseVersion + numChanges
  redis.call('SET', headVersionKey, newHeadVersion)

  -- Update the persist time if the new time is sooner
  local currentPersistTime = tonumber(redis.call('GET', persistTimeKey))
  if not currentPersistTime or persistTime < currentPersistTime then
    redis.call('SET', persistTimeKey, persistTime)
  end

  -- Update the expire time
  redis.call('SET', expireTimeKey, expireTime)

  return 'ok'
  `,
})

/**
 * Atomically queues changes to the project history in Redis if the baseVersion matches.
 * Updates head snapshot, version, persist time, and expire time.
 *
 * @param {string} projectId - The project identifier.
 * @param {Snapshot} headSnapshot - The new head snapshot after applying changes.
 * @param {number} baseVersion - The expected current head version.
 * @param {Change[]} changes - An array of Change objects to queue.
 * @param {object} [opts]
 * @param {number} [opts.persistTime] - Timestamp (ms since epoch) when the
 *                 oldest change in the buffer should be persisted.
 * @param {number} [opts.expireTime] - Timestamp (ms since epoch) when the
 *                 project buffer should expire if inactive.
 * @param {boolean} [opts.onlyIfExists] - If true, only queue changes if the
 *                 project already exists in Redis, otherwise ignore.
 * @returns {Promise<string>} Resolves on success to either 'ok' or 'ignore'.
 * @throws {BaseVersionConflictError} If the baseVersion does not match the current head version in Redis.
 * @throws {Error} If changes array is empty or if Redis operations fail.
 */
async function queueChanges(
  projectId,
  headSnapshot,
  baseVersion,
  changes,
  opts = {}
) {
  if (!changes || changes.length === 0) {
    throw new Error('Cannot queue empty changes array')
  }

  const persistTime = opts.persistTime ?? Date.now() + MAX_PERSIST_DELAY_MS
  const expireTime = opts.expireTime ?? Date.now() + PROJECT_TTL_MS
  const onlyIfExists = Boolean(opts.onlyIfExists)

  try {
    const keys = [
      keySchema.head({ projectId }),
      keySchema.headVersion({ projectId }),
      keySchema.changes({ projectId }),
      keySchema.expireTime({ projectId }),
      keySchema.persistTime({ projectId }),
    ]

    const args = [
      baseVersion.toString(),
      JSON.stringify(headSnapshot.toRaw()),
      persistTime.toString(),
      expireTime.toString(),
      onlyIfExists.toString(), // Only queue changes if the snapshot already exists
      ...changes.map(change => JSON.stringify(change.toRaw())), // Serialize changes
    ]

    const status = await rclient.queue_changes(keys, args)
    metrics.inc('chunk_store.redis.queue_changes', 1, { status })
    if (status === 'ok') {
      return status
    }
    if (status === 'ignore') {
      return status // skip changes when project does not exist and onlyIfExists is true
    }
    if (status === 'conflict') {
      throw new BaseVersionConflictError('base version mismatch', {
        projectId,
        baseVersion,
      })
    } else {
      throw new Error(`unexpected result queuing changes: ${status}`)
    }
  } catch (err) {
    if (err instanceof BaseVersionConflictError) {
      // Re-throw conflict errors directly
      throw err
    }
    metrics.inc('chunk_store.redis.queue_changes', 1, { status: 'error' })
    throw err
  }
}

rclient.defineCommand('get_state', {
  numberOfKeys: 6, // Number of keys defined in keySchema
  lua: `
    local headSnapshotKey = KEYS[1]
    local headVersionKey = KEYS[2]
    local persistedVersionKey = KEYS[3]
    local expireTimeKey = KEYS[4]
    local persistTimeKey = KEYS[5]
    local changesKey = KEYS[6]

    local headSnapshot = redis.call('GET', headSnapshotKey)
    local headVersion = redis.call('GET', headVersionKey)
    local persistedVersion = redis.call('GET', persistedVersionKey)
    local expireTime = redis.call('GET', expireTimeKey)
    local persistTime = redis.call('GET', persistTimeKey)
    local changes = redis.call('LRANGE', changesKey, 0, -1) -- Get all changes in the list

    return {headSnapshot, headVersion, persistedVersion, expireTime, persistTime, changes}
  `,
})

/**
 * Retrieves the entire state associated with a project from Redis atomically.
 * @param {string} projectId - The unique identifier of the project.
 * @returns {Promise<object|null>} A Promise that resolves to an object containing the project state,
 *                                  or null if the project state does not exist (e.g., head version is missing).
 * @throws {Error} If Redis operations fail.
 */
async function getState(projectId) {
  const keys = [
    keySchema.head({ projectId }),
    keySchema.headVersion({ projectId }),
    keySchema.persistedVersion({ projectId }),
    keySchema.expireTime({ projectId }),
    keySchema.persistTime({ projectId }),
    keySchema.changes({ projectId }),
  ]

  // Pass keys individually, not as an array
  const result = await rclient.get_state(...keys)

  const [
    rawHeadSnapshot,
    rawHeadVersion,
    rawPersistedVersion,
    rawExpireTime,
    rawPersistTime,
    rawChanges,
  ] = result

  // Safely parse values, providing defaults or nulls if necessary
  const headSnapshot = rawHeadSnapshot
    ? JSON.parse(rawHeadSnapshot)
    : rawHeadSnapshot
  const headVersion = rawHeadVersion ? parseInt(rawHeadVersion, 10) : null // Should always exist if result is not null
  const persistedVersion = rawPersistedVersion
    ? parseInt(rawPersistedVersion, 10)
    : null
  const expireTime = rawExpireTime ? parseInt(rawExpireTime, 10) : null
  const persistTime = rawPersistTime ? parseInt(rawPersistTime, 10) : null
  const changes = rawChanges ? rawChanges.map(JSON.parse) : null

  return {
    headSnapshot,
    headVersion,
    persistedVersion,
    expireTime,
    persistTime,
    changes,
  }
}

rclient.defineCommand('get_changes_since_version', {
  numberOfKeys: 2,
  lua: `
    local headVersionKey = KEYS[1]
    local changesKey = KEYS[2]

    local requestedVersion = tonumber(ARGV[1])

    -- Check if head version exists
    local headVersion = tonumber(redis.call('GET', headVersionKey))
    if not headVersion then
      return {'not_found'}
    end

    -- If requested version equals head version, return empty array
    if requestedVersion == headVersion then
      return {'ok', {}}
    end

    -- If requested version is greater than head version, return error
    if requestedVersion > headVersion then
      return {'out_of_bounds'}
    end

    -- Get length of changes list
    local changesCount = redis.call('LLEN', changesKey)

    -- Check if requested version is too old (changes already removed from buffer)
    if requestedVersion < (headVersion - changesCount) then
      return {'out_of_bounds'}
    end

    -- Calculate the starting index, using negative indexing to count backwards
    -- from the end of the list
    local startIndex = requestedVersion - headVersion

    -- Get changes using LRANGE
    local changes = redis.call('LRANGE', changesKey, startIndex, -1)

    return {'ok', changes}
  `,
})

/**
 * Retrieves changes since a specific version for a project from Redis.
 *
 * @param {string} projectId - The unique identifier of the project.
 * @param {number} version - The version number to retrieve changes since.
 * @returns {Promise<{status: string, changes?: Array<Change>}>} A Promise that resolves to an object containing:
 *   - status: 'OK', 'NOT_FOUND', or 'OUT_OF_BOUNDS'
 *   - changes: Array of Change objects (only when status is 'OK')
 * @throws {Error} If Redis operations fail.
 */
async function getChangesSinceVersion(projectId, version) {
  try {
    const keys = [
      keySchema.headVersion({ projectId }),
      keySchema.changes({ projectId }),
    ]

    const args = [version.toString()]

    const result = await rclient.get_changes_since_version(keys, args)
    const status = result[0]

    if (status === 'ok') {
      // If status is OK, parse the changes
      const changes = result[1]
        ? result[1]
            .map(rawChange =>
              typeof rawChange === 'string' ? JSON.parse(rawChange) : rawChange
            )
            .map(Change.fromRaw)
        : []

      metrics.inc('chunk_store.redis.get_changes_since_version', 1, {
        status: 'success',
      })
      return { status, changes }
    } else {
      // For other statuses, just return the status
      metrics.inc('chunk_store.redis.get_changes_since_version', 1, {
        status,
      })
      return { status }
    }
  } catch (err) {
    metrics.inc('chunk_store.redis.get_changes_since_version', 1, {
      status: 'error',
    })
    throw err
  }
}

rclient.defineCommand('get_non_persisted_changes', {
  numberOfKeys: 3,
  lua: `
    local headVersionKey = KEYS[1]
    local persistedVersionKey = KEYS[2]
    local changesKey = KEYS[3]
    local baseVersion = tonumber(ARGV[1])
    local maxChanges = tonumber(ARGV[2])

    -- Check if head version exists
    local headVersion = tonumber(redis.call('GET', headVersionKey))
    if not headVersion then
      return {'not_found'}
    end

    -- Check if persisted version exists
    local persistedVersion = tonumber(redis.call('GET', persistedVersionKey))
    if not persistedVersion then
      local changesCount = tonumber(redis.call('LLEN', changesKey))
      persistedVersion = headVersion - changesCount
    end

    if baseVersion < persistedVersion or baseVersion > headVersion then
      return {'out_of_bounds'}
    elseif baseVersion == headVersion then
      return {'ok', {}}
    else
      local numChanges = headVersion - baseVersion

      local endIndex, expectedChanges
      if maxChanges > 0 and maxChanges < numChanges then
        -- return only the first maxChanges changes; the end index is inclusive
        endIndex = -numChanges + maxChanges - 1
        expectedChanges = maxChanges
      else
        endIndex = -1
        expectedChanges = numChanges
      end

      local changes = redis.call('LRANGE', changesKey, -numChanges, endIndex)

      if #changes < expectedChanges then
        -- We didn't get as many changes as we expected
        return {'out_of_bounds'}
      end

      return {'ok', changes}
    end
  `,
})

/**
 * Retrieves non-persisted changes for a project from Redis.
 *
 * @param {string} projectId - The unique identifier of the project.
 * @param {number} baseVersion - The version on top of which the changes should
 *        be applied.
 * @param {object} [opts]
 * @param {number} [opts.maxChanges] - The maximum number of changes to return.
 *        Defaults to 0, meaning no limit.
 * @returns {Promise<Change[]>} Changes that can be applied on top of
 *          baseVersion. An empty array means that the project doesn't have
 *          changes to persist. A null value means that the non-persisted
 *          changes can't be applied to the given base version.
 *
 * @throws {Error} If Redis operations fail.
 */
async function getNonPersistedChanges(projectId, baseVersion, opts = {}) {
  let result
  try {
    result = await rclient.get_non_persisted_changes(
      keySchema.headVersion({ projectId }),
      keySchema.persistedVersion({ projectId }),
      keySchema.changes({ projectId }),
      baseVersion.toString(),
      opts.maxChanges ?? 0
    )
  } catch (err) {
    metrics.inc('chunk_store.redis.get_non_persisted_changes', 1, {
      status: 'error',
    })
    throw err
  }

  const status = result[0]
  metrics.inc('chunk_store.redis.get_non_persisted_changes', 1, {
    status,
  })

  if (status === 'ok') {
    return result[1].map(json => Change.fromRaw(JSON.parse(json)))
  } else if (status === 'not_found') {
    return []
  } else if (status === 'out_of_bounds') {
    throw new VersionOutOfBoundsError(
      "Non-persisted changes can't be applied to base version",
      { projectId, baseVersion }
    )
  } else {
    throw new OError('unknown status for get_non_persisted_changes', {
      projectId,
      baseVersion,
      status,
    })
  }
}

rclient.defineCommand('set_persisted_version', {
  numberOfKeys: 4,
  lua: `
    local headVersionKey = KEYS[1]
    local persistedVersionKey = KEYS[2]
    local persistTimeKey = KEYS[3]
    local changesKey = KEYS[4]

    local newPersistedVersion = tonumber(ARGV[1])
    local maxPersistedChanges = tonumber(ARGV[2])

    -- Check if head version exists
    local headVersion = tonumber(redis.call('GET', headVersionKey))
    if not headVersion then
      return 'not_found'
    end

    -- Get current persisted version
    local persistedVersion = tonumber(redis.call('GET', persistedVersionKey))
    if persistedVersion and persistedVersion > newPersistedVersion then
      return 'too_low'
    end

    -- Refuse to set a persisted version that is higher than the head version
    if newPersistedVersion > headVersion then
      return 'too_high'
    end

    -- Set the persisted version
    redis.call('SET', persistedVersionKey, newPersistedVersion)

    -- Clear the persist time if the persisted version now matches the head version
    if newPersistedVersion == headVersion then
      redis.call('DEL', persistTimeKey)
    end

    -- Calculate the starting index, to keep only maxPersistedChanges beyond the persisted version
    -- Using negative indexing to count backwards from the end of the list
    local startIndex = newPersistedVersion - headVersion - maxPersistedChanges

    -- Trim the changes list to keep only the specified number of changes beyond persisted version
    if startIndex < 0 then
      redis.call('LTRIM', changesKey, startIndex, -1)
    end

    return 'ok'
  `,
})

/**
 * Sets the persisted version for a project in Redis and trims the changes list.
 *
 * @param {string} projectId - The unique identifier of the project.
 * @param {number} persistedVersion - The version number to set as persisted.
 * @returns {Promise<string>} A Promise that resolves to 'OK' or 'NOT_FOUND'.
 * @throws {Error} If Redis operations fail.
 */
async function setPersistedVersion(projectId, persistedVersion) {
  try {
    const keys = [
      keySchema.headVersion({ projectId }),
      keySchema.persistedVersion({ projectId }),
      keySchema.persistTime({ projectId }),
      keySchema.changes({ projectId }),
    ]

    const args = [persistedVersion.toString(), MAX_PERSISTED_CHANGES.toString()]

    const status = await rclient.set_persisted_version(keys, args)

    metrics.inc('chunk_store.redis.set_persisted_version', 1, {
      status,
    })

    if (status === 'too_high') {
      throw new VersionOutOfBoundsError(
        'Persisted version cannot be higher than head version',
        { projectId, persistedVersion }
      )
    }

    return status
  } catch (err) {
    metrics.inc('chunk_store.redis.set_persisted_version', 1, {
      status: 'error',
    })
    throw err
  }
}

rclient.defineCommand('hard_delete_project', {
  numberOfKeys: 6,
  lua: `
    local headKey = KEYS[1]
    local headVersionKey = KEYS[2]
    local persistedVersionKey = KEYS[3]
    local expireTimeKey = KEYS[4]
    local persistTimeKey = KEYS[5]
    local changesKey = KEYS[6]
    -- Delete all keys associated with the project
    redis.call('DEL',
      headKey,
      headVersionKey,
      persistedVersionKey,
      expireTimeKey,
      persistTimeKey,
      changesKey
    )
      return 'ok'
  `,
})

/** Hard delete a project from Redis by removing all keys associated with it.
 * This is only to be used when a project is **permanently** deleted.
 * DO NOT USE THIS FOR ANY OTHER PURPOSES AS IT WILL REMOVE NON-PERSISTED CHANGES.
 * @param {string} projectId - The unique identifier of the project to delete.
 * @returns {Promise<string>} A Promise that resolves to 'ok' on success.
 * @throws {Error} If Redis operations fail.
 */
async function hardDeleteProject(projectId) {
  try {
    const status = await rclient.hard_delete_project(
      keySchema.head({ projectId }),
      keySchema.headVersion({ projectId }),
      keySchema.persistedVersion({ projectId }),
      keySchema.expireTime({ projectId }),
      keySchema.persistTime({ projectId }),
      keySchema.changes({ projectId })
    )
    metrics.inc('chunk_store.redis.hard_delete_project', 1, { status })
    return status
  } catch (err) {
    metrics.inc('chunk_store.redis.hard_delete_project', 1, { status: 'error' })
    throw err
  }
}

rclient.defineCommand('set_expire_time', {
  numberOfKeys: 2,
  lua: `
    local expireTimeKey = KEYS[1]
    local headVersionKey = KEYS[2]
    local expireTime = tonumber(ARGV[1])

    -- Only set the expire time if the project is loaded in Redis
    local headVersion = redis.call('GET', headVersionKey)
    if headVersion then
      redis.call('SET', expireTimeKey, expireTime)
    end
  `,
})

/**
 * Sets the expire version for a project in Redis
 *
 * @param {string} projectId
 * @param {number} expireTime - Timestamp (ms since epoch) when the project
 *                 buffer should expire if inactive
 */
async function setExpireTime(projectId, expireTime) {
  try {
    await rclient.set_expire_time(
      keySchema.expireTime({ projectId }),
      keySchema.headVersion({ projectId }),
      expireTime.toString()
    )
    metrics.inc('chunk_store.redis.set_expire_time', 1, { status: 'success' })
  } catch (err) {
    metrics.inc('chunk_store.redis.set_expire_time', 1, { status: 'error' })
    throw err
  }
}

rclient.defineCommand('expire_project', {
  numberOfKeys: 6,
  lua: `
    local headKey = KEYS[1]
    local headVersionKey = KEYS[2]
    local changesKey = KEYS[3]
    local persistedVersionKey = KEYS[4]
    local persistTimeKey = KEYS[5]
    local expireTimeKey = KEYS[6]

    local headVersion = tonumber(redis.call('GET', headVersionKey))
    if not headVersion then
      return 'not-found'
    end

    local persistedVersion = tonumber(redis.call('GET', persistedVersionKey))
    if not persistedVersion or persistedVersion ~= headVersion then
      return 'not-persisted'
    end

    redis.call('DEL',
      headKey,
      headVersionKey,
      changesKey,
      persistedVersionKey,
      persistTimeKey,
      expireTimeKey
    )
    return 'success'
  `,
})

async function expireProject(projectId) {
  try {
    const status = await rclient.expire_project(
      keySchema.head({ projectId }),
      keySchema.headVersion({ projectId }),
      keySchema.changes({ projectId }),
      keySchema.persistedVersion({ projectId }),
      keySchema.persistTime({ projectId }),
      keySchema.expireTime({ projectId })
    )
    metrics.inc('chunk_store.redis.expire_project', 1, {
      status,
    })
    return status
  } catch (err) {
    metrics.inc('chunk_store.redis.expire_project', 1, {
      status: 'error',
    })
    throw err
  }
}

rclient.defineCommand('claim_job', {
  numberOfKeys: 1,
  lua: `
    local jobTimeKey = KEYS[1]
    local currentTime = tonumber(ARGV[1])
    local retryDelay = tonumber(ARGV[2])

    local jobTime = tonumber(redis.call('GET', jobTimeKey))
    if not jobTime then
      return {'no-job'}
    end

    local msUntilReady = jobTime - currentTime
    if msUntilReady <= 0 then
      local retryTime = currentTime + retryDelay
      redis.call('SET', jobTimeKey, retryTime)
      return {'ok', retryTime}
    else
      return {'wait', msUntilReady}
    end
  `,
})

rclient.defineCommand('close_job', {
  numberOfKeys: 1,
  lua: `
    local jobTimeKey = KEYS[1]
    local expectedJobTime = tonumber(ARGV[1])

    local jobTime = tonumber(redis.call('GET', jobTimeKey))
    if jobTime and jobTime == expectedJobTime then
      redis.call('DEL', jobTimeKey)
    end
  `,
})

/**
 * Claim an expire job
 *
 * @param {string} projectId
 * @return {Promise<Job>}
 */
async function claimExpireJob(projectId) {
  return await claimJob(keySchema.expireTime({ projectId }))
}

/**
 * Claim a persist job
 *
 * @param {string} projectId
 * @return {Promise<Job>}
 */
async function claimPersistJob(projectId) {
  return await claimJob(keySchema.persistTime({ projectId }))
}

/**
 * Claim a persist or expire job
 *
 * @param {string} jobKey - the Redis key containing the time at which the job
 *                 is ready
 * @return {Promise<Job>}
 */
async function claimJob(jobKey) {
  let result, status
  try {
    result = await rclient.claim_job(jobKey, Date.now(), RETRY_DELAY_MS)
    status = result[0]
    metrics.inc('chunk_store.redis.claim_job', 1, { status })
  } catch (err) {
    metrics.inc('chunk_store.redis.claim_job', 1, { status: 'error' })
    throw err
  }

  if (status === 'ok') {
    return new Job(jobKey, parseInt(result[1], 10))
  } else if (status === 'wait') {
    throw new JobNotReadyError('job not ready', {
      jobKey,
      retryTime: result[1],
    })
  } else if (status === 'no-job') {
    throw new JobNotFoundError('job not found', { jobKey })
  } else {
    throw new OError('unknown status for claim_job', { jobKey, status })
  }
}

/**
 * Handle for a claimed job
 */
class Job {
  /**
   * @param {string} redisKey
   * @param {number} claimTimestamp
   */
  constructor(redisKey, claimTimestamp) {
    this.redisKey = redisKey
    this.claimTimestamp = claimTimestamp
  }

  async close() {
    try {
      await rclient.close_job(this.redisKey, this.claimTimestamp.toString())
      metrics.inc('chunk_store.redis.close_job', 1, { status: 'success' })
    } catch (err) {
      metrics.inc('chunk_store.redis.close_job', 1, { status: 'error' })
      throw err
    }
  }
}

module.exports = {
  getHeadSnapshot,
  queueChanges,
  getState,
  getChangesSinceVersion,
  getNonPersistedChanges,
  setPersistedVersion,
  hardDeleteProject,
  setExpireTime,
  expireProject,
  claimExpireJob,
  claimPersistJob,
  MAX_PERSISTED_CHANGES,
  MAX_PERSIST_DELAY_MS,
  PROJECT_TTL_MS,
  RETRY_DELAY_MS,
  keySchema,
}
