const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')
const { Project } = require('../helpers/models/Project')

const MODULE_PATH =
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsProjectFlusher'

describe('TpdsProjectFlusher', function () {
  beforeEach(function () {
    this.project = { _id: new ObjectId(), overleaf: { history: { id: 42 } } }
    this.folder = { _id: new ObjectId() }
    this.docs = {
      '/doc/one': {
        _id: 'mock-doc-1',
        lines: ['one'],
        rev: 5,
        folder: this.folder,
      },
      '/doc/two': {
        _id: 'mock-doc-2',
        lines: ['two'],
        rev: 6,
        folder: this.folder,
      },
    }
    this.files = {
      '/file/one': {
        _id: 'mock-file-1',
        rev: 7,
        folder: this.folder,
        hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      '/file/two': {
        _id: 'mock-file-2',
        rev: 8,
        folder: this.folder,
        hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    }
    this.DocumentUpdaterHandler = {
      promises: {
        flushProjectToMongo: sinon.stub().resolves(),
      },
    }
    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(this.project),
      },
    }
    this.ProjectEntityHandler = {
      promises: {
        getAllDocs: sinon.stub().withArgs(this.project._id).resolves(this.docs),
        getAllFiles: sinon
          .stub()
          .withArgs(this.project._id)
          .resolves(this.files),
      },
    }
    this.TpdsUpdateSender = {
      promises: {
        addDoc: sinon.stub().resolves(),
        addFile: sinon.stub().resolves(),
      },
    }
    this.ProjectMock = sinon.mock(Project)

    this.TpdsProjectFlusher = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../DocumentUpdater/DocumentUpdaterHandler':
          this.DocumentUpdaterHandler,
        '../Project/ProjectGetter': this.ProjectGetter,
        '../Project/ProjectEntityHandler': this.ProjectEntityHandler,
        '../../models/Project': { Project },
        './TpdsUpdateSender': this.TpdsUpdateSender,
      },
    })
  })

  afterEach(function () {
    this.ProjectMock.restore()
  })

  describe('flushProjectToTpds', function () {
    describe('usually', function () {
      beforeEach(async function () {
        await this.TpdsProjectFlusher.promises.flushProjectToTpds(
          this.project._id
        )
      })

      it('should flush the project from the doc updater', function () {
        expect(
          this.DocumentUpdaterHandler.promises.flushProjectToMongo
        ).to.have.been.calledWith(this.project._id)
      })

      it('should flush each doc to the TPDS', function () {
        for (const [path, doc] of Object.entries(this.docs)) {
          expect(this.TpdsUpdateSender.promises.addDoc).to.have.been.calledWith(
            {
              projectId: this.project._id,
              docId: doc._id,
              projectName: this.project.name,
              rev: doc.rev,
              path,
              folderId: this.folder._id,
            }
          )
        }
      })

      it('should flush each file to the TPDS', function () {
        for (const [path, file] of Object.entries(this.files)) {
          expect(
            this.TpdsUpdateSender.promises.addFile
          ).to.have.been.calledWith({
            projectId: this.project._id,
            historyId: this.project.overleaf.history.id,
            fileId: file._id,
            hash: file.hash,
            projectName: this.project.name,
            rev: file.rev,
            path,
            folderId: this.folder._id,
          })
        }
      })
    })

    describe('when a TPDS flush is pending', function () {
      beforeEach(async function () {
        this.project.deferredTpdsFlushCounter = 2
        this.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: this.project._id,
              deferredTpdsFlushCounter: { $lte: 2 },
            },
            { $set: { deferredTpdsFlushCounter: 0 } }
          )
          .chain('exec')
          .resolves()
        await this.TpdsProjectFlusher.promises.flushProjectToTpds(
          this.project._id
        )
      })

      it('resets the deferred flush counter', function () {
        this.ProjectMock.verify()
      })
    })
  })

  describe('deferProjectFlushToTpds', function () {
    beforeEach(async function () {
      this.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: this.project._id,
          },
          { $inc: { deferredTpdsFlushCounter: 1 } }
        )
        .chain('exec')
        .resolves()
      await this.TpdsProjectFlusher.promises.deferProjectFlushToTpds(
        this.project._id
      )
    })

    it('increments the deferred flush counter', function () {
      this.ProjectMock.verify()
    })
  })

  describe('flushProjectToTpdsIfNeeded', function () {
    let cases = [0, undefined]
    cases.forEach(counterValue => {
      describe(`when the deferred flush counter is ${counterValue}`, function () {
        beforeEach(async function () {
          this.project.deferredTpdsFlushCounter = counterValue
          await this.TpdsProjectFlusher.promises.flushProjectToTpdsIfNeeded(
            this.project._id
          )
        })

        it("doesn't flush the project from the doc updater", function () {
          expect(this.DocumentUpdaterHandler.promises.flushProjectToMongo).not
            .to.have.been.called
        })

        it("doesn't flush any doc", function () {
          expect(this.TpdsUpdateSender.promises.addDoc).not.to.have.been.called
        })

        it("doesn't flush any file", function () {
          expect(this.TpdsUpdateSender.promises.addFile).not.to.have.been.called
        })
      })
    })

    cases = [1, 2]
    cases.forEach(counterValue => {
      describe(`when the deferred flush counter is ${counterValue}`, function () {
        beforeEach(async function () {
          this.project.deferredTpdsFlushCounter = counterValue
          this.ProjectMock.expects('updateOne')
            .withArgs(
              {
                _id: this.project._id,
                deferredTpdsFlushCounter: { $lte: counterValue },
              },
              { $set: { deferredTpdsFlushCounter: 0 } }
            )
            .chain('exec')
            .resolves()
          await this.TpdsProjectFlusher.promises.flushProjectToTpdsIfNeeded(
            this.project._id
          )
        })

        it('flushes the project from the doc updater', function () {
          expect(
            this.DocumentUpdaterHandler.promises.flushProjectToMongo
          ).to.have.been.calledWith(this.project._id)
        })

        it('flushes each doc to the TPDS', function () {
          for (const [path, doc] of Object.entries(this.docs)) {
            expect(
              this.TpdsUpdateSender.promises.addDoc
            ).to.have.been.calledWith({
              projectId: this.project._id,
              docId: doc._id,
              projectName: this.project.name,
              rev: doc.rev,
              path,
              folderId: this.folder._id,
            })
          }
        })

        it('flushes each file to the TPDS', function () {
          for (const [path, file] of Object.entries(this.files)) {
            expect(
              this.TpdsUpdateSender.promises.addFile
            ).to.have.been.calledWith({
              projectId: this.project._id,
              historyId: this.project.overleaf.history.id,
              fileId: file._id,
              hash: file.hash,
              projectName: this.project.name,
              rev: file.rev,
              path,
              folderId: this.folder._id,
            })
          }
        })

        it('resets the deferred flush counter', function () {
          this.ProjectMock.verify()
        })
      })
    })
  })
})
