const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const Settings = require('@overleaf/settings')
const _ = require('lodash')
const crypto = require('crypto')
const OError = require('@overleaf/o-error')
const { callbackify } = require('util')

const duplicateSplitTest = _.findKey(
  _.groupBy(Settings.splitTests, 'id'),
  group => {
    return group.length > 1
  }
)
if (duplicateSplitTest) {
  throw new OError(
    `Split test IDs must be unique: ${duplicateSplitTest} is defined at least twice`
  )
}

const ACTIVE_SPLIT_TESTS = []
for (const splitTest of Settings.splitTests) {
  for (const variant of splitTest.variants) {
    if (variant.id === 'default') {
      throw new OError(
        `Split test variant ID cannot be 'default' (reserved value), defined in split test ${JSON.stringify(
          splitTest
        )}`
      )
    }
  }
  const totalVariantsRolloutPercent = _.sumBy(
    splitTest.variants,
    'rolloutPercent'
  )
  if (splitTest.active) {
    if (totalVariantsRolloutPercent > 100) {
      for (const variant of splitTest.variants) {
        variant.rolloutPercent =
          (variant.rolloutPercent * 100) / totalVariantsRolloutPercent
      }
    }
    if (totalVariantsRolloutPercent > 0) {
      ACTIVE_SPLIT_TESTS.push(splitTest)
    }
  }
}

async function getTestSegmentation(userId, splitTestId) {
  const splitTest = _.find(ACTIVE_SPLIT_TESTS, ['id', splitTestId])
  if (splitTest) {
    const alreadyAssignedVariant = await getAlreadyAssignedVariant(
      userId,
      splitTestId
    )
    if (alreadyAssignedVariant) {
      return {
        enabled: true,
        variant: alreadyAssignedVariant,
      }
    } else {
      const variant = await assignUserToVariant(userId, splitTest)
      return {
        enabled: true,
        variant,
      }
    }
  }
  return {
    enabled: false,
  }
}

async function getAlreadyAssignedVariant(userId, splitTestId) {
  const user = await UserGetter.promises.getUser(userId, { splitTests: 1 })
  if (user && user.splitTests) {
    return user.splitTests[splitTestId]
  }
  return undefined
}

async function assignUserToVariant(userId, splitTest) {
  let userIdAsPercentile = await _getPercentile(userId, splitTest.id)
  let selectedVariant = 'default'
  for (const variant of splitTest.variants) {
    if (userIdAsPercentile < variant.rolloutPercent) {
      selectedVariant = variant.id
      break
    } else {
      userIdAsPercentile -= variant.rolloutPercent
    }
  }
  await UserUpdater.promises.updateUser(userId, {
    $set: {
      [`splitTests.${splitTest.id}`]: selectedVariant,
    },
  })
  AnalyticsManager.setUserProperty(
    userId,
    `split-test-${splitTest.id}`,
    selectedVariant
  )
  return selectedVariant
}

function _getPercentile(userId, splitTestId) {
  const hash = crypto
    .createHash('md5')
    .update(userId + splitTestId)
    .digest('hex')
  const hashPrefix = hash.substr(0, 8)
  return Math.floor((parseInt(hashPrefix, 16) / 0xffffffff) * 100)
}

module.exports = {
  /**
   * @deprecated: use SplitTestV2Handler.getAssignment instead
   */
  getTestSegmentation: callbackify(getTestSegmentation),
  promises: {
    /**
     * @deprecated: use SplitTestV2Handler.promises.getAssignment instead
     */
    getTestSegmentation,
  },
}
