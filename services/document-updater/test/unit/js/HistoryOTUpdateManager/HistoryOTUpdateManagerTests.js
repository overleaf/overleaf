const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const {
  StringFileData,
  AddCommentOperation,
  Range,
  TextOperation,
} = require('overleaf-editor-core')

const MODULE_PATH = '../../../../app/js/HistoryOTUpdateManager.js'

describe('HistoryOTUpdateManager', function () {
  beforeEach(function () {
    this.project_id = 'project-id-123'
    this.doc_id = 'document-id-123'
    this.pathname = '/a/b/c.tex'

    this.Metrics = { inc: sinon.stub() }

    this.Profiler = class Profiler {}
    this.Profiler.prototype.log = sinon.stub().returns({ end: sinon.stub() })
    this.Profiler.prototype.end = sinon.stub()

    this.DocumentManager = {
      promises: { getDoc: sinon.stub() },
    }

    this.RedisManager = {
      promises: {
        updateDocument: sinon.stub().resolves(),
        getPreviousDocOps: sinon.stub().resolves([]),
        recordProjectNotificationTimestamp: sinon.stub().resolves(),
      },
    }

    this.ProjectHistoryRedisManager = {
      promises: { queueOps: sinon.stub().resolves(1) },
    }

    this.HistoryManager = { recordAndFlushHistoryOps: sinon.stub() }

    this.RealTimeRedisManager = { sendData: sinon.stub() }

    this.HistoryOTUpdateManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './Profiler': this.Profiler,
        './DocumentManager': this.DocumentManager,
        './RedisManager': this.RedisManager,
        './Metrics': this.Metrics,
        './ProjectHistoryRedisManager': this.ProjectHistoryRedisManager,
        './HistoryManager': this.HistoryManager,
        './RealTimeRedisManager': this.RealTimeRedisManager,
      },
    })
  })

  const savedFile = redisManager => {
    // updateDocument(projectId, docId, file.toRaw(), version, ...)
    const raw = redisManager.promises.updateDocument.firstCall.args[2]
    return StringFileData.fromRaw(raw)
  }

  describe('tryApplyUpdate with a composed multi-op update', function () {
    it('applies every op in the array, not just the first', async function () {
      // Doc after a cut: " world" with comment "c1" detached (empty ranges)
      const doc = new StringFileData('hello world')
      new AddCommentOperation('c1', [new Range(0, 5)]).apply(doc)
      const cut = new TextOperation()
      cut.remove(5)
      cut.retain(6)
      doc.edit(cut)
      expect(doc.getComments().getComment('c1').isEmpty()).to.be.true

      this.DocumentManager.promises.getDoc.resolves({
        lines: doc.toRaw(),
        version: 1,
        pathname: this.pathname,
        type: 'history-ot',
      })

      // Paste "hello" at the end, then re-home the comment onto it.
      const paste = new TextOperation()
      paste.retain(6)
      paste.insert('hello')
      const readd = new AddCommentOperation('c1', [new Range(6, 5)])
      const update = {
        doc: this.doc_id,
        op: [paste.toJSON(), readd.toJSON()],
        v: 1,
        meta: {},
      }

      await this.HistoryOTUpdateManager.applyUpdate(
        this.project_id,
        this.doc_id,
        update
      )

      const file = savedFile(this.RedisManager)
      expect(file.getContent()).to.equal(' worldhello')
      const comment = file.getComments().getComment('c1')
      expect(comment.ranges).to.have.length(1)
      expect(comment.ranges[0].pos).to.equal(6)
      expect(comment.ranges[0].length).to.equal(5)
    })
  })

  describe('tryApplyUpdate with a concurrent update to transform against', function () {
    it('transforms and applies every op when behind the latest version', async function () {
      // Server is at v2: a previous op inserted "ZZ" at the end.
      const doc = new StringFileData('hello worldZZ')
      this.DocumentManager.promises.getDoc.resolves({
        lines: doc.toRaw(),
        version: 2,
        pathname: this.pathname,
        type: 'history-ot',
      })
      const previous = new TextOperation()
      previous.retain(11)
      previous.insert('ZZ')
      this.RedisManager.promises.getPreviousDocOps.resolves([
        { doc: this.doc_id, op: [previous.toJSON()], v: 1, meta: {} },
      ])

      // Our update (based on v1) inserts "X" at the start and comments it.
      const insert = new TextOperation()
      insert.insert('X')
      insert.retain(11)
      const addComment = new AddCommentOperation('c1', [new Range(0, 1)])
      const update = {
        doc: this.doc_id,
        op: [insert.toJSON(), addComment.toJSON()],
        v: 1,
        meta: {},
      }

      await this.HistoryOTUpdateManager.applyUpdate(
        this.project_id,
        this.doc_id,
        update
      )

      const file = savedFile(this.RedisManager)
      expect(file.getContent()).to.equal('Xhello worldZZ')
      const comment = file.getComments().getComment('c1')
      expect(comment.ranges).to.have.length(1)
      expect(comment.ranges[0].pos).to.equal(0)
      expect(comment.ranges[0].length).to.equal(1)
    })

    it('rebases an op to a no-op when a concurrent update already applied it', async function () {
      // Server at v2: a concurrent client already added the same comment.
      const doc = new StringFileData('hello world')
      new AddCommentOperation('c1', [new Range(0, 5)]).apply(doc)
      this.DocumentManager.promises.getDoc.resolves({
        lines: doc.toRaw(),
        version: 2,
        pathname: this.pathname,
        type: 'history-ot',
      })
      const concurrent = new AddCommentOperation('c1', [new Range(0, 5)])
      this.RedisManager.promises.getPreviousDocOps.resolves([
        { doc: this.doc_id, op: [concurrent.toJSON()], v: 1, meta: {} },
      ])

      // Our update (based on v1) adds the identical comment.
      const addComment = new AddCommentOperation('c1', [new Range(0, 5)])
      const update = {
        doc: this.doc_id,
        op: [addComment.toJSON()],
        v: 1,
        meta: {},
      }

      await this.HistoryOTUpdateManager.applyUpdate(
        this.project_id,
        this.doc_id,
        update
      )

      expect(update.op).to.deep.equal([{ noOp: true }])
      const file = savedFile(this.RedisManager)
      expect(file.getContent()).to.equal('hello world')
      const comment = file.getComments().getComment('c1')
      expect(comment.ranges).to.have.length(1)
      expect(comment.ranges[0].pos).to.equal(0)
      expect(comment.ranges[0].length).to.equal(5)
    })

    it('threads the concurrent op through the client op-list', async function () {
      // Server advanced to v2 by inserting "Z" at position 6 of "hello world".
      const doc = new StringFileData('hello Zworld')
      this.DocumentManager.promises.getDoc.resolves({
        lines: doc.toRaw(),
        version: 2,
        pathname: this.pathname,
        type: 'history-ot',
      })
      const previous = new TextOperation()
      previous.retain(6)
      previous.insert('Z')
      previous.retain(5)
      this.RedisManager.promises.getPreviousDocOps.resolves([
        { doc: this.doc_id, op: [previous.toJSON()], v: 1, meta: {} },
      ])

      // Our update (v1): insert "AAA" at the start, then comment "hello" (now at
      // [3, 8)). The "Z" insert must be threaded past our "AAA" (to pos 9, after
      // the comment) so it leaves the comment alone; un-threaded (pos 6) it would
      // wrongly extend the comment.
      const insert = new TextOperation()
      insert.insert('AAA')
      insert.retain(11)
      const addComment = new AddCommentOperation('c1', [new Range(3, 5)])
      const update = {
        doc: this.doc_id,
        op: [insert.toJSON(), addComment.toJSON()],
        v: 1,
        meta: {},
      }

      await this.HistoryOTUpdateManager.applyUpdate(
        this.project_id,
        this.doc_id,
        update
      )

      const file = savedFile(this.RedisManager)
      expect(file.getContent()).to.equal('AAAhello Zworld')
      const comment = file.getComments().getComment('c1')
      expect(comment.ranges).to.have.length(1)
      expect(comment.ranges[0].pos).to.equal(3)
      expect(comment.ranges[0].length).to.equal(5)
    })

    it('rebases a [text, comment, text] update against a [text, text, comment] concurrent update', async function () {
      // Concurrent update (theirs), v1 -> v2 on "hello world": append "1",
      // append "2", then comment "12". Edits stay at the end.
      const doc = new StringFileData('hello world')
      const t0 = new TextOperation()
      t0.retain(11)
      t0.insert('1')
      doc.edit(t0) // "hello world1"
      const t1 = new TextOperation()
      t1.retain(12)
      t1.insert('2')
      doc.edit(t1) // "hello world12"
      const theirComment = new AddCommentOperation('sc', [new Range(11, 2)])
      theirComment.apply(doc) // comments "12"
      this.DocumentManager.promises.getDoc.resolves({
        lines: doc.toRaw(),
        version: 2,
        pathname: this.pathname,
        type: 'history-ot',
      })
      this.RedisManager.promises.getPreviousDocOps.resolves([
        {
          doc: this.doc_id,
          op: [t0.toJSON(), t1.toJSON(), theirComment.toJSON()],
          v: 1,
          meta: {},
        },
      ])

      // Our update (ours), based on v1: prepend "A", comment "hello", prepend
      // "B". Edits stay at the start, so nothing collides with theirs.
      const o0 = new TextOperation()
      o0.insert('A')
      o0.retain(11) // "Ahello world"
      const ourComment = new AddCommentOperation('c1', [new Range(1, 5)]) // "hello"
      const o2 = new TextOperation()
      o2.insert('B')
      o2.retain(12) // "BAhello world"
      const update = {
        doc: this.doc_id,
        op: [o0.toJSON(), ourComment.toJSON(), o2.toJSON()],
        v: 1,
        meta: {},
      }

      await this.HistoryOTUpdateManager.applyUpdate(
        this.project_id,
        this.doc_id,
        update
      )

      const file = savedFile(this.RedisManager)
      const content = file.getContent()
      expect(content).to.equal('BAhello world12')
      const comment = file.getComments().getComment('c1')
      expect(comment.ranges).to.have.length(1)
      expect(comment.ranges[0].pos).to.equal(2)
      expect(comment.ranges[0].length).to.equal(5)
      expect(content.slice(2, 7)).to.equal('hello')
    })
  })

  describe('tryApplyUpdate with a duplicate update', function () {
    it('does not apply or persist when dupIfSource matches', async function () {
      const doc = new StringFileData('hello world')
      this.DocumentManager.promises.getDoc.resolves({
        lines: doc.toRaw(),
        version: 2,
        pathname: this.pathname,
        type: 'history-ot',
      })
      const previous = new TextOperation()
      previous.retain(11)
      previous.insert('!')
      this.RedisManager.promises.getPreviousDocOps.resolves([
        {
          doc: this.doc_id,
          op: [previous.toJSON()],
          v: 1,
          meta: { source: 'source-1' },
        },
      ])

      const addComment = new AddCommentOperation('c1', [new Range(0, 5)])
      const update = {
        doc: this.doc_id,
        op: [addComment.toJSON()],
        v: 1,
        meta: {},
        dupIfSource: ['source-1'],
      }

      await this.HistoryOTUpdateManager.applyUpdate(
        this.project_id,
        this.doc_id,
        update
      )

      expect(update.dup).to.be.true
      expect(this.RedisManager.promises.updateDocument.called).to.be.false
      expect(this.RealTimeRedisManager.sendData.called).to.be.true
    })
  })
})
