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
const SandboxedModule = require('sandboxed-module')
const { assert } = require('chai')
const sinon = require('sinon')
const chai = require('chai')
chai.should()
const { expect } = chai
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/HttpController'
)
const { ObjectId } = require('mongojs')

describe('HttpController', function() {
  beforeEach(function() {
    this.HttpController = SandboxedModule.require(modulePath, {
      requires: {
        './DocManager': (this.DocManager = {}),
        './DocArchiveManager': (this.DocArchiveManager = {}),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub()
        }),
        './HealthChecker': {}
      },
      globals: { process }
    })
    this.res = {
      send: sinon.stub(),
      json: sinon.stub(),
      setHeader: sinon.stub()
    }
    this.res.status = sinon.stub().returns(this.res)
    this.req = { query: {} }
    this.next = sinon.stub()
    this.project_id = 'mock-project-id'
    this.doc_id = 'mock-doc-id'
    this.doc = {
      _id: this.doc_id,
      lines: ['mock', 'lines', ' here', '', '', ' spaces '],
      version: 42,
      rev: 5
    }
    return (this.deletedDoc = {
      deleted: true,
      _id: this.doc_id,
      lines: ['mock', 'lines', ' here', '', '', ' spaces '],
      version: 42,
      rev: 5
    })
  })

  describe('getDoc', function() {
    describe('without deleted docs', function() {
      beforeEach(function() {
        this.req.params = {
          project_id: this.project_id,
          doc_id: this.doc_id
        }
        this.DocManager.getFullDoc = sinon
          .stub()
          .callsArgWith(2, null, this.doc)
        return this.HttpController.getDoc(this.req, this.res, this.next)
      })

      it('should get the document with the version (including deleted)', function() {
        return this.DocManager.getFullDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      return it('should return the doc as JSON', function() {
        return this.res.json
          .calledWith({
            _id: this.doc_id,
            lines: this.doc.lines,
            rev: this.doc.rev,
            version: this.doc.version
          })
          .should.equal(true)
      })
    })

    return describe('which is deleted', function() {
      beforeEach(function() {
        this.req.params = {
          project_id: this.project_id,
          doc_id: this.doc_id
        }
        return (this.DocManager.getFullDoc = sinon
          .stub()
          .callsArgWith(2, null, this.deletedDoc))
      })

      it('should get the doc from the doc manager', function() {
        this.HttpController.getDoc(this.req, this.res, this.next)
        return this.DocManager.getFullDoc
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      it('should return 404 if the query string delete is not set ', function() {
        this.HttpController.getDoc(this.req, this.res, this.next)
        return this.res.send.calledWith(404).should.equal(true)
      })

      return it('should return the doc as JSON if include_deleted is set to true', function() {
        this.req.query.include_deleted = 'true'
        this.HttpController.getDoc(this.req, this.res, this.next)
        return this.res.json
          .calledWith({
            _id: this.doc_id,
            lines: this.doc.lines,
            rev: this.doc.rev,
            deleted: true,
            version: this.doc.version
          })
          .should.equal(true)
      })
    })
  })

  describe('getRawDoc', function() {
    beforeEach(function() {
      this.req.params = {
        project_id: this.project_id,
        doc_id: this.doc_id
      }
      this.DocManager.getDocLines = sinon.stub().callsArgWith(2, null, this.doc)
      return this.HttpController.getRawDoc(this.req, this.res, this.next)
    })

    it('should get the document without the version', function() {
      return this.DocManager.getDocLines
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should set the content type header', function() {
      return this.res.setHeader
        .calledWith('content-type', 'text/plain')
        .should.equal(true)
    })

    return it('should send the raw version of the doc', function() {
      return assert.deepEqual(
        this.res.send.args[0][0],
        `${this.doc.lines[0]}\n${this.doc.lines[1]}\n${this.doc.lines[2]}\n${this.doc.lines[3]}\n${this.doc.lines[4]}\n${this.doc.lines[5]}`
      )
    })
  })

  describe('getAllDocs', function() {
    describe('normally', function() {
      beforeEach(function() {
        this.req.params = { project_id: this.project_id }
        this.docs = [
          {
            _id: ObjectId(),
            lines: ['mock', 'lines', 'one'],
            rev: 2
          },
          {
            _id: ObjectId(),
            lines: ['mock', 'lines', 'two'],
            rev: 4
          }
        ]
        this.DocManager.getAllNonDeletedDocs = sinon
          .stub()
          .callsArgWith(2, null, this.docs)
        return this.HttpController.getAllDocs(this.req, this.res, this.next)
      })

      it('should get all the (non-deleted) docs', function() {
        return this.DocManager.getAllNonDeletedDocs
          .calledWith(this.project_id, { lines: true, rev: true })
          .should.equal(true)
      })

      return it('should return the doc as JSON', function() {
        return this.res.json
          .calledWith([
            {
              _id: this.docs[0]._id.toString(),
              lines: this.docs[0].lines,
              rev: this.docs[0].rev
            },
            {
              _id: this.docs[1]._id.toString(),
              lines: this.docs[1].lines,
              rev: this.docs[1].rev
            }
          ])
          .should.equal(true)
      })
    })

    return describe('with a null doc', function() {
      beforeEach(function() {
        this.req.params = { project_id: this.project_id }
        this.docs = [
          {
            _id: ObjectId(),
            lines: ['mock', 'lines', 'one'],
            rev: 2
          },
          null,
          {
            _id: ObjectId(),
            lines: ['mock', 'lines', 'two'],
            rev: 4
          }
        ]
        this.DocManager.getAllNonDeletedDocs = sinon
          .stub()
          .callsArgWith(2, null, this.docs)
        return this.HttpController.getAllDocs(this.req, this.res, this.next)
      })

      it('should return the non null docs as JSON', function() {
        return this.res.json
          .calledWith([
            {
              _id: this.docs[0]._id.toString(),
              lines: this.docs[0].lines,
              rev: this.docs[0].rev
            },
            {
              _id: this.docs[2]._id.toString(),
              lines: this.docs[2].lines,
              rev: this.docs[2].rev
            }
          ])
          .should.equal(true)
      })

      return it('should log out an error', function() {
        return this.logger.error
          .calledWith(
            {
              err: sinon.match.has('message', 'null doc'),
              project_id: this.project_id
            },
            'encountered null doc'
          )
          .should.equal(true)
      })
    })
  })

  describe('getAllRanges', function() {
    return describe('normally', function() {
      beforeEach(function() {
        this.req.params = { project_id: this.project_id }
        this.docs = [
          {
            _id: ObjectId(),
            ranges: { mock_ranges: 'one' }
          },
          {
            _id: ObjectId(),
            ranges: { mock_ranges: 'two' }
          }
        ]
        this.DocManager.getAllNonDeletedDocs = sinon
          .stub()
          .callsArgWith(2, null, this.docs)
        return this.HttpController.getAllRanges(this.req, this.res, this.next)
      })

      it('should get all the (non-deleted) doc ranges', function() {
        return this.DocManager.getAllNonDeletedDocs
          .calledWith(this.project_id, { ranges: true })
          .should.equal(true)
      })

      return it('should return the doc as JSON', function() {
        return this.res.json
          .calledWith([
            {
              _id: this.docs[0]._id.toString(),
              ranges: this.docs[0].ranges
            },
            {
              _id: this.docs[1]._id.toString(),
              ranges: this.docs[1].ranges
            }
          ])
          .should.equal(true)
      })
    })
  })

  describe('updateDoc', function() {
    beforeEach(function() {
      return (this.req.params = {
        project_id: this.project_id,
        doc_id: this.doc_id
      })
    })

    describe('when the doc lines exist and were updated', function() {
      beforeEach(function() {
        this.req.body = {
          lines: (this.lines = ['hello', 'world']),
          version: (this.version = 42),
          ranges: (this.ranges = { changes: 'mock' })
        }
        this.DocManager.updateDoc = sinon
          .stub()
          .yields(null, true, (this.rev = 5))
        return this.HttpController.updateDoc(this.req, this.res, this.next)
      })

      it('should update the document', function() {
        return this.DocManager.updateDoc
          .calledWith(
            this.project_id,
            this.doc_id,
            this.lines,
            this.version,
            this.ranges
          )
          .should.equal(true)
      })

      return it('should return a modified status', function() {
        return this.res.json
          .calledWith({ modified: true, rev: this.rev })
          .should.equal(true)
      })
    })

    describe('when the doc lines exist and were not updated', function() {
      beforeEach(function() {
        this.req.body = {
          lines: (this.lines = ['hello', 'world']),
          version: (this.version = 42),
          ranges: {}
        }
        this.DocManager.updateDoc = sinon
          .stub()
          .yields(null, false, (this.rev = 5))
        return this.HttpController.updateDoc(this.req, this.res, this.next)
      })

      return it('should return a modified status', function() {
        return this.res.json
          .calledWith({ modified: false, rev: this.rev })
          .should.equal(true)
      })
    })

    describe('when the doc lines are not provided', function() {
      beforeEach(function() {
        this.req.body = { version: 42, ranges: {} }
        this.DocManager.updateDoc = sinon.stub().yields(null, false)
        return this.HttpController.updateDoc(this.req, this.res, this.next)
      })

      it('should not update the document', function() {
        return this.DocManager.updateDoc.called.should.equal(false)
      })

      return it('should return a 400 (bad request) response', function() {
        return this.res.send.calledWith(400).should.equal(true)
      })
    })

    describe('when the doc version are not provided', function() {
      beforeEach(function() {
        this.req.body = { version: 42, lines: ['hello world'] }
        this.DocManager.updateDoc = sinon.stub().yields(null, false)
        return this.HttpController.updateDoc(this.req, this.res, this.next)
      })

      it('should not update the document', function() {
        return this.DocManager.updateDoc.called.should.equal(false)
      })

      return it('should return a 400 (bad request) response', function() {
        return this.res.send.calledWith(400).should.equal(true)
      })
    })

    describe('when the doc ranges is not provided', function() {
      beforeEach(function() {
        this.req.body = { lines: ['foo'], version: 42 }
        this.DocManager.updateDoc = sinon.stub().yields(null, false)
        return this.HttpController.updateDoc(this.req, this.res, this.next)
      })

      it('should not update the document', function() {
        return this.DocManager.updateDoc.called.should.equal(false)
      })

      return it('should return a 400 (bad request) response', function() {
        return this.res.send.calledWith(400).should.equal(true)
      })
    })

    return describe('when the doc body is too large', function() {
      beforeEach(function() {
        this.req.body = {
          lines: (this.lines = Array(2049).fill('a'.repeat(1024))),
          version: (this.version = 42),
          ranges: (this.ranges = { changes: 'mock' })
        }
        return this.HttpController.updateDoc(this.req, this.res, this.next)
      })

      it('should return a 413 (too large) response', function() {
        return sinon.assert.calledWith(this.res.status, 413)
      })

      return it('should report that the document body is too large', function() {
        return sinon.assert.calledWith(this.res.send, 'document body too large')
      })
    })
  })

  describe('deleteDoc', function() {
    beforeEach(function() {
      this.req.params = {
        project_id: this.project_id,
        doc_id: this.doc_id
      }
      this.DocManager.deleteDoc = sinon.stub().callsArg(2)
      return this.HttpController.deleteDoc(this.req, this.res, this.next)
    })

    it('should delete the document', function() {
      return this.DocManager.deleteDoc
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    return it('should return a 204 (No Content)', function() {
      return this.res.send.calledWith(204).should.equal(true)
    })
  })

  describe('archiveAllDocs', function() {
    beforeEach(function() {
      this.req.params = { project_id: this.project_id }
      this.DocArchiveManager.archiveAllDocs = sinon.stub().callsArg(1)
      return this.HttpController.archiveAllDocs(this.req, this.res, this.next)
    })

    it('should archive the project', function() {
      return this.DocArchiveManager.archiveAllDocs
        .calledWith(this.project_id)
        .should.equal(true)
    })

    return it('should return a 204 (No Content)', function() {
      return this.res.send.calledWith(204).should.equal(true)
    })
  })

  return describe('destroyAllDocs', function() {
    beforeEach(function() {
      this.req.params = { project_id: this.project_id }
      this.DocArchiveManager.destroyAllDocs = sinon.stub().callsArg(1)
      return this.HttpController.destroyAllDocs(this.req, this.res, this.next)
    })

    it('should destroy the docs', function() {
      return sinon.assert.calledWith(
        this.DocArchiveManager.destroyAllDocs,
        this.project_id
      )
    })

    return it('should return 204', function() {
      return sinon.assert.calledWith(this.res.send, 204)
    })
  })
})
