const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')
const Errors = require('../../../../app/src/Features/Errors/Errors')

const MODULE_PATH =
  '../../../../app/src/Features/Authorization/AuthorizationMiddleware.js'

describe('AuthorizationMiddleware', function () {
  beforeEach(function () {
    this.userId = new ObjectId().toString()
    this.project_id = new ObjectId().toString()
    this.doc_id = new ObjectId().toString()
    this.thread_id = new ObjectId().toString()
    this.token = 'some-token'
    this.AuthenticationController = {}
    this.SessionManager = {
      getSessionUser: sinon.stub().returns(null),
      getLoggedInUserId: sinon.stub().returns(this.userId),
      isUserLoggedIn: sinon.stub().returns(true),
    }
    this.AuthorizationManager = {
      promises: {
        canUserReadProject: sinon.stub(),
        canUserWriteProjectSettings: sinon.stub(),
        canUserWriteProjectContent: sinon.stub(),
        canUserWriteOrReviewProjectContent: sinon.stub(),
        canUserDeleteOrResolveThread: sinon.stub(),
        canUserAdminProject: sinon.stub(),
        canUserRenameProject: sinon.stub(),
        isUserSiteAdmin: sinon.stub(),
        isRestrictedUserForProject: sinon.stub(),
      },
    }
    this.HttpErrorHandler = {
      forbidden: sinon.stub(),
    }
    this.TokenAccessHandler = {
      getRequestToken: sinon.stub().returns(this.token),
    }
    this.DocumentUpdaterHandler = {
      promises: {
        getComment: sinon.stub().resolves(),
      },
    }
    this.AuthorizationMiddleware = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './AuthorizationManager': this.AuthorizationManager,
        '../Errors/HttpErrorHandler': this.HttpErrorHandler,
        'mongodb-legacy': { ObjectId },
        '../Authentication/AuthenticationController':
          this.AuthenticationController,
        '../Authentication/SessionManager': this.SessionManager,
        '../TokenAccess/TokenAccessHandler': this.TokenAccessHandler,
        '../Helpers/AdminAuthorizationHelper': {
          canRedirectToAdminDomain: sinon.stub().returns(false),
        },
        '../DocumentUpdater/DocumentUpdaterHandler':
          this.DocumentUpdaterHandler,
      },
    })
    this.req = {
      params: {
        project_id: this.project_id,
      },
      body: {},
    }
    this.res = {
      redirect: sinon.stub(),
      locals: {
        currentUrl: '/current/url',
      },
    }
    this.next = sinon.stub()
  })

  describe('ensureCanReadProject', function () {
    testMiddleware('ensureUserCanReadProject', 'canUserReadProject')
  })

  describe('ensureUserCanWriteProjectContent', function () {
    testMiddleware(
      'ensureUserCanWriteProjectContent',
      'canUserWriteProjectContent'
    )
  })

  describe('ensureUserCanWriteOrReviewProjectContent', function () {
    testMiddleware(
      'ensureUserCanWriteOrReviewProjectContent',
      'canUserWriteOrReviewProjectContent'
    )
  })

  describe('ensureUserCanDeleteOrResolveThread', function () {
    beforeEach(function () {
      this.req.params.doc_id = this.doc_id
      this.req.params.thread_id = this.thread_id
    })
    describe('when user has permission', function () {
      beforeEach(function () {
        this.AuthorizationManager.promises.canUserDeleteOrResolveThread
          .withArgs(
            this.userId,
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.token
          )
          .resolves(true)
      })

      invokeMiddleware('ensureUserCanDeleteOrResolveThread')
      expectNext()
    })

    describe("when user doesn't have permission", function () {
      beforeEach(function () {
        this.AuthorizationManager.promises.canUserDeleteOrResolveThread
          .withArgs(
            this.userId,
            this.project_id,
            this.doc_id,
            this.thread_id,
            this.token
          )
          .resolves(false)
      })

      invokeMiddleware('ensureUserCanDeleteOrResolveThread')
      expectForbidden()
    })
  })

  describe('ensureUserCanWriteProjectSettings', function () {
    describe('when renaming a project', function () {
      beforeEach(function () {
        this.req.body.name = 'new project name'
      })

      testMiddleware(
        'ensureUserCanWriteProjectSettings',
        'canUserRenameProject'
      )
    })

    describe('when setting another parameter', function () {
      beforeEach(function () {
        this.req.body.compiler = 'texlive-2017'
      })

      testMiddleware(
        'ensureUserCanWriteProjectSettings',
        'canUserWriteProjectSettings'
      )
    })
  })

  describe('ensureUserCanAdminProject', function () {
    testMiddleware('ensureUserCanAdminProject', 'canUserAdminProject')
  })

  describe('ensureUserIsSiteAdmin', function () {
    describe('with logged in user', function () {
      describe('when user has permission', function () {
        setupSiteAdmin(true)
        invokeMiddleware('ensureUserIsSiteAdmin')
        expectNext()
      })

      describe("when user doesn't have permission", function () {
        setupSiteAdmin(false)
        invokeMiddleware('ensureUserIsSiteAdmin')
        expectRedirectToRestricted()
      })
    })

    describe('with oauth user', function () {
      setupOAuthUser()

      describe('when user has permission', function () {
        setupSiteAdmin(true)
        invokeMiddleware('ensureUserIsSiteAdmin')
        expectNext()
      })

      describe("when user doesn't have permission", function () {
        setupSiteAdmin(false)
        invokeMiddleware('ensureUserIsSiteAdmin')
        expectRedirectToRestricted()
      })
    })

    describe('with anonymous user', function () {
      setupAnonymousUser()
      invokeMiddleware('ensureUserIsSiteAdmin')
      expectRedirectToRestricted()
    })
  })

  describe('blockRestrictedUserFromProject', function () {
    describe('for a restricted user', function () {
      setupPermission('isRestrictedUserForProject', true)
      invokeMiddleware('blockRestrictedUserFromProject')
      expectForbidden()
    })

    describe('for a regular user', function (done) {
      setupPermission('isRestrictedUserForProject', false)
      invokeMiddleware('blockRestrictedUserFromProject')
      expectNext()
    })
  })

  describe('ensureUserCanReadMultipleProjects', function () {
    beforeEach(function () {
      this.req.query = { project_ids: 'project1,project2' }
    })

    describe('with logged in user', function () {
      describe('when user has permission to access all projects', function () {
        beforeEach(function () {
          this.AuthorizationManager.promises.canUserReadProject
            .withArgs(this.userId, 'project1', this.token)
            .resolves(true)
          this.AuthorizationManager.promises.canUserReadProject
            .withArgs(this.userId, 'project2', this.token)
            .resolves(true)
        })

        invokeMiddleware('ensureUserCanReadMultipleProjects')
        expectNext()
      })

      describe("when user doesn't have permission to access one of the projects", function () {
        beforeEach(function () {
          this.AuthorizationManager.promises.canUserReadProject
            .withArgs(this.userId, 'project1', this.token)
            .resolves(true)
          this.AuthorizationManager.promises.canUserReadProject
            .withArgs(this.userId, 'project2', this.token)
            .resolves(false)
        })

        invokeMiddleware('ensureUserCanReadMultipleProjects')
        expectRedirectToRestricted()
      })
    })

    describe('with oauth user', function () {
      setupOAuthUser()

      beforeEach(function () {
        this.AuthorizationManager.promises.canUserReadProject
          .withArgs(this.userId, 'project1', this.token)
          .resolves(true)
        this.AuthorizationManager.promises.canUserReadProject
          .withArgs(this.userId, 'project2', this.token)
          .resolves(true)
      })

      invokeMiddleware('ensureUserCanReadMultipleProjects')
      expectNext()
    })

    describe('with anonymous user', function () {
      setupAnonymousUser()

      describe('when user has permission', function () {
        describe('when user has permission to access all projects', function () {
          beforeEach(function () {
            this.AuthorizationManager.promises.canUserReadProject
              .withArgs(null, 'project1', this.token)
              .resolves(true)
            this.AuthorizationManager.promises.canUserReadProject
              .withArgs(null, 'project2', this.token)
              .resolves(true)
          })

          invokeMiddleware('ensureUserCanReadMultipleProjects')
          expectNext()
        })

        describe("when user doesn't have permission to access one of the projects", function () {
          beforeEach(function () {
            this.AuthorizationManager.promises.canUserReadProject
              .withArgs(null, 'project1', this.token)
              .resolves(true)
            this.AuthorizationManager.promises.canUserReadProject
              .withArgs(null, 'project2', this.token)
              .resolves(false)
          })

          invokeMiddleware('ensureUserCanReadMultipleProjects')
          expectRedirectToRestricted()
        })
      })
    })
  })
})

