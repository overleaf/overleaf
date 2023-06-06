const sinon = require('sinon')
const { expect } = require('chai')
const Settings = require('@overleaf/settings')
const docUpdaterRedis = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const Keys = Settings.redis.documentupdater.key_schema

const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Setting a document', function () {
  let numberOfReceivedUpdates = 0
  before(function (done) {
    DocUpdaterClient.subscribeToAppliedOps(() => {
      numberOfReceivedUpdates++
    })
    this.lines = ['one', 'two', 'three']
    this.version = 42
    this.update = {
      doc: this.doc_id,
      op: [
        {
          i: 'one and a half\n',
          p: 4,
        },
      ],
      v: this.version,
    }
    this.result = ['one', 'one and a half', 'two', 'three']
    this.newLines = ['these', 'are', 'the', 'new', 'lines']
    this.source = 'dropbox'
    this.user_id = 'user-id-123'

    sinon.spy(MockProjectHistoryApi, 'flushProject')
    sinon.spy(MockWebApi, 'setDocument')
    DocUpdaterApp.ensureRunning(done)
  })

  after(function () {
    MockProjectHistoryApi.flushProject.restore()
    MockWebApi.setDocument.restore()
  })

  describe('when the updated doc exists in the doc updater', function () {
    before(function (done) {
      numberOfReceivedUpdates = 0
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      DocUpdaterClient.preloadDoc(this.project_id, this.doc_id, error => {
        if (error) {
          throw error
        }
        DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          error => {
            if (error) {
              throw error
            }
            setTimeout(() => {
              DocUpdaterClient.setDocLines(
                this.project_id,
                this.doc_id,
                this.newLines,
                this.source,
                this.user_id,
                false,
                (error, res, body) => {
                  if (error) {
                    return done(error)
                  }
                  this.statusCode = res.statusCode
                  this.body = body
                  done()
                }
              )
            }, 200)
          }
        )
      })
    })

    after(function () {
      MockProjectHistoryApi.flushProject.resetHistory()
      MockWebApi.setDocument.resetHistory()
    })

    it('should return a 200 status code', function () {
      this.statusCode.should.equal(200)
    })

    it('should emit two updates (from sendUpdate and setDocLines)', function () {
      expect(numberOfReceivedUpdates).to.equal(2)
    })

    it('should send the updated doc lines and version to the web api', function () {
      MockWebApi.setDocument
        .calledWith(this.project_id, this.doc_id, this.newLines)
        .should.equal(true)
    })

    it('should update the lines in the doc updater', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          if (error) {
            return done(error)
          }
          doc.lines.should.deep.equal(this.newLines)
          done()
        }
      )
    })

    it('should bump the version in the doc updater', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          if (error) {
            return done(error)
          }
          doc.version.should.equal(this.version + 2)
          done()
        }
      )
    })

    it('should leave the document in redis', function (done) {
      docUpdaterRedis.get(
        Keys.docLines({ doc_id: this.doc_id }),
        (error, lines) => {
          if (error) {
            throw error
          }
          expect(JSON.parse(lines)).to.deep.equal(this.newLines)
          done()
        }
      )
    })

    it('should return the mongo rev in the json response', function () {
      this.body.should.deep.equal({ rev: '123' })
    })

    describe('when doc has the same contents', function () {
      beforeEach(function (done) {
        numberOfReceivedUpdates = 0
        DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.source,
          this.user_id,
          false,
          (error, res, body) => {
            if (error) {
              return done(error)
            }
            this.statusCode = res.statusCode
            this.body = body
            done()
          }
        )
      })

      it('should not bump the version in doc updater', function (done) {
        DocUpdaterClient.getDoc(
          this.project_id,
          this.doc_id,
          (error, res, doc) => {
            if (error) {
              return done(error)
            }
            doc.version.should.equal(this.version + 2)
            done()
          }
        )
      })

      it('should not emit any updates', function (done) {
        setTimeout(() => {
          expect(numberOfReceivedUpdates).to.equal(0)
          done()
        }, 100) // delay by 100ms: make sure we do not check too early!
      })
    })
  })

  describe('when the updated doc does not exist in the doc updater', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      numberOfReceivedUpdates = 0
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      DocUpdaterClient.setDocLines(
        this.project_id,
        this.doc_id,
        this.newLines,
        this.source,
        this.user_id,
        false,
        (error, res, body) => {
          if (error) {
            return done(error)
          }
          this.statusCode = res.statusCode
          this.body = body
          setTimeout(done, 200)
        }
      )
    })

    after(function () {
      MockProjectHistoryApi.flushProject.resetHistory()
      MockWebApi.setDocument.resetHistory()
    })

    it('should return a 200 status code', function () {
      this.statusCode.should.equal(200)
    })

    it('should emit an update', function () {
      expect(numberOfReceivedUpdates).to.equal(1)
    })

    it('should send the updated doc lines to the web api', function () {
      MockWebApi.setDocument
        .calledWith(this.project_id, this.doc_id, this.newLines)
        .should.equal(true)
    })

    it('should flush project history', function () {
      MockProjectHistoryApi.flushProject
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should remove the document from redis', function (done) {
      docUpdaterRedis.get(
        Keys.docLines({ doc_id: this.doc_id }),
        (error, lines) => {
          if (error) {
            throw error
          }
          expect(lines).to.not.exist
          done()
        }
      )
    })

    it('should return the mongo rev in the json response', function () {
      this.body.should.deep.equal({ rev: '123' })
    })
  })

  const DOC_TOO_LARGE_TEST_CASES = [
    {
      desc: 'when the updated doc is too large for the body parser',
      size: Settings.maxJsonRequestSize,
      expectedStatusCode: 413,
    },
    {
      desc: 'when the updated doc is larger than the HTTP controller limit',
      size: Settings.max_doc_length,
      expectedStatusCode: 406,
    },
  ]

  DOC_TOO_LARGE_TEST_CASES.forEach(testCase => {
    describe(testCase.desc, function () {
      before(function (done) {
        this.project_id = DocUpdaterClient.randomId()
        this.doc_id = DocUpdaterClient.randomId()
        MockWebApi.insertDoc(this.project_id, this.doc_id, {
          lines: this.lines,
          version: this.version,
        })
        this.newLines = []
        while (JSON.stringify(this.newLines).length <= testCase.size) {
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
            if (error) {
              return done(error)
            }
            this.statusCode = res.statusCode
            setTimeout(done, 200)
          }
        )
      })

      after(function () {
        MockProjectHistoryApi.flushProject.resetHistory()
        MockWebApi.setDocument.resetHistory()
      })

      it(`should return a ${testCase.expectedStatusCode} status code`, function () {
        this.statusCode.should.equal(testCase.expectedStatusCode)
      })

      it('should not send the updated doc lines to the web api', function () {
        MockWebApi.setDocument.called.should.equal(false)
      })

      it('should not flush project history', function () {
        MockProjectHistoryApi.flushProject.called.should.equal(false)
      })
    })
  })

  describe('when the updated doc is large but under the bodyParser and HTTPController size limit', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
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
          if (error) {
            return done(error)
          }
          this.statusCode = res.statusCode
          this.body = body
          setTimeout(done, 200)
        }
      )
    })

    after(function () {
      MockProjectHistoryApi.flushProject.resetHistory()
      MockWebApi.setDocument.resetHistory()
    })

    it('should return a 200 status code', function () {
      this.statusCode.should.equal(200)
    })

    it('should send the updated doc lines to the web api', function () {
      MockWebApi.setDocument
        .calledWith(this.project_id, this.doc_id, this.newLines)
        .should.equal(true)
    })

    it('should return the mongo rev in the json response', function () {
      this.body.should.deep.equal({ rev: '123' })
    })
  })

  describe('with track changes', function () {
    before(function () {
      this.lines = ['one', 'one and a half', 'two', 'three']
      this.id_seed = '587357bd35e64f6157'
      this.update = {
        doc: this.doc_id,
        op: [
          {
            d: 'one and a half\n',
            p: 4,
          },
        ],
        meta: {
          tc: this.id_seed,
          user_id: this.user_id,
        },
        v: this.version,
      }
    })

    describe('with the undo flag', function () {
      before(function (done) {
        this.project_id = DocUpdaterClient.randomId()
        this.doc_id = DocUpdaterClient.randomId()
        MockWebApi.insertDoc(this.project_id, this.doc_id, {
          lines: this.lines,
          version: this.version,
        })
        DocUpdaterClient.preloadDoc(this.project_id, this.doc_id, error => {
          if (error) {
            throw error
          }
          DocUpdaterClient.sendUpdate(
            this.project_id,
            this.doc_id,
            this.update,
            error => {
              if (error) {
                throw error
              }
              // Go back to old lines, with undo flag
              DocUpdaterClient.setDocLines(
                this.project_id,
                this.doc_id,
                this.lines,
                this.source,
                this.user_id,
                true,
                (error, res, body) => {
                  if (error) {
                    return done(error)
                  }
                  this.statusCode = res.statusCode
                  setTimeout(done, 200)
                }
              )
            }
          )
        })
      })

      after(function () {
        MockProjectHistoryApi.flushProject.resetHistory()
        MockWebApi.setDocument.resetHistory()
      })

      it('should undo the tracked changes', function (done) {
        DocUpdaterClient.getDoc(
          this.project_id,
          this.doc_id,
          (error, res, data) => {
            if (error) {
              throw error
            }
            const { ranges } = data
            expect(ranges.changes).to.be.undefined
            done()
          }
        )
      })
    })

    describe('without the undo flag', function () {
      before(function (done) {
        this.project_id = DocUpdaterClient.randomId()
        this.doc_id = DocUpdaterClient.randomId()
        MockWebApi.insertDoc(this.project_id, this.doc_id, {
          lines: this.lines,
          version: this.version,
        })
        DocUpdaterClient.preloadDoc(this.project_id, this.doc_id, error => {
          if (error) {
            throw error
          }
          DocUpdaterClient.sendUpdate(
            this.project_id,
            this.doc_id,
            this.update,
            error => {
              if (error) {
                throw error
              }
              // Go back to old lines, without undo flag
              DocUpdaterClient.setDocLines(
                this.project_id,
                this.doc_id,
                this.lines,
                this.source,
                this.user_id,
                false,
                (error, res, body) => {
                  if (error) {
                    return done(error)
                  }
                  this.statusCode = res.statusCode
                  setTimeout(done, 200)
                }
              )
            }
          )
        })
      })

      after(function () {
        MockProjectHistoryApi.flushProject.resetHistory()
        MockWebApi.setDocument.resetHistory()
      })

      it('should not undo the tracked changes', function (done) {
        DocUpdaterClient.getDoc(
          this.project_id,
          this.doc_id,
          (error, res, data) => {
            if (error) {
              throw error
            }
            const { ranges } = data
            expect(ranges.changes.length).to.equal(1)
            done()
          }
        )
      })
    })
  })
})
