import esmock from 'esmock'
import sinon from 'sinon'
import { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import MockRequest from '../helpers/MockRequest.js'
import MockResponse from '../helpers/MockResponse.js'
import PrivilegeLevels from '../../../../app/src/Features/Authorization/PrivilegeLevels.js'
import { getSafeRedirectPath } from '../../../../app/src/Features/Helpers/UrlHelper.js'

const ObjectId = mongodb.ObjectId

const MODULE_PATH =
  '../../../../app/src/Features/TokenAccess/TokenAccessController'

describe('TokenAccessController', function () {
  beforeEach(async function () {
    this.token = 'abc123'
    this.user = { _id: new ObjectId() }
    this.project = {
      _id: new ObjectId(),
      name: 'test',
      tokenAccessReadAndWrite_refs: [],
      tokenAccessReadOnly_refs: [],
    }
    this.req = new MockRequest()
    this.res = new MockResponse()
    this.next = sinon.stub().returns()

    this.Settings = {
      siteUrl: 'https://www.dev-overleaf.com',
      adminPrivilegeAvailable: false,
      adminUrl: 'https://admin.dev-overleaf.com',
      adminDomains: ['overleaf.com'],
    }
    this.TokenAccessHandler = {
      TOKEN_TYPES: {
        READ_ONLY: 'readOnly',
        READ_AND_WRITE: 'readAndWrite',
      },
      isReadAndWriteToken: sinon.stub().returns(true),
      isReadOnlyToken: sinon.stub().returns(true),
      tokenAccessEnabledForProject: sinon.stub().returns(true),
      checkTokenHashPrefix: sinon.stub(),
      makeTokenUrl: sinon.stub().returns('/'),
      grantSessionTokenAccess: sinon.stub(),
      promises: {
        addReadOnlyUserToProject: sinon.stub().resolves(),
        getProjectByToken: sinon.stub().resolves(this.project),
        getV1DocPublishedInfo: sinon.stub().resolves({ allow: true }),
        getV1DocInfo: sinon.stub(),
        removeReadAndWriteUserFromProject: sinon.stub().resolves(),
        moveReadAndWriteUserToReadOnly: sinon.stub().resolves(),
      },
    }

    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(this.user._id),
      getSessionUser: sinon.stub().returns(this.user._id),
    }

    this.AuthenticationController = {
      setRedirectInSession: sinon.stub(),
    }

    this.AuthorizationManager = {
      promises: {
        getPrivilegeLevelForProject: sinon
          .stub()
          .resolves(PrivilegeLevels.NONE),
      },
    }

    this.AuthorizationMiddleware = {}

    this.ProjectAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }

    this.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
        getAssignmentForUser: sinon.stub().resolves({ variant: 'default' }),
      },
    }

    this.CollaboratorsInviteHandler = {
      promises: {
        revokeInviteForUser: sinon.stub().resolves(),
      },
    }

    this.CollaboratorsHandler = {
      promises: {
        addUserIdToProject: sinon.stub().resolves(),
        setCollaboratorPrivilegeLevel: sinon.stub().resolves(),
      },
    }

    this.CollaboratorsGetter = {
      promises: {
        userIsReadWriteTokenMember: sinon.stub().resolves(),
        isUserInvitedReadWriteMemberOfProject: sinon.stub().resolves(),
        isUserInvitedMemberOfProject: sinon.stub().resolves(),
      },
    }

    this.EditorRealTimeController = { emitToRoom: sinon.stub() }

    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(this.project),
      },
    }

    this.AnalyticsManager = {
      recordEventForSession: sinon.stub(),
      recordEventForUserInBackground: sinon.stub(),
    }

    this.UserGetter = {
      promises: {
        getUser: sinon.stub().callsFake(async (userId, filter) => {
          if (userId === this.userId) {
            return this.user
          } else {
            return null
          }
        }),
        getUserEmail: sinon.stub().resolves(),
        getUserConfirmedEmails: sinon.stub().resolves(),
      },
    }

    this.LimitationsManager = {
      promises: {
        canAcceptEditCollaboratorInvite: sinon.stub().resolves(),
      },
    }

    this.TokenAccessController = await esmock.strict(MODULE_PATH, {
      '@overleaf/settings': this.Settings,
      '../../../../app/src/Features/TokenAccess/TokenAccessHandler':
        this.TokenAccessHandler,
      '../../../../app/src/Features/Authentication/AuthenticationController':
        this.AuthenticationController,
      '../../../../app/src/Features/Authentication/SessionManager':
        this.SessionManager,
      '../../../../app/src/Features/Authorization/AuthorizationManager':
        this.AuthorizationManager,
      '../../../../app/src/Features/Authorization/AuthorizationMiddleware':
        this.AuthorizationMiddleware,
      '../../../../app/src/Features/Project/ProjectAuditLogHandler':
        this.ProjectAuditLogHandler,
      '../../../../app/src/Features/SplitTests/SplitTestHandler':
        this.SplitTestHandler,
      '../../../../app/src/Features/Errors/Errors': (this.Errors = {
        NotFoundError: sinon.stub(),
      }),
      '../../../../app/src/Features/Collaborators/CollaboratorsHandler':
        this.CollaboratorsHandler,
      '../../../../app/src/Features/Collaborators/CollaboratorsInviteHandler':
        this.CollaboratorsInviteHandler,
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter':
        this.CollaboratorsGetter,
      '../../../../app/src/Features/Editor/EditorRealTimeController':
        this.EditorRealTimeController,
      '../../../../app/src/Features/Project/ProjectGetter': this.ProjectGetter,
      '../../../../app/src/Features/Helpers/AsyncFormHelper':
        (this.AsyncFormHelper = {
          redirect: sinon.stub(),
        }),
      '../../../../app/src/Features/Helpers/AdminAuthorizationHelper':
        (this.AdminAuthorizationHelper = {
          canRedirectToAdminDomain: sinon.stub(),
        }),
      '../../../../app/src/Features/Helpers/UrlHelper': (this.UrlHelper = {
        getSafeAdminDomainRedirect: sinon
          .stub()
          .callsFake(
            path => `${this.Settings.adminUrl}${getSafeRedirectPath(path)}`
          ),
      }),
      '../../../../app/src/Features/Analytics/AnalyticsManager':
        this.AnalyticsManager,
      '../../../../app/src/Features/User/UserGetter': this.UserGetter,
      '../../../../app/src/Features/Subscription/LimitationsManager':
        this.LimitationsManager,
    })
  })

  describe('grantTokenAccessReadAndWrite', function () {
    beforeEach(function () {
      this.LimitationsManager.promises.canAcceptEditCollaboratorInvite.resolves(
        true
      )
    })

    describe('normal case (edit slot available)', function () {
      beforeEach(function (done) {
        this.LimitationsManager.promises.canAcceptEditCollaboratorInvite.resolves(
          true
        )
        this.req.params = { token: this.token }
        this.req.body = {
          confirmedByUser: true,
          tokenHashPrefix: '#prefix',
        }
        this.res.callback = done
        this.TokenAccessController.grantTokenAccessReadAndWrite(
          this.req,
          this.res,
          done
        )
      })

      it('adds the user as a read and write invited member', function () {
        expect(
          this.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          this.project._id,
          undefined,
          this.user._id,
          PrivilegeLevels.READ_AND_WRITE
        )
      })

      it('writes a project audit log', function () {
        expect(
          this.ProjectAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          this.project._id,
          'accept-via-link-sharing',
          this.user._id,
          this.req.ip,
          { privileges: 'readAndWrite' }
        )
      })

      it('records a project-joined event for the user', function () {
        expect(
          this.AnalyticsManager.recordEventForUserInBackground
        ).to.have.been.calledWith(this.user._id, 'project-joined', {
          mode: 'read-write',
          projectId: this.project._id.toString(),
        })
      })

      it('emits a project membership changed event', function () {
        expect(
          this.EditorRealTimeController.emitToRoom
        ).to.have.been.calledWith(
          this.project._id,
          'project:membership:changed',
          { members: true, invites: true }
        )
      })

      it('checks token hash', function () {
        expect(
          this.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          this.token,
          '#prefix',
          'readAndWrite',
          this.user._id,
          { projectId: this.project._id, action: 'continue' }
        )
      })
    })

    describe('when there are no edit collaborator slots available', function () {
      beforeEach(function (done) {
        this.LimitationsManager.promises.canAcceptEditCollaboratorInvite.resolves(
          false
        )
        this.req.params = { token: this.token }
        this.req.body = {
          confirmedByUser: true,
          tokenHashPrefix: '#prefix',
        }
        this.res.callback = done
        this.TokenAccessController.grantTokenAccessReadAndWrite(
          this.req,
          this.res,
          done
        )
      })

      it('adds the user as a read only invited member instead (pendingEditor)', function () {
        expect(
          this.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          this.project._id,
          undefined,
          this.user._id,
          PrivilegeLevels.READ_ONLY,
          { pendingEditor: true }
        )
      })

      it('writes a project audit log', function () {
        expect(
          this.ProjectAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          this.project._id,
          'accept-via-link-sharing',
          this.user._id,
          this.req.ip,
          { privileges: 'readOnly', pendingEditor: true }
        )
      })

      it('records a project-joined event for the user', function () {
        expect(
          this.AnalyticsManager.recordEventForUserInBackground
        ).to.have.been.calledWith(this.user._id, 'project-joined', {
          mode: 'read-only',
          projectId: this.project._id.toString(),
          pendingEditor: true,
        })
      })

      it('emits a project membership changed event', function () {
        expect(
          this.EditorRealTimeController.emitToRoom
        ).to.have.been.calledWith(
          this.project._id,
          'project:membership:changed',
          { members: true, invites: true }
        )
      })

      it('checks token hash', function () {
        expect(
          this.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          this.token,
          '#prefix',
          'readAndWrite',
          this.user._id,
          { projectId: this.project._id, action: 'continue' }
        )
      })
    })

    describe('when the access was already granted', function () {
      beforeEach(function (done) {
        this.project.tokenAccessReadAndWrite_refs.push(this.user._id)
        this.req.params = { token: this.token }
        this.req.body = { confirmedByUser: true }
        this.res.callback = done
        this.TokenAccessController.grantTokenAccessReadAndWrite(
          this.req,
          this.res,
          done
        )
      })

      it('writes a project audit log', function () {
        expect(
          this.ProjectAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          this.project._id,
          'accept-via-link-sharing',
          this.user._id,
          this.req.ip,
          { privileges: 'readAndWrite' }
        )
      })

      it('checks token hash', function () {
        expect(
          this.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          this.token,
          undefined,
          'readAndWrite',
          this.user._id,
          { projectId: this.project._id, action: 'continue' }
        )
      })
    })

    describe('hash prefix missing in request', function () {
      beforeEach(function (done) {
        this.req.params = { token: this.token }
        this.req.body = { confirmedByUser: true }
        this.res.callback = done
        this.TokenAccessController.grantTokenAccessReadAndWrite(
          this.req,
          this.res,
          done
        )
      })

      it('adds the user as a read and write invited member', function () {
        expect(
          this.CollaboratorsHandler.promises.addUserIdToProject
        ).to.have.been.calledWith(
          this.project._id,
          undefined,
          this.user._id,
          PrivilegeLevels.READ_AND_WRITE
        )
      })

      it('checks the hash prefix', function () {
        expect(
          this.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          this.token,
          undefined,
          'readAndWrite',
          this.user._id,
          { projectId: this.project._id, action: 'continue' }
        )
      })
    })

    describe('user is owner of project', function () {
      beforeEach(function (done) {
        this.AuthorizationManager.promises.getPrivilegeLevelForProject.returns(
          PrivilegeLevels.OWNER
        )
        this.req.params = { token: this.token }
        this.req.body = {}
        this.res.callback = done
        this.TokenAccessController.grantTokenAccessReadAndWrite(
          this.req,
          this.res,
          done
        )
      })
      it('checks token hash and includes log data', function () {
        expect(
          this.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          this.token,
          undefined,
          'readAndWrite',
          this.user._id,
          {
            projectId: this.project._id,
            action: 'user already has higher or same privilege',
          }
        )
      })
    })

    describe('when user is not logged in', function () {
      beforeEach(function () {
        this.SessionManager.getLoggedInUserId.returns(null)
        this.req.params = { token: this.token }
        this.req.body = { tokenHashPrefix: '#prefix' }
      })
      describe('ANONYMOUS_READ_AND_WRITE_ENABLED is undefined', function () {
        beforeEach(function (done) {
          this.res.callback = done
          this.TokenAccessController.grantTokenAccessReadAndWrite(
            this.req,
            this.res,
            done
          )
        })

        it('redirects to restricted', function () {
          expect(this.res.json).to.have.been.calledWith({
            redirect: '/restricted',
            anonWriteAccessDenied: true,
          })
        })

        it('checks the hash prefix and includes log data', function () {
          expect(
            this.TokenAccessHandler.checkTokenHashPrefix
          ).to.have.been.calledWith(
            this.token,
            '#prefix',
            'readAndWrite',
            null,
            {
              action: 'denied anonymous read-and-write token access',
            }
          )
        })

        it('saves redirect URL with URL fragment', function () {
          expect(
            this.AuthenticationController.setRedirectInSession.lastCall.args[1]
          ).to.equal('/#prefix')
        })
      })

      describe('ANONYMOUS_READ_AND_WRITE_ENABLED is true', function () {
        beforeEach(function (done) {
          this.TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = true
          this.res.callback = done

          this.TokenAccessController.grantTokenAccessReadAndWrite(
            this.req,
            this.res,
            done
          )
        })

        it('redirects to project', function () {
          expect(this.res.json).to.have.been.calledWith({
            redirect: `/project/${this.project._id}`,
            grantAnonymousAccess: 'readAndWrite',
          })
        })

        it('checks the hash prefix and includes log data', function () {
          expect(
            this.TokenAccessHandler.checkTokenHashPrefix
          ).to.have.been.calledWith(
            this.token,
            '#prefix',
            'readAndWrite',
            null,
            {
              projectId: this.project._id,
              action: 'granting read-write anonymous access',
            }
          )
        })
      })
    })

    describe('when Overleaf SaaS', function () {
      beforeEach(function () {
        this.Settings.overleaf = {}
      })
      describe('when token is for v1 project', function () {
        beforeEach(function (done) {
          this.TokenAccessHandler.promises.getProjectByToken.resolves(undefined)
          this.TokenAccessHandler.promises.getV1DocInfo.resolves({
            exists: true,
            has_owner: true,
          })
          this.req.params = { token: this.token }
          this.req.body = { tokenHashPrefix: '#prefix' }
          this.res.callback = done
          this.TokenAccessController.grantTokenAccessReadAndWrite(
            this.req,
            this.res,
            done
          )
        })
        it('returns v1 import data', function () {
          expect(this.res.json).to.have.been.calledWith({
            v1Import: {
              status: 'canDownloadZip',
              projectId: this.token,
              hasOwner: true,
              name: 'Untitled',
              brandInfo: undefined,
            },
          })
        })
        it('checks the hash prefix and includes log data', function () {
          expect(
            this.TokenAccessHandler.checkTokenHashPrefix
          ).to.have.been.calledWith(
            this.token,
            '#prefix',
            'readAndWrite',
            this.user._id,
            {
              action: 'import v1',
            }
          )
        })
      })

      describe('when token is not for a v1 or v2 project', function () {
        beforeEach(function (done) {
          this.TokenAccessHandler.promises.getProjectByToken.resolves(undefined)
          this.TokenAccessHandler.promises.getV1DocInfo.resolves({
            exists: false,
          })
          this.req.params = { token: this.token }
          this.req.body = { tokenHashPrefix: '#prefix' }
          this.res.callback = done
          this.TokenAccessController.grantTokenAccessReadAndWrite(
            this.req,
            this.res,
            done
          )
        })
        it('returns 404', function () {
          expect(this.res.sendStatus).to.have.been.calledWith(404)
        })
        it('checks the hash prefix and includes log data', function () {
          expect(
            this.TokenAccessHandler.checkTokenHashPrefix
          ).to.have.been.calledWith(
            this.token,
            '#prefix',
            'readAndWrite',
            this.user._id,
            {
              action: '404',
            }
          )
        })
      })
    })

    describe('not Overleaf SaaS', function () {
      beforeEach(function () {
        this.TokenAccessHandler.promises.getProjectByToken.resolves(undefined)
        this.req.params = { token: this.token }
        this.req.body = { tokenHashPrefix: '#prefix' }
      })
      it('passes Errors.NotFoundError to next when project not found and still checks token hash', function (done) {
        this.TokenAccessController.grantTokenAccessReadAndWrite(
          this.req,
          this.res,
          args => {
            expect(args).to.be.instanceof(this.Errors.NotFoundError)

            expect(
              this.TokenAccessHandler.checkTokenHashPrefix
            ).to.have.been.calledWith(
              this.token,
              '#prefix',
              'readAndWrite',
              this.user._id,
              {
                action: '404',
              }
            )

            done()
          }
        )
      })
    })

    describe('when user is admin', function () {
      const admin = { _id: new ObjectId(), isAdmin: true }
      beforeEach(function () {
        this.SessionManager.getLoggedInUserId.returns(admin._id)
        this.SessionManager.getSessionUser.returns(admin)
        this.AdminAuthorizationHelper.canRedirectToAdminDomain.returns(true)
        this.req.params = { token: this.token }
        this.req.body = { confirmedByUser: true, tokenHashPrefix: '#prefix' }
      })

      it('redirects if project owner is non-admin', function () {
        this.UserGetter.promises.getUserConfirmedEmails = sinon
          .stub()
          .resolves([{ email: 'test@not-overleaf.com' }])
        this.res.callback = () => {
          expect(this.res.json).to.have.been.calledWith({
            redirect: `${this.Settings.adminUrl}/#prefix`,
          })
        }
        this.TokenAccessController.grantTokenAccessReadAndWrite(
          this.req,
          this.res
        )
      })

      it('grants access if project owner is an internal staff', function () {
        const internalStaff = { _id: new ObjectId(), isAdmin: true }
        const projectFromInternalStaff = {
          _id: new ObjectId(),
          name: 'test',
          tokenAccessReadAndWrite_refs: [],
          tokenAccessReadOnly_refs: [],
          owner_ref: internalStaff._id,
        }
        this.UserGetter.promises.getUser = sinon.stub().resolves(internalStaff)
        this.UserGetter.promises.getUserConfirmedEmails = sinon
          .stub()
          .resolves([{ email: 'test@overleaf.com' }])
        this.TokenAccessHandler.promises.getProjectByToken = sinon
          .stub()
          .resolves(projectFromInternalStaff)
        this.res.callback = () => {
          expect(
            this.CollaboratorsHandler.promises.addUserIdToProject
          ).to.have.been.calledWith(
            projectFromInternalStaff._id,
            undefined,
            admin._id,
            PrivilegeLevels.READ_AND_WRITE
          )
        }
        this.TokenAccessController.grantTokenAccessReadAndWrite(
          this.req,
          this.res
        )
      })
    })

    it('passes Errors.NotFoundError to next when token access is not enabled but still checks token hash', function (done) {
      this.TokenAccessHandler.tokenAccessEnabledForProject.returns(false)
      this.req.params = { token: this.token }
      this.req.body = { tokenHashPrefix: '#prefix' }
      this.TokenAccessController.grantTokenAccessReadAndWrite(
        this.req,
        this.res,
        args => {
          expect(args).to.be.instanceof(this.Errors.NotFoundError)

          expect(
            this.TokenAccessHandler.checkTokenHashPrefix
          ).to.have.been.calledWith(
            this.token,
            '#prefix',
            'readAndWrite',
            this.user._id,
            {
              projectId: this.project._id,
              action: 'token access not enabled',
            }
          )

          done()
        }
      )
    })

    it('returns 400 when not using a read write token', function () {
      this.TokenAccessHandler.isReadAndWriteToken.returns(false)
      this.req.params = { token: this.token }
      this.req.body = { tokenHashPrefix: '#prefix' }
      this.TokenAccessController.grantTokenAccessReadAndWrite(
        this.req,
        this.res
      )
      expect(this.res.sendStatus).to.have.been.calledWith(400)
    })
  })

  describe('grantTokenAccessReadOnly', function () {
    describe('normal case', function () {
      beforeEach(function (done) {
        this.req.params = { token: this.token }
        this.req.body = { confirmedByUser: true, tokenHashPrefix: '#prefix' }
        this.res.callback = done
        this.TokenAccessController.grantTokenAccessReadOnly(
          this.req,
          this.res,
          done
        )
      })

      it('grants read-only access', function () {
        expect(
          this.TokenAccessHandler.promises.addReadOnlyUserToProject
        ).to.have.been.calledWith(this.user._id, this.project._id)
      })

      it('writes a project audit log', function () {
        expect(
          this.ProjectAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          this.project._id,
          'join-via-token',
          this.user._id,
          this.req.ip,
          { privileges: 'readOnly' }
        )
      })

      it('checks if hash prefix matches', function () {
        expect(
          this.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          this.token,
          '#prefix',
          'readOnly',
          this.user._id,
          { projectId: this.project._id, action: 'continue' }
        )
      })
    })

    describe('when the access was already granted', function () {
      beforeEach(function (done) {
        this.project.tokenAccessReadOnly_refs.push(this.user._id)
        this.req.params = { token: this.token }
        this.req.body = { confirmedByUser: true }
        this.res.callback = done
        this.TokenAccessController.grantTokenAccessReadOnly(
          this.req,
          this.res,
          done
        )
      })

      it("doesn't write a project audit log", function () {
        expect(this.ProjectAuditLogHandler.promises.addEntry).to.not.have.been
          .called
      })

      it('still checks if hash prefix matches', function () {
        expect(
          this.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          this.token,
          undefined,
          'readOnly',
          this.user._id,
          { projectId: this.project._id, action: 'continue' }
        )
      })
    })

    it('returns 400 when not using a read only token', function () {
      this.TokenAccessHandler.isReadOnlyToken.returns(false)
      this.req.params = { token: this.token }
      this.req.body = { tokenHashPrefix: '#prefix' }
      this.TokenAccessController.grantTokenAccessReadOnly(this.req, this.res)
      expect(this.res.sendStatus).to.have.been.calledWith(400)
    })

    describe('anonymous users', function () {
      beforeEach(function (done) {
        this.req.params = { token: this.token }
        this.SessionManager.getLoggedInUserId.returns(null)
        this.res.callback = done

        this.TokenAccessController.grantTokenAccessReadOnly(
          this.req,
          this.res,
          done
        )
      })

      it('allows anonymous users and checks the token hash', function () {
        expect(this.res.json).to.have.been.calledWith({
          redirect: `/project/${this.project._id}`,
          grantAnonymousAccess: 'readOnly',
        })

        expect(
          this.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(this.token, undefined, 'readOnly', null, {
          projectId: this.project._id,
          action: 'granting read-only anonymous access',
        })
      })
    })

    describe('user is owner of project', function () {
      beforeEach(function (done) {
        this.AuthorizationManager.promises.getPrivilegeLevelForProject.returns(
          PrivilegeLevels.OWNER
        )
        this.req.params = { token: this.token }
        this.req.body = {}
        this.res.callback = done
        this.TokenAccessController.grantTokenAccessReadOnly(
          this.req,
          this.res,
          done
        )
      })
      it('checks token hash and includes log data', function () {
        expect(
          this.TokenAccessHandler.checkTokenHashPrefix
        ).to.have.been.calledWith(
          this.token,
          undefined,
          'readOnly',
          this.user._id,
          {
            projectId: this.project._id,
            action: 'user already has higher or same privilege',
          }
        )
      })
    })

    it('passes Errors.NotFoundError to next when token access is not enabled but still checks token hash', function (done) {
      this.TokenAccessHandler.tokenAccessEnabledForProject.returns(false)
      this.req.params = { token: this.token }
      this.req.body = { tokenHashPrefix: '#prefix' }
      this.TokenAccessController.grantTokenAccessReadOnly(
        this.req,
        this.res,
        args => {
          expect(args).to.be.instanceof(this.Errors.NotFoundError)

          expect(
            this.TokenAccessHandler.checkTokenHashPrefix
          ).to.have.been.calledWith(
            this.token,
            '#prefix',
            'readOnly',
            this.user._id,
            {
              projectId: this.project._id,
              action: 'token access not enabled',
            }
          )

          done()
        }
      )
    })
  })

  describe('ensureUserCanUseSharingUpdatesConsentPage', function () {
    beforeEach(function () {
      this.req.params = { Project_id: this.project._id }
    })

    describe('when not in link sharing changes test', function () {
      beforeEach(function (done) {
        this.AsyncFormHelper.redirect = sinon.stub().callsFake(() => done())
        this.TokenAccessController.ensureUserCanUseSharingUpdatesConsentPage(
          this.req,
          this.res,
          done
        )
      })

      it('redirects to the project/editor', function () {
        expect(this.AsyncFormHelper.redirect).to.have.been.calledWith(
          this.req,
          this.res,
          `/project/${this.project._id}`
        )
      })
    })

    describe('when link sharing changes test active', function () {
      beforeEach(function () {
        this.SplitTestHandler.promises.getAssignmentForUser.resolves({
          variant: 'active',
        })
      })

      describe('when user is not an invited editor and is a read write token member', function () {
        beforeEach(function (done) {
          this.CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject.resolves(
            false
          )
          this.CollaboratorsGetter.promises.userIsReadWriteTokenMember.resolves(
            true
          )
          this.next.callsFake(() => done())
          this.TokenAccessController.ensureUserCanUseSharingUpdatesConsentPage(
            this.req,
            this.res,
            this.next
          )
        })

        it('calls next', function () {
          expect(
            this.CollaboratorsGetter.promises
              .isUserInvitedReadWriteMemberOfProject
          ).to.have.been.calledWith(this.user._id, this.project._id)
          expect(
            this.CollaboratorsGetter.promises.userIsReadWriteTokenMember
          ).to.have.been.calledWith(this.user._id, this.project._id)
          expect(this.next).to.have.been.calledOnce
          expect(this.next.firstCall.args[0]).to.not.exist
        })
      })

      describe('when user is already an invited editor', function () {
        beforeEach(function (done) {
          this.CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject.resolves(
            true
          )
          this.AsyncFormHelper.redirect = sinon.stub().callsFake(() => done())
          this.TokenAccessController.ensureUserCanUseSharingUpdatesConsentPage(
            this.req,
            this.res,
            done
          )
        })

        it('redirects to the project/editor', function () {
          expect(this.AsyncFormHelper.redirect).to.have.been.calledWith(
            this.req,
            this.res,
            `/project/${this.project._id}`
          )
        })
      })

      describe('when user not a read write token member', function () {
        beforeEach(function (done) {
          this.CollaboratorsGetter.promises.userIsReadWriteTokenMember.resolves(
            false
          )
          this.AsyncFormHelper.redirect = sinon.stub().callsFake(() => done())
          this.TokenAccessController.ensureUserCanUseSharingUpdatesConsentPage(
            this.req,
            this.res,
            done
          )
        })

        it('redirects to the project/editor', function () {
          expect(this.AsyncFormHelper.redirect).to.have.been.calledWith(
            this.req,
            this.res,
            `/project/${this.project._id}`
          )
        })
      })
    })
  })

  describe('moveReadWriteToCollaborators', function () {
    beforeEach(function () {
      this.req.params = { Project_id: this.project._id }
    })

    describe('when there are collaborator slots available', function () {
      beforeEach(function () {
        this.LimitationsManager.promises.canAcceptEditCollaboratorInvite.resolves(
          true
        )
      })

      describe('previously joined token access user moving to named collaborator', function () {
        beforeEach(function (done) {
          this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.resolves(
            false
          )
          this.res.callback = done
          this.TokenAccessController.moveReadWriteToCollaborators(
            this.req,
            this.res,
            done
          )
        })

        it('sets the privilege level to read and write for the invited viewer', function () {
          expect(
            this.TokenAccessHandler.promises.removeReadAndWriteUserFromProject
          ).to.have.been.calledWith(this.user._id, this.project._id)
          expect(
            this.CollaboratorsHandler.promises.addUserIdToProject
          ).to.have.been.calledWith(
            this.project._id,
            undefined,
            this.user._id,
            PrivilegeLevels.READ_AND_WRITE
          )
          expect(this.res.sendStatus).to.have.been.calledWith(204)
        })
      })
    })

    describe('when there are no edit collaborator slots available', function () {
      beforeEach(function () {
        this.LimitationsManager.promises.canAcceptEditCollaboratorInvite.resolves(
          false
        )
      })

      describe('previously joined token access user moving to named collaborator', function () {
        beforeEach(function (done) {
          this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject.resolves(
            false
          )
          this.res.callback = done
          this.TokenAccessController.moveReadWriteToCollaborators(
            this.req,
            this.res,
            done
          )
        })

        it('sets the privilege level to read only for the invited viewer (pendingEditor)', function () {
          expect(
            this.TokenAccessHandler.promises.removeReadAndWriteUserFromProject
          ).to.have.been.calledWith(this.user._id, this.project._id)
          expect(
            this.CollaboratorsHandler.promises.addUserIdToProject
          ).to.have.been.calledWith(
            this.project._id,
            undefined,
            this.user._id,
            PrivilegeLevels.READ_ONLY,
            { pendingEditor: true }
          )
          expect(this.res.sendStatus).to.have.been.calledWith(204)
        })
      })
    })
  })

  describe('moveReadWriteToReadOnly', function () {
    beforeEach(function () {
      this.req.params = { Project_id: this.project._id }
    })

    describe('previously joined token access user moving to anonymous viewer', function () {
      beforeEach(function (done) {
        this.res.callback = done
        this.TokenAccessController.moveReadWriteToReadOnly(
          this.req,
          this.res,
          done
        )
      })

      it('removes them from read write token access refs and adds them to read only token access refs', function () {
        expect(
          this.TokenAccessHandler.promises.moveReadAndWriteUserToReadOnly
        ).to.have.been.calledWith(this.user._id, this.project._id)
        expect(this.res.sendStatus).to.have.been.calledWith(204)
      })

      it('writes a project audit log', function () {
        expect(
          this.ProjectAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          this.project._id,
          'readonly-via-sharing-updates',
          this.user._id,
          this.req.ip
        )
      })
    })
  })
})