function testMiddleware(middleware, permission) {
  describe(middleware, function () {
    describe('with missing project_id', function () {
      setupMissingProjectId()
      invokeMiddleware(middleware)
      expectError()
    })

    describe('with logged in user', function () {
      describe('when user has permission', function () {
        setupPermission(permission, true)
        invokeMiddleware(middleware)
        expectNext()
      })

      describe("when user doesn't have permission", function () {
        setupPermission(permission, false)
        invokeMiddleware(middleware)
        expectForbidden()
      })
    })

    describe('with oauth user', function () {
      setupOAuthUser()

      describe('when user has permission', function () {
        setupPermission(permission, true)
        invokeMiddleware(middleware)
        expectNext()
      })

      describe("when user doesn't have permission", function () {
        setupPermission(permission, false)
        invokeMiddleware(middleware)
        expectForbidden()
      })
    })

    describe('with anonymous user', function () {
      setupAnonymousUser()

      describe('when user has permission', function () {
        setupAnonymousPermission(permission, true)
        invokeMiddleware(middleware)
        expectNext()
      })

      describe("when user doesn't have permission", function () {
        setupAnonymousPermission(permission, false)
        invokeMiddleware(middleware)
        expectForbidden()
      })
    })

    describe('with malformed project id', function () {
      setupMalformedProjectId()
      invokeMiddleware(middleware)
      expectNotFound()
    })
  })
}

