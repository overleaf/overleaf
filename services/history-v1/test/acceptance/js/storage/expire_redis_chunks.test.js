'use strict'

const { expect } = require('chai')
const { promisify } = require('node:util')
const { execFile } = require('node:child_process')
const { Snapshot, Author, Change } = require('overleaf-editor-core')
const cleanup = require('./support/cleanup')
const redisBackend = require('../../../../storage/lib/chunk_store/redis')
const redis = require('../../../../storage/lib/redis')
const rclient = redis.rclientHistory
const keySchema = redisBackend.keySchema

const SCRIPT_PATH = 'storage/scripts/expire_redis_chunks.js'

async function runExpireScript() {
  const TIMEOUT = 10 * 1000 // 10 seconds
  let result
  try {
    result = await promisify(execFile)('node', [SCRIPT_PATH], {
      encoding: 'utf-8',
      timeout: TIMEOUT,
      env: {
        ...process.env,
        LOG_LEVEL: 'debug', // Override LOG_LEVEL for script output
      },
    })
    result.status = 0
  } catch (err) {
    const { stdout, stderr, code } = err
    if (typeof code !== 'number') {
      console.error('Error running expire script:', err)
      throw err
    }
    result = { stdout, stderr, status: code }
  }
  // The script might exit with status 1 if it finds no keys to process, which is ok
  if (result.status !== 0 && result.status !== 1) {
    console.error('Expire script failed:', result.stderr)
    throw new Error(`expire script failed with status ${result.status}`)
  }
  return result
}

// Helper to set up a basic project state in Redis
async function setupProjectState(
  projectId,
  {
    headVersion = 0,
    persistedVersion = null,
    expireTime = null,
    persistTime = null,
    changes = [],
  }
) {
  const headSnapshot = new Snapshot()
  await rclient.set(
    keySchema.head({ projectId }),
    JSON.stringify(headSnapshot.toRaw())
  )
  await rclient.set(
    keySchema.headVersion({ projectId }),
    headVersion.toString()
  )

  if (persistedVersion !== null) {
    await rclient.set(
      keySchema.persistedVersion({ projectId }),
      persistedVersion.toString()
    )
  }
  if (expireTime !== null) {
    await rclient.set(
      keySchema.expireTime({ projectId }),
      expireTime.toString()
    )
  }
  if (persistTime !== null) {
    await rclient.set(
      keySchema.persistTime({ projectId }),
      persistTime.toString()
    )
  }
  if (changes.length > 0) {
    const rawChanges = changes.map(c => JSON.stringify(c.toRaw()))
    await rclient.rpush(keySchema.changes({ projectId }), ...rawChanges)
  }
}

function makeChange() {
  const timestamp = new Date()
  const author = new Author(123, 'test@example.com', 'Test User')
  return new Change([], timestamp, [author])
}

describe('expire_redis_chunks script', function () {
  beforeEach(cleanup.everything)

  let now, past, future

  // Setup all projects and run the script once before tests
  beforeEach(async function () {
    now = Date.now()
    past = now - 10000 // 10 seconds ago
    future = now + 60000 // 1 minute in the future

    // Setup all project states explicitly
    await setupProjectState('expired_persisted', {
      headVersion: 2,
      persistedVersion: 2,
      expireTime: past,
    })
    await setupProjectState('expired_initial_state', {
      headVersion: 0,
      persistedVersion: 0,
      expireTime: past,
    })
    await setupProjectState('expired_persisted_with_job', {
      headVersion: 2,
      persistedVersion: 2,
      expireTime: past,
      persistTime: future,
    })
    await setupProjectState('expired_not_persisted', {
      headVersion: 3,
      persistedVersion: 2,
      expireTime: past,
      changes: [makeChange()],
    })
    await setupProjectState('expired_no_persisted_version', {
      headVersion: 1,
      persistedVersion: null,
      expireTime: past,
      changes: [makeChange()],
    })
    await setupProjectState('future_expired_persisted', {
      headVersion: 2,
      persistedVersion: 2,
      expireTime: future,
    })
    await setupProjectState('future_expired_not_persisted', {
      headVersion: 3,
      persistedVersion: 2,
      expireTime: future,
      changes: [makeChange()],
    })
    await setupProjectState('no_expire_time', {
      headVersion: 1,
      persistedVersion: 1,
      expireTime: null,
    })

    // Run the expire script once after all projects are set up
    await runExpireScript()
  })

  async function checkProjectStatus(projectId) {
    const exists =
      (await rclient.exists(keySchema.headVersion({ projectId }))) === 1
    return exists ? 'exists' : 'deleted'
  }

  it('should expire a project when expireTime is past and it is fully persisted', async function () {
    const projectId = 'expired_persisted'
    const status = await checkProjectStatus(projectId)
    expect(status).to.equal('deleted')
  })

  it('should expire a project when expireTime is past and it has no changes (initial state)', async function () {
    const projectId = 'expired_initial_state'
    const status = await checkProjectStatus(projectId)
    expect(status).to.equal('deleted')
  })

  it('should expire a project when expireTime is past and it is fully persisted even if persistTime is set', async function () {
    const projectId = 'expired_persisted_with_job'
    const status = await checkProjectStatus(projectId)
    expect(status).to.equal('deleted')
  })

  it('should not expire a project when expireTime is past but it is not fully persisted', async function () {
    const projectId = 'expired_not_persisted'
    const status = await checkProjectStatus(projectId)
    expect(status).to.equal('exists')
  })

  it('should not expire a project when expireTime is past but persistedVersion is not set', async function () {
    const projectId = 'expired_no_persisted_version'
    const status = await checkProjectStatus(projectId)
    expect(status).to.equal('exists')
  })

  it('should not expire a project when expireTime is in the future (even if fully persisted)', async function () {
    const projectId = 'future_expired_persisted'
    const status = await checkProjectStatus(projectId)
    expect(status).to.equal('exists')
  })

  it('should not expire a project when expireTime is in the future (if not fully persisted)', async function () {
    const projectId = 'future_expired_not_persisted'
    const status = await checkProjectStatus(projectId)
    expect(status).to.equal('exists')
  })

  it('should not expire a project when expireTime is not set', async function () {
    const projectId = 'no_expire_time'
    const status = await checkProjectStatus(projectId)
    expect(status).to.equal('exists')
  })
})
