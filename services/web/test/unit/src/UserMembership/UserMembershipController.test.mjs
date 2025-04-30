import { vi } from 'vitest'
import sinon from 'sinon'
import { expect } from 'chai'
import MockRequest from '../helpers/MockRequest.js'
import MockResponse from '../helpers/MockResponse.js'
import EntityConfigs from '../../../../app/src/Features/UserMembership/UserMembershipEntityConfigs.js'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import {
  UserIsManagerError,
  UserNotFoundError,
  UserAlreadyAddedError,
} from '../../../../app/src/Features/UserMembership/UserMembershipErrors.js'
const assertCalledWith = sinon.assert.calledWith

const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipController.mjs'

vi.mock(
  '../../../../app/src/Features/UserMembership/UserMembershipErrors.js',
  () =>
    vi.importActual(
      '../../../../app/src/Features/UserMembership/UserMembershipErrors.js'
    )
)

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('UserMembershipController', function () {
  beforeEach(async function (ctx) {
    ctx.req = new MockRequest()
    ctx.req.params.id = 'mock-entity-id'
    ctx.user = { _id: 'mock-user-id' }
    ctx.newUser = { _id: 'mock-new-user-id', email: 'new-user-email@foo.bar' }
    ctx.subscription = {
      _id: 'mock-subscription-id',
      admin_id: 'mock-admin-id',
      fetchV1Data: callback => callback(null, ctx.subscription),
    }
    ctx.institution = {
      _id: 'mock-institution-id',
      v1Id: 123,
      fetchV1Data: callback => {
        const institution = Object.assign({}, ctx.institution)
        institution.name = 'Test Institution Name'
        callback(null, institution)
      },
    }
    ctx.users = [
      {
        _id: 'mock-member-id-1',
        email: 'mock-email-1@foo.com',
        last_logged_in_at: '2020-08-09T12:43:11.467Z',
        last_active_at: '2021-08-09T12:43:11.467Z',
      },
      {
        _id: 'mock-member-id-2',
        email: 'mock-email-2@foo.com',
        last_logged_in_at: '2020-05-20T10:41:11.407Z',
        last_active_at: '2021-05-20T10:41:11.407Z',
      },
    ]

    ctx.Settings = {
      managedUsers: {
        enabled: false,
      },
    }

    ctx.SessionManager = {
      getSessionUser: sinon.stub().returns(ctx.user),
      getLoggedInUserId: sinon.stub().returns(ctx.user._id),
    }
    ctx.SSOConfig = {
      findById: sinon
        .stub()
        .returns({ exec: sinon.stub().resolves({ enabled: true }) }),
    }
    ctx.UserMembershipHandler = {
      getEntity: sinon.stub().yields(null, ctx.subscription),
      createEntity: sinon.stub().yields(null, ctx.institution),
      getUsers: sinon.stub().yields(null, ctx.users),
      addUser: sinon.stub().yields(null, ctx.newUser),
      removeUser: sinon.stub().yields(null),
      promises: {
        getUsers: sinon.stub().resolves(ctx.users),
      },
    }
    ctx.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
      },
      getAssignment: sinon.stub().yields(null, { variant: 'default' }),
    }
    ctx.RecurlyClient = {
      promises: {
        getSubscription: sinon.stub().resolves({}),
      },
    }

    vi.doMock(
      '../../../../app/src/Features/UserMembership/UserMembershipErrors',
      () => ({
        UserIsManagerError,
        UserNotFoundError,
        UserAlreadyAddedError,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/UserMembership/UserMembershipHandler',
      () => ({
        default: ctx.UserMembershipHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/RecurlyClient',
      () => ({
        default: ctx.RecurlyClient,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('../../../../app/src/models/SSOConfig', () => ({
      SSOConfig: ctx.SSOConfig,
    }))

    ctx.UserMembershipController = (await import(modulePath)).default
  })

  describe('index', function () {
    beforeEach(function (ctx) {
      ctx.req.entity = ctx.subscription
      ctx.req.entityConfig = EntityConfigs.group
    })

    it('get users', async function (ctx) {
      await ctx.UserMembershipController.manageGroupMembers(ctx.req, {
        render: () => {
          sinon.assert.calledWithMatch(
            ctx.UserMembershipHandler.promises.getUsers,
            ctx.subscription,
            { modelName: 'Subscription' }
          )
        },
      })
    })

    it('render group view', async function (ctx) {
      ctx.subscription.managedUsersEnabled = false
      await ctx.UserMembershipController.manageGroupMembers(ctx.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/group-members-react')
          expect(viewParams.users).to.deep.equal(ctx.users)
          expect(viewParams.groupSize).to.equal(ctx.subscription.membersLimit)
          expect(viewParams.managedUsersActive).to.equal(false)
        },
      })
    })

    it('render group view with managed users', async function (ctx) {
      ctx.subscription.managedUsersEnabled = true
      await ctx.UserMembershipController.manageGroupMembers(ctx.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/group-members-react')
          expect(viewParams.users).to.deep.equal(ctx.users)
          expect(viewParams.groupSize).to.equal(ctx.subscription.membersLimit)
          expect(viewParams.managedUsersActive).to.equal(true)
        },
      })
    })

    it('render group managers view', async function (ctx) {
      ctx.req.entityConfig = EntityConfigs.groupManagers
      await ctx.UserMembershipController.manageGroupManagers(ctx.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/group-managers-react')
          expect(viewParams.groupSize).to.equal(undefined)
        },
      })
    })

    it('render institution view', async function (ctx) {
      ctx.req.entity = ctx.institution
      ctx.req.entityConfig = EntityConfigs.institution
      await ctx.UserMembershipController.manageInstitutionManagers(ctx.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal(
            'user_membership/institution-managers-react'
          )
          expect(viewParams.name).to.equal('Test Institution Name')
          expect(viewParams.groupSize).to.equal(undefined)
        },
      })
    })
  })

  describe('add', function () {
    beforeEach(function (ctx) {
      ctx.req.body.email = ctx.newUser.email
      ctx.req.entity = ctx.subscription
      ctx.req.entityConfig = EntityConfigs.groupManagers
    })

    it('add user', function (ctx) {
      return new Promise(resolve => {
        ctx.UserMembershipController.add(ctx.req, {
          json: () => {
            sinon.assert.calledWithMatch(
              ctx.UserMembershipHandler.addUser,
              ctx.subscription,
              { modelName: 'Subscription' },
              ctx.newUser.email
            )
            resolve()
          },
        })
      })
    })

    it('return user object', function (ctx) {
      return new Promise(resolve => {
        ctx.UserMembershipController.add(ctx.req, {
          json: payload => {
            payload.user.should.equal(ctx.newUser)
            resolve()
          },
        })
      })
    })

    it('handle readOnly entity', function (ctx) {
      return new Promise(resolve => {
        ctx.req.entityConfig = EntityConfigs.group
        ctx.UserMembershipController.add(ctx.req, null, error => {
          expect(error).to.exist
          expect(error).to.be.an.instanceof(Errors.NotFoundError)
          resolve()
        })
      })
    })

    it('handle user already added', function (ctx) {
      return new Promise(resolve => {
        ctx.UserMembershipHandler.addUser.yields(new UserAlreadyAddedError())
        ctx.UserMembershipController.add(ctx.req, {
          status: () => ({
            json: payload => {
              expect(payload.error.code).to.equal('user_already_added')
              resolve()
            },
          }),
        })
      })
    })

    it('handle user not found', function (ctx) {
      return new Promise(resolve => {
        ctx.UserMembershipHandler.addUser.yields(new UserNotFoundError())
        ctx.UserMembershipController.add(ctx.req, {
          status: () => ({
            json: payload => {
              expect(payload.error.code).to.equal('user_not_found')
              resolve()
            },
          }),
        })
      })
    })

    it('handle invalid email', function (ctx) {
      return new Promise(resolve => {
        ctx.req.body.email = 'not_valid_email'
        ctx.UserMembershipController.add(ctx.req, {
          status: () => ({
            json: payload => {
              expect(payload.error.code).to.equal('invalid_email')
              resolve()
            },
          }),
        })
      })
    })
  })

  describe('remove', function () {
    beforeEach(function (ctx) {
      ctx.req.params.userId = ctx.newUser._id
      ctx.req.entity = ctx.subscription
      ctx.req.entityConfig = EntityConfigs.groupManagers
    })

    it('remove user', function (ctx) {
      return new Promise(resolve => {
        ctx.UserMembershipController.remove(ctx.req, {
          sendStatus: () => {
            sinon.assert.calledWithMatch(
              ctx.UserMembershipHandler.removeUser,
              ctx.subscription,
              { modelName: 'Subscription' },
              ctx.newUser._id
            )
            resolve()
          },
        })
      })
    })

    it('handle readOnly entity', function (ctx) {
      return new Promise(resolve => {
        ctx.req.entityConfig = EntityConfigs.group
        ctx.UserMembershipController.remove(ctx.req, null, error => {
          expect(error).to.exist
          expect(error).to.be.an.instanceof(Errors.NotFoundError)
          resolve()
        })
      })
    })

    it('prevent self removal', function (ctx) {
      return new Promise(resolve => {
        ctx.req.params.userId = ctx.user._id
        ctx.UserMembershipController.remove(ctx.req, {
          status: () => ({
            json: payload => {
              expect(payload.error.code).to.equal('managers_cannot_remove_self')
              resolve()
            },
          }),
        })
      })
    })

    it('prevent admin removal', function (ctx) {
      return new Promise(resolve => {
        ctx.UserMembershipHandler.removeUser.yields(new UserIsManagerError())
        ctx.UserMembershipController.remove(ctx.req, {
          status: () => ({
            json: payload => {
              expect(payload.error.code).to.equal(
                'managers_cannot_remove_admin'
              )
              resolve()
            },
          }),
        })
      })
    })
  })

  describe('exportCsv', function () {
    beforeEach(function (ctx) {
      ctx.req.entity = ctx.subscription
      ctx.req.entityConfig = EntityConfigs.groupManagers
      ctx.res = new MockResponse()
      ctx.UserMembershipController.exportCsv(ctx.req, ctx.res)
    })

    it('get users', function (ctx) {
      sinon.assert.calledWithMatch(
        ctx.UserMembershipHandler.getUsers,
        ctx.subscription,
        { modelName: 'Subscription' }
      )
    })

    it('should set the correct content type on the request', function (ctx) {
      assertCalledWith(ctx.res.contentType, 'text/csv; charset=utf-8')
    })

    it('should name the exported csv file', function (ctx) {
      assertCalledWith(
        ctx.res.header,
        'Content-Disposition',
        'attachment; filename="Group.csv"'
      )
    })

    it('should export the correct csv', function (ctx) {
      assertCalledWith(
        ctx.res.send,
        '"email","last_logged_in_at","last_active_at"\n"mock-email-1@foo.com","2020-08-09T12:43:11.467Z","2021-08-09T12:43:11.467Z"\n"mock-email-2@foo.com","2020-05-20T10:41:11.407Z","2021-05-20T10:41:11.407Z"'
      )
    })
  })

  describe('new', function () {
    beforeEach(function (ctx) {
      ctx.req.params.name = 'publisher'
      ctx.req.params.id = 'abc'
    })

    it('renders view', function (ctx) {
      return new Promise(resolve => {
        ctx.UserMembershipController.new(ctx.req, {
          render: (viewPath, data) => {
            expect(data.entityName).to.eq('publisher')
            expect(data.entityId).to.eq('abc')
            resolve()
          },
        })
      })
    })
  })

  describe('create', function () {
    beforeEach(function (ctx) {
      ctx.req.params.name = 'institution'
      ctx.req.entityConfig = EntityConfigs.institution
      ctx.req.params.id = 123
    })

    it('creates institution', function (ctx) {
      return new Promise(resolve => {
        ctx.UserMembershipController.create(ctx.req, {
          redirect: path => {
            expect(path).to.eq(EntityConfigs.institution.pathsFor(123).index)
            sinon.assert.calledWithMatch(
              ctx.UserMembershipHandler.createEntity,
              123,
              { modelName: 'Institution' }
            )
            resolve()
          },
        })
      })
    })
  })
})
