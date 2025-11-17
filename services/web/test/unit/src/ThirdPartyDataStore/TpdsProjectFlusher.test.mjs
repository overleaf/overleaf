import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import { Project } from '../../../../app/src/models/Project.mjs'

const { ObjectId } = mongodb

const MODULE_PATH =
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsProjectFlusher'

describe('TpdsProjectFlusher', function () {
  beforeEach(async function (ctx) {
    ctx.project = { _id: new ObjectId(), overleaf: { history: { id: 42 } } }
    ctx.folder = { _id: new ObjectId() }
    ctx.docs = {
      '/doc/one': {
        _id: 'mock-doc-1',
        lines: ['one'],
        rev: 5,
        folder: ctx.folder,
      },
      '/doc/two': {
        _id: 'mock-doc-2',
        lines: ['two'],
        rev: 6,
        folder: ctx.folder,
      },
    }
    ctx.files = {
      '/file/one': {
        _id: 'mock-file-1',
        rev: 7,
        folder: ctx.folder,
        hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      '/file/two': {
        _id: 'mock-file-2',
        rev: 8,
        folder: ctx.folder,
        hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    }
    ctx.DocumentUpdaterHandler = {
      promises: {
        flushProjectToMongo: sinon.stub().resolves(),
      },
    }
    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(ctx.project),
      },
    }
    ctx.ProjectEntityHandler = {
      promises: {
        getAllDocs: sinon.stub().withArgs(ctx.project._id).resolves(ctx.docs),
        getAllFiles: sinon.stub().withArgs(ctx.project._id).resolves(ctx.files),
      },
    }
    ctx.TpdsUpdateSender = {
      promises: {
        addDoc: sinon.stub().resolves(),
        addFile: sinon.stub().resolves(),
      },
    }
    ctx.ProjectMock = sinon.mock(Project)

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler',
      () => ({
        default: ctx.DocumentUpdaterHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityHandler',
      () => ({
        default: ctx.ProjectEntityHandler,
      })
    )

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project,
    }))

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateSender',
      () => ({
        default: ctx.TpdsUpdateSender,
      })
    )

    ctx.TpdsProjectFlusher = (await import(MODULE_PATH)).default
  })

  afterEach(function (ctx) {
    ctx.ProjectMock.restore()
  })

  describe('flushProjectToTpds', function () {
    describe('usually', function () {
      beforeEach(async function (ctx) {
        await ctx.TpdsProjectFlusher.promises.flushProjectToTpds(
          ctx.project._id
        )
      })

      it('should flush the project from the doc updater', function (ctx) {
        expect(
          ctx.DocumentUpdaterHandler.promises.flushProjectToMongo
        ).to.have.been.calledWith(ctx.project._id)
      })

      it('should flush each doc to the TPDS', function (ctx) {
        for (const [path, doc] of Object.entries(ctx.docs)) {
          expect(ctx.TpdsUpdateSender.promises.addDoc).to.have.been.calledWith({
            projectId: ctx.project._id,
            docId: doc._id,
            projectName: ctx.project.name,
            rev: doc.rev,
            path,
            folderId: ctx.folder._id,
          })
        }
      })

      it('should flush each file to the TPDS', function (ctx) {
        for (const [path, file] of Object.entries(ctx.files)) {
          expect(ctx.TpdsUpdateSender.promises.addFile).to.have.been.calledWith(
            {
              projectId: ctx.project._id,
              historyId: ctx.project.overleaf.history.id,
              fileId: file._id,
              hash: file.hash,
              projectName: ctx.project.name,
              rev: file.rev,
              path,
              folderId: ctx.folder._id,
            }
          )
        }
      })
    })

    describe('when a TPDS flush is pending', function () {
      beforeEach(async function (ctx) {
        ctx.project.deferredTpdsFlushCounter = 2
        ctx.ProjectMock.expects('updateOne')
          .withArgs(
            {
              _id: ctx.project._id,
              deferredTpdsFlushCounter: { $lte: 2 },
            },
            { $set: { deferredTpdsFlushCounter: 0 } }
          )
          .chain('exec')
          .resolves()
        await ctx.TpdsProjectFlusher.promises.flushProjectToTpds(
          ctx.project._id
        )
      })

      it('resets the deferred flush counter', function (ctx) {
        ctx.ProjectMock.verify()
      })
    })
  })

  describe('deferProjectFlushToTpds', function () {
    beforeEach(async function (ctx) {
      ctx.ProjectMock.expects('updateOne')
        .withArgs(
          {
            _id: ctx.project._id,
          },
          { $inc: { deferredTpdsFlushCounter: 1 } }
        )
        .chain('exec')
        .resolves()
      await ctx.TpdsProjectFlusher.promises.deferProjectFlushToTpds(
        ctx.project._id
      )
    })

    it('increments the deferred flush counter', function (ctx) {
      ctx.ProjectMock.verify()
    })
  })

  describe('flushProjectToTpdsIfNeeded', function () {
    let cases = [0, undefined]
    cases.forEach(counterValue => {
      describe(`when the deferred flush counter is ${counterValue}`, function () {
        beforeEach(async function (ctx) {
          ctx.project.deferredTpdsFlushCounter = counterValue
          await ctx.TpdsProjectFlusher.promises.flushProjectToTpdsIfNeeded(
            ctx.project._id
          )
        })

        it("doesn't flush the project from the doc updater", function (ctx) {
          expect(ctx.DocumentUpdaterHandler.promises.flushProjectToMongo).not.to
            .have.been.called
        })

        it("doesn't flush any doc", function (ctx) {
          expect(ctx.TpdsUpdateSender.promises.addDoc).not.to.have.been.called
        })

        it("doesn't flush any file", function (ctx) {
          expect(ctx.TpdsUpdateSender.promises.addFile).not.to.have.been.called
        })
      })
    })

    cases = [1, 2]
    cases.forEach(counterValue => {
      describe(`when the deferred flush counter is ${counterValue}`, function () {
        beforeEach(async function (ctx) {
          ctx.project.deferredTpdsFlushCounter = counterValue
          ctx.ProjectMock.expects('updateOne')
            .withArgs(
              {
                _id: ctx.project._id,
                deferredTpdsFlushCounter: { $lte: counterValue },
              },
              { $set: { deferredTpdsFlushCounter: 0 } }
            )
            .chain('exec')
            .resolves()
          await ctx.TpdsProjectFlusher.promises.flushProjectToTpdsIfNeeded(
            ctx.project._id
          )
        })

        it('flushes the project from the doc updater', function (ctx) {
          expect(
            ctx.DocumentUpdaterHandler.promises.flushProjectToMongo
          ).to.have.been.calledWith(ctx.project._id)
        })

        it('flushes each doc to the TPDS', function (ctx) {
          for (const [path, doc] of Object.entries(ctx.docs)) {
            expect(
              ctx.TpdsUpdateSender.promises.addDoc
            ).to.have.been.calledWith({
              projectId: ctx.project._id,
              docId: doc._id,
              projectName: ctx.project.name,
              rev: doc.rev,
              path,
              folderId: ctx.folder._id,
            })
          }
        })

        it('flushes each file to the TPDS', function (ctx) {
          for (const [path, file] of Object.entries(ctx.files)) {
            expect(
              ctx.TpdsUpdateSender.promises.addFile
            ).to.have.been.calledWith({
              projectId: ctx.project._id,
              historyId: ctx.project.overleaf.history.id,
              fileId: file._id,
              hash: file.hash,
              projectName: ctx.project.name,
              rev: file.rev,
              path,
              folderId: ctx.folder._id,
            })
          }
        })

        it('resets the deferred flush counter', function (ctx) {
          ctx.ProjectMock.verify()
        })
      })
    })
  })
})
