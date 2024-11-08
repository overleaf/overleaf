import async from 'async'
import nock from 'nock'
import { expect } from 'chai'
import request from 'request'
import assert from 'node:assert'
import mongodb from 'mongodb-legacy'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const EMPTY_FILE_HASH = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockFileStore = () => nock('http://127.0.0.1:3009')
const MockWeb = () => nock('http://127.0.0.1:3000')

describe('Syncing with web and doc-updater', function () {
  const historyId = new ObjectId().toString()

  beforeEach(function (done) {
    this.timestamp = new Date()

    ProjectHistoryApp.ensureRunning(error => {
      if (error) {
        throw error
      }
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
      MockHistoryStore()
        .get(`/api/projects/${historyId}/latest/history`)
        .reply(200, {
          chunk: {
            startVersion: 0,
            history: {
              changes: [],
            },
          },
        })
      ProjectHistoryClient.initializeProject(historyId, done)
    })
  })

  afterEach(function () {
    nock.cleanAll()
  })

  describe('resyncing project history', function () {
    describe('without project-history enabled', function () {
      beforeEach(function () {
        MockWeb().post(`/project/${this.project_id}/history/resync`).reply(404)
      })

      it('404s if project-history is not enabled', function (done) {
        request.post(
          {
            url: `http://127.0.0.1:3054/project/${this.project_id}/resync`,
          },
          (error, res, body) => {
            if (error) {
              return done(error)
            }
            expect(res.statusCode).to.equal(404)
            done()
          }
        )
      })
    })

    describe('with project-history enabled', function () {
      beforeEach(function () {
        MockWeb().post(`/project/${this.project_id}/history/resync`).reply(204)
      })

      describe('when a doc is missing', function () {
        it('should send add doc updates to the history store', function (done) {
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

          async.series(
            [
              cb => {
                ProjectHistoryClient.resyncHistory(this.project_id, cb)
              },
              cb => {
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
                ProjectHistoryClient.pushRawUpdate(this.project_id, update, cb)
              },
              cb => {
                ProjectHistoryClient.flushProject(this.project_id, cb)
              },
            ],
            error => {
              if (error) {
                return done(error)
              }
              assert(
                createBlob.isDone(),
                '/api/projects/:historyId/blobs/:hash should have been called'
              )
              assert(
                addFile.isDone(),
                `/api/projects/${historyId}/changes should have been called`
              )
              done()
            }
          )
        })
      })

      describe('when a file is missing', function () {
        it('should send add file updates to the history store', function (done) {
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

          async.series(
            [
              cb => {
                ProjectHistoryClient.resyncHistory(this.project_id, cb)
              },
              cb => {
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
                ProjectHistoryClient.pushRawUpdate(this.project_id, update, cb)
              },
              cb => {
                ProjectHistoryClient.flushProject(this.project_id, cb)
              },
            ],
            error => {
              if (error) {
                throw error
              }
              assert(
                createBlob.isDone(),
                '/api/projects/:historyId/blobs/:hash should have been called'
              )
              assert(
                addFile.isDone(),
                `/api/projects/${historyId}/changes should have been called`
              )
              done()
            }
          )
        })
      })

      describe("when a file exists which shouldn't", function () {
        it('should send remove file updates to the history store', function (done) {
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

          async.series(
            [
              cb => {
                ProjectHistoryClient.resyncHistory(this.project_id, cb)
              },
              cb => {
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
                ProjectHistoryClient.pushRawUpdate(this.project_id, update, cb)
              },
              cb => {
                ProjectHistoryClient.flushProject(this.project_id, cb)
              },
            ],
            error => {
              if (error) {
                throw error
              }
              assert(
                deleteFile.isDone(),
                `/api/projects/${historyId}/changes should have been called`
              )
              done()
            }
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

        it('should send test updates to the history store', function (done) {
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

          async.series(
            [
              cb => {
                ProjectHistoryClient.resyncHistory(this.project_id, cb)
              },
              cb => {
                const update = {
                  projectHistoryId: historyId,
                  resyncProjectStructure: {
                    docs: [{ path: '/main.tex' }],
                    files: [],
                  },
                  meta: {
                    ts: this.timestamp,
                  },
                }
                ProjectHistoryClient.pushRawUpdate(this.project_id, update, cb)
              },
              cb => {
                const update = {
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
                ProjectHistoryClient.pushRawUpdate(this.project_id, update, cb)
              },
              cb => {
                ProjectHistoryClient.flushProject(this.project_id, cb)
              },
            ],
            error => {
              if (error) {
                throw error
              }
              assert(
                addFile.isDone(),
                `/api/projects/${historyId}/changes should have been called`
              )
              done()
            }
          )
        })

        it('should strip non-BMP characters in updates before sending to the history store', function (done) {
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

          async.series(
            [
              cb => {
                ProjectHistoryClient.resyncHistory(this.project_id, cb)
              },
              cb => {
                const update = {
                  projectHistoryId: historyId,
                  resyncProjectStructure: {
                    docs: [{ path: '/main.tex' }],
                    files: [],
                  },
                  meta: {
                    ts: this.timestamp,
                  },
                }
                ProjectHistoryClient.pushRawUpdate(this.project_id, update, cb)
              },
              cb => {
                const update = {
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
                ProjectHistoryClient.pushRawUpdate(this.project_id, update, cb)
              },
              cb => {
                ProjectHistoryClient.flushProject(this.project_id, cb)
              },
            ],
            error => {
              if (error) {
                throw error
              }
              assert(
                addFile.isDone(),
                `/api/projects/${historyId}/changes should have been called`
              )
              done()
            }
          )
        })

        it('should fix comments in the history store', function (done) {
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

          async.series(
            [
              cb => {
                ProjectHistoryClient.resyncHistory(this.project_id, cb)
              },
              cb => {
                const update = {
                  projectHistoryId: historyId,
                  resyncProjectStructure: {
                    docs: [{ path: '/main.tex' }],
                    files: [],
                  },
                  meta: {
                    ts: this.timestamp,
                  },
                }
                ProjectHistoryClient.pushRawUpdate(this.project_id, update, cb)
              },
              cb => {
                const update = {
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
                ProjectHistoryClient.pushRawUpdate(this.project_id, update, cb)
              },
              cb => {
                ProjectHistoryClient.flushProject(this.project_id, cb)
              },
            ],
            error => {
              if (error) {
                return done(error)
              }
              assert(
                addComment.isDone(),
                `/api/projects/${historyId}/changes should have been called`
              )
              done()
            }
          )
        })
      })
    })
  })
})
