import { expect, vi, describe, it, beforeEach } from 'vitest'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
import EntityConfigs from '../../../../app/src/Features/UserMembership/UserMembershipEntityConfigs.mjs'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import UserMembershipErrors from '../../../../app/src/Features/UserMembership/UserMembershipErrors.mjs'

const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipController.mjs'

vi.mock(
  '../../../../app/src/Features/UserMembership/UserMembershipErrors.mjs',
  () =>
    vi.importActual(
      '../../../../app/src/Features/UserMembership/UserMembershipErrors.mjs'
    )
)

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('UserMembershipController', () => {
  let recurlySubscriptionId

  beforeEach(async ctx => {
    recurlySubscriptionId = 'mock-recurly-subscription-id'
    ctx.req = new MockRequest(vi)
    ctx.req.params.id = 'mock-entity-id'
    ctx.user = { _id: 'mock-user-id' }
    ctx.newUser = { _id: 'mock-new-user-id', email: 'new-user-email@foo.bar' }
    ctx.subscription = {
      _id: 'mock-subscription-id',
      admin_id: 'mock-admin-id',
      manager_ids: ['mock-admin-id'],
      planCode: 'group_professional',
      recurlySubscription_id: recurlySubscriptionId,
      fetchV1Data: vi.fn(callback => callback(null, ctx.subscription)),
    }
    ctx.institution = {
      _id: 'mock-institution-id',
      v1Id: 123,
      fetchV1Data: vi.fn(callback => {
        const institution = { ...ctx.institution }
        institution.name = 'Test Institution Name'
        callback(null, institution)
      }),
      managerIds: ['mock-member-id-1'],
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
      {
        _id: 'mock-member-id-3',
        email: 'mock-email-3@foo.com',
        last_logged_in_at: '2021-08-10T10:41:11.407Z',
        last_active_at: '2021-08-20T10:41:11.407Z',
        enrollment: {
          managedBy: 'some-other-subscription-id',
          enrolledAt: '2021-05-20T10:41:11.407Z',
          sso: undefined,
        },
      },
      {
        _id: 'mock-member-id-4',
        email: 'mock-email-4@foo.com',
        last_logged_in_at: '2021-01-01T10:41:11.407Z',
        last_active_at: '2021-01-02T10:41:11.407Z',
        enrollment: {
          managedBy: 'mock-subscription-id',
          enrolledAt: '2021-01-02T10:41:11.407Z',
          sso: undefined,
        },
      },
      {
        _id: 'mock-member-id-5',
        email: 'mock-email-5@foo.com',
        last_logged_in_at: '2023-01-01T10:41:11.407Z',
        last_active_at: '2023-01-02T10:41:11.407Z',
        enrollment: {
          sso: [{ groupId: ctx.subscription._id }],
        },
      },
      {
        _id: 'mock-member-id-6',
        email: 'mock-email-6@foo.com',
        last_logged_in_at: '2024-01-01T10:41:11.407Z',
        last_active_at: '2024-01-02T10:41:11.407Z',
        enrollment: {
          managedBy: 'mock-subscription-id',
          enrolledAt: '2024-01-02T10:41:11.407Z',
          sso: [{ groupId: ctx.subscription._id }],
        },
      },
    ]

    ctx.Settings = {
      managedUsers: {
        enabled: false,
      },
      plans: [
        {
          planCode: 'personal',
          name: 'Personal',
          price_in_cents: 0,
          features: {
            collaborators: -1,
            dropbox: true,
            github: true,
            gitBridge: true,
            versioning: true,
            compileTimeout: 180,
            compileGroup: 'standard',
            references: true,
            trackChanges: true,
          },
        },
      ],
    }

    ctx.SessionManager = {
      getSessionUser: vi.fn().mockReturnValue(ctx.user),
      getLoggedInUserId: vi.fn().mockReturnValue(ctx.user._id),
    }
    ctx.SSOConfig = {
      findById: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ enabled: true }),
      }),
    }
    ctx.UserMembershipHandler = {
      getEntity: vi.fn((_entity, _options, callback) =>
        callback(null, ctx.subscription)
      ),
      createEntity: vi.fn((_entity, _options, callback) =>
        callback(null, ctx.institution)
      ),
      getUsers: vi.fn((_entity, _options, callback) =>
        callback(null, ctx.users)
      ),
      addUser: vi.fn((_entity, _options, _email, callback) =>
        callback(null, ctx.newUser)
      ),
      removeUser: vi.fn((_entity, _options, _userId, callback) =>
        callback(null)
      ),
      promises: {
        getUsers: vi.fn().mockResolvedValue(ctx.users),
        addUser: vi.fn().mockResolvedValue(ctx.newUser),
        removeUser: vi.fn().mockResolvedValue(),
        createEntity: vi.fn().mockResolvedValue(ctx.institution),
      },
    }
    ctx.SplitTestHandler = {
      promises: {
        getAssignment: vi.fn().mockResolvedValue({ variant: 'default' }),
      },
      getAssignment: vi.fn((_testName, _userId, callback) =>
        callback(null, { variant: 'default' })
      ),
    }
    ctx.RecurlyClient = {
      promises: {
        getSubscription: vi.fn().mockResolvedValue({
          id: recurlySubscriptionId,
        }),
      },
    }

    ctx.PlansLocator = {
      findLocalPlanInSettings: vi.fn().mockReturnValue({
        planCode: 'group_professional',
        canUseFlexibleLicensing: true,
      }),
    }

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

    vi.doMock(
      '../../../../app/src/Features/Subscription/PlansLocator.mjs',
      () => ({
        default: ctx.PlansLocator,
      })
    )

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('../../../../app/src/models/SSOConfig', () => ({
      SSOConfig: ctx.SSOConfig,
    }))

    ctx.Modules = {
      promises: {
        hooks: {
          fire: vi.fn(),
        },
      },
    }
    vi.doMock('../../../../app/src/infrastructure/Modules.mjs', () => ({
      default: ctx.Modules,
    }))

    ctx.UserMembershipController = (await import(modulePath)).default
  })

  describe('index', () => {
    beforeEach(ctx => {
      ctx.req.user = ctx.user
      ctx.req.entity = ctx.subscription
      ctx.req.entityConfig = EntityConfigs.group
      ctx.Modules.promises.hooks.fire.mockResolvedValue([])
    })

    it('get users', async ({
      UserMembershipController,
      req,
      UserMembershipHandler,
      subscription,
    }) => {
      expect.assertions(1)
      await UserMembershipController.manageGroupMembers(req, {
        render: () => {
          expect(UserMembershipHandler.promises.getUsers).toHaveBeenCalledWith(
            subscription,
            {
              modelName: 'Subscription',
              baseQuery: { groupPlan: true },
              fields: {
                access: 'manager_ids',
                membership: 'member_ids',
                name: 'teamName',
                primaryKey: '_id',
                read: ['invited_emails', 'teamInvites', 'member_ids'],
                write: null,
              },
              hasMembersLimit: true,
              readOnly: true,
            }
          )
        },
      })
    })

    it('render group view', async ({
      UserMembershipController,
      req,
      subscription,
      users,
    }) => {
      expect.assertions(4)
      subscription.managedUsersEnabled = false
      await UserMembershipController.manageGroupMembers(req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/group-members-react')
          expect(viewParams.users).to.deep.equal(users)
          expect(viewParams.groupSize).to.equal(subscription.membersLimit)
          expect(viewParams.managedUsersActive).to.equal(false)
        },
      })
    })

    it('render group view with managed users', async ({
      UserMembershipController,
      req,
      subscription,
      users,
    }) => {
      expect.assertions(5)
      subscription.managedUsersEnabled = true
      await UserMembershipController.manageGroupMembers(req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/group-members-react')
          expect(viewParams.users).to.deep.equal(users)
          expect(viewParams.groupSize).to.equal(subscription.membersLimit)
          expect(viewParams.managedUsersActive).to.equal(true)
          expect(viewParams.isUserGroupManager).to.equal(false)
        },
      })
    })

    describe('canUseAddSeatsFeature', () => {
      beforeEach(ctx => {
        ctx.subscription.admin_id = 'mock-admin-id'
        ctx.SessionManager.getLoggedInUserId.mockReturnValue('mock-admin-id')
      })

      it('should be true when all conditions are met', async ({
        UserMembershipController,
        req,
      }) => {
        expect.assertions(1)
        await UserMembershipController.manageGroupMembers(req, {
          render: (viewPath, viewParams) => {
            expect(viewParams.canUseAddSeatsFeature).to.equal(true)
          },
        })
      })

      it('should be false when plan does not support flexible licensing', async ({
        UserMembershipController,
        req,
        PlansLocator,
      }) => {
        expect.assertions(1)
        PlansLocator.findLocalPlanInSettings.mockReturnValue({
          planCode: 'group_professional',
          canUseFlexibleLicensing: false,
        })
        await UserMembershipController.manageGroupMembers(req, {
          render: (viewPath, viewParams) => {
            expect(viewParams.canUseAddSeatsFeature).to.equal(false)
          },
        })
      })

      it('should be false when user is not admin', async ({
        UserMembershipController,
        req,
        SessionManager,
      }) => {
        expect.assertions(1)
        SessionManager.getLoggedInUserId.mockReturnValue('mock-user-id')
        await UserMembershipController.manageGroupMembers(req, {
          render: (viewPath, viewParams) => {
            expect(viewParams.canUseAddSeatsFeature).to.equal(false)
          },
        })
      })

      it('should be false when recurly subscription does not exist', async ({
        UserMembershipController,
        req,
        subscription,
      }) => {
        expect.assertions(1)
        subscription.recurlySubscription_id = null
        await UserMembershipController.manageGroupMembers(req, {
          render: (viewPath, viewParams) => {
            expect(viewParams.canUseAddSeatsFeature).to.equal(false)
          },
        })
      })

      it('should be false when recurly subscription has pending changes', async ({
        UserMembershipController,
        req,
        RecurlyClient,
      }) => {
        expect.assertions(1)
        RecurlyClient.promises.getSubscription.mockResolvedValue({
          id: recurlySubscriptionId,
          pendingChange: {},
        })
        await UserMembershipController.manageGroupMembers(req, {
          render: (viewPath, viewParams) => {
            expect(viewParams.canUseAddSeatsFeature).to.equal(false)
          },
        })
      })

      it('should be false when fetching recurly subscription fails', async ({
        UserMembershipController,
        req,
        RecurlyClient,
      }) => {
        expect.assertions(1)
        RecurlyClient.promises.getSubscription.mockRejectedValue(
          new Error('Recurly error')
        )
        await UserMembershipController.manageGroupMembers(req, {
          render: (viewPath, viewParams) => {
            expect(viewParams.canUseAddSeatsFeature).to.equal(false)
          },
        })
      })

      it('should be false when plan is not found', async ({
        UserMembershipController,
        req,
        PlansLocator,
      }) => {
        expect.assertions(1)
        PlansLocator.findLocalPlanInSettings.mockReturnValue(null)
        await UserMembershipController.manageGroupMembers(req, {
          render: (viewPath, viewParams) => {
            expect(viewParams.canUseAddSeatsFeature).to.equal(false)
          },
        })
      })
    })

    it('render group managers view', async ({
      UserMembershipController,
      req,
      user,
    }) => {
      expect.assertions(2)
      req.user = user
      req.entityConfig = EntityConfigs.groupManagers
      await UserMembershipController.manageGroupManagers(req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/group-managers-react')
          expect(viewParams.groupSize).to.equal(undefined)
        },
      })
    })

    it('render institution view', async ({
      UserMembershipController,
      req,
      user,
      institution,
    }) => {
      expect.assertions(3)
      req.user = user
      req.entity = institution
      req.entityConfig = EntityConfigs.institution
      await UserMembershipController.manageInstitutionManagers(req, {
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

  describe('add', () => {
    beforeEach(ctx => {
      ctx.req.body.email = ctx.newUser.email
      ctx.req.entity = ctx.subscription
      ctx.req.entityConfig = EntityConfigs.groupManagers
    })

    it('add user', async ({
      UserMembershipController,
      req,
      UserMembershipHandler,
      subscription,
      newUser,
    }) => {
      expect.assertions(1)
      await UserMembershipController.add(req, {
        json: () => {
          expect(UserMembershipHandler.promises.addUser).toHaveBeenCalledWith(
            subscription,
            {
              modelName: 'Subscription',
              baseQuery: { groupPlan: true },
              fields: {
                access: 'manager_ids',
                membership: 'member_ids',
                name: 'teamName',
                primaryKey: '_id',
                read: ['manager_ids'],
                write: 'manager_ids',
              },
            },
            newUser.email
          )
        },
      })
    })

    it('return user object', async ({
      UserMembershipController,
      req,
      newUser,
    }) => {
      expect.assertions(1)
      await UserMembershipController.add(req, {
        json: payload => {
          expect(payload.user).to.equal(newUser)
        },
      })
    })

    it('handle readOnly entity', async ({ UserMembershipController, req }) => {
      expect.assertions(2)
      req.entityConfig = EntityConfigs.group
      await UserMembershipController.add(req, null, error => {
        expect(error).to.exist
        expect(error).to.be.an.instanceof(Errors.NotFoundError)
      })
    })

    it('handle user already added', async ({
      UserMembershipController,
      req,
      UserMembershipHandler,
    }) => {
      expect.assertions(1)
      UserMembershipHandler.promises.addUser.mockRejectedValue(
        new UserMembershipErrors.UserAlreadyAddedError()
      )
      await UserMembershipController.add(
        req,
        {
          status: () => ({
            json: payload => {
              expect(payload.error.code).to.equal('user_already_added')
            },
          }),
        },

        () => {}
      )
    })

    it('handle user not found', async ({
      UserMembershipController,
      req,
      UserMembershipHandler,
    }) => {
      expect.assertions(1)
      UserMembershipHandler.promises.addUser.mockRejectedValue(
        new UserMembershipErrors.UserNotFoundError()
      )
      await UserMembershipController.add(req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('user_not_found')
          },
        }),
      })
    })

    it('handle invalid email', async ({ UserMembershipController, req }) => {
      expect.assertions(1)
      req.body.email = 'not_valid_email'
      await UserMembershipController.add(req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('invalid_email')
          },
        }),
      })
    })
  })

  describe('remove', () => {
    beforeEach(ctx => {
      ctx.req.params.userId = ctx.newUser._id
      ctx.req.entity = ctx.subscription
      ctx.req.entityConfig = EntityConfigs.groupManagers
    })

    it('remove user', async ({
      UserMembershipController,
      req,
      UserMembershipHandler,
      subscription,
      newUser,
    }) => {
      expect.assertions(1)
      await UserMembershipController.remove(req, {
        sendStatus: () => {
          expect(
            UserMembershipHandler.promises.removeUser
          ).toHaveBeenCalledWith(
            subscription,
            {
              modelName: 'Subscription',

              baseQuery: {
                groupPlan: true,
              },
              fields: {
                access: 'manager_ids',
                membership: 'member_ids',
                name: 'teamName',
                primaryKey: '_id',
                read: ['manager_ids'],
                write: 'manager_ids',
              },
            },
            newUser._id
          )
        },
      })
    })

    it('handle readOnly entity', async ({ UserMembershipController, req }) => {
      expect.assertions(2)
      req.entityConfig = EntityConfigs.group
      await UserMembershipController.remove(req, null, error => {
        expect(error).to.exist
        expect(error).to.be.an.instanceof(Errors.NotFoundError)
      })
    })

    it('prevent self removal', async ({
      UserMembershipController,
      req,
      user,
    }) => {
      expect.assertions(1)
      req.params.userId = user._id
      await UserMembershipController.remove(req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('managers_cannot_remove_self')
          },
        }),
      })
    })

    it('prevent admin removal', async ({
      UserMembershipController,
      req,
      UserMembershipHandler,
    }) => {
      expect.assertions(1)
      UserMembershipHandler.promises.removeUser.mockRejectedValue(
        new UserMembershipErrors.UserIsManagerError()
      )
      await UserMembershipController.remove(req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('managers_cannot_remove_admin')
          },
        }),
      })
    })
  })

  describe('exportCsv', () => {
    beforeEach(ctx => {
      ctx.req.entity = ctx.subscription
      ctx.req.entityConfig = EntityConfigs.groupManagers
      ctx.res = new MockResponse(vi)
      ctx.UserMembershipController.exportCsv(ctx.req, ctx.res)
    })

    it('get users', ({ UserMembershipHandler, subscription }) => {
      expect(UserMembershipHandler.promises.getUsers).toHaveBeenCalledWith(
        subscription,
        {
          modelName: 'Subscription',
          baseQuery: { groupPlan: true },
          fields: {
            access: 'manager_ids',
            membership: 'member_ids',
            name: 'teamName',
            primaryKey: '_id',
            read: ['manager_ids'],
            write: 'manager_ids',
          },
        }
      )
    })

    it('should set the correct content type on the request', ({ res }) => {
      expect(res.contentType).toHaveBeenCalledWith('text/csv; charset=utf-8')
    })

    it('should name the exported csv file', ({ res }) => {
      expect(res.header).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="Group.csv"'
      )
    })

    it('should export the correct csv', ({ res }) => {
      expect(res.send).toHaveBeenCalledWith(
        '"email","last_logged_in_at","last_active_at"\n"mock-email-1@foo.com","2020-08-09T12:43:11.467Z","2021-08-09T12:43:11.467Z"\n"mock-email-2@foo.com","2020-05-20T10:41:11.407Z","2021-05-20T10:41:11.407Z"\n"mock-email-3@foo.com","2021-08-10T10:41:11.407Z","2021-08-20T10:41:11.407Z"\n"mock-email-4@foo.com","2021-01-01T10:41:11.407Z","2021-01-02T10:41:11.407Z"\n"mock-email-5@foo.com","2023-01-01T10:41:11.407Z","2023-01-02T10:41:11.407Z"\n"mock-email-6@foo.com","2024-01-01T10:41:11.407Z","2024-01-02T10:41:11.407Z"'
      )
    })
  })

  describe('exportCsv when group is managed', () => {
    beforeEach(ctx => {
      ctx.req.entity = Object.assign(
        { managedUsersEnabled: true },
        ctx.subscription
      )
      ctx.req.entityConfig = EntityConfigs.groupManagers
      ctx.res = new MockResponse(vi)
      ctx.UserMembershipController.exportCsv(ctx.req, ctx.res)
    })

    it('should export the correct csv', ({ res }) => {
      expect(res.send).toHaveBeenCalledWith(
        '"email","last_logged_in_at","last_active_at","managed"\n"mock-email-1@foo.com","2020-08-09T12:43:11.467Z","2021-08-09T12:43:11.467Z",false\n"mock-email-2@foo.com","2020-05-20T10:41:11.407Z","2021-05-20T10:41:11.407Z",false\n"mock-email-3@foo.com","2021-08-10T10:41:11.407Z","2021-08-20T10:41:11.407Z",false\n"mock-email-4@foo.com","2021-01-01T10:41:11.407Z","2021-01-02T10:41:11.407Z",true\n"mock-email-5@foo.com","2023-01-01T10:41:11.407Z","2023-01-02T10:41:11.407Z",false\n"mock-email-6@foo.com","2024-01-01T10:41:11.407Z","2024-01-02T10:41:11.407Z",true'
      )
    })
  })

  describe('exportCsv when group has SSO', () => {
    beforeEach(ctx => {
      ctx.req.entity = Object.assign(
        { ssoConfig: 'sso-config-id' },
        ctx.subscription
      )
      ctx.req.entityConfig = EntityConfigs.groupManagers
      ctx.Modules.promises.hooks.fire.mockResolvedValue([true])
      ctx.res = new MockResponse(vi)
      ctx.UserMembershipController.exportCsv(ctx.req, ctx.res)
    })

    it('should export the correct csv', ({ res }) => {
      expect(res.send).toHaveBeenCalledWith(
        '"email","last_logged_in_at","last_active_at","sso"\n"mock-email-1@foo.com","2020-08-09T12:43:11.467Z","2021-08-09T12:43:11.467Z",false\n"mock-email-2@foo.com","2020-05-20T10:41:11.407Z","2021-05-20T10:41:11.407Z",false\n"mock-email-3@foo.com","2021-08-10T10:41:11.407Z","2021-08-20T10:41:11.407Z",false\n"mock-email-4@foo.com","2021-01-01T10:41:11.407Z","2021-01-02T10:41:11.407Z",false\n"mock-email-5@foo.com","2023-01-01T10:41:11.407Z","2023-01-02T10:41:11.407Z",true\n"mock-email-6@foo.com","2024-01-01T10:41:11.407Z","2024-01-02T10:41:11.407Z",true'
      )
    })
  })

  describe('exportCsv when group has SSO and managed users enabled', () => {
    beforeEach(ctx => {
      ctx.req.entity = Object.assign(
        { managedUsersEnabled: true },
        { ssoConfig: 'sso-config-id' },
        ctx.subscription
      )
      ctx.req.entityConfig = EntityConfigs.groupManagers
      ctx.Modules.promises.hooks.fire.mockResolvedValue([true])
      ctx.res = new MockResponse(vi)
      ctx.UserMembershipController.exportCsv(ctx.req, ctx.res)
    })

    it('should export the correct csv', ({ res }) => {
      expect(res.send).toHaveBeenCalledWith(
        '"email","last_logged_in_at","last_active_at","managed","sso"\n"mock-email-1@foo.com","2020-08-09T12:43:11.467Z","2021-08-09T12:43:11.467Z",false,false\n"mock-email-2@foo.com","2020-05-20T10:41:11.407Z","2021-05-20T10:41:11.407Z",false,false\n"mock-email-3@foo.com","2021-08-10T10:41:11.407Z","2021-08-20T10:41:11.407Z",false,false\n"mock-email-4@foo.com","2021-01-01T10:41:11.407Z","2021-01-02T10:41:11.407Z",true,false\n"mock-email-5@foo.com","2023-01-01T10:41:11.407Z","2023-01-02T10:41:11.407Z",false,true\n"mock-email-6@foo.com","2024-01-01T10:41:11.407Z","2024-01-02T10:41:11.407Z",true,true'
      )
    })
  })

  describe('new', () => {
    beforeEach(ctx => {
      ctx.req.params.name = 'publisher'
      ctx.req.params.id = 'abc'
    })

    it('renders view', async ({ UserMembershipController, req }) => {
      expect.assertions(2)
      await UserMembershipController.new(req, {
        render: (viewPath, data) => {
          expect(data.entityName).to.eq('publisher')
          expect(data.entityId).to.eq('abc')
        },
      })
    })
  })

  describe('create', () => {
    beforeEach(ctx => {
      ctx.req.params.name = 'institution'
      ctx.req.entityConfig = EntityConfigs.institution
      ctx.req.params.id = 123
    })

    it('creates institution', async ({
      UserMembershipController,
      req,
      UserMembershipHandler,
    }) => {
      expect.assertions(2)
      await UserMembershipController.create(req, {
        redirect: path => {
          expect(path).to.eq(EntityConfigs.institution.pathsFor(123).index)
          expect(
            UserMembershipHandler.promises.createEntity
          ).toHaveBeenCalledWith(123, {
            fields: {
              access: 'managerIds',
              membership: 'member_ids',
              name: 'name',
              primaryKey: 'v1Id',
              read: ['managerIds'],
              write: 'managerIds',
            },
            modelName: 'Institution',
            pathsFor: EntityConfigs.institution.pathsFor,
          })
        },
      })
    })
  })
})
