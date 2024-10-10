import UserMembershipMiddleware from './UserMembershipMiddleware.js'
import UserMembershipController from './UserMembershipController.mjs'
import SubscriptionGroupController from '../Subscription/SubscriptionGroupController.mjs'
import TeamInvitesController from '../Subscription/TeamInvitesController.mjs'
import { RateLimiter } from '../../infrastructure/RateLimiter.js'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.js'

const rateLimiters = {
  createTeamInvite: new RateLimiter('create-team-invite', {
    points: 200,
    duration: 60,
  }),
  exportTeamCsv: new RateLimiter('export-team-csv', {
    points: 30,
    duration: 60,
  }),
}

export default {
  apply(webRouter) {
    // group members routes
    webRouter.get(
      '/manage/groups/:id/members',
      UserMembershipMiddleware.requireGroupManagementAccess,
      UserMembershipController.manageGroupMembers
    )
    webRouter.post(
      '/manage/groups/:id/invites',
      UserMembershipMiddleware.requireGroupManagementAccess,
      RateLimiterMiddleware.rateLimit(rateLimiters.createTeamInvite),
      TeamInvitesController.createInvite
    )
    webRouter.post(
      '/manage/groups/:id/resendInvite',
      UserMembershipMiddleware.requireGroupManagementAccess,
      RateLimiterMiddleware.rateLimit(rateLimiters.createTeamInvite),
      TeamInvitesController.resendInvite
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
      RateLimiterMiddleware.rateLimit(rateLimiters.exportTeamCsv),
      UserMembershipController.exportCsv
    )

    // group managers routes
    webRouter.get(
      '/manage/groups/:id/managers',
      UserMembershipMiddleware.requireGroupManagersManagementAccess,
      UserMembershipController.manageGroupManagers
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
      UserMembershipController.manageInstitutionManagers
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
      UserMembershipController.managePublisherManagers
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
  },
}
