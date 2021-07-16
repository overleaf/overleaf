/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/js/ShareJsDB.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors')

describe('ShareJsDB', function () {
  beforeEach(function () {
    this.doc_id = 'document-id'
    this.project_id = 'project-id'
    this.doc_key = `${this.project_id}:${this.doc_id}`
    this.callback = sinon.stub()
    this.ShareJsDB = SandboxedModule.require(modulePath, {
      requires: {
        './RedisManager': (this.RedisManager = {}),
        './Errors': Errors,
      },
    })

    this.version = 42
    this.lines = ['one', 'two', 'three']
    return (this.db = new this.ShareJsDB(
      this.project_id,
      this.doc_id,
      this.lines,
      this.version
    ))
  })

  describe('getSnapshot', function () {
    describe('successfully', function () {
      beforeEach(function () {
        return this.db.getSnapshot(this.doc_key, this.callback)
      })

      it('should return the doc lines', function () {
        return this.callback.args[0][1].snapshot.should.equal(
          this.lines.join('\n')
        )
      })

      it('should return the doc version', function () {
        return this.callback.args[0][1].v.should.equal(this.version)
      })

      return it('should return the type as text', function () {
        return this.callback.args[0][1].type.should.equal('text')
      })
    })

    return describe('when the key does not match', function () {
      beforeEach(function () {
        return this.db.getSnapshot('bad:key', this.callback)
      })

      return it('should return the callback with a NotFoundError', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })
  })

  describe('getOps', function () {
    describe('with start == end', function () {
      beforeEach(function () {
        this.start = this.end = 42
        return this.db.getOps(this.doc_key, this.start, this.end, this.callback)
      })

      return it('should return an empty array', function () {
        return this.callback.calledWith(null, []).should.equal(true)
      })
    })

    describe('with a non empty range', function () {
      beforeEach(function () {
        this.start = 35
        this.end = 42
        this.RedisManager.getPreviousDocOps = sinon
          .stub()
          .callsArgWith(3, null, this.ops)
        return this.db.getOps(this.doc_key, this.start, this.end, this.callback)
      })

      it('should get the range from redis', function () {
        return this.RedisManager.getPreviousDocOps
          .calledWith(this.doc_id, this.start, this.end - 1)
          .should.equal(true)
      })

      return it('should return the ops', function () {
        return this.callback.calledWith(null, this.ops).should.equal(true)
      })
    })

    return describe('with no specified end', function () {
      beforeEach(function () {
        this.start = 35
        this.end = null
        this.RedisManager.getPreviousDocOps = sinon
          .stub()
          .callsArgWith(3, null, this.ops)
        return this.db.getOps(this.doc_key, this.start, this.end, this.callback)
      })

      return it('should get until the end of the list', function () {
        return this.RedisManager.getPreviousDocOps
          .calledWith(this.doc_id, this.start, -1)
          .should.equal(true)
      })
    })
  })

  return describe('writeOps', function () {
    return describe('writing an op', function () {
      beforeEach(function () {
        this.opData = {
          op: { p: 20, t: 'foo' },
          meta: { source: 'bar' },
          v: this.version,
        }
        return this.db.writeOp(this.doc_key, this.opData, this.callback)
      })

      it('should write into appliedOps', function () {
        return expect(this.db.appliedOps[this.doc_key]).to.deep.equal([
          this.opData,
        ])
      })

      return it('should call the callback without an error', function () {
        this.callback.called.should.equal(true)
        return (this.callback.args[0][0] != null).should.equal(false)
      })
    })
  })
})
