const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/MongoManager'
)
const { ObjectId } = require('mongodb-legacy')
const { assert, expect } = require('chai')
const Errors = require('../../../app/js/Errors')

describe('MongoManager', function () {
  beforeEach(function () {
    this.db = {
      docs: {
        updateOne: sinon.stub().resolves({ matchedCount: 1 }),
        insertOne: sinon.stub().resolves(),
      },
    }
    this.MongoManager = SandboxedModule.require(modulePath, {
      requires: {
        './mongodb': {
          db: this.db,
          ObjectId,
        },
        '@overleaf/settings': {
          max_deleted_docs: 42,
          docstore: { archivingLockDurationMs: 5000 },
        },
        './Errors': Errors,
      },
    })
    this.projectId = new ObjectId().toString()
    this.docId = new ObjectId().toString()
    this.rev = 42
    this.stubbedErr = new Error('hello world')
    this.lines = ['Three French hens', 'Two turtle doves']
  })

  describe('findDoc', function () {
    beforeEach(async function () {
      this.doc = { name: 'mock-doc' }
      this.db.docs.findOne = sinon.stub().resolves(this.doc)
      this.filter = { lines: true }
      this.result = await this.MongoManager.promises.findDoc(
        this.projectId,
        this.docId,
        this.filter
      )
    })

    it('should find the doc', function () {
      this.db.docs.findOne
        .calledWith(
          {
            _id: new ObjectId(this.docId),
            project_id: new ObjectId(this.projectId),
          },
          {
            projection: this.filter,
          }
        )
        .should.equal(true)
    })

    it('should return the doc', function () {
      expect(this.doc).to.deep.equal(this.doc)
    })
  })

  describe('patchDoc', function () {
    beforeEach(async function () {
      this.meta = { name: 'foo.tex' }
      await this.MongoManager.promises.patchDoc(
        this.projectId,
        this.docId,
        this.meta
      )
    })

    it('should pass the parameter along', function () {
      this.db.docs.updateOne.should.have.been.calledWith(
        {
          _id: new ObjectId(this.docId),
          project_id: new ObjectId(this.projectId),
        },
        {
          $set: this.meta,
        }
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
        toArray: sinon.stub().resolves([this.doc, this.doc3, this.doc4]),
      })
    })

    describe('with included_deleted = false', function () {
      beforeEach(async function () {
        this.result = await this.MongoManager.promises.getProjectsDocs(
          this.projectId,
          { include_deleted: false },
          this.filter
        )
      })

      it('should find the non-deleted docs via the project_id', function () {
        this.db.docs.find
          .calledWith(
            {
              project_id: new ObjectId(this.projectId),
              deleted: { $ne: true },
            },
            {
              projection: this.filter,
            }
          )
          .should.equal(true)
      })

      it('should call return the docs', function () {
        expect(this.result).to.deep.equal([this.doc, this.doc3, this.doc4])
      })
    })

    describe('with included_deleted = true', function () {
      beforeEach(async function () {
        this.result = await this.MongoManager.promises.getProjectsDocs(
          this.projectId,
          { include_deleted: true },
          this.filter
        )
      })

      it('should find all via the project_id', function () {
        this.db.docs.find
          .calledWith(
            {
              project_id: new ObjectId(this.projectId),
            },
            {
              projection: this.filter,
            }
          )
          .should.equal(true)
      })

      it('should return the docs', function () {
        expect(this.result).to.deep.equal([this.doc, this.doc3, this.doc4])
      })
    })
  })

  describe('getProjectsDeletedDocs', function () {
    beforeEach(async function () {
      this.filter = { name: true }
      this.doc1 = { _id: '1', name: 'mock-doc1.tex' }
      this.doc2 = { _id: '2', name: 'mock-doc2.tex' }
      this.doc3 = { _id: '3', name: 'mock-doc3.tex' }
      this.db.docs.find = sinon.stub().returns({
        toArray: sinon.stub().resolves([this.doc1, this.doc2, this.doc3]),
      })
      this.result = await this.MongoManager.promises.getProjectsDeletedDocs(
        this.projectId,
        this.filter
      )
    })

    it('should find the deleted docs via the project_id', function () {
      this.db.docs.find
        .calledWith({
          project_id: new ObjectId(this.projectId),
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

    it('should return the docs', function () {
      expect(this.result).to.deep.equal([this.doc1, this.doc2, this.doc3])
    })
  })

  describe('upsertIntoDocCollection', function () {
    beforeEach(function () {
      this.oldRev = 77
    })

    it('should upsert the document', async function () {
      await this.MongoManager.promises.upsertIntoDocCollection(
        this.projectId,
        this.docId,
        this.oldRev,
        { lines: this.lines }
      )

      const args = this.db.docs.updateOne.args[0]
      assert.deepEqual(args[0], {
        _id: new ObjectId(this.docId),
        project_id: new ObjectId(this.projectId),
        rev: this.oldRev,
      })
      assert.equal(args[1].$set.lines, this.lines)
      assert.equal(args[1].$inc.rev, 1)
    })

    it('should handle update error', async function () {
      this.db.docs.updateOne.rejects(this.stubbedErr)
      await expect(
        this.MongoManager.promises.upsertIntoDocCollection(
          this.projectId,
          this.docId,
          this.rev,
          {
            lines: this.lines,
          }
        )
      ).to.be.rejectedWith(this.stubbedErr)
    })

    it('should insert without a previous rev', async function () {
      await this.MongoManager.promises.upsertIntoDocCollection(
        this.projectId,
        this.docId,
        null,
        { lines: this.lines, ranges: this.ranges }
      )

      expect(this.db.docs.insertOne).to.have.been.calledWith({
        _id: new ObjectId(this.docId),
        project_id: new ObjectId(this.projectId),
        rev: 1,
        lines: this.lines,
        ranges: this.ranges,
      })
    })

    it('should handle generic insert error', async function () {
      this.db.docs.insertOne.rejects(this.stubbedErr)
      await expect(
        this.MongoManager.promises.upsertIntoDocCollection(
          this.projectId,
          this.docId,
          null,
          { lines: this.lines, ranges: this.ranges }
        )
      ).to.be.rejectedWith(this.stubbedErr)
    })

    it('should handle duplicate insert error', async function () {
      this.db.docs.insertOne.rejects({ code: 11000 })
      await expect(
        this.MongoManager.promises.upsertIntoDocCollection(
          this.projectId,
          this.docId,
          null,
          { lines: this.lines, ranges: this.ranges }
        )
      ).to.be.rejectedWith(Errors.DocRevValueError)
    })
  })

  describe('destroyProject', function () {
    beforeEach(async function () {
      this.projectId = new ObjectId()
      this.db.docs.deleteMany = sinon.stub().resolves()
      await this.MongoManager.promises.destroyProject(this.projectId)
    })

    it('should destroy all docs', function () {
      sinon.assert.calledWith(this.db.docs.deleteMany, {
        project_id: this.projectId,
      })
    })
  })

  describe('checkRevUnchanged', function () {
    this.beforeEach(function () {
      this.doc = { _id: new ObjectId(), name: 'mock-doc', rev: 1 }
    })

    it('should not error when the rev has not changed', async function () {
      this.db.docs.findOne = sinon.stub().resolves({ rev: 1 })
      await this.MongoManager.promises.checkRevUnchanged(this.doc)
    })

    it('should return an error when the rev has changed', async function () {
      this.db.docs.findOne = sinon.stub().resolves({ rev: 2 })
      await expect(
        this.MongoManager.promises.checkRevUnchanged(this.doc)
      ).to.be.rejectedWith(Errors.DocModifiedError)
    })

    it('should return a value error if incoming rev is NaN', async function () {
      this.db.docs.findOne = sinon.stub().resolves({ rev: 2 })
      this.doc = { _id: new ObjectId(), name: 'mock-doc', rev: NaN }
      await expect(
        this.MongoManager.promises.checkRevUnchanged(this.doc)
      ).to.be.rejectedWith(Errors.DocRevValueError)
    })

    it('should return a value error if checked doc rev is NaN', async function () {
      this.db.docs.findOne = sinon.stub().resolves({ rev: NaN })
      await expect(
        this.MongoManager.promises.checkRevUnchanged(this.doc)
      ).to.be.rejectedWith(Errors.DocRevValueError)
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
      beforeEach(async function () {
        await this.MongoManager.promises.restoreArchivedDoc(
          this.projectId,
          this.docId,
          this.archivedDoc
        )
      })

      it('updates Mongo', function () {
        expect(this.db.docs.updateOne).to.have.been.calledWith(
          {
            _id: new ObjectId(this.docId),
            project_id: new ObjectId(this.projectId),
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
      beforeEach(async function () {
        delete this.archivedDoc.ranges
        await this.MongoManager.promises.restoreArchivedDoc(
          this.projectId,
          this.docId,
          this.archivedDoc
        )
      })

      it('sets ranges to an empty object', function () {
        expect(this.db.docs.updateOne).to.have.been.calledWith(
          {
            _id: new ObjectId(this.docId),
            project_id: new ObjectId(this.projectId),
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
      it('throws a DocRevValueError', async function () {
        this.db.docs.updateOne.resolves({ matchedCount: 0 })
        await expect(
          this.MongoManager.promises.restoreArchivedDoc(
            this.projectId,
            this.docId,
            this.archivedDoc
          )
        ).to.be.rejectedWith(Errors.DocRevValueError)
      })
    })
  })
})
