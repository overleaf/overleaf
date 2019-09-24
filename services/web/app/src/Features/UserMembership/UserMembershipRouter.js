// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const UserMembershipMiddleware = require('./UserMembershipMiddleware')
const UserMembershipController = require('./UserMembershipController')
const SubscriptionGroupController = require('../Subscription/SubscriptionGroupController')
const TeamInvitesController = require('../Subscription/TeamInvitesController')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')

module.exports = {
  apply(webRouter) {
    // group members routes
    webRouter.get(
      '/manage/groups/:id/members',
      UserMembershipMiddleware.requireGroupManagementAccess,
      UserMembershipController.index
    )
    webRouter.post(
      '/manage/groups/:id/invites',
      UserMembershipMiddleware.requireGroupManagementAccess,
      RateLimiterMiddleware.rateLimit({
        endpointName: 'create-team-invite',
        maxRequests: 100,
        timeInterval: 60
      }),
      TeamInvitesController.createInvite
    )
    webRouter.delete(
      '/manage/groups/:id/user/:user_id',
      UserMembershipMiddleware.requireGroupManagementAccess,
      SubscriptionGroupController.removeUserFromGroup
    )
    webRouter.delete(
      '/manage/groups/:id/invites/:email',
      UserMembershipMiddleware.requireGroupManagementAccess,
      TeamInvitesController.revokeInvite
    )
    webRouter.get(
      '/manage/groups/:id/members/export',
      UserMembershipMiddleware.requireGroupManagementAccess,
      RateLimiterMiddleware.rateLimit({
        endpointName: 'export-team-csv',
        maxRequests: 30,
        timeInterval: 60
      }),
      UserMembershipController.exportCsv
    )

    // group managers routes
    webRouter.get(
      '/manage/groups/:id/managers',
      UserMembershipMiddleware.requireGroupManagersManagementAccess,
      UserMembershipController.index
    )
    webRouter.post(
      '/manage/groups/:id/managers',
      UserMembershipMiddleware.requireGroupManagersManagementAccess,
      UserMembershipController.add
    )
    webRouter.delete(
      '/manage/groups/:id/managers/:userId',
      UserMembershipMiddleware.requireGroupManagersManagementAccess,
      UserMembershipController.remove
    )

    // institution members routes
    webRouter.get(
      '/manage/institutions/:id/managers',
      UserMembershipMiddleware.requireInstitutionManagementAccess,
      UserMembershipController.index
    )
    webRouter.post(
      '/manage/institutions/:id/managers',
      UserMembershipMiddleware.requireInstitutionManagementAccess,
      UserMembershipController.add
    )
    webRouter.delete(
      '/manage/institutions/:id/managers/:userId',
      UserMembershipMiddleware.requireInstitutionManagementAccess,
      UserMembershipController.remove
    )

    // publisher members routes
    webRouter.get(
      '/manage/publishers/:id/managers',
      UserMembershipMiddleware.requirePublisherManagementAccess,
      UserMembershipController.index
    )
    webRouter.post(
      '/manage/publishers/:id/managers',
      UserMembershipMiddleware.requirePublisherManagementAccess,
      UserMembershipController.add
    )
    webRouter.delete(
      '/manage/publishers/:id/managers/:userId',
      UserMembershipMiddleware.requirePublisherManagementAccess,
      UserMembershipController.remove
    )

    // publisher creation routes
    webRouter.get(
      '/entities/publisher/create/:id',
      UserMembershipMiddleware.requirePublisherCreationAccess,
      UserMembershipController.new
    )
    webRouter.post(
      '/entities/publisher/create/:id',
      UserMembershipMiddleware.requirePublisherCreationAccess,
      UserMembershipController.create
    )

    // institution creation routes
    webRouter.get(
      '/entities/institution/create/:id',
      UserMembershipMiddleware.requireInstitutionCreationAccess,
      UserMembershipController.new
    )
    webRouter.post(
      '/entities/institution/create/:id',
      UserMembershipMiddleware.requireInstitutionCreationAccess,
      UserMembershipController.create
    )
  }
}
