const sinon = require('sinon')
const { expect } = require('chai')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

const sandbox = sinon.createSandbox()

describe('Rejecting Changes', function () {
  before(async function () {
    await DocUpdaterApp.ensureRunning()
  })

  describe('rejecting a single change', function () {
    beforeEach(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['the brown fox jumps over the lazy dog'],
      }

      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
        historyRangesSupport: true,
      })

      this.id_seed = 'tc_reject_test'
      this.update = {
        doc: this.doc.id,
        op: [{ i: 'quick ', p: 4 }],
        v: 0,
        meta: {
          user_id: this.user_id,
          tc: this.id_seed,
        },
      }

      await DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc.id,
        this.update
      )
    })

    afterEach(function () {
      sandbox.restore()
    })

    it('should reject the change and restore the original text', async function () {
      const doc1 = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)

      expect(doc1.ranges.changes).to.have.length(1)
      const change = doc1.ranges.changes[0]
      expect(change.op).to.deep.equal({ i: 'quick ', p: 4 })
      expect(change.id).to.equal(this.id_seed + '000001')

      expect(doc1.lines).to.deep.equal([
        'the quick brown fox jumps over the lazy dog',
      ])

      const { rejectedChangeIds } = await DocUpdaterClient.rejectChanges(
        this.project_id,
        this.doc.id,
        [change.id],
        this.user_id
      )

      expect(rejectedChangeIds).to.be.an('array')
      expect(rejectedChangeIds).to.include(change.id)

      const doc2 = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)

      expect(doc2.ranges.changes || []).to.have.length(0)
      expect(doc2.lines).to.deep.equal([
        'the brown fox jumps over the lazy dog',
      ])
    })

    it('should return 200 status code with rejectedChangeIds on successful rejection', async function () {
      const data = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)

      const changeId = data.ranges.changes[0].id

      const { rejectedChangeIds } = await DocUpdaterClient.rejectChanges(
        this.project_id,
        this.doc.id,
        [changeId],
        this.user_id
      )
      expect(rejectedChangeIds).to.be.an('array')
      expect(rejectedChangeIds).to.include(changeId)
    })
  })

  describe('rejecting multiple changes', function () {
    beforeEach(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['the brown fox jumps over the lazy dog'],
      }

      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
        historyRangesSupport: true,
      })

      this.id_seed_1 = 'tc_reject_1'
      this.id_seed_2 = 'tc_reject_2'

      this.updates = [
        {
          doc: this.doc.id,
          op: [{ i: 'quick ', p: 4 }],
          v: 0,
          meta: {
            user_id: this.user_id,
            tc: this.id_seed_1,
          },
        },
        {
          doc: this.doc.id,
          op: [{ d: 'lazy ', p: 35 }],
          v: 1,
          meta: {
            user_id: this.user_id,
            tc: this.id_seed_2,
          },
        },
      ]

      await DocUpdaterClient.sendUpdates(
        this.project_id,
        this.doc.id,
        this.updates
      )
    })

    afterEach(function () {
      sandbox.restore()
    })

    it('should reject multiple changes in order', async function () {
      const data = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)
      expect(data.ranges.changes).to.have.length(2)

      expect(data.lines).to.deep.equal([
        'the quick brown fox jumps over the dog',
      ])

      const changeIds = data.ranges.changes.map(change => change.id)

      const { rejectedChangeIds } = await DocUpdaterClient.rejectChanges(
        this.project_id,
        this.doc.id,
        changeIds,
        this.user_id
      )
      expect(rejectedChangeIds).to.be.an('array')
      expect(rejectedChangeIds).to.have.length(2)
      expect(rejectedChangeIds).to.include.members(changeIds)

      const data2 = await DocUpdaterClient.getDoc(this.project_id, this.doc.id)
      expect(data2.ranges.changes || []).to.have.length(0)
      expect(data2.lines).to.deep.equal([
        'the brown fox jumps over the lazy dog',
      ])
    })
  })

  describe('error cases', function () {
    beforeEach(async function () {
      this.project_id = DocUpdaterClient.randomId()
      this.user_id = DocUpdaterClient.randomId()
      this.doc = {
        id: DocUpdaterClient.randomId(),
        lines: ['the brown fox jumps over the lazy dog'],
      }

      MockWebApi.insertDoc(this.project_id, this.doc.id, {
        lines: this.doc.lines,
        version: 0,
        historyRangesSupport: true,
      })

      await DocUpdaterApp.ensureRunning()
    })

    it('should handle rejection of non-existent changes gracefully', async function () {
      const nonExistentChangeId = 'nonexistent_change_id'

      const { rejectedChangeIds } = await DocUpdaterClient.rejectChanges(
        this.project_id,
        this.doc.id,
        [nonExistentChangeId],
        this.user_id
      )
      // Should still return 200 with empty rejectedChangeIds if no changes were found to reject
      expect(rejectedChangeIds).to.be.an('array')
      expect(rejectedChangeIds).to.have.length(0)
    })

    it('should handle empty change_ids array', async function () {
      const { rejectedChangeIds } = await DocUpdaterClient.rejectChanges(
        this.project_id,
        this.doc.id,
        [],
        this.user_id
      )
      expect(rejectedChangeIds).to.be.an('array')
      expect(rejectedChangeIds).to.have.length(0)
    })
  })
})
