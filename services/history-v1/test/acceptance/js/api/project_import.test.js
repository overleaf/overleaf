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

describe('project import', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  it('skips generating the snapshot by default', async function () {
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

    const importResponse =
      await basicAuthClient.apis.ProjectImport.importChanges1({
        project_id: projectId,
        end_version: 0,
        changes: [testChange.toRaw()],
      })

    expect(importResponse.status).to.equal(HTTPStatus.CREATED)
    expect(importResponse.obj).to.deep.equal({ resyncNeeded: false })
  })
})
