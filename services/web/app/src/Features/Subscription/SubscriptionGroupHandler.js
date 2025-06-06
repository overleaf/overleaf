const { callbackify } = require('util')
const _ = require('lodash')
const OError = require('@overleaf/o-error')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const SubscriptionLocator = require('./SubscriptionLocator')
const SubscriptionController = require('./SubscriptionController')
const SubscriptionHelper = require('./SubscriptionHelper')
const { Subscription } = require('../../models/Subscription')
const { User } = require('../../models/User')
const RecurlyClient = require('./RecurlyClient')
const PlansLocator = require('./PlansLocator')
const SubscriptionHandler = require('./SubscriptionHandler')
const TeamInvitesHandler = require('./TeamInvitesHandler')
const GroupPlansData = require('./GroupPlansData')
const Modules = require('../../infrastructure/Modules')
const { MEMBERS_LIMIT_ADD_ON_CODE } = require('./PaymentProviderEntities')
const {
  ManuallyCollectedError,
  PendingChangeError,
  InactiveError,
  HasPastDueInvoiceError,
} = require('./Errors')
const EmailHelper = require('../Helpers/EmailHelper')
const { InvalidEmailError } = require('../Errors/Errors')

async function removeUserFromGroup(subscriptionId, userIdToRemove, auditLog) {
  await SubscriptionUpdater.promises.removeUserFromGroup(
    subscriptionId,
    userIdToRemove,
    auditLog
  )
}

async function replaceUserReferencesInGroups(oldId, newId) {
  await Subscription.updateOne({ admin_id: oldId }, { admin_id: newId }).exec()

  await _replaceInArray(Subscription, 'manager_ids', oldId, newId)
  await _replaceInArray(Subscription, 'member_ids', oldId, newId)
}

async function isUserPartOfGroup(userId, subscriptionId) {
  const subscription =
    await SubscriptionLocator.promises.getSubscriptionByMemberIdAndId(
      userId,
      subscriptionId
    )

  return !!subscription
}

async function getTotalConfirmedUsersInGroup(subscriptionId) {
  const subscription =
    await SubscriptionLocator.promises.getSubscription(subscriptionId)

  return subscription?.member_ids?.length
}

async function _replaceInArray(model, property, oldValue, newValue) {
  // Mongo won't let us pull and addToSet in the same query, so do it in
  // two. Note we need to add first, since the query is based on the old user.
  const query = {}
  query[property] = oldValue

  const setNewValue = {}
  setNewValue[property] = newValue

  const setOldValue = {}
  setOldValue[property] = oldValue

  await model.updateMany(query, { $addToSet: setNewValue })
  await model.updateMany(query, { $pull: setOldValue })
}

async function ensureFlexibleLicensingEnabled(plan) {
  if (!plan?.canUseFlexibleLicensing) {
    throw new Error('The group plan does not support flexible licensing')
  }
}

async function ensureSubscriptionIsActive(subscription) {
  if (SubscriptionHelper.getPaidSubscriptionState(subscription) !== 'active') {
    throw new InactiveError('The subscription is not active', {
      subscriptionId: subscription._id.toString(),
    })
  }
}

async function ensureSubscriptionCollectionMethodIsNotManual(
  recurlySubscription
) {
  if (recurlySubscription.isCollectionMethodManual) {
    throw new ManuallyCollectedError(
      'This subscription is being collected manually',
      {
        recurlySubscription_id: recurlySubscription.id,
      }
    )
  }
}

async function ensureSubscriptionHasNoPendingChanges(recurlySubscription) {
  if (recurlySubscription.pendingChange) {
    throw new PendingChangeError('This subscription has a pending change', {
      recurlySubscription_id: recurlySubscription.id,
    })
  }
}

async function ensureSubscriptionHasNoPastDueInvoice(subscription) {
  const [paymentRecord] = await Modules.promises.hooks.fire(
    'getPaymentFromRecord',
    subscription
  )

  if (paymentRecord.account.hasPastDueInvoice) {
    throw new HasPastDueInvoiceError(
      'This subscription has a past due invoice',
      {
        subscriptionId: subscription._id.toString(),
      }
    )
  }
}

