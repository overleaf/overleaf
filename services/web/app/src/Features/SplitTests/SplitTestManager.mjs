import { SplitTest } from '../../models/SplitTest.mjs'
import SplitTestUtils from './SplitTestUtils.mjs'
import OError from '@overleaf/o-error'
import _ from 'lodash'
import { CacheFlow } from 'cache-flow'

const ALPHA_PHASE = 'alpha'
const BETA_PHASE = 'beta'
const RELEASE_PHASE = 'release'

async function getSplitTests({ name, phase, type, active, archived }) {
  const filters = {}
  if (name && name !== '') {
    filters.name = { $regex: _.escapeRegExp(name) }
  }
  if (active) {
    filters.$where = 'this.versions[this.versions.length - 1].active === true'
  }
  if (type === 'split-test') {
    const query =
      'this.versions[this.versions.length - 1].analyticsEnabled === true'
    if (filters.$where) {
      filters.$where += `&& ${query}`
    } else {
      filters.$where = query
    }
  }
  if (type === 'gradual-rollout') {
    const query =
      'this.versions[this.versions.length - 1].analyticsEnabled === false'
    if (filters.$where) {
      filters.$where += `&& ${query}`
    } else {
      filters.$where = query
    }
  }
  if (['alpha', 'beta', 'release'].includes(phase)) {
    const query = `this.versions[this.versions.length - 1].phase === "${phase}"`
    if (filters.$where) {
      filters.$where += `&& ${query}`
    } else {
      filters.$where = query
    }
  }
  if (archived === true) {
    filters.archived = true
  } else if (archived === false) {
    filters.archived = { $ne: true }
  }
  try {
    return await SplitTest.find(filters)
      .populate('archivedBy', ['email', 'first_name', 'last_name'])
      .populate('versions.author', ['email', 'first_name', 'last_name'])
      .limit(300)
      .exec()
  } catch (error) {
    throw OError.tag(error, 'Failed to get split tests list')
  }
}

async function getRuntimeTests() {
  try {
    return SplitTest.find({}).lean().exec()
  } catch (error) {
    throw OError.tag(error, 'Failed to get active split tests list')
  }
}

async function getSplitTest(query) {
  try {
    return await SplitTest.findOne(query)
      .populate('archivedBy', ['email', 'first_name', 'last_name'])
      .populate('versions.author', ['email', 'first_name', 'last_name'])
      .exec()
  } catch (error) {
    throw OError.tag(error, 'Failed to get split test', { query })
  }
}

async function createSplitTest(
  { name, configuration, badgeInfo = {}, info = {} },
  userId
) {
  const stripedVariants = []
  let stripeStart = 0

  _checkNewVariantsConfiguration(
    [],
    configuration.variants,
    configuration.analyticsEnabled
  )
  for (const variant of configuration.variants) {
    const variantData = {
      name: (variant.name || '').trim(),
      rolloutPercent: variant.rolloutPercent,
      userLimit: variant.userLimit,
      rolloutStripes:
        variant.rolloutPercent > 0
          ? [
              {
                start: stripeStart,
                end: stripeStart + variant.rolloutPercent,
              },
            ]
          : [],
    }
    if (variant.userLimit && typeof variant.userLimit === 'number') {
      variantData.userCount = 0
    }
    stripedVariants.push(variantData)
    stripeStart += variant.rolloutPercent
  }
  const splitTest = new SplitTest({
    name: (name || '').trim(),
    description: info.description,
    ticketUrl: info.ticketUrl,
    reportsUrls: info.reportsUrls,
    winningVariant: info.winningVariant,
    badgeInfo,
    versions: [
      {
        versionNumber: 1,
        phase: configuration.phase,
        active: configuration.active,
        analyticsEnabled:
          configuration.active && configuration.analyticsEnabled,
        variants: stripedVariants,
        author: userId,
      },
    ],
    expectedEndDate: info.expectedEndDate,
    expectedUplift: info.expectedUplift,
    requiredCohortSize: info.requiredCohortSize,
  })
  return _saveSplitTest(splitTest)
}

