const sinon = require('sinon')
const { expect } = require('chai')
const { setTimeout } = require('node:timers/promises')

const { db, ObjectId } = require('../../../app/js/mongodb')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')
const RangesManager = require('../../../app/js/RangesManager')

const sandbox = sinon.createSandbox()

describe('Ranges', function () {
  before(async function () {
    await DocUpdaterApp.ensureRunning()
  })

  describe('tracking changes from ops', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.id_seed = '587357bd35e64f6157'
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['aaa'],
      }
      this.updates = [
        {
          doc: this.doc.id,
          op: [{ i: '123', p: 1 }],
          v: 0,
          meta: { user_id: this.user_id },
        },
        {
          doc: this.doc.id,
          op: [{ i: '456', p: 5 }],
          v: 1,
          meta: { user_id: this.user_id, tc: this.id_seed },
        },
        {
          doc: this.doc.id,
          op: [{ d: '12', p: 1 }],
          v: 2,
          meta: { user_id: this.user_id },
        },
      ]
      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc.id)
      for (const update of this.updates) {
        await DocUpdaterClient.sendUpdate(this.project_id, this.doc.id, update)
      }
    })

    it('should update the ranges', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)
      const { ranges } = doc
      const change = ranges.changes[0]
      change.op.should.deep.equal({ i: '456', p: 3 })
      change.id.should.equal(this.id_seed + '000001')
      change.metadata.user_id.should.equal(this.user_id)
    })

    describe('Adding comments', function () {
      describe('standalone', function () {
        before(async function () {
          this.project_id = DocUpdaterClient.randomId()
          this.user_id = DocUpdaterClient.randomId()
          this.tid = DocUpdaterClient.randomId()
          this.doc = {
            id: DocUpdaterClient.randomId(),
            lines: ['foo bar baz'],
          }
          this.updates = [
            {
              doc: this.doc.id,
              op: [{ c: 'bar', p: 4, t: this.tid }],
              v: 0,
            },
          ]
          MockWebApi.insertDoc(this.project_id, this.doc.id, {
            lines: this.doc.lines,
            version: 0,
          })
          await DocUpdaterClient.preloadDoc(this.project_id, this.doc.id)
          for (const update of this.updates) {
            await DocUpdaterClient.sendUpdate(
              this.project_id,
              this.doc.id,
              update
            )
          }
          await setTimeout(200)
        })

        it('should update the ranges', async function () {
          const doc = await DocUpdaterClient.getDoc(
            this.project_id,
            this.doc.id
          )
          const { ranges } = doc
          const comment = ranges.comments[0]
          comment.op.should.deep.equal({ c: 'bar', p: 4, t: this.tid })
          comment.id.should.equal(this.tid)
        })
      })

      describe('with conflicting ops needing OT', function () {
        before(async function () {
          this.project_id = DocUpdaterClient.randomId()
          this.user_id = DocUpdaterClient.randomId()
          this.tid = DocUpdaterClient.randomId()
          this.doc = {
            id: DocUpdaterClient.randomId(),
            lines: ['foo bar baz'],
          }
          this.updates = [
            {
              doc: this.doc.id,
              op: [{ i: 'ABC', p: 3 }],
              v: 0,
              meta: { user_id: this.user_id },
            },
            {
              doc: this.doc.id,
              op: [{ c: 'bar', p: 4, t: this.tid }],
              v: 0,
            },
          ]
          MockWebApi.insertDoc(this.project_id, this.doc.id, {
            lines: this.doc.lines,
            version: 0,
          })
          await DocUpdaterClient.preloadDoc(this.project_id, this.doc.id)
          for (const update of this.updates) {
            await DocUpdaterClient.sendUpdate(
              this.project_id,
              this.doc.id,
              update
            )
          }
          await setTimeout(200)
        })

        it('should update the comments with the OT shifted comment', async function () {
          const doc = await DocUpdaterClient.getDoc(
            this.project_id,
            this.doc.id
          )
          const { ranges } = doc
          const comment = ranges.comments[0]
          comment.op.should.deep.equal({ c: 'bar', p: 7, t: this.tid })
        })
      })
    })
  })

  describe('Loading ranges from persistence layer', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.id_seed = '587357bd35e64f6157'
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['a123aa'],
      }
      this.update = {
        doc: this.doc.id,
        op: [{ i: '456', p: 5 }],
        v: 0,
        meta: { user_id: this.user_id, tc: this.id_seed },
      }
      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
        ranges: {
          changes: [
            {
              op: { i: '123', p: 1 },
              metadata: {
                user_id: this.user_id,
                ts: new Date(),
              },
            },
          ],
        },
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc.id)
      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc.id,
        this.update
      )
      await setTimeout(200)
    })

    it('should have preloaded the existing ranges', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)
      const { changes } = doc.ranges
      changes[0].op.should.deep.equal({ i: '123', p: 1 })
      changes[1].op.should.deep.equal({ i: '456', p: 5 })
    })

    it('should flush the ranges to the persistence layer again', async function () {
      await DocUpdaterClient.flushDoc(this.project_id, this.doc.id)
      const doc = await MockWebApi.getDocument(this.project_id, this.doc.id)
      const { changes } = doc.ranges
      changes[0].op.should.deep.equal({ i: '123', p: 1 })
      changes[1].op.should.deep.equal({ i: '456', p: 5 })
    })
  })

  describe('accepting a change', function () {
    beforeEach(async function () {
      sandbox.spy(MockWebApi, 'setDocument')
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.id_seed = '587357bd35e64f6157'
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['aaa'],
      }
      this.update = {
        doc: this.doc.id,
        op: [{ i: '456', p: 1 }],
        v: 0,
        meta: { user_id: this.user_id, tc: this.id_seed },
      }
      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc.id)
      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc.id,
        this.update
      )
      await setTimeout(200)
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)
      const { ranges } = doc
      const change = ranges.changes[0]
      change.op.should.deep.equal({ i: '456', p: 1 })
      change.id.should.equal(this.id_seed + '000001')
      change.metadata.user_id.should.equal(this.user_id)
    })
    afterEach(function () {
      sandbox.restore()
    })

    it('should remove the change after accepting', async function () {
      await DocUpdaterClient.acceptChange(
        this.project_id,
        this.doc.id,
        this.id_seed + '000001'
      )
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)
      expect(doc.ranges.changes).to.be.undefined
    })

    it('should persist the ranges after accepting', async function () {
      await DocUpdaterClient.flushDoc(this.project_id, this.doc.id)
      await DocUpdaterClient.acceptChange(
        this.project_id,
        this.doc.id,
        this.id_seed + '000001'
      )
      await DocUpdaterClient.flushDoc(this.project_id, this.doc.id)
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)
      expect(doc.ranges.changes).to.be.undefined

      MockWebApi.setDocument
        .calledWith(this.project_id, this.doc.id, ['a456aa'], 1, {})
        .should.equal(true)
    })
  })

  describe('accepting multiple changes', function () {
    beforeEach(async function () {
      this.getHistoryUpdatesSpy = sandbox.spy(
        RangesManager,
        'getHistoryUpdatesForAcceptedChanges'
      )

      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['aaa', 'bbb', 'ccc', 'ddd', 'eee'],
      }

      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
        historyRangesSupport: true,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc.id)
      this.id_seed_1 = 'tc_1'
      this.id_seed_2 = 'tc_2'
      this.id_seed_3 = 'tc_3'

      this.updates = [
        {
          doc: this.doc.id,
          op: [{ d: 'bbb', p: 4 }],
          v: 0,
          meta: {
            user_id: this.user_id,
            tc: this.id_seed_1,
          },
        },
        {
          doc: this.doc.id,
          op: [{ d: 'ccc', p: 5 }],
          v: 1,
          meta: {
            user_id: this.user_id,
            tc: this.id_seed_2,
          },
        },
        {
          doc: this.doc.id,
          op: [{ d: 'ddd', p: 6 }],
          v: 2,
          meta: {
            user_id: this.user_id,
            tc: this.id_seed_3,
          },
        },
      ]

      await DocUpdaterClient.sendUpdates(
        this.project_id,
        this.doc.id,
        this.updates
      )

      await setTimeout(200)

      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)
      const { ranges } = doc
      const changeOps = ranges.changes.map(change => change.op).flat()
      changeOps.should.deep.equal([
        { d: 'bbb', p: 4 },
        { d: 'ccc', p: 5 },
        { d: 'ddd', p: 6 },
      ])
    })

    afterEach(function () {
      sandbox.restore()
    })

    it('accepting changes in order', async function () {
      await DocUpdaterClient.acceptChanges(this.project_id, this.doc.id, [
        this.id_seed_1 + '000001',
        this.id_seed_2 + '000001',
        this.id_seed_3 + '000001',
      ])

      const historyUpdates = this.getHistoryUpdatesSpy.returnValues[0]
      expect(historyUpdates[0]).to.deep.equal({
        doc: this.doc.id,
        meta: {
          pathname: '/a/b/c.tex',
          doc_length: 10,
          history_doc_length: 19,
          ts: historyUpdates[0].meta.ts,
          user_id: this.user_id,
        },
        op: [{ p: 4, d: 'bbb' }],
      })

      expect(historyUpdates[1]).to.deep.equal({
        doc: this.doc.id,
        meta: {
          pathname: '/a/b/c.tex',
          doc_length: 10,
          history_doc_length: 16,
          ts: historyUpdates[1].meta.ts,
          user_id: this.user_id,
        },
        op: [{ p: 5, d: 'ccc' }],
      })

      expect(historyUpdates[2]).to.deep.equal({
        doc: this.doc.id,
        meta: {
          pathname: '/a/b/c.tex',
          doc_length: 10,
          history_doc_length: 13,
          ts: historyUpdates[2].meta.ts,
          user_id: this.user_id,
        },
        op: [{ p: 6, d: 'ddd' }],
      })
    })

    it('accepting changes in reverse order', async function () {
      await DocUpdaterClient.acceptChanges(this.project_id, this.doc.id, [
        this.id_seed_3 + '000001',
        this.id_seed_2 + '000001',
        this.id_seed_1 + '000001',
      ])

      const historyUpdates = this.getHistoryUpdatesSpy.returnValues[0]
      expect(historyUpdates[0]).to.deep.equal({
        doc: this.doc.id,
        meta: {
          pathname: '/a/b/c.tex',
          doc_length: 10,
          history_doc_length: 19,
          ts: historyUpdates[0].meta.ts,
          user_id: this.user_id,
        },
        op: [{ p: 4, d: 'bbb' }],
      })

      expect(historyUpdates[1]).to.deep.equal({
        doc: this.doc.id,
        meta: {
          pathname: '/a/b/c.tex',
          doc_length: 10,
          history_doc_length: 16,
          ts: historyUpdates[1].meta.ts,
          user_id: this.user_id,
        },
        op: [{ p: 5, d: 'ccc' }],
      })

      expect(historyUpdates[2]).to.deep.equal({
        doc: this.doc.id,
        meta: {
          pathname: '/a/b/c.tex',
          doc_length: 10,
          history_doc_length: 13,
          ts: historyUpdates[2].meta.ts,
          user_id: this.user_id,
        },
        op: [{ p: 6, d: 'ddd' }],
      })
    })
  })

  describe('deleting a comment range', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['foo bar'],
      }
      this.update = {
        doc: this.doc.id,
        op: [{ c: 'bar', p: 4, t: (this.tid = DocUpdaterClient.randomId()) }],
        v: 0,
      }
      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc.id)
      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc.id,
        this.update
      )
      await setTimeout(200)
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)
      const { ranges } = doc
      const change = ranges.comments[0]
      change.op.should.deep.equal({ c: 'bar', p: 4, t: this.tid })
      change.id.should.equal(this.tid)
    })

    it('should remove the comment range', async function () {
      await DocUpdaterClient.removeComment(
        this.project_id,
        this.doc.id,
        this.tid
      )
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)
      expect(doc.ranges.comments).to.be.undefined
    })
  })

  describe('tripping range size limit', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.id_seed = DocUpdaterClient.randomId()
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['aaa'],
      }
      this.i = new Array(3 * 1024 * 1024).join('a')
      this.updates = [
        {
          doc: this.doc.id,
          op: [{ i: this.i, p: 1 }],
          v: 0,
          meta: { user_id: this.user_id, tc: this.id_seed },
        },
      ]
      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
      })
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc.id)
      for (const update of this.updates) {
        await DocUpdaterClient.sendUpdate(this.project_id, this.doc.id, update)
      }
      await setTimeout(200)
    })

    it('should not update the ranges', async function () {
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)
      expect(doc.ranges.changes).to.be.undefined
    })
  })

  describe('deleting text surrounding a comment', function () {
    before(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: ['foo bar baz'],
        version: 0,
        ranges: {
          comments: [
            {
              op: {
                c: 'a',
                p: 5,
                tid: (this.tid = DocUpdaterClient.randomId()),
              },
              metadata: {
                user_id: this.user_id,
                ts: new Date(),
              },
            },
          ],
        },
      })
      this.updates = [
        {
          doc: this.doc_id,
          op: [{ d: 'foo ', p: 0 }],
          v: 0,
          meta: { user_id: this.user_id },
        },
        {
          doc: this.doc_id,
          op: [{ d: 'bar ', p: 0 }],
          v: 1,
          meta: { user_id: this.user_id },
        },
      ]
      await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
      for (const update of this.updates) {
        await DocUpdaterClient.sendUpdate(this.project_id, this.doc_id, update)
      }
      await setTimeout(200)
      await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
    })

    it('should write a snapshot from before the destructive change', async function () {
      await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      const docSnapshots = await db.docSnapshots
        .find({
          project_id: new ObjectId(this.project_id),
          doc_id: new ObjectId(this.doc_id),
        })
        .toArray()
      expect(docSnapshots.length).to.equal(1)
      expect(docSnapshots[0].version).to.equal(1)
      expect(docSnapshots[0].lines).to.deep.equal(['bar baz'])
      expect(docSnapshots[0].ranges.comments[0].op).to.deep.equal({
        c: 'a',
        p: 1,
        tid: this.tid,
      })
    })
  })
})
