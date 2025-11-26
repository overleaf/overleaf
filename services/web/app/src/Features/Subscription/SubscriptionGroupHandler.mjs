import { callbackify } from 'node:util'
import _ from 'lodash'
import OError from '@overleaf/o-error'
import SubscriptionUpdater from './SubscriptionUpdater.mjs'
import SubscriptionLocator from './SubscriptionLocator.mjs'
import SubscriptionController from './SubscriptionController.mjs'
import SubscriptionHelper from './SubscriptionHelper.mjs'
import { Subscription } from '../../models/Subscription.mjs'
import { User } from '../../models/User.mjs'
import PlansLocator from './PlansLocator.mjs'
import TeamInvitesHandler from './TeamInvitesHandler.mjs'
import GroupPlansData from './GroupPlansData.mjs'
import Modules from '../../infrastructure/Modules.mjs'
import PaymentProviderEntities from './PaymentProviderEntities.mjs'
import {
  ManuallyCollectedError,
  PendingChangeError,
  InactiveError,
  HasPastDueInvoiceError,
  HasNoAdditionalLicenseWhenManuallyCollectedError,
} from './Errors.mjs'
import EmailHelper from '../Helpers/EmailHelper.mjs'
import { InvalidEmailError } from '../Errors/Errors.js'

const MEMBERS_LIMIT_ADD_ON_CODE =
  PaymentProviderEntities.MEMBERS_LIMIT_ADD_ON_CODE

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
  paymentProviderSubscription
) {
  if (paymentProviderSubscription.isCollectionMethodManual) {
    throw new ManuallyCollectedError(
      'This subscription is being collected manually',
      {
        subscription_id: paymentProviderSubscription.id,
      }
    )
  }
}

