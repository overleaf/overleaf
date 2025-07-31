'use strict'

const BPromise = require('bluebird')
const { expect } = require('chai')
const HTTPStatus = require('http-status')
const fetch = require('node-fetch')
const fs = BPromise.promisifyAll(require('node:fs'))

const cleanup = require('../storage/support/cleanup')
const fixtures = require('../storage/support/fixtures')
const testFiles = require('../storage/support/test_files')
const testProjects = require('./support/test_projects')
const testServer = require('./support/test_server')

const { Change, File, Operation } = require('overleaf-editor-core')
const queueChanges = require('../../../../storage/lib/queue_changes')
const { getState } = require('../../../../storage/lib/chunk_store/redis')

describe('project expiry', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  it('expire redis buffer', async function () {
    const basicAuthClient = testServer.basicAuthClient
    const projectId = await testProjects.createEmptyProject()

    // upload an empty file
    const response = await fetch(
      testServer.url(
        `/api/projects/${projectId}/blobs/${File.EMPTY_FILE_HASH}`,
        { qs: { pathname: 'main.tex' } }
      ),
      {
        method: 'PUT',
        body: fs.createReadStream(testFiles.path('empty.tex')),
        headers: {
          Authorization: testServer.basicAuthHeader,
        },
      }
    )
    expect(response.ok).to.be.true

    const testFile = File.fromHash(File.EMPTY_FILE_HASH)
    const testChange = new Change(
      [Operation.addFile('main.tex', testFile)],
      new Date()
    )
    await queueChanges(projectId, [testChange], 0)

    // Verify that the changes are queued and not yet persisted
    const initialState = await getState(projectId)
    expect(initialState.persistedVersion).to.be.null
    expect(initialState.changes).to.have.lengthOf(1)

    const importResponse =
      await basicAuthClient.apis.ProjectImport.flushChanges({
        project_id: projectId,
      })

    expect(importResponse.status).to.equal(HTTPStatus.OK)

    // Verify that the changes were persisted to the chunk store
    const flushedState = await getState(projectId)
    expect(flushedState.persistedVersion).to.equal(1)

    const expireResponse =
      await basicAuthClient.apis.ProjectImport.expireProject({
        project_id: projectId,
      })
    expect(expireResponse.status).to.equal(HTTPStatus.OK)

    const finalState = await getState(projectId)
    expect(finalState).to.deep.equal({
      changes: [],
      expireTime: null,
      headSnapshot: null,
      headVersion: null,
      persistTime: null,
      persistedVersion: null,
    })
  })
})
