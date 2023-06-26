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
    userCannotAddSecondaryEmail: true,
    userCannotHaveSubscription: true,
    userCannotLeaveManagingGroupSubscription: true,
    userCannotHaveThirdPartySSO: true,
  }
}

module.exports = {
  getDefaultPolicy,
}
