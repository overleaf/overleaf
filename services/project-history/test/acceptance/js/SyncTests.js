import nock from 'nock'
import { expect } from 'chai'
import assert from 'node:assert'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import {
  Snapshot,
  File,
  FileMap,
  StringFileData,
  Change,
} from 'overleaf-editor-core'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
import sinon from 'sinon'
import { getFailure } from './helpers/ProjectHistoryClient.js'
import { fetchNothing, RequestFailedError } from '@overleaf/fetch-utils'
import { _getBlobHashFromString } from '../../../app/js/HashManager.js'
import { db, ObjectId } from '../../../app/js/mongodb.js'

const EMPTY_FILE_HASH = File.EMPTY_FILE_HASH

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockFileStore = () => nock('http://127.0.0.1:3009')
const MockWeb = () => nock('http://127.0.0.1:3000')

describe('Syncing with web and doc-updater', function () {
  const historyId = new ObjectId().toString()
  let loggerWarn, loggerError
  beforeEach(function () {
    loggerWarn = sinon.spy(logger, 'warn')
    loggerError = sinon.spy(logger, 'error')
  })
  afterEach(function () {
    loggerWarn.restore()
    loggerError.restore()
  })

  beforeEach(async function () {
    this.timestamp = new Date()

    await ProjectHistoryApp.ensureRunning()
    this.project_id = new ObjectId().toString()
    this.doc_id = new ObjectId().toString()
    this.file_id = new ObjectId().toString()

    await db.projects.insertOne({ _id: new ObjectId(this.project_id) })

    MockHistoryStore().post('/api/projects').reply(200, {
      projectId: historyId,
    })
    MockWeb()
      .get(`/project/${this.project_id}/details`)
      .reply(200, {
        name: 'Test Project',
        overleaf: {
          history: {
            id: historyId,
          },
        },
      })
    await ProjectHistoryClient.initializeProject(historyId)
  })

  afterEach(function () {
    nock.cleanAll()
  })

  describe('resyncing project history', function () {
    describe('without project-history enabled', function () {
      beforeEach(function () {
        MockWeb().post(`/project/${this.project_id}/history/resync`).reply(404)
      })

      it('404s if project-history is not enabled', async function () {
        try {
          await fetchNothing(
            `http://127.0.0.1:3054/project/${this.project_id}/resync`,
            {
              method: 'POST',
            }
          )
        } catch (error) {
          if (error instanceof RequestFailedError) {
            expect(error.response.status).to.equal(404)
          } else {
            throw error
          }
        }
      })
    })

    describe('with project-history enabled', function () {
      beforeEach(function () {
        MockWeb().post(`/project/${this.project_id}/history/resync`).reply(204)
      })

      describe('when a doc is missing', function () {
        it('should send add doc updates to the history store', async function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      persistedDoc: { hash: EMPTY_FILE_HASH, stringLength: 0 },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          MockHistoryStore()
            .get(`/api/projects/${historyId}/blobs/${EMPTY_FILE_HASH}`)
            .reply(200, '')

          const createBlob = MockHistoryStore()
            .put(`/api/projects/${historyId}/blobs/${EMPTY_FILE_HASH}`, '')
            .reply(201)

          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      file: {
                        hash: EMPTY_FILE_HASH,
                      },
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [
                { path: '/main.tex', doc: this.doc_id },
                { path: '/persistedDoc', doc: 'other-doc-id' },
              ],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update)

          // The resync stays pending: this test only queues the structure
          // update, not the resyncDocContent updates it asks for.
          const res = await ProjectHistoryClient.flushProject(this.project_id, {
            allowErrors: true,
          })
          expect(res.statusCode).to.equal(409)

          assert(
            createBlob.isDone(),
            '/api/projects/:historyId/blobs/:hash should have been called'
          )
          assert(
            addFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })
      })

      describe('when a file is missing', function () {
        it('should send add file updates to the history store', async function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      persistedFile: { hash: EMPTY_FILE_HASH, byteLength: 0 },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          const fileContents = Buffer.from([1, 2, 3])
          const fileHash = 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74'

          MockFileStore()
            .get(`/project/${this.project_id}/file/${this.file_id}`)
            .reply(200, fileContents)
          const headBlob = MockHistoryStore()
            .head(`/api/projects/${historyId}/blobs/${fileHash}`)
            .reply(404)
          const createBlob = MockHistoryStore()
            .put(`/api/projects/${historyId}/blobs/${fileHash}`, fileContents)
            .reply(201)

          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'test.png',
                      file: {
                        hash: fileHash,
                      },
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [],
              files: [
                {
                  file: this.file_id,
                  path: '/test.png',
                  _hash: fileHash,
                  url: `http://127.0.0.1:3009/project/${this.project_id}/file/${this.file_id}`,
                },
                { path: '/persistedFile' },
              ],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(!loggerWarn.called, 'no warning logged on 404')
          assert(
            headBlob.isDone(),
            'HEAD /api/projects/:historyId/blobs/:hash should have been called'
          )
          assert(
            createBlob.isDone(),
            '/api/projects/:historyId/blobs/:hash should have been called'
          )
          assert(
            addFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })
        it('should skip HEAD on blob without hash', async function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      persistedFile: { hash: EMPTY_FILE_HASH, byteLength: 0 },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          const fileContents = Buffer.from([1, 2, 3])
          const fileHash = 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74'

          MockFileStore()
            .get(`/project/${this.project_id}/file/${this.file_id}`)
            .reply(200, fileContents)
          const headBlob = MockHistoryStore()
            .head(`/api/projects/${historyId}/blobs/undefined`)
            .reply(500)
          const createBlob = MockHistoryStore()
            .put(`/api/projects/${historyId}/blobs/${fileHash}`, fileContents)
            .reply(201)

          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'test.png',
                      file: {
                        hash: fileHash,
                      },
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [],
              files: [
                {
                  file: this.file_id,
                  path: '/test.png',
                  url: `http://127.0.0.1:3009/project/${this.project_id}/file/${this.file_id}`,
                },
                { path: '/persistedFile' },
              ],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(!loggerWarn.called, 'no warning logged on 404')
          assert(
            !headBlob.isDone(),
            'HEAD /api/projects/:historyId/blobs/:hash should have been skipped'
          )
          assert(
            createBlob.isDone(),
            '/api/projects/:historyId/blobs/:hash should have been called'
          )
          assert(
            addFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })
        it('should record error when checking blob fails with 500', async function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      persistedFile: { hash: EMPTY_FILE_HASH, byteLength: 0 },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          const fileContents = Buffer.from([1, 2, 3])
          const fileHash = 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74'

          MockFileStore()
            .get(`/project/${this.project_id}/file/${this.file_id}`)
            .reply(200, fileContents)
          const headBlob = MockHistoryStore()
            .head(`/api/projects/${historyId}/blobs/${fileHash}`)
            .reply(500)
          const createBlob = MockHistoryStore()
            .put(`/api/projects/${historyId}/blobs/${fileHash}`, fileContents)
            .reply(201)

          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'test.png',
                      file: {
                        hash: fileHash,
                      },
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [],
              files: [
                {
                  file: this.file_id,
                  path: '/test.png',
                  _hash: fileHash,
                  url: `http://127.0.0.1:3009/project/${this.project_id}/file/${this.file_id}`,
                },
                { path: '/persistedFile' },
              ],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update)

          const res = await ProjectHistoryClient.flushProject(this.project_id, {
            allowErrors: true,
          })
          assert(res.statusCode === 500, 'resync should have failed')

          assert(
            loggerError.calledWithMatch(
              sinon.match.any,
              'error checking whether blob exists'
            ),
            'error logged on 500'
          )
          assert(
            headBlob.isDone(),
            'HEAD /api/projects/:historyId/blobs/:hash should have been called'
          )
          assert(
            !createBlob.isDone(),
            '/api/projects/:historyId/blobs/:hash should have been skipped'
          )
          assert(
            !addFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been skipped`
          )
        })
        it('should skip blob write when blob exists', async function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      persistedFile: { hash: EMPTY_FILE_HASH, byteLength: 0 },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          const fileContents = Buffer.from([1, 2, 3])
          const fileHash = 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74'

          MockFileStore()
            .get(`/project/${this.project_id}/file/${this.file_id}`)
            .reply(200, fileContents)
          const headBlob = MockHistoryStore()
            .head(`/api/projects/${historyId}/blobs/${fileHash}`)
            .reply(200)
          const createBlob = MockHistoryStore()
            .put(`/api/projects/${historyId}/blobs/${fileHash}`, fileContents)
            .reply(201)

          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'test.png',
                      file: {
                        hash: fileHash,
                      },
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [],
              files: [
                {
                  file: this.file_id,
                  path: '/test.png',
                  _hash: fileHash,
                  url: `http://127.0.0.1:3009/project/${this.project_id}/file/${this.file_id}`,
                },
                { path: '/persistedFile' },
              ],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(!loggerWarn.called, 'no warning logged on 404')
          assert(
            headBlob.isDone(),
            'HEAD /api/projects/:historyId/blobs/:hash should have been called'
          )
          assert(
            !createBlob.isDone(),
            '/api/projects/:historyId/blobs/:hash should have been skipped'
          )
          assert(
            addFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })
        it('should add file w/o url', async function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      persistedFile: { hash: EMPTY_FILE_HASH, byteLength: 0 },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          const fileContents = Buffer.from([1, 2, 3])
          const fileHash = 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74'

          MockFileStore()
            .get(`/project/${this.project_id}/file/${this.file_id}`)
            .reply(200, fileContents)
          const headBlob = MockHistoryStore()
            .head(`/api/projects/${historyId}/blobs/${fileHash}`)
            .reply(200)
          const createBlob = MockHistoryStore()
            .put(`/api/projects/${historyId}/blobs/${fileHash}`, fileContents)
            .reply(201)

          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'test.png',
                      file: {
                        hash: fileHash,
                      },
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [],
              files: [
                {
                  file: this.file_id,
                  path: '/test.png',
                  _hash: fileHash,
                  createdBlob: true,
                },
                { path: '/persistedFile' },
              ],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(!loggerWarn.called, 'no warning logged on 404')
          assert(
            headBlob.isDone(),
            'HEAD /api/projects/:historyId/blobs/:hash should have been called'
          )
          assert(
            !createBlob.isDone(),
            '/api/projects/:historyId/blobs/:hash should have been skipped'
          )
          assert(
            addFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })
        describe('with filestore disabled', function () {
          before(function () {
            Settings.apis.filestore.enabled = false
          })
          after(function () {
            Settings.apis.filestore.enabled = true
          })
          it('should record error when blob is missing', async function () {
            MockHistoryStore()
              .get(`/api/projects/${historyId}/latest/history`)
              .reply(200, {
                chunk: {
                  history: {
                    snapshot: {
                      files: {
                        persistedFile: { hash: EMPTY_FILE_HASH, byteLength: 0 },
                      },
                    },
                    changes: [],
                  },
                  startVersion: 0,
                },
              })

            const fileContents = Buffer.from([1, 2, 3])
            const fileHash = 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74'

            MockFileStore()
              .get(`/project/${this.project_id}/file/${this.file_id}`)
              .reply(200, fileContents)
            const headBlob = MockHistoryStore()
              .head(`/api/projects/${historyId}/blobs/${fileHash}`)
              .times(3) // three retries
              .reply(404)
            const createBlob = MockHistoryStore()
              .put(`/api/projects/${historyId}/blobs/${fileHash}`, fileContents)
              .reply(201)

            const addFile = MockHistoryStore()
              .post(`/api/projects/${historyId}/legacy_changes`, body => {
                expect(body).to.deep.equal([
                  {
                    v2Authors: [],
                    authors: [],
                    timestamp: this.timestamp.toJSON(),
                    operations: [
                      {
                        pathname: 'test.png',
                        file: {
                          hash: fileHash,
                        },
                      },
                    ],
                    origin: { kind: 'test-origin' },
                  },
                ])
                return true
              })
              .query({ end_version: 0 })
              .reply(204)

            await ProjectHistoryClient.resyncHistory(this.project_id)

            const update = {
              projectHistoryId: historyId,
              resyncProjectStructure: {
                docs: [],
                files: [
                  {
                    file: this.file_id,
                    path: '/test.png',
                    _hash: fileHash,
                    url: `http://127.0.0.1:3009/project/${this.project_id}/file/${this.file_id}`,
                  },
                  { path: '/persistedFile' },
                ],
              },
              meta: {
                ts: this.timestamp,
              },
            }
            await ProjectHistoryClient.pushRawUpdate(this.project_id, update)

            const res = await ProjectHistoryClient.flushProject(
              this.project_id,
              {
                allowErrors: true,
              }
            )
            assert(res.statusCode === 500, 'resync should have failed')

            assert(
              loggerError.calledWithMatch(
                sinon.match.any,
                'blocking filestore read'
              ),
              'error logged on 500'
            )
            assert(
              headBlob.isDone(),
              'HEAD /api/projects/:historyId/blobs/:hash should have been called'
            )
            assert(
              !createBlob.isDone(),
              '/api/projects/:historyId/blobs/:hash should have been skipped'
            )
            assert(
              !addFile.isDone(),
              `/api/projects/${historyId}/legacy_changes should have been skipped`
            )
          })
        })
      })

      describe('when a file hash mismatches', function () {
        it('should remove and re-add file w/o url', async function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      'test.png': { hash: EMPTY_FILE_HASH, byteLength: 0 },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          const fileContents = Buffer.from([1, 2, 3])
          const fileHash = 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74'

          MockFileStore()
            .get(`/project/${this.project_id}/file/${this.file_id}`)
            .reply(200, fileContents)
          const headBlob = MockHistoryStore()
            .head(`/api/projects/${historyId}/blobs/${fileHash}`)
            .reply(200)
          const createBlob = MockHistoryStore()
            .put(`/api/projects/${historyId}/blobs/${fileHash}`, fileContents)
            .reply(201)

          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'test.png',
                      newPathname: '',
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'test.png',
                      file: {
                        hash: fileHash,
                      },
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [],
              files: [
                {
                  file: this.file_id,
                  path: '/test.png',
                  _hash: fileHash,
                  createdBlob: true,
                },
              ],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(!loggerWarn.called, 'no warning logged on 404')
          assert(
            headBlob.isDone(),
            'HEAD /api/projects/:historyId/blobs/:hash should have been called'
          )
          assert(
            !createBlob.isDone(),
            '/api/projects/:historyId/blobs/:hash should have been skipped'
          )
          assert(
            addFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })
      })

      describe("when a file exists which shouldn't", function () {
        it('should send remove file updates to the history store', async function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      docToKeep: { hash: EMPTY_FILE_HASH, stringLength: 0 },
                      docToDelete: { hash: EMPTY_FILE_HASH, stringLength: 0 },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          MockHistoryStore()
            .get(`/api/projects/${historyId}/blobs/${EMPTY_FILE_HASH}`)
            .reply(200, '')
            .get(`/api/projects/${historyId}/blobs/${EMPTY_FILE_HASH}`)
            .reply(200, '') // blob is requested once for each file

          const deleteFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'docToDelete',
                      newPathname: '',
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: 'docToKeep' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update)

          // The resync stays pending: this test only queues the structure
          // update, not the resyncDocContent updates it asks for.
          const res = await ProjectHistoryClient.flushProject(this.project_id, {
            allowErrors: true,
          })
          expect(res.statusCode).to.equal(409)

          assert(
            deleteFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })
      })

      describe("when a doc's contents is not up to date", function () {
        beforeEach(function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      'main.tex': {
                        hash: '0a207c060e61f3b88eaee0a8cd0696f46fb155eb',
                        stringLength: 3,
                      },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          MockHistoryStore()
            .get(
              `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
            )
            .reply(200, 'a\nb')
        })

        it('should send test updates to the history store', async function () {
          const beforeResync = new Date()
          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [3, '\nc'],
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb\nc',
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            addFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )

          const project = await db.projects.findOne({
            _id: new ObjectId(this.project_id),
          })
          assert(
            project.overleaf.history.lastResyncedAt > beforeResync,
            'lastResyncedAt should have been updated when resync finished'
          )
        })

        it('should strip non-BMP characters in updates before sending to the history store', async function () {
          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [3, '\n\uFFFD\uFFFDc'],
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb\n\uD800\uDC00c',
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            addFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })

        it('should add comments in the history store', async function () {
          const commentId = 'comment-id'
          const addComment = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      commentId,
                      ranges: [{ pos: 1, length: 10 }],
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb',
              ranges: {
                comments: [
                  {
                    id: commentId,
                    op: {
                      c: 'a',
                      p: 0,
                      hpos: 1,
                      hlen: 10,
                      t: commentId,
                    },
                    meta: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                ],
              },
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            addComment.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })

        it('should add comments in the history store (history-ot)', async function () {
          const commentId = 'comment-id'
          const addComment = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      commentId,
                      ranges: [{ pos: 1, length: 10 }],
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb',
              historyOTRanges: {
                comments: [
                  {
                    id: commentId,
                    ranges: [
                      {
                        pos: 1,
                        length: 10,
                      },
                    ],
                  },
                ],
              },
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            addComment.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })

        it('should add tracked changes in the history store', async function () {
          const fixTrackedChange = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        {
                          r: 1,
                          tracking: {
                            ts: this.timestamp.toJSON(),
                            type: 'delete',
                            userId: 'user-id',
                          },
                        },
                        {
                          r: 1,
                          tracking: {
                            ts: this.timestamp.toJSON(),
                            type: 'insert',
                            userId: 'user-id',
                          },
                        },
                        1,
                      ],
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb',
              ranges: {
                changes: [
                  {
                    id: 'id1',
                    op: {
                      d: 'a',
                      p: 0,
                    },
                    metadata: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                  {
                    id: 'id2',
                    op: {
                      i: '\n',
                      p: 0,
                      hpos: 1,
                    },
                    metadata: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                ],
              },
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            fixTrackedChange.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })

        it('should add tracked changes in the history store (history-ot)', async function () {
          const fixTrackedChange = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        {
                          r: 1,
                          tracking: {
                            ts: this.timestamp.toJSON(),
                            type: 'delete',
                            userId: 'user-id',
                          },
                        },
                        {
                          r: 1,
                          tracking: {
                            ts: this.timestamp.toJSON(),
                            type: 'insert',
                            userId: 'user-id',
                          },
                        },
                        1,
                      ],
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb',
              historyOTRanges: {
                trackedChanges: [
                  {
                    range: { pos: 0, length: 1 },
                    tracking: {
                      ts: this.timestamp.toJSON(),
                      type: 'delete',
                      userId: 'user-id',
                    },
                  },
                  {
                    range: { pos: 1, length: 1 },
                    tracking: {
                      ts: this.timestamp.toJSON(),
                      type: 'insert',
                      userId: 'user-id',
                    },
                  },
                ],
              },
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            fixTrackedChange.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })
      })

      describe("when a doc's blob content is corrupted", function () {
        beforeEach(function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      'main.tex': {
                        hash: '0a207c060e61f3b88eaee0a8cd0696f46fb155eb',
                        stringLength: 10,
                      },
                    },
                  },
                  changes: [
                    {
                      operations: [
                        {
                          pathname: 'main.tex',
                          // Retain 10 chars, but blob content is only 3 chars.
                          // This simulates a corrupted history where the
                          // operation doesn't match the blob content, causing
                          // an ApplyError when the file is loaded eagerly.
                          textOperation: [10],
                        },
                      ],
                      timestamp: '2026-01-01T00:00:00.000Z',
                      authors: [],
                      v2Authors: [],
                    },
                  ],
                },
                startVersion: 0,
              },
            })

          // Blob returns valid content, but it doesn't match the operation
          MockHistoryStore()
            .get(
              `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
            )
            .reply(200, 'a\nb')
        })

        it('should remove and re-add the file during hard resync', async function () {
          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              // The corrupted file is removed and re-added as two changes
              expect(body).to.have.length(2)
              // First change: remove the corrupted file
              expect(body[0].operations).to.have.length(1)
              expect(body[0].operations[0]).to.deep.include({
                pathname: 'main.tex',
                newPathname: '',
              })
              // Second change: re-add with new blob from docstore
              expect(body[1].operations).to.have.length(1)
              expect(body[1].operations[0].pathname).to.equal('main.tex')
              expect(body[1].operations[0].file).to.have.property('hash')
              return true
            })
            .query({ end_version: 1 })
            .reply(204)

          // The re-added file needs its blob to be stored
          MockHistoryStore()
            .put(new RegExp(`/api/projects/${historyId}/blobs/`))
            .reply(201)

          await ProjectHistoryClient.hardResyncHistory(this.project_id, {
            recoverCorruptedFiles: true,
          })

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'hello world',
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            addFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
          sinon.assert.calledWithMatch(
            loggerWarn,
            sinon.match({
              projectId: this.project_id,
              pathname: 'main.tex',
            }),
            'failed to load file from history during hard resync, removing and re-adding from docstore'
          )
        })

        it('should restore comments and tracked changes from docstore after hard resync re-add', async function () {
          const commentId = 'comment-id-1'

          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              // Expect three changes: remove, re-add, then comment sync
              expect(body).to.have.length(3)
              // First change: remove the corrupted file
              expect(body[0].operations).to.have.length(1)
              expect(body[0].operations[0]).to.deep.include({
                pathname: 'main.tex',
                newPathname: '',
              })
              // Second change: re-add with new blob from docstore
              expect(body[1].operations).to.have.length(1)
              expect(body[1].operations[0].pathname).to.equal('main.tex')
              expect(body[1].operations[0].file).to.have.property('hash')
              // Third change: restore comment from docstore ranges
              expect(body[2].operations).to.have.length(1)
              expect(body[2].operations[0]).to.deep.include({
                pathname: 'main.tex',
                commentId,
              })
              expect(body[2].operations[0].ranges).to.deep.equal([
                { pos: 0, length: 5 },
              ])
              return true
            })
            .query({ end_version: 1 })
            .reply(204)

          // The re-added file needs its blob to be stored
          MockHistoryStore()
            .put(new RegExp(`/api/projects/${historyId}/blobs/`))
            .reply(201)

          await ProjectHistoryClient.hardResyncHistory(this.project_id, {
            recoverCorruptedFiles: true,
          })

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'hello world',
              ranges: {
                comments: [
                  {
                    id: commentId,
                    op: {
                      c: 'hello',
                      p: 0,
                      hpos: 0,
                      hlen: 5,
                      t: commentId,
                    },
                    meta: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                ],
                changes: [],
              },
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            addFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })

        it('should propagate the error during soft resync', async function () {
          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'hello world',
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          // Soft resync should fail — the error is propagated so it can be
          // retried later (the blob store may be temporarily unavailable).
          const { statusCode } = await ProjectHistoryClient.flushProject(
            this.project_id,
            { allowErrors: true }
          )
          expect(statusCode).to.equal(500)
        })

        it('should propagate the error during hard resync without recoverCorruptedFiles flag', async function () {
          await ProjectHistoryClient.hardResyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'hello world',
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          // Hard resync without the recoverCorruptedFiles flag should not
          // recover — recovery is too destructive to be the default behaviour.
          const { statusCode } = await ProjectHistoryClient.flushProject(
            this.project_id,
            { allowErrors: true }
          )
          expect(statusCode).to.equal(500)
        })
      })

      describe("when a doc's blob store is temporarily unavailable", function () {
        beforeEach(function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      'main.tex': {
                        hash: '0a207c060e61f3b88eaee0a8cd0696f46fb155eb',
                        stringLength: 3,
                      },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          // Blob returns a 500 simulating a transient server error
          MockHistoryStore()
            .get(
              `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
            )
            .reply(500, 'Internal Server Error')
        })

        it('should propagate transient errors even during hard resync', async function () {
          await ProjectHistoryClient.hardResyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'hello world',
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          // Even hard resync should not recover from transient errors (5xx).
          // The error should propagate so it can be retried.
          const { statusCode } = await ProjectHistoryClient.flushProject(
            this.project_id,
            { allowErrors: true }
          )
          expect(statusCode).to.equal(500)
        })
      })

      describe("when a doc's ranges are out of sync", function () {
        const commentId = 'comment-id'
        beforeEach(function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      'main.tex': {
                        hash: '0a207c060e61f3b88eaee0a8cd0696f46fb155eb',
                        rangesHash: '0a207c060e61f3b88eaee0a8cd0696f46fb155ec',
                        stringLength: 3,
                      },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          MockHistoryStore()
            .get(
              `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
            )
            .reply(200, 'a\nb')

          MockHistoryStore()
            .get(
              `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155ec`
            )
            .reply(
              200,
              JSON.stringify({
                comments: [{ id: commentId, ranges: [{ pos: 0, length: 3 }] }],
                trackedChanges: [
                  {
                    range: { pos: 0, length: 1 },
                    tracking: {
                      ts: this.timestamp.toJSON(),
                      type: 'delete',
                      userId: 'user-id',
                    },
                  },
                  {
                    range: { pos: 2, length: 1 },
                    tracking: {
                      ts: this.timestamp.toJSON(),
                      type: 'insert',
                      userId: 'user-id',
                    },
                  },
                ],
              })
            )
        })

        it('should fix comments in the history store', async function () {
          const addComment = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      commentId,
                      ranges: [{ pos: 1, length: 2 }],
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb',
              ranges: {
                comments: [
                  {
                    id: commentId,
                    op: {
                      c: 'a',
                      p: 0,
                      hpos: 1,
                      hlen: 2,
                      t: commentId,
                    },
                    meta: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                ],
                changes: [
                  {
                    id: 'id1',
                    op: {
                      d: 'a',
                      p: 0,
                    },
                    metadata: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                  {
                    id: 'id2',
                    op: {
                      i: '\n',
                      p: 1,
                      hpos: 2,
                    },
                    metadata: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                ],
              },
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            addComment.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })

        it('should fix resolved state for comments in the history store', async function () {
          const addComment = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      commentId,
                      resolved: true,
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb',
              resolvedCommentIds: [commentId],
              ranges: {
                comments: [
                  {
                    id: commentId,
                    op: {
                      c: 'a',
                      p: 0,
                      hpos: 0,
                      hlen: 3,
                      t: commentId,
                    },
                    meta: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                ],
                changes: [
                  {
                    id: 'id1',
                    op: {
                      d: 'a',
                      p: 0,
                    },
                    metadata: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                  {
                    id: 'id2',
                    op: {
                      i: '\n',
                      p: 1,
                      hpos: 2,
                    },
                    metadata: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                ],
              },
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            addComment.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })

        it('should fix comments in the history store (history-ot)', async function () {
          const addComment = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      commentId,
                      ranges: [{ pos: 1, length: 2 }],
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb',
              historyOTRanges: {
                comments: [
                  {
                    id: commentId,
                    ranges: [
                      {
                        pos: 1,
                        length: 2,
                      },
                    ],
                  },
                ],
                trackedChanges: [
                  {
                    range: { pos: 0, length: 1 },
                    tracking: {
                      ts: this.timestamp.toJSON(),
                      type: 'delete',
                      userId: 'user-id',
                    },
                  },
                  {
                    range: { pos: 2, length: 1 },
                    tracking: {
                      ts: this.timestamp.toJSON(),
                      type: 'insert',
                      userId: 'user-id',
                    },
                  },
                ],
              },
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            addComment.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })

        it('should fix resolved state for comments in the history store (history-ot)', async function () {
          const addComment = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      commentId,
                      resolved: true,
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb',
              historyOTRanges: {
                comments: [
                  {
                    id: commentId,
                    ranges: [
                      {
                        pos: 0,
                        length: 3,
                      },
                    ],
                    resolved: true,
                  },
                ],
                trackedChanges: [
                  {
                    range: { pos: 0, length: 1 },
                    tracking: {
                      ts: this.timestamp.toJSON(),
                      type: 'delete',
                      userId: 'user-id',
                    },
                  },
                  {
                    range: { pos: 2, length: 1 },
                    tracking: {
                      ts: this.timestamp.toJSON(),
                      type: 'insert',
                      userId: 'user-id',
                    },
                  },
                ],
              },
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            addComment.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })

        it('should fix tracked changes in the history store', async function () {
          const fixTrackedChange = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        1,
                        {
                          r: 1,
                          tracking: {
                            ts: this.timestamp.toJSON(),
                            type: 'insert',
                            userId: 'user-id',
                          },
                        },
                        {
                          r: 1,
                          tracking: {
                            type: 'none',
                          },
                        },
                      ],
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb',
              ranges: {
                comments: [
                  {
                    id: commentId,
                    op: {
                      c: 'a',
                      p: 0,
                      hpos: 0,
                      hlen: 3,
                      t: commentId,
                    },
                    meta: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                ],
                changes: [
                  {
                    id: 'id1',
                    op: {
                      d: 'a',
                      p: 0,
                    },
                    metadata: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                  {
                    id: 'id2',
                    op: {
                      i: '\n',
                      p: 0,
                      hpos: 1,
                    },
                    metadata: {
                      user_id: 'user-id',
                      ts: this.timestamp,
                    },
                  },
                ],
              },
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            fixTrackedChange.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })

        it('should fix tracked changes in the history store (history-ot)', async function () {
          const fixTrackedChange = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        1,
                        {
                          r: 1,
                          tracking: {
                            ts: this.timestamp.toJSON(),
                            type: 'insert',
                            userId: 'user-id',
                          },
                        },
                        {
                          r: 1,
                          tracking: {
                            type: 'none',
                          },
                        },
                      ],
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb',
              historyOTRanges: {
                comments: [
                  {
                    id: commentId,
                    ranges: [
                      {
                        pos: 0,
                        length: 3,
                      },
                    ],
                  },
                ],
                trackedChanges: [
                  {
                    range: { pos: 0, length: 1 },
                    tracking: {
                      ts: this.timestamp.toJSON(),
                      type: 'delete',
                      userId: 'user-id',
                    },
                  },
                  {
                    range: { pos: 1, length: 1 },
                    tracking: {
                      ts: this.timestamp.toJSON(),
                      type: 'insert',
                      userId: 'user-id',
                    },
                  },
                ],
              },
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            fixTrackedChange.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })

        it('should fix both comments and tracked changes in the history store (history-ot)', async function () {
          const fixTrackedChange = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                // not merged due to comment operation using history-ot and tracked-changes operation using sharejs ot
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      commentId,
                      ranges: [{ pos: 1, length: 2 }],
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'main.tex',
                      textOperation: [
                        1,
                        {
                          r: 1,
                          tracking: {
                            ts: this.timestamp.toJSON(),
                            type: 'insert',
                            userId: 'user-id',
                          },
                        },
                        {
                          r: 1,
                          tracking: {
                            type: 'none',
                          },
                        },
                      ],
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update1 = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update1)

          const update2 = {
            path: '/main.tex',
            projectHistoryId: historyId,
            resyncDocContent: {
              content: 'a\nb',
              historyOTRanges: {
                comments: [
                  {
                    id: commentId,
                    ranges: [
                      {
                        pos: 1,
                        length: 2,
                      },
                    ],
                  },
                ],
                trackedChanges: [
                  {
                    range: { pos: 0, length: 1 },
                    tracking: {
                      ts: this.timestamp.toJSON(),
                      type: 'delete',
                      userId: 'user-id',
                    },
                  },
                  {
                    range: { pos: 1, length: 1 },
                    tracking: {
                      ts: this.timestamp.toJSON(),
                      type: 'insert',
                      userId: 'user-id',
                    },
                  },
                ],
              },
            },
            doc: this.doc_id,
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update2)

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            fixTrackedChange.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
        })
      })

      describe('resyncProjectStructureOnly', function () {
        it('should handle structure only updates', async function () {
          const fileHash = 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74'

          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      'main.tex': {
                        hash: '0a207c060e61f3b88eaee0a8cd0696f46fb155eb',
                        stringLength: 3,
                      },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          const docContentRequest = MockHistoryStore()
            .get(
              `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
            )
            .reply(200, 'a\nb')
          MockHistoryStore()
            .head(`/api/projects/${historyId}/blobs/${fileHash}`)
            .reply(200)
          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`, body => {
              expect(body).to.deep.equal([
                {
                  v2Authors: [],
                  authors: [],
                  timestamp: this.timestamp.toJSON(),
                  operations: [
                    {
                      pathname: 'test.png',
                      file: {
                        hash: fileHash,
                      },
                    },
                  ],
                  origin: { kind: 'test-origin' },
                },
              ])
              return true
            })
            .query({ end_version: 0 })
            .reply(204)

          // allow a 2nd resync
          MockWeb()
            .post(`/project/${this.project_id}/history/resync`)
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update = {
            projectHistoryId: historyId,
            resyncProjectStructureOnly: true,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [
                {
                  file: this.file_id,
                  path: '/test.png',
                  _hash: fileHash,
                  createdBlob: true,
                },
              ],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update)

          await ProjectHistoryClient.flushProject(this.project_id)

          // fails when previous resync did not finish
          await ProjectHistoryClient.resyncHistory(this.project_id)

          assert(
            addFile.isDone(),
            `/api/projects/${historyId}/legacy_changes should have been called`
          )
          assert(
            !docContentRequest.isDone(),
            'should not have requested doc content'
          )
        })
        it('should reject partial resync on docs', async function () {
          const fileHash = 'aed2973e4b8a7ff1b30ff5c4751e5a2b38989e74'

          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      'main.tex': {
                        hash: '0a207c060e61f3b88eaee0a8cd0696f46fb155eb',
                        stringLength: 3,
                      },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          const docContentRequest = MockHistoryStore()
            .get(
              `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
            )
            .reply(200, 'a\nb')
          MockHistoryStore()
            .head(`/api/projects/${historyId}/blobs/${fileHash}`)
            .reply(200)
          const addFile = MockHistoryStore()
            .post(`/api/projects/${historyId}/legacy_changes`)
            .query({ end_version: 0 })
            .reply(204)

          // allow a 2nd resync
          MockWeb()
            .post(`/project/${this.project_id}/history/resync`)
            .reply(204)

          await ProjectHistoryClient.resyncHistory(this.project_id)

          const update = {
            projectHistoryId: historyId,
            resyncProjectStructureOnly: true,
            resyncProjectStructure: {
              docs: [{ path: '/main-renamed.tex' }],
              files: [
                {
                  file: this.file_id,
                  path: '/test.png',
                  _hash: fileHash,
                  createdBlob: true,
                },
              ],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, update)

          const res = await ProjectHistoryClient.flushProject(this.project_id, {
            allowErrors: true,
          })
          expect(res.statusCode).to.equal(500)
          expect(loggerError).to.have.been.calledWith(
            sinon.match({
              err: {
                name: 'NeedFullProjectStructureResyncError',
                message: 'aborting partial resync: touched doc',
              },
            })
          )

          const failure = await new Promise((resolve, reject) => {
            getFailure(this.project_id, (err, failure) => {
              if (err) return reject(err)
              resolve(failure)
            })
          })
          expect(failure).to.include({
            error:
              'NeedFullProjectStructureResyncError: aborting partial resync: touched doc',
          })

          // fails when previous resync did not finish
          await ProjectHistoryClient.resyncHistory(this.project_id)

          assert(!addFile.isDone(), 'should not have persisted changes')
          assert(
            !docContentRequest.isDone(),
            'should not have requested doc content'
          )
        })
      })

      describe('stuck sync state (missing resyncDocContent updates)', function () {
        beforeEach(function () {
          MockHistoryStore()
            .get(`/api/projects/${historyId}/latest/history`)
            .reply(200, {
              chunk: {
                history: {
                  snapshot: {
                    files: {
                      'main.tex': {
                        hash: '0a207c060e61f3b88eaee0a8cd0696f46fb155eb',
                        stringLength: 3,
                      },
                    },
                  },
                  changes: [],
                },
                startVersion: 0,
              },
            })

          MockHistoryStore()
            .get(
              `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
            )
            .reply(200, 'a\nb')
        })

        it('should get stuck when resyncDocContent update is missing', async function () {
          // Step 1: Start a resync
          await ProjectHistoryClient.resyncHistory(this.project_id)

          // Step 2: Push resyncProjectStructure update (lists docs to sync)
          // but do NOT push the corresponding resyncDocContent update
          const structureUpdate = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(
            this.project_id,
            structureUpdate
          )

          // Step 3: Flush — processes structure update, adds /main.tex to resyncDocContents
          // The updates are applied, but the flush reports the incomplete sync
          const flush = await ProjectHistoryClient.flushProject(
            this.project_id,
            { allowErrors: true }
          )
          expect(flush.statusCode).to.equal(409)

          // Step 4: Verify the sync state is stuck
          const syncState = await ProjectHistoryClient.getSyncState(
            this.project_id
          )
          expect(syncState).to.not.be.null
          expect(syncState.resyncProjectStructure).to.equal(false)
          expect(syncState.resyncDocContents).to.deep.equal(['/main.tex'])
          expect(syncState.resyncPendingSince).to.be.a('date')
          // Sync thinks it's ongoing because resyncDocContents is not empty

          // Step 5: Push a normal text update (simulating a user edit)
          const textUpdate = {
            doc: this.doc_id,
            op: [{ p: 3, i: '\nc' }],
            v: 1,
            meta: {
              ts: this.timestamp,
              pathname: '/main.tex',
              doc_length: 3,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(this.project_id, textUpdate)

          // Step 6: Flush again — the text update should be silently skipped
          // because the doc is in resyncDocContents (sync "ongoing")
          const flushAgain = await ProjectHistoryClient.flushProject(
            this.project_id,
            { allowErrors: true }
          )
          expect(flushAgain.statusCode).to.equal(409)

          // Step 7: Verify the sync state is STILL stuck (text update was skipped)
          const syncStateAfter = await ProjectHistoryClient.getSyncState(
            this.project_id
          )
          expect(syncStateAfter.resyncProjectStructure).to.equal(false)
          expect(syncStateAfter.resyncDocContents).to.deep.equal(['/main.tex'])

          // Step 7b: Verify resync-pending reports ongoing but not yet stuck
          const pending = await ProjectHistoryClient.getResyncPending(
            this.project_id
          )
          expect(pending.resyncPending).to.equal(true)
          expect(pending.syncStuck).to.equal(false)

          // Step 8: Verify a normal resync FAILS because sync is "ongoing"
          try {
            await fetchNothing(
              `http://127.0.0.1:3054/project/${this.project_id}/resync`,
              {
                method: 'POST',
                json: { origin: { kind: 'test-origin' } },
              }
            )
            assert.fail('resync should have failed')
          } catch (error) {
            if (error instanceof RequestFailedError) {
              expect(error.response.status).to.equal(409)
            } else {
              throw error
            }
          }

          expect(loggerError).to.have.been.calledWith(
            sinon.match({
              err: sinon.match({
                name: 'SyncOngoingError',
                message: 'sync ongoing',
                info: sinon.match({
                  projectId: this.project_id,
                  stuckDocPaths: ['/main.tex'],
                }),
              }),
            })
          )
        })

        it('should recover with a hard resync (force=true)', async function () {
          // Set up the stuck state (same as above)
          await ProjectHistoryClient.resyncHistory(this.project_id)

          const structureUpdate = {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: {
              ts: this.timestamp,
            },
          }
          await ProjectHistoryClient.pushRawUpdate(
            this.project_id,
            structureUpdate
          )
          await ProjectHistoryClient.flushProject(this.project_id, {
            allowErrors: true,
          })

          // Verify stuck
          const syncState = await ProjectHistoryClient.getSyncState(
            this.project_id
          )
          expect(syncState.resyncDocContents).to.deep.equal(['/main.tex'])

          // Mock the web resync endpoint for the hard resync
          MockWeb()
            .post(`/project/${this.project_id}/history/resync`)
            .reply(204)

          // Hard resync should clear the stuck state and succeed
          const response = await fetchNothing(
            `http://127.0.0.1:3054/project/${this.project_id}/resync?force=true`,
            {
              method: 'POST',
              json: { origin: { kind: 'test-origin' } },
            }
          )
          expect(response.status).to.equal(204)

          // After hard resync, sync state should be cleared or reset
          const syncStateAfter = await ProjectHistoryClient.getSyncState(
            this.project_id
          )
          // Hard resync clears and restarts — at this point the new resync
          // should be in progress (resyncProjectStructure = true) or cleared
          // depending on whether web sent updates
          if (syncStateAfter) {
            expect(syncStateAfter.resyncProjectStructure).to.equal(true)
          }
        })

        it('should auto-recover when stuck (null resyncPendingSince)', async function () {
          // Inject a stuck sync state: ongoing but no resyncPendingSince
          // (legacy state from before the timestamp field was added)
          await ProjectHistoryClient.injectStuckSyncState(this.project_id, [
            '/main.tex',
          ])

          // Verify the state is recognised as stuck
          const pending = await ProjectHistoryClient.getResyncPending(
            this.project_id
          )
          expect(pending.resyncPending).to.equal(true)
          expect(pending.syncStuck).to.equal(true)

          // Mock the web callback that requestResync triggers
          MockWeb()
            .post(`/project/${this.project_id}/history/resync`)
            .reply(204)

          // A plain resync (no force) should detect stuck, clear, and restart
          await ProjectHistoryClient.resyncHistory(this.project_id)

          // stuckClearCount incremented and a new structure sync started
          const syncState = await ProjectHistoryClient.getSyncState(
            this.project_id
          )
          expect(syncState.stuckClearCount).to.equal(1)
          expect(syncState.resyncProjectStructure).to.equal(true)
          expect(syncState.lastStuckDocPaths).to.deep.equal(['/main.tex'])
        })

        it('should report a pending resync at the end of a flush', async function () {
          await ProjectHistoryClient.injectStuckSyncState(this.project_id, [
            '/main.tex',
          ])

          const requestResync = MockWeb()
            .post(`/project/${this.project_id}/history/resync`)
            .reply(204)

          const res = await ProjectHistoryClient.flushProject(this.project_id, {
            allowErrors: true,
          })
          expect(res.statusCode).to.equal(409)

          // The flush only reports, it does not start a resync of its own
          assert(!requestResync.isDone(), 'should not have requested a resync')
          const syncState = await ProjectHistoryClient.getSyncState(
            this.project_id
          )
          expect(syncState.resyncProjectStructure).to.equal(false)
          expect(syncState.resyncDocContents).to.deep.equal(['/main.tex'])
        })

        it('should not report a resync that completes during the flush', async function () {
          await ProjectHistoryClient.resyncHistory(this.project_id)

          await ProjectHistoryClient.pushRawUpdate(this.project_id, {
            projectHistoryId: historyId,
            resyncProjectStructure: {
              docs: [{ path: '/main.tex' }],
              files: [],
            },
            meta: { ts: this.timestamp },
          })
          await ProjectHistoryClient.pushRawUpdate(this.project_id, {
            path: '/main.tex',
            doc: this.doc_id,
            resyncDocContent: { content: 'a\nb' },
            meta: { ts: this.timestamp },
          })

          await ProjectHistoryClient.flushProject(this.project_id)

          const syncState = await ProjectHistoryClient.getSyncState(
            this.project_id
          )
          expect(syncState.resyncProjectStructure).to.equal(false)
          expect(syncState.resyncDocContents).to.deep.equal([])
        })
      })
    })
  })

  // Regression: UpdateCompressor.compressUpdates optimizes a delete+insert
  // at the same position by diffing the two strings and retaining common
  // substrings. The TC retain ops are computed by the SyncManager based on
  // the original (unoptimized) content diff. When the optimized ops retain
  // characters that the original diff deleted, tracked changes on those
  // characters survive — but the TC retains don't clear them, producing a
  // ghost tracked change.
  describe('resync with tracked changes overlapping content diff', function () {
    const TIMESTAMP = '2025-01-01T00:00:00.000Z'

    const persisted = {
      content: 'lblcdhqcmihkrvzlifscqmwytt\n\ndgakoxboqpzdbbjtom',
      trackedChanges: [
        {
          range: { pos: 2, length: 3 },
          tracking: { type: 'insert', userId: 'user-2', ts: TIMESTAMP },
        },
        {
          range: { pos: 12, length: 4 },
          tracking: { type: 'delete', userId: 'user-2', ts: TIMESTAMP },
        },
        {
          range: { pos: 26, length: 3 },
          tracking: { type: 'delete', userId: 'user-2', ts: TIMESTAMP },
        },
        {
          range: { pos: 32, length: 5 },
          tracking: { type: 'delete', userId: 'user-2', ts: TIMESTAMP },
        },
      ],
    }

    const expected = {
      content: 'lblchfjaqdhqcmihkrvzliftt\ndoqpzdbom',
      trackedChanges: [
        {
          range: { pos: 0, length: 4 },
          tracking: { type: 'insert', userId: 'user-2', ts: TIMESTAMP },
        },
        {
          range: { pos: 11, length: 1 },
          tracking: { type: 'delete', userId: 'user-2', ts: TIMESTAMP },
        },
        {
          range: { pos: 17, length: 5 },
          tracking: { type: 'delete', userId: 'user-2', ts: TIMESTAMP },
        },
        {
          range: { pos: 22, length: 3 },
          tracking: { type: 'insert', userId: 'user-1', ts: TIMESTAMP },
        },
        {
          range: { pos: 26, length: 5 },
          tracking: { type: 'delete', userId: 'user-1', ts: TIMESTAMP },
        },
      ],
    }

    it('should not leave ghost tracked changes after resync', async function () {
      const rangesBlob = JSON.stringify({
        comments: [],
        trackedChanges: persisted.trackedChanges,
      })
      const contentHash = _getBlobHashFromString(persisted.content)
      const rangesHash = _getBlobHashFromString(rangesBlob)

      MockHistoryStore()
        .get(`/api/projects/${historyId}/latest/history`)
        .reply(200, {
          chunk: {
            history: {
              snapshot: {
                files: {
                  'main.tex': {
                    hash: contentHash,
                    stringLength: persisted.content.length,
                    rangesHash,
                  },
                },
              },
              changes: [],
            },
            startVersion: 0,
          },
        })

      MockHistoryStore()
        .get(`/api/projects/${historyId}/blobs/${contentHash}`)
        .reply(200, persisted.content)

      MockHistoryStore()
        .get(`/api/projects/${historyId}/blobs/${rangesHash}`)
        .reply(200, rangesBlob)

      MockHistoryStore()
        .put(/\/api\/projects\/[^/]+\/blobs\/[0-9a-f]+/)
        .optionally()
        .reply(201)

      const allCapturedChanges = []
      MockHistoryStore()
        .post(`/api/projects/${historyId}/legacy_changes`, body => {
          allCapturedChanges.push(...body)
          return true
        })
        .query(true)
        .times(5)
        .optionally()
        .reply(204)

      MockWeb().post(`/project/${this.project_id}/history/resync`).reply(204)

      await ProjectHistoryClient.resyncHistory(this.project_id)

      await ProjectHistoryClient.pushRawUpdate(this.project_id, {
        projectHistoryId: historyId,
        resyncProjectStructure: {
          docs: [{ path: '/main.tex' }],
          files: [],
        },
        meta: { ts: this.timestamp },
      })

      await ProjectHistoryClient.pushRawUpdate(this.project_id, {
        path: '/main.tex',
        projectHistoryId: historyId,
        resyncDocContent: {
          content: expected.content,
          historyOTRanges: {
            comments: [],
            trackedChanges: expected.trackedChanges,
          },
        },
        doc: this.doc_id,
        meta: { ts: this.timestamp },
      })

      await ProjectHistoryClient.flushProject(this.project_id)

      const fileData = new StringFileData(
        persisted.content,
        [],
        persisted.trackedChanges
      )
      const snapshot = new Snapshot(
        new FileMap({ 'main.tex': new File(fileData) })
      )
      for (const rawChange of allCapturedChanges) {
        Change.fromRaw(rawChange).applyTo(snapshot)
      }

      const file = snapshot.getFile('main.tex')
      assert.strictEqual(file.getContent(), expected.content, 'content')
      assert.deepStrictEqual(
        file.getTrackedChanges().toRaw(),
        expected.trackedChanges,
        `TC mismatch.\n` +
          `  expected: ${JSON.stringify(expected.trackedChanges)}\n` +
          `  actual:   ${JSON.stringify(file.getTrackedChanges().toRaw())}`
      )
    })
  })
})
