import AuthenticationController from '../Authentication/AuthenticationController.js'
import PermissionsController from '../Authorization/PermissionsController.js'
import SubscriptionController from './SubscriptionController.js'
import SubscriptionGroupController from './SubscriptionGroupController.mjs'
import TeamInvitesController from './TeamInvitesController.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.js'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.js'
import Settings from '@overleaf/settings'
import { Joi, validate } from '../../infrastructure/Validation.js'

const teamInviteRateLimiter = new RateLimiter('team-invite', {
  points: 10,
  duration: 60,
})

const subscriptionRateLimiter = new RateLimiter('subscription', {
  points: 30,
  duration: 60,
})

const MAX_NUMBER_OF_USERS = 50

const addSeatsValidateSchema = {
  body: Joi.object({
    adding: Joi.number().integer().min(1).max(MAX_NUMBER_OF_USERS).required(),
  }),
}

export default {
  apply(webRouter, privateApiRouter, publicApiRouter) {
    if (!Settings.enableSubscriptions) {
      return
    }

    webRouter.get(
      '/user/subscription',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      PermissionsController.useCapabilities(),
      SubscriptionController.userSubscriptionPage
    )

    webRouter.get(
      '/user/subscription/thank-you',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.successfulSubscription
    )

    webRouter.get(
      '/user/subscription/canceled',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.canceledSubscription
    )

    webRouter.get(
      '/user/subscription/recurly/:pageType',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.redirectToHostedPage
    )

    webRouter.delete(
      '/subscription/group/user',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      PermissionsController.requirePermission('leave-group-subscription'),
      SubscriptionGroupController.removeSelfFromGroup
    )

    webRouter.get(
      '/user/subscription/group/add-users',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionGroupController.flexibleLicensingSplitTest,
      SubscriptionGroupController.addSeatsToGroupSubscription
    )

    webRouter.post(
      '/user/subscription/group/add-users/preview',
      AuthenticationController.requireLogin(),
      validate(addSeatsValidateSchema),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionGroupController.previewAddSeatsSubscriptionChange
    )

    webRouter.post(
      '/user/subscription/group/add-users/create',
      AuthenticationController.requireLogin(),
      validate(addSeatsValidateSchema),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionGroupController.createAddSeatsSubscriptionChange
    )

    webRouter.post(
      '/user/subscription/group/add-users/sales-contact-form',
      validate({
        body: Joi.object({
          adding: Joi.number().integer().min(MAX_NUMBER_OF_USERS).required(),
        }),
      }),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionGroupController.submitForm
    )

    webRouter.get(
      '/user/subscription/group/upgrade-subscription',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionGroupController.flexibleLicensingSplitTest,
      SubscriptionGroupController.subscriptionUpgradePage
    )

    webRouter.post(
      '/user/subscription/group/upgrade-subscription',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionGroupController.upgradeSubscription
    )

    webRouter.get(
      '/user/subscription/group/missing-billing-information',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionGroupController.flexibleLicensingSplitTest,
      SubscriptionGroupController.missingBillingInformation
    )

    webRouter.get(
      '/user/subscription/group/manually-collected-subscription',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionGroupController.flexibleLicensingSplitTest,
      SubscriptionGroupController.manuallyCollectedSubscription
    )

    // Team invites
    webRouter.get(
      '/subscription/invites/:token/',
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      PermissionsController.useCapabilities(),
      TeamInvitesController.viewInvite
    )
    webRouter.get(
      '/subscription/invites/',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      PermissionsController.useCapabilities(),
      TeamInvitesController.viewInvites
    )
    webRouter.put(
      '/subscription/invites/:token/',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(teamInviteRateLimiter),
      PermissionsController.requirePermission('join-subscription'),
      TeamInvitesController.acceptInvite
    )

    // recurly callback
    publicApiRouter.post(
      '/user/subscription/callback',
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      AuthenticationController.requireBasicAuth({
        [Settings.apis.recurly.webhookUser]: Settings.apis.recurly.webhookPass,
      }),
      SubscriptionController.recurlyNotificationParser,
      SubscriptionController.recurlyCallback
    )

    // user changes their account state
    webRouter.get(
      '/user/subscription/preview',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.previewSubscription
    )
    webRouter.post(
      '/user/subscription/update',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.updateSubscription
    )
    webRouter.get(
      '/user/subscription/addon/:addOnCode/add',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.previewAddonPurchase
    )
    webRouter.post(
      '/user/subscription/addon/:addOnCode/add',
      AuthenticationController.requireLogin(),
      validate({
        params: Joi.object({
          addOnCode: Joi.string(),
        }),
      }),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.purchaseAddon
    )
    webRouter.post(
      '/user/subscription/addon/:addOnCode/remove',
      AuthenticationController.requireLogin(),
      validate({
        params: Joi.object({
          addOnCode: Joi.string(),
        }),
      }),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.removeAddon
    )
    webRouter.post(
      '/user/subscription/cancel-pending',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.cancelPendingSubscriptionChange
    )
    webRouter.post(
      '/user/subscription/cancel',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.cancelSubscription
    )
    webRouter.post(
      '/user/subscription/pause/:pauseCycles',
      AuthenticationController.requireLogin(),
      validate({
        params: Joi.object({
          pauseCycles: Joi.number().integer().max(12),
        }),
      }),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.pauseSubscription
    )
    webRouter.post(
      '/user/subscription/resume',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.resumeSubscription
    )
    webRouter.post(
      '/user/subscription/reactivate',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      PermissionsController.useCapabilities(),
      SubscriptionController.reactivateSubscription
    )

    webRouter.post(
      '/user/subscription/v1/cancel',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.cancelV1Subscription
    )

    webRouter.put(
      '/user/subscription/extend',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.extendTrial
    )

    webRouter.post(
      '/user/subscription/account/email',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(subscriptionRateLimiter),
      SubscriptionController.updateAccountEmailAddress
    )
  },
}
