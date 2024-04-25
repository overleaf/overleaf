import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import nock from 'nock'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

const fixture = path => new URL(`../fixtures/${path}`, import.meta.url)

describe('ReadSnapshot', function () {
  beforeEach(function (done) {
    ProjectHistoryApp.ensureRunning(error => {
      if (error) {
        throw error
      }

      this.historyId = new ObjectId().toString()
      MockHistoryStore().post('/api/projects').reply(200, {
        projectId: this.historyId,
      })

      ProjectHistoryClient.initializeProject(
        this.historyId,
        (error, v1Project) => {
          if (error) {
            throw error
          }
          this.projectId = new ObjectId().toString()
          MockWeb()
            .get(`/project/${this.projectId}/details`)
            .reply(200, {
              name: 'Test Project',
              overleaf: { history: { id: v1Project.id } },
            })
          done()
        }
      )
    })
  })

  afterEach(function () {
    nock.cleanAll()
  })

  describe('of a text file', function () {
    it('should return the snapshot of a doc at the given version', function (done) {
      MockHistoryStore()
        .get(`/api/projects/${this.historyId}/versions/5/history`)
        .replyWithFile(200, fixture('chunks/4-6.json'))
      MockHistoryStore()
        .get(
          `/api/projects/${this.historyId}/blobs/c6654ea913979e13e22022653d284444f284a172`
        )
        .replyWithFile(
          200,
          fixture('blobs/c6654ea913979e13e22022653d284444f284a172')
        )

      ProjectHistoryClient.getSnapshot(
        this.projectId,
        'foo.tex',
        5,
        (error, body) => {
          if (error) {
            throw error
          }
          expect(body).to.deep.equal(
            `\
Hello world

One two three

Four five six

Seven eight nine\
`.replace(/^\t/g, '')
          )
          done()
        }
      )
    })

    it('should return the snapshot of a doc at a different version', function (done) {
      MockHistoryStore()
        .get(`/api/projects/${this.historyId}/versions/4/history`)
        .replyWithFile(200, fixture('chunks/4-6.json'))
      MockHistoryStore()
        .get(
          `/api/projects/${this.historyId}/blobs/c6654ea913979e13e22022653d284444f284a172`
        )
        .replyWithFile(
          200,
          fixture('blobs/c6654ea913979e13e22022653d284444f284a172')
        )

      ProjectHistoryClient.getSnapshot(
        this.projectId,
        'foo.tex',
        4,
        (error, body) => {
          if (error) {
            throw error
          }
          expect(body).to.deep.equal(
            `\
Hello world

One two three

Four five six

Seven eight nince\
`.replace(/^\t/g, '')
          )
          done()
        }
      )
    })

    it('should return the snapshot of a doc after a rename version', function (done) {
      MockHistoryStore()
        .get(`/api/projects/${this.historyId}/versions/6/history`)
        .replyWithFile(200, fixture('chunks/4-6.json'))
      MockHistoryStore()
        .get(
          `/api/projects/${this.historyId}/blobs/c6654ea913979e13e22022653d284444f284a172`
        )
        .replyWithFile(
          200,
          fixture('blobs/c6654ea913979e13e22022653d284444f284a172')
        )

      ProjectHistoryClient.getSnapshot(
        this.projectId,
        'bar.tex',
        6,
        (error, body) => {
          if (error) {
            throw error
          }
          expect(body).to.deep.equal(
            `\
Hello world

One two three

Four five six

Seven eight nine\
`.replace(/^\t/g, '')
          )
          done()
        }
      )
    })
  })

  describe('of a binary file', function () {
    beforeEach(function () {
      MockHistoryStore()
        .get(`/api/projects/${this.historyId}/versions/4/history`)
        .reply(200, {
          chunk: {
            history: {
              snapshot: {
                files: {
                  binary_file: {
                    hash: 'c6654ea913979e13e22022653d284444f284a172',
                    byteLength: 41,
                  },
                },
              },
              changes: [],
            },
            startVersion: 3,
          },
          authors: [],
        })
    })

    it('should return the snapshot of the file at the given version', function (done) {
      MockHistoryStore()
        .get(
          `/api/projects/${this.historyId}/blobs/c6654ea913979e13e22022653d284444f284a172`
        )
        .replyWithFile(
          200,
          fixture('blobs/c6654ea913979e13e22022653d284444f284a172')
        )

      ProjectHistoryClient.getSnapshot(
        this.projectId,
        'binary_file',
        4,
        (error, body) => {
          if (error) {
            throw error
          }
          expect(body).to.deep.equal(
            `\
Hello world

One two three

Four five six\
`.replace(/^\t/g, '')
          )
          done()
        }
      )
    })

    it("should return an error when the blob doesn't exist", function (done) {
      MockHistoryStore()
        .get(`/api/projects/${this.historyId}/versions/4/history`)
        .reply(200, {
          chunk: {
            history: {
              snapshot: {
                files: {
                  binary_file: {
                    hash: 'c6654ea913979e13e22022653d284444f284a172',
                    byteLength: 41,
                  },
                },
              },
              changes: [],
            },
            startVersion: 3,
          },
          authors: [],
        })
      MockHistoryStore()
        .get(
          `/api/projects/${this.historyId}/blobs/c6654ea913979e13e22022653d284444f284a172`
        )
        .reply(404)

      ProjectHistoryClient.getSnapshot(
        this.projectId,
        'binary_file',
        4,
        { allowErrors: true },
        (error, body, statusCode) => {
          if (error) {
            throw error
          }
          expect(statusCode).to.equal(500)
          done()
        }
      )
    })

    it('should return an error when the blob request errors', function (done) {
      MockHistoryStore()
        .get(`/api/projects/${this.historyId}/versions/4/history`)
        .reply(200, {
          chunk: {
            history: {
              snapshot: {
                files: {
                  binary_file: {
                    hash: 'c6654ea913979e13e22022653d284444f284a172',
                    byteLength: 41,
                  },
                },
              },
              changes: [],
            },
            startVersion: 3,
          },
          authors: [],
        })
      MockHistoryStore()
        .get(
          `/api/projects/${this.historyId}/blobs/c6654ea913979e13e22022653d284444f284a172`
        )
        .replyWithError('oh no!')

      ProjectHistoryClient.getSnapshot(
        this.projectId,
        'binary_file',
        4,
        { allowErrors: true },
        (error, body, statusCode) => {
          if (error) {
            throw error
          }
          expect(statusCode).to.equal(500)
          done()
        }
      )
    })
  })
})
