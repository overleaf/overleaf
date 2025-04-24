const { expect } = require('chai')
const { ObjectId } = require('mongodb-legacy')
const sinon = require('sinon')
const modulePath =
  '../../../../app/src/Features/Project/ProjectRootDocManager.js'
const SandboxedModule = require('sandboxed-module')

describe('ProjectRootDocManager', function () {
  beforeEach(function () {
    this.project_id = 'project-123'
    this.docPaths = {}
    this.docId1 = new ObjectId()
    this.docId2 = new ObjectId()
    this.docId3 = new ObjectId()
    this.docId4 = new ObjectId()
    this.docPaths[this.docId1] = '/chapter1.tex'
    this.docPaths[this.docId2] = '/main.tex'
    this.docPaths[this.docId3] = '/nested/chapter1a.tex'
    this.docPaths[this.docId4] = '/nested/chapter1b.tex'
    this.sl_req_id = 'sl-req-id-123'
    this.callback = sinon.stub()
    this.globbyFiles = ['a.tex', 'b.tex', 'main.tex']
    this.globby = sinon.stub().resolves(this.globbyFiles)

    this.fs = {
      readFile: sinon.stub().callsArgWith(2, new Error('file not found')),
      stat: sinon.stub().callsArgWith(1, null, { size: 100 }),
    }
    this.ProjectRootDocManager = SandboxedModule.require(modulePath, {
      requires: {
        './ProjectEntityHandler': (this.ProjectEntityHandler = {}),
        './ProjectEntityUpdateHandler': (this.ProjectEntityUpdateHandler = {}),
        './ProjectGetter': (this.ProjectGetter = {}),
        '../../infrastructure/GracefulShutdown': {
          BackgroundTaskTracker: class {
            add() {}
            done() {}
          },
        },
        globby: this.globby,
        fs: this.fs,
      },
    })
  })

  describe('setRootDocAutomatically', function () {
    beforeEach(function () {
      this.ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
      this.ProjectEntityUpdateHandler.isPathValidForRootDoc = sinon
        .stub()
        .returns(true)
    })
    describe('when there is a suitable root doc', function () {
      beforeEach(async function () {
        this.docs = {
          '/chapter1.tex': {
            _id: this.docId1,
            lines: [
              'something else',
              '\\begin{document}',
              'Hello world',
              '\\end{document}',
            ],
          },
          '/main.tex': {
            _id: this.docId2,
            lines: [
              'different line',
              '\\documentclass{article}',
              '\\input{chapter1}',
            ],
          },
          '/nested/chapter1a.tex': {
            _id: this.docId3,
            lines: ['Hello world'],
          },
          '/nested/chapter1b.tex': {
            _id: this.docId4,
            lines: ['Hello world'],
          },
        }
        this.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        await this.ProjectRootDocManager.promises.setRootDocAutomatically(
          this.project_id
        )
      })

      it('should check the docs of the project', function () {
        this.ProjectEntityHandler.getAllDocs
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should set the root doc to the doc containing a documentclass', function () {
        this.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(this.project_id, this.docId2)
          .should.equal(true)
      })
    })

    describe('when the root doc is an Rtex file', function () {
      beforeEach(async function () {
        this.docs = {
          '/chapter1.tex': {
            _id: this.docId1,
            lines: ['\\begin{document}', 'Hello world', '\\end{document}'],
          },
          '/main.Rtex': {
            _id: this.docId2,
            lines: ['\\documentclass{article}', '\\input{chapter1}'],
          },
        }
        this.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        await this.ProjectRootDocManager.promises.setRootDocAutomatically(
          this.project_id
        )
      })

      it('should set the root doc to the doc containing a documentclass', function () {
        this.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(this.project_id, this.docId2)
          .should.equal(true)
      })
    })

    describe('when there is no suitable root doc', function () {
      beforeEach(async function () {
        this.docs = {
          '/chapter1.tex': {
            _id: this.docId1,
            lines: ['\\begin{document}', 'Hello world', '\\end{document}'],
          },
          '/style.bst': {
            _id: this.docId2,
            lines: ['%Example: \\documentclass{article}'],
          },
        }
        this.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, this.docs)
        await this.ProjectRootDocManager.promises.setRootDocAutomatically(
          this.project_id
        )
      })

      it('should not set the root doc to the doc containing a documentclass', function () {
        this.ProjectEntityUpdateHandler.setRootDoc.called.should.equal(false)
      })
    })
  })

  describe('findRootDocFileFromDirectory', function () {
    beforeEach(function () {
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
      this.documentclassContent = '% test\n\\documentclass\n% test'
    })

    describe('when there is a file in a subfolder', function () {
      beforeEach(function () {
        // have to splice globbyFiles weirdly because of the way the stubbed globby method handles references
        this.globbyFiles.splice(
          0,
          this.globbyFiles.length,
          'c.tex',
          'a.tex',
          'a/a.tex',
          'b.tex'
        )
      })

      it('processes the root folder files first, and then the subfolder, in alphabetical order', async function () {
        const { path } =
          await this.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        expect(path).to.equal('a.tex')
        sinon.assert.callOrder(
          this.fs.readFile.withArgs('/foo/a.tex'),
          this.fs.readFile.withArgs('/foo/b.tex'),
          this.fs.readFile.withArgs('/foo/c.tex'),
          this.fs.readFile.withArgs('/foo/a/a.tex')
        )
      })

      it('processes smaller files first', async function () {
        this.fs.stat.withArgs('/foo/c.tex').callsArgWith(1, null, { size: 1 })
        const { path } =
          await this.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        expect(path).to.equal('c.tex')
        sinon.assert.callOrder(
          this.fs.readFile.withArgs('/foo/c.tex'),
          this.fs.readFile.withArgs('/foo/a.tex'),
          this.fs.readFile.withArgs('/foo/b.tex'),
          this.fs.readFile.withArgs('/foo/a/a.tex')
        )
      })
    })

    describe('when main.tex contains a documentclass', function () {
      beforeEach(function () {
        this.fs.readFile
          .withArgs('/foo/main.tex')
          .callsArgWith(2, null, this.documentclassContent)
      })

      it('returns main.tex', async function () {
        const { path, content } =
          await this.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        expect(path).to.equal('main.tex')
        expect(content).to.equal(this.documentclassContent)
      })

      it('processes main.text first and stops processing when it finds the content', async function () {
        await this.ProjectRootDocManager.findRootDocFileFromDirectory('/foo')
        expect(this.fs.readFile).to.be.calledWith('/foo/main.tex')
        expect(this.fs.readFile).not.to.be.calledWith('/foo/a.tex')
      })
    })

    describe('when main.tex does not contain a line starting with \\documentclass', function () {
      beforeEach(function () {
        this.fs.readFile.withArgs('/foo/a.tex').callsArgWith(2, null, 'foo')
        this.fs.readFile.withArgs('/foo/main.tex').callsArgWith(2, null, 'foo')
        this.fs.readFile.withArgs('/foo/z.tex').callsArgWith(2, null, 'foo')
        this.fs.readFile
          .withArgs('/foo/nested/chapter1a.tex')
          .callsArgWith(2, null, 'foo')
      })

      it('returns the first .tex file from the root folder', async function () {
        this.globbyFiles.splice(
          0,
          this.globbyFiles.length,
          'a.tex',
          'z.tex',
          'nested/chapter1a.tex'
        )

        const { path, content } =
          await this.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        expect(path).to.equal('a.tex')
        expect(content).to.equal('foo')
      })

      it('returns main.tex file from the root folder', async function () {
        this.globbyFiles.splice(
          0,
          this.globbyFiles.length,
          'a.tex',
          'z.tex',
          'main.tex',
          'nested/chapter1a.tex'
        )

        const { path, content } =
          await this.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        expect(path).to.equal('main.tex')
        expect(content).to.equal('foo')
      })
    })

    describe('when a.tex contains a documentclass', function () {
      beforeEach(function () {
        this.fs.readFile
          .withArgs('/foo/a.tex')
          .callsArgWith(2, null, this.documentclassContent)
      })

      it('returns a.tex', async function () {
        const { path, content } =
          await this.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        expect(path).to.equal('a.tex')
        expect(content).to.equal(this.documentclassContent)
      })

      it('processes main.text first and stops processing when it finds the content', async function () {
        await this.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
          '/foo'
        )
        expect(this.fs.readFile).to.be.calledWith('/foo/main.tex')
        expect(this.fs.readFile).to.be.calledWith('/foo/a.tex')
        expect(this.fs.readFile).not.to.be.calledWith('/foo/b.tex')
      })
    })

    describe('when there is no documentclass', function () {
      it('returns with no error', async function () {
        await this.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
          '/foo'
        )
      })

      it('processes all the files', async function () {
        await this.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
          '/foo'
        )
        expect(this.fs.readFile).to.be.calledWith('/foo/main.tex')
        expect(this.fs.readFile).to.be.calledWith('/foo/a.tex')
        expect(this.fs.readFile).to.be.calledWith('/foo/b.tex')
      })
    })

    describe('when there is an error reading a file', function () {
      beforeEach(function () {
        this.fs.readFile
          .withArgs('/foo/a.tex')
          .callsArgWith(2, new Error('something went wrong'))
      })

      it('returns an error', async function () {
        let error

        try {
          await this.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        } catch (err) {
          error = err
        }

        expect(error).to.exist
      })
    })
  })

  describe('setRootDocFromName', function () {
    describe('when there is a suitable root doc', function () {
      beforeEach(async function () {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, this.docPaths)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        await this.ProjectRootDocManager.promises.setRootDocFromName(
          this.project_id,
          '/main.tex'
        )
      })

      it('should check the docs of the project', function () {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should set the root doc to main.tex', function () {
        this.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(this.project_id, this.docId2.toString())
          .should.equal(true)
      })
    })

    describe('when there is a suitable root doc but the leading slash is missing', function () {
      beforeEach(async function () {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, this.docPaths)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        await this.ProjectRootDocManager.promises.setRootDocFromName(
          this.project_id,
          'main.tex'
        )
      })

      it('should check the docs of the project', function () {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should set the root doc to main.tex', function () {
        this.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(this.project_id, this.docId2.toString())
          .should.equal(true)
      })
    })

    describe('when there is a suitable root doc with a basename match', function () {
      beforeEach(async function () {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, this.docPaths)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        await this.ProjectRootDocManager.promises.setRootDocFromName(
          this.project_id,
          'chapter1a.tex'
        )
      })

      it('should check the docs of the project', function () {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should set the root doc using the basename', function () {
        this.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(this.project_id, this.docId3.toString())
          .should.equal(true)
      })
    })

    describe('when there is a suitable root doc but the filename is in quotes', function () {
      beforeEach(async function () {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, this.docPaths)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        await this.ProjectRootDocManager.promises.setRootDocFromName(
          this.project_id,
          "'main.tex'"
        )
      })

      it('should check the docs of the project', function () {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should set the root doc to main.tex', function () {
        this.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(this.project_id, this.docId2.toString())
          .should.equal(true)
      })
    })

    describe('when there is no suitable root doc', function () {
      beforeEach(async function () {
        this.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, this.docPaths)
        this.ProjectEntityUpdateHandler.setRootDoc = sinon
          .stub()
          .callsArgWith(2)
        await this.ProjectRootDocManager.promises.setRootDocFromName(
          this.project_id,
          'other.tex'
        )
      })

      it('should not set the root doc', function () {
        this.ProjectEntityUpdateHandler.setRootDoc.called.should.equal(false)
      })
    })
  })

  describe('ensureRootDocumentIsSet', function () {
    beforeEach(function () {
      this.project = {}
      this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, this.project)
      this.ProjectRootDocManager.setRootDocAutomatically = sinon
        .stub()
        .callsArgWith(1, null)
    })

    describe('when the root doc is set', function () {
      beforeEach(function () {
        this.project.rootDoc_id = this.docId2
        this.ProjectRootDocManager.ensureRootDocumentIsSet(
          this.project_id,
          this.callback
        )
      })

      it('should find the project fetching only the rootDoc_id field', function () {
        this.ProjectGetter.getProject
          .calledWith(this.project_id, { rootDoc_id: 1 })
          .should.equal(true)
      })

      it('should not try to update the project rootDoc_id', function () {
        this.ProjectRootDocManager.setRootDocAutomatically.called.should.equal(
          false
        )
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when the root doc is not set', function () {
      beforeEach(function () {
        this.ProjectRootDocManager.ensureRootDocumentIsSet(
          this.project_id,
          this.callback
        )
      })

      it('should find the project with only the rootDoc_id field', function () {
        this.ProjectGetter.getProject
          .calledWith(this.project_id, { rootDoc_id: 1 })
          .should.equal(true)
      })

      it('should update the project rootDoc_id', function () {
        this.ProjectRootDocManager.setRootDocAutomatically
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when the project does not exist', function () {
      beforeEach(function () {
        this.ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, null)
        this.ProjectRootDocManager.ensureRootDocumentIsSet(
          this.project_id,
          this.callback
        )
      })

      it('should call the callback with an error', function () {
        this.callback
          .calledWith(
            sinon.match
              .instanceOf(Error)
              .and(sinon.match.has('message', 'project not found'))
          )
          .should.equal(true)
      })
    })
  })

  describe('ensureRootDocumentIsValid', function () {
    beforeEach(function () {
      this.project = {}
      this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, this.project)
      this.ProjectGetter.getProjectWithoutDocLines = sinon
        .stub()
        .callsArgWith(1, null, this.project)
      this.ProjectEntityUpdateHandler.setRootDoc = sinon.stub().yields()
      this.ProjectEntityUpdateHandler.unsetRootDoc = sinon.stub().yields()
      this.ProjectRootDocManager.setRootDocAutomatically = sinon
        .stub()
        .callsArgWith(1, null)
    })

    describe('when the root doc is set', function () {
      describe('when the root doc is valid', function () {
        beforeEach(function () {
          this.project.rootDoc_id = this.docId2
          this.ProjectEntityHandler.getDocPathFromProjectByDocId = sinon
            .stub()
            .callsArgWith(2, null, this.docPaths[this.docId2])
          this.ProjectRootDocManager.ensureRootDocumentIsValid(
            this.project_id,
            this.callback
          )
        })

        it('should find the project without doc lines', function () {
          this.ProjectGetter.getProjectWithoutDocLines
            .calledWith(this.project_id)
            .should.equal(true)
        })

        it('should not try to update the project rootDoc_id', function () {
          this.ProjectRootDocManager.setRootDocAutomatically.called.should.equal(
            false
          )
        })

        it('should call the callback', function () {
          this.callback.called.should.equal(true)
        })
      })

      describe('when the root doc is not valid', function () {
        beforeEach(function () {
          this.project.rootDoc_id = new ObjectId()
          this.ProjectEntityHandler.getDocPathFromProjectByDocId = sinon
            .stub()
            .callsArgWith(2, null, null)
          this.ProjectRootDocManager.ensureRootDocumentIsValid(
            this.project_id,
            this.callback
          )
        })

        it('should find the project without doc lines', function () {
          this.ProjectGetter.getProjectWithoutDocLines
            .calledWith(this.project_id)
            .should.equal(true)
        })

        it('should unset the root doc', function () {
          this.ProjectEntityUpdateHandler.unsetRootDoc
            .calledWith(this.project_id)
            .should.equal(true)
        })

        it('should try to find a new rootDoc', function () {
          this.ProjectRootDocManager.setRootDocAutomatically.called.should.equal(
            true
          )
        })

        it('should call the callback', function () {
          this.callback.called.should.equal(true)
        })
      })
    })

    describe('when the root doc is not set', function () {
      beforeEach(function () {
        this.ProjectRootDocManager.ensureRootDocumentIsValid(
          this.project_id,
          this.callback
        )
      })

      it('should find the project without doc lines', function () {
        this.ProjectGetter.getProjectWithoutDocLines
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should update the project rootDoc_id', function () {
        this.ProjectRootDocManager.setRootDocAutomatically
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })

    describe('when the project does not exist', function () {
      beforeEach(function () {
        this.ProjectGetter.getProjectWithoutDocLines = sinon
          .stub()
          .callsArgWith(1, null, null)
        this.ProjectRootDocManager.ensureRootDocumentIsValid(
          this.project_id,
          this.callback
        )
      })

      it('should call the callback with an error', function () {
        this.callback
          .calledWith(
            sinon.match
              .instanceOf(Error)
              .and(sinon.match.has('message', 'project not found'))
          )
          .should.equal(true)
      })
    })
  })
})
