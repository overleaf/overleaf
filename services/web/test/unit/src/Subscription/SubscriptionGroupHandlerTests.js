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
    this.RecurlyEntities = {
      MEMBERS_LIMIT_ADD_ON_CODE: 'additional-license',
    }
    this.localPlanInSettings = {
      membersLimit: 5,
      membersLimitAddOn: this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
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
          code: this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
          quantity: 1,
        },
      ],
      getRequestForAddOnUpdate: sinon.stub().returns(this.changeRequest),
      getRequestForGroupPlanUpgrade: sinon.stub().returns(this.changeRequest),
      getRequestForAddOnPurchase: sinon.stub().returns(this.changeRequest),
      getRequestForFlexibleLicensingGroupPlanUpgrade: sinon
        .stub()
        .returns(this.changeRequest),
      currency: 'USD',
      hasAddOn(code) {
        return this.addOns.some(addOn => addOn.code === code)
      },
    }

    this.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves({
          groupPlan: true,
          recurlyStatus: {
            state: 'active',
          },
        }),
        getSubscriptionByMemberIdAndId: sinon.stub(),
        getSubscription: sinon.stub().resolves(this.subscription),
      },
    }

    this.changePreview = {
      currency: 'USD',
    }

    this.SubscriptionController = {
      makeChangePreview: sinon.stub().resolves(this.changePreview),
      getPlanNameForDisplay: sinon.stub().resolves(),
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
          code: this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
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
      findLocalPlanInSettings: sinon.stub().returns(this.localPlanInSettings),
    }

    this.SubscriptionHandler = {
      promises: {
        syncSubscription: sinon.stub().resolves(),
      },
    }

    this.GroupPlansData = {
      enterprise: {
        collaborator: {
          USD: {
            5: {
              price_in_cents: 10000,
              additional_license_legacy_price_in_cents: 5000,
            },
          },
        },
      },
      educational: {
        collaborator: {
          USD: {
            5: {
              price_in_cents: 10000,
              additional_license_legacy_price_in_cents: 5000,
            },
          },
        },
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
        './RecurlyEntities': this.RecurlyEntities,
        '../Authentication/SessionManager': this.SessionManager,
        './GroupPlansData': this.GroupPlansData,
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
        this.Handler.promises.getUsersGroupSubscriptionDetails(
          this.adminUser_id
        )
      ).to.be.rejectedWith('User subscription is not a group plan')
    })

    it('should return users group subscription details', async function () {
      const data = await this.Handler.promises.getUsersGroupSubscriptionDetails(
        this.adminUser_id
      )

      expect(data).to.deep.equal({
        userId: this.adminUser_id,
        subscription: {
          groupPlan: true,
          recurlyStatus: {
            state: 'active',
          },
        },
        plan: {
          membersLimit: 5,
          membersLimitAddOn: this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
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

    describe('has "additional-license" add-on', function () {
      beforeEach(function () {
        this.recurlySubscription.addOns = [
          {
            code: this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
            quantity: 6,
          },
        ]
        this.prevQuantity = this.recurlySubscription.addOns[0].quantity
        this.previewSubscriptionChange.nextAddOns = [
          {
            code: this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
            quantity: this.prevQuantity + this.adding,
          },
        ]
      })

      afterEach(function () {
        sinon.assert.notCalled(
          this.recurlySubscription.getRequestForAddOnPurchase
        )

        this.recurlySubscription.getRequestForAddOnUpdate
          .calledWith(
            this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
            this.recurlySubscription.addOns[0].quantity + this.adding
          )
          .should.equal(true)
      })

      describe('previewAddSeatsSubscriptionChange', function () {
        it('should return the subscription change preview', async function () {
          const preview =
            await this.Handler.promises.previewAddSeatsSubscriptionChange(
              this.adminUser_id,
              this.adding
            )
          this.RecurlyClient.promises.getPaymentMethod
            .calledWith(this.adminUser_id)
            .should.equal(true)
          this.RecurlyClient.promises.previewSubscriptionChange
            .calledWith(this.changeRequest)
            .should.equal(true)
          this.SubscriptionController.makeChangePreview
            .calledWith(
              {
                type: 'add-on-update',
                addOn: {
                  code: this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
                  quantity:
                    this.previewSubscriptionChange.nextAddOns[0].quantity,
                  prevQuantity: this.prevQuantity,
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
            await this.Handler.promises.createAddSeatsSubscriptionChange(
              this.adminUser_id,
              this.adding
            )

          this.RecurlyClient.promises.applySubscriptionChangeRequest
            .calledWith(this.changeRequest)
            .should.equal(true)
          this.SubscriptionHandler.promises.syncSubscription
            .calledWith(
              { uuid: this.recurlySubscription.id },
              this.adminUser_id
            )
            .should.equal(true)
          expect(result).to.deep.equal({
            adding: this.req.body.adding,
          })
        })
      })
    })

    describe('has no "additional-license" add-on', function () {
      beforeEach(function () {
        this.recurlySubscription.addOns = []
        this.prevQuantity = this.recurlySubscription.addOns[0]?.quantity ?? 0
        this.previewSubscriptionChange.nextAddOns = [
          {
            code: this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
            quantity: this.prevQuantity + this.adding,
          },
        ]
        this.PlansLocator.findLocalPlanInSettings = sinon.stub().returns({
          ...this.localPlanInSettings,
          planCode: 'group_collaborator_5_enterprise',
          canUseFlexibleLicensing: true,
        })
      })

      afterEach(function () {
        sinon.assert.notCalled(
          this.recurlySubscription.getRequestForAddOnUpdate
        )
      })

      describe('previewAddSeatsSubscriptionChange', function () {
        let preview

        afterEach(function () {
          this.RecurlyClient.promises.getPaymentMethod
            .calledWith(this.adminUser_id)
            .should.equal(true)
          this.RecurlyClient.promises.previewSubscriptionChange
            .calledWith(this.changeRequest)
            .should.equal(true)
          this.SubscriptionController.makeChangePreview
            .calledWith(
              {
                type: 'add-on-update',
                addOn: {
                  code: this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
                  quantity:
                    this.previewSubscriptionChange.nextAddOns[0].quantity,
                  prevQuantity: this.prevQuantity,
                },
              },
              this.previewSubscriptionChange,
              this.paymentMethod
            )
            .should.equal(true)
          preview.should.equal(this.changePreview)
        })

        it('should return the subscription change preview with legacy add-on price', async function () {
          this.recurlySubscription.planPrice =
            this.GroupPlansData.enterprise.collaborator.USD[5].price_in_cents /
              100 -
            1

          preview =
            await this.Handler.promises.previewAddSeatsSubscriptionChange(
              this.adminUser_id,
              this.adding
            )
          this.recurlySubscription.getRequestForAddOnPurchase
            .calledWithExactly(
              this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
              this.adding,
              this.GroupPlansData.enterprise.collaborator.USD[5]
                .additional_license_legacy_price_in_cents / 100
            )
            .should.equal(true)
        })

        it('should return the subscription change preview with non-legacy add-on price', async function () {
          this.recurlySubscription.planPrice =
            this.GroupPlansData.enterprise.collaborator.USD[5].price_in_cents /
            100

          preview =
            await this.Handler.promises.previewAddSeatsSubscriptionChange(
              this.adminUser_id,
              this.adding
            )
          this.recurlySubscription.getRequestForAddOnPurchase
            .calledWithExactly(
              this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
              this.adding,
              undefined
            )
            .should.equal(true)
        })

        it('should return the subscription change preview with legacy add-on price for small educational group', async function () {
          this.PlansLocator.findLocalPlanInSettings = sinon.stub().returns({
            ...this.localPlanInSettings,
            planCode: 'group_collaborator_5_educational',
            canUseFlexibleLicensing: true,
          })
          this.recurlySubscription.planPrice =
            this.GroupPlansData.enterprise.collaborator.USD[5].price_in_cents /
              100 +
            1

          preview =
            await this.Handler.promises.previewAddSeatsSubscriptionChange(
              this.adminUser_id,
              this.adding
            )
          this.recurlySubscription.getRequestForAddOnPurchase
            .calledWithExactly(
              this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
              this.adding,
              this.GroupPlansData.enterprise.collaborator.USD[5]
                .additional_license_legacy_price_in_cents / 100
            )
            .should.equal(true)
        })

        it('should return the subscription change preview with non-legacy add-on price for small educational group', async function () {
          this.PlansLocator.findLocalPlanInSettings = sinon.stub().returns({
            ...this.localPlanInSettings,
            planCode: 'group_collaborator_5_educational',
            canUseFlexibleLicensing: true,
          })
          this.recurlySubscription.planPrice =
            this.GroupPlansData.enterprise.collaborator.USD[5].price_in_cents /
            100

          preview =
            await this.Handler.promises.previewAddSeatsSubscriptionChange(
              this.adminUser_id,
              this.adding
            )
          this.recurlySubscription.getRequestForAddOnPurchase
            .calledWithExactly(
              this.RecurlyEntities.MEMBERS_LIMIT_ADD_ON_CODE,
              this.adding,
              undefined
            )
            .should.equal(true)
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
      ).to.be.rejectedWith('The group plan does not support flexible licensing')
    })

    it('should not throw if the subscription can use flexible licensing', async function () {
      await expect(
        this.Handler.promises.ensureFlexibleLicensingEnabled({
          canUseFlexibleLicensing: true,
        })
      ).to.not.be.rejected
    })
  })

  describe('ensureSubscriptionIsActive', function () {
    it('should throw if the subscription is not active', async function () {
      await expect(
        this.Handler.promises.ensureSubscriptionIsActive(this.subscription)
      ).to.be.rejectedWith('The subscription is not active')
    })

    it('should not throw if the subscription is active', async function () {
      await expect(
        this.Handler.promises.ensureSubscriptionIsActive({
          recurlyStatus: { state: 'active' },
        })
      ).to.not.be.rejected
    })
  })

  describe('ensureSubscriptionCollectionMethodIsNotManual', function () {
    it('should throw if the subscription is manually collected', async function () {
      await expect(
        this.Handler.promises.ensureSubscriptionCollectionMethodIsNotManual({
          get isCollectionMethodManual() {
            return true
          },
        })
      ).to.be.rejectedWith('This subscription is being collected manually')
    })

    it('should not throw if the subscription is automatically collected', async function () {
      await expect(
        this.Handler.promises.ensureSubscriptionCollectionMethodIsNotManual({
          get isCollectionMethodManual() {
            return false
          },
        })
      ).to.not.be.rejected
    })
  })

  describe('ensureSubscriptionHasNoPendingChanges', function () {
    it('should throw if the subscription has pending change', async function () {
      await expect(
        this.Handler.promises.ensureSubscriptionHasNoPendingChanges({
          pendingChange: {},
        })
      ).to.be.rejectedWith('This subscription has a pending change')
    })

    it('should not throw if the subscription has no pending change', async function () {
      await expect(
        this.Handler.promises.ensureSubscriptionHasNoPendingChanges({})
      ).to.not.be.rejected
    })
  })

  describe('upgradeGroupPlan', function () {
    it('should upgrade the subscription for flexible licensing group plans', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({
          groupPlan: true,
          recurlyStatus: {
            state: 'active',
          },
          planCode: 'group_collaborator',
        })
      await this.Handler.promises.upgradeGroupPlan(this.user_id)
      this.recurlySubscription.getRequestForGroupPlanUpgrade
        .calledWith('group_professional')
        .should.equal(true)
      this.RecurlyClient.promises.applySubscriptionChangeRequest
        .calledWith(this.changeRequest)
        .should.equal(true)
      this.SubscriptionHandler.promises.syncSubscription
        .calledWith({ uuid: this.changeRequest.subscription.id }, this.user_id)
        .should.equal(true)
    })

    it('should upgrade the subscription for legacy group plans', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({
          groupPlan: true,
          recurlyStatus: {
            state: 'active',
          },
          planCode: 'group_collaborator_10_educational',
        })
      await this.Handler.promises.upgradeGroupPlan(this.user_id)
      this.recurlySubscription.getRequestForGroupPlanUpgrade
        .calledWith('group_professional_10_educational')
        .should.equal(true)
      this.RecurlyClient.promises.applySubscriptionChangeRequest
        .calledWith(this.changeRequest)
        .should.equal(true)
      this.SubscriptionHandler.promises.syncSubscription
        .calledWith({ uuid: this.changeRequest.subscription.id }, this.user_id)
        .should.equal(true)
    })

    it('should fail the upgrade if is professional already', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({
          groupPlan: true,
          recurlyStatus: {
            state: 'active',
          },
          planCode: 'group_professional',
        })
      await expect(
        this.Handler.promises.upgradeGroupPlan(this.user_id)
      ).to.be.rejectedWith('Not eligible for group plan upgrade')
    })

    it('should fail the upgrade if not group plan', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({
          groupPlan: false,
          recurlyStatus: {
            state: 'active',
          },
          planCode: 'test_plan_code',
        })
      await expect(
        this.Handler.promises.upgradeGroupPlan(this.user_id)
      ).to.be.rejectedWith('Not eligible for group plan upgrade')
    })
  })

  describe('getGroupPlanUpgradePreview', function () {
    it('should generate preview for subscription upgrade', async function () {
      this.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({
          groupPlan: true,
          recurlyStatus: {
            state: 'active',
          },
          planCode: 'group_collaborator',
        })
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
