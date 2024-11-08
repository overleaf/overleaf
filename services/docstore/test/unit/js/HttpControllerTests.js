const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { assert, expect } = require('chai')
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/HttpController'
)
const { ObjectId } = require('mongodb-legacy')
const Errors = require('../../../app/js/Errors')

describe('HttpController', function () {
  beforeEach(function () {
    const settings = {
      max_doc_length: 2 * 1024 * 1024,
    }
    this.DocArchiveManager = {
      unArchiveAllDocs: sinon.stub().yields(),
    }
    this.DocManager = {}
    this.HttpController = SandboxedModule.require(modulePath, {
      requires: {
        './DocManager': this.DocManager,
        './DocArchiveManager': this.DocArchiveManager,
        '@overleaf/settings': settings,
        './HealthChecker': {},
        './Errors': Errors,
      },
    })
    this.res = {
      send: sinon.stub(),
      sendStatus: sinon.stub(),
      json: sinon.stub(),
      setHeader: sinon.stub(),
    }
    this.res.status = sinon.stub().returns(this.res)
    this.req = { query: {} }
    this.next = sinon.stub()
    this.projectId = 'mock-project-id'
    this.docId = 'mock-doc-id'
    this.doc = {
      _id: this.docId,
      lines: ['mock', 'lines', ' here', '', '', ' spaces '],
      version: 42,
      rev: 5,
    }
    this.deletedDoc = {
      deleted: true,
      _id: this.docId,
      lines: ['mock', 'lines', ' here', '', '', ' spaces '],
      version: 42,
      rev: 5,
    }
  })

  describe('getDoc', function () {
    describe('without deleted docs', function () {
      beforeEach(function () {
        this.req.params = {
          project_id: this.projectId,
          doc_id: this.docId,
        }
        this.DocManager.getFullDoc = sinon
          .stub()
          .callsArgWith(2, null, this.doc)
        this.HttpController.getDoc(this.req, this.res, this.next)
      })

      it('should get the document with the version (including deleted)', function () {
        this.DocManager.getFullDoc
          .calledWith(this.projectId, this.docId)
          .should.equal(true)
      })

      it('should return the doc as JSON', function () {
        this.res.json
          .calledWith({
            _id: this.docId,
            lines: this.doc.lines,
            rev: this.doc.rev,
            version: this.doc.version,
          })
          .should.equal(true)
      })
    })

    describe('which is deleted', function () {
      beforeEach(function () {
        this.req.params = {
          project_id: this.projectId,
          doc_id: this.docId,
        }
        this.DocManager.getFullDoc = sinon
          .stub()
          .callsArgWith(2, null, this.deletedDoc)
      })

      it('should get the doc from the doc manager', function () {
        this.HttpController.getDoc(this.req, this.res, this.next)
        this.DocManager.getFullDoc
          .calledWith(this.projectId, this.docId)
          .should.equal(true)
      })

      it('should return 404 if the query string delete is not set ', function () {
        this.HttpController.getDoc(this.req, this.res, this.next)
        this.res.sendStatus.calledWith(404).should.equal(true)
      })

      it('should return the doc as JSON if include_deleted is set to true', function () {
        this.req.query.include_deleted = 'true'
        this.HttpController.getDoc(this.req, this.res, this.next)
        this.res.json
          .calledWith({
            _id: this.docId,
            lines: this.doc.lines,
            rev: this.doc.rev,
            deleted: true,
            version: this.doc.version,
          })
          .should.equal(true)
      })
    })
  })

  describe('getRawDoc', function () {
    beforeEach(function () {
      this.req.params = {
        project_id: this.projectId,
        doc_id: this.docId,
      }
      this.DocManager.getDocLines = sinon.stub().callsArgWith(2, null, this.doc)
      this.HttpController.getRawDoc(this.req, this.res, this.next)
    })

    it('should get the document without the version', function () {
      this.DocManager.getDocLines
        .calledWith(this.projectId, this.docId)
        .should.equal(true)
    })

    it('should set the content type header', function () {
      this.res.setHeader
        .calledWith('content-type', 'text/plain')
        .should.equal(true)
    })

    it('should send the raw version of the doc', function () {
      assert.deepEqual(
        this.res.send.args[0][0],
        `${this.doc.lines[0]}\n${this.doc.lines[1]}\n${this.doc.lines[2]}\n${this.doc.lines[3]}\n${this.doc.lines[4]}\n${this.doc.lines[5]}`
      )
    })
  })

  describe('getAllDocs', function () {
    describe('normally', function () {
      beforeEach(function () {
        this.req.params = { project_id: this.projectId }
        this.docs = [
          {
            _id: new ObjectId(),
            lines: ['mock', 'lines', 'one'],
            rev: 2,
          },
          {
            _id: new ObjectId(),
            lines: ['mock', 'lines', 'two'],
            rev: 4,
          },
        ]
        this.DocManager.getAllNonDeletedDocs = sinon
          .stub()
          .callsArgWith(2, null, this.docs)
        this.HttpController.getAllDocs(this.req, this.res, this.next)
      })

      it('should get all the (non-deleted) docs', function () {
        this.DocManager.getAllNonDeletedDocs
          .calledWith(this.projectId, { lines: true, rev: true })
          .should.equal(true)
      })

      it('should return the doc as JSON', function () {
        this.res.json
          .calledWith([
            {
              _id: this.docs[0]._id.toString(),
              lines: this.docs[0].lines,
              rev: this.docs[0].rev,
            },
            {
              _id: this.docs[1]._id.toString(),
              lines: this.docs[1].lines,
              rev: this.docs[1].rev,
            },
          ])
          .should.equal(true)
      })
    })

    describe('with null lines', function () {
      beforeEach(function () {
        this.req.params = { project_id: this.projectId }
        this.docs = [
          {
            _id: new ObjectId(),
            lines: null,
            rev: 2,
          },
          {
            _id: new ObjectId(),
            lines: ['mock', 'lines', 'two'],
            rev: 4,
          },
        ]
        this.DocManager.getAllNonDeletedDocs = sinon
          .stub()
          .callsArgWith(2, null, this.docs)
        this.HttpController.getAllDocs(this.req, this.res, this.next)
      })

      it('should return the doc with fallback lines', function () {
        this.res.json
          .calledWith([
            {
              _id: this.docs[0]._id.toString(),
              lines: [],
              rev: this.docs[0].rev,
            },
            {
              _id: this.docs[1]._id.toString(),
              lines: this.docs[1].lines,
              rev: this.docs[1].rev,
            },
          ])
          .should.equal(true)
      })
    })

    describe('with a null doc', function () {
      beforeEach(function () {
        this.req.params = { project_id: this.projectId }
        this.docs = [
          {
            _id: new ObjectId(),
            lines: ['mock', 'lines', 'one'],
            rev: 2,
          },
          null,
          {
            _id: new ObjectId(),
            lines: ['mock', 'lines', 'two'],
            rev: 4,
          },
        ]
        this.DocManager.getAllNonDeletedDocs = sinon
          .stub()
          .callsArgWith(2, null, this.docs)
        this.HttpController.getAllDocs(this.req, this.res, this.next)
      })

      it('should return the non null docs as JSON', function () {
        this.res.json
          .calledWith([
            {
              _id: this.docs[0]._id.toString(),
              lines: this.docs[0].lines,
              rev: this.docs[0].rev,
            },
            {
              _id: this.docs[2]._id.toString(),
              lines: this.docs[2].lines,
              rev: this.docs[2].rev,
            },
          ])
          .should.equal(true)
      })

      it('should log out an error', function () {
        this.logger.error
          .calledWith(
            {
              err: sinon.match.has('message', 'null doc'),
              projectId: this.projectId,
            },
            'encountered null doc'
          )
          .should.equal(true)
      })
    })
  })

  describe('getAllRanges', function () {
    describe('normally', function () {
      beforeEach(function () {
        this.req.params = { project_id: this.projectId }
        this.docs = [
          {
            _id: new ObjectId(),
            ranges: { mock_ranges: 'one' },
          },
          {
            _id: new ObjectId(),
            ranges: { mock_ranges: 'two' },
          },
        ]
        this.DocManager.getAllNonDeletedDocs = sinon
          .stub()
          .callsArgWith(2, null, this.docs)
        this.HttpController.getAllRanges(this.req, this.res, this.next)
      })

      it('should get all the (non-deleted) doc ranges', function () {
        this.DocManager.getAllNonDeletedDocs
          .calledWith(this.projectId, { ranges: true })
          .should.equal(true)
      })

      it('should return the doc as JSON', function () {
        this.res.json
          .calledWith([
            {
              _id: this.docs[0]._id.toString(),
              ranges: this.docs[0].ranges,
            },
            {
              _id: this.docs[1]._id.toString(),
              ranges: this.docs[1].ranges,
            },
          ])
          .should.equal(true)
      })
    })
  })

  describe('updateDoc', function () {
    beforeEach(function () {
      this.req.params = {
        project_id: this.projectId,
        doc_id: this.docId,
      }
    })

    describe('when the doc lines exist and were updated', function () {
      beforeEach(function () {
        this.req.body = {
          lines: (this.lines = ['hello', 'world']),
          version: (this.version = 42),
          ranges: (this.ranges = { changes: 'mock' }),
        }
        this.DocManager.updateDoc = sinon
          .stub()
          .yields(null, true, (this.rev = 5))
        this.HttpController.updateDoc(this.req, this.res, this.next)
      })

      it('should update the document', function () {
        this.DocManager.updateDoc
          .calledWith(
            this.projectId,
            this.docId,
            this.lines,
            this.version,
            this.ranges
          )
          .should.equal(true)
      })

      it('should return a modified status', function () {
        this.res.json
          .calledWith({ modified: true, rev: this.rev })
          .should.equal(true)
      })
    })

    describe('when the doc lines exist and were not updated', function () {
      beforeEach(function () {
        this.req.body = {
          lines: (this.lines = ['hello', 'world']),
          version: (this.version = 42),
          ranges: {},
        }
        this.DocManager.updateDoc = sinon
          .stub()
          .yields(null, false, (this.rev = 5))
        this.HttpController.updateDoc(this.req, this.res, this.next)
      })

      it('should return a modified status', function () {
        this.res.json
          .calledWith({ modified: false, rev: this.rev })
          .should.equal(true)
      })
    })

    describe('when the doc lines are not provided', function () {
      beforeEach(function () {
        this.req.body = { version: 42, ranges: {} }
        this.DocManager.updateDoc = sinon.stub().yields(null, false)
        this.HttpController.updateDoc(this.req, this.res, this.next)
      })

      it('should not update the document', function () {
        this.DocManager.updateDoc.called.should.equal(false)
      })

      it('should return a 400 (bad request) response', function () {
        this.res.sendStatus.calledWith(400).should.equal(true)
      })
    })

    describe('when the doc version are not provided', function () {
      beforeEach(function () {
        this.req.body = { version: 42, lines: ['hello world'] }
        this.DocManager.updateDoc = sinon.stub().yields(null, false)
        this.HttpController.updateDoc(this.req, this.res, this.next)
      })

      it('should not update the document', function () {
        this.DocManager.updateDoc.called.should.equal(false)
      })

      it('should return a 400 (bad request) response', function () {
        this.res.sendStatus.calledWith(400).should.equal(true)
      })
    })

    describe('when the doc ranges is not provided', function () {
      beforeEach(function () {
        this.req.body = { lines: ['foo'], version: 42 }
        this.DocManager.updateDoc = sinon.stub().yields(null, false)
        this.HttpController.updateDoc(this.req, this.res, this.next)
      })

      it('should not update the document', function () {
        this.DocManager.updateDoc.called.should.equal(false)
      })

      it('should return a 400 (bad request) response', function () {
        this.res.sendStatus.calledWith(400).should.equal(true)
      })
    })

    describe('when the doc body is too large', function () {
      beforeEach(function () {
        this.req.body = {
          lines: (this.lines = Array(2049).fill('a'.repeat(1024))),
          version: (this.version = 42),
          ranges: (this.ranges = { changes: 'mock' }),
        }
        this.HttpController.updateDoc(this.req, this.res, this.next)
      })

      it('should return a 413 (too large) response', function () {
        sinon.assert.calledWith(this.res.status, 413)
      })

      it('should report that the document body is too large', function () {
        sinon.assert.calledWith(this.res.send, 'document body too large')
      })
    })
  })

  describe('patchDoc', function () {
    beforeEach(function () {
      this.req.params = {
        project_id: this.projectId,
        doc_id: this.docId,
      }
      this.req.body = { name: 'foo.tex' }
      this.DocManager.patchDoc = sinon.stub().yields(null)
      this.HttpController.patchDoc(this.req, this.res, this.next)
    })

    it('should delete the document', function () {
      expect(this.DocManager.patchDoc).to.have.been.calledWith(
        this.projectId,
        this.docId
      )
    })

    it('should return a 204 (No Content)', function () {
      expect(this.res.sendStatus).to.have.been.calledWith(204)
    })

    describe('with an invalid payload', function () {
      beforeEach(function () {
        this.req.body = { cannot: 'happen' }

        this.DocManager.patchDoc = sinon.stub().yields(null)
        this.HttpController.patchDoc(this.req, this.res, this.next)
      })

      it('should log a message', function () {
        expect(this.logger.fatal).to.have.been.calledWith(
          { field: 'cannot' },
          'joi validation for pathDoc is broken'
        )
      })

      it('should not pass the invalid field along', function () {
        expect(this.DocManager.patchDoc).to.have.been.calledWith(
          this.projectId,
          this.docId,
          {}
        )
      })
    })
  })

  describe('archiveAllDocs', function () {
    beforeEach(function () {
      this.req.params = { project_id: this.projectId }
      this.DocArchiveManager.archiveAllDocs = sinon.stub().callsArg(1)
      this.HttpController.archiveAllDocs(this.req, this.res, this.next)
    })

    it('should archive the project', function () {
      this.DocArchiveManager.archiveAllDocs
        .calledWith(this.projectId)
        .should.equal(true)
    })

    it('should return a 204 (No Content)', function () {
      this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('unArchiveAllDocs', function () {
    beforeEach(function () {
      this.req.params = { project_id: this.projectId }
    })

    describe('on success', function () {
      beforeEach(function (done) {
        this.res.sendStatus.callsFake(() => done())
        this.HttpController.unArchiveAllDocs(this.req, this.res, this.next)
      })

      it('returns a 200', function () {
        expect(this.res.sendStatus).to.have.been.calledWith(200)
      })
    })

    describe("when the archived rev doesn't match", function () {
      beforeEach(function (done) {
        this.res.sendStatus.callsFake(() => done())
        this.DocArchiveManager.unArchiveAllDocs.yields(
          new Errors.DocRevValueError('bad rev')
        )
        this.HttpController.unArchiveAllDocs(this.req, this.res, this.next)
      })

      it('returns a 409', function () {
        expect(this.res.sendStatus).to.have.been.calledWith(409)
      })
    })
  })

  describe('destroyProject', function () {
    beforeEach(function () {
      this.req.params = { project_id: this.projectId }
      this.DocArchiveManager.destroyProject = sinon.stub().callsArg(1)
      this.HttpController.destroyProject(this.req, this.res, this.next)
    })

    it('should destroy the docs', function () {
      sinon.assert.calledWith(
        this.DocArchiveManager.destroyProject,
        this.projectId
      )
    })

    it('should return 204', function () {
      sinon.assert.calledWith(this.res.sendStatus, 204)
    })
  })
})
