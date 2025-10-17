import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
const modulePath = '../../../../app/src/Features/Project/ProjectGetter.mjs'

const { ObjectId } = mongodb

describe('ProjectGetter', function () {
  beforeEach(async function (ctx) {
    ctx.project = { _id: new ObjectId() }
    ctx.projectIdStr = ctx.project._id.toString()
    ctx.deletedProject = { deleterData: { wombat: 'potato' } }
    ctx.userId = new ObjectId()

    ctx.DeletedProject = {
      find: sinon.stub().returns({
        exec: sinon.stub().resolves([ctx.deletedProject]),
      }),
    }
    ctx.Project = {
      find: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
      findOne: sinon.stub().returns({
        exec: sinon.stub().resolves(ctx.project),
      }),
    }
    ctx.CollaboratorsGetter = {
      promises: {
        getProjectsUserIsMemberOf: sinon.stub().resolves({
          readAndWrite: [],
          readOnly: [],
          tokenReadAndWrite: [],
          tokenReadOnly: [],
        }),
      },
    }
    ctx.LockManager = {
      promises: {
        runWithLock: sinon
          .stub()
          .callsFake((namespace, id, runner) => runner()),
      },
    }
    ctx.db = {
      projects: {
        findOne: sinon.stub().resolves(ctx.project),
      },
      users: {},
    }
    ctx.ProjectEntityMongoUpdateHandler = {
      lockKey: sinon.stub().returnsArg(0),
    }

    vi.doMock('../../../../app/src/infrastructure/mongodb', () => ({
      db: ctx.db,
      ObjectId,
    }))

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project: ctx.Project,
    }))

    vi.doMock('../../../../app/src/models/DeletedProject', () => ({
      DeletedProject: ctx.DeletedProject,
    }))

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter',
      () => ({
        default: ctx.CollaboratorsGetter,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/LockManager', () => ({
      default: ctx.LockManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityMongoUpdateHandler',
      () => ({
        default: ctx.ProjectEntityMongoUpdateHandler,
      })
    )

    ctx.ProjectGetter = (await import(modulePath)).default
  })

  describe('getProjectWithoutDocLines', function () {
    beforeEach(function (ctx) {
      ctx.ProjectGetter.promises.getProject = sinon.stub().resolves()
    })

    describe('passing an id', function () {
      beforeEach(async function (ctx) {
        await ctx.ProjectGetter.promises.getProjectWithoutDocLines(
          ctx.project._id
        )
      })

      it('should call find with the project id', function (ctx) {
        ctx.ProjectGetter.promises.getProject
          .calledWith(ctx.project._id)
          .should.equal(true)
      })

      it('should exclude the doc lines', function (ctx) {
        const excludes = {
          'rootFolder.docs.lines': 0,
          'rootFolder.folders.docs.lines': 0,
          'rootFolder.folders.folders.docs.lines': 0,
          'rootFolder.folders.folders.folders.docs.lines': 0,
          'rootFolder.folders.folders.folders.folders.docs.lines': 0,
          'rootFolder.folders.folders.folders.folders.folders.docs.lines': 0,
          'rootFolder.folders.folders.folders.folders.folders.folders.docs.lines': 0,
          'rootFolder.folders.folders.folders.folders.folders.folders.folders.docs.lines': 0,
        }

        ctx.ProjectGetter.promises.getProject
          .calledWith(ctx.project._id, excludes)
          .should.equal(true)
      })
    })
  })

  describe('getProjectWithOnlyFolders', function () {
    beforeEach(function (ctx) {
      ctx.ProjectGetter.promises.getProject = sinon.stub().resolves()
    })

    describe('passing an id', function () {
      beforeEach(async function (ctx) {
        await ctx.ProjectGetter.promises.getProjectWithOnlyFolders(
          ctx.project._id
        )
      })

      it('should call find with the project id', function (ctx) {
        ctx.ProjectGetter.promises.getProject
          .calledWith(ctx.project._id)
          .should.equal(true)
      })

      it('should exclude the docs and files lines', function (ctx) {
        const excludes = {
          'rootFolder.docs': 0,
          'rootFolder.fileRefs': 0,
          'rootFolder.folders.docs': 0,
          'rootFolder.folders.fileRefs': 0,
          'rootFolder.folders.folders.docs': 0,
          'rootFolder.folders.folders.fileRefs': 0,
          'rootFolder.folders.folders.folders.docs': 0,
          'rootFolder.folders.folders.folders.fileRefs': 0,
          'rootFolder.folders.folders.folders.folders.docs': 0,
          'rootFolder.folders.folders.folders.folders.fileRefs': 0,
          'rootFolder.folders.folders.folders.folders.folders.docs': 0,
          'rootFolder.folders.folders.folders.folders.folders.fileRefs': 0,
          'rootFolder.folders.folders.folders.folders.folders.folders.docs': 0,
          'rootFolder.folders.folders.folders.folders.folders.folders.fileRefs': 0,
          'rootFolder.folders.folders.folders.folders.folders.folders.folders.docs': 0,
          'rootFolder.folders.folders.folders.folders.folders.folders.folders.fileRefs': 0,
        }
        ctx.ProjectGetter.promises.getProject
          .calledWith(ctx.project._id, excludes)
          .should.equal(true)
      })
    })
  })

  describe('getProject', function () {
    describe('without projection', function () {
      describe('with project id', function () {
        beforeEach(async function (ctx) {
          await ctx.ProjectGetter.promises.getProject(ctx.projectIdStr)
        })

        it('should call findOne with the project id', function (ctx) {
          expect(ctx.db.projects.findOne.callCount).to.equal(1)
          expect(
            ctx.db.projects.findOne.lastCall.args[0]._id.toString()
          ).to.equal(ctx.projectIdStr)
        })
      })

      describe('without project id', function () {
        it('should be rejected', function (ctx) {
          expect(
            ctx.ProjectGetter.promises.getProject(null)
          ).to.be.rejectedWith('no project id provided')
          expect(ctx.db.projects.findOne.callCount).to.equal(0)
        })
      })
    })

    describe('with projection', function () {
      beforeEach(function (ctx) {
        ctx.projection = { _id: 1 }
      })

      describe('with project id', function () {
        beforeEach(async function (ctx) {
          await ctx.ProjectGetter.promises.getProject(
            ctx.projectIdStr,
            ctx.projection
          )
        })

        it('should call findOne with the project id', function (ctx) {
          expect(ctx.db.projects.findOne.callCount).to.equal(1)
          expect(
            ctx.db.projects.findOne.lastCall.args[0]._id.toString()
          ).to.equal(ctx.projectIdStr)
          expect(ctx.db.projects.findOne.lastCall.args[1]).to.deep.equal({
            projection: ctx.projection,
          })
        })
      })

      describe('without project id', function () {
        it('should be rejected', function (ctx) {
          expect(
            ctx.ProjectGetter.promises.getProject(null)
          ).to.be.rejectedWith('no project id provided')
          expect(ctx.db.projects.findOne.callCount).to.equal(0)
        })
      })
    })
  })

  describe('getProjectWithoutLock', function () {
    describe('without projection', function () {
      describe('with project id', function () {
        beforeEach(async function (ctx) {
          await ctx.ProjectGetter.promises.getProjectWithoutLock(
            ctx.projectIdStr
          )
        })

        it('should call findOne with the project id', function (ctx) {
          expect(ctx.db.projects.findOne.callCount).to.equal(1)
          expect(
            ctx.db.projects.findOne.lastCall.args[0]._id.toString()
          ).to.equal(ctx.projectIdStr)
        })
      })

      describe('without project id', function () {
        it('should be rejected', function (ctx) {
          expect(
            ctx.ProjectGetter.promises.getProjectWithoutLock(null)
          ).to.be.rejectedWith('no project id provided')
          expect(ctx.db.projects.findOne.callCount).to.equal(0)
        })
      })
    })

    describe('with projection', function () {
      beforeEach(function (ctx) {
        ctx.projection = { _id: 1 }
      })

      describe('with project id', function () {
        beforeEach(async function (ctx) {
          await ctx.ProjectGetter.promises.getProjectWithoutLock(
            ctx.project._id,
            ctx.projection
          )
        })

        it('should call findOne with the project id', function (ctx) {
          expect(ctx.db.projects.findOne.callCount).to.equal(1)
          expect(
            ctx.db.projects.findOne.lastCall.args[0]._id.toString()
          ).to.equal(ctx.projectIdStr)
          expect(ctx.db.projects.findOne.lastCall.args[1]).to.deep.equal({
            projection: ctx.projection,
          })
        })
      })

      describe('without project id', function () {
        it('should be rejected', function (ctx) {
          expect(
            ctx.ProjectGetter.promises.getProjectWithoutLock(null)
          ).to.be.rejectedWith('no project id provided')
          expect(ctx.db.projects.findOne.callCount).to.equal(0)
        })
      })
    })
  })

  describe('findAllUsersProjects', function () {
    beforeEach(function (ctx) {
      ctx.fields = { mock: 'fields' }
      ctx.projectOwned = { _id: 'mock-owned-projects' }
      ctx.projectRW = { _id: 'mock-rw-projects' }
      ctx.projectReview = { _id: 'mock-review-projects' }
      ctx.projectRO = { _id: 'mock-ro-projects' }
      ctx.projectTokenRW = { _id: 'mock-token-rw-projects' }
      ctx.projectTokenRO = { _id: 'mock-token-ro-projects' }
      ctx.Project.find
        .withArgs({ owner_ref: ctx.userId }, ctx.fields)
        .returns({ exec: sinon.stub().resolves([ctx.projectOwned]) })
    })

    it('should return a promise with all the projects', async function (ctx) {
      ctx.CollaboratorsGetter.promises.getProjectsUserIsMemberOf.resolves({
        readAndWrite: [ctx.projectRW],
        readOnly: [ctx.projectRO],
        tokenReadAndWrite: [ctx.projectTokenRW],
        tokenReadOnly: [ctx.projectTokenRO],
        review: [ctx.projectReview],
      })
      const projects = await ctx.ProjectGetter.promises.findAllUsersProjects(
        ctx.userId,
        ctx.fields
      )

      expect(projects).to.deep.equal({
        owned: [ctx.projectOwned],
        readAndWrite: [ctx.projectRW],
        readOnly: [ctx.projectRO],
        tokenReadAndWrite: [ctx.projectTokenRW],
        tokenReadOnly: [ctx.projectTokenRO],
        review: [ctx.projectReview],
      })
    })

    it('should remove duplicate projects', async function (ctx) {
      ctx.CollaboratorsGetter.promises.getProjectsUserIsMemberOf.resolves({
        readAndWrite: [ctx.projectRW, ctx.projectOwned],
        readOnly: [ctx.projectRO, ctx.projectRW],
        tokenReadAndWrite: [ctx.projectTokenRW, ctx.projectRO],
        tokenReadOnly: [ctx.projectTokenRW, ctx.projectTokenRO, ctx.projectRO],
        review: [ctx.projectReview],
      })
      const projects = await ctx.ProjectGetter.promises.findAllUsersProjects(
        ctx.userId,
        ctx.fields
      )

      expect(projects).to.deep.equal({
        owned: [ctx.projectOwned],
        readAndWrite: [ctx.projectRW],
        readOnly: [ctx.projectRO],
        tokenReadAndWrite: [ctx.projectTokenRW],
        tokenReadOnly: [ctx.projectTokenRO],
        review: [ctx.projectReview],
      })
    })
  })

  describe('getProjectIdByReadAndWriteToken', function () {
    describe('when project find returns project', function () {
      beforeEach(async function (ctx) {
        ctx.projectIdFound =
          await ctx.ProjectGetter.promises.getProjectIdByReadAndWriteToken(
            'token'
          )
      })

      it('should find project with token', function (ctx) {
        ctx.Project.findOne
          .calledWithMatch({ 'tokens.readAndWrite': 'token' })
          .should.equal(true)
      })

      it('should return the project id', function (ctx) {
        expect(ctx.projectIdFound).to.equal(ctx.project._id)
      })
    })

    describe('when project not found', function () {
      it('should return undefined', async function (ctx) {
        ctx.Project.findOne.returns({ exec: sinon.stub().resolves(null) })
        const projectId =
          await ctx.ProjectGetter.promises.getProjectIdByReadAndWriteToken(
            'token'
          )

        expect(projectId).to.equal(undefined)
      })
    })

    describe('when project find returns error', function () {
      beforeEach(async function (ctx) {
        ctx.Project.findOne.returns({ exec: sinon.stub().rejects() })
      })

      it('should be rejected', function (ctx) {
        expect(
          ctx.ProjectGetter.promises.getProjectIdByReadAndWriteToken('token')
        ).to.be.rejected
      })
    })
  })

  describe('findUsersProjectsByName', function () {
    it('should perform a case-insensitive search', async function (ctx) {
      ctx.project1 = { _id: 1, name: 'find me!' }
      ctx.project2 = { _id: 2, name: 'not me!' }
      ctx.project3 = { _id: 3, name: 'FIND ME!' }
      ctx.project4 = { _id: 4, name: 'Find Me!' }
      ctx.Project.find.withArgs({ owner_ref: ctx.userId }).returns({
        exec: sinon
          .stub()
          .resolves([ctx.project1, ctx.project2, ctx.project3, ctx.project4]),
      })
      const projects = await ctx.ProjectGetter.promises.findUsersProjectsByName(
        ctx.userId,
        ctx.project1.name
      )
      const projectNames = projects.map(project => project.name)
      expect(projectNames).to.have.members([
        ctx.project1.name,
        ctx.project3.name,
        ctx.project4.name,
      ])
    })

    it('should search collaborations as well', async function (ctx) {
      ctx.project1 = { _id: 1, name: 'find me!' }
      ctx.project2 = { _id: 2, name: 'FIND ME!' }
      ctx.project3 = { _id: 3, name: 'Find Me!' }
      ctx.project4 = { _id: 4, name: 'find ME!' }
      ctx.project5 = { _id: 5, name: 'FIND me!' }
      ctx.Project.find
        .withArgs({ owner_ref: ctx.userId })
        .returns({ exec: sinon.stub().resolves([ctx.project1]) })
      ctx.CollaboratorsGetter.promises.getProjectsUserIsMemberOf.resolves({
        readAndWrite: [ctx.project2],
        readOnly: [ctx.project3],
        tokenReadAndWrite: [ctx.project4],
        tokenReadOnly: [ctx.project5],
      })
      const projects = await ctx.ProjectGetter.promises.findUsersProjectsByName(
        ctx.userId,
        ctx.project1.name
      )
      expect(projects.map(project => project.name)).to.have.members([
        ctx.project1.name,
        ctx.project2.name,
      ])
    })
  })

  describe('getUsersDeletedProjects', function () {
    it('should look up the deleted projects by deletedProjectOwnerId', async function (ctx) {
      await ctx.ProjectGetter.promises.getUsersDeletedProjects('giraffe')
      sinon.assert.calledWith(ctx.DeletedProject.find, {
        'deleterData.deletedProjectOwnerId': 'giraffe',
      })
    })

    it('should pass the found projects to the callback', async function (ctx) {
      const docs =
        await ctx.ProjectGetter.promises.getUsersDeletedProjects('giraffe')
      expect(docs).to.deep.equal([ctx.deletedProject])
    })
  })
})
