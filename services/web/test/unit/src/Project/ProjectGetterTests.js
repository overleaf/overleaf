const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/Project/ProjectGetter.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb')

describe('ProjectGetter', function () {
  beforeEach(function () {
    this.callback = sinon.stub()
    this.project = { _id: new ObjectId() }
    this.projectIdStr = this.project._id.toString()
    this.deletedProject = { deleterData: { wombat: 'potato' } }
    this.userId = new ObjectId()

    this.DeletedProject = {
      find: sinon.stub().yields(null, [this.deletedProject]),
    }
    this.Project = {
      find: sinon.stub(),
      findOne: sinon.stub().yields(null, this.project),
    }
    this.CollaboratorsGetter = {
      getProjectsUserIsMemberOf: sinon.stub().yields(null, {
        readAndWrite: [],
        readOnly: [],
        tokenReadAndWrite: [],
        tokenReadOnly: [],
      }),
    }
    this.LockManager = {
      runWithLock: sinon
        .stub()
        .callsFake((namespace, id, runner, callback) => runner(callback)),
    }
    this.db = {
      projects: {
        findOne: sinon.stub().yields(null, this.project),
      },
      users: {},
    }
    this.ProjectEntityMongoUpdateHandler = {
      lockKey: sinon.stub().returnsArg(0),
    }
    this.ProjectGetter = SandboxedModule.require(modulePath, {
      requires: {
        '../../infrastructure/mongodb': { db: this.db, ObjectId },
        '@overleaf/metrics': {
          timeAsyncMethod: sinon.stub(),
        },
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
      this.ProjectGetter.getProject = sinon.stub().yields()
    })

    describe('passing an id', function () {
      beforeEach(function () {
        this.ProjectGetter.getProjectWithoutDocLines(
          this.project._id,
          this.callback
        )
      })

      it('should call find with the project id', function () {
        this.ProjectGetter.getProject
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

        this.ProjectGetter.getProject
          .calledWith(this.project._id, excludes)
          .should.equal(true)
      })

      it('should call the callback', function () {
        this.callback.called.should.equal(true)
      })
    })
  })

  describe('getProjectWithOnlyFolders', function () {
    beforeEach(function () {
      this.ProjectGetter.getProject = sinon.stub().yields()
    })

    describe('passing an id', function () {
      beforeEach(function () {
        this.ProjectGetter.getProjectWithOnlyFolders(
          this.project._id,
          this.callback
        )
      })

      it('should call find with the project id', function () {
        this.ProjectGetter.getProject
          .calledWith(this.project._id)
          .should.equal(true)
      })

      it('should exclude the docs and files linesaaaa', function () {
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
        this.ProjectGetter.getProject
          .calledWith(this.project._id, excludes)
          .should.equal(true)
      })

      it('should call the callback with the project', function () {
        this.callback.called.should.equal(true)
      })
    })
  })

  describe('getProject', function () {
    describe('without projection', function () {
      describe('with project id', function () {
        beforeEach(function () {
          this.ProjectGetter.getProject(this.projectIdStr, this.callback)
        })

        it('should call findOne with the project id', function () {
          expect(this.db.projects.findOne.callCount).to.equal(1)
          expect(
            this.db.projects.findOne.lastCall.args[0]._id.toString()
          ).to.equal(this.projectIdStr)
        })
      })

      describe('without project id', function () {
        beforeEach(function () {
          this.ProjectGetter.getProject(null, this.callback)
        })

        it('should callback with error', function () {
          expect(this.db.projects.findOne.callCount).to.equal(0)
          expect(this.callback.lastCall.args[0]).to.be.instanceOf(Error)
        })
      })
    })

    describe('with projection', function () {
      beforeEach(function () {
        this.projection = { _id: 1 }
      })

      describe('with project id', function () {
        beforeEach(function () {
          this.ProjectGetter.getProject(
            this.projectIdStr,
            this.projection,
            this.callback
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
        beforeEach(function () {
          this.ProjectGetter.getProject(null, this.callback)
        })

        it('should callback with error', function () {
          expect(this.db.projects.findOne.callCount).to.equal(0)
          expect(this.callback.lastCall.args[0]).to.be.instanceOf(Error)
        })
      })
    })
  })

  describe('getProjectWithoutLock', function () {
    describe('without projection', function () {
      describe('with project id', function () {
        beforeEach(function () {
          this.ProjectGetter.getProjectWithoutLock(
            this.projectIdStr,
            this.callback
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
        beforeEach(function () {
          this.ProjectGetter.getProjectWithoutLock(null, this.callback)
        })

        it('should callback with error', function () {
          expect(this.db.projects.findOne.callCount).to.equal(0)
          expect(this.callback.lastCall.args[0]).to.be.instanceOf(Error)
        })
      })
    })

    describe('with projection', function () {
      beforeEach(function () {
        this.projection = { _id: 1 }
      })

      describe('with project id', function () {
        beforeEach(function () {
          this.ProjectGetter.getProjectWithoutLock(
            this.project._id,
            this.projection,
            this.callback
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
        beforeEach(function () {
          this.ProjectGetter.getProjectWithoutLock(null, this.callback)
        })

        it('should callback with error', function () {
          expect(this.db.projects.findOne.callCount).to.equal(0)
          expect(this.callback.lastCall.args[0]).to.be.instanceOf(Error)
        })
      })
    })
  })

  describe('findAllUsersProjects', function () {
    beforeEach(function () {
      this.fields = { mock: 'fields' }
      this.projectOwned = { _id: 'mock-owned-projects' }
      this.projectRW = { _id: 'mock-rw-projects' }
      this.projectRO = { _id: 'mock-ro-projects' }
      this.projectTokenRW = { _id: 'mock-token-rw-projects' }
      this.projectTokenRO = { _id: 'mock-token-ro-projects' }
      this.Project.find
        .withArgs({ owner_ref: this.userId }, this.fields)
        .yields(null, [this.projectOwned])
    })

    it('should call the callback with all the projects', function () {
      this.CollaboratorsGetter.getProjectsUserIsMemberOf.yields(null, {
        readAndWrite: [this.projectRW],
        readOnly: [this.projectRO],
        tokenReadAndWrite: [this.projectTokenRW],
        tokenReadOnly: [this.projectTokenRO],
      })
      this.ProjectGetter.findAllUsersProjects(
        this.userId,
        this.fields,
        this.callback
      )

      this.callback
        .calledWith(null, {
          owned: [this.projectOwned],
          readAndWrite: [this.projectRW],
          readOnly: [this.projectRO],
          tokenReadAndWrite: [this.projectTokenRW],
          tokenReadOnly: [this.projectTokenRO],
        })
        .should.equal(true)
    })

    it('should remove duplicate projects', function () {
      this.CollaboratorsGetter.getProjectsUserIsMemberOf.yields(null, {
        readAndWrite: [this.projectRW, this.projectOwned],
        readOnly: [this.projectRO, this.projectRW],
        tokenReadAndWrite: [this.projectTokenRW, this.projectRO],
        tokenReadOnly: [
          this.projectTokenRW,
          this.projectTokenRO,
          this.projectRO,
        ],
      })
      this.ProjectGetter.findAllUsersProjects(
        this.userId,
        this.fields,
        this.callback
      )

      this.callback
        .calledWith(null, {
          owned: [this.projectOwned],
          readAndWrite: [this.projectRW],
          readOnly: [this.projectRO],
          tokenReadAndWrite: [this.projectTokenRW],
          tokenReadOnly: [this.projectTokenRO],
        })
        .should.equal(true)
    })
  })

  describe('getProjectIdByReadAndWriteToken', function () {
    describe('when project find returns project', function () {
      this.beforeEach(function () {
        this.ProjectGetter.getProjectIdByReadAndWriteToken(
          'token',
          this.callback
        )
      })

      it('should find project with token', function () {
        this.Project.findOne
          .calledWithMatch({ 'tokens.readAndWrite': 'token' })
          .should.equal(true)
      })

      it('should callback with project id', function () {
        this.callback.calledWith(null, this.project._id).should.equal(true)
      })
    })

    describe('when project not found', function () {
      this.beforeEach(function () {
        this.Project.findOne.yields(null, null)
        this.ProjectGetter.getProjectIdByReadAndWriteToken(
          'token',
          this.callback
        )
      })

      it('should callback empty', function () {
        expect(this.callback.firstCall.args.length).to.equal(0)
      })
    })

    describe('when project find returns error', function () {
      this.beforeEach(function () {
        this.Project.findOne.yields('error')
        this.ProjectGetter.getProjectIdByReadAndWriteToken(
          'token',
          this.callback
        )
      })

      it('should callback with error', function () {
        this.callback.calledWith('error').should.equal(true)
      })
    })
  })

  describe('findUsersProjectsByName', function () {
    it('should perform a case-insensitive search', function (done) {
      this.project1 = { _id: 1, name: 'find me!' }
      this.project2 = { _id: 2, name: 'not me!' }
      this.project3 = { _id: 3, name: 'FIND ME!' }
      this.project4 = { _id: 4, name: 'Find Me!' }
      this.Project.find
        .withArgs({ owner_ref: this.userId })
        .yields(null, [
          this.project1,
          this.project2,
          this.project3,
          this.project4,
        ])
      this.ProjectGetter.findUsersProjectsByName(
        this.userId,
        this.project1.name,
        (err, projects) => {
          if (err != null) {
            return done(err)
          }
          const projectNames = projects.map(project => project.name)
          expect(projectNames).to.have.members([
            this.project1.name,
            this.project3.name,
            this.project4.name,
          ])
          done()
        }
      )
    })

    it('should search collaborations as well', function (done) {
      this.project1 = { _id: 1, name: 'find me!' }
      this.project2 = { _id: 2, name: 'FIND ME!' }
      this.project3 = { _id: 3, name: 'Find Me!' }
      this.project4 = { _id: 4, name: 'find ME!' }
      this.project5 = { _id: 5, name: 'FIND me!' }
      this.Project.find
        .withArgs({ owner_ref: this.userId })
        .yields(null, [this.project1])
      this.CollaboratorsGetter.getProjectsUserIsMemberOf.yields(null, {
        readAndWrite: [this.project2],
        readOnly: [this.project3],
        tokenReadAndWrite: [this.project4],
        tokenReadOnly: [this.project5],
      })
      this.ProjectGetter.findUsersProjectsByName(
        this.userId,
        this.project1.name,
        (err, projects) => {
          if (err != null) {
            return done(err)
          }
          expect(projects.map(project => project.name)).to.have.members([
            this.project1.name,
            this.project2.name,
          ])
          done()
        }
      )
    })
  })

  describe('getUsersDeletedProjects', function () {
    it('should look up the deleted projects by deletedProjectOwnerId', function (done) {
      this.ProjectGetter.getUsersDeletedProjects('giraffe', err => {
        if (err) {
          return done(err)
        }
        sinon.assert.calledWith(this.DeletedProject.find, {
          'deleterData.deletedProjectOwnerId': 'giraffe',
        })
        done()
      })
    })

    it('should pass the found projects to the callback', function (done) {
      this.ProjectGetter.getUsersDeletedProjects('giraffe', (err, docs) => {
        if (err) {
          return done(err)
        }
        expect(docs).to.deep.equal([this.deletedProject])
        done()
      })
    })
  })
})