async function getUsersGroupSubscriptionDetails(userId) {
  const subscription =
    await SubscriptionLocator.promises.getUsersSubscription(userId)

  if (!subscription) {
    throw new Error('No subscription was found')
  }

  if (!subscription.groupPlan) {
    throw new Error('User subscription is not a group plan')
  }

  const plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)

  const recurlySubscription = await RecurlyClient.promises.getSubscription(
    subscription.recurlySubscription_id
  )

  return {
    userId,
    subscription,
    recurlySubscription,
    plan,
  }
}

async function checkBillingInfoExistence(recurlySubscription, userId) {
  // Verify the billing info only if the collection method is not manual (e.g. automatic)
  if (!recurlySubscription.isCollectionMethodManual) {
    // Check if the user has missing billing details
    await RecurlyClient.promises.getPaymentMethod(userId)
  }
}

async function _addSeatsSubscriptionChange(userId, adding) {
  const { subscription, recurlySubscription, plan } =
    await getUsersGroupSubscriptionDetails(userId)
  await ensureFlexibleLicensingEnabled(plan)
  await ensureSubscriptionIsActive(subscription)
  await ensureSubscriptionHasNoPendingChanges(recurlySubscription)
  await checkBillingInfoExistence(recurlySubscription, userId)
  await ensureSubscriptionHasNoPastDueInvoice(subscription)

  const currentAddonQuantity =
    recurlySubscription.addOns.find(
      addOn => addOn.code === MEMBERS_LIMIT_ADD_ON_CODE
    )?.quantity ?? 0
  // Keeps only the new total quantity of addon
  const nextAddonQuantity = currentAddonQuantity + adding

  let changeRequest
  if (recurlySubscription.hasAddOn(MEMBERS_LIMIT_ADD_ON_CODE)) {
    // Not providing a custom price as once the subscription is locked
    // to an add-on at a given price, it will use it for subsequent payments
    changeRequest = recurlySubscription.getRequestForAddOnUpdate(
      MEMBERS_LIMIT_ADD_ON_CODE,
      nextAddonQuantity
    )
  } else {
    let unitPrice
    const pattern =
      /^group_(collaborator|professional)_(2|3|4|5|10|20|50)_(educational|enterprise)$/
    const [, planCode, size, usage] = plan.planCode.match(pattern)
    const currency = recurlySubscription.currency
    const planPriceInCents =
      GroupPlansData[usage][planCode][currency][size].price_in_cents
    const legacyUnitPriceInCents =
      GroupPlansData[usage][planCode][currency][size]
        .additional_license_legacy_price_in_cents

    if (
      _shouldUseLegacyPricing(
        recurlySubscription.planPrice,
        planPriceInCents / 100,
        usage,
        size
      )
    ) {
      unitPrice = legacyUnitPriceInCents / 100
    }

    changeRequest = recurlySubscription.getRequestForAddOnPurchase(
      MEMBERS_LIMIT_ADD_ON_CODE,
      nextAddonQuantity,
      unitPrice
    )
  }

  return {
    changeRequest,
    currentAddonQuantity,
    recurlySubscription,
  }
}

function _shouldUseLegacyPricing(
  actualPlanPrice,
  currentPlanPrice,
  usage,
  size
) {
  // For small educational groups (5 or fewer members)
  // 2025 pricing is cheaper than legacy pricing
  if (size <= 5 && usage === 'educational') {
    return currentPlanPrice < actualPlanPrice
  }

  // For all other scenarios
  // 2025 pricing is more expensive than legacy pricing
  return currentPlanPrice > actualPlanPrice
}

async function previewAddSeatsSubscriptionChange(userId, adding) {
  const { changeRequest, currentAddonQuantity } =
    await _addSeatsSubscriptionChange(userId, adding)
  const subscriptionChange =
    await RecurlyClient.promises.previewSubscriptionChange(changeRequest)
  const subscriptionChangePreview =
    await SubscriptionController.makeChangePreview(
      {
        type: 'add-on-update',
        addOn: {
          code: MEMBERS_LIMIT_ADD_ON_CODE,
          quantity: subscriptionChange.nextAddOns.find(
            addon => addon.code === MEMBERS_LIMIT_ADD_ON_CODE
          ).quantity,
          prevQuantity: currentAddonQuantity,
        },
      },
      subscriptionChange
    )

  return subscriptionChangePreview
}