async function updateSplitTestConfig({ name, configuration, comment }, userId) {
  const splitTest = await getSplitTest({ name })
  if (!splitTest) {
    throw new OError(`Cannot update split test '${name}': not found`)
  }
  if (splitTest.archived) {
    throw new OError('Cannot update an archived split test', { name })
  }
  const lastVersion = SplitTestUtils.getCurrentVersion(splitTest).toObject()
  if (configuration.phase !== lastVersion.phase) {
    throw new OError(
      `Cannot update with different phase - use /switch-to-next-phase endpoint instead`
    )
  }
  _checkNewVariantsConfiguration(
    lastVersion.variants,
    configuration.variants,
    configuration.analyticsEnabled
  )
  const updatedVariants = _updateVariantsWithNewConfiguration(
    lastVersion.variants,
    configuration.variants
  )

  splitTest.versions.push({
    versionNumber: lastVersion.versionNumber + 1,
    phase: configuration.phase,
    active: configuration.active,
    analyticsEnabled: configuration.analyticsEnabled,
    variants: updatedVariants,
    author: userId,
    comment,
  })
  return _saveSplitTest(splitTest)
}

async function updateSplitTestInfo(name, info) {
  const splitTest = await getSplitTest({ name })
  if (!splitTest) {
    throw new OError(`Cannot update split test '${name}': not found`)
  }
  splitTest.description = info.description
  splitTest.expectedEndDate = info.expectedEndDate
  splitTest.ticketUrl = info.ticketUrl
  splitTest.reportsUrls = info.reportsUrls
  splitTest.winningVariant = info.winningVariant
  return _saveSplitTest(splitTest)
}

async function updateSplitTestBadgeInfo(name, badgeInfo) {
  const splitTest = await getSplitTest({ name })
  if (!splitTest) {
    throw new OError(`Cannot update split test '${name}': not found`)
  }
  splitTest.badgeInfo = badgeInfo
  return _saveSplitTest(splitTest)
}

async function replaceSplitTests(tests) {
  _checkEnvIsSafe('replace')

  try {
    await _deleteSplitTests()
    return await SplitTest.create(tests)
  } catch (error) {
    throw OError.tag(error, 'Failed to replace all split tests', { tests })
  }
}

async function mergeSplitTests(incomingTests, overWriteLocal) {
  _checkEnvIsSafe('merge')

  // this is required as the query returns models, and we need all the items to be objects,
  //   similar to the ones we recieve as incomingTests
  const localTests = await SplitTest.find({}).lean().exec()

  let merged
  // we preserve the state of the local tests (baseTests)
  // eg: if inTest is in phase 1, and basetest is in phase 2, the merged will be in state 2
  // therefore, we can have the opposite effect by swapping the order of args (overwrite locals with sent tests)
  if (overWriteLocal) {
    merged = _mergeFlags(localTests, incomingTests)
  } else {
    merged = _mergeFlags(incomingTests, localTests)
  }

  try {
    await _deleteSplitTests()
    const success = await SplitTest.create(merged)
    return success
  } catch (error) {
    throw OError.tag(error, 'Failed to merge all split tests, merged set was', {
      merged,
    })
  }
}

async function switchToNextPhase({ name, comment }, userId) {
  const splitTest = await getSplitTest({ name })
  if (!splitTest) {
    throw new OError(
      `Cannot switch split test with ID '${name}' to next phase: not found`
    )
  }
  if (splitTest.archived) {
    throw new OError('Cannot switch an archived split test to next phase', {
      name,
    })
  }
  const lastVersionCopy = SplitTestUtils.getCurrentVersion(splitTest).toObject()
  lastVersionCopy.versionNumber++
  if (lastVersionCopy.phase === ALPHA_PHASE) {
    lastVersionCopy.phase = BETA_PHASE
  } else if (lastVersionCopy.phase === BETA_PHASE) {
    if (splitTest.forbidReleasePhase) {
      throw new OError('Switch to release phase is disabled for this test', {
        name,
      })
    }
    lastVersionCopy.phase = RELEASE_PHASE
  } else if (splitTest.phase === RELEASE_PHASE) {
    throw new OError(
      `Split test with ID '${name}' is already in the release phase`
    )
  }
  for (const variant of lastVersionCopy.variants) {
    variant.rolloutPercent = 0
    variant.rolloutStripes = []
    if (variant.userCount) {
      variant.userCount = 0
    }
  }
  lastVersionCopy.author = userId
  lastVersionCopy.comment = comment
  lastVersionCopy.createdAt = new Date()
  splitTest.versions.push(lastVersionCopy)
  return _saveSplitTest(splitTest)
}