async function ensureSubscriptionHasNoPendingChanges(
  paymentProviderSubscription
) {
  if (paymentProviderSubscription.pendingChange) {
    throw new PendingChangeError('This subscription has a pending change', {
      subscription_id: paymentProviderSubscription.id,
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

async function ensureSubscriptionHasAdditionalLicenseAddOnWhenCollectionMethodIsManual(
  paymentProviderSubscription
) {
  if (
    paymentProviderSubscription.isCollectionMethodManual &&
    !paymentProviderSubscription.hasAddOn(MEMBERS_LIMIT_ADD_ON_CODE)
  ) {
    throw new HasNoAdditionalLicenseWhenManuallyCollectedError(
      'This subscription is being collected manually has no "additional-license" add-on',
      {
        subscription_id: paymentProviderSubscription.id,
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

  const response = await Modules.promises.hooks.fire(
    'getPaymentFromRecord',
    subscription
  )

  const { subscription: paymentProviderSubscription } = response[0]

  return {
    userId,
    subscription,
    paymentProviderSubscription,
    plan,
  }
}

async function checkBillingInfoExistence(paymentProviderSubscription, userId) {
  // Verify the billing info only if the collection method is not manual (e.g. automatic)
  if (!paymentProviderSubscription.isCollectionMethodManual) {
    // Check if the user has missing billing details
    await Modules.promises.hooks.fire('getPaymentMethod', userId)
  }
}

async function _addSeatsSubscriptionChange(userId, adding) {
  const { subscription, paymentProviderSubscription, plan } =
    await getUsersGroupSubscriptionDetails(userId)
  await ensureFlexibleLicensingEnabled(plan)
  await ensureSubscriptionIsActive(subscription)
  await ensureSubscriptionHasNoPendingChanges(paymentProviderSubscription)
  await checkBillingInfoExistence(paymentProviderSubscription, userId)
  await ensureSubscriptionHasNoPastDueInvoice(subscription)

  const currentAddonQuantity =
    paymentProviderSubscription.addOns.find(
      addOn => addOn.code === MEMBERS_LIMIT_ADD_ON_CODE
    )?.quantity ?? 0
  // Keeps only the new total quantity of addon
  const nextAddonQuantity = currentAddonQuantity + adding

  let changeRequest
  if (paymentProviderSubscription.hasAddOn(MEMBERS_LIMIT_ADD_ON_CODE)) {
    // Not providing a custom price as once the subscription is locked
    // to an add-on at a given price, it will use it for subsequent payments
    changeRequest = paymentProviderSubscription.getRequestForAddOnUpdate(
      MEMBERS_LIMIT_ADD_ON_CODE,
      nextAddonQuantity
    )
  } else {
    let unitPrice
    const pattern =
      /^group_(collaborator|professional)_(2|3|4|5|10|20|50)_(educational|enterprise)$/
    const [, planCode, size, usage] = plan.planCode.match(pattern)
    const currency = paymentProviderSubscription.currency
    const planPriceInCents =
      GroupPlansData[usage][planCode][currency][size].price_in_cents
    const legacyUnitPriceInCents =
      GroupPlansData[usage][planCode][currency][size]
        .additional_license_legacy_price_in_cents

    if (
      _shouldUseLegacyPricing(
        paymentProviderSubscription.planPrice,
        planPriceInCents / 100,
        usage,
        size
      )
    ) {
      unitPrice = legacyUnitPriceInCents / 100
    }

    changeRequest = paymentProviderSubscription.getRequestForAddOnPurchase(
      MEMBERS_LIMIT_ADD_ON_CODE,
      nextAddonQuantity,
      unitPrice
    )
  }

  return {
    changeRequest,
    currentAddonQuantity,
    paymentProviderSubscription,
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
  const response = await Modules.promises.hooks.fire(
    'previewSubscriptionChangeRequest',
    changeRequest
  )
  const subscriptionChange = response[0]
  const subscriptionChangePreview = SubscriptionController.makeChangePreview(
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
  const { changeRequest, paymentProviderSubscription } =
    await _addSeatsSubscriptionChange(userId, adding)

  let subscriptionDetailUpdateRequest
  if (paymentProviderSubscription.isCollectionMethodManual) {
    subscriptionDetailUpdateRequest = await updateSubscriptionPaymentTerms(
      paymentProviderSubscription,
      poNumber
    )
  }
  await Modules.promises.hooks.fire(
    'applySubscriptionChangeRequestAndSync',
    changeRequest,
    userId,
    subscriptionDetailUpdateRequest?.termsAndConditions
  )

  return { adding }
}

async function updateSubscriptionPaymentTerms(
  paymentProviderSubscription,
  poNumber
) {
  const [termsAndConditions] = await Modules.promises.hooks.fire(
    'generateTermsAndConditions',
    { currency: paymentProviderSubscription.currency, poNumber }
  )

  const subscriptionDetailUpdateRequest = poNumber
    ? paymentProviderSubscription.getRequestForPoNumberAndTermsAndConditionsUpdate(
        poNumber,
        termsAndConditions
      )
    : paymentProviderSubscription.getRequestForTermsAndConditionsUpdate(
        termsAndConditions
      )
  await Modules.promises.hooks.fire(
    'updateSubscriptionDetails',
    subscriptionDetailUpdateRequest
  )
  return subscriptionDetailUpdateRequest
}

async function getGroupPlanUpgradePreview(ownerId) {
  const preview = await Modules.promises.hooks.fire(
    'previewGroupPlanUpgrade',
    ownerId
  )
  const { subscriptionChange, paymentMethod } = preview[0]
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
  await Modules.promises.hooks.fire('upgradeGroupPlan', ownerId)
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

export default {
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
  ensureSubscriptionHasAdditionalLicenseAddOnWhenCollectionMethodIsManual:
    callbackify(
      ensureSubscriptionHasAdditionalLicenseAddOnWhenCollectionMethodIsManual
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
    ensureSubscriptionHasAdditionalLicenseAddOnWhenCollectionMethodIsManual,
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
