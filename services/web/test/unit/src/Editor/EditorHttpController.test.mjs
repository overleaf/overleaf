import { beforeEach, describe, it, vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'

const { ObjectId } = mongodb

const MODULE_PATH =
  '../../../../app/src/Features/Editor/EditorHttpController.mjs'

describe('EditorHttpController', function () {
  beforeEach(async function (ctx) {
    ctx.ownerId = new ObjectId()
    ctx.project = {
      _id: new ObjectId(),
      owner_ref: ctx.ownerId,
    }
    ctx.user = {
      _id: new ObjectId(),
      projects: {},
    }
    ctx.members = [
      { user: { _id: 'owner', features: {} }, privilegeLevel: 'owner' },
      { user: { _id: 'one' }, privilegeLevel: 'readOnly' },
    ]
    ctx.ownerMember = ctx.members[0]
    ctx.invites = [{ _id: 'three' }, { _id: 'four' }]
    ctx.projectView = {
      _id: ctx.project._id,
      owner: {
        _id: 'owner',
        email: 'owner@example.com',
        other_property: true,
      },
      members: [
        { _id: 'owner', privileges: 'owner' },
        { _id: 'one', privileges: 'readOnly' },
      ],
      invites: [{ three: 3 }, { four: 4 }],
    }
    ctx.reducedProjectView = {
      _id: ctx.projectView._id,
      owner: { _id: ctx.projectView.owner._id },
      members: [],
      invites: [],
    }
    ctx.doc = { _id: new ObjectId(), name: 'excellent-original-idea.tex' }
    ctx.file = { _id: new ObjectId() }
    ctx.folder = { _id: new ObjectId() }
    ctx.source = 'editor'

    ctx.parentFolderId = 'mock-folder-id'
    ctx.req = new MockRequest(vi)
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub()
    ctx.token = null
    ctx.docLines = ['hello', 'overleaf']

    ctx.AuthorizationManager = {
      isRestrictedUser: sinon.stub().returns(false),
      promises: {
        getPrivilegeLevelForProjectWithProjectAccess: sinon
          .stub()
          .resolves('owner'),
      },
    }
    const members = ctx.members
    const ownerMember = ctx.ownerMember
    ctx.CollaboratorsGetter = {
      ProjectAccess: class {
        loadOwnerAndInvitedMembers() {
          return { members, ownerMember }
        }

        loadOwner() {
          return ownerMember
        }

        isUserTokenMember() {
          return false
        }

        isUserInvitedMember() {
          return false
        }
      },
      promises: {
        isUserInvitedMemberOfProject: sinon.stub().resolves(false),
      },
    }
    ctx.CollaboratorsHandler = {
      promises: {
        userIsTokenMember: sinon.stub().resolves(false),
      },
    }
    ctx.invites = [
      {
        _id: 'invite_one',
        email: 'user-one@example.com',
        privileges: 'readOnly',
        projectId: ctx.project._id,
      },
      {
        _id: 'invite_two',
        email: 'user-two@example.com',
        privileges: 'readOnly',
        projectId: ctx.project._id,
      },
    ]
    ctx.CollaboratorsInviteGetter = {
      promises: {
        getAllInvites: sinon.stub().resolves(ctx.invites),
      },
    }
    ctx.EditorController = {
      promises: {
        addDoc: sinon.stub().resolves(ctx.doc),
        addFile: sinon.stub().resolves(ctx.file),
        addFolder: sinon.stub().resolves(ctx.folder),
        renameEntity: sinon.stub().resolves(),
        moveEntity: sinon.stub().resolves(),
        deleteEntity: sinon.stub().resolves(),
      },
    }
    ctx.ProjectDeleter = {
      promises: {
        unmarkAsDeletedByExternalSource: sinon.stub().resolves(),
      },
    }
    ctx.ProjectGetter = {
      promises: {
        getProjectWithoutDocLines: sinon.stub().resolves(ctx.project),
      },
    }
    ctx.ProjectEditorHandler = {
      buildProjectModelView: sinon.stub().returns(ctx.projectView),
    }
    ctx.Metrics = { inc: sinon.stub() }
    ctx.TokenAccessHandler = {
      getRequestToken: sinon.stub().returns(ctx.token),
    }
    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(ctx.user._id),
    }
    ctx.ProjectEntityUpdateHandler = {
      promises: {
        convertDocToFile: sinon.stub().resolves(ctx.file),
      },
    }
    ctx.DocstoreManager = {
      promises: {
        getAllDeletedDocs: sinon.stub().resolves([]),
      },
    }
    ctx.HttpErrorHandler = {
      notFound: sinon.stub(),
      unprocessableEntity: sinon.stub(),
    }
    ctx.SplitTestHandler = {
      promises: {
        getAssignmentForUser: sinon.stub().resolves({ variant: 'default' }),
      },
    }
    ctx.UserGetter = { promises: { getUser: sinon.stub().resolves(null, {}) } }

    vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
      vi.importActual('../../../../app/src/Features/Errors/Errors.js')
    )
    vi.doMock(
      '../../../../app/src/Features/Project/ProjectDeleter.mjs',
      () => ({
        default: ctx.ProjectDeleter,
      })
    )
    vi.doMock('../../../../app/src/Features/Project/ProjectGetter.mjs', () => ({
      default: ctx.ProjectGetter,
    }))
    vi.doMock(
      '../../../../app/src/Features/Authorization/AuthorizationManager.mjs',
      () => ({
        default: ctx.AuthorizationManager,
      })
    )
    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEditorHandler.mjs',
      () => ({
        default: ctx.ProjectEditorHandler,
      })
    )
    vi.doMock(
      '../../../../app/src/Features/Editor/EditorController.mjs',
      () => ({
        default: ctx.EditorController,
      })
    )
    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.Metrics,
    }))
    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter.mjs',
      () => ({
        default: ctx.CollaboratorsGetter,
      })
    )
    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsHandler.mjs',
      () => ({
        default: ctx.CollaboratorsHandler,
      })
    )
    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsInviteGetter.mjs',
      () => ({
        default: ctx.CollaboratorsInviteGetter,
      })
    )
    vi.doMock(
      '../../../../app/src/Features/TokenAccess/TokenAccessHandler.mjs',
      () => ({
        default: ctx.TokenAccessHandler,
      })
    )
    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager.mjs',
      () => ({
        default: ctx.SessionManager,
      })
    )
    vi.doMock('../../../../app/src/infrastructure/FileWriter.mjs', () => ({
      default: ctx.FileWriter,
    }))
    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityUpdateHandler.mjs',
      () => ({
        default: ctx.ProjectEntityUpdateHandler,
      })
    )
    vi.doMock(
      '../../../../app/src/Features/Docstore/DocstoreManager.mjs',
      () => ({
        default: ctx.DocstoreManager,
      })
    )
    vi.doMock(
      '../../../../app/src/Features/Errors/HttpErrorHandler.mjs',
      () => ({
        default: ctx.HttpErrorHandler,
      })
    )
    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler.mjs',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )
    vi.doMock(
      '../../../../app/src/Features/Compile/CompileManager.mjs',
      () => ({
        default: {},
      })
    )
    vi.doMock('../../../../app/src/Features/User/UserGetter.mjs', () => ({
      default: ctx.UserGetter,
    }))

    ctx.EditorHttpController = (await import(MODULE_PATH)).default
  })

  describe('joinProject', function () {
    beforeEach(function (ctx) {
      ctx.req.params = { Project_id: ctx.project._id.toString() }
      ctx.req.query = { user_id: ctx.user._id }
      ctx.req.body = { userId: ctx.user._id.toString() }
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          sinon
            .stub(
              ctx.CollaboratorsGetter.ProjectAccess.prototype,
              'isUserInvitedMember'
            )
            .returns(true)
          ctx.res.callback = resolve
          ctx.EditorHttpController.joinProject(ctx.req, ctx.res)
        })
      })

      it('should request a full view', function (ctx) {
        expect(
          ctx.ProjectEditorHandler.buildProjectModelView
        ).to.have.been.calledWith(
          ctx.project,
          ctx.ownerMember,
          ctx.members,
          ctx.invites,
          false
        )
      })

      it('should return the project and privilege level', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledWith({
          project: ctx.projectView,
          privilegeLevel: 'owner',
          isRestrictedUser: false,
          isTokenMember: false,
          isInvitedMember: true,
        })
      })

      it('should not try to unmark the project as deleted', function (ctx) {
        expect(ctx.ProjectDeleter.promises.unmarkAsDeletedByExternalSource).not
          .to.have.been.called
      })

      it('should send an inc metric', function (ctx) {
        expect(ctx.Metrics.inc).to.have.been.calledWith('editor.join-project')
      })
    })

    describe('when the project is marked as deleted', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.projectView.deletedByExternalDataSource = true
          ctx.res.callback = resolve
          ctx.EditorHttpController.joinProject(ctx.req, ctx.res)
        })
      })

      it('should unmark the project as deleted', function (ctx) {
        expect(
          ctx.ProjectDeleter.promises.unmarkAsDeletedByExternalSource
        ).to.have.been.calledWith(ctx.project._id.toString())
      })
    })

    describe('with a restricted user', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectEditorHandler.buildProjectModelView.returns(
          ctx.reducedProjectView
        )
        ctx.AuthorizationManager.isRestrictedUser.returns(true)
        ctx.AuthorizationManager.promises.getPrivilegeLevelForProjectWithProjectAccess.resolves(
          'readOnly'
        )
        await new Promise(resolve => {
          ctx.res.callback = resolve
          ctx.EditorHttpController.joinProject(ctx.req, ctx.res)
        })
      })

      it('should request a restricted view', function (ctx) {
        expect(
          ctx.ProjectEditorHandler.buildProjectModelView
        ).to.have.been.calledWith(ctx.project, ctx.ownerMember, [], [], true)
      })

      it('should mark the user as restricted, and hide details of owner', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledWith({
          project: ctx.reducedProjectView,
          privilegeLevel: 'readOnly',
          isRestrictedUser: true,
          isTokenMember: false,
          isInvitedMember: false,
        })
      })
    })

    describe('when not authorized', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.AuthorizationManager.promises.getPrivilegeLevelForProjectWithProjectAccess.resolves(
            null
          )
          ctx.res.callback = resolve
          ctx.EditorHttpController.joinProject(ctx.req, ctx.res)
        })
      })

      it('should send a 403 response', function (ctx) {
        expect(ctx.res.statusCode).to.equal(403)
      })
    })

    describe('with an anonymous user', function () {
      beforeEach(async function (ctx) {
        ctx.token = 'token'
        ctx.TokenAccessHandler.getRequestToken.returns(ctx.token)
        ctx.ProjectEditorHandler.buildProjectModelView.returns(
          ctx.reducedProjectView
        )
        ctx.req.body = {
          userId: 'anonymous-user',
          anonymousAccessToken: ctx.token,
        }
        ctx.AuthorizationManager.isRestrictedUser
          .withArgs(null, 'readOnly', false, false)
          .returns(true)
        ctx.AuthorizationManager.promises.getPrivilegeLevelForProjectWithProjectAccess
          .withArgs(null, ctx.project._id.toString(), ctx.token)
          .resolves('readOnly')
        await new Promise(resolve => {
          ctx.res.callback = resolve
          ctx.EditorHttpController.joinProject(ctx.req, ctx.res)
        })
      })

      it('should request a restricted view', function (ctx) {
        expect(
          ctx.ProjectEditorHandler.buildProjectModelView
        ).to.have.been.calledWith(ctx.project, ctx.ownerMember, [], [], true)
      })

      it('should mark the user as restricted', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledWith({
          project: ctx.reducedProjectView,
          privilegeLevel: 'readOnly',
          isRestrictedUser: true,
          isTokenMember: false,
          isInvitedMember: false,
        })
      })
    })

    describe('with a token access user', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          sinon
            .stub(
              ctx.CollaboratorsGetter.ProjectAccess.prototype,
              'isUserInvitedMember'
            )
            .returns(false)
          sinon
            .stub(
              ctx.CollaboratorsGetter.ProjectAccess.prototype,
              'isUserTokenMember'
            )
            .returns(true)
          ctx.AuthorizationManager.promises.getPrivilegeLevelForProjectWithProjectAccess.resolves(
            'readAndWrite'
          )
          ctx.res.callback = resolve
          ctx.EditorHttpController.joinProject(ctx.req, ctx.res)
        })
      })

      it('should mark the user as being a token-access member', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledWith({
          project: ctx.projectView,
          privilegeLevel: 'readAndWrite',
          isRestrictedUser: false,
          isTokenMember: true,
          isInvitedMember: false,
        })
      })
    })

    describe('when project is not found', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectGetter.promises.getProjectWithoutDocLines.resolves(null)
        await new Promise(resolve => {
          ctx.next.callsFake(() => resolve())
          ctx.EditorHttpController.joinProject(ctx.req, ctx.res, ctx.next)
        })
      })

      it('should handle return not found error', function (ctx) {
        expect(ctx.next).to.have.been.calledWith(
          sinon.match.instanceOf(Errors.NotFoundError)
        )
      })
    })
  })

  describe('addDoc', function () {
    beforeEach(function (ctx) {
      ctx.req.params = { Project_id: ctx.project._id }
      ctx.req.body = {
        name: (ctx.docName = 'doc-name'),
        parent_folder_id: ctx.parentFolderId,
      }
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.res.callback = resolve
          ctx.EditorHttpController.addDoc(ctx.req, ctx.res)
        })
      })

      it('should call EditorController.addDoc', function (ctx) {
        expect(ctx.EditorController.promises.addDoc).to.have.been.calledWith(
          ctx.project._id,
          ctx.parentFolderId,
          ctx.docName,
          [],
          'editor',
          ctx.user._id
        )
      })

      it('should send the doc back as JSON', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledWith(ctx.doc)
      })
    })

    describe('unsuccesfully', function () {
      it('handle name too short', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.body.name = ''
          ctx.res.callback = () => {
            expect(ctx.res.statusCode).to.equal(400)
            resolve()
          }
          ctx.EditorHttpController.addDoc(ctx.req, ctx.res)
        })
      })

      it('handle too many files', async function (ctx) {
        ctx.EditorController.promises.addDoc.rejects(
          new Error('project_has_too_many_files')
        )
        await new Promise(resolve => {
          ctx.res.callback = () => {
            expect(ctx.res.body).to.equal('"project_has_too_many_files_limit"')
            expect(ctx.res.status).toHaveBeenCalledWith(400)
            resolve()
          }
          ctx.EditorHttpController.addDoc(ctx.req, ctx.res)
        })
      })
    })
  })

  describe('addFolder', function () {
    beforeEach(function (ctx) {
      ctx.folderName = 'folder-name'
      ctx.req.params = { Project_id: ctx.project._id }
      ctx.req.body = {
        name: ctx.folderName,
        parent_folder_id: ctx.parentFolderId,
      }
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.res.callback = resolve
          ctx.EditorHttpController.addFolder(ctx.req, ctx.res)
        })
      })

      it('should call EditorController.addFolder', function (ctx) {
        expect(ctx.EditorController.promises.addFolder).to.have.been.calledWith(
          ctx.project._id,
          ctx.parentFolderId,
          ctx.folderName,
          'editor'
        )
      })

      it('should send the folder back as JSON', function (ctx) {
        expect(ctx.res.json).toHaveBeenCalledWith(ctx.folder)
      })
    })

    describe('unsuccesfully', function () {
      it('handle name too short', async function (ctx) {
        await new Promise(resolve => {
          ctx.req.body.name = ''
          ctx.res.callback = () => {
            expect(ctx.res.statusCode).to.equal(400)
            resolve()
          }
          ctx.EditorHttpController.addFolder(ctx.req, ctx.res)
        })
      })

      it('handle too many files', async function (ctx) {
        await new Promise(resolve => {
          ctx.EditorController.promises.addFolder.rejects(
            new Error('project_has_too_many_files')
          )
          ctx.res.callback = () => {
            expect(ctx.res.body).to.equal('"project_has_too_many_files_limit"')
            expect(ctx.res.statusCode).to.equal(400)
            resolve()
          }
          ctx.EditorHttpController.addFolder(ctx.req, ctx.res)
        })
      })

      it('handle invalid element name', async function (ctx) {
        await new Promise(resolve => {
          ctx.EditorController.promises.addFolder.rejects(
            new Error('invalid element name')
          )
          ctx.res.callback = () => {
            expect(ctx.res.body).to.equal('"invalid_file_name"')
            expect(ctx.res.statusCode).to.equal(400)
            resolve()
          }
          ctx.EditorHttpController.addFolder(ctx.req, ctx.res)
        })
      })
    })
  })

  describe('renameEntity', function () {
    beforeEach(function (ctx) {
      ctx.entityId = 'entity-id-123'
      ctx.entityType = 'entity-type'
      ctx.req.params = {
        Project_id: ctx.project._id,
        entity_id: ctx.entityId,
        entity_type: ctx.entityType,
      }
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.newName = 'new-name'
          ctx.req.body = { name: ctx.newName, source: ctx.source }
          ctx.res.callback = resolve
          ctx.EditorHttpController.renameEntity(ctx.req, ctx.res)
        })
      })

      it('should call EditorController.renameEntity', function (ctx) {
        expect(
          ctx.EditorController.promises.renameEntity
        ).to.have.been.calledWith(
          ctx.project._id,
          ctx.entityId,
          ctx.entityType,
          ctx.newName,
          ctx.user._id,
          ctx.source
        )
      })

      it('should send back a success response', function (ctx) {
        expect(ctx.res.sendStatus).toHaveBeenCalledWith(204)
      })
    })
    describe('with long name', function () {
      beforeEach(function (ctx) {
        ctx.newName = 'long'.repeat(100)
        ctx.req.body = { name: ctx.newName, source: ctx.source }
        ctx.EditorHttpController.renameEntity(ctx.req, ctx.res)
      })

      it('should send back a bad request status code', function (ctx) {
        expect(ctx.res.statusCode).to.equal(400)
      })
    })

    describe('with 0 length name', function () {
      beforeEach(function (ctx) {
        ctx.newName = ''
        ctx.req.body = { name: ctx.newName, source: ctx.source }
        ctx.EditorHttpController.renameEntity(ctx.req, ctx.res)
      })

      it('should send back a bad request status code', function (ctx) {
        expect(ctx.res.statusCode).to.equal(400)
      })
    })
  })

  describe('moveEntity', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.entityId = 'entity-id-123'
        ctx.entityType = 'entity-type'
        ctx.folderId = 'folder-id-123'
        ctx.req.params = {
          Project_id: ctx.project._id,
          entity_id: ctx.entityId,
          entity_type: ctx.entityType,
        }
        ctx.req.body = { folder_id: ctx.folderId, source: ctx.source }
        ctx.res.callback = resolve
        ctx.EditorHttpController.moveEntity(ctx.req, ctx.res)
      })
    })

    it('should call EditorController.moveEntity', function (ctx) {
      expect(ctx.EditorController.promises.moveEntity).to.have.been.calledWith(
        ctx.project._id,
        ctx.entityId,
        ctx.folderId,
        ctx.entityType,
        ctx.user._id,
        ctx.source
      )
    })

    it('should send back a success response', function (ctx) {
      expect(ctx.res.statusCode).to.equal(204)
    })
  })

  describe('deleteEntity', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.entityId = 'entity-id-123'
        ctx.entityType = 'entity-type'
        ctx.req.params = {
          Project_id: ctx.project._id,
          entity_id: ctx.entityId,
          entity_type: ctx.entityType,
        }
        ctx.res.callback = resolve
        ctx.EditorHttpController.deleteEntity(ctx.req, ctx.res)
      })
    })

    it('should call EditorController.deleteEntity', function (ctx) {
      expect(
        ctx.EditorController.promises.deleteEntity
      ).to.have.been.calledWith(
        ctx.project._id,
        ctx.entityId,
        ctx.entityType,
        'editor',
        ctx.user._id
      )
    })

    it('should send back a success response', function (ctx) {
      expect(ctx.res.statusCode).to.equal(204)
    })
  })
})
