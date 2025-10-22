import { vi, expect } from 'vitest'
import mongodb from 'mongodb-legacy'
import EntityConfigs from '../../../../app/src/Features/UserMembership/UserMembershipEntityConfigs.mjs'
import UserMembershipErrors from '../../../../app/src/Features/UserMembership/UserMembershipErrors.mjs'

const { ObjectId } = mongodb

const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipHandler'

const serializeIds = ids =>
  ids.map(id => (id instanceof ObjectId ? `objectId-${id.toString()}` : id))

vi.mock(
  '../../../../app/src/Features/UserMembership/UserMembershipErrors.mjs',
  () =>
    vi.importActual(
      '../../../../app/src/Features/UserMembership/UserMembershipErrors.mjs'
    )
)

describe('UserMembershipHandler', function () {
  beforeEach(async function (ctx) {
    ctx.user = { _id: new ObjectId() }
    ctx.newUser = { _id: new ObjectId(), email: 'new-user-email@foo.bar' }
    ctx.fakeEntityId = new ObjectId()
    ctx.subscription = {
      _id: 'mock-subscription-id',
      groupPlan: true,
      membersLimit: 10,
      member_ids: [new ObjectId(), new ObjectId()],
      manager_ids: [new ObjectId()],
      invited_emails: ['mock-email-1@foo.com'],
      teamInvites: [{ email: 'mock-email-1@bar.com' }],
      update: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(),
      }),
    }
    ctx.institution = {
      _id: 'mock-institution-id',
      v1Id: 123,
      managerIds: [new ObjectId(), new ObjectId(), new ObjectId()],
      updateOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(),
      }),
    }
    ctx.publisher = {
      _id: 'mock-publisher-id',
      slug: 'slug',
      managerIds: [new ObjectId(), new ObjectId()],
      updateOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(),
      }),
    }

    ctx.UserMembershipViewModel = {
      promises: {
        buildAsync: vi.fn().mockResolvedValue([{ _id: 'mock-member-id' }]),
      },
      build: vi.fn().mockReturnValue(ctx.newUser),
    }
    ctx.UserGetter = {
      promises: {
        getUserByAnyEmail: vi.fn().mockResolvedValue(ctx.newUser),
      },
    }
    ctx.Institution = {
      findOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(ctx.institution),
      }),
    }
    ctx.Subscription = {
      findOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(ctx.subscription),
      }),
    }
    ctx.Publisher = {
      findOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(ctx.publisher),
      }),
      create: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(ctx.publisher),
      }),
    }

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock(
      '../../../../app/src/Features/UserMembership/UserMembershipViewModel',
      () => ({
        default: ctx.UserMembershipViewModel,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/models/Institution', () => ({
      Institution: ctx.Institution,
    }))

    vi.doMock('../../../../app/src/models/Subscription', () => ({
      Subscription: ctx.Subscription,
    }))

    vi.doMock('../../../../app/src/models/Publisher', () => ({
      Publisher: ctx.Publisher,
    }))

    ctx.UserMembershipHandler = (await import(modulePath)).default
  })

  describe('getEntityWithoutAuthorizationCheck', function () {
    it('get publisher', async function (ctx) {
      const subscription =
        await ctx.UserMembershipHandler.promises.getEntityWithoutAuthorizationCheck(
          ctx.fakeEntityId,
          EntityConfigs.publisher
        )
      const expectedQuery = { slug: ctx.fakeEntityId }
      expect(ctx.Publisher.findOne).toHaveBeenCalledWith(expectedQuery)
      expect(subscription).to.equal(ctx.publisher)
    })
  })

  describe('getUsers', function () {
    describe('group', function () {
      it('build view model for all users', async function (ctx) {
        await ctx.UserMembershipHandler.promises.getUsers(
          ctx.subscription,
          EntityConfigs.group
        )
        expect(
          serializeIds(
            ctx.UserMembershipViewModel.promises.buildAsync.mock.calls[0][0]
          )
        ).toEqual(
          serializeIds(
            ctx.subscription.invited_emails.concat(
              ctx.subscription.teamInvites[0].email,
              ctx.subscription.member_ids
            )
          )
        )
      })
    })

    describe('group managers', function () {
      it('build view model for all managers', async function (ctx) {
        await ctx.UserMembershipHandler.promises.getUsers(
          ctx.subscription,
          EntityConfigs.groupManagers
        )
        expect(
          serializeIds(
            ctx.UserMembershipViewModel.promises.buildAsync.mock.calls[0][0]
          )
        ).toEqual(serializeIds(ctx.subscription.manager_ids))
      })
    })

    describe('institution', function () {
      it('build view model for all managers', async function (ctx) {
        await ctx.UserMembershipHandler.promises.getUsers(
          ctx.institution,
          EntityConfigs.institution
        )
        expect(
          serializeIds(
            ctx.UserMembershipViewModel.promises.buildAsync.mock.calls[0][0]
          )
        ).toEqual(serializeIds(ctx.institution.managerIds))
      })
    })
  })

  describe('createEntity', function () {
    it('creates publisher', async function (ctx) {
      await ctx.UserMembershipHandler.promises.createEntity(
        ctx.fakeEntityId,
        EntityConfigs.publisher
      )
      expect(ctx.Publisher.create).toHaveBeenCalledWith({
        slug: ctx.fakeEntityId,
      })
    })
  })

  describe('addUser', function () {
    beforeEach(function (ctx) {
      ctx.email = ctx.newUser.email
    })

    describe('institution', function () {
      it('get user', async function (ctx) {
        await ctx.UserMembershipHandler.promises.addUser(
          ctx.institution,
          EntityConfigs.institution,
          ctx.email
        )
        expect(ctx.UserGetter.promises.getUserByAnyEmail).toHaveBeenCalledWith(
          ctx.email
        )
      })

      it('handle user not found', async function (ctx) {
        ctx.UserGetter.promises.getUserByAnyEmail.mockResolvedValue(null)
        try {
          await ctx.UserMembershipHandler.promises.addUser(
            ctx.institution,
            EntityConfigs.institution,
            ctx.email
          )
          expect.fail('Expected addUser to throw')
        } catch (err) {
          expect(err).toBeInstanceOf(UserMembershipErrors.UserNotFoundError)
        }
      })

      it('handle user already added', async function (ctx) {
        ctx.institution.managerIds.push(ctx.newUser._id)
        try {
          await ctx.UserMembershipHandler.promises.addUser(
            ctx.institution,
            EntityConfigs.institution,
            ctx.email
          )
          expect.fail('Expected addUser to throw')
        } catch (err) {
          expect(err).toBeInstanceOf(UserMembershipErrors.UserAlreadyAddedError)
        }
      })

      it('add user to institution', async function (ctx) {
        await ctx.UserMembershipHandler.promises.addUser(
          ctx.institution,
          EntityConfigs.institution,
          ctx.email
        )
        expect(ctx.institution.updateOne).toHaveBeenCalledWith({
          $addToSet: { managerIds: ctx.newUser._id },
        })
      })

      it('return user view', async function (ctx) {
        const user = await ctx.UserMembershipHandler.promises.addUser(
          ctx.institution,
          EntityConfigs.institution,
          ctx.email
        )
        expect(user).to.equal(ctx.newUser)
      })
    })
  })

  describe('removeUser', function () {
    describe('institution', function () {
      it('remove user from institution', async function (ctx) {
        await ctx.UserMembershipHandler.promises.removeUser(
          ctx.institution,
          EntityConfigs.institution,
          ctx.newUser._id
        )
        expect(ctx.institution.updateOne).toHaveBeenCalledWith({
          $pull: { managerIds: ctx.newUser._id },
        })
      })

      it('handle admin', async function (ctx) {
        ctx.subscription.admin_id = ctx.newUser._id
        try {
          await ctx.UserMembershipHandler.promises.removeUser(
            ctx.subscription,
            EntityConfigs.groupManagers,
            ctx.newUser._id
          )
          expect.fail('Expected removeUser to throw')
        } catch (err) {
          expect(err).toBeInstanceOf(UserMembershipErrors.UserIsManagerError)
        }
      })
    })
  })
})
