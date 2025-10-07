import nock from 'nock'
import { expect } from 'chai'
import assert from 'node:assert'
import mongodb from 'mongodb-legacy'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
import sinon from 'sinon'
import { getFailure } from './helpers/ProjectHistoryClient.js'
import { fetchNothing, RequestFailedError } from '@overleaf/fetch-utils'
const { ObjectId } = mongodb

const EMPTY_FILE_HASH = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'

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

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            createBlob.isDone(),
            '/api/projects/:historyId/blobs/:hash should have been called'
          )
          assert(
            addFile.isDone(),
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been skipped`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
              `/api/projects/${historyId}/changes should have been skipped`
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
            `/api/projects/${historyId}/changes should have been called`
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

          await ProjectHistoryClient.flushProject(this.project_id)

          assert(
            deleteFile.isDone(),
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
          )
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
            `/api/projects/${historyId}/changes should have been called`
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
    })
  })
})
