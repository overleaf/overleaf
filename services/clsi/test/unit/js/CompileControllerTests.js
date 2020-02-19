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
const sinon = require('sinon')
require('chai').should()
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/CompileController'
)
const tk = require('timekeeper')

describe('CompileController', function() {
  beforeEach(function() {
    this.CompileController = SandboxedModule.require(modulePath, {
      requires: {
        './CompileManager': (this.CompileManager = {}),
        './RequestParser': (this.RequestParser = {}),
        'settings-sharelatex': (this.Settings = {
          apis: {
            clsi: {
              url: 'http://clsi.example.com'
            }
          }
        }),
        './ProjectPersistenceManager': (this.ProjectPersistenceManager = {}),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub(),
          err: sinon.stub(),
          warn: sinon.stub()
        })
      }
    })
    this.Settings.externalUrl = 'http://www.example.com'
    this.req = {}
    this.res = {}
    return (this.next = sinon.stub())
  })

  describe('compile', function() {
    beforeEach(function() {
      this.req.body = {
        compile: 'mock-body'
      }
      this.req.params = { project_id: (this.project_id = 'project-id-123') }
      this.request = {
        compile: 'mock-parsed-request'
      }
      this.request_with_project_id = {
        compile: this.request.compile,
        project_id: this.project_id
      }
      this.output_files = [
        {
          path: 'output.pdf',
          type: 'pdf',
          build: 1234
        },
        {
          path: 'output.log',
          type: 'log',
          build: 1234
        }
      ]
      this.RequestParser.parse = sinon
        .stub()
        .callsArgWith(1, null, this.request)
      this.ProjectPersistenceManager.markProjectAsJustAccessed = sinon
        .stub()
        .callsArg(1)
      this.res.status = sinon.stub().returnsThis()
      return (this.res.send = sinon.stub())
    })

    describe('successfully', function() {
      beforeEach(function() {
        this.CompileManager.doCompileWithLock = sinon
          .stub()
          .callsArgWith(1, null, this.output_files)
        return this.CompileController.compile(this.req, this.res)
      })

      it('should parse the request', function() {
        return this.RequestParser.parse
          .calledWith(this.req.body)
          .should.equal(true)
      })

      it('should run the compile for the specified project', function() {
        return this.CompileManager.doCompileWithLock
          .calledWith(this.request_with_project_id)
          .should.equal(true)
      })

      it('should mark the project as accessed', function() {
        return this.ProjectPersistenceManager.markProjectAsJustAccessed
          .calledWith(this.project_id)
          .should.equal(true)
      })

      return it('should return the JSON response', function() {
        this.res.status.calledWith(200).should.equal(true)
        return this.res.send
          .calledWith({
            compile: {
              status: 'success',
              error: null,
              outputFiles: this.output_files.map(file => {
                return {
                  url: `${this.Settings.apis.clsi.url}/project/${this.project_id}/build/${file.build}/output/${file.path}`,
                  path: file.path,
                  type: file.type,
                  build: file.build
                }
              })
            }
          })
          .should.equal(true)
      })
    })

    describe('with an error', function() {
      beforeEach(function() {
        this.CompileManager.doCompileWithLock = sinon
          .stub()
          .callsArgWith(1, new Error((this.message = 'error message')), null)
        return this.CompileController.compile(this.req, this.res)
      })

      return it('should return the JSON response with the error', function() {
        this.res.status.calledWith(500).should.equal(true)
        return this.res.send
          .calledWith({
            compile: {
              status: 'error',
              error: this.message,
              outputFiles: []
            }
          })
          .should.equal(true)
      })
    })

    describe('when the request times out', function() {
      beforeEach(function() {
        this.error = new Error((this.message = 'container timed out'))
        this.error.timedout = true
        this.CompileManager.doCompileWithLock = sinon
          .stub()
          .callsArgWith(1, this.error, null)
        return this.CompileController.compile(this.req, this.res)
      })

      return it('should return the JSON response with the timeout status', function() {
        this.res.status.calledWith(200).should.equal(true)
        return this.res.send
          .calledWith({
            compile: {
              status: 'timedout',
              error: this.message,
              outputFiles: []
            }
          })
          .should.equal(true)
      })
    })

    return describe('when the request returns no output files', function() {
      beforeEach(function() {
        this.CompileManager.doCompileWithLock = sinon
          .stub()
          .callsArgWith(1, null, [])
        return this.CompileController.compile(this.req, this.res)
      })

      return it('should return the JSON response with the failure status', function() {
        this.res.status.calledWith(200).should.equal(true)
        return this.res.send
          .calledWith({
            compile: {
              error: null,
              status: 'failure',
              outputFiles: []
            }
          })
          .should.equal(true)
      })
    })
  })

  describe('syncFromCode', function() {
    beforeEach(function() {
      this.file = 'main.tex'
      this.line = 42
      this.column = 5
      this.project_id = 'mock-project-id'
      this.req.params = { project_id: this.project_id }
      this.req.query = {
        file: this.file,
        line: this.line.toString(),
        column: this.column.toString()
      }
      this.res.json = sinon.stub()

      this.CompileManager.syncFromCode = sinon
        .stub()
        .callsArgWith(5, null, (this.pdfPositions = ['mock-positions']))
      return this.CompileController.syncFromCode(this.req, this.res, this.next)
    })

    it('should find the corresponding location in the PDF', function() {
      return this.CompileManager.syncFromCode
        .calledWith(
          this.project_id,
          undefined,
          this.file,
          this.line,
          this.column
        )
        .should.equal(true)
    })

    return it('should return the positions', function() {
      return this.res.json
        .calledWith({
          pdf: this.pdfPositions
        })
        .should.equal(true)
    })
  })

  describe('syncFromPdf', function() {
    beforeEach(function() {
      this.page = 5
      this.h = 100.23
      this.v = 45.67
      this.project_id = 'mock-project-id'
      this.req.params = { project_id: this.project_id }
      this.req.query = {
        page: this.page.toString(),
        h: this.h.toString(),
        v: this.v.toString()
      }
      this.res.json = sinon.stub()

      this.CompileManager.syncFromPdf = sinon
        .stub()
        .callsArgWith(5, null, (this.codePositions = ['mock-positions']))
      return this.CompileController.syncFromPdf(this.req, this.res, this.next)
    })

    it('should find the corresponding location in the code', function() {
      return this.CompileManager.syncFromPdf
        .calledWith(this.project_id, undefined, this.page, this.h, this.v)
        .should.equal(true)
    })

    return it('should return the positions', function() {
      return this.res.json
        .calledWith({
          code: this.codePositions
        })
        .should.equal(true)
    })
  })

  return describe('wordcount', function() {
    beforeEach(function() {
      this.file = 'main.tex'
      this.project_id = 'mock-project-id'
      this.req.params = { project_id: this.project_id }
      this.req.query = {
        file: this.file,
        image: (this.image = 'example.com/image')
      }
      this.res.json = sinon.stub()

      this.CompileManager.wordcount = sinon
        .stub()
        .callsArgWith(4, null, (this.texcount = ['mock-texcount']))
      return this.CompileController.wordcount(this.req, this.res, this.next)
    })

    it('should return the word count of a file', function() {
      return this.CompileManager.wordcount
        .calledWith(this.project_id, undefined, this.file, this.image)
        .should.equal(true)
    })

    return it('should return the texcount info', function() {
      return this.res.json
        .calledWith({
          texcount: this.texcount
        })
        .should.equal(true)
    })
  })
})
