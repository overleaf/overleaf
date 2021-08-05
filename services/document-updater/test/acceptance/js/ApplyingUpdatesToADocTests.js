/* eslint-disable
    camelcase,
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const async = require('async')
const Settings = require('@overleaf/settings')
const rclient_history = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.history
) // note: this is track changes, not project-history
const rclient_project_history = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.project_history
)
const rclient_du = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
const Keys = Settings.redis.documentupdater.key_schema
const HistoryKeys = Settings.redis.history.key_schema
const ProjectHistoryKeys = Settings.redis.project_history.key_schema

const MockTrackChangesApi = require('./helpers/MockTrackChangesApi')
const MockWebApi = require('./helpers/MockWebApi')
const DocUpdaterClient = require('./helpers/DocUpdaterClient')
const DocUpdaterApp = require('./helpers/DocUpdaterApp')

describe('Applying updates to a doc', function () {
  before(function (done) {
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
    return DocUpdaterApp.ensureRunning(done)
  })

  describe('when the document is not loaded', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      sinon.spy(MockWebApi, 'getDocument')
      this.startTime = Date.now()
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        this.update,
        error => {
          if (error != null) {
            throw error
          }
          return setTimeout(done, 200)
        }
      )
      return null
    })

    after(function () {
      return MockWebApi.getDocument.restore()
    })

    it('should load the document from the web API', function () {
      return MockWebApi.getDocument
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should update the doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.result)
          return done()
        }
      )
      return null
    })

    it('should push the applied updates to the track changes api', function (done) {
      rclient_history.lrange(
        HistoryKeys.uncompressedHistoryOps({ doc_id: this.doc_id }),
        0,
        -1,
        (error, updates) => {
          if (error != null) {
            throw error
          }
          JSON.parse(updates[0]).op.should.deep.equal(this.update.op)
          return rclient_history.sismember(
            HistoryKeys.docsWithHistoryOps({ project_id: this.project_id }),
            this.doc_id,
            (error, result) => {
              if (error != null) {
                throw error
              }
              result.should.equal(1)
              return done()
            }
          )
        }
      )
      return null
    })

    it('should push the applied updates to the project history changes api', function (done) {
      rclient_project_history.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          if (error != null) {
            throw error
          }
          JSON.parse(updates[0]).op.should.deep.equal(this.update.op)
          return done()
        }
      )
      return null
    })

    it('should set the first op timestamp', function (done) {
      rclient_project_history.get(
        ProjectHistoryKeys.projectHistoryFirstOpTimestamp({
          project_id: this.project_id,
        }),
        (error, result) => {
          if (error != null) {
            throw error
          }
          result = parseInt(result, 10)
          result.should.be.within(this.startTime, Date.now())
          this.firstOpTimestamp = result
          return done()
        }
      )
      return null
    })

    return describe('when sending another update', function () {
      before(function (done) {
        this.timeout = 10000
        this.second_update = Object.create(this.update)
        this.second_update.v = this.version + 1
        DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          this.second_update,
          error => {
            if (error != null) {
              throw error
            }
            return setTimeout(done, 200)
          }
        )
        return null
      })

      return it('should not change the first op timestamp', function (done) {
        rclient_project_history.get(
          ProjectHistoryKeys.projectHistoryFirstOpTimestamp({
            project_id: this.project_id,
          }),
          (error, result) => {
            if (error != null) {
              throw error
            }
            result = parseInt(result, 10)
            result.should.equal(this.firstOpTimestamp)
            return done()
          }
        )
        return null
      })
    })
  })

  describe('when the document is loaded', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      DocUpdaterClient.preloadDoc(this.project_id, this.doc_id, error => {
        if (error != null) {
          throw error
        }
        sinon.spy(MockWebApi, 'getDocument')
        return DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          error => {
            if (error != null) {
              throw error
            }
            return setTimeout(done, 200)
          }
        )
      })
      return null
    })

    after(function () {
      return MockWebApi.getDocument.restore()
    })

    it('should not need to call the web api', function () {
      return MockWebApi.getDocument.called.should.equal(false)
    })

    it('should update the doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.result)
          return done()
        }
      )
      return null
    })

    it('should push the applied updates to the track changes api', function (done) {
      rclient_history.lrange(
        HistoryKeys.uncompressedHistoryOps({ doc_id: this.doc_id }),
        0,
        -1,
        (error, updates) => {
          JSON.parse(updates[0]).op.should.deep.equal(this.update.op)
          return rclient_history.sismember(
            HistoryKeys.docsWithHistoryOps({ project_id: this.project_id }),
            this.doc_id,
            (error, result) => {
              result.should.equal(1)
              return done()
            }
          )
        }
      )
      return null
    })

    return it('should push the applied updates to the project history changes api', function (done) {
      rclient_project_history.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          JSON.parse(updates[0]).op.should.deep.equal(this.update.op)
          return done()
        }
      )
      return null
    })
  })

  describe('when the document is loaded and is using project-history only', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
        projectHistoryType: 'project-history',
      })
      DocUpdaterClient.preloadDoc(this.project_id, this.doc_id, error => {
        if (error != null) {
          throw error
        }
        sinon.spy(MockWebApi, 'getDocument')
        return DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          error => {
            if (error != null) {
              throw error
            }
            return setTimeout(done, 200)
          }
        )
      })
      return null
    })

    after(function () {
      return MockWebApi.getDocument.restore()
    })

    it('should update the doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.result)
          return done()
        }
      )
      return null
    })

    it('should not push any applied updates to the track changes api', function (done) {
      rclient_history.lrange(
        HistoryKeys.uncompressedHistoryOps({ doc_id: this.doc_id }),
        0,
        -1,
        (error, updates) => {
          updates.length.should.equal(0)
          return done()
        }
      )
      return null
    })

    return it('should push the applied updates to the project history changes api', function (done) {
      rclient_project_history.lrange(
        ProjectHistoryKeys.projectHistoryOps({ project_id: this.project_id }),
        0,
        -1,
        (error, updates) => {
          JSON.parse(updates[0]).op.should.deep.equal(this.update.op)
          return done()
        }
      )
      return null
    })
  })

  describe('when the document has been deleted', function () {
    describe('when the ops come in a single linear order', function () {
      before(function (done) {
        ;[this.project_id, this.doc_id] = Array.from([
          DocUpdaterClient.randomId(),
          DocUpdaterClient.randomId(),
        ])
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
        return done()
      })

      it('should be able to continue applying updates when the project has been deleted', function (done) {
        let update
        const actions = []
        for (update of Array.from(this.updates.slice(0, 6))) {
          ;(update => {
            return actions.push(callback =>
              DocUpdaterClient.sendUpdate(
                this.project_id,
                this.doc_id,
                update,
                callback
              )
            )
          })(update)
        }
        actions.push(callback =>
          DocUpdaterClient.deleteDoc(this.project_id, this.doc_id, callback)
        )
        for (update of Array.from(this.updates.slice(6))) {
          ;(update => {
            return actions.push(callback =>
              DocUpdaterClient.sendUpdate(
                this.project_id,
                this.doc_id,
                update,
                callback
              )
            )
          })(update)
        }

        async.series(actions, error => {
          if (error != null) {
            throw error
          }
          return DocUpdaterClient.getDoc(
            this.project_id,
            this.doc_id,
            (error, res, doc) => {
              doc.lines.should.deep.equal(this.my_result)
              return done()
            }
          )
        })
        return null
      })

      it('should push the applied updates to the track changes api', function (done) {
        rclient_history.lrange(
          HistoryKeys.uncompressedHistoryOps({ doc_id: this.doc_id }),
          0,
          -1,
          (error, updates) => {
            updates = Array.from(updates).map(u => JSON.parse(u))
            for (let i = 0; i < this.updates.length; i++) {
              const appliedUpdate = this.updates[i]
              appliedUpdate.op.should.deep.equal(updates[i].op)
            }

            return rclient_history.sismember(
              HistoryKeys.docsWithHistoryOps({ project_id: this.project_id }),
              this.doc_id,
              (error, result) => {
                result.should.equal(1)
                return done()
              }
            )
          }
        )
        return null
      })

      return it('should store the doc ops in the correct order', function (done) {
        rclient_du.lrange(
          Keys.docOps({ doc_id: this.doc_id }),
          0,
          -1,
          (error, updates) => {
            updates = Array.from(updates).map(u => JSON.parse(u))
            for (let i = 0; i < this.updates.length; i++) {
              const appliedUpdate = this.updates[i]
              appliedUpdate.op.should.deep.equal(updates[i].op)
            }
            return done()
          }
        )
        return null
      })
    })

    return describe('when older ops come in after the delete', function () {
      before(function (done) {
        ;[this.project_id, this.doc_id] = Array.from([
          DocUpdaterClient.randomId(),
          DocUpdaterClient.randomId(),
        ])
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
        return done()
      })

      return it('should be able to continue applying updates when the project has been deleted', function (done) {
        let update
        const actions = []
        for (update of Array.from(this.updates.slice(0, 5))) {
          ;(update => {
            return actions.push(callback =>
              DocUpdaterClient.sendUpdate(
                this.project_id,
                this.doc_id,
                update,
                callback
              )
            )
          })(update)
        }
        actions.push(callback =>
          DocUpdaterClient.deleteDoc(this.project_id, this.doc_id, callback)
        )
        for (update of Array.from(this.updates.slice(5))) {
          ;(update => {
            return actions.push(callback =>
              DocUpdaterClient.sendUpdate(
                this.project_id,
                this.doc_id,
                update,
                callback
              )
            )
          })(update)
        }

        async.series(actions, error => {
          if (error != null) {
            throw error
          }
          return DocUpdaterClient.getDoc(
            this.project_id,
            this.doc_id,
            (error, res, doc) => {
              doc.lines.should.deep.equal(this.my_result)
              return done()
            }
          )
        })
        return null
      })
    })
  })

  describe('with a broken update', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      this.broken_update = {
        doc_id: this.doc_id,
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

      DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        this.broken_update,
        error => {
          if (error != null) {
            throw error
          }
          return setTimeout(done, 200)
        }
      )
      return null
    })

    it('should not update the doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.lines)
          return done()
        }
      )
      return null
    })

    return it('should send a message with an error', function () {
      this.messageCallback.called.should.equal(true)
      const [channel, message] = Array.from(this.messageCallback.args[0])
      channel.should.equal('applied-ops')
      return JSON.parse(message).should.deep.include({
        project_id: this.project_id,
        doc_id: this.doc_id,
        error: 'Delete component does not match',
      })
    })
  })

  describe('with enough updates to flush to the track changes api', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      const updates = []
      for (let v = 0; v <= 199; v++) {
        // Should flush after 100 ops
        updates.push({
          doc_id: this.doc_id,
          op: [{ i: v.toString(), p: 0 }],
          v,
        })
      }

      sinon.spy(MockTrackChangesApi, 'flushDoc')

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: 0,
      })

      // Send updates in chunks to causes multiple flushes
      const actions = []
      for (let i = 0; i <= 19; i++) {
        ;(i => {
          return actions.push(cb => {
            return DocUpdaterClient.sendUpdates(
              this.project_id,
              this.doc_id,
              updates.slice(i * 10, (i + 1) * 10),
              cb
            )
          })
        })(i)
      }
      async.series(actions, error => {
        if (error != null) {
          throw error
        }
        return setTimeout(done, 2000)
      })
      return null
    })

    after(function () {
      return MockTrackChangesApi.flushDoc.restore()
    })

    return it('should flush the doc twice', function () {
      return MockTrackChangesApi.flushDoc.calledTwice.should.equal(true)
    })
  })

  describe('when there is no version in Mongo', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
      })

      const update = {
        doc: this.doc_id,
        op: this.update.op,
        v: 0,
      }
      DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        update,
        error => {
          if (error != null) {
            throw error
          }
          return setTimeout(done, 200)
        }
      )
      return null
    })

    return it('should update the doc (using version = 0)', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.result)
          return done()
        }
      )
      return null
    })
  })

  describe('when the sending duplicate ops', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })

      DocUpdaterClient.subscribeToAppliedOps(
        (this.messageCallback = sinon.stub())
      )

      // One user delete 'one', the next turns it into 'once'. The second becomes a NOP.
      DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        {
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
        },
        error => {
          if (error != null) {
            throw error
          }
          return setTimeout(() => {
            return DocUpdaterClient.sendUpdate(
              this.project_id,
              this.doc_id,
              {
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
              },
              error => {
                if (error != null) {
                  throw error
                }
                return setTimeout(done, 200)
              }
            )
          }, 200)
        }
      )
      return null
    })

    it('should update the doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          doc.lines.should.deep.equal(this.result)
          return done()
        }
      )
      return null
    })

    return it('should return a message about duplicate ops', function () {
      this.messageCallback.calledTwice.should.equal(true)
      this.messageCallback.args[0][0].should.equal('applied-ops')
      expect(JSON.parse(this.messageCallback.args[0][1]).op.dup).to.be.undefined
      this.messageCallback.args[1][0].should.equal('applied-ops')
      return expect(
        JSON.parse(this.messageCallback.args[1][1]).op.dup
      ).to.equal(true)
    })
  })

  return describe('when sending updates for a non-existing doc id', function () {
    before(function (done) {
      ;[this.project_id, this.doc_id] = Array.from([
        DocUpdaterClient.randomId(),
        DocUpdaterClient.randomId(),
      ])
      this.non_existing = {
        doc_id: this.doc_id,
        v: this.version,
        op: [{ d: 'content', p: 0 }],
      }

      DocUpdaterClient.subscribeToAppliedOps(
        (this.messageCallback = sinon.stub())
      )

      DocUpdaterClient.sendUpdate(
        this.project_id,
        this.doc_id,
        this.non_existing,
        error => {
          if (error != null) {
            throw error
          }
          return setTimeout(done, 200)
        }
      )
      return null
    })

    it('should not update or create a doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          res.statusCode.should.equal(404)
          return done()
        }
      )
      return null
    })

    return it('should send a message with an error', function () {
      this.messageCallback.called.should.equal(true)
      const [channel, message] = Array.from(this.messageCallback.args[0])
      channel.should.equal('applied-ops')
      return JSON.parse(message).should.deep.include({
        project_id: this.project_id,
        doc_id: this.doc_id,
        error: `doc not not found: /project/${this.project_id}/doc/${this.doc_id}`,
      })
    })
  })
})
