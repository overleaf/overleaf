/* eslint-disable
    handle-callback-err,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/MongoManager'
)
const { ObjectId } = require('mongodb')
const { assert } = require('chai')

describe('MongoManager', function () {
  beforeEach(function () {
    this.MongoManager = SandboxedModule.require(modulePath, {
      requires: {
        './mongodb': {
          db: (this.db = { docs: {}, docOps: {} }),
          ObjectId
        },
        '@overleaf/metrics': { timeAsyncMethod: sinon.stub() },
        'settings-sharelatex': { max_deleted_docs: 42 }
      }
    })
    this.project_id = ObjectId().toString()
    this.doc_id = ObjectId().toString()
    this.callback = sinon.stub()
    return (this.stubbedErr = new Error('hello world'))
  })

  describe('findDoc', function () {
    beforeEach(function () {
      this.doc = { name: 'mock-doc' }
      this.db.docs.findOne = sinon.stub().callsArgWith(2, null, this.doc)
      this.filter = { lines: true }
      return this.MongoManager.findDoc(
        this.project_id,
        this.doc_id,
        this.filter,
        this.callback
      )
    })

    it('should find the doc', function () {
      this.db.docs.findOne
        .calledWith(
          {
            _id: ObjectId(this.doc_id),
            project_id: ObjectId(this.project_id)
          },
          {
            projection: this.filter
          }
        )
        .should.equal(true)
    })

    return it('should call the callback with the doc', function () {
      return this.callback.calledWith(null, this.doc).should.equal(true)
    })
  })

  describe('patchDoc', function () {
    beforeEach(function (done) {
      this.db.docs.updateOne = sinon.stub().yields(null)
      this.meta = { name: 'foo.tex' }
      this.callback.callsFake(done)
      this.MongoManager.patchDoc(
        this.project_id,
        this.doc_id,
        this.meta,
        this.callback
      )
    })

    it('should pass the parameter along', function () {
      this.db.docs.updateOne.should.have.been.calledWith(
        {
          _id: ObjectId(this.doc_id),
          project_id: ObjectId(this.project_id)
        },
        {
          $set: this.meta
        },
        this.callback
      )
    })
  })

  describe('getProjectsDocs', function () {
    beforeEach(function () {
      this.filter = { lines: true }
      this.doc1 = { name: 'mock-doc1' }
      this.doc2 = { name: 'mock-doc2' }
      this.doc3 = { name: 'mock-doc3' }
      this.doc4 = { name: 'mock-doc4' }
      this.db.docs.find = sinon.stub().returns({
        toArray: sinon
          .stub()
          .callsArgWith(0, null, [this.doc, this.doc3, this.doc4])
      })
    })

    describe('with included_deleted = false', function () {
      beforeEach(function () {
        return this.MongoManager.getProjectsDocs(
          this.project_id,
          { include_deleted: false },
          this.filter,
          this.callback
        )
      })

      it('should find the non-deleted docs via the project_id', function () {
        return this.db.docs.find
          .calledWith(
            {
              project_id: ObjectId(this.project_id),
              deleted: { $ne: true }
            },
            {
              projection: this.filter
            }
          )
          .should.equal(true)
      })

      return it('should call the callback with the docs', function () {
        return this.callback
          .calledWith(null, [this.doc, this.doc3, this.doc4])
          .should.equal(true)
      })
    })

    return describe('with included_deleted = true', function () {
      beforeEach(function () {
        return this.MongoManager.getProjectsDocs(
          this.project_id,
          { include_deleted: true },
          this.filter,
          this.callback
        )
      })

      it('should find all via the project_id', function () {
        return this.db.docs.find
          .calledWith(
            {
              project_id: ObjectId(this.project_id)
            },
            {
              projection: this.filter
            }
          )
          .should.equal(true)
      })

      return it('should call the callback with the docs', function () {
        return this.callback
          .calledWith(null, [this.doc, this.doc3, this.doc4])
          .should.equal(true)
      })
    })
  })

  describe('getProjectsDeletedDocs', function () {
    beforeEach(function (done) {
      this.filter = { name: true }
      this.doc1 = { _id: '1', name: 'mock-doc1.tex' }
      this.doc2 = { _id: '2', name: 'mock-doc2.tex' }
      this.doc3 = { _id: '3', name: 'mock-doc3.tex' }
      this.db.docs.find = sinon.stub().returns({
        toArray: sinon.stub().yields(null, [this.doc1, this.doc2, this.doc3])
      })
      this.callback.callsFake(done)
      this.MongoManager.getProjectsDeletedDocs(
        this.project_id,
        this.filter,
        this.callback
      )
    })

    it('should find the deleted docs via the project_id', function () {
      this.db.docs.find
        .calledWith({
          project_id: ObjectId(this.project_id),
          deleted: true,
          name: { $exists: true }
        })
        .should.equal(true)
    })

    it('should filter, sort by deletedAt and limit', function () {
      this.db.docs.find
        .calledWith(sinon.match.any, {
          projection: this.filter,
          sort: { deletedAt: -1 },
          limit: 42
        })
        .should.equal(true)
    })

    it('should call the callback with the docs', function () {
      this.callback
        .calledWith(null, [this.doc1, this.doc2, this.doc3])
        .should.equal(true)
    })
  })

  describe('upsertIntoDocCollection', function () {
    beforeEach(function () {
      this.db.docs.updateOne = sinon.stub().callsArgWith(3, this.stubbedErr)
      return (this.oldRev = 77)
    })

    it('should upsert the document', function (done) {
      return this.MongoManager.upsertIntoDocCollection(
        this.project_id,
        this.doc_id,
        { lines: this.lines },
        (err) => {
          const args = this.db.docs.updateOne.args[0]
          assert.deepEqual(args[0], { _id: ObjectId(this.doc_id) })
          assert.equal(args[1].$set.lines, this.lines)
          assert.equal(args[1].$inc.rev, 1)
          assert.deepEqual(args[1].$set.project_id, ObjectId(this.project_id))
          return done()
        }
      )
    })

    return it('should return the error', function (done) {
      return this.MongoManager.upsertIntoDocCollection(
        this.project_id,
        this.doc_id,
        { lines: this.lines },
        (err) => {
          err.should.equal(this.stubbedErr)
          return done()
        }
      )
    })
  })

  describe('markDocAsDeleted', function () {
    beforeEach(function () {
      this.db.docs.updateOne = sinon.stub().callsArgWith(2, this.stubbedErr)
      return (this.oldRev = 77)
    })

    it('should process the update', function (done) {
      return this.MongoManager.markDocAsDeleted(
        this.project_id,
        this.doc_id,
        (err) => {
          const args = this.db.docs.updateOne.args[0]
          assert.deepEqual(args[0], {
            _id: ObjectId(this.doc_id),
            project_id: ObjectId(this.project_id)
          })
          assert.equal(args[1].$set.deleted, true)
          return done()
        }
      )
    })

    return it('should return the error', function (done) {
      return this.MongoManager.markDocAsDeleted(
        this.project_id,
        this.doc_id,
        (err) => {
          err.should.equal(this.stubbedErr)
          return done()
        }
      )
    })
  })

  describe('destroyDoc', function () {
    beforeEach(function (done) {
      this.db.docs.deleteOne = sinon.stub().yields()
      this.db.docOps.deleteOne = sinon.stub().yields()
      return this.MongoManager.destroyDoc('123456789012', done)
    })

    it('should destroy the doc', function () {
      return sinon.assert.calledWith(this.db.docs.deleteOne, {
        _id: ObjectId('123456789012')
      })
    })

    return it('should destroy the docOps', function () {
      return sinon.assert.calledWith(this.db.docOps.deleteOne, {
        doc_id: ObjectId('123456789012')
      })
    })
  })

  describe('getDocVersion', function () {
    describe('when the doc exists', function () {
      beforeEach(function () {
        this.doc = { version: (this.version = 42) }
        this.db.docOps.findOne = sinon.stub().callsArgWith(2, null, this.doc)
        return this.MongoManager.getDocVersion(this.doc_id, this.callback)
      })

      it('should look for the doc in the database', function () {
        return this.db.docOps.findOne
          .calledWith(
            { doc_id: ObjectId(this.doc_id) },
            {
              projection: { version: 1 }
            }
          )
          .should.equal(true)
      })

      return it('should call the callback with the version', function () {
        return this.callback.calledWith(null, this.version).should.equal(true)
      })
    })

    return describe("when the doc doesn't exist", function () {
      beforeEach(function () {
        this.db.docOps.findOne = sinon.stub().callsArgWith(2, null, null)
        return this.MongoManager.getDocVersion(this.doc_id, this.callback)
      })

      return it('should call the callback with 0', function () {
        return this.callback.calledWith(null, 0).should.equal(true)
      })
    })
  })

  return describe('setDocVersion', function () {
    beforeEach(function () {
      this.version = 42
      this.db.docOps.updateOne = sinon.stub().callsArg(3)
      return this.MongoManager.setDocVersion(
        this.doc_id,
        this.version,
        this.callback
      )
    })

    it('should update the doc version', function () {
      return this.db.docOps.updateOne
        .calledWith(
          {
            doc_id: ObjectId(this.doc_id)
          },
          {
            $set: {
              version: this.version
            }
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
