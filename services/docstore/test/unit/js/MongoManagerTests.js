const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/MongoManager'
)
const { ObjectId } = require('mongodb')
const { assert, expect } = require('chai')
const Errors = require('../../../app/js/Errors')

describe('MongoManager', function () {
  beforeEach(function () {
    this.db = {
      docs: {
        updateOne: sinon.stub().yields(null, { matchedCount: 1 }),
        insertOne: sinon.stub().yields(null),
      },
      docOps: {},
    }
    this.MongoManager = SandboxedModule.require(modulePath, {
      requires: {
        './mongodb': {
          db: this.db,
          ObjectId,
        },
        '@overleaf/metrics': { timeAsyncMethod: sinon.stub() },
        '@overleaf/settings': {
          max_deleted_docs: 42,
          docstore: { archivingLockDurationMs: 5000 },
        },
        './Errors': Errors,
      },
    })
    this.projectId = ObjectId().toString()
    this.docId = ObjectId().toString()
    this.rev = 42
    this.callback = sinon.stub()
    this.stubbedErr = new Error('hello world')
  })

  describe('findDoc', function () {
    beforeEach(function () {
      this.doc = { name: 'mock-doc' }
      this.db.docs.findOne = sinon.stub().callsArgWith(2, null, this.doc)
      this.filter = { lines: true }
      this.MongoManager.findDoc(
        this.projectId,
        this.docId,
        this.filter,
        this.callback
      )
    })

    it('should find the doc', function () {
      this.db.docs.findOne
        .calledWith(
          {
            _id: ObjectId(this.docId),
            project_id: ObjectId(this.projectId),
          },
          {
            projection: this.filter,
          }
        )
        .should.equal(true)
    })

    it('should call the callback with the doc', function () {
      this.callback.calledWith(null, this.doc).should.equal(true)
    })
  })

  describe('patchDoc', function () {
    beforeEach(function (done) {
      this.meta = { name: 'foo.tex' }
      this.callback.callsFake(done)
      this.MongoManager.patchDoc(
        this.projectId,
        this.docId,
        this.meta,
        this.callback
      )
    })

    it('should pass the parameter along', function () {
      this.db.docs.updateOne.should.have.been.calledWith(
        {
          _id: ObjectId(this.docId),
          project_id: ObjectId(this.projectId),
        },
        {
          $set: this.meta,
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
          .callsArgWith(0, null, [this.doc, this.doc3, this.doc4]),
      })
    })

    describe('with included_deleted = false', function () {
      beforeEach(function () {
        this.MongoManager.getProjectsDocs(
          this.projectId,
          { include_deleted: false },
          this.filter,
          this.callback
        )
      })

      it('should find the non-deleted docs via the project_id', function () {
        this.db.docs.find
          .calledWith(
            {
              project_id: ObjectId(this.projectId),
              deleted: { $ne: true },
            },
            {
              projection: this.filter,
            }
          )
          .should.equal(true)
      })

      it('should call the callback with the docs', function () {
        this.callback
          .calledWith(null, [this.doc, this.doc3, this.doc4])
          .should.equal(true)
      })
    })

    describe('with included_deleted = true', function () {
      beforeEach(function () {
        this.MongoManager.getProjectsDocs(
          this.projectId,
          { include_deleted: true },
          this.filter,
          this.callback
        )
      })

      it('should find all via the project_id', function () {
        this.db.docs.find
          .calledWith(
            {
              project_id: ObjectId(this.projectId),
            },
            {
              projection: this.filter,
            }
          )
          .should.equal(true)
      })

      it('should call the callback with the docs', function () {
        this.callback
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
        toArray: sinon.stub().yields(null, [this.doc1, this.doc2, this.doc3]),
      })
      this.callback.callsFake(done)
      this.MongoManager.getProjectsDeletedDocs(
        this.projectId,
        this.filter,
        this.callback
      )
    })

    it('should find the deleted docs via the project_id', function () {
      this.db.docs.find
        .calledWith({
          project_id: ObjectId(this.projectId),
          deleted: true,
        })
        .should.equal(true)
    })

    it('should filter, sort by deletedAt and limit', function () {
      this.db.docs.find
        .calledWith(sinon.match.any, {
          projection: this.filter,
          sort: { deletedAt: -1 },
          limit: 42,
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
      this.oldRev = 77
    })

    it('should upsert the document', function (done) {
      this.MongoManager.upsertIntoDocCollection(
        this.projectId,
        this.docId,
        this.oldRev,
        { lines: this.lines },
        err => {
          assert.equal(err, null)
          const args = this.db.docs.updateOne.args[0]
          assert.deepEqual(args[0], {
            _id: ObjectId(this.docId),
            project_id: ObjectId(this.projectId),
            rev: this.oldRev,
          })
          assert.equal(args[1].$set.lines, this.lines)
          assert.equal(args[1].$inc.rev, 1)
          done()
        }
      )
    })

    it('should handle update error', function (done) {
      this.db.docs.updateOne.yields(this.stubbedErr)
      this.MongoManager.upsertIntoDocCollection(
        this.projectId,
        this.docId,
        this.rev,
        { lines: this.lines },
        err => {
          err.should.equal(this.stubbedErr)
          done()
        }
      )
    })

    it('should insert without a previous rev', function (done) {
      this.MongoManager.upsertIntoDocCollection(
        this.projectId,
        this.docId,
        null,
        { lines: this.lines, ranges: this.ranges },
        err => {
          expect(this.db.docs.insertOne).to.have.been.calledWith({
            _id: ObjectId(this.docId),
            project_id: ObjectId(this.projectId),
            rev: 1,
            lines: this.lines,
            ranges: this.ranges,
          })
          expect(err).to.not.exist
          done()
        }
      )
    })

    it('should handle generic insert error', function (done) {
      this.db.docs.insertOne.yields(this.stubbedErr)
      this.MongoManager.upsertIntoDocCollection(
        this.projectId,
        this.docId,
        null,
        { lines: this.lines, ranges: this.ranges },
        err => {
          expect(err).to.equal(this.stubbedErr)
          done()
        }
      )
    })

    it('should handle duplicate insert error', function (done) {
      this.db.docs.insertOne.yields({ code: 11000 })
      this.MongoManager.upsertIntoDocCollection(
        this.projectId,
        this.docId,
        null,
        { lines: this.lines, ranges: this.ranges },
        err => {
          expect(err).to.be.instanceof(Errors.DocRevValueError)
          done()
        }
      )
    })
  })

  describe('destroyProject', function () {
    beforeEach(function (done) {
      this.projectId = ObjectId()
      this.docIds = [ObjectId(), ObjectId()]
      this.db.docs.deleteMany = sinon.stub().yields()
      this.db.docOps.deleteMany = sinon.stub().yields()
      this.db.docs.find = sinon
        .stub()
        .withArgs({ project_id: this.projectId })
        .returns({
          toArray: sinon.stub().yields(
            null,
            this.docIds.map(id => ({
              _id: id,
            }))
          ),
        })
      this.MongoManager.destroyProject(this.projectId, done)
    })

    it('should destroy all docs', function () {
      sinon.assert.calledWith(this.db.docs.deleteMany, {
        project_id: this.projectId,
      })
    })

    it('should destroy the docOps', function () {
      sinon.assert.calledWith(this.db.docOps.deleteMany, {
        doc_id: { $in: this.docIds },
      })
    })
  })

  describe('getDocVersion', function () {
    describe('when the doc exists', function () {
      beforeEach(function () {
        this.doc = { version: (this.version = 42) }
        this.db.docOps.findOne = sinon.stub().callsArgWith(2, null, this.doc)
        this.MongoManager.getDocVersion(this.docId, this.callback)
      })

      it('should look for the doc in the database', function () {
        this.db.docOps.findOne
          .calledWith(
            { doc_id: ObjectId(this.docId) },
            {
              projection: { version: 1 },
            }
          )
          .should.equal(true)
      })

      it('should call the callback with the version', function () {
        this.callback.calledWith(null, this.version).should.equal(true)
      })
    })

    describe("when the doc doesn't exist", function () {
      beforeEach(function () {
        this.db.docOps.findOne = sinon.stub().callsArgWith(2, null, null)
        this.MongoManager.getDocVersion(this.docId, this.callback)
      })

      it('should call the callback with 0', function () {
        this.callback.calledWith(null, 0).should.equal(true)
      })
    })
  })

  describe('setDocVersion', function () {
    beforeEach(function () {
      this.version = 42
      this.db.docOps.updateOne = sinon.stub().callsArg(3)
      this.MongoManager.setDocVersion(this.docId, this.version, this.callback)
    })

    it('should update the doc version', function () {
      this.db.docOps.updateOne
        .calledWith(
          {
            doc_id: ObjectId(this.docId),
          },
          {
            $set: {
              version: this.version,
            },
          },
          {
            upsert: true,
          }
        )
        .should.equal(true)
    })

    it('should call the callback', function () {
      this.callback.called.should.equal(true)
    })
  })

  describe('withRevCheck', function () {
    this.beforeEach(function () {
      this.doc = { _id: ObjectId(), name: 'mock-doc', rev: 1 }
      this.testFunction = sinon.stub().yields(null, 'foo')
    })

    it('should call the callback when the rev has not changed', function (done) {
      this.db.docs.findOne = sinon.stub().callsArgWith(2, null, { rev: 1 })
      this.MongoManager.withRevCheck(
        this.doc,
        this.testFunction,
        (err, result) => {
          result.should.equal('foo')
          assert.isNull(err)
          done()
        }
      )
    })

    it('should return an error when the rev has changed', function (done) {
      this.db.docs.findOne = sinon.stub().callsArgWith(2, null, { rev: 2 })
      this.MongoManager.withRevCheck(
        this.doc,
        this.testFunction,
        (err, result) => {
          err.should.be.instanceof(Errors.DocModifiedError)
          done()
        }
      )
    })

    it('should return a value error if incoming rev is NaN', function (done) {
      this.db.docs.findOne = sinon.stub().callsArgWith(2, null, { rev: 2 })
      this.doc = { _id: ObjectId(), name: 'mock-doc', rev: NaN }
      this.MongoManager.withRevCheck(
        this.doc,
        this.testFunction,
        (err, result) => {
          err.should.be.instanceof(Errors.DocRevValueError)
          done()
        }
      )
    })

    it('should return a value error if checked doc rev is NaN', function (done) {
      this.db.docs.findOne = sinon.stub().callsArgWith(2, null, { rev: NaN })
      this.MongoManager.withRevCheck(
        this.doc,
        this.testFunction,
        (err, result) => {
          err.should.be.instanceof(Errors.DocRevValueError)
          done()
        }
      )
    })
  })

  describe('restoreArchivedDoc', function () {
    beforeEach(function () {
      this.archivedDoc = {
        lines: ['a', 'b', 'c'],
        ranges: { some: 'ranges' },
        rev: 2,
      }
    })

    describe('complete doc', function () {
      beforeEach(function (done) {
        this.MongoManager.restoreArchivedDoc(
          this.projectId,
          this.docId,
          this.archivedDoc,
          done
        )
      })

      it('updates Mongo', function () {
        expect(this.db.docs.updateOne).to.have.been.calledWith(
          {
            _id: ObjectId(this.docId),
            project_id: ObjectId(this.projectId),
            rev: this.archivedDoc.rev,
          },
          {
            $set: {
              lines: this.archivedDoc.lines,
              ranges: this.archivedDoc.ranges,
            },
            $unset: {
              inS3: true,
            },
          }
        )
      })
    })

    describe('without ranges', function () {
      beforeEach(function (done) {
        delete this.archivedDoc.ranges
        this.MongoManager.restoreArchivedDoc(
          this.projectId,
          this.docId,
          this.archivedDoc,
          done
        )
      })

      it('sets ranges to an empty object', function () {
        expect(this.db.docs.updateOne).to.have.been.calledWith(
          {
            _id: ObjectId(this.docId),
            project_id: ObjectId(this.projectId),
            rev: this.archivedDoc.rev,
          },
          {
            $set: {
              lines: this.archivedDoc.lines,
              ranges: {},
            },
            $unset: {
              inS3: true,
            },
          }
        )
      })
    })

    describe("when the update doesn't succeed", function () {
      it('throws a DocRevValueError', function (done) {
        this.db.docs.updateOne.yields(null, { matchedCount: 0 })
        this.MongoManager.restoreArchivedDoc(
          this.projectId,
          this.docId,
          this.archivedDoc,
          err => {
            expect(err).to.be.instanceof(Errors.DocRevValueError)
            done()
          }
        )
      })
    })
  })
})
