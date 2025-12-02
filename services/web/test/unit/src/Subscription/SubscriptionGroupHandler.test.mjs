import { vi, expect } from 'vitest'
import mongodb from 'mongodb-legacy'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import { InvalidEmailError } from '../../../../app/src/Features/Errors/Errors.js'

const { ObjectId } = mongodb

const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionGroupHandler.mjs'

describe('SubscriptionGroupHandler', function () {
  beforeEach(async function (ctx) {
    ctx.adminUser_id = '12321'
    ctx.newEmail = 'bob@smith.com'
    ctx.user_id = '3121321'
    ctx.email = 'jim@example.com'
    ctx.user = { _id: ctx.user_id, email: ctx.newEmail }
    ctx.subscription_id = '31DSd1123D'
    ctx.adding = 1
    ctx.paymentMethod = { cardType: 'Visa', lastFour: '1111' }
    ctx.PaymentProviderEntities = {
      MEMBERS_LIMIT_ADD_ON_CODE: 'additional-license',
    }
    ctx.localPlanInSettings = {
      membersLimit: 5,
      membersLimitAddOn: ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
    }

    ctx.subscription = {
      admin_id: ctx.adminUser_id,
      manager_ids: [ctx.adminUser_id],
      _id: ctx.subscription_id,
      membersLimit: 100,
    }

    ctx.changeRequest = {
      timeframe: 'now',
      subscription: {
        id: 'test_id',
      },
    }

    ctx.termsAndConditionsUpdate = {
      termsAndConditions: 'T&C copy',
    }

    ctx.poNumberAndTermsAndConditionsUpdate = {
      poNumber: '4444',
      ...ctx.termsAndConditionsUpdate,
    }

    ctx.recurlySubscription = {
      id: 123,
      addOns: [
        {
          code: ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
          quantity: 1,
        },
      ],
      getRequestForAddOnUpdate: sinon.stub().returns(ctx.changeRequest),
      getRequestForGroupPlanUpgrade: sinon.stub().returns(ctx.changeRequest),
      getRequestForAddOnPurchase: sinon.stub().returns(ctx.changeRequest),
      getRequestForFlexibleLicensingGroupPlanUpgrade: sinon
        .stub()
        .returns(ctx.changeRequest),
      getRequestForPoNumberAndTermsAndConditionsUpdate: sinon
        .stub()
        .returns(ctx.poNumberAndTermsAndConditionsUpdate),
      getRequestForTermsAndConditionsUpdate: sinon
        .stub()
        .returns(ctx.termsAndConditionsUpdate),
      currency: 'USD',
      hasAddOn(code) {
        return this.addOns.some(addOn => addOn.code === code)
      },
      get isCollectionMethodManual() {
        return false
      },
    }

    ctx.SubscriptionLocator = {
      promises: {
        getUsersSubscription: sinon.stub().resolves({
          groupPlan: true,
          recurlyStatus: {
            state: 'active',
          },
        }),
        getSubscriptionByMemberIdAndId: sinon.stub(),
        getSubscription: sinon.stub().resolves(ctx.subscription),
      },
    }

    ctx.changePreview = {
      currency: 'USD',
    }

    ctx.SubscriptionController = {
      makeChangePreview: sinon.stub().resolves(ctx.changePreview),
      getPlanNameForDisplay: sinon.stub().resolves(),
    }

    ctx.SubscriptionUpdater = {
      promises: {
        removeUserFromGroup: sinon.stub().resolves(),
        getSubscription: sinon.stub().resolves(),
      },
    }

    ctx.Subscription = {
      updateOne: sinon.stub().returns({ exec: sinon.stub().resolves }),
      updateMany: sinon.stub().returns({ exec: sinon.stub().resolves }),
      findOne: sinon.stub().returns({ exec: sinon.stub().resolves }),
    }

    ctx.User = {
      find: sinon.stub().returns({ exec: sinon.stub().resolves }),
    }

    ctx.SessionManager = {
      getLoggedInUserId: sinon.stub().returns(ctx.user._id),
    }

    ctx.previewSubscriptionChange = {
      nextAddOns: [
        {
          code: ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
          quantity: ctx.recurlySubscription.addOns[0].quantity + ctx.adding,
        },
      ],
      subscription: {
        planName: 'test plan',
      },
    }

    ctx.applySubscriptionChange = {}

    ctx.RecurlyClient = {
      promises: {
        getSubscription: sinon.stub().resolves(ctx.recurlySubscription),
        getPaymentMethod: sinon.stub().resolves(ctx.paymentMethod),
        previewSubscriptionChange: sinon
          .stub()
          .resolves(ctx.previewSubscriptionChange),
        applySubscriptionChangeRequest: sinon
          .stub()
          .resolves(ctx.applySubscriptionChange),
        updateSubscriptionDetails: sinon.stub().resolves(),
      },
    }

    ctx.PlansLocator = {
      findLocalPlanInSettings: sinon.stub().returns(ctx.localPlanInSettings),
    }

    ctx.SubscriptionHandler = {
      promises: {
        syncSubscription: sinon.stub().resolves(),
      },
    }

    ctx.TeamInvitesHandler = {
      promises: {
        revokeInvite: sinon.stub().resolves(),
        createInvite: sinon.stub().resolves(),
      },
    }

    ctx.GroupPlansData = {
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

    ctx.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub(),
        },
      },
    }

    ctx.Modules.promises.hooks.fire
      .withArgs('generateTermsAndConditions')
      .resolves(['T&Cs'])
      .withArgs('getPaymentFromRecord')
      .resolves([
        {
          subscription: ctx.recurlySubscription,
          account: { hasPastDueInvoice: false },
        },
      ])
      .withArgs('previewSubscriptionChangeRequest')
      .resolves([ctx.previewSubscriptionChange])
      .withArgs('previewGroupPlanUpgrade')
      .resolves([{ subscriptionChange: ctx.previewSubscriptionChange }])

    vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
      vi.importActual('../../../../app/src/Features/Errors/Errors.js')
    )
    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionUpdater.mjs',
      () => ({
        default: ctx.SubscriptionUpdater,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: ctx.SubscriptionLocator,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionController',
      () => ({
        default: ctx.SubscriptionController,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionHandler',
      () => ({
        default: ctx.SubscriptionHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/TeamInvitesHandler',
      () => ({
        default: ctx.TeamInvitesHandler,
      })
    )

    vi.doMock('../../../../app/src/models/Subscription', () => ({
      Subscription: ctx.Subscription,
    }))

    vi.doMock('../../../../app/src/models/User', () => ({
      User: ctx.User,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/RecurlyClient',
      () => ({
        default: ctx.RecurlyClient,
      })
    )

    vi.doMock('../../../../app/src/Features/Subscription/PlansLocator', () => ({
      default: ctx.PlansLocator,
    }))

    vi.doMock(
      '../../../../app/src/Features/Subscription/PaymentProviderEntities',
      () => ({
        default: ctx.PaymentProviderEntities,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: ctx.SessionManager,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/GroupPlansData',
      () => ({
        default: ctx.GroupPlansData,
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    ctx.Handler = (await import(modulePath)).default
  })

  describe('removeUserFromGroup', function () {
    it('should call the subscription updater to remove the user', async function (ctx) {
      const auditLog = { ipAddress: '0:0:0:0', initiatorId: ctx.user._id }
      await ctx.Handler.promises.removeUserFromGroup(
        ctx.adminUser_id,
        ctx.user._id,
        auditLog
      )

      ctx.SubscriptionUpdater.promises.removeUserFromGroup
        .calledWith(ctx.adminUser_id, ctx.user._id, auditLog)
        .should.equal(true)
    })
  })

  describe('replaceUserReferencesInGroups', function () {
    beforeEach(async function (ctx) {
      ctx.oldId = 'ba5eba11'
      ctx.newId = '5ca1ab1e'
      await ctx.Handler.promises.replaceUserReferencesInGroups(
        ctx.oldId,
        ctx.newId
      )
    })

    it('replaces the admin_id', function (ctx) {
      ctx.Subscription.updateOne
        .calledWith({ admin_id: ctx.oldId }, { admin_id: ctx.newId })
        .should.equal(true)
    })

    it('replaces the manager_ids', function (ctx) {
      ctx.Subscription.updateMany
        .calledWith(
          { manager_ids: 'ba5eba11' },
          { $addToSet: { manager_ids: '5ca1ab1e' } }
        )
        .should.equal(true)

      ctx.Subscription.updateMany
        .calledWith(
          { manager_ids: 'ba5eba11' },
          { $pull: { manager_ids: 'ba5eba11' } }
        )
        .should.equal(true)
    })

    it('replaces the member ids', function (ctx) {
      ctx.Subscription.updateMany
        .calledWith(
          { member_ids: ctx.oldId },
          { $addToSet: { member_ids: ctx.newId } }
        )
        .should.equal(true)

      ctx.Subscription.updateMany
        .calledWith(
          { member_ids: ctx.oldId },
          { $pull: { member_ids: ctx.oldId } }
        )
        .should.equal(true)
    })
  })

  describe('isUserPartOfGroup', function () {
    beforeEach(function (ctx) {
      ctx.subscription_id = '123ed13123'
    })

    it('should return true when user is part of subscription', async function (ctx) {
      ctx.SubscriptionLocator.promises.getSubscriptionByMemberIdAndId.resolves({
        _id: ctx.subscription_id,
      })
      const partOfGroup = await ctx.Handler.promises.isUserPartOfGroup(
        ctx.user_id,
        ctx.subscription_id
      )
      partOfGroup.should.equal(true)
    })

    it('should return false when no subscription is found', async function (ctx) {
      ctx.SubscriptionLocator.promises.getSubscriptionByMemberIdAndId.resolves(
        null
      )
      const partOfGroup = await ctx.Handler.promises.isUserPartOfGroup(
        ctx.user_id,
        ctx.subscription_id
      )
      partOfGroup.should.equal(false)
    })
  })

  describe('getTotalConfirmedUsersInGroup', function () {
    describe('for existing subscriptions', function () {
      beforeEach(function (ctx) {
        ctx.subscription.member_ids = ['12321', '3121321']
      })
      it('should call the subscription locator and return 2 users', async function (ctx) {
        const count = await ctx.Handler.promises.getTotalConfirmedUsersInGroup(
          ctx.subscription_id
        )
        ctx.SubscriptionLocator.promises.getSubscription
          .calledWith(ctx.subscription_id)
          .should.equal(true)
        count.should.equal(2)
      })
    })
    describe('for nonexistent subscriptions', function () {
      it('should return undefined', async function (ctx) {
        const count =
          await ctx.Handler.promises.getTotalConfirmedUsersInGroup('fake-id')
        expect(count).not.to.exist
      })
    })
  })

  describe('getUsersGroupSubscriptionDetails', function () {
    beforeEach(function (ctx) {
      ctx.req = new MockRequest(vi)
      ctx.PlansLocator.findLocalPlanInSettings = sinon.stub().returns({
        ...ctx.localPlanInSettings,
        canUseFlexibleLicensing: true,
      })
    })

    it('should throw if the subscription is not a group plan', async function (ctx) {
      ctx.SubscriptionLocator.promises.getUsersSubscription = sinon
        .stub()
        .resolves({ groupPlan: false })

      await expect(
        ctx.Handler.promises.getUsersGroupSubscriptionDetails(ctx.adminUser_id)
      ).to.be.rejectedWith('User subscription is not a group plan')
    })

    it('should return users group subscription details', async function (ctx) {
      const data = await ctx.Handler.promises.getUsersGroupSubscriptionDetails(
        ctx.adminUser_id
      )

      expect(data).to.deep.equal({
        userId: ctx.adminUser_id,
        subscription: {
          groupPlan: true,
          recurlyStatus: {
            state: 'active',
          },
        },
        plan: {
          membersLimit: 5,
          membersLimitAddOn:
            ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
          canUseFlexibleLicensing: true,
        },
        paymentProviderSubscription: ctx.recurlySubscription,
      })
    })
  })

  describe('add seats subscription change', function () {
    beforeEach(function (ctx) {
      ctx.req = new MockRequest(vi)
      Object.assign(ctx.req.body, { adding: ctx.adding })
      ctx.PlansLocator.findLocalPlanInSettings = sinon.stub().returns({
        ...ctx.localPlanInSettings,
        canUseFlexibleLicensing: true,
      })
    })

    describe('has "additional-license" add-on', function () {
      beforeEach(function (ctx) {
        ctx.recurlySubscription.addOns = [
          {
            code: ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
            quantity: 6,
          },
        ]
        ctx.prevQuantity = ctx.recurlySubscription.addOns[0].quantity
        ctx.previewSubscriptionChange.nextAddOns = [
          {
            code: ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
            quantity: ctx.prevQuantity + ctx.adding,
          },
        ]
      })

      afterEach(function (ctx) {
        sinon.assert.notCalled(
          ctx.recurlySubscription.getRequestForAddOnPurchase
        )

        ctx.recurlySubscription.getRequestForAddOnUpdate
          .calledWith(
            ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
            ctx.recurlySubscription.addOns[0].quantity + ctx.adding
          )
          .should.equal(true)
      })

      describe('previewAddSeatsSubscriptionChange', function () {
        it('should return the subscription change preview', async function (ctx) {
          const preview =
            await ctx.Handler.promises.previewAddSeatsSubscriptionChange(
              ctx.adminUser_id,
              ctx.adding
            )
          ctx.Modules.promises.hooks.fire
            .calledWith('getPaymentFromRecord', {
              groupPlan: true,
              recurlyStatus: {
                state: 'active',
              },
            })
            .should.equal(true)
          ctx.Modules.promises.hooks.fire
            .calledWith('previewSubscriptionChangeRequest', ctx.changeRequest)
            .should.equal(true)
          ctx.SubscriptionController.makeChangePreview
            .calledWith(
              {
                type: 'add-on-update',
                addOn: {
                  code: ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
                  quantity:
                    ctx.previewSubscriptionChange.nextAddOns[0].quantity,
                  prevQuantity: ctx.prevQuantity,
                },
              },
              ctx.previewSubscriptionChange
            )
            .should.equal(true)
          preview.should.equal(ctx.changePreview)
        })
      })

      describe('createAddSeatsSubscriptionChange', function () {
        it('should change the subscription', async function (ctx) {
          ctx.recurlySubscription = {
            ...ctx.recurlySubscription,
            get isCollectionMethodManual() {
              return true
            },
          }
          ctx.Modules.promises.hooks.fire
            .withArgs('getPaymentFromRecord')
            .resolves([
              {
                subscription: ctx.recurlySubscription,
                account: { hasPastDueInvoice: false },
              },
            ])

          const result =
            await ctx.Handler.promises.createAddSeatsSubscriptionChange(
              ctx.adminUser_id,
              ctx.adding,
              '123'
            )
          ctx.Modules.promises.hooks.fire
            .calledWith(
              'updateSubscriptionDetails',
              sinon.match
                .has('poNumber')
                .and(sinon.match.has('termsAndConditions'))
            )
            .should.equal(true)
          ctx.Modules.promises.hooks.fire
            .calledWith(
              'applySubscriptionChangeRequestAndSync',
              ctx.changeRequest
            )
            .should.equal(true)
          expect(result).to.deep.equal({
            adding: ctx.req.body.adding,
          })
        })
      })
    })

    describe('updateSubscriptionPaymentTerms', function () {
      describe('accounts with PO number', function () {
        it('should update the subscription PO number and T&C', async function (ctx) {
          await ctx.Handler.promises.updateSubscriptionPaymentTerms(
            ctx.recurlySubscription,
            ctx.poNumberAndTermsAndConditionsUpdate.poNumber
          )
          ctx.recurlySubscription.getRequestForPoNumberAndTermsAndConditionsUpdate
            .calledWithMatch(
              ctx.poNumberAndTermsAndConditionsUpdate.poNumber,
              'T&Cs'
            )
            .should.equal(true)
          ctx.Modules.promises.hooks.fire
            .calledWith(
              'updateSubscriptionDetails',
              ctx.poNumberAndTermsAndConditionsUpdate
            )
            .should.equal(true)
        })
      })

      describe('accounts with no PO number', function () {
        it('should update the subscription T&C only', async function (ctx) {
          await ctx.Handler.promises.updateSubscriptionPaymentTerms(
            ctx.recurlySubscription
          )
          ctx.recurlySubscription.getRequestForTermsAndConditionsUpdate
            .calledWithMatch('T&Cs')
            .should.equal(true)
          ctx.Modules.promises.hooks.fire
            .calledWith(
              'updateSubscriptionDetails',
              ctx.termsAndConditionsUpdate
            )
            .should.equal(true)
        })
      })
    })

    describe('has no "additional-license" add-on', function () {
      beforeEach(function (ctx) {
        ctx.recurlySubscription.addOns = []
        ctx.prevQuantity = ctx.recurlySubscription.addOns[0]?.quantity ?? 0
        ctx.previewSubscriptionChange.nextAddOns = [
          {
            code: ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
            quantity: ctx.prevQuantity + ctx.adding,
          },
        ]
        ctx.PlansLocator.findLocalPlanInSettings = sinon.stub().returns({
          ...ctx.localPlanInSettings,
          planCode: 'group_collaborator_5_enterprise',
          canUseFlexibleLicensing: true,
        })
      })

      afterEach(function (ctx) {
        sinon.assert.notCalled(ctx.recurlySubscription.getRequestForAddOnUpdate)
      })

      describe('previewAddSeatsSubscriptionChange', function () {
        let preview

        afterEach(function (ctx) {
          ctx.Modules.promises.hooks.fire
            .calledWith('getPaymentFromRecord', {
              groupPlan: true,
              recurlyStatus: {
                state: 'active',
              },
            })
            .should.equal(true)
          ctx.Modules.promises.hooks.fire
            .calledWith('previewSubscriptionChangeRequest', ctx.changeRequest)
            .should.equal(true)
          ctx.SubscriptionController.makeChangePreview
            .calledWith(
              {
                type: 'add-on-update',
                addOn: {
                  code: ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
                  quantity:
                    ctx.previewSubscriptionChange.nextAddOns[0].quantity,
                  prevQuantity: ctx.prevQuantity,
                },
              },
              ctx.previewSubscriptionChange
            )
            .should.equal(true)
          preview.should.equal(ctx.changePreview)
        })

        it('should return the subscription change preview with legacy add-on price', async function (ctx) {
          ctx.recurlySubscription.planPrice =
            ctx.GroupPlansData.enterprise.collaborator.USD[5].price_in_cents /
              100 -
            1

          preview =
            await ctx.Handler.promises.previewAddSeatsSubscriptionChange(
              ctx.adminUser_id,
              ctx.adding
            )
          ctx.recurlySubscription.getRequestForAddOnPurchase
            .calledWithExactly(
              ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
              ctx.adding,
              ctx.GroupPlansData.enterprise.collaborator.USD[5]
                .additional_license_legacy_price_in_cents / 100
            )
            .should.equal(true)
        })

        it('should return the subscription change preview with non-legacy add-on price', async function (ctx) {
          ctx.recurlySubscription.planPrice =
            ctx.GroupPlansData.enterprise.collaborator.USD[5].price_in_cents /
            100

          preview =
            await ctx.Handler.promises.previewAddSeatsSubscriptionChange(
              ctx.adminUser_id,
              ctx.adding
            )
          ctx.recurlySubscription.getRequestForAddOnPurchase
            .calledWithExactly(
              ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
              ctx.adding,
              undefined
            )
            .should.equal(true)
        })

        it('should return the subscription change preview with legacy add-on price for small educational group', async function (ctx) {
          ctx.PlansLocator.findLocalPlanInSettings = sinon.stub().returns({
            ...ctx.localPlanInSettings,
            planCode: 'group_collaborator_5_educational',
            canUseFlexibleLicensing: true,
          })
          ctx.recurlySubscription.planPrice =
            ctx.GroupPlansData.enterprise.collaborator.USD[5].price_in_cents /
              100 +
            1

          preview =
            await ctx.Handler.promises.previewAddSeatsSubscriptionChange(
              ctx.adminUser_id,
              ctx.adding
            )
          ctx.recurlySubscription.getRequestForAddOnPurchase
            .calledWithExactly(
              ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
              ctx.adding,
              ctx.GroupPlansData.enterprise.collaborator.USD[5]
                .additional_license_legacy_price_in_cents / 100
            )
            .should.equal(true)
        })

        it('should return the subscription change preview with non-legacy add-on price for small educational group', async function (ctx) {
          ctx.PlansLocator.findLocalPlanInSettings = sinon.stub().returns({
            ...ctx.localPlanInSettings,
            planCode: 'group_collaborator_5_educational',
            canUseFlexibleLicensing: true,
          })
          ctx.recurlySubscription.planPrice =
            ctx.GroupPlansData.enterprise.collaborator.USD[5].price_in_cents /
            100

          preview =
            await ctx.Handler.promises.previewAddSeatsSubscriptionChange(
              ctx.adminUser_id,
              ctx.adding
            )
          ctx.recurlySubscription.getRequestForAddOnPurchase
            .calledWithExactly(
              ctx.PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE,
              ctx.adding,
              undefined
            )
            .should.equal(true)
        })
      })
    })
  })

  describe('ensureFlexibleLicensingEnabled', function () {
    it('should throw if the subscription can not use flexible licensing', async function (ctx) {
      await expect(
        ctx.Handler.promises.ensureFlexibleLicensingEnabled({
          canUseFlexibleLicensing: false,
        })
      ).to.be.rejectedWith('The group plan does not support flexible licensing')
    })

    it('should not throw if the subscription can use flexible licensing', async function (ctx) {
      await expect(
        ctx.Handler.promises.ensureFlexibleLicensingEnabled({
          canUseFlexibleLicensing: true,
        })
      ).to.not.be.rejected
    })
  })

  describe('ensureSubscriptionIsActive', function () {
    it('should throw if the subscription is not active', async function (ctx) {
      await expect(
        ctx.Handler.promises.ensureSubscriptionIsActive(ctx.subscription)
      ).to.be.rejectedWith('The subscription is not active')
    })

    it('should not throw if the subscription is active', async function (ctx) {
      await expect(
        ctx.Handler.promises.ensureSubscriptionIsActive({
          recurlyStatus: { state: 'active' },
        })
      ).to.not.be.rejected
    })
  })

  describe('ensureSubscriptionCollectionMethodIsNotManual', function () {
    it('should throw if the subscription is manually collected', async function (ctx) {
      await expect(
        ctx.Handler.promises.ensureSubscriptionCollectionMethodIsNotManual({
          get isCollectionMethodManual() {
            return true
          },
        })
      ).to.be.rejectedWith('This subscription is being collected manually')
    })

    it('should not throw if the subscription is automatically collected', async function (ctx) {
      await expect(
        ctx.Handler.promises.ensureSubscriptionCollectionMethodIsNotManual({
          get isCollectionMethodManual() {
            return false
          },
        })
      ).to.not.be.rejected
    })
  })

  describe('ensureSubscriptionHasNoPendingChanges', function () {
    it('should throw if the subscription has pending change', async function (ctx) {
      await expect(
        ctx.Handler.promises.ensureSubscriptionHasNoPendingChanges({
          pendingChange: {},
        })
      ).to.be.rejectedWith('This subscription has a pending change')
    })

    it('should not throw if the subscription has no pending change', async function (ctx) {
      await expect(
        ctx.Handler.promises.ensureSubscriptionHasNoPendingChanges({})
      ).to.not.be.rejected
    })
  })

  describe('ensureSubscriptionHasNoPastDueInvoice', function () {
    it('should throw if the subscription has past due invoice', async function (ctx) {
      ctx.Modules.promises.hooks.fire
        .withArgs('getPaymentFromRecord')
        .resolves([{ account: { hasPastDueInvoice: true } }])
      await expect(
        ctx.Handler.promises.ensureSubscriptionHasNoPastDueInvoice(
          ctx.subscription
        )
      ).to.be.rejectedWith('This subscription has a past due invoice')
    })

    it('should not throw if the subscription has no past due invoice', async function (ctx) {
      await expect(
        ctx.Handler.promises.ensureSubscriptionHasNoPastDueInvoice(
          ctx.subscription
        )
      ).to.not.be.rejected
    })
  })

  describe('ensureSubscriptionHasAdditionalLicenseAddOnWhenCollectionMethodIsManual', function () {
    it('should throw if the subscription is manually collected and has no additional license add-on', async function (ctx) {
      await expect(
        ctx.Handler.promises.ensureSubscriptionHasAdditionalLicenseAddOnWhenCollectionMethodIsManual(
          {
            isCollectionMethodManual: true,
            hasAddOn: sinon
              .stub()
              .withArgs('additional-license')
              .returns(false),
          }
        )
      ).to.be.rejectedWith(
        'This subscription is being collected manually has no "additional-license" add-on'
      )
    })

    it('should not throw if the subscription is not manually collected and has no additional license add-on and ', async function (ctx) {
      await expect(
        ctx.Handler.promises.ensureSubscriptionHasAdditionalLicenseAddOnWhenCollectionMethodIsManual(
          {
            isCollectionMethodManual: false,
            hasAddOn: sinon
              .stub()
              .withArgs('additional-license')
              .returns(false),
          }
        )
      ).to.not.be.rejected
    })

    it('should not throw if the subscription is not manually collected and has additional license add-on', async function (ctx) {
      await expect(
        ctx.Handler.promises.ensureSubscriptionHasAdditionalLicenseAddOnWhenCollectionMethodIsManual(
          {
            isCollectionMethodManual: true,
            hasAddOn: sinon.stub().withArgs('additional-license').returns(true),
          }
        )
      ).to.not.be.rejected
    })
  })

  describe('getGroupPlanUpgradePreview', function () {
    it('should generate preview for subscription upgrade', async function (ctx) {
      const result = await ctx.Handler.promises.getGroupPlanUpgradePreview(
        ctx.user_id
      )
      result.should.equal(ctx.changePreview)
    })
  })

  describe('checkBillingInfoExistence', function () {
    it('should invoke the payment method function when collection method is "automatic"', async function (ctx) {
      await ctx.Handler.promises.checkBillingInfoExistence(
        ctx.recurlySubscription,
        ctx.adminUser_id
      )
      ctx.Modules.promises.hooks.fire
        .calledWith('getPaymentMethod', ctx.adminUser_id)
        .should.equal(true)
    })

    it('shouldn’t invoke the payment method function when collection method is "manual"', async function (ctx) {
      const recurlySubscription = {
        ...ctx.recurlySubscription,
        get isCollectionMethodManual() {
          return true
        },
      }
      await ctx.Handler.promises.checkBillingInfoExistence(
        recurlySubscription,
        ctx.adminUser_id
      )
      ctx.RecurlyClient.promises.getPaymentMethod.should.not.have.been.called
    })
  })

  describe('updateGroupMembersBulk', function () {
    const inviterId = new ObjectId()

    let members
    let emailList
    let callUpdateGroupMembersBulk

    beforeEach(function (ctx) {
      members = [
        {
          _id: new ObjectId(),
          email: 'user1@example.com',
          emails: [{ email: 'user1@example.com' }],
        },
        {
          _id: new ObjectId(),
          email: 'user2-alias@example.com',
          emails: [
            {
              email: 'user2-alias@example.com',
            },
            {
              email: 'user2@example.com',
            },
          ],
        },
        {
          _id: new ObjectId(),
          email: 'user3@example.com',
          emails: [{ email: 'user3@example.com' }],
        },
      ]

      emailList = [
        'user1@example.com',
        'user2@example.com',
        'new-user@example.com', // primary email of existing user
        'new-user-2@example.com', // secondary email of existing user
      ]
      callUpdateGroupMembersBulk = async (options = {}) => {
        ctx.Subscription.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(ctx.subscription) })

        ctx.User.find = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(members) })

        return await ctx.Handler.promises.updateGroupMembersBulk(
          inviterId,
          ctx.subscription._id,
          emailList,
          options
        )
      }
    })

    it('throws an error when any of the emails is invalid', async function () {
      emailList.push('invalid@email')

      await expect(
        callUpdateGroupMembersBulk({ commit: true })
      ).to.be.rejectedWith(InvalidEmailError)
    })

    describe('with commit = false', function () {
      describe('with removeMembersNotIncluded = false', function () {
        it('should preview zero users to delete, and should not send invites', async function (ctx) {
          const result = await callUpdateGroupMembersBulk()

          expect(result).to.deep.equal({
            emailsToSendInvite: [
              'new-user@example.com',
              'new-user-2@example.com',
            ],
            emailsToRevokeInvite: [],
            membersToRemove: [],
            currentMemberCount: 3,
            newTotalCount: 5,
            membersLimit: ctx.subscription.membersLimit,
          })

          expect(ctx.TeamInvitesHandler.promises.createInvite).not.to.have.been
            .called

          expect(ctx.SubscriptionUpdater.promises.removeUserFromGroup).not.to
            .have.been.called
        })
      })

      describe('with removeMembersNotIncluded = true', function () {
        it('should preview the users to be deleted, and should not send invites', async function (ctx) {
          const result = await callUpdateGroupMembersBulk({
            removeMembersNotIncluded: true,
          })

          expect(result).to.deep.equal({
            emailsToSendInvite: [
              'new-user@example.com',
              'new-user-2@example.com',
            ],
            emailsToRevokeInvite: [],
            membersToRemove: [members[2]._id],
            currentMemberCount: 3,
            newTotalCount: 4,
            membersLimit: ctx.subscription.membersLimit,
          })

          expect(ctx.TeamInvitesHandler.promises.createInvite).not.to.have.been
            .called

          expect(ctx.SubscriptionUpdater.promises.removeUserFromGroup).not.to
            .have.been.called
        })

        it('should preview but not revoke invites to emails that are no longer invited', async function (ctx) {
          ctx.subscription.teamInvites = [
            { email: 'new-user@example.com' },
            { email: 'no-longer-invited@example.com' },
          ]

          const result = await callUpdateGroupMembersBulk({
            removeMembersNotIncluded: true,
          })

          expect(result.emailsToRevokeInvite).to.deep.equal([
            'no-longer-invited@example.com',
          ])

          expect(ctx.TeamInvitesHandler.promises.revokeInvite).not.to.have.been
            .called
        })
      })

      it('does not throw an error when the member limit is reached', async function (ctx) {
        ctx.subscription.membersLimit = 3
        const result = await callUpdateGroupMembersBulk()

        expect(result.membersLimit).to.equal(3)
        expect(result.newTotalCount).to.equal(5)
      })
    })

    describe('with commit = true', function () {
      describe('with removeMembersNotIncluded = false', function () {
        it('should preview zero users to delete, and should send invites', async function (ctx) {
          const result = await callUpdateGroupMembersBulk({ commit: true })

          expect(result).to.deep.equal({
            emailsToSendInvite: [
              'new-user@example.com',
              'new-user-2@example.com',
            ],
            emailsToRevokeInvite: [],
            membersToRemove: [],
            currentMemberCount: 3,
            newTotalCount: 5,
            membersLimit: ctx.subscription.membersLimit,
          })

          expect(ctx.SubscriptionUpdater.promises.removeUserFromGroup).not.to
            .have.been.called

          expect(
            ctx.TeamInvitesHandler.promises.createInvite.callCount
          ).to.equal(2)

          expect(
            ctx.TeamInvitesHandler.promises.createInvite
          ).to.have.been.calledWith(
            inviterId,
            ctx.subscription,
            'new-user@example.com'
          )

          expect(
            ctx.TeamInvitesHandler.promises.createInvite
          ).to.have.been.calledWith(
            inviterId,
            ctx.subscription,
            'new-user-2@example.com'
          )
        })

        it('should not send invites to emails already invited', async function (ctx) {
          ctx.subscription.teamInvites = [{ email: 'new-user@example.com' }]

          const result = await callUpdateGroupMembersBulk({ commit: true })

          expect(result.emailsToSendInvite).to.deep.equal([
            'new-user-2@example.com',
          ])

          expect(
            ctx.TeamInvitesHandler.promises.createInvite.callCount
          ).to.equal(1)

          expect(
            ctx.TeamInvitesHandler.promises.createInvite
          ).to.have.been.calledWith(
            inviterId,
            ctx.subscription,
            'new-user-2@example.com'
          )
        })

        it('should preview and not revoke invites to emails that are no longer invited', async function (ctx) {
          ctx.subscription.teamInvites = [
            { email: 'new-user@example.com' },
            { email: 'no-longer-invited@example.com' },
          ]

          const result = await callUpdateGroupMembersBulk({
            commit: true,
          })

          expect(result.emailsToRevokeInvite).to.deep.equal([])

          expect(ctx.TeamInvitesHandler.promises.revokeInvite).not.to.have.been
            .called
        })
      })

      describe('with removeMembersNotIncluded = true', function () {
        it('should remove users from group, and should send invites', async function (ctx) {
          const result = await callUpdateGroupMembersBulk({
            commit: true,
            removeMembersNotIncluded: true,
          })

          expect(result).to.deep.equal({
            emailsToSendInvite: [
              'new-user@example.com',
              'new-user-2@example.com',
            ],
            emailsToRevokeInvite: [],
            membersToRemove: [members[2]._id],
            currentMemberCount: 3,
            newTotalCount: 4,
            membersLimit: ctx.subscription.membersLimit,
          })

          expect(
            ctx.SubscriptionUpdater.promises.removeUserFromGroup.callCount
          ).to.equal(1)

          expect(
            ctx.SubscriptionUpdater.promises.removeUserFromGroup
          ).to.have.been.calledWith(ctx.subscription._id, members[2]._id, {
            initiatorId: inviterId,
          })

          expect(
            ctx.TeamInvitesHandler.promises.createInvite.callCount
          ).to.equal(2)

          expect(
            ctx.TeamInvitesHandler.promises.createInvite
          ).to.have.been.calledWith(
            inviterId,
            ctx.subscription,
            'new-user@example.com'
          )

          expect(
            ctx.TeamInvitesHandler.promises.createInvite
          ).to.have.been.calledWith(
            inviterId,
            ctx.subscription,
            'new-user-2@example.com'
          )
        })

        it('should send invites and revoke invites to emails no longer invited', async function (ctx) {
          ctx.subscription.teamInvites = [
            { email: 'new-user@example.com' },
            { email: 'no-longer-invited@example.com' },
          ]

          const result = await callUpdateGroupMembersBulk({
            commit: true,
            removeMembersNotIncluded: true,
          })

          expect(result.emailsToSendInvite).to.deep.equal([
            'new-user-2@example.com',
          ])

          expect(result.emailsToRevokeInvite).to.deep.equal([
            'no-longer-invited@example.com',
          ])

          expect(
            ctx.TeamInvitesHandler.promises.createInvite.callCount
          ).to.equal(1)

          expect(
            ctx.TeamInvitesHandler.promises.createInvite
          ).to.have.been.calledWith(
            inviterId,
            ctx.subscription,
            'new-user-2@example.com'
          )

          expect(
            ctx.TeamInvitesHandler.promises.revokeInvite.callCount
          ).to.equal(1)

          expect(
            ctx.TeamInvitesHandler.promises.revokeInvite
          ).to.have.been.calledWith(
            inviterId,
            ctx.subscription,
            'no-longer-invited@example.com'
          )
        })
      })

      it('throws an error when the member limit is reached', async function (ctx) {
        ctx.subscription.membersLimit = 3
        await expect(
          callUpdateGroupMembersBulk({ commit: true })
        ).to.be.rejectedWith('limit reached')
      })
    })
  })
})
