const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const MockRequest = require('../helpers/MockRequest')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionGroupHandler'

describe('SubscriptionGroupHandler', function () {
  beforeEach(function () {
    this.adminUser_id = '12321'
    this.newEmail = 'bob@smith.com'
    this.user_id = '3121321'
    this.email = 'jim@example.com'
    this.user = { _id: this.user_id, email: this.newEmail }
    this.subscription_id = '31DSd1123D'
    this.adding = 1
    this.paymentMethod = { cardType: 'Visa', lastFour: '1111' }
    this.localPlanInSettings = {
      membersLimit: 2,
      membersLimitAddOn: 'additional-license',
    }

    this.subscription = {
      admin_id: this.adminUser_id,
      manager_ids: [this.adminUser_id],
      _id: this.subscription_id,
    }

    this.changeRequest = {
      timeframe: 'now',
      subscription: {
        id: 'test_id',
      },
    }

    this.recurlySubscription = {
      id: 123,
      addOns: [
        {
          code: 'additional-license',
          quantity: 1,
        },
      ],
      getRequestForAddOnUpdate: sinon.stub().returns(this.changeRequest),
      getRequestForFlexibleLicensingGroupPlanUpgrade: sinon
        .stub()
        .returns(this.changeRequest),
    }

    this.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves({ groupPlan: true }),
        getSubscriptionByMemberIdAndId: sinon.stub(),
        getSubscription: sinon.stub().resolves(this.subscription),
      },
    }

    this.changePreview = {
      currency: 'USD',
    }

    this.SubscriptionController = {
      makeChangePreview: sinon.stub().resolves(this.changePreview),
    }

    this.SubscriptionUpdater = {
      promises: {
        removeUserFromGroup: sinon.stub().resolves(),
        getSubscription: sinon.stub().resolves(),
      },
    }

    this.Subscription = {
      updateOne: sinon.stub().returns({ exec: sinon.stub().resolves }),
      updateMany: sinon.stub().returns({ exec: sinon.stub().resolves }),
      findOne: sinon.stub().returns({ exec: sinon.stub().resolves }),
    }

    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(this.user._id),
    }

    this.previewSubscriptionChange = {
      nextAddOns: [
        {
          code: 'additional-license',
          quantity: this.recurlySubscription.addOns[0].quantity + this.adding,
        },
      ],
      subscription: {
        planName: 'test plan',
      },
    }

    this.applySubscriptionChange = {}

    this.RecurlyClient = {
      promises: {
        getSubscription: sinon.stub().resolves(this.recurlySubscription),
        getPaymentMethod: sinon.stub().resolves(this.paymentMethod),
        previewSubscriptionChange: sinon
          .stub()
          .resolves(this.previewSubscriptionChange),
        applySubscriptionChangeRequest: sinon
          .stub()
          .resolves(this.applySubscriptionChange),
      },
    }

    this.PlansLocator = {
      findLocalPlanInSettings: sinon.stub(this.localPlanInSettings),
    }

    this.SubscriptionHandler = {
      promises: {
        syncSubscription: sinon.stub().resolves(),
      },
    }

    this.Handler = SandboxedModule.require(modulePath, {
      requires: {
        './SubscriptionUpdater': this.SubscriptionUpdater,
        './SubscriptionLocator': this.SubscriptionLocator,
        './SubscriptionController': this.SubscriptionController,
        './SubscriptionHandler': this.SubscriptionHandler,
        '../../models/Subscription': {
          Subscription: this.Subscription,
        },
        './RecurlyClient': this.RecurlyClient,
        './PlansLocator': this.PlansLocator,
        '../Authentication/SessionManager': this.SessionManager,
      },
    })
  })

  describe('removeUserFromGroup', function () {
    it('should call the subscription updater to remove the user', async function () {
      await this.Handler.promises.removeUserFromGroup(
        this.adminUser_id,
        this.user._id
      )

      this.SubscriptionUpdater.promises.removeUserFromGroup
        .calledWith(this.adminUser_id, this.user._id)
        .should.equal(true)
    })
  })

  describe('replaceUserReferencesInGroups', function () {
    beforeEach(async function () {
      this.oldId = 'ba5eba11'
      this.newId = '5ca1ab1e'
      await this.Handler.promises.replaceUserReferencesInGroups(
        this.oldId,
        this.newId
      )
    })

    it('replaces the admin_id', function () {
      this.Subscription.updateOne
        .calledWith({ admin_id: this.oldId }, { admin_id: this.newId })
        .should.equal(true)
    })

    it('replaces the manager_ids', function () {
      this.Subscription.updateMany
        .calledWith(
          { manager_ids: 'ba5eba11' },
          { $addToSet: { manager_ids: '5ca1ab1e' } }
        )
        .should.equal(true)

      this.Subscription.updateMany
        .calledWith(
          { manager_ids: 'ba5eba11' },
          { $pull: { manager_ids: 'ba5eba11' } }
        )
        .should.equal(true)
    })

    it('replaces the member ids', function () {
      this.Subscription.updateMany
        .calledWith(
          { member_ids: this.oldId },
          { $addToSet: { member_ids: this.newId } }
        )
        .should.equal(true)

      this.Subscription.updateMany
        .calledWith(
          { member_ids: this.oldId },
          { $pull: { member_ids: this.oldId } }
        )
        .should.equal(true)
    })
  })

  describe('isUserPartOfGroup', function () {
    beforeEach(function () {
      this.subscription_id = '123ed13123'
    })

    it('should return true when user is part of subscription', async function () {
      this.SubscriptionLocator.promises.getSubscriptionByMemberIdAndId.resolves(
        {
          _id: this.subscription_id,
        }
      )
      const partOfGroup = await this.Handler.promises.isUserPartOfGroup(
        this.user_id,
        this.subscription_id
      )
      partOfGroup.should.equal(true)
    })

    it('should return false when no subscription is found', async function () {
      this.SubscriptionLocator.promises.getSubscriptionByMemberIdAndId.resolves(
        null
      )
      const partOfGroup = await this.Handler.promises.isUserPartOfGroup(
        this.user_id,
        this.subscription_id
      )
      partOfGroup.should.equal(false)
    })
  })

  describe('getTotalConfirmedUsersInGroup', function () {
    describe('for existing subscriptions', function () {
      beforeEach(function () {
        this.subscription.member_ids = ['12321', '3121321']
      })
      it('should call the subscription locator and return 2 users', async function () {
        const count = await this.Handler.promises.getTotalConfirmedUsersInGroup(
          this.subscription_id
        )
        this.SubscriptionLocator.promises.getSubscription
          .calledWith(this.subscription_id)
          .should.equal(true)
        count.should.equal(2)
      })
    })
    describe('for nonexistent subscriptions', function () {
      it('should return undefined', async function () {
        const count =
          await this.Handler.promises.getTotalConfirmedUsersInGroup('fake-id')
        expect(count).not.to.exist
      })
    })
  })

  describe('getUsersGroupSubscriptionDetails', function () {
    beforeEach(function () {
      this.req = new MockRequest()
      this.PlansLocator.findLocalPlanInSettings = sinon.stub().returns({
        ...this.localPlanInSettings,
        canUseFlexibleLicensing: true,
      })
    })

    it('should throw if the subscription is not a group plan', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({ groupPlan: false })

      await expect(
        this.Handler.promises.getUsersGroupSubscriptionDetails(this.req)
      ).to.be.rejectedWith('User subscription is not a group plan')
    })

    it('should return users group subscription details', async function () {
      const data = await this.Handler.promises.getUsersGroupSubscriptionDetails(
        this.req
      )

      expect(data).to.deep.equal({
        subscription: { groupPlan: true },
        plan: {
          membersLimit: 2,
          membersLimitAddOn: 'additional-license',
          canUseFlexibleLicensing: true,
        },
        recurlySubscription: this.recurlySubscription,
      })
    })
  })

  describe('add seats subscription change', function () {
    beforeEach(function () {
      this.req = new MockRequest()
      Object.assign(this.req.body, { adding: this.adding })
      this.PlansLocator.findLocalPlanInSettings = sinon.stub().returns({
        ...this.localPlanInSettings,
        canUseFlexibleLicensing: true,
      })
    })

    afterEach(function () {
      this.recurlySubscription.getRequestForAddOnUpdate
        .calledWith(
          'additional-license',
          this.recurlySubscription.addOns[0].quantity + this.adding
        )
        .should.equal(true)
    })

    describe('previewAddSeatsSubscriptionChange', function () {
      it('should return the subscription change preview', async function () {
        const preview =
          await this.Handler.promises.previewAddSeatsSubscriptionChange(
            this.req
          )

        this.RecurlyClient.promises.getPaymentMethod
          .calledWith(this.user_id)
          .should.equal(true)
        this.RecurlyClient.promises.previewSubscriptionChange
          .calledWith(this.changeRequest)
          .should.equal(true)
        this.SubscriptionController.makeChangePreview
          .calledWith(
            {
              type: 'add-on-update',
              addOn: {
                code: 'additional-license',
                quantity:
                  this.recurlySubscription.addOns[0].quantity + this.adding,
                prevQuantity: this.adding,
              },
            },
            this.previewSubscriptionChange,
            this.paymentMethod
          )
          .should.equal(true)
        preview.should.equal(this.changePreview)
      })
    })

    describe('createAddSeatsSubscriptionChange', function () {
      it('should change the subscription', async function () {
        const result =
          await this.Handler.promises.createAddSeatsSubscriptionChange(this.req)

        this.RecurlyClient.promises.applySubscriptionChangeRequest
          .calledWith(this.changeRequest)
          .should.equal(true)
        this.SubscriptionHandler.promises.syncSubscription
          .calledWith({ uuid: this.recurlySubscription.id }, this.user_id)
          .should.equal(true)
        expect(result).to.deep.equal({
          adding: this.req.body.adding,
        })
      })
    })
  })

  describe('ensureFlexibleLicensingEnabled', function () {
    it('should throw if the subscription can not use flexible licensing', async function () {
      await expect(
        this.Handler.promises.ensureFlexibleLicensingEnabled({
          canUseFlexibleLicensing: false,
        })
      ).to.be.rejectedWith('The group plan does not support flexible licencing')
    })
  })

  it('should not throw if the subscription can use flexible licensing', async function () {
    await expect(
      this.Handler.promises.ensureFlexibleLicensingEnabled({
        canUseFlexibleLicensing: true,
      })
    ).to.not.be.rejected
  })

  describe('upgradeGroupPlan', function () {
    it('should upgrade the subscription', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({ groupPlan: true, planCode: 'group_collaborator' })
      await this.Handler.promises.upgradeGroupPlan(this.user_id)
      this.RecurlyClient.promises.applySubscriptionChangeRequest
        .calledWith(this.changeRequest)
        .should.equal(true)
      this.SubscriptionHandler.promises.syncSubscription
        .calledWith({ uuid: this.changeRequest.subscription.id }, this.user_id)
        .should.equal(true)
    })

    it('should fail the upgrade if not eligible', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({ groupPlan: true, planCode: 'group_professional' })
      await expect(
        this.Handler.promises.upgradeGroupPlan(this.user_id)
      ).to.be.rejectedWith('Not eligible for group plan upgrade')
    })
  })

  describe('getGroupPlanUpgradePreview', function () {
    it('should generate preview for subscription upgrade', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({ groupPlan: true, planCode: 'group_collaborator' })
      const result = await this.Handler.promises.getGroupPlanUpgradePreview(
        this.user_id
      )
      this.RecurlyClient.promises.previewSubscriptionChange
        .calledWith(this.changeRequest)
        .should.equal(true)

      result.should.equal(this.changePreview)
    })
  })
})
