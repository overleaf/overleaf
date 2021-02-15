/* eslint-disable
    camelcase,
    handle-callback-err,
    no-dupe-keys,
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
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const chai = require('chai')
chai.use(require('sinon-chai'))
const { assert } = require('chai')
chai.should()
const { expect } = chai
const modulePath = require('path').join(__dirname, '../../../app/js/DocManager')
const { ObjectId } = require('mongodb')
const Errors = require('../../../app/js/Errors')

describe('DocManager', function () {
  beforeEach(function () {
    this.DocManager = SandboxedModule.require(modulePath, {
      requires: {
        './MongoManager': (this.MongoManager = {}),
        './DocArchiveManager': (this.DocArchiveManager = {}),
        './RangeManager': (this.RangeManager = {
          jsonRangesToMongo(r) {
            return r
          },
          shouldUpdateRanges: sinon.stub().returns(false)
        }),
        'settings-sharelatex': (this.settings = { docstore: {} }),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          warn() {},
          err() {}
        }),
        './Errors': Errors
      }
    })
    this.doc_id = ObjectId().toString()
    this.project_id = ObjectId().toString()
    this.another_project_id = ObjectId().toString()
    this.callback = sinon.stub()
    return (this.stubbedError = new Error('blew up'))
  })

  describe('checkDocExists', function () {
    beforeEach(function () {
      return (this.DocManager._getDoc = sinon.stub())
    })

    it('should call get doc with a quick filter', function (done) {
      this.DocManager._getDoc.callsArgWith(3, null, { _id: this.doc_id })
      return this.DocManager.checkDocExists(
        this.project_id,
        this.doc_id,
        (err, exist) => {
          exist.should.equal(true)
          this.DocManager._getDoc
            .calledWith(this.project_id, this.doc_id, { _id: 1, inS3: true })
            .should.equal(true)
          return done()
        }
      )
    })

    it('should return false when doc is not there', function (done) {
      this.DocManager._getDoc.callsArgWith(3, null)
      return this.DocManager.checkDocExists(
        this.project_id,
        this.doc_id,
        (err, exist) => {
          exist.should.equal(false)
          return done()
        }
      )
    })

    return it('should return error when get doc errors', function (done) {
      this.DocManager._getDoc.callsArgWith(3, 'error')
      return this.DocManager.checkDocExists(
        this.project_id,
        this.doc_id,
        (err, exist) => {
          err.should.equal('error')
          return done()
        }
      )
    })
  })

  describe('getFullDoc', function () {
    beforeEach(function () {
      this.DocManager._getDoc = sinon.stub()
      return (this.doc = {
        _id: this.doc_id,
        lines: ['2134']
      })
    })

    it('should call get doc with a quick filter', function (done) {
      this.DocManager._getDoc.callsArgWith(3, null, this.doc)
      return this.DocManager.getFullDoc(
        this.project_id,
        this.doc_id,
        (err, doc) => {
          doc.should.equal(this.doc)
          this.DocManager._getDoc
            .calledWith(this.project_id, this.doc_id, {
              lines: true,
              rev: true,
              deleted: true,
              version: true,
              ranges: true,
              inS3: true
            })
            .should.equal(true)
          return done()
        }
      )
    })

    return it('should return error when get doc errors', function (done) {
      this.DocManager._getDoc.callsArgWith(3, 'error')
      return this.DocManager.getFullDoc(
        this.project_id,
        this.doc_id,
        (err, exist) => {
          err.should.equal('error')
          return done()
        }
      )
    })
  })

  describe('getRawDoc', function () {
    beforeEach(function () {
      this.DocManager._getDoc = sinon.stub()
      return (this.doc = { lines: ['2134'] })
    })

    it('should call get doc with a quick filter', function (done) {
      this.DocManager._getDoc.callsArgWith(3, null, this.doc)
      return this.DocManager.getDocLines(
        this.project_id,
        this.doc_id,
        (err, doc) => {
          doc.should.equal(this.doc)
          this.DocManager._getDoc
            .calledWith(this.project_id, this.doc_id, {
              lines: true,
              inS3: true
            })
            .should.equal(true)
          return done()
        }
      )
    })

    return it('should return error when get doc errors', function (done) {
      this.DocManager._getDoc.callsArgWith(3, 'error')
      return this.DocManager.getDocLines(
        this.project_id,
        this.doc_id,
        (err, exist) => {
          err.should.equal('error')
          return done()
        }
      )
    })
  })

  describe('getDoc', function () {
    beforeEach(function () {
      this.project = { name: 'mock-project' }
      this.doc = {
        _id: this.doc_id,
        project_id: this.project_id,
        lines: ['mock-lines']
      }
      this.version = 42
      this.MongoManager.findDoc = sinon.stub()
      return (this.MongoManager.getDocVersion = sinon
        .stub()
        .yields(null, this.version))
    })

    describe('when using a filter', function () {
      beforeEach(function () {
        return this.MongoManager.findDoc.yields(null, this.doc)
      })

      it('should error if inS3 is not set to true', function (done) {
        return this.DocManager._getDoc(
          this.project_id,
          this.doc_id,
          { inS3: false },
          (err) => {
            expect(err).to.exist
            return done()
          }
        )
      })

      it('should always get inS3 even when no filter is passed', function (done) {
        return this.DocManager._getDoc(
          this.project_id,
          this.doc_id,
          undefined,
          (err) => {
            this.MongoManager.findDoc.called.should.equal(false)
            expect(err).to.exist
            return done()
          }
        )
      })

      return it('should not error if inS3 is set to true', function (done) {
        return this.DocManager._getDoc(
          this.project_id,
          this.doc_id,
          { inS3: true },
          (err) => {
            expect(err).to.not.exist
            return done()
          }
        )
      })
    })

    describe('when the doc is in the doc collection', function () {
      beforeEach(function () {
        this.MongoManager.findDoc.yields(null, this.doc)
        return this.DocManager._getDoc(
          this.project_id,
          this.doc_id,
          { version: true, inS3: true },
          this.callback
        )
      })

      it('should get the doc from the doc collection', function () {
        return this.MongoManager.findDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should get the doc version from the docOps collection', function () {
        return this.MongoManager.getDocVersion
          .calledWith(this.doc_id)
          .should.equal(true)
      })

      return it('should return the callback with the doc with the version', function () {
        this.callback.called.should.equal(true)
        const doc = this.callback.args[0][1]
        doc.lines.should.equal(this.doc.lines)
        return doc.version.should.equal(this.version)
      })
    })

    describe('without the version filter', function () {
      beforeEach(function () {
        this.MongoManager.findDoc.yields(null, this.doc)
        return this.DocManager._getDoc(
          this.project_id,
          this.doc_id,
          { version: false, inS3: true },
          this.callback
        )
      })

      return it('should not get the doc version from the docOps collection', function () {
        return this.MongoManager.getDocVersion.called.should.equal(false)
      })
    })

    describe('when MongoManager.findDoc errors', function () {
      beforeEach(function () {
        this.MongoManager.findDoc.yields(this.stubbedError)
        return this.DocManager._getDoc(
          this.project_id,
          this.doc_id,
          { version: true, inS3: true },
          this.callback
        )
      })

      return it('should return the error', function () {
        return this.callback.calledWith(this.stubbedError).should.equal(true)
      })
    })

    describe('when the doc is archived', function () {
      beforeEach(function () {
        this.doc = {
          _id: this.doc_id,
          project_id: this.project_id,
          lines: ['mock-lines'],
          inS3: true
        }
        this.MongoManager.findDoc.yields(null, this.doc)
        this.DocArchiveManager.unarchiveDoc = (
          project_id,
          doc_id,
          callback
        ) => {
          this.doc.inS3 = false
          return callback()
        }
        sinon.spy(this.DocArchiveManager, 'unarchiveDoc')
        return this.DocManager._getDoc(
          this.project_id,
          this.doc_id,
          { version: true, inS3: true },
          this.callback
        )
      })

      it('should call the DocArchive to unarchive the doc', function () {
        return this.DocArchiveManager.unarchiveDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should look up the doc twice', function () {
        return this.MongoManager.findDoc.calledTwice.should.equal(true)
      })

      return it('should return the doc', function () {
        return this.callback.calledWith(null, this.doc).should.equal(true)
      })
    })

    return describe('when the doc does not exist in the docs collection', function () {
      beforeEach(function () {
        this.MongoManager.findDoc = sinon.stub().yields(null, null)
        return this.DocManager._getDoc(
          this.project_id,
          this.doc_id,
          { version: true, inS3: true },
          this.callback
        )
      })

      return it('should return a NotFoundError', function () {
        return this.callback
          .calledWith(
            sinon.match.has(
              'message',
              `No such doc: ${this.doc_id} in project ${this.project_id}`
            )
          )
          .should.equal(true)
      })
    })
  })

  describe('getAllNonDeletedDocs', function () {
    describe('when the project exists', function () {
      beforeEach(function () {
        this.docs = [
          {
            _id: this.doc_id,
            project_id: this.project_id,
            lines: ['mock-lines']
          }
        ]
        this.MongoManager.getProjectsDocs = sinon
          .stub()
          .callsArgWith(3, null, this.docs)
        this.DocArchiveManager.unArchiveAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        this.filter = { lines: true }
        return this.DocManager.getAllNonDeletedDocs(
          this.project_id,
          this.filter,
          this.callback
        )
      })

      it('should get the project from the database', function () {
        return this.MongoManager.getProjectsDocs
          .calledWith(this.project_id, { include_deleted: false }, this.filter)
          .should.equal(true)
      })

      return it('should return the docs', function () {
        return this.callback.calledWith(null, this.docs).should.equal(true)
      })
    })

    return describe('when there are no docs for the project', function () {
      beforeEach(function () {
        this.MongoManager.getProjectsDocs = sinon
          .stub()
          .callsArgWith(3, null, null)
        this.DocArchiveManager.unArchiveAllDocs = sinon
          .stub()
          .callsArgWith(1, null)
        return this.DocManager.getAllNonDeletedDocs(
          this.project_id,
          this.filter,
          this.callback
        )
      })

      return it('should return a NotFoundError', function () {
        return this.callback
          .calledWith(
            sinon.match.has('message', `No docs for project ${this.project_id}`)
          )
          .should.equal(true)
      })
    })
  })

  describe('deleteDoc', function () {
    describe('when the doc exists', function () {
      beforeEach(function (done) {
        this.callback = sinon.stub().callsFake(done)
        this.lines = ['mock', 'doc', 'lines']
        this.rev = 77
        this.DocManager.checkDocExists = sinon
          .stub()
          .callsArgWith(2, null, true)
        this.MongoManager.markDocAsDeleted = sinon.stub().yields(null)
        this.DocArchiveManager.archiveDocById = sinon.stub().yields(null)
        return this.DocManager.deleteDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should get the doc', function () {
        return this.DocManager.checkDocExists
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should mark doc as deleted', function () {
        return this.MongoManager.markDocAsDeleted
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should return the callback', function () {
        return this.callback.called.should.equal(true)
      })

      describe('background flush disabled', function () {
        beforeEach(function () {
          this.settings.docstore.archiveOnSoftDelete = false
        })

        it('should not flush the doc out of mongo', function () {
          this.DocArchiveManager.archiveDocById.should.not.have.been.called
        })
      })

      describe('background flush enabled', function () {
        beforeEach(function (done) {
          this.settings.docstore.archiveOnSoftDelete = true
          this.callback = sinon.stub().callsFake(done)
          this.DocManager.deleteDoc(this.project_id, this.doc_id, this.callback)
        })

        it('should not fail the delete process', function () {
          this.callback.should.have.been.calledWith(null)
        })

        it('should flush the doc out of mongo', function () {
          this.DocArchiveManager.archiveDocById.should.have.been.calledWith(
            this.project_id,
            this.doc_id
          )
        })

        describe('when the background flush fails', function () {
          beforeEach(function (done) {
            this.err = new Error('foo')
            this.DocManager.checkDocExists = sinon.stub().yields(null, true)
            this.MongoManager.markDocAsDeleted = sinon.stub().yields(null)
            this.DocArchiveManager.archiveDocById = sinon
              .stub()
              .yields(this.err)
            this.logger.warn = sinon.stub()
            this.callback = sinon.stub().callsFake(done)
            this.DocManager.deleteDoc(
              this.project_id,
              this.doc_id,
              this.callback
            )
          })

          it('should log a warning', function () {
            this.logger.warn.should.have.been.calledWith(
              sinon.match({
                project_id: this.project_id,
                doc_id: this.doc_id,
                err: this.err
              }),
              'archiving a single doc in the background failed'
            )
          })

          it('should not fail the delete process', function () {
            this.callback.should.have.been.calledWith(null)
          })
        })
      })
    })

    return describe('when the doc does not exist', function () {
      beforeEach(function () {
        this.DocManager.checkDocExists = sinon
          .stub()
          .callsArgWith(2, null, false)
        return this.DocManager.deleteDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      return it('should return a NotFoundError', function () {
        return this.callback
          .calledWith(
            sinon.match.has(
              'message',
              `No such project/doc to delete: ${this.project_id}/${this.doc_id}`
            )
          )
          .should.equal(true)
      })
    })
  })

  describe('patchDoc', function () {
    describe('when the doc exists', function () {
      beforeEach(function () {
        this.lines = ['mock', 'doc', 'lines']
        this.rev = 77
        this.MongoManager.findDoc = sinon
          .stub()
          .yields(null, { _id: ObjectId(this.doc_id) })
        this.MongoManager.patchDoc = sinon.stub().yields(null)
        this.DocArchiveManager.archiveDocById = sinon.stub().yields(null)
        this.meta = {}
      })

      describe('standard path', function () {
        beforeEach(function (done) {
          this.callback = sinon.stub().callsFake(done)
          this.DocManager.patchDoc(
            this.project_id,
            this.doc_id,
            this.meta,
            this.callback
          )
        })

        it('should get the doc', function () {
          expect(this.MongoManager.findDoc).to.have.been.calledWith(
            this.project_id,
            this.doc_id
          )
        })

        it('should persist the meta', function () {
          expect(this.MongoManager.patchDoc).to.have.been.calledWith(
            this.project_id,
            this.doc_id,
            this.meta
          )
        })

        it('should return the callback', function () {
          expect(this.callback).to.have.been.calledWith(null)
        })
      })

      describe('background flush disabled and deleting a doc', function () {
        beforeEach(function (done) {
          this.settings.docstore.archiveOnSoftDelete = false
          this.meta.deleted = true

          this.callback = sinon.stub().callsFake(done)
          this.DocManager.patchDoc(
            this.project_id,
            this.doc_id,
            this.meta,
            this.callback
          )
        })

        it('should not flush the doc out of mongo', function () {
          expect(this.DocArchiveManager.archiveDocById).to.not.have.been.called
        })
      })

      describe('background flush enabled and not deleting a doc', function () {
        beforeEach(function (done) {
          this.settings.docstore.archiveOnSoftDelete = false
          this.meta.deleted = false
          this.callback = sinon.stub().callsFake(done)
          this.DocManager.patchDoc(
            this.project_id,
            this.doc_id,
            this.meta,
            this.callback
          )
        })

        it('should not flush the doc out of mongo', function () {
          expect(this.DocArchiveManager.archiveDocById).to.not.have.been.called
        })
      })

      describe('background flush enabled and deleting a doc', function () {
        beforeEach(function () {
          this.settings.docstore.archiveOnSoftDelete = true
          this.meta.deleted = true
          this.logger.warn = sinon.stub()
        })

        describe('when the background flush succeeds', function () {
          beforeEach(function (done) {
            this.DocArchiveManager.archiveDocById = sinon.stub().yields(null)
            this.callback = sinon.stub().callsFake(done)
            this.DocManager.patchDoc(
              this.project_id,
              this.doc_id,
              this.meta,
              this.callback
            )
          })

          it('should not log a warning', function () {
            expect(this.logger.warn).to.not.have.been.called
          })

          it('should flush the doc out of mongo', function () {
            expect(
              this.DocArchiveManager.archiveDocById
            ).to.have.been.calledWith(this.project_id, this.doc_id)
          })
        })

        describe('when the background flush fails', function () {
          beforeEach(function (done) {
            this.err = new Error('foo')
            this.DocArchiveManager.archiveDocById = sinon
              .stub()
              .yields(this.err)
            this.callback = sinon.stub().callsFake(done)
            this.DocManager.patchDoc(
              this.project_id,
              this.doc_id,
              this.meta,
              this.callback
            )
          })

          it('should log a warning', function () {
            expect(this.logger.warn).to.have.been.calledWith(
              sinon.match({
                project_id: this.project_id,
                doc_id: this.doc_id,
                err: this.err
              }),
              'archiving a single doc in the background failed'
            )
          })

          it('should not fail the delete process', function () {
            expect(this.callback).to.have.been.calledWith(null)
          })
        })
      })
    })

    describe('when the doc is already deleted', function () {
      beforeEach(function (done) {
        this.MongoManager.findDoc = sinon
          .stub()
          .yields(null, { _id: ObjectId(this.doc_id), deleted: true })
        this.MongoManager.patchDoc = sinon.stub()

        this.callback = sinon.stub().callsFake(() => done())
        this.DocManager.patchDoc(
          this.project_id,
          this.doc_id,
          'tomato.tex',
          this.callback
        )
      })

      it('should reject the operation', function () {
        expect(this.callback).to.have.been.calledWith(
          sinon.match.has('message', 'Cannot PATCH after doc deletion')
        )
      })

      it('should not persist the change to mongo', function () {
        expect(this.MongoManager.patchDoc).to.not.have.been.called
      })
    })

    describe('when the doc does not exist', function () {
      beforeEach(function () {
        this.MongoManager.findDoc = sinon.stub().yields(null)
        this.DocManager.patchDoc(
          this.project_id,
          this.doc_id,
          {},
          this.callback
        )
      })

      it('should return a NotFoundError', function () {
        expect(this.callback).to.have.been.calledWith(
          sinon.match.has(
            'message',
            `No such project/doc to delete: ${this.project_id}/${this.doc_id}`
          )
        )
      })
    })
  })

  return describe('updateDoc', function () {
    beforeEach(function () {
      this.oldDocLines = ['old', 'doc', 'lines']
      this.newDocLines = ['new', 'doc', 'lines']
      this.originalRanges = {
        changes: [
          {
            id: ObjectId().toString(),
            op: { i: 'foo', p: 3 },
            meta: {
              user_id: ObjectId().toString(),
              ts: new Date().toString()
            }
          }
        ]
      }
      this.newRanges = {
        changes: [
          {
            id: ObjectId().toString(),
            op: { i: 'bar', p: 6 },
            meta: {
              user_id: ObjectId().toString(),
              ts: new Date().toString()
            }
          }
        ]
      }
      this.version = 42
      this.doc = {
        _id: this.doc_id,
        project_id: this.project_id,
        lines: this.oldDocLines,
        rev: (this.rev = 5),
        version: this.version,
        ranges: this.originalRanges
      }

      this.MongoManager.upsertIntoDocCollection = sinon.stub().callsArg(3)
      this.MongoManager.setDocVersion = sinon.stub().yields()
      return (this.DocManager._getDoc = sinon.stub())
    })

    describe('when only the doc lines have changed', function () {
      beforeEach(function () {
        this.DocManager._getDoc = sinon.stub().callsArgWith(3, null, this.doc)
        return this.DocManager.updateDoc(
          this.project_id,
          this.doc_id,
          this.newDocLines,
          this.version,
          this.originalRanges,
          this.callback
        )
      })

      it('should get the existing doc', function () {
        return this.DocManager._getDoc
          .calledWith(this.project_id, this.doc_id, {
            version: true,
            rev: true,
            lines: true,
            version: true,
            ranges: true,
            inS3: true
          })
          .should.equal(true)
      })

      it('should upsert the document to the doc collection', function () {
        return this.MongoManager.upsertIntoDocCollection
          .calledWith(this.project_id, this.doc_id, { lines: this.newDocLines })
          .should.equal(true)
      })

      it('should not update the version', function () {
        return this.MongoManager.setDocVersion.called.should.equal(false)
      })

      return it('should return the callback with the new rev', function () {
        return this.callback
          .calledWith(null, true, this.rev + 1)
          .should.equal(true)
      })
    })

    describe('when the doc ranges have changed', function () {
      beforeEach(function () {
        this.DocManager._getDoc = sinon.stub().callsArgWith(3, null, this.doc)
        this.RangeManager.shouldUpdateRanges.returns(true)
        return this.DocManager.updateDoc(
          this.project_id,
          this.doc_id,
          this.oldDocLines,
          this.version,
          this.newRanges,
          this.callback
        )
      })

      it('should upsert the ranges', function () {
        return this.MongoManager.upsertIntoDocCollection
          .calledWith(this.project_id, this.doc_id, { ranges: this.newRanges })
          .should.equal(true)
      })

      it('should not update the version', function () {
        return this.MongoManager.setDocVersion.called.should.equal(false)
      })

      return it('should return the callback with the new rev', function () {
        return this.callback
          .calledWith(null, true, this.rev + 1)
          .should.equal(true)
      })
    })

    describe('when only the version has changed', function () {
      beforeEach(function () {
        this.DocManager._getDoc = sinon.stub().callsArgWith(3, null, this.doc)
        return this.DocManager.updateDoc(
          this.project_id,
          this.doc_id,
          this.oldDocLines,
          this.version + 1,
          this.originalRanges,
          this.callback
        )
      })

      it('should not change the lines or ranges', function () {
        return this.MongoManager.upsertIntoDocCollection.called.should.equal(
          false
        )
      })

      it('should update the version', function () {
        return this.MongoManager.setDocVersion
          .calledWith(this.doc_id, this.version + 1)
          .should.equal(true)
      })

      return it('should return the callback with the old rev', function () {
        return this.callback.calledWith(null, true, this.rev).should.equal(true)
      })
    })

    describe('when the doc has not changed at all', function () {
      beforeEach(function () {
        this.DocManager._getDoc = sinon.stub().callsArgWith(3, null, this.doc)
        return this.DocManager.updateDoc(
          this.project_id,
          this.doc_id,
          this.oldDocLines,
          this.version,
          this.originalRanges,
          this.callback
        )
      })

      it('should not update the ranges or lines', function () {
        return this.MongoManager.upsertIntoDocCollection.called.should.equal(
          false
        )
      })

      it('should not update the version', function () {
        return this.MongoManager.setDocVersion.called.should.equal(false)
      })

      return it('should return the callback with the old rev and modified == false', function () {
        return this.callback
          .calledWith(null, false, this.rev)
          .should.equal(true)
      })
    })

    describe('when the version is null', function () {
      beforeEach(function () {
        return this.DocManager.updateDoc(
          this.project_id,
          this.doc_id,
          this.newDocLines,
          null,
          this.originalRanges,
          this.callback
        )
      })

      return it('should return an error', function () {
        return this.callback
          .calledWith(
            sinon.match.has('message', 'no lines, version or ranges provided')
          )
          .should.equal(true)
      })
    })

    describe('when the lines are null', function () {
      beforeEach(function () {
        return this.DocManager.updateDoc(
          this.project_id,
          this.doc_id,
          null,
          this.version,
          this.originalRanges,
          this.callback
        )
      })

      return it('should return an error', function () {
        return this.callback
          .calledWith(
            sinon.match.has('message', 'no lines, version or ranges provided')
          )
          .should.equal(true)
      })
    })

    describe('when the ranges are null', function () {
      beforeEach(function () {
        return this.DocManager.updateDoc(
          this.project_id,
          this.doc_id,
          this.newDocLines,
          this.version,
          null,
          this.callback
        )
      })

      return it('should return an error', function () {
        return this.callback
          .calledWith(
            sinon.match.has('message', 'no lines, version or ranges provided')
          )
          .should.equal(true)
      })
    })

    describe('when there is a generic error getting the doc', function () {
      beforeEach(function () {
        this.error = new Error('doc could not be found')
        this.DocManager._getDoc = sinon
          .stub()
          .callsArgWith(3, this.error, null, null)
        return this.DocManager.updateDoc(
          this.project_id,
          this.doc_id,
          this.newDocLines,
          this.version,
          this.originalRanges,
          this.callback
        )
      })

      it('should not upsert the document to the doc collection', function () {
        return this.MongoManager.upsertIntoDocCollection.called.should.equal(
          false
        )
      })

      return it('should return the callback with the error', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    describe('when the doc lines have not changed', function () {
      beforeEach(function () {
        this.DocManager._getDoc = sinon.stub().callsArgWith(3, null, this.doc)
        return this.DocManager.updateDoc(
          this.project_id,
          this.doc_id,
          this.oldDocLines.slice(),
          this.version,
          this.originalRanges,
          this.callback
        )
      })

      it('should not update the doc', function () {
        return this.MongoManager.upsertIntoDocCollection.called.should.equal(
          false
        )
      })

      return it('should return the callback with the existing rev', function () {
        return this.callback
          .calledWith(null, false, this.rev)
          .should.equal(true)
      })
    })

    return describe('when the doc does not exist', function () {
      beforeEach(function () {
        this.DocManager._getDoc = sinon.stub().callsArgWith(3, null, null, null)
        return this.DocManager.updateDoc(
          this.project_id,
          this.doc_id,
          this.newDocLines,
          this.version,
          this.originalRanges,
          this.callback
        )
      })

      it('should upsert the document to the doc collection', function () {
        return this.MongoManager.upsertIntoDocCollection
          .calledWith(this.project_id, this.doc_id, {
            lines: this.newDocLines,
            ranges: this.originalRanges
          })
          .should.equal(true)
      })

      it('should set the version', function () {
        return this.MongoManager.setDocVersion
          .calledWith(this.doc_id, this.version)
          .should.equal(true)
      })

      return it('should return the callback with the new rev', function () {
        return this.callback.calledWith(null, true, 1).should.equal(true)
      })
    })
  })
})
