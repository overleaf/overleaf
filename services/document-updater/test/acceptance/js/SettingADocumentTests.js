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
    this.user_id = DocUpdaterClient.randomId()

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
        .calledWith(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.version + 2,
          {},
          sinon.match.string,
          this.user_id
        )
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

  describe('with a null user id', function () {
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
        null,
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
        .calledWith(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.version + 2,
          {},
          sinon.match.string,
          null
        )
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
      await DocUpdaterClient.waitForPendingUpdates(this.project_id, this.doc_id)
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

    it('should provide the tracked changes in editor format when getting the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      expect(doc.ranges.changes).to.have.length(1)
      const [change] = doc.ranges.changes
      expect(change.id).to.match(/^[0-9a-f]{24}$/)
      expect(change.op).to.deep.equal({ p: 4, d: 'one and a half\n' })
      expect(change.metadata).to.deep.equal({ user_id: userId, ts })
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

    describe('with track changes enabled', function () {
      async function getDocRaw(docId) {
        return JSON.parse(
          await docUpdaterRedis.get(Keys.docLines({ doc_id: docId }))
        )
      }

      function expectRecentTimestamp(tracking) {
        expect(new Date(tracking.ts).getTime()).to.be.closeTo(
          Date.now(),
          30_000
        )
        return tracking.ts
      }

      describe('when adding content', function () {
        beforeEach(async function () {
          this.body = await DocUpdaterClient.setDocLines(
            this.project_id,
            this.doc_id,
            ['one', 'INSERT', 'two', 'three'],
            this.source,
            userId,
            false,
            true
          )
        })

        it('should record the insertion as a tracked insert', async function () {
          const data = await getDocRaw(this.doc_id)
          const insertTs = expectRecentTimestamp(
            data.trackedChanges[0].tracking
          )
          expect(data).to.deep.equal({
            content: 'one\nINSERT\none and a half\ntwo\nthree',
            trackedChanges: [
              {
                range: { pos: 4, length: 'INSERT\n'.length },
                tracking: { ts: insertTs, type: 'insert', userId },
              },
              {
                range: { pos: 'INSERT\n'.length + 4, length: 15 },
                tracking: { ts, type: 'delete', userId },
              },
            ],
          })
        })
      })

      describe('when removing content', function () {
        beforeEach(async function () {
          this.body = await DocUpdaterClient.setDocLines(
            this.project_id,
            this.doc_id,
            ['one', 'two'],
            this.source,
            userId,
            false,
            true
          )
        })

        it('should record the removal as a tracked delete, keeping the content', async function () {
          const data = await getDocRaw(this.doc_id)
          const deleteTs = expectRecentTimestamp(
            data.trackedChanges[1].tracking
          )
          expect(data).to.deep.equal({
            content: 'one\none and a half\ntwo\nthree',
            trackedChanges: [
              {
                range: { pos: 4, length: 15 },
                tracking: { ts, type: 'delete', userId },
              },
              {
                range: { pos: 22, length: '\nthree'.length },
                tracking: { ts: deleteTs, type: 'delete', userId },
              },
            ],
          })
        })

        it('should hide the removed content from the doc lines', async function () {
          const doc = await DocUpdaterClient.getDoc(
            this.project_id,
            this.doc_id
          )
          expect(doc.lines).to.deep.equal(['one', 'two'])
        })

        it('should provide the tracked deletes in editor format when getting the doc', async function () {
          const doc = await DocUpdaterClient.getDoc(
            this.project_id,
            this.doc_id
          )
          expect(doc.ranges.changes.map(change => change.op)).to.deep.equal([
            { p: 4, d: 'one and a half\n' },
            { p: 7, d: '\nthree' },
          ])
        })
      })

      describe('when appending content', function () {
        beforeEach(async function () {
          this.body = await DocUpdaterClient.appendToDoc(
            this.project_id,
            this.doc_id,
            ['four'],
            this.source,
            userId,
            true
          )
        })

        it('should record the appended content as a tracked insert', async function () {
          const data = await getDocRaw(this.doc_id)
          const insertTs = expectRecentTimestamp(
            data.trackedChanges[1].tracking
          )
          expect(data).to.deep.equal({
            content: 'one\none and a half\ntwo\nthree\nfour',
            trackedChanges: [
              {
                range: { pos: 4, length: 15 },
                tracking: { ts, type: 'delete', userId },
              },
              {
                range: { pos: 28, length: '\nfour'.length },
                tracking: { ts: insertTs, type: 'insert', userId },
              },
            ],
          })
        })

        it('should include the appended content in the doc lines', async function () {
          const doc = await DocUpdaterClient.getDoc(
            this.project_id,
            this.doc_id
          )
          expect(doc.lines).to.deep.equal(['one', 'two', 'three', 'four'])
        })

        it('should provide the tracked insert in editor format when getting the doc', async function () {
          const doc = await DocUpdaterClient.getDoc(
            this.project_id,
            this.doc_id
          )
          expect(doc.ranges.changes.map(change => change.op)).to.deep.equal([
            { p: 4, d: 'one and a half\n' },
            { p: 13, i: '\nfour' },
          ])
        })
      })
    })
  })

  describe('with track changes enabled (sharejs-text-ot)', function () {
    const lines = ['one', 'one and a half', 'two', 'three']
    const idSeed = '587357bd35e64f6157'
    const userId = DocUpdaterClient.randomId()

    beforeEach(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      this.update = {
        doc: this.doc_id,
        op: [
          {
            d: 'one and a half\n',
            p: 4,
          },
        ],
        meta: {
          tc: idSeed,
          user_id: userId,
        },
        v: this.version,
      }
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines,
        version: this.version,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        this.update
      )
      await DocUpdaterClient.waitForPendingUpdates(this.doc_id)
    })

    afterEach(function () {
      MockProjectHistoryApi.flushProject.resetHistory()
      MockWebApi.setDocument.resetHistory()
    })

    function expectPreservedTrackedDelete(changes) {
      const deleteChange = changes.find(
        change => change.op.d === 'one and a half\n'
      )
      expect(deleteChange.op).to.deep.equal({ d: 'one and a half\n', p: 4 })
      expect(deleteChange.id).to.equal(idSeed + '000001')
      expect(deleteChange.metadata.user_id).to.equal(userId)
    }

    function expectNewTrackedChange(change, op) {
      expect(change.op).to.deep.equal(op)
      expect(change.id).to.match(/^[0-9a-f]{24}$/)
      expect(change.id.startsWith(idSeed)).to.equal(false)
      expect(change.metadata.user_id).to.equal(userId)
      expect(new Date(change.metadata.ts).getTime()).to.be.closeTo(
        Date.now(),
        30_000
      )
    }

    describe('when adding content', function () {
      beforeEach(async function () {
        this.body = await DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          ['one', 'two', 'INSERT', 'three'],
          this.source,
          userId,
          false,
          true
        )
      })

      it('should record the insertion as a tracked insert', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        expect(doc.lines).to.deep.equal(['one', 'two', 'INSERT', 'three'])
        expect(doc.ranges.changes).to.have.length(2)
        expectPreservedTrackedDelete(doc.ranges.changes)
        const insertChange = doc.ranges.changes.find(
          change => change.op.i != null
        )
        expectNewTrackedChange(insertChange, { i: 'INSERT\n', p: 8 })
      })
    })

    describe('when removing content', function () {
      beforeEach(async function () {
        this.body = await DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          ['one', 'two'],
          this.source,
          userId,
          false,
          true
        )
      })

      it('should record the removal as a tracked delete', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        expect(doc.lines).to.deep.equal(['one', 'two'])
        expect(doc.ranges.changes).to.have.length(2)
        expectPreservedTrackedDelete(doc.ranges.changes)
        const newDeleteChange = doc.ranges.changes.find(
          change => change.op.d === '\nthree'
        )
        expectNewTrackedChange(newDeleteChange, { d: '\nthree', p: 7 })
      })
    })

    describe('when appending content', function () {
      beforeEach(async function () {
        this.body = await DocUpdaterClient.appendToDoc(
          this.project_id,
          this.doc_id,
          ['four'],
          this.source,
          userId,
          true
        )
      })

      it('should record the appended content as a tracked insert', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        expect(doc.lines).to.deep.equal(['one', 'two', 'three', 'four'])
        expect(doc.ranges.changes).to.have.length(2)
        expectPreservedTrackedDelete(doc.ranges.changes)
        const insertChange = doc.ranges.changes.find(
          change => change.op.i != null
        )
        expectNewTrackedChange(insertChange, { i: '\nfour', p: 13 })
      })
    })
  })

  describe('when track changes is requested without a user id', function () {
    beforeEach(function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
    })

    it('should reject setting the document with a 400', async function () {
      await expect(
        DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.source,
          undefined,
          false,
          true
        )
      )
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 400)
    })

    it('should reject appending to the document with a 400', async function () {
      await expect(
        DocUpdaterClient.appendToDoc(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.source,
          undefined,
          true
        )
      )
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 400)
    })
  })
  describe('when the first request returns a connection error', function () {
    beforeEach(function () {
      const origSetDocumentController =
        MockWebApi.setDocumentController.bind(MockWebApi)
      const setDocumentStub = sinon
        .stub(MockWebApi, 'setDocumentController')
        .onCall(0)
        .callsFake((req, res, next) => {
          res.destroy() // simulate a network error
        })
      setDocumentStub.onCall(1).callsFake(origSetDocumentController)
    })

    afterEach(function () {
      MockWebApi.setDocumentController.restore()
    })

    it('should retry on connection error and set the document', async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        projectHistoryId: this.project_id,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)

      await expect(
        DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.source,
          this.user_id,
          false
        )
      ).to.eventually.deep.include({ rev: '123' })

      expect(MockWebApi.setDocumentController).to.be.calledTwice
    })
  })

  describe('when the document does not exist', function () {
    before(function () {
      sinon.spy(MockWebApi, 'setDocumentController')
    })
    after(function () {
      MockWebApi.setDocumentController.restore()
    })

    it('should return 404', async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        projectHistoryId: this.project_id,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
      MockWebApi.clearDocs()

      await expect(
        DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.source,
          this.user_id,
          false
        )
      )
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 404)

      expect(MockWebApi.setDocumentController).to.be.calledOnce
    })
  })

  describe('when the document is too large', function () {
    beforeEach(function () {
      sinon
        .stub(MockWebApi, 'setDocumentController')
        .callsFake((req, res, next) => {
          res.sendStatus(413) // simulate a large file error
        })
    })

    afterEach(function () {
      MockWebApi.setDocumentController.restore()
    })

    it('should return 413', async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        projectHistoryId: this.project_id,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
      MockWebApi.clearDocs()

      await expect(
        DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.source,
          this.user_id,
          false
        )
      )
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 413)
      expect(MockWebApi.setDocumentController).to.be.calledOnce
    })
  })

  describe('when the first request returns a 500 error', function () {
    beforeEach(function () {
      const origSetDocumentController =
        MockWebApi.setDocumentController.bind(MockWebApi)
      const setDocumentStub = sinon
        .stub(MockWebApi, 'setDocumentController')
        .onCall(0)
        .callsFake((req, res, next) => {
          res.sendStatus(500)
        })
      setDocumentStub.onCall(1).callsFake(origSetDocumentController)
    })

    afterEach(function () {
      MockWebApi.setDocumentController.restore()
    })

    it('should retry on a 500 error and set the document', async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        projectHistoryId: this.project_id,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)

      await expect(
        DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.source,
          this.user_id,
          false
        )
      ).to.eventually.deep.include({ rev: '123' })

      expect(MockWebApi.setDocumentController).to.be.calledTwice
    })
  })

  describe('when the web api http request times out on the first request', function () {
    beforeEach(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        projectHistoryId: this.project_id,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)

      const origSetDocumentController =
        MockWebApi.setDocumentController.bind(MockWebApi)
      const setDocumentStub = sinon
        .stub(MockWebApi, 'setDocumentController')
        .onFirstCall()
        .callsFake(async (req, res, next) => {
          await setTimeout(30_000)
        })

      setDocumentStub.onCall(1).callsFake(origSetDocumentController)
    })

    afterEach(function () {
      MockWebApi.setDocumentController.restore()
    })

    it('should retry the request and return the document', async function () {
      this.timeout(10000)
      const returnedDoc = await DocUpdaterClient.setDocLines(
        this.project_id,
        this.doc_id,
        this.newLines,
        this.source,
        this.user_id,
        false
      )
      expect(returnedDoc).to.deep.include({ rev: '123' })
      expect(MockWebApi.setDocumentController).to.be.calledTwice
    })
  })

  describe('when the web api http request times out repeatedly', function () {
    beforeEach(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        projectHistoryId: this.project_id,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)

      sinon
        .stub(MockWebApi, 'setDocumentController')
        .callsFake(async (req, res, next) => {
          await setTimeout(30_000)
        })
    })

    afterEach(function () {
      MockWebApi.setDocumentController.restore()
    })

    it('should return an error after two attempts', async function () {
      this.timeout(15000)
      const start = Date.now()
      await expect(
        DocUpdaterClient.setDocLines(
          this.project_id,
          this.doc_id,
          this.newLines,
          this.source,
          this.user_id,
          false
        )
      ).to.be.rejectedWith('request failed')

      const delta = Date.now() - start
      expect(delta).to.be.above(10_000) // 2 * 5000ms timeout
      expect(delta).to.be.below(20_000)
      expect(MockWebApi.setDocumentController).to.be.calledTwice
    })
  })
})
