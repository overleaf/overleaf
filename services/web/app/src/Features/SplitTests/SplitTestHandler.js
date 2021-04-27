const Settings = require('settings-sharelatex')
const _ = require('lodash')
const { ObjectId } = require('mongodb')
const OError = require('@overleaf/o-error')

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

function getTestSegmentation(userId, splitTestId) {
  const splitTest = _.find(ACTIVE_SPLIT_TESTS, ['id', splitTestId])
  if (splitTest) {
    let userIdAsPercentile = (ObjectId(userId).getTimestamp() / 1000) % 100
    for (const variant of splitTest.variants) {
      if (userIdAsPercentile < variant.rolloutPercent) {
        return {
          enabled: true,
          variant: variant.id,
        }
      } else {
        userIdAsPercentile -= variant.rolloutPercent
      }
    }
    return {
      enabled: true,
      variant: 'default',
    }
  }
  return {
    enabled: false,
  }
}

module.exports = {
  getTestSegmentation,
}
