/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')

const { db, ObjectId } = require('../../../app/src/infrastructure/mongodb')
const User = require('./helpers/User')
const MockV1HistoryApiClass = require('./mocks/MockV1HistoryApi')

let MockV1HistoryApi

before(function () {
  MockV1HistoryApi = MockV1HistoryApiClass.instance()
})

describe('History', function () {
  beforeEach(function (done) {
    this.owner = new User()
    return this.owner.login(done)
  })

  describe('zip download of version', function () {
    it('should stream the zip file of a version', function (done) {
      return this.owner.createProject(
        'example-project',
        (error, project_id) => {
          this.project_id = project_id
          if (error != null) {
            return done(error)
          }
          this.v1_history_id = 42
          return db.projects.updateOne(
            {
              _id: ObjectId(this.project_id),
            },
            {
              $set: {
                'overleaf.history.id': this.v1_history_id,
              },
            },
            error => {
              if (error != null) {
                return done(error)
              }
              return this.owner.request(
                `/project/${this.project_id}/version/42/zip`,
                (error, response, body) => {
                  if (error != null) {
                    return done(error)
                  }
                  expect(response.statusCode).to.equal(200)
                  expect(response.headers['content-type']).to.equal(
                    'application/zip'
                  )
                  expect(response.headers['content-disposition']).to.equal(
                    'attachment; filename="example-project%20(Version%2042).zip"'
                  )
                  expect(body).to.equal(
                    `Mock zip for ${this.v1_history_id} at version 42`
                  )
                  return done()
                }
              )
            }
          )
        }
      )
    })

    describe('request abort', function () {
      // Optional manual verification: add unique logging statements into
      //   HistoryController._pipeHistoryZipToResponse
      // in each of the `req.aborted` branches and confirm that each branch
      //  was covered.
      beforeEach(function setupNewProject(done) {
        this.owner.createProject('example-project', (error, project_id) => {
          this.project_id = project_id
          if (error) {
            return done(error)
          }
          this.v1_history_id = 42
          db.projects.updateOne(
            { _id: ObjectId(this.project_id) },
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
        request.on('error', done)
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
              // Ff not, that would be +5 in an ideal world (1 every 100ms).
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
      return this.owner.createProject('non-v2-project', (error, project_id) => {
        this.project_id = project_id
        if (error != null) {
          return done(error)
        }
        return db.projects.updateOne(
          {
            _id: ObjectId(this.project_id),
          },
          {
            $unset: {
              'overleaf.history.id': true,
            },
          },
          error => {
            if (error != null) {
              return done(error)
            }
            return this.owner.request(
              `/project/${this.project_id}/version/42/zip`,
              (error, response, body) => {
                if (error != null) {
                  return done(error)
                }
                expect(response.statusCode).to.equal(402)
                return done()
              }
            )
          }
        )
      })
    })
  })
})
