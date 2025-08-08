const sinon = require('sinon')
const { expect } = require('chai')

const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

const sandbox = sinon.createSandbox()

describe('Rejecting Changes', function () {
  before(function (done) {
    DocUpdaterApp.ensureRunning(done)
  })

  describe('rejecting a single change', function () {
    beforeEach(function (done) {
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

      DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc.id,
        this.update,
        done
      )
    })

    afterEach(function () {
      sandbox.restore()
    })

    it('should reject the change and restore the original text', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc.id,
        (error, res, data) => {
          if (error != null) {
            throw error
          }

          expect(data.ranges.changes).to.have.length(1)
          const change = data.ranges.changes[0]
          expect(change.op).to.deep.equal({ i: 'quick ', p: 4 })
          expect(change.id).to.equal(this.id_seed + '000001')

          expect(data.lines).to.deep.equal([
            'the quick brown fox jumps over the lazy dog',
          ])

          DocUpdaterClient.rejectChanges(
            this.project_id,
            this.doc.id,
            [change.id],
            this.user_id,
            (error, res, body) => {
              if (error != null) {
                throw error
              }

              expect(res.statusCode).to.equal(200)
              expect(body.rejectedChangeIds).to.be.an('array')
              expect(body.rejectedChangeIds).to.include(change.id)

              DocUpdaterClient.getDoc(
                this.project_id,
                this.doc.id,
                (error, res, data) => {
                  if (error != null) {
                    throw error
                  }

                  expect(data.ranges.changes || []).to.have.length(0)
                  expect(data.lines).to.deep.equal([
                    'the brown fox jumps over the lazy dog',
                  ])
                  done()
                }
              )
            }
          )
        }
      )
    })

    it('should return 200 status code with rejectedChangeIds on successful rejection', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc.id,
        (error, res, data) => {
          if (error != null) {
            throw error
          }

          const changeId = data.ranges.changes[0].id

          DocUpdaterClient.rejectChanges(
            this.project_id,
            this.doc.id,
            [changeId],
            this.user_id,
            (error, res, body) => {
              if (error != null) {
                throw error
              }

              expect(res.statusCode).to.equal(200)
              expect(body.rejectedChangeIds).to.be.an('array')
              expect(body.rejectedChangeIds).to.include(changeId)
              done()
            }
          )
        }
      )
    })
  })

  describe('rejecting multiple changes', function () {
    beforeEach(function (done) {
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

      DocUpdaterClient.sendUpdates(
        this.project_id,
        this.doc.id,
        this.updates,
        done
      )
    })

    afterEach(function () {
      sandbox.restore()
    })

    it('should reject multiple changes in order', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc.id,
        (error, res, data) => {
          if (error != null) {
            throw error
          }

          expect(data.ranges.changes).to.have.length(2)

          expect(data.lines).to.deep.equal([
            'the quick brown fox jumps over the dog',
          ])

          const changeIds = data.ranges.changes.map(change => change.id)

          DocUpdaterClient.rejectChanges(
            this.project_id,
            this.doc.id,
            changeIds,
            this.user_id,
            (error, res, body) => {
              if (error != null) {
                throw error
              }

              expect(res.statusCode).to.equal(200)
              expect(body.rejectedChangeIds).to.be.an('array')
              expect(body.rejectedChangeIds).to.have.length(2)
              expect(body.rejectedChangeIds).to.include.members(changeIds)

              DocUpdaterClient.getDoc(
                this.project_id,
                this.doc.id,
                (error, res, data) => {
                  if (error != null) {
                    throw error
                  }

                  expect(data.ranges.changes || []).to.have.length(0)
                  expect(data.lines).to.deep.equal([
                    'the brown fox jumps over the lazy dog',
                  ])
                  done()
                }
              )
            }
          )
        }
      )
    })
  })

  describe('error cases', function () {
    beforeEach(function (done) {
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

      DocUpdaterApp.ensureRunning(done)
    })

    it('should handle rejection of non-existent changes gracefully', function (done) {
      const nonExistentChangeId = 'nonexistent_change_id'

      DocUpdaterClient.rejectChanges(
        this.project_id,
        this.doc.id,
        [nonExistentChangeId],
        this.user_id,
        (error, res, body) => {
          // Should still return 200 with empty rejectedChangeIds if no changes were found to reject
          if (error != null) {
            throw error
          }
          expect(res.statusCode).to.equal(200)
          expect(body.rejectedChangeIds).to.be.an('array')
          expect(body.rejectedChangeIds).to.have.length(0)
          done()
        }
      )
    })

    it('should handle empty change_ids array', function (done) {
      DocUpdaterClient.rejectChanges(
        this.project_id,
        this.doc.id,
        [],
        this.user_id,
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          expect(res.statusCode).to.equal(200)
          expect(body.rejectedChangeIds).to.be.an('array')
          expect(body.rejectedChangeIds).to.have.length(0)
          done()
        }
      )
    })
  })
})
