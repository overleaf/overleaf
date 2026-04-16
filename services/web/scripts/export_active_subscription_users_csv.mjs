import fs from 'node:fs'
import { Parser as CSVParser } from 'json2csv'
import minimist from 'minimist'
import pLimit from 'p-limit'
import Settings from '@overleaf/settings'
import { scriptRunner } from './lib/ScriptRunner.mjs'
import {
  db,
  ObjectId,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.mjs'
import PaymentService from '../modules/subscriptions/app/src/PaymentService.mjs'
import FeaturesHelper from '../app/src/Features/Subscription/FeaturesHelper.mjs'
import CustomerIoPlanHelpers from '../app/src/Features/Subscription/CustomerIoPlanHelpers.mjs'
import { isStandaloneAiAddOnPlanCode } from '../app/src/Features/Subscription/AiHelper.mjs'
import InstitutionsGetter from '../app/src/Features/Institutions/InstitutionsGetter.mjs'

const CSV_FIELDS = [
  { label: 'user_id', value: 'userId' },
  { label: 'email', value: 'email' },
  { label: 'plan_type', value: 'planType' },
  { label: 'display_plan_type', value: 'displayPlanType' },
  {
    label: 'pre_migration_plan_type',
    value: 'preMigrationPlanType',
  },
  {
    label: 'pre_migration_display_plan_type',
    value: 'preMigrationDisplayPlanType',
  },
  { label: 'plan_term', value: 'planTerm' },
  { label: 'ai_plan', value: 'aiPlan' },
  { label: 'ai_plan_term', value: 'aiPlanTerm' },
  { label: 'next_renewal_date', value: 'nextRenewalDate' },
  { label: 'expiry_date', value: 'expiryDate' },
  { label: 'group_ai_enabled', value: 'groupAIEnabled' },
  { label: 'group_role', value: 'groupRole' },
]
const CSV_FIELD_NAMES = CSV_FIELDS.map(field => field.value)

const ACTIVE_SUBSCRIPTION_STATES = ['active', 'trialing']
const COMMONS_PLAN = getPlan(Settings.institutionPlanCode)

function usage() {
  console.log(`
Usage:
  node scripts/export_active_subscription_users_csv.mjs [options]

Options:
  --outputPath <path>         Output CSV path (default: /tmp/active_subscription_users.csv)
  --concurrency <number>      Concurrent payment-provider lookups (default: 5)
  --batchSize <number>        Number of users processed per batch (default: 500)
  --resumeAfterUserId <id>    Resume processing strictly after this user id
  --checkpointInterval <n>    Log resumable checkpoint every N processed users (default: 10000)
  --append                    Append to existing output file (for resume runs)
  --help                      Show this message
`)
}

function parseArgs() {
  const args = minimist(process.argv.slice(2), {
    string: ['outputPath', 'resumeAfterUserId'],
    boolean: ['help', 'append'],
    default: {
      outputPath: '/tmp/active_subscription_users.csv',
      concurrency: 5,
      batchSize: 500,
      checkpointInterval: 10000,
      append: false,
      help: false,
    },
  })

  if (args.help) {
    usage()
    process.exit(0)
  }

  return args
}

function getPlan(planCode) {
  return Settings.plans.find(plan => plan.planCode === planCode) || null
}

function getPlanType(subscription) {
  if (isStandaloneAiAddOnPlanCode(subscription.planCode)) {
    return 'standalone-ai-add-on'
  }
  return subscription.groupPlan ? 'group' : 'individual'
}

function getPlanCadence(subscription, plan) {
  if (plan != null) {
    return plan.annual ? 'annual' : 'monthly'
  }

  if (isStandaloneAiAddOnPlanCode(subscription.planCode)) {
    return subscription.planCode.includes('annual') ? 'annual' : 'monthly'
  }

  return ''
}

function userHasPremiumAiFeatures(user) {
  return (
    user?.features?.aiErrorAssistant === true ||
    user?.features?.aiUsageQuota === Settings.aiFeatures.unlimitedQuota
  )
}

async function userHasCurrentInstitutionLicence(userId, commonsCache) {
  if (commonsCache.has(userId)) {
    return commonsCache.get(userId)
  }

  try {
    const institutions =
      await InstitutionsGetter.promises.getCurrentInstitutionsWithLicence(
        userId
      )
    const hasCommons = Boolean(institutions?.length)
    commonsCache.set(userId, hasCommons)
    return hasCommons
  } catch (error) {
    console.warn(
      `Failed to evaluate commons licence for user ${userId}: ${error.message}`
    )
    commonsCache.set(userId, false)
    return false
  }
}

function isMemberOfGroupSubscription(candidates) {
  return candidates.some(candidate => candidate.subscription?.groupPlan)
}

function getAiPlanForUser({
  bestSubscription,
  planType,
  individualSubscription,
  paymentRecord,
  user,
  userIsMemberOfGroupSubscription,
  userHasActiveOverleafSubscription,
}) {
  const baseAiPlan = CustomerIoPlanHelpers.getAiPlanType(
    bestSubscription,
    individualSubscription,
    paymentRecord,
    user?.writefull,
    userIsMemberOfGroupSubscription
  )

  if (baseAiPlan !== 'none') {
    return baseAiPlan
  }

  if (!userHasActiveOverleafSubscription && userHasPremiumAiFeatures(user)) {
    return 'ai-assist'
  }

  return 'none'
}

function getPaymentState(subscription) {
  if (subscription?.recurlyStatus?.state) {
    return subscription.recurlyStatus.state
  }

  if (subscription?.paymentProvider?.state) {
    return subscription.paymentProvider.state
  }

  return null
}

function isActivePaidSubscription(subscription) {
  const hasRecurlySubscription = Boolean(subscription?.recurlySubscription_id)
  const hasStripeSubscription = Boolean(
    subscription?.paymentProvider?.subscriptionId
  )

  if (!hasRecurlySubscription && !hasStripeSubscription) {
    return false
  }

  return ACTIVE_SUBSCRIPTION_STATES.includes(getPaymentState(subscription))
}

function getGroupAiEnabled(candidates) {
  const groupCandidates = candidates.filter(
    candidate => getPlanType(candidate.subscription) === 'group'
  )

  if (groupCandidates.length === 0) {
    return ''
  }

  return groupCandidates.some(candidate =>
    CustomerIoPlanHelpers.hasPlanAiEnabled(candidate.plan)
  )
}

function getGroupRole(candidates, userId) {
  const groupCandidates = candidates.filter(
    candidate => candidate.subscription?.groupPlan
  )

  if (groupCandidates.length === 0) {
    return ''
  }

  const isGroupAdminOrManager = groupCandidates.some(candidate => {
    const subscription = candidate.subscription
    const adminId = subscription?.admin_id?.toString()
    const managerIds = (subscription?.manager_ids || []).map(id =>
      id?.toString()
    )

    return adminId === userId || managerIds.includes(userId)
  })

  return isGroupAdminOrManager ? 'admin' : 'member'
}

function chooseBestCandidate(candidates) {
  let best = null

  for (const candidate of candidates) {
    if (best == null) {
      best = candidate
      continue
    }

    const candidateType = getPlanType(candidate.subscription)
    const bestType = getPlanType(best.subscription)

    if (candidateType === 'standalone-ai-add-on' && bestType !== 'free') {
      continue
    }

    if (
      candidateType !== 'standalone-ai-add-on' &&
      bestType === 'standalone-ai-add-on'
    ) {
      best = candidate
      continue
    }

    if (
      FeaturesHelper.isFeatureSetBetter(
        candidate.plan?.features || {},
        best.plan?.features || {}
      )
    ) {
      best = candidate
    }
  }

  return best
}

function getSubscriptionQuery() {
  return {
    $or: [
      {
        recurlySubscription_id: { $exists: true, $nin: ['', null] },
        'recurlyStatus.state': { $in: ACTIVE_SUBSCRIPTION_STATES },
      },
      {
        'paymentProvider.subscriptionId': { $exists: true, $nin: ['', null] },
        'paymentProvider.state': { $in: ACTIVE_SUBSCRIPTION_STATES },
      },
    ],
  }
}

function getSubscriptionProjection() {
  return {
    _id: 1,
    admin_id: 1,
    manager_ids: 1,
    member_ids: 1,
    planCode: 1,
    groupPlan: 1,
    recurlySubscription_id: 1,
    recurlyStatus: 1,
    paymentProvider: 1,
    addOns: 1,
  }
}

function getSupplementaryUserQuery() {
  return {
    $or: [
      { 'writefull.isPremium': true },
      { 'features.aiErrorAssistant': true },
      { 'features.aiUsageQuota': Settings.aiFeatures.unlimitedQuota },
      {
        emails: {
          $elemMatch: {
            confirmedAt: { $exists: true },
            'affiliation.institution.confirmed': true,
            'affiliation.licence': { $exists: true, $ne: 'free' },
            'affiliation.pastReconfirmDate': { $ne: true },
          },
        },
      },
    ],
  }
}

function getTargetUserIdsPipeline(resumeAfterUserId) {
  const pipeline = [
    { $match: getSubscriptionQuery() },
    {
      $project: {
        participantIds: {
          $setUnion: [
            [{ $ifNull: ['$admin_id', null] }],
            { $ifNull: ['$manager_ids', []] },
            { $ifNull: ['$member_ids', []] },
          ],
        },
      },
    },
    { $unwind: '$participantIds' },
    { $match: { participantIds: { $ne: null } } },
    { $group: { _id: '$participantIds' } },
    {
      $unionWith: {
        coll: 'users',
        pipeline: [
          { $match: getSupplementaryUserQuery() },
          { $project: { _id: 1 } },
        ],
      },
    },
    { $group: { _id: '$_id' } },
  ]

  if (resumeAfterUserId) {
    let resumeId = resumeAfterUserId
    try {
      resumeId = new ObjectId(resumeAfterUserId)
    } catch {
      // leave as-is for non-ObjectId identifiers
    }
    pipeline.push({ $match: { _id: { $gt: resumeId } } })
  }

  pipeline.push({ $sort: { _id: 1 } })

  return pipeline
}

function getTargetUserIdsCursor(resumeAfterUserId) {
  return db.subscriptions.aggregate(
    getTargetUserIdsPipeline(resumeAfterUserId),
    {
      allowDiskUse: true,
      readPreference: READ_PREFERENCE_SECONDARY,
    }
  )
}

function isInvalidOrMissingSubscriptionError(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    message.includes('no such subscription') ||
    message.includes('invalid subscription') ||
    message.includes('subscription not found')
  )
}

