const AuthenticationController = require('../Authentication/AuthenticationController')
const SubscriptionController = require('./SubscriptionController')
const SubscriptionGroupController = require('./SubscriptionGroupController')
const TeamInvitesController = require('./TeamInvitesController')
const { RateLimiter } = require('../../infrastructure/RateLimiter')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')
const Settings = require('@overleaf/settings')

const teamInviteRateLimiter = new RateLimiter('team-invite', {
  points: 10,
  duration: 60,
})

module.exports = {
  apply(webRouter, privateApiRouter, publicApiRouter) {
    if (!Settings.enableSubscriptions) {
      return
    }

    webRouter.get('/user/subscription/plans', SubscriptionController.plansPage)

    webRouter.get(
      '/user/subscription',
      AuthenticationController.requireLogin(),
      SubscriptionController.userSubscriptionPage
    )

    webRouter.get(
      '/user/subscription/new',
      AuthenticationController.requireLogin(),
      SubscriptionController.paymentPage
    )

    webRouter.get(
      '/user/subscription/choose-your-plan',
      AuthenticationController.requireLogin(),
      SubscriptionController.interstitialPaymentPage
    )

    webRouter.get(
      '/user/subscription/thank-you',
      AuthenticationController.requireLogin(),
      SubscriptionController.successfulSubscription
    )

    webRouter.get(
      '/user/subscription/canceled',
      AuthenticationController.requireLogin(),
      SubscriptionController.canceledSubscription
    )

    webRouter.get(
      '/user/subscription/recurly/:pageType',
      AuthenticationController.requireLogin(),
      SubscriptionController.redirectToHostedPage
    )

    webRouter.delete(
      '/subscription/group/user',
      AuthenticationController.requireLogin(),
      SubscriptionGroupController.removeSelfFromGroup
    )

    // Team invites
    webRouter.get(
      '/subscription/invites/:token/',
      AuthenticationController.requireLogin(),
      TeamInvitesController.viewInvite
    )
    webRouter.put(
      '/subscription/invites/:token/',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(teamInviteRateLimiter),
      TeamInvitesController.acceptInvite
    )

    // recurly callback
    publicApiRouter.post(
      '/user/subscription/callback',
      AuthenticationController.requireBasicAuth({
        [Settings.apis.recurly.webhookUser]: Settings.apis.recurly.webhookPass,
      }),
      SubscriptionController.recurlyNotificationParser,
      SubscriptionController.recurlyCallback
    )

    // user changes their account state
    webRouter.post(
      '/user/subscription/create',
      AuthenticationController.requireLogin(),
      SubscriptionController.createSubscription
    )
    webRouter.post(
      '/user/subscription/update',
      AuthenticationController.requireLogin(),
      SubscriptionController.updateSubscription
    )
    webRouter.post(
      '/user/subscription/cancel-pending',
      AuthenticationController.requireLogin(),
      SubscriptionController.cancelPendingSubscriptionChange
    )
    webRouter.post(
      '/user/subscription/cancel',
      AuthenticationController.requireLogin(),
      SubscriptionController.cancelSubscription
    )
    webRouter.post(
      '/user/subscription/reactivate',
      AuthenticationController.requireLogin(),
      SubscriptionController.reactivateSubscription
    )

    webRouter.post(
      '/user/subscription/v1/cancel',
      AuthenticationController.requireLogin(),
      SubscriptionController.cancelV1Subscription
    )

    webRouter.put(
      '/user/subscription/extend',
      AuthenticationController.requireLogin(),
      SubscriptionController.extendTrial
    )

    webRouter.get(
      '/user/subscription/upgrade-annual',
      AuthenticationController.requireLogin(),
      SubscriptionController.renderUpgradeToAnnualPlanPage
    )
    webRouter.post(
      '/user/subscription/upgrade-annual',
      AuthenticationController.requireLogin(),
      SubscriptionController.processUpgradeToAnnualPlan
    )

    webRouter.post(
      '/user/subscription/account/email',
      AuthenticationController.requireLogin(),
      SubscriptionController.updateAccountEmailAddress
    )
  },
}
