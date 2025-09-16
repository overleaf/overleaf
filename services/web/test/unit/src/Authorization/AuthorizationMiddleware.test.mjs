import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const { ObjectId } = mongodb

const MODULE_PATH =
  '../../../../app/src/Features/Authorization/AuthorizationMiddleware.mjs'

describe('AuthorizationMiddleware', function () {
  beforeEach(async function (ctx) {
    ctx.userId = new ObjectId().toString()
    ctx.project_id = new ObjectId().toString()
    ctx.doc_id = new ObjectId().toString()
    ctx.thread_id = new ObjectId().toString()
    ctx.token = 'some-token'
    ctx.AuthenticationController = {}
    ctx.SessionManager = {
      getSessionUser: sinon.stub().returns(null),
      getLoggedInUserId: sinon.stub().returns(ctx.userId),
      isUserLoggedIn: sinon.stub().returns(true),
    }
    ctx.AuthorizationManager = {
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
    ctx.HttpErrorHandler = {
      forbidden: sinon.stub(),
    }
    ctx.TokenAccessHandler = {
      getRequestToken: sinon.stub().returns(ctx.token),
    }
    ctx.DocumentUpdaterHandler = {
      promises: {
        getComment: sinon.stub().resolves(),
      },
    }

    vi.doMock('../../../../app/src/Features/Errors/Errors.js', () => ({
      default: Errors,
    }))

    vi.doMock(
      '../../../../app/src/Features/Authorization/AuthorizationManager',
      () => ({
        default: ctx.AuthorizationManager,
      })
    )

    vi.doMock('../../../../app/src/Features/Errors/HttpErrorHandler', () => ({
      default: ctx.HttpErrorHandler,
    }))

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/AuthenticationController',
      () => ({
        default: ctx.AuthenticationController,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/TokenAccess/TokenAccessHandler',
      () => ({
        default: ctx.TokenAccessHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Helpers/AdminAuthorizationHelper',
      () => ({
        default: {
          canRedirectToAdminDomain: sinon.stub().returns(false),
        },
      })
    )

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler',
      () => ({
        default: ctx.DocumentUpdaterHandler,
      })
    )

    ctx.AuthorizationMiddleware = (await import(MODULE_PATH)).default
    ctx.req = {
      params: {
        project_id: ctx.project_id,
      },
      body: {},
    }
    ctx.res = {
      redirect: sinon.stub(),
      locals: {
        currentUrl: '/current/url',
      },
    }
    ctx.next = sinon.stub()
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
    beforeEach(function (ctx) {
      ctx.req.params.thread_id = ctx.thread_id
    })
    describe('when user has permission', function () {
      beforeEach(function (ctx) {
        ctx.AuthorizationManager.promises.canUserDeleteOrResolveThread
          .withArgs(ctx.userId, ctx.project_id, ctx.thread_id, ctx.token)
          .resolves(true)
      })

      invokeMiddleware('ensureUserCanDeleteOrResolveThread')
      expectNext()
    })

    describe("when user doesn't have permission", function () {
      beforeEach(function (ctx) {
        ctx.AuthorizationManager.promises.canUserDeleteOrResolveThread
          .withArgs(ctx.userId, ctx.project_id, ctx.thread_id, ctx.token)
          .resolves(false)
      })

      invokeMiddleware('ensureUserCanDeleteOrResolveThread')
      expectForbidden()
    })
  })

  describe('ensureUserCanWriteProjectSettings', function () {
    describe('when renaming a project', function () {
      beforeEach(function (ctx) {
        ctx.req.body.name = 'new project name'
      })

      testMiddleware(
        'ensureUserCanWriteProjectSettings',
        'canUserRenameProject'
      )
    })

    describe('when setting another parameter', function () {
      beforeEach(function (ctx) {
        ctx.req.body.compiler = 'texlive-2017'
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

    describe('for a regular user', function () {
      setupPermission('isRestrictedUserForProject', false)
      invokeMiddleware('blockRestrictedUserFromProject')
      expectNext()
    })
  })

  describe('ensureUserCanReadMultipleProjects', function () {
    beforeEach(function (ctx) {
      ctx.req.query = { project_ids: 'project1,project2' }
    })

    describe('with logged in user', function () {
      describe('when user has permission to access all projects', function () {
        beforeEach(function (ctx) {
          ctx.AuthorizationManager.promises.canUserReadProject
            .withArgs(ctx.userId, 'project1', ctx.token)
            .resolves(true)
          ctx.AuthorizationManager.promises.canUserReadProject
            .withArgs(ctx.userId, 'project2', ctx.token)
            .resolves(true)
        })

        invokeMiddleware('ensureUserCanReadMultipleProjects')
        expectNext()
      })

      describe("when user doesn't have permission to access one of the projects", function () {
        beforeEach(function (ctx) {
          ctx.AuthorizationManager.promises.canUserReadProject
            .withArgs(ctx.userId, 'project1', ctx.token)
            .resolves(true)
          ctx.AuthorizationManager.promises.canUserReadProject
            .withArgs(ctx.userId, 'project2', ctx.token)
            .resolves(false)
        })

        invokeMiddleware('ensureUserCanReadMultipleProjects')
        expectRedirectToRestricted()
      })
    })

    describe('with oauth user', function () {
      setupOAuthUser()

      beforeEach(function (ctx) {
        ctx.AuthorizationManager.promises.canUserReadProject
          .withArgs(ctx.userId, 'project1', ctx.token)
          .resolves(true)
        ctx.AuthorizationManager.promises.canUserReadProject
          .withArgs(ctx.userId, 'project2', ctx.token)
          .resolves(true)
      })

      invokeMiddleware('ensureUserCanReadMultipleProjects')
      expectNext()
    })

    describe('with anonymous user', function () {
      setupAnonymousUser()

      describe('when user has permission', function () {
        describe('when user has permission to access all projects', function () {
          beforeEach(function (ctx) {
            ctx.AuthorizationManager.promises.canUserReadProject
              .withArgs(null, 'project1', ctx.token)
              .resolves(true)
            ctx.AuthorizationManager.promises.canUserReadProject
              .withArgs(null, 'project2', ctx.token)
              .resolves(true)
          })

          invokeMiddleware('ensureUserCanReadMultipleProjects')
          expectNext()
        })

        describe("when user doesn't have permission to access one of the projects", function () {
          beforeEach(function (ctx) {
            ctx.AuthorizationManager.promises.canUserReadProject
              .withArgs(null, 'project1', ctx.token)
              .resolves(true)
            ctx.AuthorizationManager.promises.canUserReadProject
              .withArgs(null, 'project2', ctx.token)
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
  beforeEach(function (ctx) {
    ctx.SessionManager.getLoggedInUserId.returns(null)
    ctx.SessionManager.isUserLoggedIn.returns(false)
  })
}

function setupOAuthUser() {
  beforeEach(function (ctx) {
    ctx.SessionManager.getLoggedInUserId.returns(null)
    ctx.req.oauth_user = { _id: ctx.userId }
  })
}

function setupPermission(permission, value) {
  beforeEach(function (ctx) {
    ctx.AuthorizationManager.promises[permission]
      .withArgs(ctx.userId, ctx.project_id, ctx.token)
      .resolves(value)
  })
}

function setupAnonymousPermission(permission, value) {
  beforeEach(function (ctx) {
    ctx.AuthorizationManager.promises[permission]
      .withArgs(null, ctx.project_id, ctx.token)
      .resolves(value)
  })
}

function setupSiteAdmin(value) {
  beforeEach(function (ctx) {
    ctx.AuthorizationManager.promises.isUserSiteAdmin
      .withArgs(ctx.userId)
      .resolves(value)
  })
}

function setupMissingProjectId() {
  beforeEach(function (ctx) {
    delete ctx.req.params.project_id
  })
}

function setupMalformedProjectId() {
  beforeEach(function (ctx) {
    ctx.req.params = { project_id: 'bad-project-id' }
  })
}

function invokeMiddleware(method) {
  beforeEach(async function (ctx) {
    await new Promise(resolve => {
      ctx.next.callsFake(() => resolve())
      ctx.HttpErrorHandler.forbidden.callsFake(() => resolve())
      ctx.res.redirect.callsFake(() => resolve())
      ctx.AuthorizationMiddleware[method](ctx.req, ctx.res, ctx.next)
    })
  })
}

function expectNext() {
  it('calls the next middleware', function (ctx) {
    expect(ctx.next).to.have.been.calledWithExactly()
  })
}

function expectError() {
  it('calls the error middleware', function (ctx) {
    expect(ctx.next).to.have.been.calledWith(sinon.match.instanceOf(Error))
  })
}

function expectNotFound() {
  it('raises a 404', function (ctx) {
    expect(ctx.next).to.have.been.calledWith(
      sinon.match.instanceOf(Errors.NotFoundError)
    )
  })
}

function expectForbidden() {
  it('raises a 403', function (ctx) {
    expect(ctx.HttpErrorHandler.forbidden).to.have.been.calledWith(
      ctx.req,
      ctx.res
    )
    expect(ctx.next).not.to.have.been.called
  })
}

function expectRedirectToRestricted() {
  it('redirects to restricted', function (ctx) {
    expect(ctx.res.redirect).to.have.been.calledWith(
      '/restricted?from=%2Fcurrent%2Furl'
    )
    expect(ctx.next).not.to.have.been.called
  })
}