async function revertToPreviousVersion(
  { name, versionNumber, comment },
  userId
) {
  const splitTest = await getSplitTest({ name })
  if (!splitTest) {
    throw new OError(
      `Cannot revert split test with ID '${name}' to previous version: not found`
    )
  }
  if (splitTest.archived) {
    throw new OError(
      'Cannot revert an archived split test to previous version',
      {
        name,
      }
    )
  }
  if (splitTest.versions.length <= 1) {
    throw new OError(
      `Cannot revert split test with ID '${name}' to previous version: split test must have at least 2 versions`
    )
  }
  const previousVersion = SplitTestUtils.getVersion(splitTest, versionNumber)
  if (!previousVersion) {
    throw new OError(
      `Cannot revert split test with ID '${name}' to version number ${versionNumber}: version not found`
    )
  }
  const lastVersion = SplitTestUtils.getCurrentVersion(splitTest)
  if (
    lastVersion.phase === RELEASE_PHASE &&
    previousVersion.phase !== RELEASE_PHASE
  ) {
    splitTest.forbidReleasePhase = true
  }
  const previousVersionCopy = previousVersion.toObject()
  previousVersionCopy.versionNumber = lastVersion.versionNumber + 1
  previousVersionCopy.createdAt = new Date()
  previousVersionCopy.author = userId
  previousVersionCopy.comment = comment

  // restore user count from most recent version of this phase
  const mostRecentVersionOfTargetPhase = splitTest.versions.findLast(
    v => v.phase === previousVersion.phase
  )

  if (mostRecentVersionOfTargetPhase) {
    for (const variant of previousVersionCopy.variants) {
      const correspondingVariant = mostRecentVersionOfTargetPhase.variants.find(
        v => v.name === variant.name
      )
      if (correspondingVariant?.userCount) {
        variant.userCount = correspondingVariant.userCount
      }
    }
  } else {
    for (const variant of previousVersionCopy.variants) {
      if (variant.userCount) {
        variant.userCount = 0
      }
    }
  }

  splitTest.versions.push(previousVersionCopy)
  return _saveSplitTest(splitTest)
}

async function archive(name, userId) {
  const splitTest = await getSplitTest({ name })
  if (!splitTest) {
    throw new OError(`Cannot archive split test with ID '${name}': not found`)
  }
  if (splitTest.archived) {
    throw new OError(`Split test with ID '${name}' is already archived`)
  }
  splitTest.archived = true
  splitTest.archivedAt = new Date()
  splitTest.archivedBy = userId
  return _saveSplitTest(splitTest)
}

async function clearCache() {
  await CacheFlow.reset('split-test')
}

function _checkNewVariantsConfiguration(
  variants,
  newVariantsConfiguration,
  analyticsEnabled
) {
  if (newVariantsConfiguration?.length > 1 && !analyticsEnabled) {
    throw new OError(`Gradual rollouts can only have a single variant`)
  }

  const totalRolloutPercentage = _getTotalRolloutPercentage(
    newVariantsConfiguration
  )
  if (totalRolloutPercentage > 100) {
    throw new OError(`Total variants rollout percentage cannot exceed 100`)
  }
  for (const variant of variants) {
    const newVariantConfiguration = _.find(newVariantsConfiguration, {
      name: variant.name,
    })
    if (!newVariantConfiguration) {
      throw new OError(
        `Variant defined in previous version as ${JSON.stringify(
          variant
        )} cannot be removed in new configuration: either set it inactive or create a new split test`
      )
    }
    if (newVariantConfiguration.rolloutPercent < variant.rolloutPercent) {
      throw new OError(
        `Rollout percentage for variant defined in previous version as ${JSON.stringify(
          variant
        )} cannot be decreased: revert to a previous configuration instead`
      )
    }
    if (variant.userLimit !== undefined) {
      // Existing variant has a user limit - can only increase it
      if (
        newVariantConfiguration.userLimit !== undefined &&
        newVariantConfiguration.userLimit < variant.userLimit
      ) {
        throw new OError(
          `User limit for variant '${variant.name}' cannot be decreased: revert to a previous configuration instead`
        )
      }
    } else {
      // Existing variant has no user limit - cannot add one
      if (newVariantConfiguration.userLimit !== undefined) {
        throw new OError(
          `User limit cannot be added to variant '${variant.name}' after creation: user limits can only be set when the split test is created`
        )
      }
    }
  }
}

