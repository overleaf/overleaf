/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Editor/EditorHttpController'
)
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('EditorHttpController', function() {
  beforeEach(function() {
    this.EditorHttpController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Project/ProjectEntityUpdateHandler': (this.ProjectEntityUpdateHandler = {}),
        '../Project/ProjectDeleter': (this.ProjectDeleter = {}),
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        '../User/UserGetter': (this.UserGetter = {}),
        '../Authorization/AuthorizationManager': (this.AuthorizationManager = {}),
        '../Project/ProjectEditorHandler': (this.ProjectEditorHandler = {}),
        './EditorRealTimeController': (this.EditorRealTimeController = {}),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub()
        }),
        './EditorController': (this.EditorController = {}),
        'metrics-sharelatex': (this.Metrics = { inc: sinon.stub() }),
        '../Collaborators/CollaboratorsHandler': (this.CollaboratorsHandler = {}),
        '../Collaborators/CollaboratorsInviteHandler': (this.CollaboratorsInviteHandler = {}),
        '../TokenAccess/TokenAccessHandler': (this.TokenAccessHandler = {}),
        '../Authentication/AuthenticationController': (this.AuthenticationController = {}),
        '../Errors/Errors': Errors
      }
    })

    this.project_id = 'mock-project-id'
    this.doc_id = 'mock-doc-id'
    this.user_id = 'mock-user-id'
    this.parent_folder_id = 'mock-folder-id'
    this.userId = 1234
    this.AuthenticationController.getLoggedInUserId = sinon
      .stub()
      .returns(this.userId)
    this.req = { i18n: { translate: string => string } }
    this.res = {
      send: sinon.stub(),
      sendStatus: sinon.stub(),
      json: sinon.stub()
    }
    this.callback = sinon.stub()
    this.TokenAccessHandler.getRequestToken = sinon
      .stub()
      .returns((this.token = null))
    return (this.TokenAccessHandler.protectTokens = sinon.stub())
  })

  describe('joinProject', function() {
    beforeEach(function() {
      this.req.params = { Project_id: this.project_id }
      this.req.query = { user_id: this.user_id }
      this.projectView = {
        _id: this.project_id
      }
      this.EditorHttpController._buildJoinProjectView = sinon
        .stub()
        .callsArgWith(3, null, this.projectView, 'owner')
      return (this.ProjectDeleter.unmarkAsDeletedByExternalSource = sinon.stub())
    })

    describe('successfully', function() {
      beforeEach(function() {
        return this.EditorHttpController.joinProject(this.req, this.res)
      })

      it('should get the project view', function() {
        return this.EditorHttpController._buildJoinProjectView
          .calledWith(this.req, this.project_id, this.user_id)
          .should.equal(true)
      })

      it('should return the project and privilege level', function() {
        return this.res.json
          .calledWith({
            project: this.projectView,
            privilegeLevel: 'owner'
          })
          .should.equal(true)
      })

      it('should not try to unmark the project as deleted', function() {
        return this.ProjectDeleter.unmarkAsDeletedByExternalSource.called.should.equal(
          false
        )
      })

      it('should send an inc metric', function() {
        return this.Metrics.inc
          .calledWith('editor.join-project')
          .should.equal(true)
      })
    })

    describe('when the project is marked as deleted', function() {
      beforeEach(function() {
        this.projectView.deletedByExternalDataSource = true
        return this.EditorHttpController.joinProject(this.req, this.res)
      })

      it('should unmark the project as deleted', function() {
        return this.ProjectDeleter.unmarkAsDeletedByExternalSource
          .calledWith(this.project_id)
          .should.equal(true)
      })
    })

    describe('with an anonymous user', function() {
      beforeEach(function() {
        this.req.query = { user_id: 'anonymous-user' }
        return this.EditorHttpController.joinProject(this.req, this.res)
      })

      it('should pass the user id as null', function() {
        return this.EditorHttpController._buildJoinProjectView
          .calledWith(this.req, this.project_id, null)
          .should.equal(true)
      })
    })
  })

  describe('_buildJoinProjectView', function() {
    beforeEach(function() {
      this.project = {
        _id: this.project_id,
        owner_ref: { _id: 'something' }
      }
      this.user = {
        _id: (this.user_id = 'user-id'),
        projects: {}
      }
      this.members = ['members', 'mock']
      this.tokenMembers = ['one', 'two']
      this.projectModelView = {
        _id: this.project_id,
        owner: { _id: 'something' },
        view: true
      }
      this.invites = [
        {
          _id: 'invite_one',
          email: 'user-one@example.com',
          privileges: 'readOnly',
          projectId: this.project._id
        },
        {
          _id: 'invite_two',
          email: 'user-two@example.com',
          privileges: 'readOnly',
          projectId: this.project._id
        }
      ]
      this.ProjectEditorHandler.buildProjectModelView = sinon
        .stub()
        .returns(this.projectModelView)
      this.ProjectGetter.getProjectWithoutDocLines = sinon
        .stub()
        .callsArgWith(1, null, this.project)
      this.CollaboratorsHandler.getInvitedMembersWithPrivilegeLevels = sinon
        .stub()
        .callsArgWith(1, null, this.members)
      this.CollaboratorsHandler.getTokenMembersWithPrivilegeLevels = sinon
        .stub()
        .callsArgWith(1, null, this.tokenMembers)
      this.CollaboratorsInviteHandler.getAllInvites = sinon
        .stub()
        .callsArgWith(1, null, this.invites)
      return (this.UserGetter.getUser = sinon
        .stub()
        .callsArgWith(2, null, this.user))
    })

    describe('when project is not found', function() {
      beforeEach(function() {
        this.ProjectGetter.getProjectWithoutDocLines.yields(null, null)
        return this.EditorHttpController._buildJoinProjectView(
          this.req,
          this.project_id,
          this.user_id,
          this.callback
        )
      })

      it('should handle return not found error', function() {
        let args = this.callback.lastCall.args
        args.length.should.equal(1)
        args[0].should.be.instanceof(Errors.NotFoundError)
      })
    })

    describe('when authorized', function() {
      beforeEach(function() {
        this.AuthorizationManager.getPrivilegeLevelForProject = sinon
          .stub()
          .callsArgWith(3, null, 'owner')
        return this.EditorHttpController._buildJoinProjectView(
          this.req,
          this.project_id,
          this.user_id,
          this.callback
        )
      })

      it('should find the project without doc lines', function() {
        return this.ProjectGetter.getProjectWithoutDocLines
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should get the list of users in the project', function() {
        return this.CollaboratorsHandler.getInvitedMembersWithPrivilegeLevels
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should check the privilege level', function() {
        return this.AuthorizationManager.getPrivilegeLevelForProject
          .calledWith(this.user_id, this.project_id, this.token)
          .should.equal(true)
      })

      it('should include the invites', function() {
        return this.CollaboratorsInviteHandler.getAllInvites
          .calledWith(this.project._id)
          .should.equal(true)
      })

      it('should return the project model view, privilege level and protocol version', function() {
        return this.callback
          .calledWith(null, this.projectModelView, 'owner')
          .should.equal(true)
      })
    })

    describe('when not authorized', function() {
      beforeEach(function() {
        this.AuthorizationManager.getPrivilegeLevelForProject = sinon
          .stub()
          .callsArgWith(3, null, null)
        return this.EditorHttpController._buildJoinProjectView(
          this.req,
          this.project_id,
          this.user_id,
          this.callback
        )
      })

      it('should return false in the callback', function() {
        return this.callback.calledWith(null, null, false).should.equal(true)
      })
    })
  })

  describe('addDoc', function() {
    beforeEach(function() {
      this.doc = { mock: 'doc' }
      this.req.params = { Project_id: this.project_id }
      this.req.body = {
        name: (this.name = 'doc-name'),
        parent_folder_id: this.parent_folder_id
      }
      return (this.EditorController.addDoc = sinon
        .stub()
        .callsArgWith(6, null, this.doc))
    })

    describe('successfully', function() {
      beforeEach(function() {
        return this.EditorHttpController.addDoc(this.req, this.res)
      })

      it('should call EditorController.addDoc', function() {
        return this.EditorController.addDoc
          .calledWith(
            this.project_id,
            this.parent_folder_id,
            this.name,
            [],
            'editor',
            this.userId
          )
          .should.equal(true)
      })

      it('should send the doc back as JSON', function() {
        return this.res.json.calledWith(this.doc).should.equal(true)
      })
    })

    describe('unsuccesfully', function() {
      it('handle name too short', function() {
        this.req.body.name = ''
        this.EditorHttpController.addDoc(this.req, this.res)
        this.res.sendStatus.calledWith(400).should.equal(true)
      })

      it('handle too many files', function() {
        this.EditorController.addDoc.yields(
          new Error('project_has_to_many_files')
        )
        let res = {
          status: status => {
            status.should.equal(400)
            return {
              json: json => {
                json.should.equal('project_has_to_many_files')
              }
            }
          }
        }
        this.EditorHttpController.addDoc(this.req, res)
      })
    })
  })

  describe('addFolder', function() {
    beforeEach(function() {
      this.folder = { mock: 'folder' }
      this.req.params = { Project_id: this.project_id }
      this.req.body = {
        name: (this.name = 'folder-name'),
        parent_folder_id: this.parent_folder_id
      }
      return (this.EditorController.addFolder = sinon
        .stub()
        .callsArgWith(4, null, this.folder))
    })

    describe('successfully', function() {
      beforeEach(function() {
        return this.EditorHttpController.addFolder(this.req, this.res)
      })

      it('should call EditorController.addFolder', function() {
        return this.EditorController.addFolder
          .calledWith(
            this.project_id,
            this.parent_folder_id,
            this.name,
            'editor'
          )
          .should.equal(true)
      })

      it('should send the folder back as JSON', function() {
        return this.res.json.calledWith(this.folder).should.equal(true)
      })
    })

    describe('unsuccesfully', function() {
      it('handle name too short', function() {
        this.req.body.name = ''
        this.EditorHttpController.addFolder(this.req, this.res)
        this.res.sendStatus.calledWith(400).should.equal(true)
      })

      it('handle too many files', function() {
        this.EditorController.addFolder.yields(
          new Error('project_has_to_many_files')
        )
        let res = {
          status: status => {
            status.should.equal(400)
            return {
              json: json => {
                json.should.equal('project_has_to_many_files')
              }
            }
          }
        }
        this.EditorHttpController.addFolder(this.req, res)
      })

      it('handle invalid element name', function() {
        this.EditorController.addFolder.yields(
          new Error('invalid element name')
        )
        let res = {
          status: status => {
            status.should.equal(400)
            return {
              json: json => {
                json.should.equal('invalid_file_name')
              }
            }
          }
        }
        this.EditorHttpController.addFolder(this.req, res)
      })
    })
  })

  describe('renameEntity', function() {
    beforeEach(function() {
      this.req.params = {
        Project_id: this.project_id,
        entity_id: (this.entity_id = 'entity-id-123'),
        entity_type: (this.entity_type = 'entity-type')
      }
      this.req.body = { name: (this.name = 'new-name') }
      this.EditorController.renameEntity = sinon.stub().callsArg(5)
      return this.EditorHttpController.renameEntity(this.req, this.res)
    })

    it('should call EditorController.renameEntity', function() {
      return this.EditorController.renameEntity
        .calledWith(
          this.project_id,
          this.entity_id,
          this.entity_type,
          this.name,
          this.userId
        )
        .should.equal(true)
    })

    it('should send back a success response', function() {
      return this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('renameEntity with long name', function() {
    beforeEach(function() {
      this.req.params = {
        Project_id: this.project_id,
        entity_id: (this.entity_id = 'entity-id-123'),
        entity_type: (this.entity_type = 'entity-type')
      }
      this.req.body = {
        name: (this.name =
          'EDMUBEEBKBXUUUZERMNSXFFWIBHGSDAWGMRIQWJBXGWSBVWSIKLFPRBYSJEKMFHTRZBHVKJSRGKTBHMJRXPHORFHAKRNPZGGYIOTEDMUBEEBKBXUUUZERMNSXFFWIBHGSDAWGMRIQWJBXGWSBVWSIKLFPRBYSJEKMFHTRZBHVKJSRGKTBHMJRXPHORFHAKRNPZGGYIOT')
      }
      this.EditorController.renameEntity = sinon.stub().callsArg(4)
      return this.EditorHttpController.renameEntity(this.req, this.res)
    })

    it('should send back a bad request status code', function() {
      return this.res.sendStatus.calledWith(400).should.equal(true)
    })
  })

  describe('rename entity with 0 length name', function() {
    beforeEach(function() {
      this.req.params = {
        Project_id: this.project_id,
        entity_id: (this.entity_id = 'entity-id-123'),
        entity_type: (this.entity_type = 'entity-type')
      }
      this.req.body = { name: (this.name = '') }
      this.EditorController.renameEntity = sinon.stub().callsArg(4)
      return this.EditorHttpController.renameEntity(this.req, this.res)
    })

    it('should send back a bad request status code', function() {
      return this.res.sendStatus.calledWith(400).should.equal(true)
    })
  })

  describe('moveEntity', function() {
    beforeEach(function() {
      this.req.params = {
        Project_id: this.project_id,
        entity_id: (this.entity_id = 'entity-id-123'),
        entity_type: (this.entity_type = 'entity-type')
      }
      this.req.body = { folder_id: (this.folder_id = 'folder-id-123') }
      this.EditorController.moveEntity = sinon.stub().callsArg(5)
      return this.EditorHttpController.moveEntity(this.req, this.res)
    })

    it('should call EditorController.moveEntity', function() {
      return this.EditorController.moveEntity
        .calledWith(
          this.project_id,
          this.entity_id,
          this.folder_id,
          this.entity_type,
          this.userId
        )
        .should.equal(true)
    })

    it('should send back a success response', function() {
      return this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('deleteEntity', function() {
    beforeEach(function() {
      this.req.params = {
        Project_id: this.project_id,
        entity_id: (this.entity_id = 'entity-id-123'),
        entity_type: (this.entity_type = 'entity-type')
      }
      this.EditorController.deleteEntity = sinon.stub().callsArg(5)
      return this.EditorHttpController.deleteEntity(this.req, this.res)
    })

    it('should call EditorController.deleteEntity', function() {
      return this.EditorController.deleteEntity
        .calledWith(
          this.project_id,
          this.entity_id,
          this.entity_type,
          'editor',
          this.userId
        )
        .should.equal(true)
    })

    it('should send back a success response', function() {
      return this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })
})
