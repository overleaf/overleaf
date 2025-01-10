/* eslint-disable mocha/handle-done-callback */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const { ObjectId } = require('mongodb-legacy')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')

const MODULE_PATH = '../../../../app/src/Features/Editor/EditorHttpController'

describe('EditorHttpController', function () {
  beforeEach(function () {
    this.ownerId = new ObjectId()
    this.project = {
      _id: new ObjectId(),
      owner_ref: this.ownerId,
    }
    this.user = {
      _id: new ObjectId(),
      projects: {},
    }
    this.projectView = {
      _id: this.project._id,
      owner: {
        _id: 'owner',
        email: 'owner@example.com',
        other_property: true,
      },
      members: [{ one: 1 }, { two: 2 }],
      invites: [{ three: 3 }, { four: 4 }],
    }
    this.reducedProjectView = {
      _id: this.projectView._id,
      owner: { _id: this.projectView.owner._id },
      members: [],
      invites: [],
    }
    this.doc = { _id: new ObjectId(), name: 'excellent-original-idea.tex' }
    this.file = { _id: new ObjectId() }
    this.folder = { _id: new ObjectId() }
    this.source = 'editor'

    this.parentFolderId = 'mock-folder-id'
    this.req = new MockRequest()
    this.res = new MockResponse()
    this.next = sinon.stub()
    this.token = null
    this.docLines = ['hello', 'overleaf']

    this.AuthorizationManager = {
      isRestrictedUser: sinon.stub().returns(false),
      promises: {
        getPrivilegeLevelForProject: sinon.stub().resolves('owner'),
      },
    }
    this.CollaboratorsGetter = {
      promises: {
        getInvitedMembersWithPrivilegeLevels: sinon
          .stub()
          .resolves(['members', 'mock']),
        isUserInvitedMemberOfProject: sinon.stub().resolves(false),
      },
    }
    this.CollaboratorsHandler = {
      promises: {
        userIsTokenMember: sinon.stub().resolves(false),
      },
    }
    this.CollaboratorsInviteGetter = {
      promises: {
        getAllInvites: sinon.stub().resolves([
          {
            _id: 'invite_one',
            email: 'user-one@example.com',
            privileges: 'readOnly',
            projectId: this.project._id,
          },
          {
            _id: 'invite_two',
            email: 'user-two@example.com',
            privileges: 'readOnly',
            projectId: this.project._id,
          },
        ]),
      },
    }
    this.EditorController = {
      promises: {
        addDoc: sinon.stub().resolves(this.doc),
        addFile: sinon.stub().resolves(this.file),
        addFolder: sinon.stub().resolves(this.folder),
        renameEntity: sinon.stub().resolves(),
        moveEntity: sinon.stub().resolves(),
        deleteEntity: sinon.stub().resolves(),
      },
    }
    this.ProjectDeleter = {
      promises: {
        unmarkAsDeletedByExternalSource: sinon.stub().resolves(),
      },
    }
    this.ProjectGetter = {
      promises: {
        getProjectWithoutDocLines: sinon.stub().resolves(this.project),
      },
    }
    this.ProjectEditorHandler = {
      buildProjectModelView: sinon.stub().returns(this.projectView),
    }
    this.Metrics = { inc: sinon.stub() }
    this.TokenAccessHandler = {
      getRequestToken: sinon.stub().returns(this.token),
    }
    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(this.user._id),
    }
    this.ProjectEntityUpdateHandler = {
      promises: {
        convertDocToFile: sinon.stub().resolves(this.file),
      },
    }
    this.DocstoreManager = {
      promises: {
        getAllDeletedDocs: sinon.stub().resolves([]),
      },
    }
    this.HttpErrorHandler = {
      notFound: sinon.stub(),
      unprocessableEntity: sinon.stub(),
    }
    this.SplitTestHandler = {
      promises: {
        getAssignmentForUser: sinon.stub().resolves({ variant: 'default' }),
      },
    }
    this.UserGetter = { promises: { getUser: sinon.stub().resolves(null, {}) } }
    this.EditorHttpController = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../Project/ProjectDeleter': this.ProjectDeleter,
        '../Project/ProjectGetter': this.ProjectGetter,
        '../Authorization/AuthorizationManager': this.AuthorizationManager,
        '../Project/ProjectEditorHandler': this.ProjectEditorHandler,
        './EditorController': this.EditorController,
        '@overleaf/metrics': this.Metrics,
        '../Collaborators/CollaboratorsGetter': this.CollaboratorsGetter,
        '../Collaborators/CollaboratorsHandler': this.CollaboratorsHandler,
        '../Collaborators/CollaboratorsInviteGetter':
          this.CollaboratorsInviteGetter,
        '../TokenAccess/TokenAccessHandler': this.TokenAccessHandler,
        '../Authentication/SessionManager': this.SessionManager,
        '../../infrastructure/FileWriter': this.FileWriter,
        '../Project/ProjectEntityUpdateHandler':
          this.ProjectEntityUpdateHandler,
        '../Docstore/DocstoreManager': this.DocstoreManager,
        '../Errors/HttpErrorHandler': this.HttpErrorHandler,
        '../SplitTests/SplitTestHandler': this.SplitTestHandler,
        '../Compile/CompileManager': {},
        '../User/UserGetter': this.UserGetter,
      },
    })
  })

  describe('joinProject', function () {
    beforeEach(function () {
      this.req.params = { Project_id: this.project._id }
      this.req.query = { user_id: this.user._id }
      this.req.body = { userId: this.user._id }
    })

    describe('successfully', function () {
      beforeEach(function (done) {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.resolves(
          true
        )
        this.res.callback = done
        this.EditorHttpController.joinProject(this.req, this.res)
      })

      it('should return the project and privilege level', function () {
        expect(this.res.json).to.have.been.calledWith({
          project: this.projectView,
          privilegeLevel: 'owner',
          isRestrictedUser: false,
          isTokenMember: false,
          isInvitedMember: true,
        })
      })

      it('should not try to unmark the project as deleted', function () {
        expect(this.ProjectDeleter.promises.unmarkAsDeletedByExternalSource).not
          .to.have.been.called
      })

      it('should send an inc metric', function () {
        expect(this.Metrics.inc).to.have.been.calledWith('editor.join-project')
      })
    })

    describe('when the project is marked as deleted', function () {
      beforeEach(function (done) {
        this.projectView.deletedByExternalDataSource = true
        this.res.callback = done
        this.EditorHttpController.joinProject(this.req, this.res)
      })

      it('should unmark the project as deleted', function () {
        expect(
          this.ProjectDeleter.promises.unmarkAsDeletedByExternalSource
        ).to.have.been.calledWith(this.project._id)
      })
    })

    describe('with a restricted user', function () {
      beforeEach(function (done) {
        this.AuthorizationManager.isRestrictedUser.returns(true)
        this.AuthorizationManager.promises.getPrivilegeLevelForProject.resolves(
          'readOnly'
        )
        this.res.callback = done
        this.EditorHttpController.joinProject(this.req, this.res)
      })

      it('should mark the user as restricted, and hide details of owner', function () {
        expect(this.res.json).to.have.been.calledWith({
          project: this.reducedProjectView,
          privilegeLevel: 'readOnly',
          isRestrictedUser: true,
          isTokenMember: false,
          isInvitedMember: false,
        })
      })
    })

    describe('when not authorized', function () {
      beforeEach(function (done) {
        this.AuthorizationManager.promises.getPrivilegeLevelForProject.resolves(
          null
        )
        this.res.callback = done
        this.EditorHttpController.joinProject(this.req, this.res)
      })

      it('should send a 403 response', function () {
        expect(this.res.statusCode).to.equal(403)
      })
    })

    describe('with an anonymous user', function () {
      beforeEach(function (done) {
        this.token = 'token'
        this.TokenAccessHandler.getRequestToken.returns(this.token)
        this.req.body = {
          userId: 'anonymous-user',
          anonymousAccessToken: this.token,
        }
        this.res.callback = done
        this.AuthorizationManager.isRestrictedUser
          .withArgs(null, 'readOnly', false, false)
          .returns(true)
        this.AuthorizationManager.promises.getPrivilegeLevelForProject
          .withArgs(null, this.project._id, this.token)
          .resolves('readOnly')
        this.EditorHttpController.joinProject(this.req, this.res)
      })

      it('should mark the user as restricted', function () {
        expect(this.res.json).to.have.been.calledWith({
          project: this.reducedProjectView,
          privilegeLevel: 'readOnly',
          isRestrictedUser: true,
          isTokenMember: false,
          isInvitedMember: false,
        })
      })
    })

    describe('with a token access user', function () {
      beforeEach(function (done) {
        this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.resolves(
          false
        )
        this.CollaboratorsHandler.promises.userIsTokenMember.resolves(true)
        this.AuthorizationManager.promises.getPrivilegeLevelForProject.resolves(
          'readAndWrite'
        )
        this.res.callback = done
        this.EditorHttpController.joinProject(this.req, this.res)
      })

      it('should mark the user as being a token-access member', function () {
        expect(this.res.json).to.have.been.calledWith({
          project: this.projectView,
          privilegeLevel: 'readAndWrite',
          isRestrictedUser: false,
          isTokenMember: true,
          isInvitedMember: false,
        })
      })
    })

    describe('when project is not found', function () {
      beforeEach(function (done) {
        this.ProjectGetter.promises.getProjectWithoutDocLines.resolves(null)
        this.next.callsFake(() => done())
        this.EditorHttpController.joinProject(this.req, this.res, this.next)
      })

      it('should handle return not found error', function () {
        expect(this.next).to.have.been.calledWith(
          sinon.match.instanceOf(Errors.NotFoundError)
        )
      })
    })
  })

  describe('addDoc', function () {
    beforeEach(function () {
      this.req.params = { Project_id: this.project._id }
      this.req.body = {
        name: (this.name = 'doc-name'),
        parent_folder_id: this.parentFolderId,
      }
    })

    describe('successfully', function () {
      beforeEach(function (done) {
        this.res.callback = done
        this.EditorHttpController.addDoc(this.req, this.res)
      })

      it('should call EditorController.addDoc', function () {
        expect(this.EditorController.promises.addDoc).to.have.been.calledWith(
          this.project._id,
          this.parentFolderId,
          this.name,
          [],
          'editor',
          this.user._id
        )
      })

      it('should send the doc back as JSON', function () {
        expect(this.res.json).to.have.been.calledWith(this.doc)
      })
    })

    describe('unsuccesfully', function () {
      it('handle name too short', function (done) {
        this.req.body.name = ''
        this.res.callback = () => {
          expect(this.res.statusCode).to.equal(400)
          done()
        }
        this.EditorHttpController.addDoc(this.req, this.res)
      })

      it('handle too many files', function (done) {
        this.EditorController.promises.addDoc.rejects(
          new Error('project_has_too_many_files')
        )
        this.res.callback = () => {
          expect(this.res.body).to.equal('"project_has_too_many_files"')
          expect(this.res.status).to.have.been.calledWith(400)
          done()
        }
        this.EditorHttpController.addDoc(this.req, this.res)
      })
    })
  })

  describe('addFolder', function () {
    beforeEach(function () {
      this.folderName = 'folder-name'
      this.req.params = { Project_id: this.project._id }
      this.req.body = {
        name: this.folderName,
        parent_folder_id: this.parentFolderId,
      }
    })

    describe('successfully', function () {
      beforeEach(function (done) {
        this.res.callback = done
        this.EditorHttpController.addFolder(this.req, this.res)
      })

      it('should call EditorController.addFolder', function () {
        expect(
          this.EditorController.promises.addFolder
        ).to.have.been.calledWith(
          this.project._id,
          this.parentFolderId,
          this.folderName,
          'editor'
        )
      })

      it('should send the folder back as JSON', function () {
        expect(this.res.json).to.have.been.calledWith(this.folder)
      })
    })

    describe('unsuccesfully', function () {
      it('handle name too short', function (done) {
        this.req.body.name = ''
        this.res.callback = () => {
          expect(this.res.statusCode).to.equal(400)
          done()
        }
        this.EditorHttpController.addFolder(this.req, this.res)
      })

      it('handle too many files', function (done) {
        this.EditorController.promises.addFolder.rejects(
          new Error('project_has_too_many_files')
        )
        this.res.callback = () => {
          expect(this.res.body).to.equal('"project_has_too_many_files"')
          expect(this.res.statusCode).to.equal(400)
          done()
        }
        this.EditorHttpController.addFolder(this.req, this.res)
      })

      it('handle invalid element name', function (done) {
        this.EditorController.promises.addFolder.rejects(
          new Error('invalid element name')
        )
        this.res.callback = () => {
          expect(this.res.body).to.equal('"invalid_file_name"')
          expect(this.res.statusCode).to.equal(400)
          done()
        }
        this.EditorHttpController.addFolder(this.req, this.res)
      })
    })
  })

  describe('renameEntity', function () {
    beforeEach(function () {
      this.entityId = 'entity-id-123'
      this.entityType = 'entity-type'
      this.req.params = {
        Project_id: this.project._id,
        entity_id: this.entityId,
        entity_type: this.entityType,
      }
    })

    describe('successfully', function () {
      beforeEach(function (done) {
        this.newName = 'new-name'
        this.req.body = { name: this.newName, source: this.source }
        this.res.callback = done
        this.EditorHttpController.renameEntity(this.req, this.res)
      })

      it('should call EditorController.renameEntity', function () {
        expect(
          this.EditorController.promises.renameEntity
        ).to.have.been.calledWith(
          this.project._id,
          this.entityId,
          this.entityType,
          this.newName,
          this.user._id,
          this.source
        )
      })

      it('should send back a success response', function () {
        expect(this.res.sendStatus).to.have.been.calledWith(204)
      })
    })
    describe('with long name', function () {
      beforeEach(function () {
        this.newName = 'long'.repeat(100)
        this.req.body = { name: this.newName, source: this.source }
        this.EditorHttpController.renameEntity(this.req, this.res)
      })

      it('should send back a bad request status code', function () {
        expect(this.res.statusCode).to.equal(400)
      })
    })

    describe('with 0 length name', function () {
      beforeEach(function () {
        this.newName = ''
        this.req.body = { name: this.newName, source: this.source }
        this.EditorHttpController.renameEntity(this.req, this.res)
      })

      it('should send back a bad request status code', function () {
        expect(this.res.statusCode).to.equal(400)
      })
    })
  })

  describe('moveEntity', function () {
    beforeEach(function (done) {
      this.entityId = 'entity-id-123'
      this.entityType = 'entity-type'
      this.folderId = 'folder-id-123'
      this.req.params = {
        Project_id: this.project._id,
        entity_id: this.entityId,
        entity_type: this.entityType,
      }
      this.req.body = { folder_id: this.folderId, source: this.source }
      this.res.callback = done
      this.EditorHttpController.moveEntity(this.req, this.res)
    })

    it('should call EditorController.moveEntity', function () {
      expect(this.EditorController.promises.moveEntity).to.have.been.calledWith(
        this.project._id,
        this.entityId,
        this.folderId,
        this.entityType,
        this.user._id,
        this.source
      )
    })

    it('should send back a success response', function () {
      expect(this.res.statusCode).to.equal(204)
    })
  })

  describe('deleteEntity', function () {
    beforeEach(function (done) {
      this.entityId = 'entity-id-123'
      this.entityType = 'entity-type'
      this.req.params = {
        Project_id: this.project._id,
        entity_id: this.entityId,
        entity_type: this.entityType,
      }
      this.res.callback = done
      this.EditorHttpController.deleteEntity(this.req, this.res)
    })

    it('should call EditorController.deleteEntity', function () {
      expect(
        this.EditorController.promises.deleteEntity
      ).to.have.been.calledWith(
        this.project._id,
        this.entityId,
        this.entityType,
        'editor',
        this.user._id
      )
    })

    it('should send back a success response', function () {
      expect(this.res.statusCode).to.equal(204)
    })
  })
})