async function createAddSeatsSubscriptionChange(userId, adding, poNumber) {
  const { changeRequest, recurlySubscription } =
    await _addSeatsSubscriptionChange(userId, adding)

  if (recurlySubscription.isCollectionMethodManual) {
    await updateSubscriptionPaymentTerms(userId, recurlySubscription, poNumber)
  }

  await RecurlyClient.promises.applySubscriptionChangeRequest(changeRequest)
  await SubscriptionHandler.promises.syncSubscription(
    { uuid: recurlySubscription.id },
    userId
  )

  return { adding }
}

async function updateSubscriptionPaymentTerms(
  userId,
  recurlySubscription,
  poNumber
) {
  const [termsAndConditions] = await Modules.promises.hooks.fire(
    'generateTermsAndConditions',
    { currency: recurlySubscription.currency, poNumber }
  )

  const updateRequest = poNumber
    ? recurlySubscription.getRequestForPoNumberAndTermsAndConditionsUpdate(
        poNumber,
        termsAndConditions
      )
    : recurlySubscription.getRequestForTermsAndConditionsUpdate(
        termsAndConditions
      )

  await RecurlyClient.promises.updateSubscriptionDetails(updateRequest)
}

async function _getUpgradeTargetPlanCodeMaybeThrow(subscription) {
  if (
    subscription.planCode.includes('professional') ||
    !subscription.groupPlan
  ) {
    throw new Error('Not eligible for group plan upgrade')
  }

  return subscription.planCode.replace('collaborator', 'professional')
}

async function _getGroupPlanUpgradeChangeRequest(ownerId) {
  const olSubscription =
    await SubscriptionLocator.promises.getUsersSubscription(ownerId)

  await ensureSubscriptionIsActive(olSubscription)

  const newPlanCode = await _getUpgradeTargetPlanCodeMaybeThrow(olSubscription)
  const recurlySubscription = await RecurlyClient.promises.getSubscription(
    olSubscription.recurlySubscription_id
  )

  await ensureSubscriptionCollectionMethodIsNotManual(recurlySubscription)
  await ensureSubscriptionHasNoPendingChanges(recurlySubscription)

  return recurlySubscription.getRequestForGroupPlanUpgrade(newPlanCode)
}

async function getGroupPlanUpgradePreview(ownerId) {
  const changeRequest = await _getGroupPlanUpgradeChangeRequest(ownerId)
  const subscriptionChange =
    await RecurlyClient.promises.previewSubscriptionChange(changeRequest)
  const paymentMethod = await RecurlyClient.promises.getPaymentMethod(ownerId)
  return SubscriptionController.makeChangePreview(
    {
      type: 'group-plan-upgrade',
      prevPlan: {
        name: SubscriptionController.getPlanNameForDisplay(
          subscriptionChange.subscription.planName,
          subscriptionChange.subscription.planCode
        ),
      },
    },
    subscriptionChange,
    paymentMethod
  )
}

async function upgradeGroupPlan(ownerId) {
  const changeRequest = await _getGroupPlanUpgradeChangeRequest(ownerId)
  await RecurlyClient.promises.applySubscriptionChangeRequest(changeRequest)
  await SubscriptionHandler.promises.syncSubscription(
    { uuid: changeRequest.subscription.id },
    ownerId
  )
}

