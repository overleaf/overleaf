'use strict'

const { expect } = require('chai')

const cleanup = require('../storage/support/cleanup')
const fixtures = require('../storage/support/fixtures')
const testServer = require('./support/test_server')
const testProjects = require('./support/test_projects')

const core = require('overleaf-editor-core')
const Change = core.Change
const File = core.File
const Operation = core.Operation

const { blobHashFromString } = require('overleaf-editor-core/lib/blob_utils')
const persistChanges = require('../../../../storage/lib/persist_changes')

describe('project hashed content', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  let basicAuthClient
  let limitsToPersistImmediately

  before(async function () {
    basicAuthClient = testServer.basicAuthClient

    const farFuture = new Date()
    farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
    limitsToPersistImmediately = {
      minChangeTimestamp: farFuture,
      maxChangeTimestamp: farFuture,
      maxChanges: 10,
      maxChunkChanges: 10,
    }
  })

  it('hashes a file that carries tracked changes', async function () {
    // A file with tracked changes keeps its ranges in a second blob, which it needs
    // alongside its content both to be read back and to be hashed again.
    const projectId = await testProjects.createEmptyProject()
    const content = 'the quick brown fox'
    const change = new Change(
      [
        Operation.addFile(
          'tracked.tex',
          File.fromRaw({
            content,
            trackedChanges: [
              {
                range: { pos: 4, length: 'quick '.length },
                tracking: {
                  type: 'delete',
                  ts: '2024-01-01T00:00:00.000Z',
                  userId: 'user1',
                },
              },
            ],
          })
        ),
      ],
      new Date(),
      []
    )
    await persistChanges(projectId, [change], limitsToPersistImmediately, 0)

    const response = await basicAuthClient.apis.Project.getLatestHashedContent({
      project_id: projectId,
    })

    expect(response.status).to.equal(200)
    const file = response.obj.files['tracked.tex']
    // The content is hashed as it stands, tracked delete included, and the ranges
    // are hashed separately.
    expect(file.hash).to.equal(blobHashFromString(content))
    expect(file.rangesHash).to.match(/^[0-9a-f]{40}$/)
  })

  it('hashes a file that carries no ranges', async function () {
    const projectId = await testProjects.createEmptyProject()
    const content = 'hello world'
    const change = new Change(
      [Operation.addFile('main.tex', File.fromString(content))],
      new Date(),
      []
    )
    await persistChanges(projectId, [change], limitsToPersistImmediately, 0)

    const response = await basicAuthClient.apis.Project.getLatestHashedContent({
      project_id: projectId,
    })

    expect(response.status).to.equal(200)
    const file = response.obj.files['main.tex']
    expect(file.hash).to.equal(blobHashFromString(content))
    expect(file.rangesHash).to.be.undefined
  })
})
