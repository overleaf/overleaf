const { SplitTest } = require('../../models/SplitTest')
const OError = require('@overleaf/o-error')
const _ = require('lodash')

const ALPHA_PHASE = 'alpha'
const BETA_PHASE = 'beta'
const RELEASE_PHASE = 'release'

async function getSplitTests({ name, activeOnly }) {
  const filters = {}
  if (name && name !== '') {
    filters.name = { $regex: _.escapeRegExp(name) }
  }
  if (activeOnly) {
    filters.$where = 'this.versions[this.versions.length - 1].active === true'
  }
  try {
    return await SplitTest.find(filters).limit(100).exec()
  } catch (error) {
    throw OError.tag(error, 'Failed to get split tests list')
  }
}

async function getSplitTestByName(name) {
  try {
    return await SplitTest.findOne({ name }).exec()
  } catch (error) {
    throw OError.tag(error, 'Failed to get split test', { name })
  }
}

async function createSplitTest(name, configuration, info = {}) {
  const stripedVariants = []
  let stripeStart = 0
  _checkNewVariantsConfiguration([], configuration.variants)
  for (const variant of configuration.variants) {
    stripedVariants.push({
      name: (variant.name || '').trim(),
      rolloutPercent: variant.rolloutPercent,
      rolloutStripes: [
        {
          start: stripeStart,
          end: stripeStart + variant.rolloutPercent,
        },
      ],
    })
    stripeStart += variant.rolloutPercent
  }
  const splitTest = new SplitTest({
    name: (name || '').trim(),
    description: info.description,
    expectedEndDate: info.expectedEndDate,
    ticketUrl: info.ticketUrl,
    reportsUrls: info.reportsUrls,
    winningVariant: info.winningVariant,
    versions: [
      {
        versionNumber: 1,
        phase: configuration.phase,
        active: configuration.active,
        analyticsEnabled:
          configuration.active && configuration.analyticsEnabled,
        variants: stripedVariants,
      },
    ],
  })
  return _saveSplitTest(splitTest)
}

async function updateSplitTestConfig(name, configuration) {
  const splitTest = await getSplitTestByName(name)
  if (splitTest) {
    const lastVersion = splitTest.getCurrentVersion().toObject()
    if (configuration.phase !== lastVersion.phase) {
      throw new OError(
        `Cannot update with different phase - use /switch-to-next-phase endpoint instead`
      )
    }
    _checkNewVariantsConfiguration(lastVersion.variants, configuration.variants)
    const updatedVariants = _updateVariantsWithNewConfiguration(
      lastVersion.variants,
      configuration.variants
    )

    splitTest.versions.push({
      versionNumber: lastVersion.versionNumber + 1,
      phase: configuration.phase,
      active: configuration.active,
      analyticsEnabled: configuration.active && configuration.analyticsEnabled,
      variants: updatedVariants,
    })
    return _saveSplitTest(splitTest)
  } else {
    throw new OError(`Cannot update split test '${name}': not found`)
  }
}

async function updateSplitTestInfo(name, info) {
  const splitTest = await getSplitTestByName(name)
  if (splitTest) {
    splitTest.description = info.description
    splitTest.expectedEndDate = info.expectedEndDate
    splitTest.ticketUrl = info.ticketUrl
    splitTest.reportsUrls = info.reportsUrls
    splitTest.winningVariant = info.winningVariant
    return _saveSplitTest(splitTest)
  } else {
    throw new OError(`Cannot update split test '${name}': not found`)
  }
}

async function switchToNextPhase(name) {
  const splitTest = await getSplitTestByName(name)
  if (splitTest) {
    const lastVersionCopy = splitTest.getCurrentVersion().toObject()
    lastVersionCopy.versionNumber++
    if (lastVersionCopy.phase === ALPHA_PHASE) {
      lastVersionCopy.phase = BETA_PHASE
    } else if (lastVersionCopy.phase === BETA_PHASE) {
      if (splitTest.forbidReleasePhase) {
        throw new OError('Switch to release phase is disabled for this test')
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
    }
    splitTest.versions.push(lastVersionCopy)
    return _saveSplitTest(splitTest)
  } else {
    throw new OError(
      `Cannot switch split test with ID '${name}' to next phase: not found`
    )
  }
}

async function revertToPreviousVersion(name, versionNumber) {
  const splitTest = await getSplitTestByName(name)
  if (splitTest) {
    if (splitTest.versions.length <= 1) {
      throw new OError(
        `Cannot revert split test with ID '${name}' to previous version: split test must have at least 2 versions`
      )
    }
    const previousVersion = splitTest.getVersion(versionNumber)
    if (!previousVersion) {
      throw new OError(
        `Cannot revert split test with ID '${name}' to version number ${versionNumber}: version not found`
      )
    }
    const lastVersion = splitTest.getCurrentVersion()
    if (
      lastVersion.phase === RELEASE_PHASE &&
      previousVersion.phase !== RELEASE_PHASE
    ) {
      splitTest.forbidReleasePhase = true
    }
    const previousVersionCopy = previousVersion.toObject()
    previousVersionCopy.versionNumber = lastVersion.versionNumber + 1
    splitTest.versions.push(previousVersionCopy)
    return _saveSplitTest(splitTest)
  } else {
    throw new OError(
      `Cannot revert split test with ID '${name}' to previous version: not found`
    )
  }
}

function _checkNewVariantsConfiguration(variants, newVariantsConfiguration) {
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
  }
}

function _updateVariantsWithNewConfiguration(
  variants,
  newVariantsConfiguration
) {
  let totalRolloutPercentage = _getTotalRolloutPercentage(variants)
  const variantsCopy = _.clone(variants)
  for (const newVariantConfig of newVariantsConfiguration) {
    const variant = _.find(variantsCopy, { name: newVariantConfig.name })
    if (!variant) {
      variantsCopy.push({
        name: newVariantConfig.name,
        rolloutPercent: newVariantConfig.rolloutPercent,
        rolloutStripes: [
          {
            start: totalRolloutPercentage,
            end: totalRolloutPercentage + newVariantConfig.rolloutPercent,
          },
        ],
      })
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
  }
  return variantsCopy
}

function _getTotalRolloutPercentage(variants) {
  return _.sumBy(variants, 'rolloutPercent')
}

async function _saveSplitTest(splitTest) {
  try {
    return (await splitTest.save()).toObject()
  } catch (error) {
    throw OError.tag(error, 'Failed to save split test', {
      splitTest: JSON.stringify(splitTest),
    })
  }
}

module.exports = {
  getSplitTestByName,
  getSplitTests,
  createSplitTest,
  updateSplitTestConfig,
  updateSplitTestInfo,
  switchToNextPhase,
  revertToPreviousVersion,
}