async function getSubscriptionPaymentInfo(
  userId,
  subscription,
  paymentInfoCache
) {
  const subscriptionId = subscription._id.toString()
  if (paymentInfoCache.has(subscriptionId)) {
    return {
      ...paymentInfoCache.get(subscriptionId),
      skip: false,
    }
  }

  try {
    const paymentRecord =
      await PaymentService.promises.getPaymentFromRecord(subscription)
    const nextRenewalDate =
      CustomerIoPlanHelpers.getNextRenewalDateFromPaymentRecord(
        paymentRecord
      ) || ''
    const paymentInfo = { nextRenewalDate, paymentRecord }
    paymentInfoCache.set(subscriptionId, paymentInfo)
    return { ...paymentInfo, skip: false }
  } catch (error) {
    if (isInvalidOrMissingSubscriptionError(error)) {
      console.warn(
        `Skipping user ${userId}: invalid/missing payment-provider subscription for subscription ${subscriptionId} (${error.message})`
      )
      return { nextRenewalDate: '', paymentRecord: null, skip: true }
    }

    console.error(
      `Failed to get renewal date for subscription ${subscriptionId}:`,
      error.message
    )
    const paymentInfo = { nextRenewalDate: '', paymentRecord: null }
    paymentInfoCache.set(subscriptionId, paymentInfo)
    return { ...paymentInfo, skip: false }
  }
}

