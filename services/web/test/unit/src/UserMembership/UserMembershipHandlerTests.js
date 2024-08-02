const { expect } = require('chai')
const sinon = require('sinon')
const assertCalledWith = sinon.assert.calledWith
const { ObjectId } = require('mongodb-legacy')
const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipHandler'
const SandboxedModule = require('sandboxed-module')
const EntityConfigs = require('../../../../app/src/Features/UserMembership/UserMembershipEntityConfigs')
const {
  UserIsManagerError,
  UserNotFoundError,
  UserAlreadyAddedError,
} = require('../../../../app/src/Features/UserMembership/UserMembershipErrors')

describe('UserMembershipHandler', function () {
  beforeEach(function () {
    this.user = { _id: new ObjectId() }
    this.newUser = { _id: new ObjectId(), email: 'new-user-email@foo.bar' }
    this.fakeEntityId = new ObjectId()
    this.subscription = {
      _id: 'mock-subscription-id',
      groupPlan: true,
      membersLimit: 10,
      member_ids: [new ObjectId(), new ObjectId()],
      manager_ids: [new ObjectId()],
      invited_emails: ['mock-email-1@foo.com'],
      teamInvites: [{ email: 'mock-email-1@bar.com' }],
      update: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
    }
    this.institution = {
      _id: 'mock-institution-id',
      v1Id: 123,
      managerIds: [new ObjectId(), new ObjectId(), new ObjectId()],
      updateOne: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
    }
    this.publisher = {
      _id: 'mock-publisher-id',
      slug: 'slug',
      managerIds: [new ObjectId(), new ObjectId()],
      updateOne: sinon.stub().returns({
        exec: sinon.stub().resolves(),
      }),
    }

    this.UserMembershipViewModel = {
      promises: {
        buildAsync: sinon.stub().resolves({ _id: 'mock-member-id' }),
      },
      build: sinon.stub().returns(this.newUser),
    }
    this.UserGetter = {
      promises: {
        getUserByAnyEmail: sinon.stub().resolves(this.newUser),
      },
    }
    this.Institution = {
      findOne: sinon.stub().returns({
        exec: sinon.stub().resolves(this.institution),
      }),
    }
    this.Subscription = {
      findOne: sinon.stub().returns({
        exec: sinon.stub().resolves(this.subscription),
      }),
    }
    this.Publisher = {
      findOne: sinon.stub().returns({
        exec: sinon.stub().resolves(this.publisher),
      }),
      create: sinon.stub().returns({
        exec: sinon.stub().resolves(this.publisher),
      }),
    }
    this.UserMembershipHandler = SandboxedModule.require(modulePath, {
      requires: {
        'mongodb-legacy': { ObjectId },
        './UserMembershipErrors': {
          UserIsManagerError,
          UserNotFoundError,
          UserAlreadyAddedError,
        },
        './UserMembershipViewModel': this.UserMembershipViewModel,
        '../User/UserGetter': this.UserGetter,
        '../../models/Institution': {
          Institution: this.Institution,
        },
        '../../models/Subscription': {
          Subscription: this.Subscription,
        },
        '../../models/Publisher': {
          Publisher: this.Publisher,
        },
      },
    })
  })

  describe('getEntityWithoutAuthorizationCheck', function () {
    it('get publisher', async function () {
      const subscription =
        await this.UserMembershipHandler.promises.getEntityWithoutAuthorizationCheck(
          this.fakeEntityId,
          EntityConfigs.publisher
        )
      const expectedQuery = { slug: this.fakeEntityId }
      assertCalledWith(this.Publisher.findOne, expectedQuery)
      expect(subscription).to.equal(this.publisher)
    })
  })

  describe('getUsers', function () {
    describe('group', function () {
      it('build view model for all users', async function () {
        await this.UserMembershipHandler.promises.getUsers(
          this.subscription,
          EntityConfigs.group
        )
        const expectedCallcount =
          this.subscription.member_ids.length +
          this.subscription.invited_emails.length +
          this.subscription.teamInvites.length
        expect(
          this.UserMembershipViewModel.promises.buildAsync.callCount
        ).to.equal(expectedCallcount)
      })
    })

    describe('group mamagers', function () {
      it('build view model for all managers', async function () {
        await this.UserMembershipHandler.promises.getUsers(
          this.subscription,
          EntityConfigs.groupManagers
        )
        const expectedCallcount = this.subscription.manager_ids.length
        expect(
          this.UserMembershipViewModel.promises.buildAsync.callCount
        ).to.equal(expectedCallcount)
      })
    })

    describe('institution', function () {
      it('build view model for all managers', async function () {
        await this.UserMembershipHandler.promises.getUsers(
          this.institution,
          EntityConfigs.institution
        )

        const expectedCallcount = this.institution.managerIds.length
        expect(
          this.UserMembershipViewModel.promises.buildAsync.callCount
        ).to.equal(expectedCallcount)
      })
    })
  })

  describe('createEntity', function () {
    it('creates publisher', async function () {
      await this.UserMembershipHandler.promises.createEntity(
        this.fakeEntityId,
        EntityConfigs.publisher
      )
      assertCalledWith(this.Publisher.create, { slug: this.fakeEntityId })
    })
  })

  describe('addUser', function () {
    beforeEach(function () {
      this.email = this.newUser.email
    })

    describe('institution', function () {
      it('get user', async function () {
        await this.UserMembershipHandler.promises.addUser(
          this.institution,
          EntityConfigs.institution,
          this.email
        )
        assertCalledWith(this.UserGetter.promises.getUserByAnyEmail, this.email)
      })

      it('handle user not found', async function () {
        this.UserGetter.promises.getUserByAnyEmail.resolves(null)
        expect(
          this.UserMembershipHandler.promises.addUser(
            this.institution,
            EntityConfigs.institution,
            this.email
          )
        ).to.be.rejectedWith(UserNotFoundError)
      })

      it('handle user already added', async function () {
        this.institution.managerIds.push(this.newUser._id)
        expect(
          this.UserMembershipHandler.promises.addUser(
            this.institution,
            EntityConfigs.institution,
            this.email
          )
        ).to.be.rejectedWith(UserAlreadyAddedError)
      })

      it('add user to institution', async function () {
        await this.UserMembershipHandler.promises.addUser(
          this.institution,
          EntityConfigs.institution,
          this.email
        )
        assertCalledWith(this.institution.updateOne, {
          $addToSet: { managerIds: this.newUser._id },
        })
      })

      it('return user view', async function () {
        const user = await this.UserMembershipHandler.promises.addUser(
          this.institution,
          EntityConfigs.institution,
          this.email
        )
        user.should.equal(this.newUser)
      })
    })
  })

  describe('removeUser', function () {
    describe('institution', function () {
      it('remove user from institution', async function () {
        await this.UserMembershipHandler.promises.removeUser(
          this.institution,
          EntityConfigs.institution,
          this.newUser._id
        )
        assertCalledWith(this.institution.updateOne, {
          $pull: { managerIds: this.newUser._id },
        })
      })

      it('handle admin', async function () {
        this.subscription.admin_id = this.newUser._id
        expect(
          this.UserMembershipHandler.promises.removeUser(
            this.subscription,
            EntityConfigs.groupManagers,
            this.newUser._id
          )
        ).to.be.rejectedWith(UserIsManagerError)
      })
    })
  })
})
