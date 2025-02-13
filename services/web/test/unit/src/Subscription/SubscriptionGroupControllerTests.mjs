import esmock from 'esmock'
import sinon from 'sinon'

const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionGroupController'

describe('SubscriptionGroupController', function () {
  beforeEach(async function () {
    this.user = { _id: '!@312431', email: 'user@email.com' }
    this.adminUserId = '123jlkj'
    this.subscriptionId = '123434325412'
    this.user_email = 'bob@gmail.com'
    this.req = {
      session: {
        user: {
          _id: this.adminUserId,
          email: this.user_email,
        },
      },
      params: {
        subscriptionId: this.subscriptionId,
      },
      query: {},
    }

    this.subscription = {
      _id: this.subscriptionId,
      teamName: 'Cool group',
      groupPlan: true,
      membersLimit: 5,
    }

    this.plan = {
      canUseFlexibleLicensing: true,
    }

    this.previewSubscriptionChangeData = {
      change: {},
      currency: 'USD',
    }

    this.createSubscriptionChangeData = { adding: 1 }

    this.SubscriptionGroupHandler = {
      promises: {
        removeUserFromGroup: sinon.stub().resolves(),
        getUsersGroupSubscriptionDetails: sinon.stub().resolves({
          subscription: this.subscription,
          plan: this.plan,
          recurlySubscription: {},
        }),
        previewAddSeatsSubscriptionChange: sinon
          .stub()
          .resolves(this.previewSubscriptionChangeData),
        createAddSeatsSubscriptionChange: sinon
          .stub()
          .resolves(this.createSubscriptionChangeData),
        ensureFlexibleLicensingEnabled: sinon.stub().resolves(),
        ensureSubscriptionIsActive: sinon.stub().resolves(),
        ensureSubscriptionCollectionMethodIsNotManual: sinon.stub().resolves(),
        ensureSubscriptionHasNoPendingChanges: sinon.stub().resolves(),
        getGroupPlanUpgradePreview: sinon
          .stub()
          .resolves(this.previewSubscriptionChangeData),
      },
    }

    this.SubscriptionLocator = {
      promises: {
        getSubscription: sinon.stub().resolves(this.subscription),
      },
    }

    this.SessionManager = {
      getLoggedInUserId(session) {
        return session.user._id
      },
      getSessionUser(session) {
        return session.user
      },
    }

    this.UserAuditLogHandler = {
      promises: {
        addEntry: sinon.stub().resolves(),
      },
    }

    this.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves(),
        },
      },
    }

    this.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves(),
      },
    }

    this.UserGetter = {
      promises: {
        getUserEmail: sinon.stub().resolves(this.user.email),
      },
    }

    this.paymentMethod = { cardType: 'Visa', lastFour: '1111' }

    this.RecurlyClient = {
      promises: {
        getPaymentMethod: sinon.stub().resolves(this.paymentMethod),
        // getSubscription: sinon.stub().resolves(this.subscription),
      },
    }

    this.SubscriptionController = {}

    this.SubscriptionModel = { Subscription: {} }

    this.PlansHelper = {
      isProfessionalGroupPlan: sinon.stub().returns(false),
    }

    this.Errors = {
      MissingBillingInfoError: class extends Error {},
      ManuallyCollectedError: class extends Error {},
      PendingChangeError: class extends Error {},
      InactiveError: class extends Error {},
    }

    this.Controller = await esmock.strict(modulePath, {
      '../../../../app/src/Features/Subscription/SubscriptionGroupHandler':
        this.SubscriptionGroupHandler,
      '../../../../app/src/Features/Subscription/SubscriptionLocator':
        this.SubscriptionLocator,
      '../../../../app/src/Features/Authentication/SessionManager':
        this.SessionManager,
      '../../../../app/src/Features/User/UserAuditLogHandler':
        this.UserAuditLogHandler,
      '../../../../app/src/infrastructure/Modules': this.Modules,
      '../../../../app/src/Features/SplitTests/SplitTestHandler':
        this.SplitTestHandler,
      '../../../../app/src/Features/User/UserGetter': this.UserGetter,
      '../../../../app/src/Features/Errors/ErrorController':
        (this.ErrorController = {
          notFound: sinon.stub(),
        }),
      '../../../../app/src/Features/Subscription/SubscriptionController':
        this.SubscriptionController,
      '../../../../app/src/Features/Subscription/RecurlyClient':
        this.RecurlyClient,
      '../../../../app/src/Features/Subscription/PlansHelper': this.PlansHelper,
      '../../../../app/src/Features/Subscription/Errors': this.Errors,
      '../../../../app/src/models/Subscription': this.SubscriptionModel,
      '@overleaf/logger': {
        err: sinon.stub(),
        error: sinon.stub(),
        warn: sinon.stub(),
        log: sinon.stub(),
        debug: sinon.stub(),
      },
    })
  })

  describe('removeUserFromGroup', function () {
    it('should use the subscription id for the logged in user and take the user id from the params', function (done) {
      const userIdToRemove = '31231'
      this.req.params = { user_id: userIdToRemove }
      this.req.entity = this.subscription

      const res = {
        sendStatus: () => {
          this.SubscriptionGroupHandler.promises.removeUserFromGroup
            .calledWith(this.subscriptionId, userIdToRemove)
            .should.equal(true)
          done()
        },
      }
      this.Controller.removeUserFromGroup(this.req, res, done)
    })

    it('should log that the user has been removed', function (done) {
      const userIdToRemove = '31231'
      this.req.params = { user_id: userIdToRemove }
      this.req.entity = this.subscription

      const res = {
        sendStatus: () => {
          sinon.assert.calledWith(
            this.UserAuditLogHandler.promises.addEntry,
            userIdToRemove,
            'remove-from-group-subscription',
            this.adminUserId,
            this.req.ip,
            { subscriptionId: this.subscriptionId }
          )
          done()
        },
      }
      this.Controller.removeUserFromGroup(this.req, res, done)
    })

    it('should call the group SSO hooks with group SSO enabled', function (done) {
      const userIdToRemove = '31231'
      this.req.params = { user_id: userIdToRemove }
      this.req.entity = this.subscription
      this.Modules.promises.hooks.fire
        .withArgs('hasGroupSSOEnabled', this.subscription)
        .resolves([true])

      const res = {
        sendStatus: () => {
          this.Modules.promises.hooks.fire
            .calledWith('hasGroupSSOEnabled', this.subscription)
            .should.equal(true)
          this.Modules.promises.hooks.fire
            .calledWith(
              'unlinkUserFromGroupSSO',
              userIdToRemove,
              this.subscriptionId
            )
            .should.equal(true)
          sinon.assert.calledTwice(this.Modules.promises.hooks.fire)
          done()
        },
      }
      this.Controller.removeUserFromGroup(this.req, res, done)
    })

    it('should call the group SSO hooks with group SSO disabled', function (done) {
      const userIdToRemove = '31231'
      this.req.params = { user_id: userIdToRemove }
      this.req.entity = this.subscription
      this.Modules.promises.hooks.fire
        .withArgs('hasGroupSSOEnabled', this.subscription)
        .resolves([false])

      const res = {
        sendStatus: () => {
          this.Modules.promises.hooks.fire
            .calledWith('hasGroupSSOEnabled', this.subscription)
            .should.equal(true)
          sinon.assert.calledOnce(this.Modules.promises.hooks.fire)
          done()
        },
      }
      this.Controller.removeUserFromGroup(this.req, res, done)
    })
  })

  describe('removeSelfFromGroup', function () {
    it('gets subscription and remove user', function (done) {
      this.req.query = { subscriptionId: this.subscriptionId }
      const memberUserIdToremove = 123456789
      this.req.session.user._id = memberUserIdToremove

      const res = {
        sendStatus: () => {
          sinon.assert.calledWith(
            this.SubscriptionLocator.promises.getSubscription,
            this.subscriptionId
          )
          sinon.assert.calledWith(
            this.SubscriptionGroupHandler.promises.removeUserFromGroup,
            this.subscriptionId,
            memberUserIdToremove
          )
          done()
        },
      }
      this.Controller.removeSelfFromGroup(this.req, res, done)
    })

    it('should log that the user has left the subscription', function (done) {
      this.req.query = { subscriptionId: this.subscriptionId }
      const memberUserIdToremove = '123456789'
      this.req.session.user._id = memberUserIdToremove

      const res = {
        sendStatus: () => {
          sinon.assert.calledWith(
            this.UserAuditLogHandler.promises.addEntry,
            memberUserIdToremove,
            'remove-from-group-subscription',
            memberUserIdToremove,
            this.req.ip,
            { subscriptionId: this.subscriptionId }
          )
          done()
        },
      }
      this.Controller.removeSelfFromGroup(this.req, res, done)
    })

    it('should call the group SSO hooks with group SSO enabled', function (done) {
      this.req.query = { subscriptionId: this.subscriptionId }
      const memberUserIdToremove = '123456789'
      this.req.session.user._id = memberUserIdToremove

      this.Modules.promises.hooks.fire
        .withArgs('hasGroupSSOEnabled', this.subscription)
        .resolves([true])

      const res = {
        sendStatus: () => {
          this.Modules.promises.hooks.fire
            .calledWith('hasGroupSSOEnabled', this.subscription)
            .should.equal(true)
          this.Modules.promises.hooks.fire
            .calledWith(
              'unlinkUserFromGroupSSO',
              memberUserIdToremove,
              this.subscriptionId
            )
            .should.equal(true)
          sinon.assert.calledTwice(this.Modules.promises.hooks.fire)
          done()
        },
      }
      this.Controller.removeSelfFromGroup(this.req, res, done)
    })

    it('should call the group SSO hooks with group SSO disabled', function (done) {
      const userIdToRemove = '31231'
      this.req.session.user._id = userIdToRemove
      this.req.params = { user_id: userIdToRemove }
      this.req.entity = this.subscription
      this.Modules.promises.hooks.fire
        .withArgs('hasGroupSSOEnabled', this.subscription)
        .resolves([false])

      const res = {
        sendStatus: () => {
          this.Modules.promises.hooks.fire
            .calledWith('hasGroupSSOEnabled', this.subscription)
            .should.equal(true)
          sinon.assert.calledOnce(this.Modules.promises.hooks.fire)
          done()
        },
      }
      this.Controller.removeSelfFromGroup(this.req, res, done)
    })
  })

  describe('addSeatsToGroupSubscription', function () {
    it('should render the "add seats" page', function (done) {
      const res = {
        render: (page, props) => {
          this.SubscriptionGroupHandler.promises.getUsersGroupSubscriptionDetails
            .calledWith(this.req.session.user._id)
            .should.equal(true)
          this.SubscriptionGroupHandler.promises.ensureFlexibleLicensingEnabled
            .calledWith(this.plan)
            .should.equal(true)
          this.SubscriptionGroupHandler.promises.ensureSubscriptionIsActive
            .calledWith(this.subscription)
            .should.equal(true)
          page.should.equal('subscriptions/add-seats')
          props.subscriptionId.should.equal(this.subscriptionId)
          props.groupName.should.equal(this.subscription.teamName)
          props.totalLicenses.should.equal(this.subscription.membersLimit)
          props.isProfessional.should.equal(false)
          done()
        },
      }

      this.Controller.addSeatsToGroupSubscription(this.req, res)
    })

    it('should redirect to subscription page when getting subscription details fails', function (done) {
      this.SubscriptionGroupHandler.promises.getUsersGroupSubscriptionDetails =
        sinon.stub().rejects()

      const res = {
        redirect: url => {
          url.should.equal('/user/subscription')
          done()
        },
      }

      this.Controller.addSeatsToGroupSubscription(this.req, res)
    })

    it('should redirect to subscription page when flexible licensing is not enabled', function (done) {
      this.SubscriptionGroupHandler.promises.ensureFlexibleLicensingEnabled =
        sinon.stub().rejects()

      const res = {
        redirect: url => {
          url.should.equal('/user/subscription')
          done()
        },
      }

      this.Controller.addSeatsToGroupSubscription(this.req, res)
    })

    it('should redirect to missing billing information page when billing information is missing', function (done) {
      this.RecurlyClient.promises.getPaymentMethod = sinon
        .stub()
        .throws(new this.Errors.MissingBillingInfoError())

      const res = {
        redirect: url => {
          url.should.equal(
            '/user/subscription/group/missing-billing-information'
          )
          done()
        },
      }

      this.Controller.addSeatsToGroupSubscription(this.req, res)
    })

    it('should redirect to manually collected subscription error page when collection method is manual', function (done) {
      this.SubscriptionGroupHandler.promises.ensureSubscriptionCollectionMethodIsNotManual =
        sinon.stub().throws(new this.Errors.ManuallyCollectedError())

      const res = {
        redirect: url => {
          url.should.equal(
            '/user/subscription/group/manually-collected-subscription'
          )
          done()
        },
      }

      this.Controller.addSeatsToGroupSubscription(this.req, res)
    })

    it('should redirect to subscription page when there is a pending change', function (done) {
      this.SubscriptionGroupHandler.promises.ensureSubscriptionHasNoPendingChanges =
        sinon.stub().throws(new this.Errors.PendingChangeError())

      const res = {
        redirect: url => {
          url.should.equal('/user/subscription')
          done()
        },
      }

      this.Controller.addSeatsToGroupSubscription(this.req, res)
    })

    it('should redirect to subscription page when subscription is not active', function (done) {
      this.SubscriptionGroupHandler.promises.ensureSubscriptionIsActive = sinon
        .stub()
        .rejects()

      const res = {
        redirect: url => {
          url.should.equal('/user/subscription')
          done()
        },
      }

      this.Controller.addSeatsToGroupSubscription(this.req, res)
    })
  })

  describe('previewAddSeatsSubscriptionChange', function () {
    it('should preview "add seats" change', function (done) {
      this.req.body = { adding: 2 }

      const res = {
        json: data => {
          this.SubscriptionGroupHandler.promises.previewAddSeatsSubscriptionChange
            .calledWith(this.req.session.user._id, this.req.body.adding)
            .should.equal(true)
          data.should.deep.equal(this.previewSubscriptionChangeData)
          done()
        },
      }

      this.Controller.previewAddSeatsSubscriptionChange(this.req, res)
    })

    it('should fail previewing "add seats" change', function (done) {
      this.SubscriptionGroupHandler.promises.previewAddSeatsSubscriptionChange =
        sinon.stub().rejects()

      const res = {
        status: statusCode => {
          statusCode.should.equal(500)

          return {
            end: () => {
              done()
            },
          }
        },
      }

      this.Controller.previewAddSeatsSubscriptionChange(this.req, res)
    })
  })

  describe('createAddSeatsSubscriptionChange', function () {
    it('should apply "add seats" change', function (done) {
      this.req.body = { adding: 2 }

      const res = {
        json: data => {
          this.SubscriptionGroupHandler.promises.createAddSeatsSubscriptionChange
            .calledWith(this.req.session.user._id, this.req.body.adding)
            .should.equal(true)
          data.should.deep.equal(this.createSubscriptionChangeData)
          done()
        },
      }

      this.Controller.createAddSeatsSubscriptionChange(this.req, res)
    })

    it('should fail applying "add seats" change', function (done) {
      this.SubscriptionGroupHandler.promises.createAddSeatsSubscriptionChange =
        sinon.stub().rejects()

      const res = {
        status: statusCode => {
          statusCode.should.equal(500)

          return {
            end: () => {
              done()
            },
          }
        },
      }

      this.Controller.createAddSeatsSubscriptionChange(this.req, res)
    })
  })

  describe('submitForm', function () {
    it('should build and pass the request body to the sales submit handler', function (done) {
      const adding = 100
      this.req.body = { adding }

      const res = {
        sendStatus: code => {
          this.Modules.promises.hooks.fire
            .calledWith('sendSupportRequest', {
              email: this.user.email,
              subject: 'Sales Contact Form',
              message:
                '\n' +
                '**Overleaf Sales Contact Form:**\n' +
                '\n' +
                '**Subject:** Self-Serve Group User Increase Request\n' +
                '\n' +
                `**Estimated Number of Users:** ${adding}\n` +
                '\n' +
                `**Message:** This email has been generated on behalf of user with email **${this.user.email}** to request an increase in the total number of users for their subscription.`,
              inbox: 'sales',
            })
            .should.equal(true)
          sinon.assert.calledOnce(this.Modules.promises.hooks.fire)
          code.should.equal(204)
          done()
        },
      }
      this.Controller.submitForm(this.req, res, done)
    })
  })

  describe('flexibleLicensingSplitTest', function () {
    it('passes when the variant is "enabled"', function (done) {
      const res = sinon.stub()
      const next = () => {
        this.ErrorController.notFound.notCalled.should.equal(true)
        done()
      }
      this.SplitTestHandler.promises.getAssignment.resolves({
        variant: 'enabled',
      })
      this.Controller.flexibleLicensingSplitTest(this.req, res, next, done)
    })

    it('returns error page when the variant is "default"', function (done) {
      const res = sinon.stub()
      const next = sinon.stub()
      this.ErrorController.notFound = sinon.stub().callsFake(() => {
        next.notCalled.should.equal(true)
        done()
      })
      this.SplitTestHandler.promises.getAssignment.resolves({
        variant: 'default',
      })
      this.Controller.flexibleLicensingSplitTest(this.req, res, next, done)
    })
  })

  describe('subscriptionUpgradePage', function () {
    it('should render "subscription upgrade" page', function (done) {
      const olSubscription = { membersLimit: 1, teamName: 'test team' }
      this.SubscriptionModel.Subscription.findOne = () => {
        return {
          exec: () => olSubscription,
        }
      }

      const res = {
        render: (page, data) => {
          this.SubscriptionGroupHandler.promises.getGroupPlanUpgradePreview
            .calledWith(this.req.session.user._id)
            .should.equal(true)
          page.should.equal('subscriptions/upgrade-group-subscription-react')
          data.totalLicenses.should.equal(olSubscription.membersLimit)
          data.groupName.should.equal(olSubscription.teamName)
          data.changePreview.should.equal(this.previewSubscriptionChangeData)
          done()
        },
      }

      this.Controller.subscriptionUpgradePage(this.req, res)
    })

    it('should redirect if failed to generate preview', function (done) {
      this.SubscriptionGroupHandler.promises.getGroupPlanUpgradePreview = sinon
        .stub()
        .rejects()

      const res = {
        redirect: url => {
          url.should.equal('/user/subscription')
          done()
        },
      }

      this.Controller.subscriptionUpgradePage(this.req, res)
    })

    it('should redirect to missing billing information page when billing information is missing', function (done) {
      this.SubscriptionGroupHandler.promises.getGroupPlanUpgradePreview = sinon
        .stub()
        .throws(new this.Errors.MissingBillingInfoError())

      const res = {
        redirect: url => {
          url.should.equal(
            '/user/subscription/group/missing-billing-information'
          )
          done()
        },
      }

      this.Controller.subscriptionUpgradePage(this.req, res)
    })

    it('should redirect to manually collected subscription error page when collection method is manual', function (done) {
      this.SubscriptionGroupHandler.promises.getGroupPlanUpgradePreview = sinon
        .stub()
        .throws(new this.Errors.ManuallyCollectedError())

      const res = {
        redirect: url => {
          url.should.equal(
            '/user/subscription/group/manually-collected-subscription'
          )
          done()
        },
      }

      this.Controller.subscriptionUpgradePage(this.req, res)
    })
  })

  describe('upgradeSubscription', function () {
    it('should send 200 response', function (done) {
      this.SubscriptionGroupHandler.promises.upgradeGroupPlan = sinon
        .stub()
        .resolves()

      const res = {
        sendStatus: code => {
          code.should.equal(200)
          done()
        },
      }

      this.Controller.upgradeSubscription(this.req, res)
    })

    it('should send 500 response', function (done) {
      this.SubscriptionGroupHandler.promises.upgradeGroupPlan = sinon
        .stub()
        .rejects()

      const res = {
        sendStatus: code => {
          code.should.equal(500)
          done()
        },
      }

      this.Controller.upgradeSubscription(this.req, res)
    })
  })
})
