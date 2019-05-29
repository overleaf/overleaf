// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const UserMembershipAuthorization = require('./UserMembershipAuthorization')
const UserMembershipController = require('./UserMembershipController')
const SubscriptionGroupController = require('../Subscription/SubscriptionGroupController')
const TeamInvitesController = require('../Subscription/TeamInvitesController')
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware')

module.exports = {
  apply(webRouter) {
    // group members routes
    webRouter.get(
      '/manage/groups/:id/members',
      UserMembershipAuthorization.requireGroupManagementAccess,
      UserMembershipController.index
    )
    webRouter.post(
      '/manage/groups/:id/invites',
      UserMembershipAuthorization.requireGroupManagementAccess,
      RateLimiterMiddleware.rateLimit({
        endpointName: 'create-team-invite',
        maxRequests: 100,
        timeInterval: 60
      }),
      TeamInvitesController.createInvite
    )
    webRouter.delete(
      '/manage/groups/:id/user/:user_id',
      UserMembershipAuthorization.requireGroupManagementAccess,
      SubscriptionGroupController.removeUserFromGroup
    )
    webRouter.delete(
      '/manage/groups/:id/invites/:email',
      UserMembershipAuthorization.requireGroupManagementAccess,
      TeamInvitesController.revokeInvite
    )
    webRouter.get(
      '/manage/groups/:id/members/export',
      UserMembershipAuthorization.requireGroupManagementAccess,
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
      UserMembershipAuthorization.requireGroupManagersManagementAccess,
      UserMembershipController.index
    )
    webRouter.post(
      '/manage/groups/:id/managers',
      UserMembershipAuthorization.requireGroupManagersManagementAccess,
      UserMembershipController.add
    )
    webRouter.delete(
      '/manage/groups/:id/managers/:userId',
      UserMembershipAuthorization.requireGroupManagersManagementAccess,
      UserMembershipController.remove
    )

    // institution members routes
    webRouter.get(
      '/manage/institutions/:id/managers',
      UserMembershipAuthorization.requireInstitutionManagementAccess,
      UserMembershipController.index
    )
    webRouter.post(
      '/manage/institutions/:id/managers',
      UserMembershipAuthorization.requireInstitutionManagementAccess,
      UserMembershipController.add
    )
    webRouter.delete(
      '/manage/institutions/:id/managers/:userId',
      UserMembershipAuthorization.requireInstitutionManagementAccess,
      UserMembershipController.remove
    )

    // publisher members routes
    webRouter.get(
      '/manage/publishers/:id/managers',
      UserMembershipAuthorization.requirePublisherManagementAccess,
      UserMembershipController.index
    )
    webRouter.post(
      '/manage/publishers/:id/managers',
      UserMembershipAuthorization.requirePublisherManagementAccess,
      UserMembershipController.add
    )
    webRouter.delete(
      '/manage/publishers/:id/managers/:userId',
      UserMembershipAuthorization.requirePublisherManagementAccess,
      UserMembershipController.remove
    )

    // create new entitites
    webRouter.get(
      '/entities/:name/create/:id',
      UserMembershipAuthorization.requireEntityCreationAccess,
      UserMembershipController.new
    )
    return webRouter.post(
      '/entities/:name/create/:id',
      UserMembershipAuthorization.requireEntityCreationAccess,
      UserMembershipController.create
    )
  }
}