function _updateVariantsWithNewConfiguration(
  variants,
  newVariantsConfiguration
) {
  let totalRolloutPercentage = _getTotalRolloutPercentage(variants)
  const variantsCopy = _.clone(variants)
  for (const newVariantConfig of newVariantsConfiguration) {
    if (newVariantConfig.rolloutPercent === 0) {
      continue
    }
    const variant = _.find(variantsCopy, { name: newVariantConfig.name })
    if (!variant) {
      const newVariant = {
        name: newVariantConfig.name,
        rolloutPercent: newVariantConfig.rolloutPercent,
        rolloutStripes: [
          {
            start: totalRolloutPercentage,
            end: totalRolloutPercentage + newVariantConfig.rolloutPercent,
          },
        ],
      }
      if (
        newVariantConfig.userLimit &&
        typeof newVariantConfig.userLimit === 'number'
      ) {
        newVariant.userLimit = newVariantConfig.userLimit
        newVariant.userCount = 0
      }
      variantsCopy.push(newVariant)
      totalRolloutPercentage += newVariantConfig.rolloutPercent
    } else if (variant.rolloutPercent < newVariantConfig.rolloutPercent) {
      const newStripeSize =
        newVariantConfig.rolloutPercent - variant.rolloutPercent
      variant.rolloutPercent = newVariantConfig.rolloutPercent
      variant.rolloutStripes.push({
        start: totalRolloutPercentage,
        end: totalRolloutPercentage + newStripeSize,
      })
      totalRolloutPercentage += newStripeSize
    }
    if (newVariantConfig.userLimit >= variant?.userLimit) {
      variant.userLimit = newVariantConfig.userLimit
    }
    if (variant?.userLimit && !variant.userCount) {
      variant.userCount = 0
    }
  }
  return variantsCopy
}

function _getTotalRolloutPercentage(variants) {
  return _.sumBy(variants, 'rolloutPercent')
}

async function _saveSplitTest(splitTest) {
  try {
    const savedSplitTest = await splitTest.save()
    await savedSplitTest.populate('archivedBy', [
      'email',
      'first_name',
      'last_name',
    ])
    await savedSplitTest.populate('versions.author', [
      'email',
      'first_name',
      'last_name',
    ])
    return savedSplitTest.toObject()
  } catch (error) {
    throw OError.tag(error, 'Failed to save split test', {
      splitTest: JSON.stringify(splitTest),
    })
  }
}

/*
 * As this is only used for utility in local dev environment, we should make sure this isn't run in
 * any other deployment environment.
 */
function _checkEnvIsSafe(operation) {
  if (process.env.NODE_ENV !== 'development') {
    throw new OError(
      `Attempted to ${operation} all feature flags outside of local env`
    )
  }
}

async function _deleteSplitTests() {
  _checkEnvIsSafe('delete')
  let deleted

  try {
    deleted = await SplitTest.deleteMany({}).exec()
  } catch (error) {
    throw new OError('Failed to delete all split tests')
  }

  if (!deleted.acknowledged) {
    throw new OError('Error deleting split tests, split tests have not updated')
  }
}

function _mergeFlags(incomingTests, baseTests) {
  // copy all base versions
  const mergedSet = baseTests.map(test => test)
  for (const inTest of incomingTests) {
    // since name is a unique key, we can use it to compare
    const newFeatureFlag = !mergedSet.some(bTest => bTest.name === inTest.name)
    // only add new feature flags, instead of overwriting ones in baseTests, meaning baseTests take precendence
    if (newFeatureFlag) {
      mergedSet.push(inTest)
    }
  }
  return mergedSet
}

export default {
  getSplitTest,
  getSplitTests,
  getRuntimeTests,
  createSplitTest,
  updateSplitTestConfig,
  updateSplitTestInfo,
  updateSplitTestBadgeInfo,
  switchToNextPhase,
  revertToPreviousVersion,
  archive,
  replaceSplitTests,
  mergeSplitTests,
  clearCache,
}
