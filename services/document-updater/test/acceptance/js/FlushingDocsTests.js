/* eslint-disable
    camelcase,
    handle-callback-err,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const async = require('async')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Flushing a doc to Mongo', function () {
  before(function (done) {
    this.lines = ['one', 'two', 'three']
    this.version = 42
    this.update = {
      doc: this.doc_id,
      meta: { user_id: 'last-author-fake-id' },
      op: [
        {
          i: 'one and a half\n',
          p: 4,
        },
      ],
      v: this.version,
    }
    this.result = ['one', 'one and a half', 'two', 'three']
    return DocUpdaterApp.ensureRunning(done)
  })

  describe('when the updated doc exists in the doc updater', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      sinon.spy(MockWebApi, 'setDocument')

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      return DocUpdaterClient.sendUpdates(
        this.project_id,
        this.doc_id,
        [this.update],
        error => {
          if (error != null) {
            throw error
          }
          return setTimeout(() => {
            return DocUpdaterClient.flushDoc(this.project_id, this.doc_id, done)
          }, 200)
        }
      )
    })

    after(function () {
      return MockWebApi.setDocument.restore()
    })

    it('should flush the updated doc lines and version to the web api', function () {
      return MockWebApi.setDocument
        .calledWith(this.project_id, this.doc_id, this.result, this.version + 1)
        .should.equal(true)
    })

    return it('should flush the last update author and time to the web api', function () {
      const lastUpdatedAt = MockWebApi.setDocument.lastCall.args[5]
      parseInt(lastUpdatedAt).should.be.closeTo(new Date().getTime(), 30000)

      const lastUpdatedBy = MockWebApi.setDocument.lastCall.args[6]
      return lastUpdatedBy.should.equal('last-author-fake-id')
    })
  })

  describe('when the doc does not exist in the doc updater', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
      })
      sinon.spy(MockWebApi, 'setDocument')
      return DocUpdaterClient.flushDoc(this.project_id, this.doc_id, done)
    })

    after(function () {
      return MockWebApi.setDocument.restore()
    })

    return it('should not flush the doc to the web api', function () {
      return MockWebApi.setDocument.called.should.equal(false)
    })
  })

  return describe('when the web api http request takes a long time on first request', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      let t = 30000
      sinon
        .stub(MockWebApi, 'setDocument')
        .callsFake(
          (
            project_id,
            doc_id,
            lines,
            version,
            ranges,
            lastUpdatedAt,
            lastUpdatedBy,
            callback
          ) => {
            if (callback == null) {
              callback = function (error) {}
            }
            setTimeout(callback, t)
            return (t = 0)
          }
        )
      return DocUpdaterClient.preloadDoc(this.project_id, this.doc_id, done)
    })

    after(function () {
      return MockWebApi.setDocument.restore()
    })

    return it('should still work', function (done) {
      const start = Date.now()
      return DocUpdaterClient.flushDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          res.statusCode.should.equal(204)
          const delta = Date.now() - start
          expect(delta).to.be.below(20000)
          return done()
        }
      )
    })
  })
})
