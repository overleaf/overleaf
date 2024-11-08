import async from 'async'
import nock from 'nock'
import { expect } from 'chai'
import request from 'request'
import assert from 'node:assert'
import mongodb from 'mongodb-legacy'
import * as ProjectHistoryClient from './helpers/ProjectHistoryClient.js'
import * as ProjectHistoryApp from './helpers/ProjectHistoryApp.js'
const { ObjectId } = mongodb

const MockHistoryStore = () => nock('http://127.0.0.1:3100')
const MockWeb = () => nock('http://127.0.0.1:3000')

describe('Flushing old queues', function () {
  const historyId = new ObjectId().toString()

  beforeEach(function (done) {
    this.timestamp = new Date()

    ProjectHistoryApp.ensureRunning(error => {
      if (error) {
        throw error
      }
      this.projectId = new ObjectId().toString()
      this.docId = new ObjectId().toString()
      this.fileId = new ObjectId().toString()

      MockHistoryStore().post('/api/projects').reply(200, {
        projectId: historyId,
      })
      MockWeb()
        .get(`/project/${this.projectId}/details`)
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

  describe('retrying an unflushed project', function () {
    describe('when the update is older than the cutoff', function () {
      beforeEach(function (done) {
        this.flushCall = MockHistoryStore()
          .put(
            `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
          )
          .reply(201)
          .post(`/api/projects/${historyId}/legacy_changes?end_version=0`)
          .reply(200)
        const update = {
          pathname: '/main.tex',
          docLines: 'a\nb',
          doc: this.docId,
          meta: { user_id: this.user_id, ts: new Date() },
        }
        async.series(
          [
            cb =>
              ProjectHistoryClient.pushRawUpdate(this.projectId, update, cb),
            cb =>
              ProjectHistoryClient.setFirstOpTimestamp(
                this.projectId,
                Date.now() - 24 * 3600 * 1000,
                cb
              ),
          ],
          done
        )
      })

      it('flushes the project history queue', function (done) {
        request.post(
          {
            url: 'http://127.0.0.1:3054/flush/old?maxAge=10800',
          },
          (error, res, body) => {
            if (error) {
              return done(error)
            }
            expect(res.statusCode).to.equal(200)
            assert(
              this.flushCall.isDone(),
              'made calls to history service to store updates'
            )
            done()
          }
        )
      })

      it('flushes the project history queue in the background when requested', function (done) {
        request.post(
          {
            url: 'http://127.0.0.1:3054/flush/old?maxAge=10800&background=1',
          },
          (error, res, body) => {
            if (error) {
              return done(error)
            }
            expect(res.statusCode).to.equal(200)
            expect(body).to.equal('{"message":"running flush in background"}')
            assert(
              !this.flushCall.isDone(),
              'did not make calls to history service to store updates in the foreground'
            )
            setTimeout(() => {
              assert(
                this.flushCall.isDone(),
                'made calls to history service to store updates in the background'
              )
              done()
            }, 100)
          }
        )
      })
    })

    describe('when the update is newer than the cutoff', function () {
      beforeEach(function (done) {
        this.flushCall = MockHistoryStore()
          .put(
            `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
          )
          .reply(201)
          .post(`/api/projects/${historyId}/legacy_changes?end_version=0`)
          .reply(200)
        const update = {
          pathname: '/main.tex',
          docLines: 'a\nb',
          doc: this.docId,
          meta: { user_id: this.user_id, ts: new Date() },
        }
        async.series(
          [
            cb =>
              ProjectHistoryClient.pushRawUpdate(this.projectId, update, cb),
            cb =>
              ProjectHistoryClient.setFirstOpTimestamp(
                this.projectId,
                Date.now() - 60 * 1000,
                cb
              ),
          ],
          done
        )
      })

      it('does not flush the project history queue', function (done) {
        request.post(
          {
            url: `http://127.0.0.1:3054/flush/old?maxAge=${3 * 3600}`,
          },
          (error, res, body) => {
            if (error) {
              return done(error)
            }
            expect(res.statusCode).to.equal(200)
            assert(
              !this.flushCall.isDone(),
              'did not make calls to history service to store updates'
            )
            done()
          }
        )
      })
    })

    describe('when the update does not have a timestamp', function () {
      beforeEach(function (done) {
        this.flushCall = MockHistoryStore()
          .put(
            `/api/projects/${historyId}/blobs/0a207c060e61f3b88eaee0a8cd0696f46fb155eb`
          )
          .reply(201)
          .post(`/api/projects/${historyId}/legacy_changes?end_version=0`)
          .reply(200)
        const update = {
          pathname: '/main.tex',
          docLines: 'a\nb',
          doc: this.docId,
          meta: { user_id: this.user_id, ts: new Date() },
        }
        this.startDate = Date.now()
        async.series(
          [
            cb =>
              ProjectHistoryClient.pushRawUpdate(this.projectId, update, cb),
            cb =>
              ProjectHistoryClient.clearFirstOpTimestamp(this.projectId, cb),
          ],
          done
        )
      })

      it('flushes the project history queue anyway', function (done) {
        request.post(
          {
            url: `http://127.0.0.1:3054/flush/old?maxAge=${3 * 3600}`,
          },
          (error, res, body) => {
            if (error) {
              return done(error)
            }
            expect(res.statusCode).to.equal(200)
            assert(
              this.flushCall.isDone(),
              'made calls to history service to store updates'
            )
            ProjectHistoryClient.getFirstOpTimestamp(
              this.projectId,
              (err, result) => {
                if (err) {
                  return done(err)
                }
                expect(result).to.be.null
                done()
              }
            )
          }
        )
      })
    })
  })
})
