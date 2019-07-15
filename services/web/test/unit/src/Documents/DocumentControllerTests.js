/* eslint-disable
    max-len,
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
const modulePath =
  '../../../../app/src/Features/Documents/DocumentController.js'
const SandboxedModule = require('sandboxed-module')
const events = require('events')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('DocumentController', function() {
  beforeEach(function() {
    this.DocumentController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        },
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        '../Project/ProjectLocator': (this.ProjectLocator = {}),
        '../Project/ProjectEntityHandler': (this.ProjectEntityHandler = {}),
        '../Project/ProjectEntityUpdateHandler': (this.ProjectEntityUpdateHandler = {})
      }
    })
    this.res = new MockResponse()
    this.req = new MockRequest()
    this.next = sinon.stub()
    this.project_id = 'project-id-123'
    this.doc_id = 'doc-id-123'
    this.doc_lines = ['one', 'two', 'three']
    this.version = 42
    this.ranges = { mock: 'ranges' }
    this.pathname = '/a/b/c/file.tex'
    this.lastUpdatedAt = new Date().getTime()
    this.lastUpdatedBy = 'fake-last-updater-id'
    return (this.rev = 5)
  })

  describe('getDocument', function() {
    beforeEach(function() {
      return (this.req.params = {
        Project_id: this.project_id,
        doc_id: this.doc_id
      })
    })

    describe('when the project exists without project history enabled', function() {
      beforeEach(function() {
        this.project = { _id: this.project_id }
        return (this.ProjectGetter.getProject = sinon
          .stub()
          .callsArgWith(2, null, this.project))
      })

      describe('when the document exists', function() {
        beforeEach(function() {
          this.doc = { _id: this.doc_id }
          this.ProjectLocator.findElement = sinon
            .stub()
            .callsArgWith(1, null, this.doc, { fileSystem: this.pathname })
          this.ProjectEntityHandler.getDoc = sinon
            .stub()
            .callsArgWith(
              2,
              null,
              this.doc_lines,
              this.rev,
              this.version,
              this.ranges
            )
          return this.DocumentController.getDocument(
            this.req,
            this.res,
            this.next
          )
        })

        it('should get the project', function() {
          return this.ProjectGetter.getProject
            .calledWith(this.project_id, { rootFolder: true, overleaf: true })
            .should.equal(true)
        })

        it('should get the pathname of the document', function() {
          return this.ProjectLocator.findElement
            .calledWith({
              project: this.project,
              element_id: this.doc_id,
              type: 'doc'
            })
            .should.equal(true)
        })

        it('should get the document content', function() {
          return this.ProjectEntityHandler.getDoc
            .calledWith(this.project_id, this.doc_id)
            .should.equal(true)
        })

        it('should return the document data to the client as JSON', function() {
          this.res.type.should.equal('application/json')
          return this.res.body.should.equal(
            JSON.stringify({
              lines: this.doc_lines,
              version: this.version,
              ranges: this.ranges,
              pathname: this.pathname
            })
          )
        })
      })

      describe("when the document doesn't exist", function() {
        beforeEach(function() {
          this.ProjectLocator.findElement = sinon
            .stub()
            .callsArgWith(1, new Errors.NotFoundError('not found'))
          return this.DocumentController.getDocument(
            this.req,
            this.res,
            this.next
          )
        })

        it('should call next with the NotFoundError', function() {
          return this.next
            .calledWith(new Errors.NotFoundError('not found'))
            .should.equal(true)
        })
      })
    })

    describe('when project exists with project history enabled', function() {
      beforeEach(function() {
        this.doc = { _id: this.doc_id }
        this.projectHistoryId = 1234
        this.project = {
          _id: this.project_id,
          overleaf: { history: { id: this.projectHistoryId } }
        }
        this.ProjectGetter.getProject = sinon
          .stub()
          .callsArgWith(2, null, this.project)
        this.ProjectLocator.findElement = sinon
          .stub()
          .callsArgWith(1, null, this.doc, { fileSystem: this.pathname })
        this.ProjectEntityHandler.getDoc = sinon
          .stub()
          .callsArgWith(
            2,
            null,
            this.doc_lines,
            this.rev,
            this.version,
            this.ranges
          )
        return this.DocumentController.getDocument(
          this.req,
          this.res,
          this.next
        )
      })

      it('should return the history id to the client as JSON', function() {
        this.res.type.should.equal('application/json')
        return this.res.body.should.equal(
          JSON.stringify({
            lines: this.doc_lines,
            version: this.version,
            ranges: this.ranges,
            pathname: this.pathname,
            projectHistoryId: this.projectHistoryId
          })
        )
      })
    })

    describe('when the project does not exist', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, null)
        return this.DocumentController.getDocument(
          this.req,
          this.res,
          this.next
        )
      })

      it('returns a 404', function() {
        return this.res.statusCode.should.equal(404)
      })
    })
  })

  describe('setDocument', function() {
    beforeEach(function() {
      return (this.req.params = {
        Project_id: this.project_id,
        doc_id: this.doc_id
      })
    })

    describe('when the document exists', function() {
      beforeEach(function() {
        this.ProjectEntityUpdateHandler.updateDocLines = sinon.stub().yields()
        this.req.body = {
          lines: this.doc_lines,
          version: this.version,
          ranges: this.ranges,
          lastUpdatedAt: this.lastUpdatedAt,
          lastUpdatedBy: this.lastUpdatedBy
        }
        return this.DocumentController.setDocument(
          this.req,
          this.res,
          this.next
        )
      })

      it('should update the document in Mongo', function() {
        return sinon.assert.calledWith(
          this.ProjectEntityUpdateHandler.updateDocLines,
          this.project_id,
          this.doc_id,
          this.doc_lines,
          this.version,
          this.ranges,
          this.lastUpdatedAt,
          this.lastUpdatedBy
        )
      })

      it('should return a successful response', function() {
        return this.res.success.should.equal(true)
      })
    })

    describe("when the document doesn't exist", function() {
      beforeEach(function() {
        this.ProjectEntityUpdateHandler.updateDocLines = sinon
          .stub()
          .yields(new Errors.NotFoundError('document does not exist'))
        this.req.body = { lines: this.doc_lines }
        return this.DocumentController.setDocument(
          this.req,
          this.res,
          this.next
        )
      })

      it('should call next with the NotFoundError', function() {
        return this.next
          .calledWith(new Errors.NotFoundError('not found'))
          .should.equal(true)
      })
    })
  })
})
