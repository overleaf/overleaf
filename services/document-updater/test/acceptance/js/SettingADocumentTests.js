/* eslint-disable
    camelcase,
    handle-callback-err,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
chai.should()
const { expect } = require('chai')
const Settings = require('settings-sharelatex')
const rclient_du = require('redis-sharelatex').createClient(
  Settings.redis.documentupdater
)
const Keys = Settings.redis.documentupdater.key_schema

const MockTrackChangesApi = require('./helpers/MockTrackChangesApi')
const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Setting a document', function () {
  before(function (done) {
    this.lines = ['one', 'two', 'three']
    this.version = 42
    this.update = {
      doc: this.doc_id,
      op: [
        {
          i: 'one and a half\n',
          p: 4
        }
      ],
      v: this.version
    }
    this.result = ['one', 'one and a half', 'two', 'three']
    this.newLines = ['these', 'are', 'the', 'new', 'lines']
    this.source = 'dropbox'
    this.user_id = 'user-id-123'

    sinon.spy(MockTrackChangesApi, 'flushDoc')
    sinon.spy(MockProjectHistoryApi, 'flushProject')
    sinon.spy(MockWebApi, 'setDocument')
    return DocUpdaterApp.ensureRunning(done)
  })

  after(function () {
    MockTrackChangesApi.flushDoc.restore()
    MockProjectHistoryApi.flushProject.restore()
    return MockWebApi.setDocument.restore()
  })

  describe('when the updated doc exists in the doc updater', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version
      })
      DocUpdaterClient.preloadDoc(this.project_id, this.doc_id, (error) => {
        if (error != null) {
          throw error
        }
        return DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          (error) => {
            if (error != null) {
              throw error
            }
            return setTimeout(() => {
              return DocUpdaterClient.setDocLines(
                this.project_id,
                this.doc_id,
                this.newLines,
                this.source,
                this.user_id,
                false,
                (error, res, body) => {
                  this.statusCode = res.statusCode
                  return done()
                }
              )
            }, 200)
          }
        )
      })
      return null
    })

    after(function () {
      MockTrackChangesApi.flushDoc.reset()
      MockProjectHistoryApi.flushProject.reset()
      return MockWebApi.setDocument.reset()
    })

    it('should return a 204 status code', function () {
      return this.statusCode.should.equal(204)
    })

    it('should send the updated doc lines and version to the web api', function () {
      return MockWebApi.setDocument
        .calledWith(this.project_id, this.doc_id, this.newLines)
        .should.equal(true)
    })

    it('should update the lines in the doc updater', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.newLines)
          return done()
        }
      )
      return null
    })

    it('should bump the version in the doc updater', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          doc.version.should.equal(this.version + 2)
          return done()
        }
      )
      return null
    })

    return it('should leave the document in redis', function (done) {
      rclient_du.get(Keys.docLines({ doc_id: this.doc_id }), (error, lines) => {
        if (error != null) {
          throw error
        }
        expect(JSON.parse(lines)).to.deep.equal(this.newLines)
        return done()
      })
      return null
    })
  })

  describe('when the updated doc does not exist in the doc updater', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version
      })
      DocUpdaterClient.setDocLines(
        this.project_id,
        this.doc_id,
        this.newLines,
        this.source,
        this.user_id,
        false,
        (error, res, body) => {
          this.statusCode = res.statusCode
          return setTimeout(done, 200)
        }
      )
      return null
    })

    after(function () {
      MockTrackChangesApi.flushDoc.reset()
      MockProjectHistoryApi.flushProject.reset()
      return MockWebApi.setDocument.reset()
    })

    it('should return a 204 status code', function () {
      return this.statusCode.should.equal(204)
    })

    it('should send the updated doc lines to the web api', function () {
      return MockWebApi.setDocument
        .calledWith(this.project_id, this.doc_id, this.newLines)
        .should.equal(true)
    })

    it('should flush track changes', function () {
      return MockTrackChangesApi.flushDoc
        .calledWith(this.doc_id)
        .should.equal(true)
    })

    it('should flush project history', function () {
      return MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })

    return it('should remove the document from redis', function (done) {
      rclient_du.get(Keys.docLines({ doc_id: this.doc_id }), (error, lines) => {
        if (error != null) {
          throw error
        }
        expect(lines).to.not.exist
        return done()
      })
      return null
    })
  })

  describe('when the updated doc is too large for the body parser', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version
      })
      this.newLines = []
      while (
        JSON.stringify(this.newLines).length <= Settings.maxJsonRequestSize
      ) {
        this.newLines.push('(a long line of text)'.repeat(10000))
      }
      DocUpdaterClient.setDocLines(
        this.project_id,
        this.doc_id,
        this.newLines,
        this.source,
        this.user_id,
        false,
        (error, res, body) => {
          this.statusCode = res.statusCode
          return setTimeout(done, 200)
        }
      )
      return null
    })

    after(function () {
      MockTrackChangesApi.flushDoc.reset()
      MockProjectHistoryApi.flushProject.reset()
      return MockWebApi.setDocument.reset()
    })

    it('should return a 413 status code', function () {
      return this.statusCode.should.equal(413)
    })

    it('should not send the updated doc lines to the web api', function () {
      return MockWebApi.setDocument.called.should.equal(false)
    })

    it('should not flush track changes', function () {
      return MockTrackChangesApi.flushDoc.called.should.equal(false)
    })

    return it('should not flush project history', function () {
      return MockProjectHistoryApi.flushProject.called.should.equal(false)
    })
  })

  describe('when the updated doc is large but under the bodyParser and HTTPController size limit', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version
      })

      this.newLines = []
      while (JSON.stringify(this.newLines).length < 2 * 1024 * 1024) {
        // limit in HTTPController
        this.newLines.push('(a long line of text)'.repeat(10000))
      }
      this.newLines.pop() // remove the line which took it over the limit
      DocUpdaterClient.setDocLines(
        this.project_id,
        this.doc_id,
        this.newLines,
        this.source,
        this.user_id,
        false,
        (error, res, body) => {
          this.statusCode = res.statusCode
          return setTimeout(done, 200)
        }
      )
      return null
    })

    after(function () {
      MockTrackChangesApi.flushDoc.reset()
      MockProjectHistoryApi.flushProject.reset()
      return MockWebApi.setDocument.reset()
    })

    it('should return a 204 status code', function () {
      return this.statusCode.should.equal(204)
    })

    return it('should send the updated doc lines to the web api', function () {
      return MockWebApi.setDocument
        .calledWith(this.project_id, this.doc_id, this.newLines)
        .should.equal(true)
    })
  })

  return describe('with track changes', function () {
    before(function () {
      this.lines = ['one', 'one and a half', 'two', 'three']
      this.id_seed = '587357bd35e64f6157'
      return (this.update = {
        doc: this.doc_id,
        op: [
          {
            d: 'one and a half\n',
            p: 4
          }
        ],
        meta: {
          tc: this.id_seed,
          user_id: this.user_id
        },
        v: this.version
      })
    })

    describe('with the undo flag', function () {
      before(function (done) {
        this.project_id = DocUpdaterClient.randomId()
        this.doc_id = DocUpdaterClient.randomId()
        MockWebApi.insertDoc(this.project_id, this.doc_id, {
          lines: this.lines,
          version: this.version
        })
        DocUpdaterClient.preloadDoc(this.project_id, this.doc_id, (error) => {
          if (error != null) {
            throw error
          }
          return DocUpdaterClient.sendUpdate(
            this.project_id,
            this.doc_id,
            this.update,
            (error) => {
              if (error != null) {
                throw error
              }
              // Go back to old lines, with undo flag
              return DocUpdaterClient.setDocLines(
                this.project_id,
                this.doc_id,
                this.lines,
                this.source,
                this.user_id,
                true,
                (error, res, body) => {
                  this.statusCode = res.statusCode
                  return setTimeout(done, 200)
                }
              )
            }
          )
        })
        return null
      })

      after(function () {
        MockTrackChangesApi.flushDoc.reset()
        MockProjectHistoryApi.flushProject.reset()
        return MockWebApi.setDocument.reset()
      })

      return it('should undo the tracked changes', function (done) {
        DocUpdaterClient.getDoc(
          this.project_id,
          this.doc_id,
          (error, res, data) => {
            if (error != null) {
              throw error
            }
            const { ranges } = data
            expect(ranges.changes).to.be.undefined
            return done()
          }
        )
        return null
      })
    })

    return describe('without the undo flag', function () {
      before(function (done) {
        this.project_id = DocUpdaterClient.randomId()
        this.doc_id = DocUpdaterClient.randomId()
        MockWebApi.insertDoc(this.project_id, this.doc_id, {
          lines: this.lines,
          version: this.version
        })
        DocUpdaterClient.preloadDoc(this.project_id, this.doc_id, (error) => {
          if (error != null) {
            throw error
          }
          return DocUpdaterClient.sendUpdate(
            this.project_id,
            this.doc_id,
            this.update,
            (error) => {
              if (error != null) {
                throw error
              }
              // Go back to old lines, without undo flag
              return DocUpdaterClient.setDocLines(
                this.project_id,
                this.doc_id,
                this.lines,
                this.source,
                this.user_id,
                false,
                (error, res, body) => {
                  this.statusCode = res.statusCode
                  return setTimeout(done, 200)
                }
              )
            }
          )
        })
        return null
      })

      after(function () {
        MockTrackChangesApi.flushDoc.reset()
        MockProjectHistoryApi.flushProject.reset()
        return MockWebApi.setDocument.reset()
      })

      return it('should not undo the tracked changes', function (done) {
        DocUpdaterClient.getDoc(
          this.project_id,
          this.doc_id,
          (error, res, data) => {
            if (error != null) {
              throw error
            }
            const { ranges } = data
            expect(ranges.changes.length).to.equal(1)
            return done()
          }
        )
        return null
      })
    })
  })
})
