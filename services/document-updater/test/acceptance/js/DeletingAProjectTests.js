// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const async = require('async')

const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Deleting a project', function () {
  beforeEach(function (done) {
    let docId0, docId1
    this.project_id = DocUpdaterClient.randomId()
    this.docs = [
      {
        id: (docId0 = DocUpdaterClient.randomId()),
        lines: ['one', 'two', 'three'],
        update: {
          doc: docId0,
          op: [
            {
              i: 'one and a half\n',
              p: 4,
            },
          ],
          v: 0,
        },
        updatedLines: ['one', 'one and a half', 'two', 'three'],
      },
      {
        id: (docId1 = DocUpdaterClient.randomId()),
        lines: ['four', 'five', 'six'],
        update: {
          doc: docId1,
          op: [
            {
              i: 'four and a half\n',
              p: 5,
            },
          ],
          v: 0,
        },
        updatedLines: ['four', 'four and a half', 'five', 'six'],
      },
    ]
    for (const doc of Array.from(this.docs)) {
      MockWebApi.insertDoc(this.project_id, doc.id, {
        lines: doc.lines,
        version: doc.update.v,
      })
    }

    DocUpdaterApp.ensureRunning(done)
  })

  describe('without updates', function () {
    beforeEach(function (done) {
      sinon.spy(MockWebApi, 'setDocument')
      sinon.spy(MockProjectHistoryApi, 'flushProject')

      async.series(
        this.docs.map(doc => {
          return callback => {
            DocUpdaterClient.preloadDoc(this.project_id, doc.id, error => {
              callback(error)
            })
          }
        }),
        error => {
          if (error != null) {
            throw error
          }
          setTimeout(() => {
            DocUpdaterClient.deleteProject(
              this.project_id,
              (error, res, body) => {
                if (error) return done(error)
                this.statusCode = res.statusCode
                done()
              }
            )
          }, 200)
        }
      )
    })

    afterEach(function () {
      MockWebApi.setDocument.restore()
      MockProjectHistoryApi.flushProject.restore()
    })

    it('should return a 204 status code', function () {
      this.statusCode.should.equal(204)
    })

    it('should not send any document to the web api', function () {
      MockWebApi.setDocument.should.not.have.been.called
    })

    it('should need to reload the docs if read again', function (done) {
      sinon.spy(MockWebApi, 'getDocument')
      async.series(
        this.docs.map(doc => {
          return callback => {
            MockWebApi.getDocument
              .calledWith(this.project_id, doc.id)
              .should.equal(false)
            DocUpdaterClient.getDoc(
              this.project_id,
              doc.id,
              (error, res, returnedDoc) => {
                if (error) return done(error)
                MockWebApi.getDocument
                  .calledWith(this.project_id, doc.id)
                  .should.equal(true)
                callback()
              }
            )
          }
        }),
        () => {
          MockWebApi.getDocument.restore()
          done()
        }
      )
    })

    it('should flush each doc in project history', function () {
      MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })
  })

  describe('with documents which have been updated', function () {
    beforeEach(function (done) {
      sinon.spy(MockWebApi, 'setDocument')
      sinon.spy(MockProjectHistoryApi, 'flushProject')

      async.series(
        this.docs.map(doc => {
          return callback => {
            DocUpdaterClient.preloadDoc(this.project_id, doc.id, error => {
              if (error != null) {
                return callback(error)
              }
              DocUpdaterClient.sendUpdate(
                this.project_id,
                doc.id,
                doc.update,
                error => {
                  callback(error)
                }
              )
            })
          }
        }),
        error => {
          if (error != null) {
            throw error
          }
          setTimeout(() => {
            DocUpdaterClient.deleteProject(
              this.project_id,
              (error, res, body) => {
                if (error) return done(error)
                this.statusCode = res.statusCode
                done()
              }
            )
          }, 200)
        }
      )
    })

    afterEach(function () {
      MockWebApi.setDocument.restore()
      MockProjectHistoryApi.flushProject.restore()
    })

    it('should return a 204 status code', function () {
      this.statusCode.should.equal(204)
    })

    it('should send each document to the web api', function () {
      Array.from(this.docs).map(doc =>
        MockWebApi.setDocument
          .calledWith(this.project_id, doc.id, doc.updatedLines)
          .should.equal(true)
      )
    })

    it('should need to reload the docs if read again', function (done) {
      sinon.spy(MockWebApi, 'getDocument')
      async.series(
        this.docs.map(doc => {
          return callback => {
            MockWebApi.getDocument
              .calledWith(this.project_id, doc.id)
              .should.equal(false)
            DocUpdaterClient.getDoc(
              this.project_id,
              doc.id,
              (error, res, returnedDoc) => {
                if (error) return done(error)
                MockWebApi.getDocument
                  .calledWith(this.project_id, doc.id)
                  .should.equal(true)
                callback()
              }
            )
          }
        }),
        () => {
          MockWebApi.getDocument.restore()
          done()
        }
      )
    })

    it('should flush each doc in project history', function () {
      MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })
  })

  describe('with the background=true parameter from realtime and no request to flush the queue', function () {
    beforeEach(function (done) {
      sinon.spy(MockWebApi, 'setDocument')
      sinon.spy(MockProjectHistoryApi, 'flushProject')

      async.series(
        this.docs.map(doc => {
          return callback => {
            DocUpdaterClient.preloadDoc(this.project_id, doc.id, error => {
              if (error != null) {
                return callback(error)
              }
              DocUpdaterClient.sendUpdate(
                this.project_id,
                doc.id,
                doc.update,
                error => {
                  callback(error)
                }
              )
            })
          }
        }),
        error => {
          if (error != null) {
            throw error
          }
          setTimeout(() => {
            DocUpdaterClient.deleteProjectOnShutdown(
              this.project_id,
              (error, res, body) => {
                if (error) return done(error)
                this.statusCode = res.statusCode
                done()
              }
            )
          }, 200)
        }
      )
    })

    afterEach(function () {
      MockWebApi.setDocument.restore()
      MockProjectHistoryApi.flushProject.restore()
    })

    it('should return a 204 status code', function () {
      this.statusCode.should.equal(204)
    })

    it('should not send any documents to the web api', function () {
      MockWebApi.setDocument.called.should.equal(false)
    })

    it('should not flush to project history', function () {
      MockProjectHistoryApi.flushProject.called.should.equal(false)
    })
  })

  describe('with the background=true parameter from realtime and a request to flush the queue', function () {
    beforeEach(function (done) {
      sinon.spy(MockWebApi, 'setDocument')
      sinon.spy(MockProjectHistoryApi, 'flushProject')

      async.series(
        this.docs.map(doc => {
          return callback => {
            DocUpdaterClient.preloadDoc(this.project_id, doc.id, error => {
              if (error != null) {
                return callback(error)
              }
              DocUpdaterClient.sendUpdate(
                this.project_id,
                doc.id,
                doc.update,
                error => {
                  callback(error)
                }
              )
            })
          }
        }),
        error => {
          if (error != null) {
            throw error
          }
          setTimeout(() => {
            DocUpdaterClient.deleteProjectOnShutdown(
              this.project_id,
              (error, res, body) => {
                if (error) return done(error)
                this.statusCode = res.statusCode
                // after deleting the project and putting it in the queue, flush the queue
                setTimeout(() => DocUpdaterClient.flushOldProjects(done), 2000)
              }
            )
          }, 200)
        }
      )
    })

    afterEach(function () {
      MockWebApi.setDocument.restore()
      MockProjectHistoryApi.flushProject.restore()
    })

    it('should return a 204 status code', function () {
      this.statusCode.should.equal(204)
    })

    it('should send each document to the web api', function () {
      Array.from(this.docs).map(doc =>
        MockWebApi.setDocument
          .calledWith(this.project_id, doc.id, doc.updatedLines)
          .should.equal(true)
      )
    })

    it('should flush to project history', function () {
      MockProjectHistoryApi.flushProject.called.should.equal(true)
    })
  })
})
