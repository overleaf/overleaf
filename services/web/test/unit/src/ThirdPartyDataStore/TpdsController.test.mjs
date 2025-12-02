import { expect, vi } from 'vitest'
import mongodb from 'mongodb-legacy'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import MockResponse from '../helpers/MockResponse.mjs'
import MockRequest from '../helpers/MockRequest.mjs'

const ObjectId = mongodb.ObjectId

const MODULE_PATH =
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsController.mjs'

describe('TpdsController', function () {
  beforeEach(async function (ctx) {
    ctx.metadata = {
      projectId: new ObjectId(),
      entityId: new ObjectId(),
      folderId: new ObjectId(),
      entityType: 'doc',
      rev: 2,
    }
    ctx.TpdsUpdateHandler = {
      promises: {
        newUpdate: sinon.stub().resolves(ctx.metadata),
        deleteUpdate: sinon.stub().resolves(ctx.metadata.entityId),
        createFolder: sinon.stub().resolves(),
      },
    }
    ctx.UpdateMerger = {
      promises: {
        mergeUpdate: sinon.stub().resolves(ctx.metadata),
        deleteUpdate: sinon.stub().resolves(ctx.metadata.entityId),
      },
    }
    ctx.NotificationsBuilder = {
      promises: {
        tpdsFileLimit: sinon.stub().returns({ create: sinon.stub() }),
      },
    }
    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns('user-id'),
    }
    ctx.TpdsQueueManager = {
      promises: {
        getQueues: sinon.stub().resolves('queues'),
      },
    }
    ctx.HttpErrorHandler = {
      conflict: sinon.stub(),
    }

    ctx.newProject = { _id: new ObjectId() }
    ctx.ProjectCreationHandler = {
      promises: { createBlankProject: sinon.stub().resolves(ctx.newProject) },
    }
    ctx.ProjectDetailsHandler = {
      promises: {
        generateUniqueName: sinon.stub().resolves('unique'),
      },
    }

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateHandler',
      () => ({
        default: ctx.TpdsUpdateHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/UpdateMerger',
      () => ({
        default: ctx.UpdateMerger,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsBuilder',
      () => ({
        default: ctx.NotificationsBuilder,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock('../../../../app/src/Features/Errors/HttpErrorHandler', () => ({
      default: ctx.HttpErrorHandler,
    }))

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsQueueManager',
      () => ({
        default: ctx.TpdsQueueManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectCreationHandler',
      () => ({
        default: ctx.ProjectCreationHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectDetailsHandler',
      () => ({
        default: ctx.ProjectDetailsHandler,
      })
    )

    ctx.TpdsController = (await import(MODULE_PATH)).default

    ctx.user_id = 'dsad29jlkjas'
  })

  describe('creating a project', function () {
    it('should yield the new projects id', async function (ctx) {
      await new Promise(resolve => {
        const res = new MockResponse(vi)
        const req = new MockRequest(vi)
        req.params.user_id = ctx.user_id
        req.body = { projectName: 'foo' }
        res.callback = err => {
          if (err) resolve(err)
          expect(res.body).to.equal(
            JSON.stringify({ projectId: ctx.newProject._id.toString() })
          )
          expect(
            ctx.ProjectDetailsHandler.promises.generateUniqueName
          ).to.have.been.calledWith(ctx.user_id, 'foo')
          expect(
            ctx.ProjectCreationHandler.promises.createBlankProject
          ).to.have.been.calledWith(
            ctx.user_id,
            'unique',
            {},
            { skipCreatingInTPDS: true }
          )
          resolve()
        }
        ctx.TpdsController.createProject(req, res)
      })
    })
  })

  describe('getting an update', function () {
    beforeEach(function (ctx) {
      ctx.projectName = 'projectName'
      ctx.path = '/here.txt'
      ctx.req = {
        params: {
          0: `${ctx.projectName}${ctx.path}`,
          user_id: ctx.user_id,
          project_id: '',
        },
        headers: {
          'x-update-source': (ctx.source = 'dropbox'),
        },
      }
    })

    it('should process the update with the update receiver by name', async function (ctx) {
      await new Promise(resolve => {
        const res = {
          json: payload => {
            expect(payload).to.deep.equal({
              status: 'applied',
              projectId: ctx.metadata.projectId.toString(),
              entityId: ctx.metadata.entityId.toString(),
              folderId: ctx.metadata.folderId.toString(),
              entityType: ctx.metadata.entityType,
              rev: ctx.metadata.rev.toString(),
            })
            ctx.TpdsUpdateHandler.promises.newUpdate
              .calledWith(
                ctx.user_id,
                '', // projectId
                ctx.projectName,
                ctx.path,
                ctx.req,
                ctx.source
              )
              .should.equal(true)
            resolve()
          },
        }
        ctx.TpdsController.mergeUpdate(ctx.req, res)
      })
    })

    it('should indicate in the response when the update was rejected', async function (ctx) {
      await new Promise(resolve => {
        ctx.TpdsUpdateHandler.promises.newUpdate.resolves(null)
        const res = {
          json: payload => {
            expect(payload).to.deep.equal({ status: 'rejected' })
            resolve()
          },
        }
        ctx.TpdsController.mergeUpdate(ctx.req, res)
      })
    })

    it('should process the update with the update receiver by id', async function (ctx) {
      await new Promise(resolve => {
        const path = '/here.txt'
        const req = {
          pause() {},
          params: { 0: path, user_id: ctx.user_id, project_id: '123' },
          session: {
            destroy() {},
          },
          headers: {
            'x-update-source': (ctx.source = 'dropbox'),
          },
        }
        const res = {
          json: () => {
            ctx.TpdsUpdateHandler.promises.newUpdate.should.have.been.calledWith(
              ctx.user_id,
              '123',
              '', // projectName
              '/here.txt',
              req,
              ctx.source
            )
            resolve()
          },
        }
        ctx.TpdsController.mergeUpdate(req, res)
      })
    })

    it('should return a 500 error when the update receiver fails', async function (ctx) {
      await new Promise(resolve => {
        ctx.TpdsUpdateHandler.promises.newUpdate.rejects(new Error())
        const res = {
          json: sinon.stub(),
        }
        ctx.TpdsController.mergeUpdate(ctx.req, res, err => {
          expect(err).to.exist
          expect(res.json).not.to.have.been.called
          resolve()
        })
      })
    })

    it('should return a 400 error when the project is too big', async function (ctx) {
      await new Promise(resolve => {
        ctx.TpdsUpdateHandler.promises.newUpdate.rejects({
          message: 'project_has_too_many_files',
        })
        const res = {
          sendStatus: status => {
            expect(status).to.equal(400)
            ctx.NotificationsBuilder.promises.tpdsFileLimit.should.have.been.calledWith(
              ctx.user_id
            )
            resolve()
          },
        }
        ctx.TpdsController.mergeUpdate(ctx.req, res)
      })
    })

    it('should return a 429 error when the update receiver fails due to too many requests error', async function (ctx) {
      await new Promise(resolve => {
        ctx.TpdsUpdateHandler.promises.newUpdate.rejects(
          new Errors.TooManyRequestsError('project on cooldown')
        )
        const res = {
          sendStatus: status => {
            expect(status).to.equal(429)
            resolve()
          },
        }
        ctx.TpdsController.mergeUpdate(ctx.req, res)
      })
    })
  })

  describe('getting a delete update', function () {
    it('should process the delete with the update receiver by name', async function (ctx) {
      await new Promise(resolve => {
        const path = '/projectName/here.txt'
        const req = {
          params: { 0: path, user_id: ctx.user_id, project_id: '' },
          session: {
            destroy() {},
          },
          headers: {
            'x-update-source': (ctx.source = 'dropbox'),
          },
        }
        const res = {
          sendStatus: () => {
            ctx.TpdsUpdateHandler.promises.deleteUpdate
              .calledWith(
                ctx.user_id,
                '',
                'projectName',
                '/here.txt',
                ctx.source
              )
              .should.equal(true)
            resolve()
          },
        }
        ctx.TpdsController.deleteUpdate(req, res)
      })
    })

    it('should process the delete with the update receiver by id', async function (ctx) {
      await new Promise(resolve => {
        const path = '/here.txt'
        const req = {
          params: { 0: path, user_id: ctx.user_id, project_id: '123' },
          session: {
            destroy() {},
          },
          headers: {
            'x-update-source': (ctx.source = 'dropbox'),
          },
        }
        const res = {
          sendStatus: () => {
            ctx.TpdsUpdateHandler.promises.deleteUpdate.should.have.been.calledWith(
              ctx.user_id,
              '123',
              '', // projectName
              '/here.txt',
              ctx.source
            )
            resolve()
          },
        }
        ctx.TpdsController.deleteUpdate(req, res)
      })
    })
  })

  describe('updateFolder', function () {
    beforeEach(function (ctx) {
      ctx.req = {
        body: { userId: ctx.user_id, path: '/abc/def/ghi.txt' },
      }
      ctx.res = {
        json: sinon.stub(),
      }
    })

    it("creates a folder if it doesn't exist", async function (ctx) {
      await new Promise(resolve => {
        const metadata = {
          folderId: new ObjectId(),
          projectId: new ObjectId(),
          path: '/def/ghi.txt',
          parentFolderId: new ObjectId(),
        }
        ctx.TpdsUpdateHandler.promises.createFolder.resolves(metadata)
        ctx.res.json.callsFake(body => {
          expect(body).to.deep.equal({
            entityId: metadata.folderId.toString(),
            projectId: metadata.projectId.toString(),
            path: metadata.path,
            folderId: metadata.parentFolderId.toString(),
          })
          resolve()
        })
        ctx.TpdsController.updateFolder(ctx.req, ctx.res)
      })
    })

    it('supports top level folders', async function (ctx) {
      await new Promise(resolve => {
        const metadata = {
          folderId: new ObjectId(),
          projectId: new ObjectId(),
          path: '/',
          parentFolderId: null,
        }
        ctx.TpdsUpdateHandler.promises.createFolder.resolves(metadata)
        ctx.res.json.callsFake(body => {
          expect(body).to.deep.equal({
            entityId: metadata.folderId.toString(),
            projectId: metadata.projectId.toString(),
            path: metadata.path,
            folderId: null,
          })
          resolve()
        })
        ctx.TpdsController.updateFolder(ctx.req, ctx.res)
      })
    })

    it("returns a 409 if the folder couldn't be created", async function (ctx) {
      await new Promise(resolve => {
        ctx.TpdsUpdateHandler.promises.createFolder.resolves(null)
        ctx.HttpErrorHandler.conflict.callsFake((req, res) => {
          expect(req).to.equal(ctx.req)
          expect(res).to.equal(ctx.res)
          resolve()
        })
        ctx.TpdsController.updateFolder(ctx.req, ctx.res)
      })
    })
  })

  describe('parseParams', function () {
    it('should take the project name off the start and replace with slash', function (ctx) {
      const path = 'noSlashHere'
      const req = { params: { 0: path, user_id: ctx.user_id } }
      const result = ctx.TpdsController.parseParams(req)
      result.userId.should.equal(ctx.user_id)
      result.filePath.should.equal('/')
      result.projectName.should.equal(path)
    })

    it('should take the project name off the start and it with no slashes in', function (ctx) {
      const path = '/project/file.tex'
      const req = { params: { 0: path, user_id: ctx.user_id } }
      const result = ctx.TpdsController.parseParams(req)
      result.userId.should.equal(ctx.user_id)
      result.filePath.should.equal('/file.tex')
      result.projectName.should.equal('project')
    })

    it('should take the project name of and return a slash for the file path', function (ctx) {
      const path = '/project_name'
      const req = { params: { 0: path, user_id: ctx.user_id } }
      const result = ctx.TpdsController.parseParams(req)
      result.projectName.should.equal('project_name')
      result.filePath.should.equal('/')
    })
  })

  describe('updateProjectContents', function () {
    beforeEach(async function (ctx) {
      ctx.req = {
        params: {
          0: (ctx.path = 'chapters/main.tex'),
          project_id: (ctx.project_id = 'project-id-123'),
        },
        session: {
          destroy: sinon.stub(),
        },
        headers: {
          'x-update-source': (ctx.source = 'github'),
        },
      }

      ctx.res = {
        json: sinon.stub(),
        sendStatus: sinon.stub(),
      }

      await ctx.TpdsController.promises.updateProjectContents(ctx.req, ctx.res)
    })

    it('should merge the update', function (ctx) {
      ctx.UpdateMerger.promises.mergeUpdate.should.be.calledWith(
        null,
        ctx.project_id,
        `/${ctx.path}`,
        ctx.req,
        ctx.source
      )
    })

    it('should return a success', function (ctx) {
      ctx.res.json.should.be.calledWith({
        entityId: ctx.metadata.entityId.toString(),
        rev: ctx.metadata.rev,
      })
    })
  })

  describe('deleteProjectContents', function () {
    beforeEach(async function (ctx) {
      ctx.req = {
        params: {
          0: (ctx.path = 'chapters/main.tex'),
          project_id: (ctx.project_id = 'project-id-123'),
        },
        session: {
          destroy: sinon.stub(),
        },
        headers: {
          'x-update-source': (ctx.source = 'github'),
        },
      }
      ctx.res = {
        sendStatus: sinon.stub(),
        json: sinon.stub(),
      }

      await ctx.TpdsController.promises.deleteProjectContents(ctx.req, ctx.res)
    })

    it('should delete the file', function (ctx) {
      ctx.UpdateMerger.promises.deleteUpdate.should.be.calledWith(
        null,
        ctx.project_id,
        `/${ctx.path}`,
        ctx.source
      )
    })

    it('should return a success', function (ctx) {
      ctx.res.json.should.be.calledWith({
        entityId: ctx.metadata.entityId,
      })
    })
  })

  describe('getQueues', function () {
    beforeEach(function (ctx) {
      ctx.req = {}
      ctx.res = { json: sinon.stub() }
      ctx.next = sinon.stub()
    })

    describe('success', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.res.json.callsFake(() => {
            resolve()
          })
          ctx.TpdsController.getQueues(ctx.req, ctx.res, ctx.next)
        })
      })

      it('should use userId from session', function (ctx) {
        ctx.SessionManager.getLoggedInUserId.should.have.been.calledOnce
        ctx.TpdsQueueManager.promises.getQueues.should.have.been.calledWith(
          'user-id'
        )
      })

      it('should call json with response', function (ctx) {
        ctx.res.json.should.have.been.calledWith('queues')
        ctx.next.should.not.have.been.called
      })
    })

    describe('error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.err = new Error()
          ctx.TpdsQueueManager.promises.getQueues = sinon
            .stub()
            .rejects(ctx.err)
          ctx.next.callsFake(() => {
            resolve()
          })
          ctx.TpdsController.getQueues(ctx.req, ctx.res, ctx.next)
        })
      })

      it('should call next with error', function (ctx) {
        ctx.res.json.should.not.have.been.called
        ctx.next.should.have.been.calledWith(ctx.err)
      })
    })
  })
})