async function getUsersByIds(userIds) {
  const objectIds = []
  for (const userId of userIds) {
    try {
      objectIds.push(new ObjectId(userId))
    } catch {
      // ignore invalid ObjectId strings
    }
  }

  const idFilters = []
  if (objectIds.length > 0) {
    idFilters.push({ _id: { $in: objectIds } })
  }
  if (userIds.length > 0) {
    idFilters.push({ _id: { $in: userIds } })
  }

  if (idFilters.length === 0) {
    return new Map()
  }

  const users = await db.users
    .find(idFilters.length === 1 ? idFilters[0] : { $or: idFilters }, {
      projection: {
        _id: 1,
        email: 1,
        features: 1,
        writefull: 1,
      },
      readPreference: READ_PREFERENCE_SECONDARY,
    })
    .toArray()

  return new Map(users.map(user => [user._id.toString(), user]))
}

async function getActiveSubscriptionsForUserIds(userIds) {
  const objectIds = []
  for (const userId of userIds) {
    try {
      objectIds.push(new ObjectId(userId))
    } catch {
      // ignore invalid ObjectId strings
    }
  }

  const idValues = objectIds.length > 0 ? objectIds : userIds

  return await db.subscriptions
    .find(
      {
        ...getSubscriptionQuery(),
        $or: [
          { admin_id: { $in: idValues } },
          { manager_ids: { $in: idValues } },
          { member_ids: { $in: idValues } },
        ],
      },
      {
        projection: getSubscriptionProjection(),
        readPreference: READ_PREFERENCE_SECONDARY,
      }
    )
    .toArray()
}

