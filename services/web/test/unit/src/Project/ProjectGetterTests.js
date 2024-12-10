const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/Project/ProjectGetter.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')

describe('ProjectGetter', function () {
  beforeEach(function () {
    this.project = { _id: new ObjectId() }
    this.projectIdStr = this.project._id.toString()
    this.deletedProject = { deleterData: { wombat: 'potato' } }
    this.userId = new ObjectId()

    this.DeletedProject = {
      find: sinon.stub().returns({
        exec: sinon.stub().resolves([this.deletedProject]),
      }),
    }
    this.Project = {
      find: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
      findOne: sinon.stub().returns({
        exec: sinon.stub().resolves(this.project),
      }),
    }
    this.CollaboratorsGetter = {
      promises: {
        getProjectsUserIsMemberOf: sinon.stub().resolves({
          readAndWrite: [],
          readOnly: [],
          tokenReadAndWrite: [],
          tokenReadOnly: [],
        }),
      },
    }
    this.LockManager = {
      promises: {
        runWithLock: sinon
          .stub()
          .callsFake((namespace, id, runner) => runner()),
      },
    }
    this.db = {
      projects: {
        findOne: sinon.stub().resolves(this.project),
      },
      users: {},
    }
    this.ProjectEntityMongoUpdateHandler = {
      lockKey: sinon.stub().returnsArg(0),
    }
    this.ProjectGetter = SandboxedModule.require(modulePath, {
      requires: {
        '../../infrastructure/mongodb': { db: this.db, ObjectId },
        '../../models/Project': {
          Project: this.Project,
        },
        '../../models/DeletedProject': {
          DeletedProject: this.DeletedProject,
        },
        '../Collaborators/CollaboratorsGetter': this.CollaboratorsGetter,
        '../../infrastructure/LockManager': this.LockManager,
        './ProjectEntityMongoUpdateHandler':
          this.ProjectEntityMongoUpdateHandler,
      },
    })
  })

  describe('getProjectWithoutDocLines', function () {
    beforeEach(function () {
      this.ProjectGetter.promises.getProject = sinon.stub().resolves()
    })

    describe('passing an id', function () {
      beforeEach(async function () {
        await this.ProjectGetter.promises.getProjectWithoutDocLines(
          this.project._id
        )
      })

      it('should call find with the project id', function () {
        this.ProjectGetter.promises.getProject
          .calledWith(this.project._id)
          .should.equal(true)
      })

      it('should exclude the doc lines', function () {
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

        this.ProjectGetter.promises.getProject
          .calledWith(this.project._id, excludes)
          .should.equal(true)
      })
    })
  })

  describe('getProjectWithOnlyFolders', function () {
    beforeEach(function () {
      this.ProjectGetter.promises.getProject = sinon.stub().resolves()
    })

    describe('passing an id', function () {
      beforeEach(async function () {
        await this.ProjectGetter.promises.getProjectWithOnlyFolders(
          this.project._id
        )
      })

      it('should call find with the project id', function () {
        this.ProjectGetter.promises.getProject
          .calledWith(this.project._id)
          .should.equal(true)
      })

      it('should exclude the docs and files lines', function () {
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
        this.ProjectGetter.promises.getProject
          .calledWith(this.project._id, excludes)
          .should.equal(true)
      })
    })
  })

  describe('getProject', function () {
    describe('without projection', function () {
      describe('with project id', function () {
        beforeEach(async function () {
          await this.ProjectGetter.promises.getProject(this.projectIdStr)
        })

        it('should call findOne with the project id', function () {
          expect(this.db.projects.findOne.callCount).to.equal(1)
          expect(
            this.db.projects.findOne.lastCall.args[0]._id.toString()
          ).to.equal(this.projectIdStr)
        })
      })

      describe('without project id', function () {
        it('should be rejected', function () {
          expect(
            this.ProjectGetter.promises.getProject(null)
          ).to.be.rejectedWith('no project id provided')
          expect(this.db.projects.findOne.callCount).to.equal(0)
        })
      })
    })

    describe('with projection', function () {
      beforeEach(function () {
        this.projection = { _id: 1 }
      })

      describe('with project id', function () {
        beforeEach(async function () {
          await this.ProjectGetter.promises.getProject(
            this.projectIdStr,
            this.projection
          )
        })

        it('should call findOne with the project id', function () {
          expect(this.db.projects.findOne.callCount).to.equal(1)
          expect(
            this.db.projects.findOne.lastCall.args[0]._id.toString()
          ).to.equal(this.projectIdStr)
          expect(this.db.projects.findOne.lastCall.args[1]).to.deep.equal({
            projection: this.projection,
          })
        })
      })

      describe('without project id', function () {
        it('should be rejected', function () {
          expect(
            this.ProjectGetter.promises.getProject(null)
          ).to.be.rejectedWith('no project id provided')
          expect(this.db.projects.findOne.callCount).to.equal(0)
        })
      })
    })
  })

  describe('getProjectWithoutLock', function () {
    describe('without projection', function () {
      describe('with project id', function () {
        beforeEach(async function () {
          await this.ProjectGetter.promises.getProjectWithoutLock(
            this.projectIdStr
          )
        })

        it('should call findOne with the project id', function () {
          expect(this.db.projects.findOne.callCount).to.equal(1)
          expect(
            this.db.projects.findOne.lastCall.args[0]._id.toString()
          ).to.equal(this.projectIdStr)
        })
      })

      describe('without project id', function () {
        it('should be rejected', function () {
          expect(
            this.ProjectGetter.promises.getProjectWithoutLock(null)
          ).to.be.rejectedWith('no project id provided')
          expect(this.db.projects.findOne.callCount).to.equal(0)
        })
      })
    })

    describe('with projection', function () {
      beforeEach(function () {
        this.projection = { _id: 1 }
      })

      describe('with project id', function () {
        beforeEach(async function () {
          await this.ProjectGetter.promises.getProjectWithoutLock(
            this.project._id,
            this.projection
          )
        })

        it('should call findOne with the project id', function () {
          expect(this.db.projects.findOne.callCount).to.equal(1)
          expect(
            this.db.projects.findOne.lastCall.args[0]._id.toString()
          ).to.equal(this.projectIdStr)
          expect(this.db.projects.findOne.lastCall.args[1]).to.deep.equal({
            projection: this.projection,
          })
        })
      })

      describe('without project id', function () {
        it('should be rejected', function () {
          expect(
            this.ProjectGetter.promises.getProjectWithoutLock(null)
          ).to.be.rejectedWith('no project id provided')
          expect(this.db.projects.findOne.callCount).to.equal(0)
        })
      })
    })
  })

  describe('findAllUsersProjects', function () {
    beforeEach(function () {
      this.fields = { mock: 'fields' }
      this.projectOwned = { _id: 'mock-owned-projects' }
      this.projectRW = { _id: 'mock-rw-projects' }
      this.projectReview = { _id: 'mock-review-projects' }
      this.projectRO = { _id: 'mock-ro-projects' }
      this.projectTokenRW = { _id: 'mock-token-rw-projects' }
      this.projectTokenRO = { _id: 'mock-token-ro-projects' }
      this.Project.find
        .withArgs({ owner_ref: this.userId }, this.fields)
        .returns({ exec: sinon.stub().resolves([this.projectOwned]) })
    })

    it('should return a promise with all the projects', async function () {
      this.CollaboratorsGetter.promises.getProjectsUserIsMemberOf.resolves({
        readAndWrite: [this.projectRW],
        readOnly: [this.projectRO],
        tokenReadAndWrite: [this.projectTokenRW],
        tokenReadOnly: [this.projectTokenRO],
        review: [this.projectReview],
      })
      const projects = await this.ProjectGetter.promises.findAllUsersProjects(
        this.userId,
        this.fields
      )

      expect(projects).to.deep.equal({
        owned: [this.projectOwned],
        readAndWrite: [this.projectRW],
        readOnly: [this.projectRO],
        tokenReadAndWrite: [this.projectTokenRW],
        tokenReadOnly: [this.projectTokenRO],
        review: [this.projectReview],
      })
    })

    it('should remove duplicate projects', async function () {
      this.CollaboratorsGetter.promises.getProjectsUserIsMemberOf.resolves({
        readAndWrite: [this.projectRW, this.projectOwned],
        readOnly: [this.projectRO, this.projectRW],
        tokenReadAndWrite: [this.projectTokenRW, this.projectRO],
        tokenReadOnly: [
          this.projectTokenRW,
          this.projectTokenRO,
          this.projectRO,
        ],
        review: [this.projectReview],
      })
      const projects = await this.ProjectGetter.promises.findAllUsersProjects(
        this.userId,
        this.fields
      )

      expect(projects).to.deep.equal({
        owned: [this.projectOwned],
        readAndWrite: [this.projectRW],
        readOnly: [this.projectRO],
        tokenReadAndWrite: [this.projectTokenRW],
        tokenReadOnly: [this.projectTokenRO],
        review: [this.projectReview],
      })
    })
  })

  describe('getProjectIdByReadAndWriteToken', function () {
    describe('when project find returns project', function () {
      this.beforeEach(async function () {
        this.projectIdFound =
          await this.ProjectGetter.promises.getProjectIdByReadAndWriteToken(
            'token'
          )
      })

      it('should find project with token', function () {
        this.Project.findOne
          .calledWithMatch({ 'tokens.readAndWrite': 'token' })
          .should.equal(true)
      })

      it('should return the project id', function () {
        expect(this.projectIdFound).to.equal(this.project._id)
      })
    })

    describe('when project not found', function () {
      it('should return undefined', async function () {
        this.Project.findOne.returns({ exec: sinon.stub().resolves(null) })
        const projectId =
          await this.ProjectGetter.promises.getProjectIdByReadAndWriteToken(
            'token'
          )

        expect(projectId).to.equal(undefined)
      })
    })

    describe('when project find returns error', function () {
      this.beforeEach(async function () {
        this.Project.findOne.returns({ exec: sinon.stub().rejects() })
      })

      it('should be rejected', function () {
        expect(
          this.ProjectGetter.promises.getProjectIdByReadAndWriteToken('token')
        ).to.be.rejected
      })
    })
  })

  describe('findUsersProjectsByName', function () {
    it('should perform a case-insensitive search', async function () {
      this.project1 = { _id: 1, name: 'find me!' }
      this.project2 = { _id: 2, name: 'not me!' }
      this.project3 = { _id: 3, name: 'FIND ME!' }
      this.project4 = { _id: 4, name: 'Find Me!' }
      this.Project.find.withArgs({ owner_ref: this.userId }).returns({
        exec: sinon
          .stub()
          .resolves([
            this.project1,
            this.project2,
            this.project3,
            this.project4,
          ]),
      })
      const projects =
        await this.ProjectGetter.promises.findUsersProjectsByName(
          this.userId,
          this.project1.name
        )
      const projectNames = projects.map(project => project.name)
      expect(projectNames).to.have.members([
        this.project1.name,
        this.project3.name,
        this.project4.name,
      ])
    })

    it('should search collaborations as well', async function () {
      this.project1 = { _id: 1, name: 'find me!' }
      this.project2 = { _id: 2, name: 'FIND ME!' }
      this.project3 = { _id: 3, name: 'Find Me!' }
      this.project4 = { _id: 4, name: 'find ME!' }
      this.project5 = { _id: 5, name: 'FIND me!' }
      this.Project.find
        .withArgs({ owner_ref: this.userId })
        .returns({ exec: sinon.stub().resolves([this.project1]) })
      this.CollaboratorsGetter.promises.getProjectsUserIsMemberOf.resolves({
        readAndWrite: [this.project2],
        readOnly: [this.project3],
        tokenReadAndWrite: [this.project4],
        tokenReadOnly: [this.project5],
      })
      const projects =
        await this.ProjectGetter.promises.findUsersProjectsByName(
          this.userId,
          this.project1.name
        )
      expect(projects.map(project => project.name)).to.have.members([
        this.project1.name,
        this.project2.name,
      ])
    })
  })

  describe('getUsersDeletedProjects', function () {
    it('should look up the deleted projects by deletedProjectOwnerId', async function () {
      await this.ProjectGetter.promises.getUsersDeletedProjects('giraffe')
      sinon.assert.calledWith(this.DeletedProject.find, {
        'deleterData.deletedProjectOwnerId': 'giraffe',
      })
    })

    it('should pass the found projects to the callback', async function () {
      const docs =
        await this.ProjectGetter.promises.getUsersDeletedProjects('giraffe')
      expect(docs).to.deep.equal([this.deletedProject])
    })
  })
})
