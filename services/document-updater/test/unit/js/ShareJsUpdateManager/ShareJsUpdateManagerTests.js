/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const modulePath = '../../../../app/js/ShareJsUpdateManager.js'
const SandboxedModule = require('sandboxed-module')
const crypto = require('crypto')

describe('ShareJsUpdateManager', function () {
  beforeEach(function () {
    let Model
    this.project_id = 'project-id-123'
    this.doc_id = 'document-id-123'
    this.callback = sinon.stub()
    return (this.ShareJsUpdateManager = SandboxedModule.require(modulePath, {
      requires: {
        './sharejs/server/model': (Model = class Model {
          constructor(db) {
            this.db = db
          }
        }),
        './ShareJsDB': (this.ShareJsDB = { mockDB: true }),
        '@overleaf/redis-wrapper': {
          createClient: () => {
            return (this.rclient = { auth() {} })
          },
        },
        './RealTimeRedisManager': (this.RealTimeRedisManager = {}),
        './Metrics': (this.metrics = { inc: sinon.stub() }),
      },
      globals: {
        clearTimeout: (this.clearTimeout = sinon.stub()),
      },
    }))
  })

  describe('applyUpdate', function () {
    beforeEach(function () {
      this.lines = ['one', 'two']
      this.version = 34
      this.updatedDocLines = ['onefoo', 'two']
      const content = this.updatedDocLines.join('\n')
      this.hash = crypto
        .createHash('sha1')
        .update('blob ' + content.length + '\x00')
        .update(content, 'utf8')
        .digest('hex')
      this.update = { p: 4, t: 'foo', v: this.version, hash: this.hash }
      this.model = {
        applyOp: sinon.stub().callsArg(2),
        getSnapshot: sinon.stub(),
        db: {
          appliedOps: {},
        },
      }
      this.ShareJsUpdateManager.getNewShareJsModel = sinon
        .stub()
        .returns(this.model)
      this.ShareJsUpdateManager._listenForOps = sinon.stub()
      return (this.ShareJsUpdateManager.removeDocFromCache = sinon
        .stub()
        .callsArg(1))
    })

    describe('successfully', function () {
      beforeEach(function (done) {
        this.model.getSnapshot.callsArgWith(1, null, {
          snapshot: this.updatedDocLines.join('\n'),
          v: this.version,
        })
        this.model.db.appliedOps[`${this.project_id}:${this.doc_id}`] =
          this.appliedOps = ['mock-ops']
        return this.ShareJsUpdateManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          this.lines,
          this.version,
          (err, docLines, version, appliedOps) => {
            this.callback(err, docLines, version, appliedOps)
            return done()
          }
        )
      })

      it('should create a new ShareJs model', function () {
        return this.ShareJsUpdateManager.getNewShareJsModel
          .calledWith(this.project_id, this.doc_id, this.lines, this.version)
          .should.equal(true)
      })

      it('should listen for ops on the model', function () {
        return this.ShareJsUpdateManager._listenForOps
          .calledWith(this.model)
          .should.equal(true)
      })

      it('should send the update to ShareJs', function () {
        return this.model.applyOp
          .calledWith(`${this.project_id}:${this.doc_id}`, this.update)
          .should.equal(true)
      })

      it('should get the updated doc lines', function () {
        return this.model.getSnapshot
          .calledWith(`${this.project_id}:${this.doc_id}`)
          .should.equal(true)
      })

      return it('should return the updated doc lines, version and ops', function () {
        return this.callback
          .calledWith(null, this.updatedDocLines, this.version, this.appliedOps)
          .should.equal(true)
      })
    })

    describe('when applyOp fails', function () {
      beforeEach(function (done) {
        this.error = new Error('Something went wrong')
        this.model.applyOp = sinon.stub().callsArgWith(2, this.error)
        return this.ShareJsUpdateManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          this.lines,
          this.version,
          (err, docLines, version) => {
            this.callback(err, docLines, version)
            return done()
          }
        )
      })

      return it('should call the callback with the error', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    describe('when getSnapshot fails', function () {
      beforeEach(function (done) {
        this.error = new Error('Something went wrong')
        this.model.getSnapshot.callsArgWith(1, this.error)
        return this.ShareJsUpdateManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          this.lines,
          this.version,
          (err, docLines, version) => {
            this.callback(err, docLines, version)
            return done()
          }
        )
      })

      return it('should call the callback with the error', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    return describe('with an invalid hash', function () {
      beforeEach(function (done) {
        this.error = new Error('invalid hash')
        this.model.getSnapshot.callsArgWith(1, null, {
          snapshot: 'unexpected content',
          v: this.version,
        })
        this.model.db.appliedOps[`${this.project_id}:${this.doc_id}`] =
          this.appliedOps = ['mock-ops']
        return this.ShareJsUpdateManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.update,
          this.lines,
          this.version,
          (err, docLines, version, appliedOps) => {
            this.callback(err, docLines, version, appliedOps)
            return done()
          }
        )
      })

      return it('should call the callback with the error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })

  return describe('_listenForOps', function () {
    beforeEach(function () {
      this.model = {
        on: (event, callback) => {
          return (this.callback = callback)
        },
      }
      sinon.spy(this.model, 'on')
      return this.ShareJsUpdateManager._listenForOps(this.model)
    })

    it('should listen to the model for updates', function () {
      return this.model.on.calledWith('applyOp').should.equal(true)
    })

    return describe('the callback', function () {
      beforeEach(function () {
        this.opData = {
          op: { t: 'foo', p: 1 },
          meta: { source: 'bar' },
        }
        this.RealTimeRedisManager.sendData = sinon.stub()
        return this.callback(`${this.project_id}:${this.doc_id}`, this.opData)
      })

      return it('should publish the op to redis', function () {
        return this.RealTimeRedisManager.sendData
          .calledWith({
            project_id: this.project_id,
            doc_id: this.doc_id,
            op: this.opData,
          })
          .should.equal(true)
      })
    })
  })
})
