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
const { assert } = require('chai')
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath =
  '../../../../app/src/Features/FileStore/FileStoreController.js'
const SandboxedModule = require('sandboxed-module')

describe('FileStoreController', function() {
  beforeEach(function() {
    this.FileStoreHandler = { getFileStream: sinon.stub() }
    this.ProjectLocator = { findElement: sinon.stub() }
    this.controller = SandboxedModule.require(modulePath, {
      requires: {
        'settings-sharelatex': this.settings,
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          err: sinon.stub()
        }),
        '../Project/ProjectLocator': this.ProjectLocator,
        './FileStoreHandler': this.FileStoreHandler
      }
    })
    this.stream = {}
    this.project_id = '2k3j1lk3j21lk3j'
    this.file_id = '12321kklj1lk3jk12'
    this.req = {
      params: {
        Project_id: this.project_id,
        File_id: this.file_id
      },
      query: 'query string here',
      get(key) {
        return undefined
      }
    }
    this.res = {
      setHeader: sinon.stub(),
      setContentDisposition: sinon.stub()
    }
    return (this.file = { name: 'myfile.png' })
  })

  return describe('getFile', function() {
    beforeEach(function() {
      this.FileStoreHandler.getFileStream.callsArgWith(3, null, this.stream)
      return this.ProjectLocator.findElement.callsArgWith(1, null, this.file)
    })

    it('should call the file store handler with the project_id file_id and any query string', function(done) {
      this.stream.pipe = des => {
        this.FileStoreHandler.getFileStream
          .calledWith(
            this.req.params.Project_id,
            this.req.params.File_id,
            this.req.query
          )
          .should.equal(true)
        return done()
      }
      return this.controller.getFile(this.req, this.res)
    })

    it('should pipe to res', function(done) {
      this.stream.pipe = des => {
        des.should.equal(this.res)
        return done()
      }
      return this.controller.getFile(this.req, this.res)
    })

    it('should get the file from the db', function(done) {
      this.stream.pipe = des => {
        const opts = {
          project_id: this.project_id,
          element_id: this.file_id,
          type: 'file'
        }
        this.ProjectLocator.findElement.calledWith(opts).should.equal(true)
        return done()
      }
      return this.controller.getFile(this.req, this.res)
    })

    it('should set the Content-Disposition header', function(done) {
      this.stream.pipe = des => {
        this.res.setContentDisposition
          .calledWith('attachment', { filename: this.file.name })
          .should.equal(true)
        return done()
      }
      return this.controller.getFile(this.req, this.res)
    })

    // Test behaviour around handling html files
    ;['.html', '.htm', '.xhtml'].forEach(extension =>
      describe(`with a '${extension}' file extension`, function() {
        beforeEach(function() {
          this.file.name = `bad${extension}`
          return (this.req.get = key => {
            if (key === 'User-Agent') {
              return 'A generic browser'
            }
          })
        })

        describe('from a non-ios browser', () =>
          it('should not set Content-Type', function(done) {
            this.stream.pipe = des => {
              this.res.setHeader
                .calledWith('Content-Type', 'text/plain')
                .should.equal(false)
              return done()
            }
            return this.controller.getFile(this.req, this.res)
          }))

        describe('from an iPhone', function() {
          beforeEach(function() {
            return (this.req.get = key => {
              if (key === 'User-Agent') {
                return 'An iPhone browser'
              }
            })
          })

          return it("should set Content-Type to 'text/plain'", function(done) {
            this.stream.pipe = des => {
              this.res.setHeader
                .calledWith('Content-Type', 'text/plain')
                .should.equal(true)
              return done()
            }
            return this.controller.getFile(this.req, this.res)
          })
        })

        return describe('from an iPad', function() {
          beforeEach(function() {
            return (this.req.get = key => {
              if (key === 'User-Agent') {
                return 'An iPad browser'
              }
            })
          })

          return it("should set Content-Type to 'text/plain'", function(done) {
            this.stream.pipe = des => {
              this.res.setHeader
                .calledWith('Content-Type', 'text/plain')
                .should.equal(true)
              return done()
            }
            return this.controller.getFile(this.req, this.res)
          })
        })
      })
    )

    // None of these should trigger the iOS/html logic
    return [
      'x.html-is-rad',
      'html.pdf',
      '.html-is-good-for-hidden-files',
      'somefile'
    ].forEach(filename =>
      describe(`with filename as '${filename}'`, function() {
        beforeEach(function() {
          this.user_agent = 'A generic browser'
          this.file.name = filename
          return (this.req.get = key => {
            if (key === 'User-Agent') {
              return this.user_agent
            }
          })
        })

        return ['iPhone', 'iPad', 'Firefox', 'Chrome'].forEach(browser =>
          describe(`downloaded from ${browser}`, function() {
            beforeEach(function() {
              return (this.user_agent = `Some ${browser} thing`)
            })

            return it('Should not set the Content-type', function(done) {
              this.stream.pipe = des => {
                this.res.setHeader
                  .calledWith('Content-Type', 'text/plain')
                  .should.equal(false)
                return done()
              }
              return this.controller.getFile(this.req, this.res)
            })
          })
        )
      })
    )
  })
})
