import { vi, expect } from 'vitest'
import mongodb from 'mongodb-legacy'
import sinon from 'sinon'

const { ObjectId } = mongodb

const MODULE_PATH =
  '../../../../app/src/Features/Project/ProjectCollabratecDetailsHandler.mjs'

describe('ProjectCollabratecDetailsHandler', function () {
  beforeEach(async function (ctx) {
    ctx.projectId = new ObjectId('5bea8747c7bba6012fcaceb3')
    ctx.userId = new ObjectId('5be316a9c7f6aa03802ea8fb')
    ctx.userId2 = new ObjectId('5c1794b3f0e89b1d1c577eca')
    ctx.ProjectModel = {}

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('../../../../app/src/models/Project.mjs', () => ({
      Project: ctx.ProjectModel,
    }))

    ctx.ProjectCollabratecDetailsHandler = (await import(MODULE_PATH)).default
  })

  describe('initializeCollabratecProject', function () {
    describe('when update succeeds', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        await ctx.ProjectCollabratecDetailsHandler.promises.initializeCollabratecProject(
          ctx.projectId,
          ctx.userId,
          'collabratec-document-id',
          'collabratec-private-group-id'
        )
      })

      it('should update project model', function (ctx) {
        const update = {
          $set: {
            collabratecUsers: [
              {
                user_id: ctx.userId,
                collabratec_document_id: 'collabratec-document-id',
                collabratec_privategroup_id: 'collabratec-private-group-id',
              },
            ],
          },
        }
        expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
          { _id: ctx.projectId },
          update
        )
      })
    })

    describe('when update has error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().rejects() })
      })

      it('should be rejected', async function (ctx) {
        await expect(
          ctx.ProjectCollabratecDetailsHandler.promises.initializeCollabratecProject(
            ctx.projectId,
            ctx.userId,
            'collabratec-document-id',
            'collabratec-private-group-id'
          )
        ).to.be.rejected
      })
    })

    describe('with invalid args', function () {
      beforeEach(function (ctx) {
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        ctx.resultPromise =
          ctx.ProjectCollabratecDetailsHandler.promises.initializeCollabratecProject(
            'bad-project-id',
            'bad-user-id',
            'collabratec-document-id',
            'collabratec-private-group-id'
          )
      })

      it('should be rejected without updating', async function (ctx) {
        await expect(ctx.resultPromise).to.be.rejected
        expect(ctx.ProjectModel.updateOne).not.to.have.been.called
      })
    })
  })

  describe('isLinkedCollabratecUserProject', function () {
    beforeEach(function (ctx) {
      ctx.ProjectModel.findOne = sinon.stub().resolves()
    })

    describe('when find succeeds', function () {
      describe('when user project found', function () {
        beforeEach(async function (ctx) {
          ctx.ProjectModel.findOne = sinon
            .stub()
            .returns({ exec: sinon.stub().resolves('project') })
          ctx.result =
            await ctx.ProjectCollabratecDetailsHandler.promises.isLinkedCollabratecUserProject(
              ctx.projectId,
              ctx.userId
            )
        })

        it('should call find with project and user id', function (ctx) {
          expect(ctx.ProjectModel.findOne).to.have.been.calledWithMatch({
            _id: new ObjectId(ctx.projectId),
            collabratecUsers: {
              $elemMatch: {
                user_id: new ObjectId(ctx.userId),
              },
            },
          })
        })

        it('should return true', function (ctx) {
          expect(ctx.result).to.equal(true)
        })
      })

      describe('when user project is not found', function () {
        beforeEach(async function (ctx) {
          ctx.ProjectModel.findOne = sinon
            .stub()
            .returns({ exec: sinon.stub().resolves(null) })
          ctx.result =
            await ctx.ProjectCollabratecDetailsHandler.promises.isLinkedCollabratecUserProject(
              ctx.projectId,
              ctx.userId
            )
        })

        it('should return false', function (ctx) {
          expect(ctx.result).to.equal(false)
        })
      })
    })

    describe('when find has error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectModel.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().rejects() })
      })

      it('should be rejected', async function (ctx) {
        await expect(
          ctx.ProjectCollabratecDetailsHandler.promises.isLinkedCollabratecUserProject(
            ctx.projectId,
            ctx.userId
          )
        ).to.be.rejected
      })
    })

    describe('with invalid args', function () {
      beforeEach(function (ctx) {
        ctx.ProjectModel.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        ctx.resultPromise =
          ctx.ProjectCollabratecDetailsHandler.promises.isLinkedCollabratecUserProject(
            'bad-project-id',
            'bad-user-id'
          )
      })

      it('should be rejected without updating', async function (ctx) {
        await expect(ctx.resultPromise).to.be.rejected
        expect(ctx.ProjectModel.findOne).not.to.have.been.called
      })
    })
  })

  describe('linkCollabratecUserProject', function () {
    describe('when update succeeds', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        await ctx.ProjectCollabratecDetailsHandler.promises.linkCollabratecUserProject(
          ctx.projectId,
          ctx.userId,
          'collabratec-document-id'
        )
      })

      it('should update project model', function (ctx) {
        const query = {
          _id: ctx.projectId,
          collabratecUsers: {
            $not: {
              $elemMatch: {
                collabratec_document_id: 'collabratec-document-id',
                user_id: ctx.userId,
              },
            },
          },
        }
        const update = {
          $push: {
            collabratecUsers: {
              collabratec_document_id: 'collabratec-document-id',
              user_id: ctx.userId,
            },
          },
        }
        expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
          query,
          update
        )
      })
    })

    describe('when update has error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().rejects() })
      })

      it('should be rejected', async function (ctx) {
        await expect(
          ctx.ProjectCollabratecDetailsHandler.promises.linkCollabratecUserProject(
            ctx.projectId,
            ctx.userId,
            'collabratec-document-id'
          )
        ).to.be.rejected
      })
    })

    describe('with invalid args', function () {
      beforeEach(function (ctx) {
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        ctx.resultPromise =
          ctx.ProjectCollabratecDetailsHandler.promises.linkCollabratecUserProject(
            'bad-project-id',
            'bad-user-id',
            'collabratec-document-id'
          )
      })

      it('should be rejected without updating', async function (ctx) {
        await expect(ctx.resultPromise).to.be.rejected
        expect(ctx.ProjectModel.updateOne).not.to.have.been.called
      })
    })
  })

  describe('setCollabratecUsers', function () {
    beforeEach(function (ctx) {
      ctx.collabratecUsers = [
        {
          user_id: ctx.userId,
          collabratec_document_id: 'collabratec-document-id-1',
          collabratec_privategroup_id: 'collabratec-private-group-id-1',
        },
        {
          user_id: ctx.userId2,
          collabratec_document_id: 'collabratec-document-id-2',
          collabratec_privategroup_id: 'collabratec-private-group-id-2',
        },
      ]
    })

    describe('when update succeeds', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        await ctx.ProjectCollabratecDetailsHandler.promises.setCollabratecUsers(
          ctx.projectId,
          ctx.collabratecUsers
        )
      })

      it('should update project model', function (ctx) {
        const update = {
          $set: {
            collabratecUsers: ctx.collabratecUsers,
          },
        }
        expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
          { _id: ctx.projectId },
          update
        )
      })
    })

    describe('when update has error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().rejects() })
      })

      it('should be rejected', async function (ctx) {
        await expect(
          ctx.ProjectCollabratecDetailsHandler.promises.setCollabratecUsers(
            ctx.projectId,
            ctx.collabratecUsers
          )
        ).to.be.rejected
      })
    })

    describe('with invalid project_id', function () {
      beforeEach(function (ctx) {
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        ctx.resultPromise =
          ctx.ProjectCollabratecDetailsHandler.promises.setCollabratecUsers(
            'bad-project-id',
            ctx.collabratecUsers
          )
      })

      it('should be rejected without updating', async function (ctx) {
        await expect(ctx.resultPromise).to.be.rejected
        expect(ctx.ProjectModel.updateOne).not.to.have.been.called
      })
    })

    describe('with invalid user_id', function () {
      beforeEach(function (ctx) {
        ctx.collabratecUsers[1].user_id = 'bad-user-id'
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        ctx.resultPromise =
          ctx.ProjectCollabratecDetailsHandler.promises.setCollabratecUsers(
            ctx.projectId,
            ctx.collabratecUsers
          )
      })

      it('should be rejected without updating', async function (ctx) {
        await expect(ctx.resultPromise).to.be.rejected
        expect(ctx.ProjectModel.updateOne).not.to.have.been.called
      })
    })
  })

  describe('unlinkCollabratecUserProject', function () {
    describe('when update succeeds', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        await ctx.ProjectCollabratecDetailsHandler.promises.unlinkCollabratecUserProject(
          ctx.projectId,
          ctx.userId
        )
      })

      it('should update project model', function (ctx) {
        const query = { _id: ctx.projectId }
        const update = {
          $pull: {
            collabratecUsers: {
              user_id: ctx.userId,
            },
          },
        }
        expect(ctx.ProjectModel.updateOne).to.have.been.calledWith(
          query,
          update
        )
      })
    })

    describe('when update has error', function () {
      beforeEach(function (ctx) {
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().rejects() })
      })

      it('should be rejected', async function (ctx) {
        await expect(
          ctx.ProjectCollabratecDetailsHandler.promises.unlinkCollabratecUserProject(
            ctx.projectId,
            ctx.userId
          )
        ).to.be.rejected
      })
    })

    describe('with invalid args', function () {
      beforeEach(function (ctx) {
        ctx.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        ctx.resultPromise =
          ctx.ProjectCollabratecDetailsHandler.promises.unlinkCollabratecUserProject(
            'bad-project-id',
            'bad-user-id'
          )
      })

      it('should be rejected without updating', async function (ctx) {
        await expect(ctx.resultPromise).to.be.rejected
        expect(ctx.ProjectModel.updateOne).not.to.have.been.called
      })
    })
  })
})
