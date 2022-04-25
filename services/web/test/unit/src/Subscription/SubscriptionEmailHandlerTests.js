const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/Subscription/SubscriptionEmailHandler'

describe('SubscriptionEmailHandler', function () {
  beforeEach(function () {
    this.userId = '123456789abcde'
    this.email = 'test@test.com'

    this.SubscriptionEmailHandler = SandboxedModule.require(modulePath, {
      requires: {
        '../Email/EmailHandler': (this.EmailHandler = {
          promises: {
            sendEmail: sinon.stub().resolves({}),
          },
        }),
        '../User/UserGetter': (this.UserGetter = {
          promises: {
            getUser: sinon
              .stub()
              .resolves({ _id: this.userId, email: 'test@test.com' }),
          },
        }),
        './PlansLocator': (this.PlansLocator = {
          findLocalPlanInSettings: sinon.stub().returns({
            name: 'foo',
            features: { collaborators: 42 },
          }),
        }),
      },
    })
  })

  it('sends trail onboarding email', async function () {
    await this.SubscriptionEmailHandler.sendTrialOnboardingEmail(
      this.userId,
      'foo-plan-code'
    )

    expect(this.PlansLocator.findLocalPlanInSettings).to.have.been.calledWith(
      'foo-plan-code'
    )
    expect(this.EmailHandler.promises.sendEmail.lastCall.args).to.deep.equal([
      'trialOnboarding',
      {
        to: this.email,
        sendingUser_id: this.userId,
        planName: 'foo',
        features: { collaborators: 42 },
      },
    ])
  })
})
