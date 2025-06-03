'use strict'

const { expect } = require('chai')
const { Author, Change } = require('overleaf-editor-core')
const cleanup = require('./support/cleanup')
const { setupProjectState, rclient, keySchema } = require('./support/redis')
const { runScript } = require('./support/runscript')

const SCRIPT_PATH = 'storage/scripts/expire_redis_chunks.js'

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
    await runScript(SCRIPT_PATH)
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
