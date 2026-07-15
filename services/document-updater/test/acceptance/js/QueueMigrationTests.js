/*
 * Exercises the migration of the real-time -> document-updater update queue
 * from the per-doc queue to the per-project queue.
 *
 * The consumer's behaviour is gated by Settings.pendingUpdatesMigrationPhase,
 * which the app reads live. The acceptance app runs in-process, so each block
 * sets the phase it needs in a `before` hook and the top-level `after` restores
 * the original value.
 *
 * The dual-read consumer (phases 1 & 2) must drain BOTH the legacy per-doc queue
 * and the new per-project queue, so updates queued either side of a producer
 * roll-forward/roll-backward are still applied. Ordering is relaxed (ShareJS
 * rebases by version); these tests keep versions monotonic across the switch.
 */
const { expect } = require('chai')
const { setTimeout } = require('node:timers/promises')
const Settings = require('@overleaf/settings')
const rclientDU = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const Keys = Settings.redis.documentupdater.key_schema

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

function insertOp(text, position, version, docId) {
  return { doc: docId, op: [{ i: text, p: position }], v: version }
}

describe('Queue migration', function () {
  before(function () {
    this.originalPhase = Settings.pendingUpdatesMigrationPhase
  })

  after(function () {
    Settings.pendingUpdatesMigrationPhase = this.originalPhase
  })

  beforeEach(async function () {
    this.lines = ['one', 'two', 'three']
    this.version = 0
    this.project_id = DocUpdaterClient.randomId()
    this.doc_id = DocUpdaterClient.randomId()
    MockWebApi.insertDoc(this.project_id, this.doc_id, {
      lines: this.lines,
      version: this.version,
    })
    await DocUpdaterApp.ensureRunning()
    await DocUpdaterClient.preloadDoc(this.project_id, this.doc_id)
  })

  describe('dual-read consumer (phases 1 & 2)', function () {
    before(function () {
      Settings.pendingUpdatesMigrationPhase = 2
    })

    it('roll-forward: legacy updates then per-project updates all apply in order', async function () {
      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        insertOp('AAA\n', 0, 0, this.doc_id),
        { toProjectQueue: false }
      )
      await DocUpdaterClient.waitForPendingUpdates(this.project_id, this.doc_id)

      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        insertOp('BBB\n', 0, 1, this.doc_id),
        { toProjectQueue: true }
      )
      await DocUpdaterClient.waitForPendingUpdates(this.project_id, this.doc_id)

      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(['BBB', 'AAA', 'one', 'two', 'three'])
      doc.version.should.equal(2)
    })

    it('roll-backward: per-project updates then legacy updates all apply in order', async function () {
      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        insertOp('AAA\n', 0, 0, this.doc_id),
        { toProjectQueue: true }
      )
      await DocUpdaterClient.waitForPendingUpdates(this.project_id, this.doc_id)

      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        insertOp('BBB\n', 0, 1, this.doc_id),
        { toProjectQueue: false }
      )
      await DocUpdaterClient.waitForPendingUpdates(this.project_id, this.doc_id)

      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(['BBB', 'AAA', 'one', 'two', 'three'])
      doc.version.should.equal(2)
    })

    it('straddle: updates present in BOTH queues drain together (per-doc first), in order', async function () {
      // Populate both queues before any dispatch, then trigger a single
      // whole-project drain with a bare project-id marker.
      await rclientDU.rpush(
        Keys.pendingUpdates({ doc_id: this.doc_id }),
        JSON.stringify(insertOp('AAA\n', 0, 0, this.doc_id))
      )
      await rclientDU.rpush(
        Keys.pendingProjectUpdates({ project_id: this.project_id }),
        JSON.stringify(insertOp('BBB\n', 0, 1, this.doc_id))
      )
      await rclientDU.rpush('pending-updates-list', this.project_id)

      await DocUpdaterClient.waitForPendingUpdates(this.project_id, this.doc_id)
      await setTimeout(200)

      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(['BBB', 'AAA', 'one', 'two', 'three'])
      doc.version.should.equal(2)
    })

    it('flush applies per-project queue updates first (no stale flush)', async function () {
      // Queue an update on the per-project queue WITHOUT a dispatch marker, so
      // it is only picked up by the flush path draining outstanding updates.
      await rclientDU.rpush(
        Keys.pendingProjectUpdates({ project_id: this.project_id }),
        JSON.stringify(insertOp('AAA\n', 0, 0, this.doc_id))
      )

      await DocUpdaterClient.flushDoc(this.project_id, this.doc_id)

      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(['AAA', 'one', 'two', 'three'])
      doc.version.should.equal(1)
      const remaining = await rclientDU.llen(
        Keys.pendingProjectUpdates({ project_id: this.project_id })
      )
      expect(remaining).to.equal(0)
    })
  })

  describe('project-queue-only consumer (phase 3)', function () {
    before(function () {
      Settings.pendingUpdatesMigrationPhase = 3
    })

    it('drains the per-project queue', async function () {
      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        insertOp('AAA\n', 0, 0, this.doc_id),
        { toProjectQueue: true }
      )
      await DocUpdaterClient.waitForPendingUpdates(this.project_id, this.doc_id)
      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(['AAA', 'one', 'two', 'three'])
      doc.version.should.equal(1)
    })

    it('ignores the legacy per-doc queue', async function () {
      // Push to the legacy per-doc queue with its marker; the phase-3 consumer
      // must NOT process it (it no longer reads the per-doc queue).
      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        insertOp('AAA\n', 0, 0, this.doc_id),
        { toProjectQueue: false }
      )
      await setTimeout(500)

      const doc = await DocUpdaterClient.getDoc(this.project_id, this.doc_id)
      doc.lines.should.deep.equal(this.lines)
      doc.version.should.equal(0)
      const remaining = await rclientDU.llen(
        Keys.pendingUpdates({ doc_id: this.doc_id })
      )
      expect(remaining).to.equal(1)
    })
  })
})
