const {
  registerCapability,
  registerPolicy,
} = require('../Authorization/PermissionsManager')
const SubscriptionLocator = require('./SubscriptionLocator')

// This file defines the capabilities and policies that are used to
// determine what managed users can and cannot do.

// Register the capability for a user to delete their own account.
registerCapability('delete-own-account', { default: true })

// Register the capability for a user to add a secondary email to their account.
registerCapability('add-secondary-email', { default: true })

// Register the capability for a user to add an affiliation to their account.
registerCapability('add-affiliation', { default: true })

// Register the capability for a user to endorse an email address.
registerCapability('endorse-email', { default: true })

// Register the capability for a user to sign in with Google to their account
registerCapability('link-google-sso', { default: true })

// Register the capability for a user to link other third party SSO to their account
registerCapability('link-other-third-party-sso', { default: true })

// Register the capability for a user to leave a managed group subscription.
registerCapability('leave-group-subscription', { default: true })

// Register the capability for a user to start a subscription.
registerCapability('start-subscription', { default: true })

// Register the capability for a user to join a subscription.
registerCapability('join-subscription', { default: true })

// Register a policy to prevent a user deleting their own account.
registerPolicy('userCannotDeleteOwnAccount', {
  'delete-own-account': false,
})

// Register a policy to prevent a user having secondary email addresses on their account.
registerPolicy(
  'userCannotHaveSecondaryEmail',
  {
    'add-secondary-email': false,
    'add-affiliation': false,
    'endorse-email': false,
  },
  {
    validator: async user => {
      // return true if the user does not have any secondary emails
      return user.emails.length === 1
    },
  }
)

// Register a policy to prevent a user leaving the group subscription they are managed by.
registerPolicy('userCannotLeaveManagingGroupSubscription', {
  'leave-group-subscription': false,
})

// Register a policy to prevent a user having third-party SSO linked to their account.
registerPolicy(
  'userCannotHaveGoogleSSO',
  { 'link-google-sso': false },
  {
    // return true if the user does not have Google SSO linked
    validator: async user =>
      !user.thirdPartyIdentifiers?.some(
        identifier => identifier.providerId === 'google'
      ),
  }
)

// Register a policy to prevent a user having third-party SSO linked to their account.
registerPolicy(
  'userCannotHaveOtherThirdPartySSO',
  { 'link-other-third-party-sso': false },
  {
    // return true if the user does not have any other third party SSO linked
    validator: async user =>
      !user.thirdPartyIdentifiers?.some(
        identifier => identifier.providerId !== 'google'
      ),
  }
)

// Register a policy to prevent a user having an active personal subscription.
registerPolicy(
  'userCannotHaveSubscription',
  { 'start-subscription': false, 'join-subscription': false },
  {
    validator: async user => {
      return !(await SubscriptionLocator.promises.getUserIndividualSubscription(
        user
      ))
    },
  }
)

/**
 * Returns the default group policy for managed users.
 * Managed users are users who are part of a group subscription, and are
 * managed by the group policy. Managed users have limited functionality.
 * This method returns an object with boolean values for each policy that
 * indicates whether the policy is enforced or not.
 *
 * @returns {Object} An object with boolean values for each policy that indicates whether it is enforced or not.
 * @function
 */
function getDefaultPolicy() {
  return {
    userCannotDeleteOwnAccount: true,
    userCannotHaveSecondaryEmail: true,
    userCannotHaveSubscription: true,
    userCannotLeaveManagingGroupSubscription: true,
    userCannotHaveGoogleSSO: false, // we want to allow google SSO by default
    userCannotHaveOtherThirdPartySSO: true,
  }
}

module.exports = {
  getDefaultPolicy,
}
