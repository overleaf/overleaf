/* eslint-disable
    camelcase,
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
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/Features/Project/ProjectGetter.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongojs')
const { assert } = require('chai')

describe('ProjectGetter', function() {
  beforeEach(function() {
    this.callback = sinon.stub()
    this.deletedProject = { deleterData: { wombat: 'potato' } }
    this.DeletedProject = {
      find: sinon.stub().yields(null, [this.deletedProject])
    }
    return (this.ProjectGetter = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../infrastructure/mongojs': {
          db: (this.db = {
            projects: {},
            users: {}
          }),
          ObjectId
        },
        'metrics-sharelatex': {
          timeAsyncMethod: sinon.stub()
        },
        '../../models/Project': {
          Project: (this.Project = {})
        },
        '../../models/DeletedProject': {
          DeletedProject: this.DeletedProject
        },
        '../Collaborators/CollaboratorsHandler': (this.CollaboratorsHandler = {}),
        '../../infrastructure/LockManager': (this.LockManager = {
          runWithLock: sinon.spy((namespace, id, runner, callback) =>
            runner(callback)
          )
        }),
        './ProjectEntityMongoUpdateHandler': {
          lockKey(project_id) {
            return project_id
          }
        },
        'logger-sharelatex': {
          err() {},
          log() {}
        }
      }
    }))
  })

  describe('getProjectWithoutDocLines', function() {
    beforeEach(function() {
      this.project = { _id: (this.project_id = '56d46b0a1d3422b87c5ebcb1') }
      return (this.ProjectGetter.getProject = sinon.stub().yields())
    })

    describe('passing an id', function() {
      beforeEach(function() {
        return this.ProjectGetter.getProjectWithoutDocLines(
          this.project_id,
          this.callback
        )
      })

      it('should call find with the project id', function() {
        return this.ProjectGetter.getProject
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should exclude the doc lines', function() {
        const excludes = {
          'rootFolder.docs.lines': 0,
          'rootFolder.folders.docs.lines': 0,
          'rootFolder.folders.folders.docs.lines': 0,
          'rootFolder.folders.folders.folders.docs.lines': 0,
          'rootFolder.folders.folders.folders.folders.docs.lines': 0,
          'rootFolder.folders.folders.folders.folders.folders.docs.lines': 0,
          'rootFolder.folders.folders.folders.folders.folders.folders.docs.lines': 0,
          'rootFolder.folders.folders.folders.folders.folders.folders.folders.docs.lines': 0
        }

        return this.ProjectGetter.getProject
          .calledWith(this.project_id, excludes)
          .should.equal(true)
      })

      it('should call the callback', function() {
        return this.callback.called.should.equal(true)
      })
    })
  })

  describe('getProjectWithOnlyFolders', function() {
    beforeEach(function() {
      this.project = { _id: (this.project_id = '56d46b0a1d3422b87c5ebcb1') }
      return (this.ProjectGetter.getProject = sinon.stub().yields())
    })

    describe('passing an id', function() {
      beforeEach(function() {
        return this.ProjectGetter.getProjectWithOnlyFolders(
          this.project_id,
          this.callback
        )
      })

      it('should call find with the project id', function() {
        return this.ProjectGetter.getProject
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should exclude the docs and files linesaaaa', function() {
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
          'rootFolder.folders.folders.folders.folders.folders.folders.folders.fileRefs': 0
        }
        return this.ProjectGetter.getProject
          .calledWith(this.project_id, excludes)
          .should.equal(true)
      })

      it('should call the callback with the project', function() {
        return this.callback.called.should.equal(true)
      })
    })
  })

  describe('getProject', function() {
    beforeEach(function() {
      this.project = { _id: (this.project_id = '56d46b0a1d3422b87c5ebcb1') }
      return (this.db.projects.find = sinon
        .stub()
        .callsArgWith(2, null, [this.project]))
    })

    describe('without projection', function() {
      describe('with project id', function() {
        beforeEach(function() {
          return this.ProjectGetter.getProject(this.project_id, this.callback)
        })

        it('should call find with the project id', function() {
          expect(this.db.projects.find.callCount).to.equal(1)
          return expect(this.db.projects.find.lastCall.args[0]).to.deep.equal({
            _id: ObjectId(this.project_id)
          })
        })
      })

      describe('without project id', function() {
        beforeEach(function() {
          return this.ProjectGetter.getProject(null, this.callback)
        })

        it('should callback with error', function() {
          expect(this.db.projects.find.callCount).to.equal(0)
          return expect(this.callback.lastCall.args[0]).to.be.instanceOf(Error)
        })
      })
    })

    describe('with projection', function() {
      beforeEach(function() {
        return (this.projection = { _id: 1 })
      })

      describe('with project id', function() {
        beforeEach(function() {
          return this.ProjectGetter.getProject(
            this.project_id,
            this.projection,
            this.callback
          )
        })

        it('should call find with the project id', function() {
          expect(this.db.projects.find.callCount).to.equal(1)
          expect(this.db.projects.find.lastCall.args[0]).to.deep.equal({
            _id: ObjectId(this.project_id)
          })
          return expect(this.db.projects.find.lastCall.args[1]).to.deep.equal(
            this.projection
          )
        })
      })

      describe('without project id', function() {
        beforeEach(function() {
          return this.ProjectGetter.getProject(null, this.callback)
        })

        it('should callback with error', function() {
          expect(this.db.projects.find.callCount).to.equal(0)
          return expect(this.callback.lastCall.args[0]).to.be.instanceOf(Error)
        })
      })
    })
  })

  describe('getProjectWithoutLock', function() {
    beforeEach(function() {
      this.project = { _id: (this.project_id = '56d46b0a1d3422b87c5ebcb1') }
      return (this.db.projects.find = sinon
        .stub()
        .callsArgWith(2, null, [this.project]))
    })

    describe('without projection', function() {
      describe('with project id', function() {
        beforeEach(function() {
          return this.ProjectGetter.getProjectWithoutLock(
            this.project_id,
            this.callback
          )
        })

        it('should call find with the project id', function() {
          expect(this.db.projects.find.callCount).to.equal(1)
          return expect(this.db.projects.find.lastCall.args[0]).to.deep.equal({
            _id: ObjectId(this.project_id)
          })
        })
      })

      describe('without project id', function() {
        beforeEach(function() {
          return this.ProjectGetter.getProjectWithoutLock(null, this.callback)
        })

        it('should callback with error', function() {
          expect(this.db.projects.find.callCount).to.equal(0)
          return expect(this.callback.lastCall.args[0]).to.be.instanceOf(Error)
        })
      })
    })

    describe('with projection', function() {
      beforeEach(function() {
        return (this.projection = { _id: 1 })
      })

      describe('with project id', function() {
        beforeEach(function() {
          return this.ProjectGetter.getProjectWithoutLock(
            this.project_id,
            this.projection,
            this.callback
          )
        })

        it('should call find with the project id', function() {
          expect(this.db.projects.find.callCount).to.equal(1)
          expect(this.db.projects.find.lastCall.args[0]).to.deep.equal({
            _id: ObjectId(this.project_id)
          })
          return expect(this.db.projects.find.lastCall.args[1]).to.deep.equal(
            this.projection
          )
        })
      })

      describe('without project id', function() {
        beforeEach(function() {
          return this.ProjectGetter.getProjectWithoutLock(null, this.callback)
        })

        it('should callback with error', function() {
          expect(this.db.projects.find.callCount).to.equal(0)
          return expect(this.callback.lastCall.args[0]).to.be.instanceOf(Error)
        })
      })
    })
  })

  describe('findAllUsersProjects', function() {
    beforeEach(function() {
      this.fields = { mock: 'fields' }
      this.Project.find = sinon.stub()
      this.Project.find
        .withArgs({ owner_ref: this.user_id }, this.fields)
        .yields(null, ['mock-owned-projects'])
      this.CollaboratorsHandler.getProjectsUserIsMemberOf = sinon.stub()
      this.CollaboratorsHandler.getProjectsUserIsMemberOf
        .withArgs(this.user_id, this.fields)
        .yields(null, {
          readAndWrite: ['mock-rw-projects'],
          readOnly: ['mock-ro-projects'],
          tokenReadAndWrite: ['mock-token-rw-projects'],
          tokenReadOnly: ['mock-token-ro-projects']
        })
      return this.ProjectGetter.findAllUsersProjects(
        this.user_id,
        this.fields,
        this.callback
      )
    })

    it('should call the callback with all the projects', function() {
      return this.callback
        .calledWith(null, {
          owned: ['mock-owned-projects'],
          readAndWrite: ['mock-rw-projects'],
          readOnly: ['mock-ro-projects'],
          tokenReadAndWrite: ['mock-token-rw-projects'],
          tokenReadOnly: ['mock-token-ro-projects']
        })
        .should.equal(true)
    })
  })

  describe('getProjectIdByReadAndWriteToken', function() {
    describe('when project find returns project', function() {
      this.beforeEach(function() {
        this.Project.findOne = sinon.stub().yields(null, { _id: 'project-id' })
        return this.ProjectGetter.getProjectIdByReadAndWriteToken(
          'token',
          this.callback
        )
      })

      it('should find project with token', function() {
        return this.Project.findOne
          .calledWithMatch({ 'tokens.readAndWrite': 'token' })
          .should.equal(true)
      })

      it('should callback with project id', function() {
        return this.callback.calledWith(null, 'project-id').should.equal(true)
      })
    })

    describe('when project not found', function() {
      this.beforeEach(function() {
        this.Project.findOne = sinon.stub().yields()
        return this.ProjectGetter.getProjectIdByReadAndWriteToken(
          'token',
          this.callback
        )
      })

      it('should callback empty', function() {
        return expect(this.callback.firstCall.args.length).to.equal(0)
      })
    })

    describe('when project find returns error', function() {
      this.beforeEach(function() {
        this.Project.findOne = sinon.stub().yields('error')
        return this.ProjectGetter.getProjectIdByReadAndWriteToken(
          'token',
          this.callback
        )
      })

      it('should callback with error', function() {
        return this.callback.calledWith('error').should.equal(true)
      })
    })
  })

  describe('getUsersDeletedProjects', function() {
    it('should look up the deleted projects by deletedProjectOwnerId', function(done) {
      this.ProjectGetter.getUsersDeletedProjects('giraffe', err => {
        if (err) {
          return done(err)
        }
        sinon.assert.calledWith(this.DeletedProject.find, {
          'deleterData.deletedProjectOwnerId': 'giraffe'
        })
        done()
      })
    })

    it('should pass the found projects to the callback', function(done) {
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
