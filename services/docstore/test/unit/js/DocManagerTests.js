const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/DocManager'
)
const { ObjectId } = require('mongodb-legacy')
const Errors = require('../../../app/js/Errors')

describe('DocManager', function () {
  beforeEach(function () {
    this.doc_id = new ObjectId().toString()
    this.project_id = new ObjectId().toString()
    this.another_project_id = new ObjectId().toString()
    this.stubbedError = new Error('blew up')
    this.version = 42

    this.MongoManager = {
      promises: {
        findDoc: sinon.stub(),
        getProjectsDocs: sinon.stub(),
        patchDoc: sinon.stub().resolves(),
        upsertIntoDocCollection: sinon.stub().resolves(),
      },
    }
    this.DocArchiveManager = {
      promises: {
        unarchiveDoc: sinon.stub(),
        unArchiveAllDocs: sinon.stub(),
        archiveDoc: sinon.stub().resolves(),
      },
    }
    this.RangeManager = {
      jsonRangesToMongo(r) {
        return r
      },
      shouldUpdateRanges: sinon.stub().returns(false),
    }
    this.settings = { docstore: {} }

    this.DocManager = SandboxedModule.require(modulePath, {
      requires: {
        './MongoManager': this.MongoManager,
        './DocArchiveManager': this.DocArchiveManager,
        './RangeManager': this.RangeManager,
        '@overleaf/settings': this.settings,
        './Errors': Errors,
      },
    })
  })

  describe('getFullDoc', function () {
    beforeEach(function () {
      this.DocManager.promises._getDoc = sinon.stub()
      this.doc = {
        _id: this.doc_id,
        lines: ['2134'],
      }
    })

    it('should call get doc with a quick filter', async function () {
      this.DocManager.promises._getDoc.resolves(this.doc)
      const doc = await this.DocManager.promises.getFullDoc(
        this.project_id,
        this.doc_id
      )
      doc.should.equal(this.doc)
      this.DocManager.promises._getDoc
        .calledWith(this.project_id, this.doc_id, {
          lines: true,
          rev: true,
          deleted: true,
          version: true,
          ranges: true,
          inS3: true,
        })
        .should.equal(true)
    })

    it('should return error when get doc errors', async function () {
      this.DocManager.promises._getDoc.rejects(this.stubbedError)
      await expect(
        this.DocManager.promises.getFullDoc(this.project_id, this.doc_id)
      ).to.be.rejectedWith(this.stubbedError)
    })
  })

  describe('getRawDoc', function () {
    beforeEach(function () {
      this.DocManager.promises._getDoc = sinon.stub()
      this.doc = { lines: ['2134'] }
    })

    it('should call get doc with a quick filter', async function () {
      this.DocManager.promises._getDoc.resolves(this.doc)
      const doc = await this.DocManager.promises.getDocLines(
        this.project_id,
        this.doc_id
      )
      doc.should.equal(this.doc)
      this.DocManager.promises._getDoc
        .calledWith(this.project_id, this.doc_id, {
          lines: true,
          inS3: true,
        })
        .should.equal(true)
    })

    it('should return error when get doc errors', async function () {
      this.DocManager.promises._getDoc.rejects(this.stubbedError)
      await expect(
        this.DocManager.promises.getDocLines(this.project_id, this.doc_id)
      ).to.be.rejectedWith(this.stubbedError)
    })
  })

  describe('getDoc', function () {
    beforeEach(function () {
      this.project = { name: 'mock-project' }
      this.doc = {
        _id: this.doc_id,
        project_id: this.project_id,
        lines: ['mock-lines'],
        version: this.version,
      }
    })

    describe('when using a filter', function () {
      beforeEach(function () {
        this.MongoManager.promises.findDoc.resolves(this.doc)
      })

      it('should error if inS3 is not set to true', async function () {
        await expect(
          this.DocManager.promises._getDoc(this.project_id, this.doc_id, {
            inS3: false,
          })
        ).to.be.rejected
      })

      it('should always get inS3 even when no filter is passed', async function () {
        await expect(
          this.DocManager.promises._getDoc(this.project_id, this.doc_id)
        ).to.be.rejected
        this.MongoManager.promises.findDoc.called.should.equal(false)
      })

      it('should not error if inS3 is set to true', async function () {
        await this.DocManager.promises._getDoc(this.project_id, this.doc_id, {
          inS3: true,
        })
      })
    })

    describe('when the doc is in the doc collection', function () {
      beforeEach(async function () {
        this.MongoManager.promises.findDoc.resolves(this.doc)
        this.result = await this.DocManager.promises._getDoc(
          this.project_id,
          this.doc_id,
          { version: true, inS3: true }
        )
      })

      it('should get the doc from the doc collection', function () {
        this.MongoManager.promises.findDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should return the doc with the version', function () {
        this.result.lines.should.equal(this.doc.lines)
        this.result.version.should.equal(this.version)
      })
    })

    describe('when MongoManager.findDoc errors', function () {
      it('should return the error', async function () {
        this.MongoManager.promises.findDoc.rejects(this.stubbedError)
        await expect(
          this.DocManager.promises._getDoc(this.project_id, this.doc_id, {
            version: true,
            inS3: true,
          })
        ).to.be.rejectedWith(this.stubbedError)
      })
    })

    describe('when the doc is archived', function () {
      beforeEach(async function () {
        this.doc = {
          _id: this.doc_id,
          project_id: this.project_id,
          version: 2,
          inS3: true,
        }
        this.unarchivedDoc = {
          _id: this.doc_id,
          project_id: this.project_id,
          lines: ['mock-lines'],
          version: 2,
          inS3: false,
        }
        this.MongoManager.promises.findDoc.resolves(this.doc)
        this.DocArchiveManager.promises.unarchiveDoc.callsFake(
          async (projectId, docId) => {
            this.MongoManager.promises.findDoc.resolves({
              ...this.unarchivedDoc,
            })
          }
        )
        this.result = await this.DocManager.promises._getDoc(
          this.project_id,
          this.doc_id,
          {
            version: true,
            inS3: true,
          }
        )
      })

      it('should call the DocArchive to unarchive the doc', function () {
        this.DocArchiveManager.promises.unarchiveDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should look up the doc twice', function () {
        this.MongoManager.promises.findDoc.calledTwice.should.equal(true)
      })

      it('should return the doc', function () {
        expect(this.result).to.deep.equal({
          ...this.unarchivedDoc,
        })
      })
    })

    describe('when the doc does not exist in the docs collection', function () {
      it('should return a NotFoundError', async function () {
        this.MongoManager.promises.findDoc.resolves(null)
        await expect(
          this.DocManager.promises._getDoc(this.project_id, this.doc_id, {
            version: true,
            inS3: true,
          })
        ).to.be.rejectedWith(
          `No such doc: ${this.doc_id} in project ${this.project_id}`
        )
      })
    })
  })

  describe('getAllNonDeletedDocs', function () {
    describe('when the project exists', function () {
      beforeEach(async function () {
        this.docs = [
          {
            _id: this.doc_id,
            project_id: this.project_id,
            lines: ['mock-lines'],
          },
        ]
        this.MongoManager.promises.getProjectsDocs.resolves(this.docs)
        this.DocArchiveManager.promises.unArchiveAllDocs.resolves(this.docs)
        this.filter = { lines: true }
        this.result = await this.DocManager.promises.getAllNonDeletedDocs(
          this.project_id,
          this.filter
        )
      })

      it('should get the project from the database', function () {
        this.MongoManager.promises.getProjectsDocs.should.have.been.calledWith(
          this.project_id,
          { include_deleted: false },
          this.filter
        )
      })

      it('should return the docs', function () {
        expect(this.result).to.deep.equal(this.docs)
      })
    })

    describe('when there are no docs for the project', function () {
      it('should return a NotFoundError', async function () {
        this.MongoManager.promises.getProjectsDocs.resolves(null)
        this.DocArchiveManager.promises.unArchiveAllDocs.resolves(null)
        await expect(
          this.DocManager.promises.getAllNonDeletedDocs(
            this.project_id,
            this.filter
          )
        ).to.be.rejectedWith(`No docs for project ${this.project_id}`)
      })
    })
  })

  describe('patchDoc', function () {
    describe('when the doc exists', function () {
      beforeEach(function () {
        this.lines = ['mock', 'doc', 'lines']
        this.rev = 77
        this.MongoManager.promises.findDoc.resolves({
          _id: new ObjectId(this.doc_id),
        })
        this.meta = {}
      })

      describe('standard path', function () {
        beforeEach(async function () {
          await this.DocManager.promises.patchDoc(
            this.project_id,
            this.doc_id,
            this.meta
          )
        })

        it('should get the doc', function () {
          expect(this.MongoManager.promises.findDoc).to.have.been.calledWith(
            this.project_id,
            this.doc_id
          )
        })

        it('should persist the meta', function () {
          expect(this.MongoManager.promises.patchDoc).to.have.been.calledWith(
            this.project_id,
            this.doc_id,
            this.meta
          )
        })
      })

      describe('background flush disabled and deleting a doc', function () {
        beforeEach(async function () {
          this.settings.docstore.archiveOnSoftDelete = false
          this.meta.deleted = true

          await this.DocManager.promises.patchDoc(
            this.project_id,
            this.doc_id,
            this.meta
          )
        })

        it('should not flush the doc out of mongo', function () {
          expect(this.DocArchiveManager.promises.archiveDoc).to.not.have.been
            .called
        })
      })

      describe('background flush enabled and not deleting a doc', function () {
        beforeEach(async function () {
          this.settings.docstore.archiveOnSoftDelete = false
          this.meta.deleted = false
          await this.DocManager.promises.patchDoc(
            this.project_id,
            this.doc_id,
            this.meta
          )
        })

        it('should not flush the doc out of mongo', function () {
          expect(this.DocArchiveManager.promises.archiveDoc).to.not.have.been
            .called
        })
      })

      describe('background flush enabled and deleting a doc', function () {
        beforeEach(function () {
          this.settings.docstore.archiveOnSoftDelete = true
          this.meta.deleted = true
        })

        describe('when the background flush succeeds', function () {
          beforeEach(async function () {
            await this.DocManager.promises.patchDoc(
              this.project_id,
              this.doc_id,
              this.meta
            )
          })

          it('should not log a warning', function () {
            expect(this.logger.warn).to.not.have.been.called
          })

          it('should flush the doc out of mongo', function () {
            expect(
              this.DocArchiveManager.promises.archiveDoc
            ).to.have.been.calledWith(this.project_id, this.doc_id)
          })
        })

        describe('when the background flush fails', function () {
          beforeEach(async function () {
            this.err = new Error('foo')
            this.DocArchiveManager.promises.archiveDoc.rejects(this.err)
            await this.DocManager.promises.patchDoc(
              this.project_id,
              this.doc_id,
              this.meta
            )
          })

          it('should log a warning', function () {
            expect(this.logger.warn).to.have.been.calledWith(
              sinon.match({
                projectId: this.project_id,
                docId: this.doc_id,
                err: this.err,
              }),
              'archiving a single doc in the background failed'
            )
          })
        })
      })
    })

    describe('when the doc does not exist', function () {
      it('should return a NotFoundError', async function () {
        this.MongoManager.promises.findDoc.resolves(null)
        await expect(
          this.DocManager.promises.patchDoc(this.project_id, this.doc_id, {})
        ).to.be.rejectedWith(
          `No such project/doc to delete: ${this.project_id}/${this.doc_id}`
        )
      })
    })
  })

  describe('updateDoc', function () {
    beforeEach(function () {
      this.oldDocLines = ['old', 'doc', 'lines']
      this.newDocLines = ['new', 'doc', 'lines']
      this.originalRanges = {
        changes: [
          {
            id: new ObjectId().toString(),
            op: { i: 'foo', p: 3 },
            meta: {
              user_id: new ObjectId().toString(),
              ts: new Date().toString(),
            },
          },
        ],
      }
      this.newRanges = {
        changes: [
          {
            id: new ObjectId().toString(),
            op: { i: 'bar', p: 6 },
            meta: {
              user_id: new ObjectId().toString(),
              ts: new Date().toString(),
            },
          },
        ],
      }
      this.version = 42
      this.doc = {
        _id: this.doc_id,
        project_id: this.project_id,
        lines: this.oldDocLines,
        rev: (this.rev = 5),
        version: this.version,
        ranges: this.originalRanges,
      }

      this.DocManager.promises._getDoc = sinon.stub()
    })

    describe('when only the doc lines have changed', function () {
      beforeEach(async function () {
        this.DocManager.promises._getDoc = sinon.stub().resolves(this.doc)
        this.result = await this.DocManager.promises.updateDoc(
          this.project_id,
          this.doc_id,
          this.newDocLines,
          this.version,
          this.originalRanges
        )
      })

      it('should get the existing doc', function () {
        this.DocManager.promises._getDoc
          .calledWith(this.project_id, this.doc_id, {
            version: true,
            rev: true,
            lines: true,
            ranges: true,
            inS3: true,
          })
          .should.equal(true)
      })

      it('should upsert the document to the doc collection', function () {
        this.MongoManager.promises.upsertIntoDocCollection
          .calledWith(this.project_id, this.doc_id, this.rev, {
            lines: this.newDocLines,
          })
          .should.equal(true)
      })

      it('should return the new rev', function () {
        expect(this.result).to.deep.equal({ modified: true, rev: this.rev + 1 })
      })
    })

    describe('when the doc ranges have changed', function () {
      beforeEach(async function () {
        this.DocManager.promises._getDoc = sinon.stub().resolves(this.doc)
        this.RangeManager.shouldUpdateRanges.returns(true)
        this.result = await this.DocManager.promises.updateDoc(
          this.project_id,
          this.doc_id,
          this.oldDocLines,
          this.version,
          this.newRanges
        )
      })

      it('should upsert the ranges', function () {
        this.MongoManager.promises.upsertIntoDocCollection
          .calledWith(this.project_id, this.doc_id, this.rev, {
            ranges: this.newRanges,
          })
          .should.equal(true)
      })

      it('should return the new rev', function () {
        expect(this.result).to.deep.equal({ modified: true, rev: this.rev + 1 })
      })
    })

    describe('when only the version has changed', function () {
      beforeEach(async function () {
        this.DocManager.promises._getDoc = sinon.stub().resolves(this.doc)
        this.result = await this.DocManager.promises.updateDoc(
          this.project_id,
          this.doc_id,
          this.oldDocLines,
          this.version + 1,
          this.originalRanges
        )
      })

      it('should update the version', function () {
        this.MongoManager.promises.upsertIntoDocCollection.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          this.rev,
          { version: this.version + 1 }
        )
      })

      it('should return the old rev', function () {
        expect(this.result).to.deep.equal({ modified: true, rev: this.rev })
      })
    })

    describe('when the doc has not changed at all', function () {
      beforeEach(async function () {
        this.DocManager.promises._getDoc = sinon.stub().resolves(this.doc)
        this.result = await this.DocManager.promises.updateDoc(
          this.project_id,
          this.doc_id,
          this.oldDocLines,
          this.version,
          this.originalRanges
        )
      })

      it('should not update the ranges or lines or version', function () {
        this.MongoManager.promises.upsertIntoDocCollection.called.should.equal(
          false
        )
      })

      it('should return the old rev and modified == false', function () {
        expect(this.result).to.deep.equal({ modified: false, rev: this.rev })
      })
    })

    describe('when the version is null', function () {
      it('should return an error', async function () {
        await expect(
          this.DocManager.promises.updateDoc(
            this.project_id,
            this.doc_id,
            this.newDocLines,
            null,
            this.originalRanges
          )
        ).to.be.rejectedWith('no lines, version or ranges provided')
      })
    })

    describe('when the lines are null', function () {
      it('should return an error', async function () {
        await expect(
          this.DocManager.promises.updateDoc(
            this.project_id,
            this.doc_id,
            null,
            this.version,
            this.originalRanges
          )
        ).to.be.rejectedWith('no lines, version or ranges provided')
      })
    })

    describe('when the ranges are null', function () {
      it('should return an error', async function () {
        await expect(
          this.DocManager.promises.updateDoc(
            this.project_id,
            this.doc_id,
            this.newDocLines,
            this.version,
            null
          )
        ).to.be.rejectedWith('no lines, version or ranges provided')
      })
    })

    describe('when there is a generic error getting the doc', function () {
      beforeEach(async function () {
        this.error = new Error('doc could not be found')
        this.DocManager.promises._getDoc = sinon.stub().rejects(this.error)
        await expect(
          this.DocManager.promises.updateDoc(
            this.project_id,
            this.doc_id,
            this.newDocLines,
            this.version,
            this.originalRanges
          )
        ).to.be.rejectedWith(this.error)
      })

      it('should not upsert the document to the doc collection', function () {
        this.MongoManager.promises.upsertIntoDocCollection.should.not.have.been
          .called
      })
    })

    describe('when the version was decremented', function () {
      it('should return an error', async function () {
        this.DocManager.promises._getDoc = sinon.stub().resolves(this.doc)
        await expect(
          this.DocManager.promises.updateDoc(
            this.project_id,
            this.doc_id,
            this.newDocLines,
            this.version - 1,
            this.originalRanges
          )
        ).to.be.rejectedWith(Errors.DocVersionDecrementedError)
      })
    })

    describe('when the doc lines have not changed', function () {
      beforeEach(async function () {
        this.DocManager.promises._getDoc = sinon.stub().resolves(this.doc)
        this.result = await this.DocManager.promises.updateDoc(
          this.project_id,
          this.doc_id,
          this.oldDocLines.slice(),
          this.version,
          this.originalRanges
        )
      })

      it('should not update the doc', function () {
        this.MongoManager.promises.upsertIntoDocCollection.called.should.equal(
          false
        )
      })

      it('should return the existing rev', function () {
        expect(this.result).to.deep.equal({ modified: false, rev: this.rev })
      })
    })

    describe('when the doc does not exist', function () {
      beforeEach(async function () {
        this.DocManager.promises._getDoc = sinon.stub().resolves(null)
        this.result = await this.DocManager.promises.updateDoc(
          this.project_id,
          this.doc_id,
          this.newDocLines,
          this.version,
          this.originalRanges
        )
      })

      it('should upsert the document to the doc collection', function () {
        this.MongoManager.promises.upsertIntoDocCollection.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          undefined,
          {
            lines: this.newDocLines,
            ranges: this.originalRanges,
            version: this.version,
          }
        )
      })

      it('should return the new rev', function () {
        expect(this.result).to.deep.equal({ modified: true, rev: 1 })
      })
    })

    describe('when another update is racing', function () {
      beforeEach(async function () {
        this.DocManager.promises._getDoc = sinon.stub().resolves(this.doc)
        this.MongoManager.promises.upsertIntoDocCollection
          .onFirstCall()
          .rejects(new Errors.DocRevValueError())
        this.RangeManager.shouldUpdateRanges.returns(true)
        this.result = await this.DocManager.promises.updateDoc(
          this.project_id,
          this.doc_id,
          this.newDocLines,
          this.version + 1,
          this.newRanges
        )
      })

      it('should upsert the doc twice', function () {
        this.MongoManager.promises.upsertIntoDocCollection.should.have.been.calledWith(
          this.project_id,
          this.doc_id,
          this.rev,
          {
            ranges: this.newRanges,
            lines: this.newDocLines,
            version: this.version + 1,
          }
        )
        this.MongoManager.promises.upsertIntoDocCollection.should.have.been
          .calledTwice
      })

      it('should return the new rev', function () {
        expect(this.result).to.deep.equal({ modified: true, rev: this.rev + 1 })
      })
    })
  })
})
