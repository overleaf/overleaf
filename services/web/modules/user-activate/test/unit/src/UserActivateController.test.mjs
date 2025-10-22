import { vi } from 'vitest'
import Path from 'node:path'
import sinon from 'sinon'

const MODULE_PATH = '../../../app/src/UserActivateController.mjs'

const VIEW_PATH = Path.join(
  import.meta.dirname,
  '../../../app/views/user/activate'
)

describe('UserActivateController', function () {
  beforeEach(async function (ctx) {
    ctx.user = {
      _id: (ctx.user_id = 'kwjewkl'),
      features: {},
      email: 'joe@example.com',
    }

    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub(),
      },
    }
    ctx.UserRegistrationHandler = { promises: {} }
    ctx.ErrorController = { notFound: sinon.stub() }
    ctx.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
      },
    }

    vi.doMock('../../../../../app/src/Features/User/UserGetter.mjs', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../../app/src/Features/User/UserRegistrationHandler.mjs',
      () => ({
        default: ctx.UserRegistrationHandler,
      })
    )

    vi.doMock(
      '../../../../../app/src/Features/Errors/ErrorController.mjs',
      () => ({
        default: ctx.ErrorController,
      })
    )

    vi.doMock(
      '../../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    ctx.UserActivateController = (await import(MODULE_PATH)).default
    ctx.req = {
      body: {},
      query: {},
      session: {
        user: ctx.user,
      },
    }
    ctx.res = {
      json: sinon.stub(),
    }
  })

  describe('activateAccountPage', function () {
    beforeEach(function (ctx) {
      ctx.UserGetter.promises.getUser = sinon.stub().resolves(ctx.user)
      ctx.req.query.user_id = ctx.user_id
      ctx.req.query.token = ctx.token = 'mock-token-123'
    })

    it('should 404 without a user_id', async function (ctx) {
      delete ctx.req.query.user_id

      await new Promise(resolve => {
        ctx.ErrorController.notFound = () => resolve()
        ctx.UserActivateController.activateAccountPage(ctx.req, ctx.res)
      })
    })

    it('should 404 without a token', async function (ctx) {
      await new Promise(resolve => {
        delete ctx.req.query.token
        ctx.ErrorController.notFound = resolve
        ctx.UserActivateController.activateAccountPage(ctx.req, ctx.res)
      })
    })

    it('should 404 without a valid user_id', async function (ctx) {
      await new Promise(resolve => {
        ctx.UserGetter.promises.getUser = sinon.stub().resolves(null)
        ctx.ErrorController.notFound = resolve
        ctx.UserActivateController.activateAccountPage(ctx.req, ctx.res)
      })
    })

    it('should 403 for complex user_id', async function (ctx) {
      await new Promise(resolve => {
        ctx.ErrorController.forbidden = resolve
        ctx.req.query.user_id = { first_name: 'X' }
        ctx.UserActivateController.activateAccountPage(ctx.req, ctx.res)
      })
    })

    it('should redirect activated users to login', async function (ctx) {
      await new Promise(resolve => {
        ctx.user.loginCount = 1
        ctx.res.redirect = url => {
          sinon.assert.calledWith(ctx.UserGetter.promises.getUser, ctx.user_id)
          url.should.equal('/login')
          resolve()
        }
        ctx.UserActivateController.activateAccountPage(ctx.req, ctx.res)
      })
    })

    it('render the activation page if the user has not logged in before', async function (ctx) {
      await new Promise(resolve => {
        ctx.user.loginCount = 0
        ctx.res.render = (page, opts) => {
          page.should.equal(VIEW_PATH)
          opts.email.should.equal(ctx.user.email)
          opts.token.should.equal(ctx.token)
          resolve()
        }
        ctx.UserActivateController.activateAccountPage(ctx.req, ctx.res)
      })
    })
  })

  describe('register', function () {
    beforeEach(async function (ctx) {
      ctx.UserRegistrationHandler.promises.registerNewUserAndSendActivationEmail =
        sinon.stub().resolves({
          user: ctx.user,
          setNewPasswordUrl: (ctx.url = 'mock/url'),
        })
      ctx.req.body.email = ctx.user.email = ctx.email = 'email@example.com'
      await ctx.UserActivateController.register(ctx.req, ctx.res)
    })

    it('should register the user and send them an email', function (ctx) {
      sinon.assert.calledWith(
        ctx.UserRegistrationHandler.promises
          .registerNewUserAndSendActivationEmail,
        ctx.email
      )
    })

    it('should return the user and activation url', function (ctx) {
      ctx.res.json
        .calledWith({
          email: ctx.email,
          setNewPasswordUrl: ctx.url,
        })
        .should.equal(true)
    })
  })
})
