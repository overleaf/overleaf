/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Project/ProjectRootDocManager.js'
const SandboxedModule = require('sandboxed-module')

describe('ProjectRootDocManager', function() {
  beforeEach(function() {
    this.project_id = 'project-123'
    this.docPaths = {
      'doc-id-1': '/chapter1.tex',
      'doc-id-2': '/main.tex',
      'doc-id-3': '/nested/chapter1a.tex',
      'doc-id-4': '/nested/chapter1b.tex'
    }
    this.sl_req_id = 'sl-req-id-123'
    this.callback = sinon.stub()
    this.globbyFiles = ['a.tex', 'b.tex', 'main.tex']
    this.globby = sinon.stub().returns(
      new Promise(resolve => {
        return resolve(this.globbyFiles)
      })
    )
    this.fs = {
      readFile: sinon.stub().callsArgWith(2, new Error('file not found')),
      stat: sinon.stub().callsArgWith(1, null, { size: 100 })
    }
    return (this.ProjectRootDocManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './ProjectEntityHandler': (this.ProjectEntityHandler = {}),
        './ProjectEntityUpdateHandler': (this.ProjectEntityUpdateHandler = {}),
        './ProjectGetter': (this.ProjectGetter = {}),
        globby: this.globby,
        fs: this.fs
      }
    }))
  })

  describe('setRootDocAutomatically', function() {
    describe('when there is a suitable root doc', function() {
      beforeEach(function(done) {
        this.docs = {
          '/chapter1.tex': {
            _id: 'doc-id-1',
            lines: [
              'something else',
              '\\begin{document}',
              'Hello world',
              '\\end{document}'
            ]
          },
          '/main.tex': {
            _id: 'doc-id-2',
            lines: [
              'different line',
              '\\documentclass{article}',
              '\\input{chapter1}'
            ]
          },
          '/nested/chapter1a.tex': {
            _id: 'doc-id-3',
            lines: ['Hello world']
          },
          '/nested/chapter1b.tex': {
            _id: 'doc-id-4',
            lines: ['Hello world']
          }
        }

        this.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        return this.ProjectRootDocManager.setRootDocAutomatically(
          this.project_id,
          done
        )
      })

      it('should check the docs of the project', function() {
        return this.ProjectEntityHandler.getAllDocs
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should set the root doc to the doc containing a documentclass', function() {
        return this.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(this.project_id, 'doc-id-2')
          .should.equal(true)
      })
    })

    describe('when the root doc is an Rtex file', function() {
      beforeEach(function() {
        this.docs = {
          '/chapter1.tex': {
            _id: 'doc-id-1',
            lines: ['\\begin{document}', 'Hello world', '\\end{document}']
          },
          '/main.Rtex': {
            _id: 'doc-id-2',
            lines: ['\\documentclass{article}', '\\input{chapter1}']
          }
        }
        this.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        return this.ProjectRootDocManager.setRootDocAutomatically(
          this.project_id,
          this.callback
        )
      })

      it('should set the root doc to the doc containing a documentclass', function() {
        return this.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(this.project_id, 'doc-id-2')
          .should.equal(true)
      })
    })

    describe('when there is no suitable root doc', function() {
      beforeEach(function(done) {
        this.docs = {
          '/chapter1.tex': {
            _id: 'doc-id-1',
            lines: ['\\begin{document}', 'Hello world', '\\end{document}']
          },
          '/style.bst': {
            _id: 'doc-id-2',
            lines: ['%Example: \\documentclass{article}']
          }
        }
        this.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        return this.ProjectRootDocManager.setRootDocAutomatically(
          this.project_id,
          done
        )
      })

      it('should not set the root doc to the doc containing a documentclass', function() {
        return this.ProjectEntityUpdateHandler.setRootDoc.called.should.equal(
          false
        )
      })
    })
  })

  describe('findRootDocFileFromDirectory', function() {
    beforeEach(function() {
      this.fs.readFile
        .withArgs('/foo/a.tex')
        .callsArgWith(2, null, 'Hello World!')
      this.fs.readFile
        .withArgs('/foo/b.tex')
        .callsArgWith(2, null, "I'm a little teapot, get me out of here.")
      this.fs.readFile
        .withArgs('/foo/main.tex')
        .callsArgWith(2, null, "Help, I'm trapped in a unit testing factory")
      this.fs.readFile
        .withArgs('/foo/c.tex')
        .callsArgWith(2, null, 'Tomato, tomahto.')
      this.fs.readFile
        .withArgs('/foo/a/a.tex')
        .callsArgWith(2, null, 'Potato? Potahto. Potootee!')
      return (this.documentclassContent = '% test\n\\documentclass\n% test')
    })

    describe('when there is a file in a subfolder', function() {
      beforeEach(function() {
        // have to splice globbyFiles weirdly because of the way the stubbed globby method handles references
        return this.globbyFiles.splice(
          0,
          this.globbyFiles.length,
          'c.tex',
          'a.tex',
          'a/a.tex',
          'b.tex'
        )
      })

      it('processes the root folder files first, and then the subfolder, in alphabetical order', function(done) {
        return this.ProjectRootDocManager.findRootDocFileFromDirectory(
          '/foo',
          (error, path) => {
            expect(error).not.to.exist
            expect(path).not.to.exist
            sinon.assert.callOrder(
              this.fs.readFile.withArgs('/foo/a.tex'),
              this.fs.readFile.withArgs('/foo/b.tex'),
              this.fs.readFile.withArgs('/foo/c.tex'),
              this.fs.readFile.withArgs('/foo/a/a.tex')
            )
            return done()
          }
        )
      })

      it('processes smaller files first', function(done) {
        this.fs.stat.withArgs('/foo/c.tex').callsArgWith(1, null, { size: 1 })
        return this.ProjectRootDocManager.findRootDocFileFromDirectory(
          '/foo',
          (error, path) => {
            expect(error).not.to.exist
            expect(path).not.to.exist
            sinon.assert.callOrder(
              this.fs.readFile.withArgs('/foo/c.tex'),
              this.fs.readFile.withArgs('/foo/a.tex'),
              this.fs.readFile.withArgs('/foo/b.tex'),
              this.fs.readFile.withArgs('/foo/a/a.tex')
            )
            return done()
          }
        )
      })
    })

    describe('when main.tex contains a documentclass', function() {
      beforeEach(function() {
        return this.fs.readFile
          .withArgs('/foo/main.tex')
          .callsArgWith(2, null, this.documentclassContent)
      })

      it('returns main.tex', function(done) {
        return this.ProjectRootDocManager.findRootDocFileFromDirectory(
          '/foo',
          (error, path, content) => {
            expect(error).not.to.exist
            expect(path).to.equal('main.tex')
            expect(content).to.equal(this.documentclassContent)
            return done()
          }
        )
      })

      it('processes main.text first and stops processing when it finds the content', function(done) {
        return this.ProjectRootDocManager.findRootDocFileFromDirectory(
          '/foo',
          () => {
            expect(this.fs.readFile).to.be.calledWith('/foo/main.tex')
            expect(this.fs.readFile).not.to.be.calledWith('/foo/a.tex')
            return done()
          }
        )
      })
    })

    describe('when a.tex contains a documentclass', function() {
      beforeEach(function() {
        return this.fs.readFile
          .withArgs('/foo/a.tex')
          .callsArgWith(2, null, this.documentclassContent)
      })

      it('returns a.tex', function(done) {
        return this.ProjectRootDocManager.findRootDocFileFromDirectory(
          '/foo',
          (error, path, content) => {
            expect(error).not.to.exist
            expect(path).to.equal('a.tex')
            expect(content).to.equal(this.documentclassContent)
            return done()
          }
        )
      })

      it('processes main.text first and stops processing when it finds the content', function(done) {
        return this.ProjectRootDocManager.findRootDocFileFromDirectory(
          '/foo',
          () => {
            expect(this.fs.readFile).to.be.calledWith('/foo/main.tex')
            expect(this.fs.readFile).to.be.calledWith('/foo/a.tex')
            expect(this.fs.readFile).not.to.be.calledWith('/foo/b.tex')
            return done()
          }
        )
      })
    })

    describe('when there is no documentclass', function() {
      it('returns null with no error', function(done) {
        return this.ProjectRootDocManager.findRootDocFileFromDirectory(
          '/foo',
          (error, path, content) => {
            expect(error).not.to.exist
            expect(path).not.to.exist
            expect(content).not.to.exist
            return done()
          }
        )
      })

      it('processes all the files', function(done) {
        return this.ProjectRootDocManager.findRootDocFileFromDirectory(
          '/foo',
          () => {
            expect(this.fs.readFile).to.be.calledWith('/foo/main.tex')
            expect(this.fs.readFile).to.be.calledWith('/foo/a.tex')
            expect(this.fs.readFile).to.be.calledWith('/foo/b.tex')
            return done()
          }
        )
      })
    })

    describe('when there is an error reading a file', function() {
      beforeEach(function() {
        return this.fs.readFile
          .withArgs('/foo/a.tex')
          .callsArgWith(2, new Error('something went wrong'))
      })

      it('returns an error', function(done) {
        return this.ProjectRootDocManager.findRootDocFileFromDirectory(
          '/foo',
          (error, path, content) => {
            expect(error).to.exist
            expect(path).not.to.exist
            expect(content).not.to.exist
            return done()
          }
        )
      })
    })
  })

  describe('setRootDocFromName', function() {
    describe('when there is a suitable root doc', function() {
      beforeEach(function(done) {
        this.docPaths = {
          'doc-id-1': '/chapter1.tex',
          'doc-id-2': '/main.tex',
          'doc-id-3': '/nested/chapter1a.tex',
          'doc-id-4': '/nested/chapter1b.tex'
        }
        this.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, this.docPaths)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        return this.ProjectRootDocManager.setRootDocFromName(
          this.project_id,
          '/main.tex',
          done
        )
      })

      it('should check the docs of the project', function() {
        return this.ProjectEntityHandler.getAllDocPathsFromProjectById
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should set the root doc to main.tex', function() {
        return this.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(this.project_id, 'doc-id-2')
          .should.equal(true)
      })
    })

    describe('when there is a suitable root doc but the leading slash is missing', function() {
      beforeEach(function(done) {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, this.docPaths)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        return this.ProjectRootDocManager.setRootDocFromName(
          this.project_id,
          'main.tex',
          done
        )
      })

      it('should check the docs of the project', function() {
        return this.ProjectEntityHandler.getAllDocPathsFromProjectById
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should set the root doc to main.tex', function() {
        return this.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(this.project_id, 'doc-id-2')
          .should.equal(true)
      })
    })

    describe('when there is a suitable root doc with a basename match', function() {
      beforeEach(function(done) {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, this.docPaths)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        return this.ProjectRootDocManager.setRootDocFromName(
          this.project_id,
          'chapter1a.tex',
          done
        )
      })

      it('should check the docs of the project', function() {
        return this.ProjectEntityHandler.getAllDocPathsFromProjectById
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should set the root doc using the basename', function() {
        return this.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(this.project_id, 'doc-id-3')
          .should.equal(true)
      })
    })

    describe('when there is a suitable root doc but the filename is in quotes', function() {
      beforeEach(function(done) {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, this.docPaths)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        return this.ProjectRootDocManager.setRootDocFromName(
          this.project_id,
          "'main.tex'",
          done
        )
      })

      it('should check the docs of the project', function() {
        return this.ProjectEntityHandler.getAllDocPathsFromProjectById
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should set the root doc to main.tex', function() {
        return this.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(this.project_id, 'doc-id-2')
          .should.equal(true)
      })
    })

    describe('when there is no suitable root doc', function() {
      beforeEach(function(done) {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, this.docPaths)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        return this.ProjectRootDocManager.setRootDocFromName(
          this.project_id,
          'other.tex',
          done
        )
      })

      it('should not set the root doc', function() {
        return this.ProjectEntityUpdateHandler.setRootDoc.called.should.equal(
          false
        )
      })
    })
  })

  describe('ensureRootDocumentIsSet', function() {
    beforeEach(function() {
      this.project = {}
      this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, this.project)
      return (this.ProjectRootDocManager.setRootDocAutomatically = sinon
        .stub()
        .callsArgWith(1, null))
    })

    describe('when the root doc is set', function() {
      beforeEach(function() {
        this.project.rootDoc_id = 'root-doc-id'
        return this.ProjectRootDocManager.ensureRootDocumentIsSet(
          this.project_id,
          this.callback
        )
      })

      it('should find the project fetching only the rootDoc_id field', function() {
        return this.ProjectGetter.getProject
          .calledWith(this.project_id, { rootDoc_id: 1 })
          .should.equal(true)
      })

      it('should not try to update the project rootDoc_id', function() {
        return this.ProjectRootDocManager.setRootDocAutomatically.called.should.equal(
          false
        )
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when the root doc is not set', function() {
      beforeEach(function() {
        return this.ProjectRootDocManager.ensureRootDocumentIsSet(
          this.project_id,
          this.callback
        )
      })

      it('should find the project with only the rootDoc_id field', function() {
        return this.ProjectGetter.getProject
          .calledWith(this.project_id, { rootDoc_id: 1 })
          .should.equal(true)
      })

      it('should update the project rootDoc_id', function() {
        return this.ProjectRootDocManager.setRootDocAutomatically
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when the project does not exist', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, null)
        return this.ProjectRootDocManager.ensureRootDocumentIsSet(
          this.project_id,
          this.callback
        )
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWith(new Error('project not found'))
          .should.equal(true)
      })
    })
  })

  describe('ensureRootDocumentIsValid', function() {
    beforeEach(function() {
      this.project = {}
      this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, this.project)
      this.ProjectEntityUpdateHandler.setRootDoc = sinon.stub().yields()
      this.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
        .stub()
        .callsArgWith(1, null, this.docPaths)
      return (this.ProjectRootDocManager.setRootDocAutomatically = sinon
        .stub()
        .callsArgWith(1, null))
    })

    describe('when the root doc is set', function() {
      describe('when the root doc is valid', function() {
        beforeEach(function() {
          this.project.rootDoc_id = 'doc-id-2'
          return this.ProjectRootDocManager.ensureRootDocumentIsValid(
            this.project_id,
            this.callback
          )
        })

        it('should find the project fetching only the rootDoc_id field', function() {
          return this.ProjectGetter.getProject
            .calledWith(this.project_id, { rootDoc_id: 1 })
            .should.equal(true)
        })

        it('should not try to update the project rootDoc_id', function() {
          return this.ProjectRootDocManager.setRootDocAutomatically.called.should.equal(
            false
          )
        })

        it('should call the callback', function() {
          return this.callback.called.should.equal(true)
        })
      })

      describe('when the root doc is not valid', function() {
        beforeEach(function() {
          this.project.rootDoc_id = 'bogus-doc-id'
          return this.ProjectRootDocManager.ensureRootDocumentIsValid(
            this.project_id,
            this.callback
          )
        })

        it('should find the project fetching only the rootDoc_id field', function() {
          return this.ProjectGetter.getProject
            .calledWith(this.project_id, { rootDoc_id: 1 })
            .should.equal(true)
        })

        it('should null the rootDoc_id field', function() {
          return this.ProjectEntityUpdateHandler.setRootDoc
            .calledWith(this.project_id, null)
            .should.equal(true)
        })

        it('should try to find a new rootDoc', function() {
          return this.ProjectRootDocManager.setRootDocAutomatically.called.should.equal(
            true
          )
        })

        it('should call the callback', function() {
          return this.callback.called.should.equal(true)
        })
      })
    })

    describe('when the root doc is not set', function() {
      beforeEach(function() {
        return this.ProjectRootDocManager.ensureRootDocumentIsSet(
          this.project_id,
          this.callback
        )
      })

      it('should find the project fetching only the rootDoc_id fiel', function() {
        return this.ProjectGetter.getProject
          .calledWith(this.project_id, { rootDoc_id: 1 })
          .should.equal(true)
      })

      it('should update the project rootDoc_id', function() {
        return this.ProjectRootDocManager.setRootDocAutomatically
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when the project does not exist', function() {
      beforeEach(function() {
        this.ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, null)
        return this.ProjectRootDocManager.ensureRootDocumentIsSet(
          this.project_id,
          this.callback
        )
      })

      it('should call the callback with an error', function() {
        return this.callback
          .calledWith(new Error('project not found'))
          .should.equal(true)
      })
    })
  })
})
