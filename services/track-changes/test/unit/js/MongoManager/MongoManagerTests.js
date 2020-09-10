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
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/js/MongoManager.js'
const packModulePath = '../../../../app/js/PackManager.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongojs')
const tk = require('timekeeper')

describe('MongoManager', function () {
  beforeEach(function () {
    tk.freeze(new Date())
    this.MongoManager = SandboxedModule.require(modulePath, {
      requires: {
        './mongojs': { db: (this.db = {}), ObjectId },
        './PackManager': (this.PackManager = {}),
        'metrics-sharelatex': { timeAsyncMethod() {} },
        'logger-sharelatex': { log() {} }
      }
    })
    this.callback = sinon.stub()
    this.doc_id = ObjectId().toString()
    return (this.project_id = ObjectId().toString())
  })

  afterEach(function () {
    return tk.reset()
  })

  describe('getLastCompressedUpdate', function () {
    beforeEach(function () {
      this.update = 'mock-update'
      this.db.docHistory = {}
      this.db.docHistory.find = sinon.stub().returns(this.db.docHistory)
      this.db.docHistory.findOne = sinon.stub().returns(this.db.docHistory)
      this.db.docHistory.sort = sinon.stub().returns(this.db.docHistory)
      this.db.docHistory.limit = sinon.stub().returns(this.db.docHistory)
      this.db.docHistory.toArray = sinon
        .stub()
        .callsArgWith(0, null, [this.update])

      return this.MongoManager.getLastCompressedUpdate(
        this.doc_id,
        this.callback
      )
    })

    it('should find the updates for the doc', function () {
      return this.db.docHistory.find
        .calledWith({ doc_id: ObjectId(this.doc_id) })
        .should.equal(true)
    })

    it('should limit to one result', function () {
      return this.db.docHistory.limit.calledWith(1).should.equal(true)
    })

    it('should sort in descending version order', function () {
      return this.db.docHistory.sort.calledWith({ v: -1 }).should.equal(true)
    })

    return it('should call the call back with the update', function () {
      return this.callback.calledWith(null, this.update).should.equal(true)
    })
  })

  describe('peekLastCompressedUpdate', function () {
    describe('when there is no last update', function () {
      beforeEach(function () {
        this.PackManager.getLastPackFromIndex = sinon
          .stub()
          .callsArgWith(1, null, null)
        this.MongoManager.getLastCompressedUpdate = sinon
          .stub()
          .callsArgWith(1, null, null)
        return this.MongoManager.peekLastCompressedUpdate(
          this.doc_id,
          this.callback
        )
      })

      it('should get the last update', function () {
        return this.MongoManager.getLastCompressedUpdate
          .calledWith(this.doc_id)
          .should.equal(true)
      })

      return it('should call the callback with no update', function () {
        return this.callback.calledWith(null, null).should.equal(true)
      })
    })

    describe('when there is an update', function () {
      beforeEach(function () {
        this.update = { _id: Object() }
        this.MongoManager.getLastCompressedUpdate = sinon
          .stub()
          .callsArgWith(1, null, this.update)
        return this.MongoManager.peekLastCompressedUpdate(
          this.doc_id,
          this.callback
        )
      })

      it('should get the last update', function () {
        return this.MongoManager.getLastCompressedUpdate
          .calledWith(this.doc_id)
          .should.equal(true)
      })

      return it('should call the callback with the update', function () {
        return this.callback.calledWith(null, this.update).should.equal(true)
      })
    })

    return describe('when there is a last update in S3', function () {
      beforeEach(function () {
        this.update = { _id: Object(), v: 12345, v_end: 12345, inS3: true }
        this.PackManager.getLastPackFromIndex = sinon
          .stub()
          .callsArgWith(1, null, this.update)
        this.MongoManager.getLastCompressedUpdate = sinon
          .stub()
          .callsArgWith(1, null)
        return this.MongoManager.peekLastCompressedUpdate(
          this.doc_id,
          this.callback
        )
      })

      it('should get the last update', function () {
        return this.MongoManager.getLastCompressedUpdate
          .calledWith(this.doc_id)
          .should.equal(true)
      })

      return it('should call the callback with a null update and the correct version', function () {
        return this.callback
          .calledWith(null, null, this.update.v_end)
          .should.equal(true)
      })
    })
  })

  describe('backportProjectId', function () {
    beforeEach(function () {
      this.db.docHistory = { update: sinon.stub().callsArg(3) }
      return this.MongoManager.backportProjectId(
        this.project_id,
        this.doc_id,
        this.callback
      )
    })

    it("should insert the project_id into all entries for the doc_id which don't have it set", function () {
      return this.db.docHistory.update
        .calledWith(
          {
            doc_id: ObjectId(this.doc_id),
            project_id: { $exists: false }
          },
          {
            $set: { project_id: ObjectId(this.project_id) }
          },
          {
            multi: true
          }
        )
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })

  describe('getProjectMetaData', function () {
    beforeEach(function () {
      this.metadata = { mock: 'metadata' }
      this.db.projectHistoryMetaData = {
        findOne: sinon.stub().callsArgWith(1, null, this.metadata)
      }
      return this.MongoManager.getProjectMetaData(
        this.project_id,
        this.callback
      )
    })

    it('should look up the meta data in the db', function () {
      return this.db.projectHistoryMetaData.findOne
        .calledWith({ project_id: ObjectId(this.project_id) })
        .should.equal(true)
    })

    return it('should return the metadata', function () {
      return this.callback.calledWith(null, this.metadata).should.equal(true)
    })
  })

  return describe('setProjectMetaData', function () {
    beforeEach(function () {
      this.metadata = { mock: 'metadata' }
      this.db.projectHistoryMetaData = {
        update: sinon.stub().callsArgWith(3, null, [this.metadata])
      }
      return this.MongoManager.setProjectMetaData(
        this.project_id,
        this.metadata,
        this.callback
      )
    })

    it('should upsert the metadata into the DB', function () {
      return this.db.projectHistoryMetaData.update
        .calledWith(
          {
            project_id: ObjectId(this.project_id)
          },
          {
            $set: this.metadata
          },
          {
            upsert: true
          }
        )
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })
})
