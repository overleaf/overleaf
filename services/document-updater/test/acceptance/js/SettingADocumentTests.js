const sinon = require('sinon')
const { expect } = require('chai')
const { setTimeout } = require('node:timers/promises')
const Settings = require('@overleaf/settings')
const docUpdaterRedis = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const Keys = Settings.redis.documentupdater.key_schema

const MockProjectHistoryApi = require('./helpers/MockProjectHistoryApi')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')
const { RequestFailedError } = require('@overleaf/fetch-utils')

describe('Setting a document', function () {
  let numberOfReceivedUpdates = 0
  before(async function () {
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
    await DocUpdaterApp.ensureRunning()
  })

  after(function () {
    MockProjectHistoryApi.flushProject.restore()
    MockWebApi.setDocument.restore()
  })

  describe('when the updated doc exists in the doc updater', function () {
    before(async function () {
      numberOfReceivedUpdates = 0
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        this.update
      )
      await setTimeout(200)
      this.body = await DocUpdaterClient.setDocLines(
        this.project_id,
        this.doc_id,
        this.newLines,
        this.source,
        this.user_id,
        false
      )
    })

    after(function () {
      MockProjectHistoryApi.flushProject.resetHistory()
      MockWebApi.setDocument.resetHistory()
    })

    it('should emit two updates (from sendUpdate and setDocLines)', function () {
      expect(numberOfReceivedUpdates).to.equal(2)
    })

    it('should send the updated doc lines and version to the web api', function () {
      MockWebApi.setDocument
        .calledWith(this.project_id, this.doc_id, this.newLines)
        .should.equal(true)
    })

    it('should update the lines in the doc updater', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.newLines)
    })

    it('should bump the version in the doc updater', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.version.should.equal(this.version + 2)
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
      beforeEach(async function () {
        numberOfReceivedUpdates = 0
        await DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.source,
          this.user_id,
          false
        )
      })

      it('should not bump the version in doc updater', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        doc.version.should.equal(this.version + 2)
      })

      it('should not emit any updates', async function () {
        // delay by 100ms: make sure we do not check too early!
        await setTimeout(100)
        expect(numberOfReceivedUpdates).to.equal(0)
      })
    })
  })

  describe('when the updated doc exists in the doc updater (history-ot)', function () {
    before(async function () {
      numberOfReceivedUpdates = 0
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      this.historyOTUpdate = {
        doc: this.doc_id,
        op: [{ textOperation: [4, 'one and a half\n', 9] }],
        v: this.version,
        meta: { source: 'random-publicId' },
      }
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        otMigrationStage: 1,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        this.historyOTUpdate
      )
      await setTimeout(200)
      this.body = await DocUpdaterClient.setDocLines(
        this.project_id,
        this.doc_id,
        this.newLines,
        this.source,
        this.user_id,
        false
      )
    })

    after(function () {
      MockProjectHistoryApi.flushProject.resetHistory()
      MockWebApi.setDocument.resetHistory()
    })

    it('should emit two updates (from sendUpdate and setDocLines)', function () {
      expect(numberOfReceivedUpdates).to.equal(2)
    })

    it('should send the updated doc lines and version to the web api', function () {
      MockWebApi.setDocument
        .calledWith(this.project_id, this.doc_id, this.newLines)
        .should.equal(true)
    })

    it('should update the lines in the doc updater', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.newLines)
    })

    it('should bump the version in the doc updater', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.version.should.equal(this.version + 2)
    })

    it('should leave the document in redis', function (done) {
      docUpdaterRedis.get(
        Keys.docLines({ doc_id: this.doc_id }),
        (error, lines) => {
          if (error) {
            throw error
          }
          expect(JSON.parse(lines)).to.deep.equal({
            content: this.newLines.join('\n'),
          })
          done()
        }
      )
    })

    it('should return the mongo rev in the json response', function () {
      this.body.should.deep.equal({ rev: '123' })
    })

    describe('when doc has the same contents', function () {
      beforeEach(async function () {
        numberOfReceivedUpdates = 0
        this.body = await DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.source,
          this.user_id,
          false
        )
      })

      it('should not bump the version in doc updater', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        doc.version.should.equal(this.version + 2)
      })

      it('should not emit any updates', async function () {
        // delay by 100ms: make sure we do not check too early!
        await setTimeout(100)
        expect(numberOfReceivedUpdates).to.equal(0)
      })
    })
  })

  describe('when the updated doc does not exist in the doc updater', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      numberOfReceivedUpdates = 0
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      this.body = await DocUpdaterClient.setDocLines(
        this.project_id,
        this.doc_id,
        this.newLines,
        this.source,
        this.user_id,
        false
      )
      await setTimeout(200)
    })

    after(function () {
      MockProjectHistoryApi.flushProject.resetHistory()
      MockWebApi.setDocument.resetHistory()
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
      before(async function () {
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
        try {
          await DocUpdaterClient.setDocLines(
            this.project_id,
            this.doc_id,
            this.newLines,
            this.source,
            this.user_id,
            false
          )
          this.statusCode = 200
        } catch (err) {
          if (err instanceof RequestFailedError) {
            this.statusCode = err.response.status
          } else {
            throw err
          }
        }
        await setTimeout(200)
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
    before(async function () {
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
      this.body = await DocUpdaterClient.setDocLines(
        this.project_id,
        this.doc_id,
        this.newLines,
        this.source,
        this.user_id,
        false
      )
      await setTimeout(200)
    })

    after(function () {
      MockProjectHistoryApi.flushProject.resetHistory()
      MockWebApi.setDocument.resetHistory()
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
      before(async function () {
        this.project_id = DocUpdaterClient.randomId()
        this.doc_id = DocUpdaterClient.randomId()
        MockWebApi.insertDoc(this.project_id, this.doc_id, {
          lines: this.lines,
          version: this.version,
        })
        await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
        await DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          this.update
        )
        // Go back to old lines, with undo flag
        await DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          this.lines,
          this.source,
          this.user_id,
          true
        )
        await setTimeout(200)
      })

      after(function () {
        MockProjectHistoryApi.flushProject.resetHistory()
        MockWebApi.setDocument.resetHistory()
      })

      it('should undo the tracked changes', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        expect(doc.ranges.changes).to.be.undefined
      })
    })

    describe('without the undo flag', function () {
      before(async function () {
        this.project_id = DocUpdaterClient.randomId()
        this.doc_id = DocUpdaterClient.randomId()
        MockWebApi.insertDoc(this.project_id, this.doc_id, {
          lines: this.lines,
          version: this.version,
        })
        await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
        await DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          this.update
        )
        // Go back to old lines, without undo flag
        await DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          this.lines,
          this.source,
          this.user_id,
          false
        )
        await setTimeout(200)
      })

      after(function () {
        MockProjectHistoryApi.flushProject.resetHistory()
        MockWebApi.setDocument.resetHistory()
      })

      it('should not undo the tracked changes', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        expect(doc.ranges.changes.length).to.equal(1)
      })
    })
  })

  describe('with track changes (history-ot)', function () {
    const lines = ['one', 'one and a half', 'two', 'three']
    const userId = DocUpdaterClient.randomId()
    const ts = new Date().toISOString()

    beforeEach(async function () {
      numberOfReceivedUpdates = 0
      this.newLines = ['one', 'two', 'three']
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      this.historyOTUpdate = {
        doc: this.doc_id,
        op: [
          {
            textOperation: [
              4,
              {
                r: 'one and a half\n'.length,
                tracking: {
                  type: 'delete',
                  userId,
                  ts,
                },
              },
              9,
            ],
          },
        ],
        v: this.version,
        meta: { source: 'random-publicId' },
      }
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines,
        version: this.version,
        otMigrationStage: 1,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        this.historyOTUpdate
      )
      await DocUpdaterClient.waitForPendingUpdates(this.doc_id)
    })

    afterEach(function () {
      MockProjectHistoryApi.flushProject.resetHistory()
      MockWebApi.setDocument.resetHistory()
    })

    it('should record tracked changes', function (done) {
      docUpdaterRedis.get(
        Keys.docLines({ doc_id: this.doc_id }),
        (error, data) => {
          if (error) {
            throw error
          }
          expect(JSON.parse(data)).to.deep.equal({
            content: lines.join('\n'),
            trackedChanges: [
              {
                range: {
                  pos: 4,
                  length: 15,
                },
                tracking: {
                  ts,
                  type: 'delete',
                  userId,
                },
              },
            ],
          })
          done()
        }
      )
    })

    it('should apply the change', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      expect(doc.lines).to.deep.equal(this.newLines)
    })

    const cases = [
      {
        name: 'when resetting the content',
        lines,
        want: {
          content: 'one\none and a half\none and a half\ntwo\nthree',
          trackedChanges: [
            {
              range: {
                pos: 'one and a half\n'.length + 4,
                length: 15,
              },
              tracking: {
                ts,
                type: 'delete',
                userId,
              },
            },
          ],
        },
      },
      {
        name: 'when adding content before a tracked delete',
        lines: ['one', 'INSERT', 'two', 'three'],
        want: {
          content: 'one\nINSERT\none and a half\ntwo\nthree',
          trackedChanges: [
            {
              range: {
                pos: 'INSERT\n'.length + 4,
                length: 15,
              },
              tracking: {
                ts,
                type: 'delete',
                userId,
              },
            },
          ],
        },
      },
      {
        name: 'when adding content after a tracked delete',
        lines: ['one', 'two', 'INSERT', 'three'],
        want: {
          content: 'one\none and a half\ntwo\nINSERT\nthree',
          trackedChanges: [
            {
              range: {
                pos: 4,
                length: 15,
              },
              tracking: {
                ts,
                type: 'delete',
                userId,
              },
            },
          ],
        },
      },
      {
        name: 'when deleting content before a tracked delete',
        lines: ['two', 'three'],
        want: {
          content: 'one and a half\ntwo\nthree',
          trackedChanges: [
            {
              range: {
                pos: 0,
                length: 15,
              },
              tracking: {
                ts,
                type: 'delete',
                userId,
              },
            },
          ],
        },
      },
      {
        name: 'when deleting content after a tracked delete',
        lines: ['one', 'two'],
        want: {
          content: 'one\none and a half\ntwo',
          trackedChanges: [
            {
              range: {
                pos: 4,
                length: 15,
              },
              tracking: {
                ts,
                type: 'delete',
                userId,
              },
            },
          ],
        },
      },
      {
        name: 'when deleting content immediately after a tracked delete',
        lines: ['one', 'three'],
        want: {
          content: 'one\none and a half\nthree',
          trackedChanges: [
            {
              range: {
                pos: 4,
                length: 15,
              },
              tracking: {
                ts,
                type: 'delete',
                userId,
              },
            },
          ],
        },
      },
      {
        name: 'when deleting content across a tracked delete',
        lines: ['onethree'],
        want: {
          content: 'oneone and a half\nthree',
          trackedChanges: [
            {
              range: {
                pos: 3,
                length: 15,
              },
              tracking: {
                ts,
                type: 'delete',
                userId,
              },
            },
          ],
        },
      },
    ]

    for (const { name, lines, want } of cases) {
      describe(name, function () {
        beforeEach(async function () {
          this.body = await DocUpdaterClient.setDocLines(
            this.project_id,
            this.doc_id,
            lines,
            this.source,
            userId,
            false
          )
        })
        it('should update accordingly', function (done) {
          docUpdaterRedis.get(
            Keys.docLines({ doc_id: this.doc_id }),
            (error, data) => {
              if (error) {
                throw error
              }
              expect(JSON.parse(data)).to.deep.equal(want)
              done()
            }
          )
        })
      })
    }
  })
})
