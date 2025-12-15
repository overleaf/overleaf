'use strict'

const { expect } = require('chai')
const fs = require('node:fs')
const { Readable } = require('node:stream')
const HTTPStatus = require('http-status')
const fetch = require('node-fetch')
const sinon = require('sinon')

const cleanup = require('../storage/support/cleanup')
const fixtures = require('../storage/support/fixtures')
const testFiles = require('../storage/support/test_files')

const {
  zipStore,
  BlobStore,
  persistChanges,
  redisBuffer,
  blobHash,
} = require('../../../../storage')

const { expectHttpError } = require('./support/expect_response')
const testServer = require('./support/test_server')
const { createEmptyProject } = require('./support/test_projects')

const {
  File,
  Snapshot,
  Change,
  AddFileOperation,
  EditFileOperation,
  TextOperation,
} = require('overleaf-editor-core')
const testProjects = require('./support/test_projects')
const { ObjectId } = require('mongodb')

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

  describe('blob stats', function () {
    let populatedPostgresProjectId,
      populatedMongoProjectId,
      emptyPostgresProjectId,
      emptyMongoProjectId

    async function populateProject(projectId) {
      const files = {
        [testFiles.GRAPH_PNG_HASH]: testFiles.path('graph.png'),
        [testFiles.HELLO_TXT_HASH]: testFiles.path('hello.txt'),
      }
      for (const [hash, path] of Object.entries(files)) {
        const response = await fetch(
          testServer.url(`/api/projects/${projectId}/blobs/${hash}`),
          {
            method: 'PUT',
            body: fs.createReadStream(path),
            headers: {
              Authorization: testServer.basicAuthHeader,
            },
          }
        )
        expect(response.status).to.equal(201)
      }
    }

    beforeEach(async function () {
      emptyPostgresProjectId = await testProjects.createEmptyProject()
      emptyMongoProjectId = await testProjects.createEmptyProject(
        new ObjectId().toString()
      )

      populatedPostgresProjectId = await testProjects.createEmptyProject()
      await populateProject(populatedPostgresProjectId)
      populatedMongoProjectId = await testProjects.createEmptyProject(
        new ObjectId().toString()
      )
      await populateProject(populatedMongoProjectId)
    })

    describe('getProjectBlobsStats', function () {
      it('handles empty postgres project', async function () {
        const { body } =
          await testServer.basicAuthClient.apis.Project.getProjectBlobsStats({
            body: { projectIds: [emptyPostgresProjectId] },
          })
        expect(body).to.deep.equal([
          {
            projectId: emptyPostgresProjectId,
            textBlobBytes: 0,
            binaryBlobBytes: 0,
            totalBytes: 0,
            nTextBlobs: 0,
            nBinaryBlobs: 0,
          },
        ])
      })
      it('handles populated postgres project', async function () {
        const { body } =
          await testServer.basicAuthClient.apis.Project.getProjectBlobsStats({
            body: { projectIds: [populatedPostgresProjectId] },
          })
        expect(body).to.deep.equal([
          {
            projectId: populatedPostgresProjectId,
            textBlobBytes: testFiles.HELLO_TXT_BYTE_LENGTH,
            binaryBlobBytes: testFiles.GRAPH_PNG_BYTE_LENGTH,
            totalBytes:
              testFiles.HELLO_TXT_BYTE_LENGTH + testFiles.GRAPH_PNG_BYTE_LENGTH,
            nTextBlobs: 1,
            nBinaryBlobs: 1,
          },
        ])
      })

      it('handles empty mongo project', async function () {
        const { body } =
          await testServer.basicAuthClient.apis.Project.getProjectBlobsStats({
            body: { projectIds: [emptyMongoProjectId] },
          })
        expect(body).to.deep.equal([
          {
            projectId: emptyMongoProjectId,
            textBlobBytes: 0,
            binaryBlobBytes: 0,
            totalBytes: 0,
            nTextBlobs: 0,
            nBinaryBlobs: 0,
          },
        ])
      })
      it('handles populated mongo project', async function () {
        const { body } =
          await testServer.basicAuthClient.apis.Project.getProjectBlobsStats({
            body: { projectIds: [populatedMongoProjectId] },
          })
        expect(body).to.deep.equal([
          {
            projectId: populatedMongoProjectId,
            textBlobBytes: testFiles.HELLO_TXT_BYTE_LENGTH,
            binaryBlobBytes: testFiles.GRAPH_PNG_BYTE_LENGTH,
            totalBytes:
              testFiles.HELLO_TXT_BYTE_LENGTH + testFiles.GRAPH_PNG_BYTE_LENGTH,
            nTextBlobs: 1,
            nBinaryBlobs: 1,
          },
        ])
      })

      it('handles batch of projects', async function () {
        const { body } =
          await testServer.basicAuthClient.apis.Project.getProjectBlobsStats({
            body: {
              projectIds: [
                populatedPostgresProjectId,
                populatedMongoProjectId,
                emptyPostgresProjectId,
                emptyMongoProjectId,
              ],
            },
          })
        expect(body).to.deep.equal([
          {
            projectId: populatedPostgresProjectId,
            textBlobBytes: testFiles.HELLO_TXT_BYTE_LENGTH,
            binaryBlobBytes: testFiles.GRAPH_PNG_BYTE_LENGTH,
            totalBytes:
              testFiles.HELLO_TXT_BYTE_LENGTH + testFiles.GRAPH_PNG_BYTE_LENGTH,
            nTextBlobs: 1,
            nBinaryBlobs: 1,
          },
          {
            projectId: populatedMongoProjectId,
            textBlobBytes: testFiles.HELLO_TXT_BYTE_LENGTH,
            binaryBlobBytes: testFiles.GRAPH_PNG_BYTE_LENGTH,
            totalBytes:
              testFiles.HELLO_TXT_BYTE_LENGTH + testFiles.GRAPH_PNG_BYTE_LENGTH,
            nTextBlobs: 1,
            nBinaryBlobs: 1,
          },
          {
            projectId: emptyPostgresProjectId,
            textBlobBytes: 0,
            binaryBlobBytes: 0,
            totalBytes: 0,
            nTextBlobs: 0,
            nBinaryBlobs: 0,
          },
          {
            projectId: emptyMongoProjectId,
            textBlobBytes: 0,
            binaryBlobBytes: 0,
            totalBytes: 0,
            nTextBlobs: 0,
            nBinaryBlobs: 0,
          },
        ])
      })
    })

    describe('getBlobStats', function () {
      it('handles empty list of hashes', async function () {
        const { body } =
          await testServer.basicAuthClient.apis.Project.getBlobStats({
            project_id: populatedPostgresProjectId,
            body: { blobHashes: [] },
          })
        expect(body).to.deep.equal({
          projectId: populatedPostgresProjectId,
          textBlobBytes: 0,
          binaryBlobBytes: 0,
          totalBytes: 0,
          nTextBlobs: 0,
          nBinaryBlobs: 0,
        })
      })

      it('handles a mix of text and binary blobs', async function () {
        const { body } =
          await testServer.basicAuthClient.apis.Project.getBlobStats({
            project_id: populatedPostgresProjectId,
            body: {
              blobHashes: [testFiles.HELLO_TXT_HASH, testFiles.GRAPH_PNG_HASH],
            },
          })
        expect(body).to.deep.equal({
          projectId: populatedPostgresProjectId,
          textBlobBytes: testFiles.HELLO_TXT_BYTE_LENGTH,
          binaryBlobBytes: testFiles.GRAPH_PNG_BYTE_LENGTH,
          totalBytes:
            testFiles.HELLO_TXT_BYTE_LENGTH + testFiles.GRAPH_PNG_BYTE_LENGTH,
          nTextBlobs: 1,
          nBinaryBlobs: 1,
        })
      })

      it('handles only text blobs', async function () {
        const { body } =
          await testServer.basicAuthClient.apis.Project.getBlobStats({
            project_id: populatedPostgresProjectId,
            body: {
              blobHashes: [testFiles.HELLO_TXT_HASH],
            },
          })
        expect(body).to.deep.equal({
          projectId: populatedPostgresProjectId,
          textBlobBytes: testFiles.HELLO_TXT_BYTE_LENGTH,
          binaryBlobBytes: 0,
          totalBytes: testFiles.HELLO_TXT_BYTE_LENGTH,
          nTextBlobs: 1,
          nBinaryBlobs: 0,
        })
      })

      it('handles only binary blobs', async function () {
        const { body } =
          await testServer.basicAuthClient.apis.Project.getBlobStats({
            project_id: populatedPostgresProjectId,
            body: {
              blobHashes: [testFiles.GRAPH_PNG_HASH],
            },
          })
        expect(body).to.deep.equal({
          projectId: populatedPostgresProjectId,
          textBlobBytes: 0,
          binaryBlobBytes: testFiles.GRAPH_PNG_BYTE_LENGTH,
          totalBytes: testFiles.GRAPH_PNG_BYTE_LENGTH,
          nTextBlobs: 0,
          nBinaryBlobs: 1,
        })
      })

      it('handles non-existent blobs', async function () {
        const { body } =
          await testServer.basicAuthClient.apis.Project.getBlobStats({
            project_id: populatedPostgresProjectId,
            body: {
              blobHashes: [testFiles.STRING_AB_HASH],
            },
          })
        expect(body).to.deep.equal({
          projectId: populatedPostgresProjectId,
          textBlobBytes: 0,
          binaryBlobBytes: 0,
          totalBytes: 0,
          nTextBlobs: 0,
          nBinaryBlobs: 0,
        })
      })

      it('throws an error for bad hashes', async function () {
        await expectHttpError(
          testServer.basicAuthClient.apis.Project.getBlobStats({
            project_id: populatedPostgresProjectId,
            body: {
              blobHashes: ['non-existent-hash'],
            },
          }),
          HTTPStatus.INTERNAL_SERVER_ERROR
        )
      })

      it('handles a request with a large number of blobs', async function () {
        const projectId = await testProjects.createEmptyProject()
        const blobHashes = []
        let expectedTextBytes = 0
        let expectedBinaryBytes = 0
        const nTextBlobs = 10
        const nBinaryBlobs = 10

        for (let i = 0; i < nTextBlobs; i++) {
          const content = `text blob ${i}`
          const hash = blobHash.fromString(content)
          blobHashes.push(hash)
          expectedTextBytes += content.length
          const res = await fetch(
            testServer.url(`/api/projects/${projectId}/blobs/${hash}`),
            {
              method: 'PUT',
              body: content,
              headers: { Authorization: testServer.basicAuthHeader },
            }
          )
          expect(res.status).to.equal(HTTPStatus.CREATED)
        }

        for (let i = 0; i < nBinaryBlobs; i++) {
          const content = Buffer.from([0, i, i + 1, i + 2])
          const hash = await blobHash.fromStream(
            content.length,
            Readable.from(content)
          )
          blobHashes.push(hash)
          expectedBinaryBytes += content.length
          const res = await fetch(
            testServer.url(`/api/projects/${projectId}/blobs/${hash}`),
            {
              method: 'PUT',
              body: content,
              headers: {
                Authorization: testServer.basicAuthHeader,
                'Content-Type': 'application/octet-stream',
              },
            }
          )
          expect(res.status).to.equal(HTTPStatus.CREATED)
        }

        const { body } =
          await testServer.basicAuthClient.apis.Project.getBlobStats({
            project_id: projectId,
            body: { blobHashes },
          })

        expect(body).to.deep.equal({
          projectId,
          textBlobBytes: expectedTextBytes,
          binaryBlobBytes: expectedBinaryBytes,
          totalBytes: expectedTextBytes + expectedBinaryBytes,
          nTextBlobs,
          nBinaryBlobs,
        })
      })
    })
  })

  // eslint-disable-next-line mocha/no-skipped-tests
  describe.skip('getLatestContent', function () {
    // TODO: remove this endpoint entirely, see
    // https://github.com/overleaf/write_latex/pull/5120#discussion_r244291862
  })

  describe('project with changes', function () {
    let projectId

    beforeEach(async function () {
      // used to provide a limit which forces us to persist all of the changes.
      const farFuture = new Date()
      farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
      const limits = {
        minChangeTimestamp: farFuture,
        maxChangeTimestamp: farFuture,
      }
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('ab'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('other.tex', File.fromString('hello'))],
          new Date(),
          []
        ),
      ]

      projectId = await createEmptyProject()
      await persistChanges(projectId, changes, limits, 0)
    })

    describe('getLatestHashedContent', function () {
      it('returns a snapshot', async function () {
        const response =
          await testServer.basicAuthClient.apis.Project.getLatestHashedContent({
            project_id: projectId,
          })
        expect(response.status).to.equal(HTTPStatus.OK)
        const snapshot = Snapshot.fromRaw(response.obj)
        expect(snapshot.countFiles()).to.equal(2)
        expect(snapshot.getFile('test.tex').getHash()).to.equal(
          testFiles.STRING_AB_HASH
        )
      })
    })

    describe('getChanges', function () {
      it('returns all changes when not given a limit', async function () {
        const response =
          await testServer.basicAuthClient.apis.Project.getChanges({
            project_id: projectId,
          })
        expect(response.status).to.equal(HTTPStatus.OK)
        const { changes, hasMore } = response.obj
        expect(changes.length).to.equal(2)
        const filenames = changes
          .flatMap(change => change.operations)
          .map(operation => operation.pathname)
        expect(filenames).to.deep.equal(['test.tex', 'other.tex'])
        expect(hasMore).to.be.false
      })

      it('returns only requested changes', async function () {
        const response =
          await testServer.basicAuthClient.apis.Project.getChanges({
            project_id: projectId,
            since: 1,
          })
        expect(response.status).to.equal(HTTPStatus.OK)
        const { changes, hasMore } = response.obj
        expect(changes.length).to.equal(1)
        const filenames = changes
          .flatMap(change => change.operations)
          .map(operation => operation.pathname)
        expect(filenames).to.deep.equal(['other.tex'])
        expect(hasMore).to.be.false
      })

      it('rejects negative versions', async function () {
        await expect(
          testServer.basicAuthClient.apis.Project.getChanges({
            project_id: projectId,
            since: -1,
          })
        ).to.be.rejectedWith('request failed with status 400')
      })

      it('rejects out of bounds versions', async function () {
        await expect(
          testServer.basicAuthClient.apis.Project.getChanges({
            project_id: projectId,
            since: 20,
          })
        ).to.be.rejectedWith('request failed with status 400')
      })
    })

    describe('project with many chunks', function () {
      let projectId, changes

      beforeEach(async function () {
        // used to provide a limit which forces us to persist all of the changes.
        const farFuture = new Date()
        farFuture.setTime(farFuture.getTime() + 7 * 24 * 3600 * 1000)
        const limits = {
          minChangeTimestamp: farFuture,
          maxChangeTimestamp: farFuture,
          maxChunkChanges: 5,
        }
        projectId = await createEmptyProject()
        const blobStore = new BlobStore(projectId)
        const blob = await blobStore.putString('')
        changes = [
          new Change(
            [new AddFileOperation('test.tex', File.createLazyFromBlobs(blob))],
            new Date(),
            []
          ),
        ]

        for (let i = 0; i < 20; i++) {
          const textOperation = new TextOperation()
          textOperation.retain(i)
          textOperation.insert('x')
          changes.push(
            new Change(
              [new EditFileOperation('test.tex', textOperation)],
              new Date(),
              []
            )
          )
        }

        await persistChanges(projectId, changes, limits, 0)
      })

      it('returns the first chunk when not given a limit', async function () {
        const response =
          await testServer.basicAuthClient.apis.Project.getChanges({
            project_id: projectId,
          })

        expect(response.status).to.equal(HTTPStatus.OK)
        expect(response.obj).to.deep.equal({
          changes: changes.slice(0, 5).map(c => c.toRaw()),
          hasMore: true,
        })
      })

      it('returns only requested changes', async function () {
        const response =
          await testServer.basicAuthClient.apis.Project.getChanges({
            project_id: projectId,
            since: 12,
          })
        expect(response.status).to.equal(HTTPStatus.OK)
        expect(response.obj).to.deep.equal({
          changes: changes.slice(12, 15).map(c => c.toRaw()),
          hasMore: true,
        })
      })

      it('returns changes in the latest chunk', async function () {
        const response =
          await testServer.basicAuthClient.apis.Project.getChanges({
            project_id: projectId,
            since: 20,
          })
        expect(response.status).to.equal(HTTPStatus.OK)
        expect(response.obj).to.deep.equal({
          changes: changes.slice(20).map(c => c.toRaw()),
          hasMore: false,
        })
      })
    })
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

    it('deletes the project from the redis buffer', async function () {
      const projectId = await createEmptyProject()
      const blobStore = new BlobStore(projectId)
      const blob = await blobStore.putString('this is a test')
      const snapshot = new Snapshot()
      const change = new Change(
        [new AddFileOperation('test.tex', File.createLazyFromBlobs(blob))],
        new Date(),
        []
      )

      await redisBuffer.queueChanges(projectId, snapshot, 0, [change])
      const changesBefore = await redisBuffer.getNonPersistedChanges(
        projectId,
        0
      )
      expect(changesBefore.length).to.equal(1)

      const deleteResponse =
        await testServer.basicAuthClient.apis.Project.deleteProject({
          project_id: projectId,
        })
      expect(deleteResponse.status).to.equal(HTTPStatus.NO_CONTENT)

      const changesAfter = await redisBuffer.getNonPersistedChanges(
        projectId,
        0
      )
      expect(changesAfter.length).to.equal(0)

      const finalState = await redisBuffer.getState(projectId)
      expect(finalState).to.deep.equal({
        changes: [],
        expireTime: null,
        headSnapshot: null,
        headVersion: null,
        persistTime: null,
        persistedVersion: null,
      })
    })

    it('deletes an empty project from the redis buffer', async function () {
      const projectId = await createEmptyProject()
      const deleteResponse =
        await testServer.basicAuthClient.apis.Project.deleteProject({
          project_id: projectId,
        })
      expect(deleteResponse.status).to.equal(HTTPStatus.NO_CONTENT)
      const changesAfter = await redisBuffer.getNonPersistedChanges(
        projectId,
        0
      )
      expect(changesAfter.length).to.equal(0)
    })
  })
})
