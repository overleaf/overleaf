const { ObjectId } = require('mongodb')
const Settings = require('settings-sharelatex')

function shouldUserSeeNewLogsUI(user) {
  const {
    _id: userId,
    alphaProgram: isAlphaUser,
    betaProgram: isBetaUser
  } = user
  if (!userId) {
    return false
  }

  const userIdAsPercentile = (ObjectId(userId).getTimestamp() / 1000) % 100

  if (isAlphaUser) {
    return true
  } else if (isBetaUser && userIdAsPercentile < Settings.logsUIPercentageBeta) {
    return true
  } else if (userIdAsPercentile < Settings.logsUIPercentage) {
    return true
  } else {
    return false
  }
}

module.exports = {
  shouldUserSeeNewLogsUI
}