function buildUserCandidatesMap(subscriptions, allowedUserIds) {
  const userCandidates = new Map()
  const allowedUserIdsSet = new Set(allowedUserIds)

  function addCandidate(userId, candidate) {
    if (!userId || !allowedUserIdsSet.has(userId)) {
      return
    }
    if (!userCandidates.has(userId)) {
      userCandidates.set(userId, [])
    }
    userCandidates.get(userId).push(candidate)
  }

  for (const subscription of subscriptions) {
    const plan = getPlan(subscription.planCode)
    const baseCandidate = { subscription, plan }

    const adminId = subscription.admin_id?.toString()
    addCandidate(adminId, baseCandidate)

    if (Array.isArray(subscription.manager_ids)) {
      for (const managerIdRaw of subscription.manager_ids) {
        addCandidate(managerIdRaw?.toString(), baseCandidate)
      }
    }

    if (subscription.groupPlan && Array.isArray(subscription.member_ids)) {
      for (const memberIdRaw of subscription.member_ids) {
        addCandidate(memberIdRaw?.toString(), baseCandidate)
      }
    }
  }

  return userCandidates
}

function writeCsvRows(writeStream, rows, includeHeader) {
  if (rows.length === 0) {
    return
  }

  const csvParser = new CSVParser({
    fields: includeHeader ? CSV_FIELDS : CSV_FIELD_NAMES,
    header: includeHeader,
    eol: '\n',
  })

  writeStream.write(`${csvParser.parse(rows)}\n`)
}

function writeCsvHeader(writeStream) {
  writeStream.write(`${CSV_FIELDS.map(field => field.label).join(',')}\n`)
}

async function processUserBatch({
  userIds,
  writeStream,
  paymentInfoCache,
  commonsCache,
  limit,
  trackProgress,
  totalUsersCount,
  globalState,
  checkpointInterval,
}) {
  const usersById = await getUsersByIds(userIds)
  const subscriptions = await getActiveSubscriptionsForUserIds(userIds)
  const activeSubscriptions = subscriptions.filter(isActivePaidSubscription)
  const userCandidates = buildUserCandidatesMap(activeSubscriptions, userIds)

  const rows = await Promise.all(
    userIds.map(userId =>
      limit(async () => {
        const user = usersById.get(userId)
        if (!user?.email) {
          return null
        }

        const candidates = userCandidates.get(userId) || []
        const bestCandidate = chooseBestCandidate(candidates)

        const hasCommons = await userHasCurrentInstitutionLicence(
          userId,
          commonsCache
        )
        const commonsBeatsBestSubscription =
          CustomerIoPlanHelpers.shouldUseCommonsBestSubscription(
            hasCommons,
            bestCandidate,
            COMMONS_PLAN
          )

        const resolvedSubscription = commonsBeatsBestSubscription
          ? null
          : bestCandidate?.subscription
        const resolvedPlan = commonsBeatsBestSubscription
          ? COMMONS_PLAN
          : bestCandidate?.plan

        const bestSubscriptionForPlanType = commonsBeatsBestSubscription
          ? { type: 'commons', plan: COMMONS_PLAN }
          : resolvedSubscription
            ? {
                type: getPlanType(resolvedSubscription),
                plan: resolvedPlan,
              }
            : { type: 'free' }
        const planType = CustomerIoPlanHelpers.normalizePlanType(
          bestSubscriptionForPlanType
        )
        const displayPlanType =
          CustomerIoPlanHelpers.getFriendlyPlanName(planType) || ''
        const planTerm = resolvedSubscription
          ? getPlanCadence(resolvedSubscription, resolvedPlan)
          : ''

        const userIsMemberOfGroupSubscription =
          isMemberOfGroupSubscription(candidates)
        const userHasActiveOverleafSubscription = bestCandidate != null
        let nextRenewalDate = ''
        let expiryDate = ''
        let paymentRecord = null
        if (resolvedSubscription) {
          const paymentInfo = await getSubscriptionPaymentInfo(
            userId,
            resolvedSubscription,
            paymentInfoCache
          )
          if (paymentInfo.skip) {
            return null
          }
          nextRenewalDate = paymentInfo.nextRenewalDate
          paymentRecord = paymentInfo.paymentRecord
          expiryDate =
            CustomerIoPlanHelpers.getExpiryDateFromPaymentRecord(
              paymentRecord
            ) || ''
        }

        const aiPlan = getAiPlanForUser({
          bestSubscription: bestSubscriptionForPlanType,
          planType,
          individualSubscription: resolvedSubscription,
          paymentRecord,
          user,
          userIsMemberOfGroupSubscription,
          userHasActiveOverleafSubscription,
        })
        const aiPlanTerm = CustomerIoPlanHelpers.getAiPlanCadence(
          aiPlan,
          bestSubscriptionForPlanType,
          resolvedSubscription,
          paymentRecord
        )
        const groupAIEnabled = getGroupAiEnabled(candidates)
        const groupRole = getGroupRole(candidates, userId)

        return {
          userId,
          email: user.email,
          planType,
          displayPlanType,
          preMigrationPlanType: planType,
          preMigrationDisplayPlanType: displayPlanType,
          planTerm,
          aiPlan,
          aiPlanTerm: aiPlanTerm || '',
          nextRenewalDate,
          expiryDate,
          groupAIEnabled,
          groupRole,
        }
      })
    )
  )

  const csvRows = []

  for (const row of rows) {
    globalState.processedCount += 1
    if (row) {
      csvRows.push(row)
      globalState.writtenCount += 1
    } else {
      globalState.skippedCount += 1
    }
  }

  writeCsvRows(writeStream, csvRows, globalState.shouldWriteHeader)
  if (csvRows.length > 0) {
    globalState.shouldWriteHeader = false
  }

  globalState.lastProcessedUserId = userIds[userIds.length - 1]

  if (globalState.processedCount % checkpointInterval < userIds.length) {
    await trackProgress(
      `Checkpoint: processed=${globalState.processedCount}/${totalUsersCount || '?'} written=${globalState.writtenCount} skipped=${globalState.skippedCount} resumeAfterUserId=${globalState.lastProcessedUserId}`
    )
  }
}

