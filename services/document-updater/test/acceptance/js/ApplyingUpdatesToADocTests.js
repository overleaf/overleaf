const sinon = require('sinon')
const { expect } = require('chai')
const async = require('async')
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

describe('Applying updates to a doc', function () {
  before(function (done) {
    this.lines = ['one', 'two', 'three']
    this.version = 42
    this.op = {
      i: 'one and a half\n',
      p: 4,
    }
    this.update = {
      doc: this.doc_id,
      op: [this.op],
      v: this.version,
    }
    this.result = ['one', 'one and a half', 'two', 'three']
    DocUpdaterApp.ensureRunning(done)
  })

  describe('when the document is not loaded', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
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
          setTimeout(done, 200)
        }
      )
    })

    after(function () {
      MockWebApi.getDocument.restore()
    })

    it('should load the document from the web API', function () {
      MockWebApi.getDocument
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should update the doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          if (error) done(error)
          doc.lines.should.deep.equal(this.result)
          done()
        }
      )
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

    it('should set the first op timestamp', function (done) {
      rclientProjectHistory.get(
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
          done()
        }
      )
    })

    it('should yield last updated time', function (done) {
      DocUpdaterClient.getProjectLastUpdatedAt(
        this.project_id,
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          res.statusCode.should.equal(200)
          body.lastUpdatedAt.should.be.within(this.startTime, Date.now())
          done()
        }
      )
    })

    it('should yield no last updated time for another project', function (done) {
      DocUpdaterClient.getProjectLastUpdatedAt(
        DocUpdaterClient.randomId(),
        (error, res, body) => {
          if (error != null) {
            throw error
          }
          res.statusCode.should.equal(200)
          body.should.deep.equal({})
          done()
        }
      )
    })

    describe('when sending another update', function () {
      before(function (done) {
        this.timeout(10000)
        this.second_update = Object.assign({}, this.update)
        this.second_update.v = this.version + 1
        this.secondStartTime = Date.now()
        DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          this.second_update,
          error => {
            if (error != null) {
              throw error
            }
            setTimeout(done, 200)
          }
        )
      })

      it('should update the doc', function (done) {
        DocUpdaterClient.getDoc(
          this.project_id,
          this.doc_id,
          (error, res, doc) => {
            if (error) done(error)
            doc.lines.should.deep.equal([
              'one',
              'one and a half',
              'one and a half',
              'two',
              'three',
            ])
            done()
          }
        )
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

      it('should yield last updated time', function (done) {
        DocUpdaterClient.getProjectLastUpdatedAt(
          this.project_id,
          (error, res, body) => {
            if (error != null) {
              throw error
            }
            res.statusCode.should.equal(200)
            body.lastUpdatedAt.should.be.within(
              this.secondStartTime,
              Date.now()
            )
            done()
          }
        )
      })
    })
  })

  describe('when the document is loaded', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      DocUpdaterClient.preloadDoc(this.project_id, this.doc_id, error => {
        if (error != null) {
          throw error
        }
        sinon.spy(MockWebApi, 'getDocument')
        DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          error => {
            if (error != null) {
              throw error
            }
            setTimeout(done, 200)
          }
        )
      })
    })

    after(function () {
      MockWebApi.getDocument.restore()
    })

    it('should not need to call the web api', function () {
      MockWebApi.getDocument.called.should.equal(false)
    })

    it('should update the doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          if (error) return done(error)
          doc.lines.should.deep.equal(this.result)
          done()
        }
      )
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
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()

      MockWebApi.insertDoc(this.project_id, this.doc_id, {
        lines: this.lines,
        version: this.version,
      })
      DocUpdaterClient.preloadDoc(this.project_id, this.doc_id, error => {
        if (error != null) {
          throw error
        }
        sinon.spy(MockWebApi, 'getDocument')
        DocUpdaterClient.sendUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          error => {
            if (error != null) {
              throw error
            }
            setTimeout(done, 200)
          }
        )
      })
    })

    after(function () {
      MockWebApi.getDocument.restore()
    })

    it('should update the doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          if (error) return done(error)
          doc.lines.should.deep.equal(this.result)
          done()
        }
      )
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

  describe('when the document has been deleted', function () {
    describe('when the ops come in a single linear order', function () {
      before(function (done) {
        this.project_id = DocUpdaterClient.randomId()
        this.doc_id = DocUpdaterClient.randomId()
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
        done()
      })

      it('should be able to continue applying updates when the project has been deleted', function (done) {
        let update
        const actions = []
        for (update of this.updates.slice(0, 6)) {
          ;(update => {
            actions.push(callback =>
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
        for (update of this.updates.slice(6)) {
          ;(update => {
            actions.push(callback =>
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
          DocUpdaterClient.getDoc(
            this.project_id,
            this.doc_id,
            (error, res, doc) => {
              if (error) return done(error)
              doc.lines.should.deep.equal(this.my_result)
              done()
            }
          )
        })
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
      before(function (done) {
        this.project_id = DocUpdaterClient.randomId()
        this.doc_id = DocUpdaterClient.randomId()
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
        done()
      })

      it('should be able to continue applying updates when the project has been deleted', function (done) {
        let update
        const actions = []
        for (update of this.updates.slice(0, 5)) {
          ;(update => {
            actions.push(callback =>
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
        for (update of this.updates.slice(5)) {
          ;(update => {
            actions.push(callback =>
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
          DocUpdaterClient.getDoc(
            this.project_id,
            this.doc_id,
            (error, res, doc) => {
              if (error) return done(error)
              doc.lines.should.deep.equal(this.my_result)
              done()
            }
          )
        })
      })
    })
  })

  describe('with a broken update', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
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
          setTimeout(done, 200)
        }
      )
    })

    it('should not update the doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          if (error) return done(error)
          doc.lines.should.deep.equal(this.lines)
          done()
        }
      )
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

  describe('when there is no version in Mongo', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
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
          setTimeout(done, 200)
        }
      )
    })

    it('should update the doc (using version = 0)', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          if (error) return done(error)
          doc.lines.should.deep.equal(this.result)
          done()
        }
      )
    })
  })

  describe('when the sending duplicate ops', function () {
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
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
          setTimeout(() => {
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
                dupIfSource: ['ikHceq3yfAdQYzBo4-xZ'],
                meta: {
                  source: 'ikHceq3yfAdQYzBo4-xZ',
                },
              },
              error => {
                if (error != null) {
                  throw error
                }
                setTimeout(done, 200)
              }
            )
          }, 200)
        }
      )
    })

    it('should update the doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          if (error) return done(error)
          doc.lines.should.deep.equal(this.result)
          done()
        }
      )
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
    before(function (done) {
      this.project_id = DocUpdaterClient.randomId()
      this.doc_id = DocUpdaterClient.randomId()
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
          setTimeout(done, 200)
        }
      )
    })

    it('should not update or create a doc', function (done) {
      DocUpdaterClient.getDoc(
        this.project_id,
        this.doc_id,
        (error, res, doc) => {
          if (error) return done(error)
          res.statusCode.should.equal(404)
          done()
        }
      )
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
