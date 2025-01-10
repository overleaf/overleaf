import { expect } from 'chai'

import _ from 'lodash'
import { db, ObjectId } from '../../../../../app/src/infrastructure/mongodb.js'
import User from '../../../../../test/acceptance/src/helpers/User.mjs'
import MockV1HistoryApiClass from '../../../../../test/acceptance/src/mocks/MockV1HistoryApi.mjs'

let MockV1HistoryApi

before(function () {
  MockV1HistoryApi = MockV1HistoryApiClass.instance()
})

describe('History', function () {
  beforeEach(function (done) {
    this.owner = new User()
    this.owner.login(done)
  })

  describe('zip download of version', function () {
    it('should stream the zip file of a version', function (done) {
      this.owner.createProject('example-project', (error, projectId) => {
        this.project_id = projectId
        if (error) {
          return done(error)
        }
        this.v1_history_id = 42
        db.projects.updateOne(
          {
            _id: new ObjectId(this.project_id),
          },
          {
            $set: {
              'overleaf.history.id': this.v1_history_id,
            },
          },
          error => {
            if (error) {
              return done(error)
            }
            this.owner.request(
              `/project/${this.project_id}/version/42/zip`,
              (error, response, body) => {
                if (error) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(200)
                expect(response.headers['content-type']).to.equal(
                  'application/zip'
                )
                expect(response.headers['content-disposition']).to.equal(
                  'attachment; filename="example-project (Version 42).zip"'
                )
                expect(body).to.equal(
                  `Mock zip for ${this.v1_history_id} at version 42`
                )
                done()
              }
            )
          }
        )
      })
    })

    describe('request abort', function () {
      // Optional manual verification: add unique logging statements into
      //   HistoryController._pipeHistoryZipToResponse
      // in each of the `req.destroyed` branches and confirm that each branch
      //  was covered.
      beforeEach(function setupNewProject(done) {
        this.owner.createProject('example-project', (error, projectId) => {
          this.project_id = projectId
          if (error) {
            return done(error)
          }
          this.v1_history_id = 42
          db.projects.updateOne(
            { _id: new ObjectId(this.project_id) },
            {
              $set: {
                'overleaf.history.id': this.v1_history_id,
              },
            },
            done
          )
        })
      })

      it('should abort the upstream request', function (done) {
        const request = this.owner.request(
          `/project/${this.project_id}/version/100/zip`
        )
        request.on('error', err => {
          if (err.code !== 'ECONNRESET') {
            done(err)
          }
        })
        request.on('response', response => {
          expect(response.statusCode).to.equal(200)
          let receivedChunks = 0
          response.on('data', () => {
            receivedChunks++
          })
          response.resume()

          setTimeout(() => {
            request.abort()
            const receivedSoFar = receivedChunks
            const sentSoFar = MockV1HistoryApi.sentChunks
            // Ihe next assertions should verify that chunks are emitted
            //  and received -- the exact number is not important.
            // In theory we are now emitting the 3rd chunk,
            //  so this should be exactly 3, to not make this
            //  test flaky, we allow +- 2 chunks.
            expect(sentSoFar).to.be.within(1, 4)
            expect(receivedSoFar).to.be.within(1, 4)
            setTimeout(() => {
              // The fake-s3 service should have stopped emitting chunks.
              // If not, that would be +5 in an ideal world (1 every 100ms).
              // On the happy-path (it stopped) it emitted +1 which was
              //  in-flight and another +1 before it received the abort.
              expect(MockV1HistoryApi.sentChunks).to.be.below(sentSoFar + 5)
              expect(MockV1HistoryApi.sentChunks).to.be.within(
                sentSoFar,
                sentSoFar + 2
              )
              done()
            }, 500)
          }, 200)
        })
      })

      it('should skip the v1-history request', function (done) {
        const request = this.owner.request(
          `/project/${this.project_id}/version/100/zip`
        )
        setTimeout(() => {
          // This is a race-condition to abort the request after the
          //  processing of all the the express middleware completed.
          // In case we abort before they complete, we do not hit our
          //  abort logic, but express internal logic, which is OK.
          request.abort()
        }, 2)
        request.on('error', done)
        setTimeout(() => {
          expect(MockV1HistoryApi.requestedZipPacks).to.equal(0)
          done()
        }, 500)
      })

      it('should skip the async-polling', function (done) {
        const request = this.owner.request(
          `/project/${this.project_id}/version/100/zip`
        )
        MockV1HistoryApi.events.on('v1-history-pack-zip', () => {
          request.abort()
        })
        request.on('error', done)
        setTimeout(() => {
          expect(MockV1HistoryApi.fakeZipCall).to.equal(0)
          done()
        }, 3000) // initial polling delay is 2s
      })

      it('should skip the upstream request', function (done) {
        const request = this.owner.request(
          `/project/${this.project_id}/version/100/zip`
        )
        MockV1HistoryApi.events.on('v1-history-pack-zip', () => {
          setTimeout(() => {
            request.abort()
          }, 1000)
        })
        request.on('error', done)
        setTimeout(() => {
          expect(MockV1HistoryApi.fakeZipCall).to.equal(0)
          done()
        }, 3000) // initial polling delay is 2s
      })
    })

    it('should return 402 for non-v2-history project', function (done) {
      this.owner.createProject('non-v2-project', (error, projectId) => {
        this.project_id = projectId
        if (error) {
          return done(error)
        }
        db.projects.updateOne(
          {
            _id: new ObjectId(this.project_id),
          },
          {
            $unset: {
              'overleaf.history.id': true,
            },
          },
          error => {
            if (error) {
              return done(error)
            }
            this.owner.request(
              `/project/${this.project_id}/version/42/zip`,
              (error, response, body) => {
                if (error) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(402)
                done()
              }
            )
          }
        )
      })
    })
  })

  describe('zip download, with upstream 404', function () {
    beforeEach(function () {
      _.remove(
        MockV1HistoryApi.app._router.stack,
        appRoute =>
          appRoute.route?.path ===
          '/api/projects/:project_id/version/:version/zip'
      )
      MockV1HistoryApi.app.post(
        '/api/projects/:project_id/version/:version/zip',
        (req, res, next) => {
          res.sendStatus(404)
        }
      )
    })

    afterEach(function () {
      MockV1HistoryApi = MockV1HistoryApiClass.instance()
      MockV1HistoryApi.reset()
      MockV1HistoryApi.applyRoutes()
    })

    it('should produce 404 when post request produces 404', function (done) {
      this.owner.createProject('example-project', (error, projectId) => {
        if (error) {
          return done(error)
        }
        this.project_id = projectId
        this.v1_history_id = 42
        db.projects.updateOne(
          {
            _id: new ObjectId(this.project_id),
          },
          {
            $set: {
              'overleaf.history.id': this.v1_history_id,
            },
          },
          error => {
            if (error) {
              return done(error)
            }
            this.owner.request(
              `/project/${this.project_id}/version/42/zip`,
              (error, response, body) => {
                if (error) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(404)
                done()
              }
            )
          }
        )
      })
    })
  })

  describe('zip download, with no zipUrl from upstream', function () {
    beforeEach(function () {
      _.remove(
        MockV1HistoryApi.app._router.stack,
        appRoute =>
          appRoute.route?.path ===
          '/api/projects/:project_id/version/:version/zip'
      )
      MockV1HistoryApi.app.get(
        '/api/projects/:project_id/version/:version/zip',
        (req, res, next) => {
          res.sendStatus(500)
        }
      )
      MockV1HistoryApi.app.post(
        '/api/projects/:project_id/version/:version/zip',
        (req, res, next) => {
          res.json({ message: 'lol' })
        }
      )
    })

    afterEach(function () {
      MockV1HistoryApi = MockV1HistoryApiClass.instance()
      MockV1HistoryApi.reset()
      MockV1HistoryApi.applyRoutes()
    })

    it('should produce 500', function (done) {
      this.owner.createProject('example-project', (error, projectId) => {
        if (error) {
          return done(error)
        }
        this.project_id = projectId
        this.v1_history_id = 42
        db.projects.updateOne(
          {
            _id: new ObjectId(this.project_id),
          },
          {
            $set: {
              'overleaf.history.id': this.v1_history_id,
            },
          },
          error => {
            if (error) {
              return done(error)
            }
            this.owner.request(
              `/project/${this.project_id}/version/42/zip`,
              (error, response, body) => {
                if (error) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(500)
                done()
              }
            )
          }
        )
      })
    })
  })
})
