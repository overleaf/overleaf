import _ from 'lodash'

function getCurrentVersion(splitTest) {
  if (splitTest?.versions?.length > 0) {
    return _.maxBy(splitTest.versions, 'versionNumber')
  } else {
    return undefined
  }
}

function getVersion(splitTest, versionNumber) {
  return _.find(splitTest.versions || [], {
    versionNumber,
  })
}

function isExperimentFull(variant) {
  const { userLimit, userCount } = variant
  if (typeof userLimit === 'number') {
    const currentCount = userCount ?? 0
    return currentCount >= userLimit
  }
  return false
}

export default {
  getCurrentVersion,
  getVersion,
  isExperimentFull,
}