function setupAnonymousUser() {
  beforeEach('set up anonymous user', function () {
    this.SessionManager.getLoggedInUserId.returns(null)
    this.SessionManager.isUserLoggedIn.returns(false)
  })
}

function setupOAuthUser() {
  beforeEach('set up oauth user', function () {
    this.SessionManager.getLoggedInUserId.returns(null)
    this.req.oauth_user = { _id: this.userId }
  })
}

function setupPermission(permission, value) {
  beforeEach(`set permission ${permission} to ${value}`, function () {
    this.AuthorizationManager.promises[permission]
      .withArgs(this.userId, this.project_id, this.token)
      .resolves(value)
  })
}

function setupAnonymousPermission(permission, value) {
  beforeEach(`set anonymous permission ${permission} to ${value}`, function () {
    this.AuthorizationManager.promises[permission]
      .withArgs(null, this.project_id, this.token)
      .resolves(value)
  })
}

function setupSiteAdmin(value) {
  beforeEach(`set site admin to ${value}`, function () {
    this.AuthorizationManager.promises.isUserSiteAdmin
      .withArgs(this.userId)
      .resolves(value)
  })
}

function setupMissingProjectId() {
  beforeEach('set up missing project id', function () {
    delete this.req.params.project_id
  })
}

function setupMalformedProjectId() {
  beforeEach('set up malformed project id', function () {
    this.req.params = { project_id: 'bad-project-id' }
  })
}

function invokeMiddleware(method) {
  beforeEach(`invoke ${method}`, function (done) {
    this.next.callsFake(() => done())
    this.HttpErrorHandler.forbidden.callsFake(() => done())
    this.res.redirect.callsFake(() => done())
    this.AuthorizationMiddleware[method](this.req, this.res, this.next)
  })
}

function expectNext() {
  it('calls the next middleware', function () {
    expect(this.next).to.have.been.calledWithExactly()
  })
}

function expectError() {
  it('calls the error middleware', function () {
    expect(this.next).to.have.been.calledWith(sinon.match.instanceOf(Error))
  })
}

function expectNotFound() {
  it('raises a 404', function () {
    expect(this.next).to.have.been.calledWith(
      sinon.match.instanceOf(Errors.NotFoundError)
    )
  })
}

function expectForbidden() {
  it('raises a 403', function () {
    expect(this.HttpErrorHandler.forbidden).to.have.been.calledWith(
      this.req,
      this.res
    )
    expect(this.next).not.to.have.been.called
  })
}

function expectRedirectToRestricted() {
  it('redirects to restricted', function () {
    expect(this.res.redirect).to.have.been.calledWith(
      '/restricted?from=%2Fcurrent%2Furl'
    )
    expect(this.next).not.to.have.been.called
  })
}
