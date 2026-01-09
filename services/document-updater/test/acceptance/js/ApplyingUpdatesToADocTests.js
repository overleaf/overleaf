const sinon = require('sinon')
const { expect } = require('chai')
const { setTimeout } = require('node:timers/promises')
const Settings = require('@overleaf/settings')
const rclientProjectHistory = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.project_history
)
const rclientDU = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const Keys = Settings.redis.documentupdater.key_schema
const ProjectHistoryKeys = Settings.redis.project_history.key_schema

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')
const { RequestFailedError } = require('@overleaf/fetch-utils')

async function sendUpdateAndWait(projectId, docId, update) {
  await DocUpdaterClient.sendUpdate(projectId, docId, update)

  // It seems that we need to wait for a little while
  await setTimeout(200)
}

describe('Applying updates to a doc', function () {
  beforeEach(async function () {
    sinon.spy(MockWebApi, 'getDocument')
    this.lines = ['one', 'two', 'three']
    this.version = 42
    this.op = {
      i: 'one and a half\n',
      p: 4,
    }
    this.project_id = DocUpdaterClient.randomId()
    this.doc_id = DocUpdaterClient.randomId()
    this.update = {
      doc: this.doc_id,
      op: [this.op],
      v: this.version,
    }
    this.historyOTUpdate = {
      doc: this.doc_id,
      op: [{ textOperation: [4, 'one and a half\n', 9] }],
      v: this.version,
      meta: { source: 'random-publicId' },
    }
    this.result = ['one', 'one and a half', 'two', 'three']
    await DocUpdaterApp.ensureRunning()
  })

  afterEach(function () {
    sinon.restore()
  })

  describe('when the document is not loaded', function () {
    beforeEach(async function () {
      this.startTime = Date.now()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      await sendUpdateAndWait(this.project_id, this.doc_id, this.update)
      const result = await rclientProjectHistory.get(
        ProjectHistoryKeys.projectHistoryFirstOpTimestamp({
          project_id: this.project_id,
        })
      )
      this.firstOpTimestamp = parseInt(result, 10)
    })

    it('should load the document from the web API', function () {
      MockWebApi.getDocument
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should update the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.result)
    })

    it('should push the applied updates to the project history changes api', function (done) {
      rclientProjectHistory.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error != null) {
            throw error
          }
          JSON.parse(updates[0]).op.should.deep.equal([this.op])
          done()
        }
      )
    })

    it('should set the first op timestamp', function () {
      this.firstOpTimestamp.should.be.within(this.startTime, Date.now())
    })

    it('should yield last updated time', async function () {
      const { lastUpdatedAt } = await DocUpdaterClient.getProjectLastUpdatedAt(
        this.project_id
      )
      lastUpdatedAt.should.be.within(this.startTime, Date.now())
    })

    it('should yield no last updated time for another project', async function () {
      const body = await DocUpdaterClient.getProjectLastUpdatedAt(
        DocUpdaterClient.randomId()
      )
      body.should.deep.equal({})
    })

    describe('when sending another update', function () {
      beforeEach(async function () {
        this.timeout(10000)
        this.second_update = Object.assign({}, this.update)
        this.second_update.v = this.version + 1
        this.secondStartTime = Date.now()
        await sendUpdateAndWait(
          this.project_id,
          this.doc_id,
          this.second_update
        )
      })

      it('should update the doc', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        doc.lines.should.deep.equal([
          'one',
          'one and a half',
          'one and a half',
          'two',
          'three',
        ])
      })

      it('should not change the first op timestamp', function (done) {
        rclientProjectHistory.get(
          ProjectHistoryKeys.projectHistoryFirstOpTimestamp({
            project_id: this.project_id,
          }),
          (error, result) => {
            if (error != null) {
              throw error
            }
            result = parseInt(result, 10)
            result.should.equal(this.firstOpTimestamp)
            done()
          }
        )
      })

      it('should yield last updated time', async function () {
        const { lastUpdatedAt } =
          await DocUpdaterClient.getProjectLastUpdatedAt(this.project_id)
        lastUpdatedAt.should.be.within(this.secondStartTime, Date.now())
      })
    })

    describe('when another client is sending a concurrent update', function () {
      beforeEach(async function () {
        this.timeout(10000)
        this.otherUpdate = {
          doc: this.doc_id,
          op: [{ p: 8, i: 'two and a half\n' }],
          v: this.version,
          meta: { source: 'other-random-publicId' },
        }
        this.secondStartTime = Date.now()
        await sendUpdateAndWait(this.project_id, this.doc_id, this.otherUpdate)
      })

      it('should update the doc', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        doc.lines.should.deep.equal([
          'one',
          'one and a half',
          'two',
          'two and a half',
          'three',
        ])
      })

      it('should not change the first op timestamp', function (done) {
        rclientProjectHistory.get(
          ProjectHistoryKeys.projectHistoryFirstOpTimestamp({
            project_id: this.project_id,
          }),
          (error, result) => {
            if (error != null) {
              throw error
            }
            result = parseInt(result, 10)
            result.should.equal(this.firstOpTimestamp)
            done()
          }
        )
      })

      it('should yield last updated time', async function () {
        const { lastUpdatedAt } =
          await DocUpdaterClient.getProjectLastUpdatedAt(this.project_id)
        lastUpdatedAt.should.be.within(this.secondStartTime, Date.now())
      })
    })
  })

  describe('when the document is not loaded (history-ot)', function () {
    beforeEach(async function () {
      this.startTime = Date.now()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        otMigrationStage: 1,
      })
      await sendUpdateAndWait(
        this.project_id,
        this.doc_id,
        this.historyOTUpdate
      )
      const result = await rclientProjectHistory.get(
        ProjectHistoryKeys.projectHistoryFirstOpTimestamp({
          project_id: this.project_id,
        })
      )
      this.firstOpTimestamp = parseInt(result, 10)
    })

    it('should load the document from the web API', function () {
      MockWebApi.getDocument
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should update the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.result)
    })

    it('should push the applied updates to the project history changes api', function (done) {
      rclientProjectHistory.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error != null) {
            throw error
          }
          JSON.parse(updates[0]).op.should.deep.equal(this.historyOTUpdate.op)
          JSON.parse(updates[0]).meta.pathname.should.equal('/a/b/c.tex')

          done()
        }
      )
    })

    it('should set the first op timestamp', function () {
      this.firstOpTimestamp.should.be.within(this.startTime, Date.now())
    })

    it('should yield last updated time', async function () {
      const { lastUpdatedAt } = await DocUpdaterClient.getProjectLastUpdatedAt(
        this.project_id
      )
      lastUpdatedAt.should.be.within(this.startTime, Date.now())
    })

    it('should yield no last updated time for another project', async function () {
      const body = await DocUpdaterClient.getProjectLastUpdatedAt(
        DocUpdaterClient.randomId()
      )
      body.should.deep.equal({})
    })

    describe('when sending another update', function () {
      beforeEach(async function () {
        this.timeout(10000)
        this.second_update = Object.assign({}, this.historyOTUpdate)
        this.second_update.op = [
          {
            textOperation: [4, 'one and a half\n', 24],
          },
        ]
        this.second_update.v = this.version + 1
        this.secondStartTime = Date.now()
        await sendUpdateAndWait(
          this.project_id,
          this.doc_id,
          this.second_update
        )
      })

      it('should update the doc', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        doc.lines.should.deep.equal([
          'one',
          'one and a half',
          'one and a half',
          'two',
          'three',
        ])
      })

      it('should not change the first op timestamp', function (done) {
        rclientProjectHistory.get(
          ProjectHistoryKeys.projectHistoryFirstOpTimestamp({
            project_id: this.project_id,
          }),
          (error, result) => {
            if (error != null) {
              throw error
            }
            result = parseInt(result, 10)
            result.should.equal(this.firstOpTimestamp)
            done()
          }
        )
      })

      it('should yield last updated time', async function () {
        const { lastUpdatedAt } =
          await DocUpdaterClient.getProjectLastUpdatedAt(this.project_id)
        lastUpdatedAt.should.be.within(this.secondStartTime, Date.now())
      })
    })

    describe('when another client is sending a concurrent update', function () {
      beforeEach(async function () {
        this.timeout(10000)
        this.otherUpdate = {
          doc: this.doc_id,
          op: [{ textOperation: [8, 'two and a half\n', 5] }],
          v: this.version,
          meta: { source: 'other-random-publicId' },
        }
        this.secondStartTime = Date.now()
        await sendUpdateAndWait(this.project_id, this.doc_id, this.otherUpdate)
      })

      it('should update the doc', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        doc.lines.should.deep.equal([
          'one',
          'one and a half',
          'two',
          'two and a half',
          'three',
        ])
      })

      it('should not change the first op timestamp', function (done) {
        rclientProjectHistory.get(
          ProjectHistoryKeys.projectHistoryFirstOpTimestamp({
            project_id: this.project_id,
          }),
          (error, result) => {
            if (error != null) {
              throw error
            }
            result = parseInt(result, 10)
            result.should.equal(this.firstOpTimestamp)
            done()
          }
        )
      })

      it('should yield last updated time', async function () {
        const { lastUpdatedAt } =
          await DocUpdaterClient.getProjectLastUpdatedAt(this.project_id)
        lastUpdatedAt.should.be.within(this.secondStartTime, Date.now())
      })
    })
  })

  describe('when the document is loaded', function () {
    beforeEach(async function () {
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
      sinon.resetHistory()
      await sendUpdateAndWait(this.project_id, this.doc_id, this.update)
    })

    it('should not need to call the web api', function () {
      MockWebApi.getDocument.called.should.equal(false)
    })

    it('should update the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.result)
    })

    it('should push the applied updates to the project history changes api', function (done) {
      rclientProjectHistory.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error) return done(error)
          JSON.parse(updates[0]).op.should.deep.equal([this.op])
          done()
        }
      )
    })
  })

  describe('when the document is loaded and is using project-history only', function () {
    beforeEach(async function () {
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
      sinon.resetHistory()
      await sendUpdateAndWait(this.project_id, this.doc_id, this.update)
    })

    it('should update the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.result)
    })

    it('should push the applied updates to the project history changes api', function (done) {
      rclientProjectHistory.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error) return done(error)
          JSON.parse(updates[0]).op.should.deep.equal([this.op])
          done()
        }
      )
    })
  })

  describe('when the document is loaded (history-ot)', function () {
    beforeEach(async function () {
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        otMigrationStage: 1,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
      await sendUpdateAndWait(
        this.project_id,
        this.doc_id,
        this.historyOTUpdate
      )
    })

    it('should update the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.result)
    })

    it('should push the applied updates to the project history changes api', function (done) {
      rclientProjectHistory.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error) return done(error)
          JSON.parse(updates[0]).op.should.deep.equal(this.historyOTUpdate.op)
          JSON.parse(updates[0]).meta.pathname.should.equal('/a/b/c.tex')
          done()
        }
      )
    })
  })

  describe('when the document has been deleted', function () {
    describe('when the ops come in a single linear order', function () {
      beforeEach(async function () {
        const lines = ['', '', '']
        MockWebApi.insertDoc(this.project_id, this.doc_id, {
          lines,
          version: 0,
        })
        this.updates = [
          { doc_id: this.doc_id, v: 0, op: [{ i: 'h', p: 0 }] },
          { doc_id: this.doc_id, v: 1, op: [{ i: 'e', p: 1 }] },
          { doc_id: this.doc_id, v: 2, op: [{ i: 'l', p: 2 }] },
          { doc_id: this.doc_id, v: 3, op: [{ i: 'l', p: 3 }] },
          { doc_id: this.doc_id, v: 4, op: [{ i: 'o', p: 4 }] },
          { doc_id: this.doc_id, v: 5, op: [{ i: ' ', p: 5 }] },
          { doc_id: this.doc_id, v: 6, op: [{ i: 'w', p: 6 }] },
          { doc_id: this.doc_id, v: 7, op: [{ i: 'o', p: 7 }] },
          { doc_id: this.doc_id, v: 8, op: [{ i: 'r', p: 8 }] },
          { doc_id: this.doc_id, v: 9, op: [{ i: 'l', p: 9 }] },
          { doc_id: this.doc_id, v: 10, op: [{ i: 'd', p: 10 }] },
        ]
        this.my_result = ['hello world', '', '']

        for (const update of this.updates.slice(0, 6)) {
          await DocUpdaterClient.sendUpdate(
            this.project_id,
            this.doc_id,
            update
          )
        }

        await DocUpdaterClient.deleteDoc(this.project_id, this.doc_id)

        for (const update of this.updates.slice(6)) {
          await DocUpdaterClient.sendUpdate(
            this.project_id,
            this.doc_id,
            update
          )
        }

        await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      })

      it('should be able to continue applying updates when the project has been deleted', async function () {
        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        doc.lines.should.deep.equal(this.my_result)
      })

      it('should store the doc ops in the correct order', function (done) {
        rclientDU.lrange(
          Keys.docOps({ doc_id: this.doc_id }),
          0,
          -1,
          (error, updates) => {
            if (error) return done(error)
            updates = updates.map(u => JSON.parse(u))
            for (let i = 0; i < this.updates.length; i++) {
              const appliedUpdate = this.updates[i]
              appliedUpdate.op.should.deep.equal(updates[i].op)
            }
            done()
          }
        )
      })
    })

    describe('when older ops come in after the delete', function () {
      beforeEach(function () {
        const lines = ['', '', '']
        MockWebApi.insertDoc(this.project_id, this.doc_id, {
          lines,
          version: 0,
        })
        this.updates = [
          { doc_id: this.doc_id, v: 0, op: [{ i: 'h', p: 0 }] },
          { doc_id: this.doc_id, v: 1, op: [{ i: 'e', p: 1 }] },
          { doc_id: this.doc_id, v: 2, op: [{ i: 'l', p: 2 }] },
          { doc_id: this.doc_id, v: 3, op: [{ i: 'l', p: 3 }] },
          { doc_id: this.doc_id, v: 4, op: [{ i: 'o', p: 4 }] },
          { doc_id: this.doc_id, v: 0, op: [{ i: 'world', p: 1 }] },
        ]
        this.my_result = ['hello', 'world', '']
      })

      it('should be able to continue applying updates when the project has been deleted', async function () {
        for (const update of this.updates.slice(0, 5)) {
          await DocUpdaterClient.sendUpdate(
            this.project_id,
            this.doc_id,
            update
          )
        }

        await DocUpdaterClient.deleteDoc(this.project_id, this.doc_id)

        for (const update of this.updates.slice(5)) {
          await DocUpdaterClient.sendUpdate(
            this.project_id,
            this.doc_id,
            update
          )
        }

        const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
        doc.lines.should.deep.equal(this.my_result)
      })
    })
  })

  describe('with a broken update', function () {
    beforeEach(async function () {
      this.broken_update = {
        doc: this.doc_id,
        v: this.version,
        op: [{ d: 'not the correct content', p: 0 }],
      }
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })

      DocUpdaterClient.subscribeToAppliedOps(
        (this.messageCallback = sinon.stub())
      )

      await sendUpdateAndWait(this.project_id, this.doc_id, this.broken_update)
    })

    it('should not update the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.lines)
    })

    it('should send a message with an error', function () {
      this.messageCallback.called.should.equal(true)
      const [channel, message] = this.messageCallback.args[0]
      channel.should.equal('applied-ops')
      JSON.parse(message).should.deep.include({
        project_id: this.project_id,
        doc_id: this.doc_id,
        error: 'Delete component does not match',
      })
    })
  })

  describe('with a broken update (history-ot)', function () {
    beforeEach(async function () {
      this.broken_update = {
        doc: this.doc_id,
        v: this.version,
        op: [{ textOperation: [99, -1] }],
        meta: { source: '42' },
      }
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        otMigrationStage: 1,
      })

      DocUpdaterClient.subscribeToAppliedOps(
        (this.messageCallback = sinon.stub())
      )

      await sendUpdateAndWait(this.project_id, this.doc_id, this.broken_update)
    })

    it('should not update the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.lines)
    })

    it('should send a message with an error', function () {
      this.messageCallback.called.should.equal(true)
      const [channel, message] = this.messageCallback.args[0]
      channel.should.equal('applied-ops')
      JSON.parse(message).should.deep.include({
        project_id: this.project_id,
        doc_id: this.doc_id,
        error:
          "The operation's base length must be equal to the string's length.",
      })
    })
  })

  describe('when mixing ot types (sharejs-text-ot -> history-ot)', function () {
    beforeEach(async function () {
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        otMigrationStage: 0,
      })

      DocUpdaterClient.subscribeToAppliedOps(
        (this.messageCallback = sinon.stub())
      )

      await sendUpdateAndWait(
        this.project_id,
        this.doc_id,
        this.historyOTUpdate
      )
    })

    it('should not update the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.lines)
    })

    it('should send a message with an error', function () {
      this.messageCallback.called.should.equal(true)
      const [channel, message] = this.messageCallback.args[0]
      channel.should.equal('applied-ops')
      JSON.parse(message).should.deep.include({
        project_id: this.project_id,
        doc_id: this.doc_id,
        error: 'ot type mismatch',
      })
    })
  })

  describe('when mixing ot types (history-ot -> sharejs-text-ot)', function () {
    beforeEach(async function () {
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        otMigrationStage: 1,
      })

      DocUpdaterClient.subscribeToAppliedOps(
        (this.messageCallback = sinon.stub())
      )

      await sendUpdateAndWait(this.project_id, this.doc_id, this.update)
    })

    it('should not update the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.lines)
    })

    it('should send a message with an error', function () {
      this.messageCallback.called.should.equal(true)
      const [channel, message] = this.messageCallback.args[0]
      channel.should.equal('applied-ops')
      JSON.parse(message).should.deep.include({
        project_id: this.project_id,
        doc_id: this.doc_id,
        error: 'ot type mismatch',
      })
    })
  })

  describe('when there is no version in Mongo', function () {
    beforeEach(async function () {
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
      })

      const update = {
        doc: this.doc_id,
        op: this.update.op,
        v: 0,
      }
      await sendUpdateAndWait(this.project_id, this.doc_id, update)
    })

    it('should update the doc (using version = 0)', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.result)
    })
  })

  describe('when the sending duplicate ops', function () {
    beforeEach(async function () {
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })

      DocUpdaterClient.subscribeToAppliedOps(
        (this.messageCallback = sinon.stub())
      )

      // One user delete 'one', the next turns it into 'once'. The second becomes a NOP.
      await sendUpdateAndWait(this.project_id, this.doc_id, {
        doc: this.doc_id,
        op: [
          {
            i: 'one and a half\n',
            p: 4,
          },
        ],
        v: this.version,
        meta: {
          source: 'ikHceq3yfAdQYzBo4-xZ',
        },
      })

      await sendUpdateAndWait(this.project_id, this.doc_id, {
        doc: this.doc_id,
        op: [
          {
            i: 'one and a half\n',
            p: 4,
          },
        ],
        v: this.version,
        dupIfSource: ['ikHceq3yfAdQYzBo4-xZ'],
        meta: {
          source: 'ikHceq3yfAdQYzBo4-xZ',
        },
      })
    })

    it('should update the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.result)
    })

    it('should return a message about duplicate ops', function () {
      this.messageCallback.calledTwice.should.equal(true)
      this.messageCallback.args[0][0].should.equal('applied-ops')
      expect(JSON.parse(this.messageCallback.args[0][1]).op.dup).to.be.undefined
      this.messageCallback.args[1][0].should.equal('applied-ops')
      expect(JSON.parse(this.messageCallback.args[1][1]).op.dup).to.equal(true)
    })
  })

  describe('when sending duplicate ops (history-ot)', function () {
    beforeEach(async function () {
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        otMigrationStage: 1,
      })

      DocUpdaterClient.subscribeToAppliedOps(
        (this.messageCallback = sinon.stub())
      )

      // One user delete 'one', the next turns it into 'once'. The second becomes a NOP.
      await sendUpdateAndWait(this.project_id, this.doc_id, {
        doc: this.doc_id,
        op: [{ textOperation: [4, 'one and a half\n', 9] }],
        v: this.version,
        meta: {
          source: 'ikHceq3yfAdQYzBo4-xZ',
        },
      })

      await sendUpdateAndWait(this.project_id, this.doc_id, {
        doc: this.doc_id,
        op: [
          {
            textOperation: [4, 'one and a half\n', 9],
          },
        ],
        v: this.version,
        dupIfSource: ['ikHceq3yfAdQYzBo4-xZ'],
        meta: {
          source: 'ikHceq3yfAdQYzBo4-xZ',
        },
      })
    })

    it('should update the doc', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.result)
    })

    it('should return a message about duplicate ops', function () {
      this.messageCallback.calledTwice.should.equal(true)
      this.messageCallback.args[0][0].should.equal('applied-ops')
      expect(JSON.parse(this.messageCallback.args[0][1]).op.dup).to.be.undefined
      this.messageCallback.args[1][0].should.equal('applied-ops')
      expect(JSON.parse(this.messageCallback.args[1][1]).op.dup).to.equal(true)
    })
  })

  describe('when sending updates for a non-existing doc id', function () {
    beforeEach(async function () {
      this.non_existing = {
        doc: this.doc_id,
        v: this.version,
        op: [{ d: 'content', p: 0 }],
      }

      DocUpdaterClient.subscribeToAppliedOps(
        (this.messageCallback = sinon.stub())
      )

      await sendUpdateAndWait(this.project_id, this.doc_id, this.non_existing)
    })

    it('should not update or create a doc', async function () {
      await expect(DocUpdaterClient.getDoc(this.project_id, this.doc_id))
        .to.be.rejectedWith(RequestFailedError)
        .and.eventually.have.nested.property('response.status', 404)
    })

    it('should send a message with an error', function () {
      this.messageCallback.called.should.equal(true)
      const [channel, message] = this.messageCallback.args[0]
      channel.should.equal('applied-ops')
      JSON.parse(message).should.deep.include({
        project_id: this.project_id,
        doc_id: this.doc_id,
        error: `doc not not found: /project/${this.project_id}/doc/${this.doc_id}`,
      })
    })
  })
})