async function main(trackProgress) {
  const {
    outputPath,
    concurrency,
    batchSize,
    resumeAfterUserId,
    checkpointInterval,
    append,
  } = parseArgs()

  await trackProgress(
    'Building target user cursor (subscriptions + supplementary users)'
  )
  if (resumeAfterUserId) {
    await trackProgress(
      `Resume enabled: starting after user id ${resumeAfterUserId}`
    )
  }

  const paymentInfoCache = new Map()
  const commonsCache = new Map()
  const limit = pLimit(Number(concurrency) || 5)
  const resolvedBatchSize = Math.max(1, Number(batchSize) || 500)
  const resolvedCheckpointInterval = Math.max(
    100,
    Number(checkpointInterval) || 10000
  )

  const outputFileExists = fs.existsSync(outputPath)
  const outputFileHasContent =
    outputFileExists && fs.statSync(outputPath).size > 0
  const writeStream = fs.createWriteStream(outputPath, {
    flags: append ? 'a' : 'w',
  })

  const globalState = {
    processedCount: 0,
    writtenCount: 0,
    skippedCount: 0,
    lastProcessedUserId: resumeAfterUserId || null,
    shouldWriteHeader: !append || !outputFileHasContent,
  }

  let pendingUserIds = []
  const targetUserIdsCursor = getTargetUserIdsCursor(resumeAfterUserId)

  for await (const doc of targetUserIdsCursor) {
    pendingUserIds.push(doc._id.toString())

    if (pendingUserIds.length >= resolvedBatchSize) {
      await processUserBatch({
        userIds: pendingUserIds,
        writeStream,
        paymentInfoCache,
        commonsCache,
        limit,
        trackProgress,
        totalUsersCount: null,
        globalState,
        checkpointInterval: resolvedCheckpointInterval,
      })
      pendingUserIds = []
    }
  }

  if (pendingUserIds.length > 0) {
    await processUserBatch({
      userIds: pendingUserIds,
      writeStream,
      paymentInfoCache,
      commonsCache,
      limit,
      trackProgress,
      totalUsersCount: null,
      globalState,
      checkpointInterval: resolvedCheckpointInterval,
    })
  }

  if (globalState.shouldWriteHeader) {
    writeCsvHeader(writeStream)
    globalState.shouldWriteHeader = false
  }

  writeStream.end()

  await trackProgress(
    `Final checkpoint: processed=${globalState.processedCount} written=${globalState.writtenCount} skipped=${globalState.skippedCount} resumeAfterUserId=${globalState.lastProcessedUserId}`
  )
  await trackProgress(`CSV generated: ${outputPath}`)
  console.log(`✅ Export complete: ${outputPath}`)
  console.log(`Rows written: ${globalState.writtenCount}`)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