async function updateGroupMembersBulk(
  inviterId,
  subscriptionId,
  emailList,
  options = {}
) {
  const { removeMembersNotIncluded, commit } = options

  // remove duplications and empty values
  emailList = _.uniq(_.compact(emailList))

  const invalidEmails = emailList.filter(
    email => !EmailHelper.parseEmail(email)
  )

  if (invalidEmails.length > 0) {
    throw new InvalidEmailError('email not valid', {
      invalidEmails,
    })
  }

  const subscription = await Subscription.findOne({
    _id: subscriptionId,
  }).exec()

  const existingUserData = await User.find(
    {
      _id: { $in: subscription.member_ids },
    },
    { _id: 1, email: 1, 'emails.email': 1 }
  ).exec()

  const existingUsers = existingUserData.map(user => ({
    _id: user._id,
    emails: user.emails?.map(user => user.email),
  }))

  const currentMemberEmails = _.flatten(
    existingUsers
      .filter(userData => userData.emails?.length > 0)
      .map(user => user.emails)
  )

  const currentInvites =
    subscription.teamInvites?.map(invite => invite.email) || []
  if (subscription.invited_emails?.length > 0) {
    currentInvites.push(...subscription.invited_emails)
  }

  const invitesToSend = _.difference(
    emailList,
    currentMemberEmails.concat(currentInvites)
  )

  let membersToRemove
  let invitesToRevoke
  let newTotalCount

  if (!removeMembersNotIncluded) {
    membersToRemove = []
    invitesToRevoke = []
    newTotalCount =
      existingUsers.length + currentInvites.length + invitesToSend.length
  } else {
    membersToRemove = []
    for (const existingUser of existingUsers) {
      if (_.intersection(existingUser.emails, emailList).length === 0) {
        membersToRemove.push(existingUser._id)
      }
    }
    const invitesToMaintain = _.intersection(emailList, currentInvites)
    invitesToRevoke = _.difference(currentInvites, invitesToMaintain)
    newTotalCount =
      existingUsers.length -
      membersToRemove.length +
      invitesToMaintain.length +
      invitesToSend.length
  }

  const result = {
    emailsToSendInvite: invitesToSend,
    emailsToRevokeInvite: invitesToRevoke,
    membersToRemove,
    currentMemberCount: existingUsers.length,
    newTotalCount,
    membersLimit: subscription.membersLimit,
  }

  if (commit) {
    if (newTotalCount > subscription.membersLimit) {
      const { currentMemberCount, newTotalCount, membersLimit } = result
      throw new OError('limit reached', {
        currentMemberCount,
        newTotalCount,
        membersLimit,
      })
    }
    for (const email of invitesToSend) {
      await TeamInvitesHandler.promises.createInvite(
        inviterId,
        subscription,
        email
      )
    }
    for (const email of invitesToRevoke) {
      await TeamInvitesHandler.promises.revokeInvite(
        inviterId,
        subscription,
        email
      )
    }
    for (const user of membersToRemove) {
      await removeUserFromGroup(subscription._id, user._id, {
        initiatorId: inviterId,
      })
    }
  }

  return result
}

module.exports = {
  removeUserFromGroup: callbackify(removeUserFromGroup),
  replaceUserReferencesInGroups: callbackify(replaceUserReferencesInGroups),
  ensureFlexibleLicensingEnabled: callbackify(ensureFlexibleLicensingEnabled),
  ensureSubscriptionIsActive: callbackify(ensureSubscriptionIsActive),
  ensureSubscriptionCollectionMethodIsNotManual: callbackify(
    ensureSubscriptionCollectionMethodIsNotManual
  ),
  ensureSubscriptionHasNoPendingChanges: callbackify(
    ensureSubscriptionHasNoPendingChanges
  ),
  ensureSubscriptionHasNoPastDueInvoice: callbackify(
    ensureSubscriptionHasNoPastDueInvoice
  ),
  getTotalConfirmedUsersInGroup: callbackify(getTotalConfirmedUsersInGroup),
  isUserPartOfGroup: callbackify(isUserPartOfGroup),
  getGroupPlanUpgradePreview: callbackify(getGroupPlanUpgradePreview),
  upgradeGroupPlan: callbackify(upgradeGroupPlan),
  checkBillingInfoExistence: callbackify(checkBillingInfoExistence),
  updateGroupMembersBulk: callbackify(updateGroupMembersBulk),
  promises: {
    removeUserFromGroup,
    replaceUserReferencesInGroups,
    ensureFlexibleLicensingEnabled,
    ensureSubscriptionIsActive,
    ensureSubscriptionCollectionMethodIsNotManual,
    ensureSubscriptionHasNoPendingChanges,
    ensureSubscriptionHasNoPastDueInvoice,
    getTotalConfirmedUsersInGroup,
    isUserPartOfGroup,
    getUsersGroupSubscriptionDetails,
    previewAddSeatsSubscriptionChange,
    createAddSeatsSubscriptionChange,
    updateSubscriptionPaymentTerms,
    getGroupPlanUpgradePreview,
    upgradeGroupPlan,
    checkBillingInfoExistence,
    updateGroupMembersBulk,
  },
}
