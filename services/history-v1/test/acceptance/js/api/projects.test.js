'use strict'

const { expect } = require('chai')
const fs = require('node:fs')
const HTTPStatus = require('http-status')
const fetch = require('node-fetch')
const sinon = require('sinon')

const cleanup = require('../storage/support/cleanup')
const fixtures = require('../storage/support/fixtures')
const testFiles = require('../storage/support/test_files')

const { zipStore, persistChanges } = require('../../../../storage')

const { expectHttpError } = require('./support/expect_response')
const testServer = require('./support/test_server')
const { createEmptyProject } = require('./support/test_projects')

const {
  File,
  Snapshot,
  Change,
  AddFileOperation,
} = require('overleaf-editor-core')
const testProjects = require('./support/test_projects')

describe('project controller', function () {
  beforeEach(cleanup.everything)
  beforeEach(fixtures.create)

  describe('initializeProject', function () {
    it('can initialize a new project', async function () {
      const projectId = await testProjects.createEmptyProject()
      expect(projectId).to.be.a('string')
    })
  })

  describe('createZip', function () {
    let importSnapshot
    let createZip

    before(function () {
      importSnapshot =
        testServer.basicAuthClient.apis.ProjectImport.importSnapshot1
      createZip = testServer.basicAuthClient.apis.Project.createZip
    })

    beforeEach(function () {
      // Don't start the work in the background in this test --- it is flaky.
      sinon.stub(zipStore, 'storeZip').resolves()
    })
    afterEach(function () {
      zipStore.storeZip.restore()
    })

    it('creates a URL to a zip file', async function () {
      // Create a test blob.
      const testProjectId = fixtures.docs.uninitializedProject.id
      const response = await fetch(
        testServer.url(
          `/api/projects/${testProjectId}/blobs/${testFiles.HELLO_TXT_HASH}`
        ),
        {
          method: 'PUT',
          body: fs.createReadStream(testFiles.path('hello.txt')),
          headers: {
            Authorization: testServer.basicAuthHeader,
          },
        }
      )
      expect(response.ok).to.be.true

      // Import a project with the test blob.
      const testFilePathname = 'hello.txt'
      const testSnapshot = new Snapshot()
      testSnapshot.addFile(
        testFilePathname,
        File.fromHash(testFiles.HELLO_TXT_HASH)
      )

      const importResponse = await importSnapshot({
        project_id: testProjectId,
        snapshot: testSnapshot.toRaw(),
      })
      expect(importResponse.obj.projectId).to.equal(testProjectId)

      const createZipResponse = await createZip({
        project_id: testProjectId,
        version: 0,
      })
      expect(createZipResponse.status).to.equal(HTTPStatus.OK)
      const zipInfo = createZipResponse.obj
      expect(zipInfo.zipUrl).to.match(
        /^http:\/\/gcs:9090\/download\/storage\/v1\/b\/overleaf-test-zips/
      )
      expect(zipStore.storeZip.calledOnce).to.be.true
    })
  })

  // eslint-disable-next-line mocha/no-skipped-tests
  describe.skip('getLatestContent', function () {
    // TODO: remove this endpoint entirely, see
    // https://github.com/overleaf/write_latex/pull/5120#discussion_r244291862
  })

  describe('getLatestHashedContent', function () {
    let limitsToPersistImmediately

    before(function () {
      // used to provide a limit which forces us to persist all of the changes.
      const farFuture = new Date()
      farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
      limitsToPersistImmediately = {
        minChangeTimestamp: farFuture,
        maxChangeTimestamp: farFuture,
      }
    })

    it('returns a snaphot', async function () {
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('ab'))],
          new Date(),
          []
        ),
      ]

      const projectId = await createEmptyProject()
      await persistChanges(projectId, changes, limitsToPersistImmediately, 0)
      const response =
        await testServer.basicAuthClient.apis.Project.getLatestHashedContent({
          project_id: projectId,
        })
      expect(response.status).to.equal(HTTPStatus.OK)
      const snapshot = Snapshot.fromRaw(response.obj)
      expect(snapshot.countFiles()).to.equal(1)
      expect(snapshot.getFile('test.tex').getHash()).to.equal(
        testFiles.STRING_AB_HASH
      )
    })
    describe('getLatestHistoryRaw', function () {
      it('should handles read', async function () {
        const projectId = fixtures.docs.initializedProject.id
        const response =
          await testServer.pseudoJwtBasicAuthClient.apis.Project.getLatestHistoryRaw(
            {
              project_id: projectId,
              readOnly: 'true',
            }
          )
        expect(response.body).to.deep.equal({
          startVersion: 0,
          endVersion: 1,
          endTimestamp: '2032-01-01T00:00:00.000Z',
        })
      })
    })
  })

  describe('deleteProject', function () {
    it('deletes the project chunks', async function () {
      const projectId = fixtures.docs.initializedProject.id
      const historyResponse =
        await testServer.pseudoJwtBasicAuthClient.apis.Project.getLatestHistory(
          {
            project_id: projectId,
          }
        )
      expect(historyResponse.status).to.equal(HTTPStatus.OK)
      expect(historyResponse.body).to.have.property('chunk')
      const deleteResponse =
        await testServer.basicAuthClient.apis.Project.deleteProject({
          project_id: projectId,
        })
      expect(deleteResponse.status).to.equal(HTTPStatus.NO_CONTENT)
      await expectHttpError(
        testServer.pseudoJwtBasicAuthClient.apis.Project.getLatestHistory({
          project_id: projectId,
        }),
        HTTPStatus.NOT_FOUND
      )
    })

    it('deletes the project blobs', async function () {
      const projectId = fixtures.docs.initializedProject.id
      const token = testServer.createTokenForProject(projectId)
      const authHeaders = { Authorization: `Bearer ${token}` }
      const hash = testFiles.HELLO_TXT_HASH
      const fileContents = await fs.promises.readFile(
        testFiles.path('hello.txt')
      )
      const blobUrl = testServer.url(`/api/projects/${projectId}/blobs/${hash}`)
      const response1 = await fetch(blobUrl, {
        method: 'PUT',
        headers: authHeaders,
        body: fileContents,
      })
      expect(response1.ok).to.be.true
      const response2 = await fetch(blobUrl, { headers: authHeaders })
      const payload = await response2.text()
      expect(payload).to.equal(fileContents.toString())
      const deleteResponse =
        await testServer.basicAuthClient.apis.Project.deleteProject({
          project_id: projectId,
        })
      expect(deleteResponse.status).to.equal(HTTPStatus.NO_CONTENT)
      const response3 = await fetch(blobUrl, { headers: authHeaders })
      expect(response3.status).to.equal(HTTPStatus.NOT_FOUND)
    })
  })
})
