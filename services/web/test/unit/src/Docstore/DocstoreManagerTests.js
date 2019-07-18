/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
chai.should()
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Docstore/DocstoreManager'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors.js')

describe('DocstoreManager', function() {
  beforeEach(function() {
    this.requestDefaults = sinon.stub().returns((this.request = sinon.stub()))
    this.DocstoreManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        request: {
          defaults: this.requestDefaults
        },
        'settings-sharelatex': (this.settings = {
          apis: {
            docstore: {
              url: 'docstore.sharelatex.com'
            }
          }
        }),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          warn: sinon.stub(),
          error: sinon.stub(),
          err() {}
        })
      }
    })

    this.requestDefaults.calledWith({ jar: false }).should.equal(true)

    this.project_id = 'project-id-123'
    this.doc_id = 'doc-id-123'
    return (this.callback = sinon.stub())
  })

  describe('deleteDoc', function() {
    describe('with a successful response code', function() {
      beforeEach(function() {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        return this.DocstoreManager.deleteDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should delete the doc in the docstore api', function() {
        return this.request.del
          .calledWith(
            `${this.settings.apis.docstore.url}/project/${
              this.project_id
            }/doc/${this.doc_id}`
          )
          .should.equal(true)
      })

      it('should call the callback without an error', function() {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('with a failed response code', function() {
      beforeEach(function() {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.DocstoreManager.deleteDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWith(
            new Error('docstore api responded with non-success code: 500')
          )
          .should.equal(true)
      })

      it('should log the error', function() {
        return this.logger.warn
          .calledWith(
            {
              err: new Error(
                'docstore api responded with a non-success code: 500'
              ),
              project_id: this.project_id,
              doc_id: this.doc_id
            },
            'error deleting doc in docstore'
          )
          .should.equal(true)
      })
    })

    describe('with a missing (404) response code', function() {
      beforeEach(function() {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 404 }, '')
        return this.DocstoreManager.deleteDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWith(
            new Errors.NotFoundError('tried to delete doc not in docstore')
          )
          .should.equal(true)
      })

      it('should log the error', function() {
        return this.logger.warn
          .calledWith(
            {
              err: new Errors.NotFoundError(
                'tried to delete doc not in docstore'
              ),
              project_id: this.project_id,
              doc_id: this.doc_id
            },
            'tried to delete doc not in docstore'
          )
          .should.equal(true)
      })
    })
  })

  describe('updateDoc', function() {
    beforeEach(function() {
      this.lines = ['mock', 'doc', 'lines']
      this.rev = 5
      this.version = 42
      this.ranges = { mock: 'ranges' }
      return (this.modified = true)
    })

    describe('with a successful response code', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(
            1,
            null,
            { statusCode: 204 },
            { modified: this.modified, rev: this.rev }
          )
        return this.DocstoreManager.updateDoc(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ranges,
          this.callback
        )
      })

      it('should update the doc in the docstore api', function() {
        return this.request.post
          .calledWith({
            url: `${this.settings.apis.docstore.url}/project/${
              this.project_id
            }/doc/${this.doc_id}`,
            json: {
              lines: this.lines,
              version: this.version,
              ranges: this.ranges
            }
          })
          .should.equal(true)
      })

      it('should call the callback with the modified status and revision', function() {
        return this.callback
          .calledWith(null, this.modified, this.rev)
          .should.equal(true)
      })
    })

    describe('with a failed response code', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.DocstoreManager.updateDoc(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ranges,
          this.callback
        )
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWith(
            new Error('docstore api responded with non-success code: 500')
          )
          .should.equal(true)
      })

      it('should log the error', function() {
        return this.logger.warn
          .calledWith(
            {
              err: new Error(
                'docstore api responded with a non-success code: 500'
              ),
              project_id: this.project_id,
              doc_id: this.doc_id
            },
            'error updating doc in docstore'
          )
          .should.equal(true)
      })
    })
  })

  describe('getDoc', function() {
    beforeEach(function() {
      return (this.doc = {
        lines: (this.lines = ['mock', 'doc', 'lines']),
        rev: (this.rev = 5),
        version: (this.version = 42),
        ranges: (this.ranges = { mock: 'ranges' })
      })
    })

    describe('with a successful response code', function() {
      beforeEach(function() {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, this.doc)
        return this.DocstoreManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should get the doc from the docstore api', function() {
        return this.request.get
          .calledWith({
            url: `${this.settings.apis.docstore.url}/project/${
              this.project_id
            }/doc/${this.doc_id}`,
            json: true
          })
          .should.equal(true)
      })

      it('should call the callback with the lines, version and rev', function() {
        return this.callback
          .calledWith(null, this.lines, this.rev, this.version, this.ranges)
          .should.equal(true)
      })
    })

    describe('with a failed response code', function() {
      beforeEach(function() {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.DocstoreManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWith(
            new Error('docstore api responded with non-success code: 500')
          )
          .should.equal(true)
      })

      it('should log the error', function() {
        return this.logger.warn
          .calledWith(
            {
              err: new Error(
                'docstore api responded with a non-success code: 500'
              ),
              project_id: this.project_id,
              doc_id: this.doc_id
            },
            'error getting doc from docstore'
          )
          .should.equal(true)
      })
    })

    describe('with include_deleted=true', function() {
      beforeEach(function() {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, this.doc)
        return this.DocstoreManager.getDoc(
          this.project_id,
          this.doc_id,
          { include_deleted: true },
          this.callback
        )
      })

      it('should get the doc from the docstore api (including deleted)', function() {
        return this.request.get
          .calledWith({
            url: `${this.settings.apis.docstore.url}/project/${
              this.project_id
            }/doc/${this.doc_id}?include_deleted=true`,
            json: true
          })
          .should.equal(true)
      })

      it('should call the callback with the lines, version and rev', function() {
        return this.callback
          .calledWith(null, this.lines, this.rev, this.version, this.ranges)
          .should.equal(true)
      })
    })

    describe('with a missing (404) response code', function() {
      beforeEach(function() {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 404 }, '')
        return this.DocstoreManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWith(new Errors.NotFoundError('doc not found in docstore'))
          .should.equal(true)
      })

      it('should log the error', function() {
        return this.logger.warn
          .calledWith(
            {
              err: new Errors.NotFoundError('doc not found in docstore'),
              project_id: this.project_id,
              doc_id: this.doc_id
            },
            'doc not found in docstore'
          )
          .should.equal(true)
      })
    })
  })

  describe('getAllDocs', function() {
    describe('with a successful response code', function() {
      beforeEach(function() {
        this.request.get = sinon
          .stub()
          .callsArgWith(
            1,
            null,
            { statusCode: 204 },
            (this.docs = [{ _id: 'mock-doc-id' }])
          )
        return this.DocstoreManager.getAllDocs(this.project_id, this.callback)
      })

      it('should get all the project docs in the docstore api', function() {
        return this.request.get
          .calledWith({
            url: `${this.settings.apis.docstore.url}/project/${
              this.project_id
            }/doc`,
            json: true
          })
          .should.equal(true)
      })

      it('should call the callback with the docs', function() {
        return this.callback.calledWith(null, this.docs).should.equal(true)
      })
    })

    describe('with a failed response code', function() {
      beforeEach(function() {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.DocstoreManager.getAllDocs(this.project_id, this.callback)
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWith(
            new Error('docstore api responded with non-success code: 500')
          )
          .should.equal(true)
      })

      it('should log the error', function() {
        return this.logger.warn
          .calledWith(
            {
              err: new Error(
                'docstore api responded with a non-success code: 500'
              ),
              project_id: this.project_id
            },
            'error getting all docs from docstore'
          )
          .should.equal(true)
      })
    })
  })

  describe('getAllRanges', function() {
    describe('with a successful response code', function() {
      beforeEach(function() {
        this.request.get = sinon
          .stub()
          .callsArgWith(
            1,
            null,
            { statusCode: 204 },
            (this.docs = [{ _id: 'mock-doc-id', ranges: 'mock-ranges' }])
          )
        return this.DocstoreManager.getAllRanges(this.project_id, this.callback)
      })

      it('should get all the project doc ranges in the docstore api', function() {
        return this.request.get
          .calledWith({
            url: `${this.settings.apis.docstore.url}/project/${
              this.project_id
            }/ranges`,
            json: true
          })
          .should.equal(true)
      })

      it('should call the callback with the docs', function() {
        return this.callback.calledWith(null, this.docs).should.equal(true)
      })
    })

    describe('with a failed response code', function() {
      beforeEach(function() {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.DocstoreManager.getAllRanges(this.project_id, this.callback)
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWith(
            new Error('docstore api responded with non-success code: 500')
          )
          .should.equal(true)
      })

      it('should log the error', function() {
        return this.logger.warn
          .calledWith(
            {
              err: new Error(
                'docstore api responded with a non-success code: 500'
              ),
              project_id: this.project_id
            },
            'error getting all doc ranges from docstore'
          )
          .should.equal(true)
      })
    })
  })

  describe('archiveProject', function() {
    describe('with a successful response code', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 })
        return this.DocstoreManager.archiveProject(
          this.project_id,
          this.callback
        )
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('with a failed response code', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 })
        return this.DocstoreManager.archiveProject(
          this.project_id,
          this.callback
        )
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWith(
            new Error('docstore api responded with non-success code: 500')
          )
          .should.equal(true)
      })
    })
  })

  describe('unarchiveProject', function() {
    describe('with a successful response code', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 })
        return this.DocstoreManager.unarchiveProject(
          this.project_id,
          this.callback
        )
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('with a failed response code', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 })
        return this.DocstoreManager.unarchiveProject(
          this.project_id,
          this.callback
        )
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWith(
            new Error('docstore api responded with non-success code: 500')
          )
          .should.equal(true)
      })
    })
  })

  describe('destroyProject', function() {
    describe('with a successful response code', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 })
        return this.DocstoreManager.destroyProject(
          this.project_id,
          this.callback
        )
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('with a failed response code', function() {
      beforeEach(function() {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 })
        return this.DocstoreManager.destroyProject(
          this.project_id,
          this.callback
        )
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWith(
            new Error('docstore api responded with non-success code: 500')
          )
          .should.equal(true)
      })
    })
  })
})
